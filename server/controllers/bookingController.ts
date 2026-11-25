import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  Booking,
  CustomerProfile,
  ManualPayment,
  PaymentMethod,
  PaymentStatus,
  StaffMessage,
  TaskReport,
} from '../../src/types/hotel.ts';

function computePaymentStatus(paid: number, total: number): PaymentStatus {
  if (paid <= 0) return 'Unpaid';
  if (paid >= total) return 'Paid';
  return 'Partial';
}

export function listBookings(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  res.json(db.bookings.filter((b) => b.hotelId === hotelId));
}

export function listPayments(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  res.json(db.payments.filter((p) => p.hotelId === hotelId));
}

export function checkInGuest(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const {
    roomId,
    guestName,
    guestPhone,
    idNumber,
    nationality,
    nights,
    initialPaymentAmount,
    paymentMethod,
    referenceNumber,
    notes,
    staffId,
  } = req.body as {
    roomId?: string;
    guestName?: string;
    guestPhone?: string;
    idNumber?: string;
    nationality?: string;
    nights?: number;
    initialPaymentAmount?: number;
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    staffId?: string;
  };

  if (!roomId || !guestName?.trim() || !guestPhone?.trim() || !idNumber?.trim() || !nights || nights < 1) {
    res.status(400).json({ error: 'Room, guest name, phone, ID number, and valid nights are required.' });
    return;
  }

  const db = readDb();
  const roomIdx = db.rooms.findIndex((r) => r.id === roomId && r.hotelId === hotelId);
  if (roomIdx === -1) {
    res.status(404).json({ error: 'Selected room was not found in this hotel.' });
    return;
  }

  const room = db.rooms[roomIdx];
  if (room.occupancyStatus !== 'Available') {
    res.status(409).json({ error: `Room ${room.roomNumber} is currently ${room.occupancyStatus}.` });
    return;
  }
  if (room.cleaningStatus !== 'Clean') {
    res.status(409).json({ error: `Room ${room.roomNumber} must be marked Clean by Housekeeping before check-in.` });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const totalAmount = room.ratePerNight * Number(nights);
  const deposit = Math.max(0, Number(initialPaymentAmount) || 0);
  const bookingId = `bk-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newBooking: Booking = {
    id: bookingId,
    hotelId,
    roomId: room.id,
    roomNumber: room.roomNumber,
    guestName: guestName.trim(),
    guestPhone: guestPhone.trim(),
    idNumber: idNumber.trim(),
    nationality: nationality?.trim() || 'Ethiopian',
    nights: Number(nights),
    ratePerNight: room.ratePerNight,
    totalAmount,
    paidAmount: deposit,
    paymentStatus: computePaymentStatus(deposit, totalAmount),
    bookingStatus: 'Checked In',
    checkInAt: nowIso,
    checkOutAt: null,
    checkedInBy: actor.name,
    notes: notes?.trim() || '',
  };

  db.bookings = [newBooking, ...db.bookings];
  room.occupancyStatus = 'Occupied';
  room.currentBookingId = bookingId;
  db.rooms[roomIdx] = room;

  // Auto-upsert guest into this hotel's CustomerProfile registry
  const custIdx = db.customers.findIndex(
    (c) =>
      c.hotelId === hotelId &&
      c.idNumber.trim().toLowerCase() === newBooking.idNumber.toLowerCase()
  );
  if (custIdx !== -1) {
    db.customers[custIdx].totalStays += 1;
    db.customers[custIdx].lastVisitAt = nowIso;
    db.customers[custIdx].phone = newBooking.guestPhone;
  } else {
    const newCustomer: CustomerProfile = {
      id: `cust-${Date.now()}`,
      hotelId,
      fullName: newBooking.guestName,
      phone: newBooking.guestPhone,
      email: '',
      idType: 'National ID',
      idNumber: newBooking.idNumber,
      nationality: newBooking.nationality,
      cityOrAddress: '',
      company: '',
      preferences: newBooking.notes,
      totalStays: 1,
      lastVisitAt: nowIso,
      registeredBy: actor.name,
      createdAt: nowIso,
    };
    db.customers = [newCustomer, ...db.customers];
  }

  let createdPayment: ManualPayment | null = null;
  if (deposit > 0) {
    const method: PaymentMethod = paymentMethod || 'Cash';
    const ref = referenceNumber?.trim() || `${method === 'Cash' ? 'CSH' : 'REF'}-${Date.now().toString().slice(-6)}`;
    const autoVerified = actor.role === 'cashier' || actor.role === 'manager';
    createdPayment = {
      id: `pay-${Date.now()}`,
      hotelId,
      bookingId,
      orderId: null,
      sourceType: 'Check-In Deposit',
      tableOrLocation: `Room ${room.roomNumber}`,
      roomNumber: room.roomNumber,
      guestName: newBooking.guestName,
      amount: deposit,
      method,
      referenceNumber: ref,
      receivedBy: actor.name,
      receivedById: actor.id,
      receivedByRole: actor.role,
      verificationStatus: autoVerified ? 'Verified' : 'Pending Cashier',
      verifiedBy: autoVerified ? actor.name : null,
      verifiedByRole: autoVerified ? actor.role : null,
      verifiedAt: autoVerified ? nowIso : null,
      notes: 'Initial check-in deposit',
      recordedAt: nowIso,
    };
    db.payments = [createdPayment, ...db.payments];
  }

  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Checked in ${newBooking.guestName} to Room ${room.roomNumber} (${newBooking.nights} nights)`,
    amharicAction: `${newBooking.guestName}ን በክፍል ${room.roomNumber} ለ${newBooking.nights} ሌሊት አስገብተዋል`,
    targetRef: `Room ${room.roomNumber}`,
    details: `Total: ${totalAmount.toLocaleString()} ETB · Paid at check-in: ${deposit.toLocaleString()} ETB`,
    amount: totalAmount,
  });

  if (createdPayment) {
    appendActivityLog({
      hotelId,
      staffId: actor.id,
      portal: actor.role === 'cashier' ? 'Cashier' : 'Payment',
      action: `Recorded ${createdPayment.amount.toLocaleString()} ETB (${createdPayment.method})`,
      amharicAction: `${createdPayment.amount.toLocaleString()} ብር ማኑዋል ክፍያ (${createdPayment.method}) መዝግበዋል`,
      targetRef: createdPayment.referenceNumber,
      details: `Room ${room.roomNumber} · ${newBooking.guestName} · ${createdPayment.verificationStatus}`,
      amount: createdPayment.amount,
      paymentMethod: createdPayment.method,
      paymentId: createdPayment.id,
    });
  }

  res.status(201).json({ booking: newBooking, payment: createdPayment, room });
}

export function checkOutGuest(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { staffId, forceCheckout } = req.body as { staffId?: string; forceCheckout?: boolean };

  const db = readDb();
  const bkIdx = db.bookings.findIndex((b) => b.id === id && b.hotelId === hotelId);
  if (bkIdx === -1) {
    res.status(404).json({ error: 'Booking not found in this hotel' });
    return;
  }

  const booking = db.bookings[bkIdx];
  if (booking.bookingStatus === 'Checked Out') {
    res.status(409).json({ error: 'Guest is already checked out' });
    return;
  }

  const balance = booking.totalAmount - booking.paidAmount;
  if (balance > 0 && !forceCheckout) {
    res.status(402).json({
      error: `Outstanding balance of ${balance.toLocaleString()} ETB remains. Settle payment or confirm checkout override.`,
      balance,
    });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = 'Checked Out';
  booking.checkOutAt = nowIso;
  db.bookings[bkIdx] = booking;

  const roomIdx = db.rooms.findIndex((r) => r.id === booking.roomId && r.hotelId === hotelId);
  if (roomIdx !== -1) {
    db.rooms[roomIdx].occupancyStatus = 'Available';
    db.rooms[roomIdx].cleaningStatus = 'Dirty';
    db.rooms[roomIdx].currentBookingId = null;
    db.rooms[roomIdx].housekeepingNotes = `Guest checked out — awaiting cleaning`;
  }

  // Automatically notify Housekeeping via StaffMessage without revealing guest details
  const dispatchMsg: StaffMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    recipientRole: 'housekeeping',
    category: 'Task Dispatch',
    priority: 'Urgent',
    roomNumber: booking.roomNumber,
    subject: `Room ${booking.roomNumber} vacated — cleaning required`,
    body: `Check-out completed for Room ${booking.roomNumber}. Please clean and inspect for next guest.`,
    createdAt: nowIso,
    acknowledgedBy: [],
  };
  db.messages = [dispatchMsg, ...db.messages];

  const hkTask: TaskReport = {
    id: `tsk-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    roomId: booking.roomId,
    roomNumber: booking.roomNumber,
    targetDepartment: 'housekeeping',
    priority: 'Urgent',
    title: `Checkout cleaning turnover for Room ${booking.roomNumber}`,
    notes: 'Guest checked out; sanitize room and replace linens.',
    status: 'Pending',
    reportedBy: actor.name,
    reportedByRole: actor.role,
    acceptedBy: null,
    completedBy: null,
    completionNotes: '',
    createdAt: nowIso,
    startedAt: null,
    completedAt: null,
  };
  db.taskReports = [hkTask, ...db.taskReports];

  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Checked out ${booking.guestName} from Room ${booking.roomNumber} (Flagged Dirty)`,
    amharicAction: `${booking.guestName}ን ከክፍል ${booking.roomNumber} አስወጥተዋል (ክፍሉ ለጽዳት ተልኳል)`,
    targetRef: `Room ${booking.roomNumber}`,
    details: balance > 0 ? `Checked out with ${balance.toLocaleString()} ETB balance` : 'Account fully settled',
  });

  res.json({ booking, room: roomIdx !== -1 ? db.rooms[roomIdx] : null });
}

export function recordManualPayment(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { bookingId, amount, method, referenceNumber, notes, staffId } = req.body as {
    bookingId?: string;
    amount?: number;
    method?: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    staffId?: string;
  };

  if (!bookingId || !amount || Number(amount) <= 0 || !method || !referenceNumber?.trim()) {
    res.status(400).json({ error: 'Booking, positive amount, payment method, and receipt/reference number are required.' });
    return;
  }

  const db = readDb();
  const bkIdx = db.bookings.findIndex((b) => b.id === bookingId && b.hotelId === hotelId);
  if (bkIdx === -1) {
    res.status(404).json({ error: 'Booking record not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const booking = db.bookings[bkIdx];
  const paymentAmount = Number(amount);
  const nowIso = new Date().toISOString();
  const autoVerified = actor.role === 'cashier' || actor.role === 'manager';

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
    verificationStatus: autoVerified ? 'Verified' : 'Pending Cashier',
    verifiedBy: autoVerified ? actor.name : null,
    verifiedByRole: autoVerified ? actor.role : null,
    verifiedAt: autoVerified ? nowIso : null,
    notes: notes?.trim() || '',
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
    portal: actor.role === 'cashier' ? 'Cashier' : 'Payment',
    action: `${autoVerified ? 'Verified' : 'Recorded'} ${paymentAmount.toLocaleString()} ETB manual payment via ${method}`,
    amharicAction: `${paymentAmount.toLocaleString()} ብር ማኑዋል ክፍያ በ${method} ${autoVerified ? 'አረጋግጠው መዝግበዋል' : 'መዝግበዋል (የካሸር ማረጋገጫ ይጠብቃል)'}`,
    targetRef: payment.referenceNumber,
    details: `Room ${booking.roomNumber} · ${booking.guestName} · ${payment.verificationStatus}${payment.notes ? ` · ${payment.notes}` : ''}`,
    amount: paymentAmount,
    paymentMethod: method,
    paymentId: payment.id,
  });

  res.status(201).json({ payment, booking });
}
