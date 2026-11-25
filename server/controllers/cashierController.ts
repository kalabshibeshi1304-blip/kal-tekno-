import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  CashierSummary,
  ManualPayment,
  PaymentMethod,
  PaymentStatus,
} from '../../src/types/hotel.ts';

function computePaymentStatus(paid: number, total: number): PaymentStatus {
  if (paid <= 0) return 'Unpaid';
  if (paid >= total) return 'Paid';
  return 'Partial';
}

export function getCashierSummary(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();

  const hotelPayments = db.payments.filter((p) => p.hotelId === hotelId);
  const hotelBookings = db.bookings.filter((b) => b.hotelId === hotelId);
  const hotelOrders = db.fbOrders.filter((o) => o.hotelId === hotelId);

  let cashCollected = 0;
  let bankTransferCollected = 0;
  let telebirrCollected = 0;
  let posCardCollected = 0;

  for (const p of hotelPayments) {
    if (p.method === 'Cash') cashCollected += p.amount;
    else if (p.method === 'Telebirr') telebirrCollected += p.amount;
    else if (p.method === 'POS Card Slip') posCardCollected += p.amount;
    else bankTransferCollected += p.amount;
  }

  const totalCollected = cashCollected + bankTransferCollected + telebirrCollected + posCardCollected;
  const openOrders = hotelOrders.filter(
    (o) =>
      o.status !== 'Cancelled' &&
      !o.isPaid &&
      o.settlementMode !== 'Charge to Room' &&
      o.billStatus !== 'Charged to Room'
  );
  const openOrdersTotal = openOrders.reduce((sum, o) => sum + Math.max(0, o.totalAmount - (o.discountAmount || 0)), 0);
  const billRequestedCount = openOrders.filter((o) => o.billStatus === 'Bill Requested').length;

  const pendingPayments = hotelPayments.filter((p) => p.verificationStatus === 'Pending Cashier');
  const pendingVerificationTotal = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const outstandingBookingBalance = hotelBookings
    .filter((b) => b.bookingStatus === 'Checked In' || b.paidAmount < b.totalAmount)
    .reduce((sum, b) => sum + Math.max(0, b.totalAmount - b.paidAmount), 0);

  const recentCashierLogs = db.activityLogs
    .filter(
      (l) =>
        l.hotelId === hotelId &&
        (l.portal === 'Cashier' || l.portal === 'Payment' || l.portal === 'Waiter' || l.portal === 'F&B')
    )
    .slice(0, 40);

  const summary: CashierSummary = {
    hotelId,
    date: new Date().toISOString().slice(0, 10),
    totalCollected,
    cashCollected,
    bankTransferCollected,
    telebirrCollected,
    posCardCollected,
    openOrdersCount: openOrders.length,
    openOrdersTotal,
    billRequestedCount,
    pendingVerificationCount: pendingPayments.length,
    pendingVerificationTotal,
    outstandingBookingBalance,
    openOrders,
    pendingPayments,
    recentCashierLogs,
  };

  res.json(summary);
}

export function requestOrderBill(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { staffId } = req.body as { staffId?: string };

  const db = readDb();
  const idx = db.fbOrders.findIndex((o) => o.id === id && o.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Order not found in this hotel.' });
    return;
  }

  const order = db.fbOrders[idx];
  if (order.isPaid || order.billStatus === 'Paid') {
    res.status(409).json({ error: 'This order is already paid.' });
    return;
  }
  if (order.settlementMode === 'Charge to Room') {
    res.status(409).json({ error: 'This order is already charged to a guest room folio.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const nowIso = new Date().toISOString();

  order.billStatus = 'Bill Requested';
  db.fbOrders[idx] = order;

  if (order.tableId) {
    const tblIdx = db.tables.findIndex((t) => t.id === order.tableId && t.hotelId === hotelId);
    if (tblIdx !== -1) {
      db.tables[tblIdx].status = 'Needs Bill';
      db.tables[tblIdx].updatedAt = nowIso;
    }
  }

  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: actor.role === 'cashier' ? 'Cashier' : 'Waiter',
    action: `Sent ${order.tableOrLocation} bill to Cashier (${order.totalAmount.toLocaleString()} ETB)`,
    amharicAction: `የ${order.tableOrLocation} ሂሳብ (${order.totalAmount.toLocaleString()} ብር) ወደ ካሸር (Cashier) ተልኳል`,
    targetRef: order.tableOrLocation,
    details: `${order.guestName} · ${order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
    amount: order.totalAmount,
    orderId: order.id,
  });

  res.json(order);
}

export function settleOrderAsCashier(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const {
    paymentMethod,
    referenceNumber,
    discountAmount = 0,
    freeTable = true,
    notes,
    staffId,
  } = req.body as {
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
    discountAmount?: number;
    freeTable?: boolean;
    notes?: string;
    staffId?: string;
  };

  const db = readDb();
  const idx = db.fbOrders.findIndex((o) => o.id === id && o.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Order not found in this hotel.' });
    return;
  }

  const order = db.fbOrders[idx];
  if (order.status === 'Cancelled') {
    res.status(409).json({ error: 'Cannot settle a cancelled order.' });
    return;
  }
  if (order.isPaid || order.billStatus === 'Paid') {
    res.status(409).json({ error: 'Order has already been settled and paid.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const nowIso = new Date().toISOString();
  const method: PaymentMethod = paymentMethod || 'Cash';
  const cleanDiscount = Math.max(0, Math.min(order.totalAmount - 1, Number(discountAmount) || 0));
  const netAmount = Math.max(1, order.totalAmount - cleanDiscount);
  const ref =
    referenceNumber?.trim() ||
    `CSH-${Date.now().toString().slice(-6)}`;

  const payment: ManualPayment = {
    id: `pay-ord-${Date.now()}`,
    hotelId,
    bookingId: order.bookingId || (order.channel === 'Room Service' ? 'room-service' : 'walk-in-table'),
    orderId: order.id,
    sourceType: order.channel === 'Room Service' ? 'Room Service' : 'Table / F&B Order',
    tableOrLocation: order.tableOrLocation,
    roomNumber: order.roomNumber || order.tableOrLocation,
    guestName: order.guestName,
    amount: netAmount,
    method,
    referenceNumber: ref,
    receivedBy: actor.name,
    receivedById: actor.id,
    receivedByRole: actor.role,
    verificationStatus: 'Verified',
    verifiedBy: actor.name,
    verifiedByRole: actor.role,
    verifiedAt: nowIso,
    notes:
      notes?.trim() ||
      `Cashier settled ${order.tableOrLocation}${cleanDiscount > 0 ? ` (Discount ${cleanDiscount.toLocaleString()} ETB)` : ''} · ${order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
    recordedAt: nowIso,
  };

  order.isPaid = true;
  order.billStatus = 'Paid';
  order.discountAmount = cleanDiscount;
  order.paymentMethod = method;
  order.referenceNumber = ref;
  order.cashierId = actor.id;
  order.cashierName = actor.name;
  order.paymentId = payment.id;
  order.paidAt = nowIso;

  db.fbOrders[idx] = order;
  db.payments = [payment, ...db.payments];

  if (freeTable && order.tableId) {
    const tblIdx = db.tables.findIndex((t) => t.id === order.tableId && t.hotelId === hotelId);
    if (tblIdx !== -1) {
      db.tables[tblIdx].status = 'Available';
      db.tables[tblIdx].assignedWaiterId = null;
      db.tables[tblIdx].assignedWaiterName = null;
      db.tables[tblIdx].guestCount = 0;
      db.tables[tblIdx].activeOrderId = null;
      db.tables[tblIdx].updatedAt = nowIso;
    }
  }

  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Cashier',
    action: `Settled ${order.tableOrLocation} order (${netAmount.toLocaleString()} ETB via ${method})`,
    amharicAction: `ካሸር ${actor.amharicName} የ${order.tableOrLocation} ትዕዛዝ ሂሳብ በ${method} አወራርደዋል (${netAmount.toLocaleString()} ብር)`,
    targetRef: ref,
    details: `${order.guestName} · Order ${order.id} · Receipt ${payment.id}`,
    amount: netAmount,
    paymentMethod: method,
    orderId: order.id,
    paymentId: payment.id,
  });

  res.status(201).json({ order, payment });
}

export function verifyManualPayment(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { notes, staffId } = req.body as { notes?: string; staffId?: string };

  const db = readDb();
  const idx = db.payments.findIndex((p) => p.id === id && p.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Payment record not found in this hotel.' });
    return;
  }

  const payment = db.payments[idx];
  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const nowIso = new Date().toISOString();

  payment.verificationStatus = 'Verified';
  payment.verifiedBy = actor.name;
  payment.verifiedByRole = actor.role;
  payment.verifiedAt = nowIso;
  if (notes?.trim()) {
    payment.notes = payment.notes ? `${payment.notes} · Cashier: ${notes.trim()}` : notes.trim();
  }

  db.payments[idx] = payment;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Cashier',
    action: `Verified receipt ${payment.referenceNumber} (${payment.amount.toLocaleString()} ETB · ${payment.method})`,
    amharicAction: `ካሸር ${actor.amharicName} የ${payment.referenceNumber} ደረሰኝ (${payment.amount.toLocaleString()} ብር) አረጋግጠዋል`,
    targetRef: payment.referenceNumber,
    details: `${payment.guestName} · Room/Loc ${payment.roomNumber} · Recorded by ${payment.receivedBy}`,
    amount: payment.amount,
    paymentMethod: payment.method,
    orderId: payment.orderId || null,
    paymentId: payment.id,
  });

  res.json(payment);
}

export function recordCashierBookingPayment(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { amount, method, referenceNumber, notes, staffId } = req.body as {
    amount?: number;
    method?: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    staffId?: string;
  };

  if (!amount || Number(amount) <= 0 || !method || !referenceNumber?.trim()) {
    res.status(400).json({ error: 'Positive amount, payment method, and receipt reference are required.' });
    return;
  }

  const db = readDb();
  const bkIdx = db.bookings.findIndex((b) => b.id === id && b.hotelId === hotelId);
  if (bkIdx === -1) {
    res.status(404).json({ error: 'Booking record not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const booking = db.bookings[bkIdx];
  const paymentAmount = Number(amount);
  const nowIso = new Date().toISOString();

  const payment: ManualPayment = {
    id: `pay-${Date.now()}`,
    hotelId,
    bookingId: booking.id,
    orderId: null,
    sourceType: 'Room Booking',
    tableOrLocation: `Room ${booking.roomNumber}`,
    roomNumber: booking.roomNumber,
    guestName: booking.guestName,
    amount: paymentAmount,
    method,
    referenceNumber: referenceNumber.trim(),
    receivedBy: actor.name,
    receivedById: actor.id,
    receivedByRole: actor.role,
    verificationStatus: 'Verified',
    verifiedBy: actor.name,
    verifiedByRole: actor.role,
    verifiedAt: nowIso,
    notes: notes?.trim() || 'Collected & verified at Cashier counter',
    recordedAt: nowIso,
  };

  booking.paidAmount += paymentAmount;
  booking.paymentStatus = computePaymentStatus(booking.paidAmount, booking.totalAmount);
  db.bookings[bkIdx] = booking;
  db.payments = [payment, ...db.payments];
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Cashier',
    action: `Collected ${paymentAmount.toLocaleString()} ETB room folio payment via ${method}`,
    amharicAction: `ካሸር ${actor.amharicName} ለክፍል ${booking.roomNumber} ${paymentAmount.toLocaleString()} ብር ክፍያ (${method}) ተቀብለዋል`,
    targetRef: payment.referenceNumber,
    details: `Room ${booking.roomNumber} · ${booking.guestName}`,
    amount: paymentAmount,
    paymentMethod: method,
    paymentId: payment.id,
  });

  res.status(201).json({ payment, booking });
}
