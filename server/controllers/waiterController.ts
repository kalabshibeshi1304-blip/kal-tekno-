import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  DiningTable,
  DiningTableStatus,
  ManualPayment,
  PaymentMethod,
  TableArea,
} from '../../src/types/hotel.ts';
import { processAndStoreFbOrder, type CreateOrderInput } from './fbController.ts';

export function listTables(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();
  res.json(db.tables.filter((t) => t.hotelId === hotelId));
}

export function createTable(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { tableNumber, area, seats, staffId } = req.body as {
    tableNumber?: string;
    area?: TableArea;
    seats?: number;
    staffId?: string;
  };

  if (!tableNumber?.trim()) {
    res.status(400).json({ error: 'Table number is required (e.g. T-09).' });
    return;
  }

  const db = readDb();
  const normalized = tableNumber.trim().toUpperCase();
  if (db.tables.some((t) => t.hotelId === hotelId && t.tableNumber.toUpperCase() === normalized)) {
    res.status(409).json({ error: `Table ${normalized} already exists in this hotel.` });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const newTable: DiningTable = {
    id: `${hotelId}-tbl-${Date.now().toString().slice(-4)}`,
    hotelId,
    tableNumber: normalized,
    area: area || 'Main Dining',
    seats: Math.max(1, Math.min(20, Number(seats) || 4)),
    status: 'Available',
    assignedWaiterId: null,
    assignedWaiterName: null,
    guestCount: 0,
    activeOrderId: null,
    updatedAt: new Date().toISOString(),
  };

  db.tables.push(newTable);
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Waiter',
    action: `Added dining table ${newTable.tableNumber} (${newTable.area}, ${newTable.seats} seats)`,
    amharicAction: `አዲስ ጠረጴዛ ${newTable.tableNumber} (${newTable.area}) ተጨምሯል`,
    targetRef: newTable.tableNumber,
    details: `${newTable.seats} seats`,
  });

  res.status(201).json(newTable);
}

export function updateTableStatus(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { status, guestCount, staffId } = req.body as {
    status?: DiningTableStatus;
    guestCount?: number;
    staffId?: string;
  };

  if (!status || !['Available', 'Seated', 'Order Active', 'Needs Bill'].includes(status)) {
    res.status(400).json({ error: 'Invalid table status.' });
    return;
  }

  const db = readDb();
  const idx = db.tables.findIndex((t) => t.id === id && t.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Table not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const table = db.tables[idx];
  table.status = status;
  table.updatedAt = new Date().toISOString();

  if (status === 'Available') {
    table.assignedWaiterId = null;
    table.assignedWaiterName = null;
    table.guestCount = 0;
    table.activeOrderId = null;
  } else {
    table.assignedWaiterId = actor.id;
    table.assignedWaiterName = actor.name;
    if (typeof guestCount === 'number' && guestCount > 0) {
      table.guestCount = guestCount;
    } else if (table.guestCount === 0) {
      table.guestCount = 2;
    }
  }

  db.tables[idx] = table;
  writeDb(db);

  res.json(table);
}

export function placeWaiterOrder(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const body = req.body as CreateOrderInput;

  const result = processAndStoreFbOrder({
    ...body,
    hotelId,
    staffId: body.staffId || req.user?.userId,
    portal: 'Waiter',
  });

  if (result.ok === false) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(result.appendedRound ? 200 : 201).json(result.order);
}

export function settleTableOrder(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { paymentMethod, referenceNumber, freeTable = true, staffId } = req.body as {
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
    freeTable?: boolean;
    staffId?: string;
  };

  const db = readDb();
  const idx = db.fbOrders.findIndex((o) => o.id === id && o.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Order not found in this hotel.' });
    return;
  }

  const order = db.fbOrders[idx];
  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const nowIso = new Date().toISOString();
  let createdPaymentId: string | null = order.paymentId || null;

  if (!order.isPaid) {
    const method: PaymentMethod = paymentMethod || 'Cash';
    const ref = referenceNumber?.trim() || `TBL-PAY-${Date.now().toString().slice(-5)}`;
    const autoVerified = actor.role === 'cashier' || actor.role === 'manager';
    createdPaymentId = `pay-tbl-${Date.now()}`;

    order.isPaid = true;
    order.billStatus = 'Paid';
    order.paymentMethod = method;
    order.referenceNumber = ref;
    order.cashierId = autoVerified ? actor.id : null;
    order.cashierName = autoVerified ? actor.name : null;
    order.paymentId = createdPaymentId;
    order.paidAt = nowIso;

    const fbPayment: ManualPayment = {
      id: createdPaymentId,
      hotelId,
      bookingId: order.bookingId || 'walk-in-table',
      orderId: order.id,
      sourceType: order.channel === 'Room Service' ? 'Room Service' : 'Table / F&B Order',
      tableOrLocation: order.tableOrLocation,
      roomNumber: order.roomNumber || order.tableOrLocation,
      guestName: `${order.guestName} (Table Service)`,
      amount: order.totalAmount,
      method,
      referenceNumber: ref,
      receivedBy: actor.name,
      receivedById: actor.id,
      receivedByRole: actor.role,
      verificationStatus: autoVerified ? 'Verified' : 'Pending Cashier',
      verifiedBy: autoVerified ? actor.name : null,
      verifiedByRole: autoVerified ? actor.role : null,
      verifiedAt: autoVerified ? nowIso : null,
      notes: `Settled ${order.tableOrLocation} · ${order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
      recordedAt: nowIso,
    };
    db.payments = [fbPayment, ...db.payments];
  }

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

  db.fbOrders[idx] = order;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: actor.role === 'cashier' ? 'Cashier' : 'Waiter',
    action: `Settled ${order.tableOrLocation} bill (${order.totalAmount.toLocaleString()} ETB via ${order.paymentMethod})`,
    amharicAction: `የ${order.tableOrLocation} ሂሳብ ተከፍሏል (${order.totalAmount.toLocaleString()} ብር · ${order.paymentMethod})`,
    targetRef: order.tableOrLocation,
    details: `${order.referenceNumber} · ${actor.role === 'cashier' ? 'Verified by Cashier' : 'Pending Cashier Verification'}`,
    amount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    orderId: order.id,
    paymentId: createdPaymentId,
  });

  res.json(order);
}
