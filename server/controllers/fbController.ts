import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  FbCategory,
  FbMenuItem,
  FbOrder,
  FbOrderItem,
  FbOrderStatus,
  FbServiceChannel,
  FbSettlementMode,
  ManualPayment,
  OrderStation,
  PaymentMethod,
  PaymentStatus,
  StationPrepStatus,
} from '../../src/types/hotel.ts';

function computePaymentStatus(paid: number, total: number): PaymentStatus {
  if (paid <= 0) return 'Unpaid';
  if (paid >= total) return 'Paid';
  return 'Partial';
}

export function resolveMenuStation(category: FbCategory): OrderStation {
  if (
    category === 'Hot Drinks' ||
    category === 'Cold Drinks & Juice' ||
    category === 'Bar & Beverages'
  ) {
    return 'bar';
  }
  return 'kitchen';
}

export function syncOverallOrderStatus(order: FbOrder): void {
  const k = order.kitchenStatus || 'None';
  const b = order.barStatus || 'None';

  const activeStatuses: StationPrepStatus[] = [];
  if (k !== 'None') activeStatuses.push(k);
  if (b !== 'None') activeStatuses.push(b);

  if (activeStatuses.length === 0) return;

  if (activeStatuses.every((s) => s === 'Served')) {
    order.status = 'Served';
    if (!order.servedAt) {
      order.servedAt = new Date().toISOString();
    }
  } else if (
    activeStatuses.some((s) => s === 'Preparing' || s === 'Ready' || s === 'Served')
  ) {
    order.status = 'Preparing';
  } else {
    order.status = 'Pending';
  }
}

export function listFbMenu(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();
  res.json(db.fbMenu.filter((item) => item.hotelId === hotelId));
}

export function createFbMenuItem(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { name, amharicName, category, price, stockQty, unit, staffId } = req.body as {
    name?: string;
    amharicName?: string;
    category?: FbCategory;
    price?: number;
    stockQty?: number;
    unit?: string;
    staffId?: string;
  };

  if (!name?.trim() || !category || !price || Number(price) <= 0) {
    res.status(400).json({ error: 'Menu item name, category, and positive price (ETB) are required.' });
    return;
  }

  const db = readDb();
  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const qty = Math.max(0, Number(stockQty) || 0);

  const newItem: FbMenuItem = {
    id: `fb-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    name: name.trim(),
    amharicName: amharicName?.trim() || name.trim(),
    category,
    price: Number(price),
    stockQty: qty,
    unit: unit?.trim() || 'Serving',
    isAvailable: qty > 0,
    updatedAt: new Date().toISOString(),
  };

  db.fbMenu = [newItem, ...db.fbMenu];
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'F&B',
    action: `Added F&B item: ${newItem.name} (${newItem.price.toLocaleString()} ETB)`,
    amharicAction: `አዲስ የምግብ/መጠጥ ዝርዝር ጨምረዋል: ${newItem.amharicName} (${newItem.price.toLocaleString()} ብር)`,
    targetRef: newItem.id,
    details: `${newItem.category} · Stock: ${newItem.stockQty} ${newItem.unit}`,
  });

  res.status(201).json(newItem);
}

export function updateFbMenuItem(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { name, amharicName, category, price, stockQty, unit, isAvailable, staffId } =
    req.body as Partial<FbMenuItem> & { staffId?: string };

  const db = readDb();
  const idx = db.fbMenu.findIndex((item) => item.id === id && item.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Menu item not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const item = db.fbMenu[idx];

  if (typeof name === 'string' && name.trim()) item.name = name.trim();
  if (typeof amharicName === 'string' && amharicName.trim()) item.amharicName = amharicName.trim();
  if (category) item.category = category;
  if (typeof price === 'number' && price > 0) item.price = price;
  if (typeof stockQty === 'number' && stockQty >= 0) item.stockQty = stockQty;
  if (typeof unit === 'string' && unit.trim()) item.unit = unit.trim();
  if (typeof isAvailable === 'boolean') item.isAvailable = isAvailable;
  item.updatedAt = new Date().toISOString();

  db.fbMenu[idx] = item;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'F&B',
    action: `Updated menu item ${item.name} (${item.price.toLocaleString()} ETB, stock ${item.stockQty})`,
    amharicAction: `የ${item.amharicName} ዋጋ/ክምችት አዘምነዋል (${item.price.toLocaleString()} ብር፣ ${item.stockQty})`,
    targetRef: item.id,
    details: item.isAvailable ? 'Available' : 'Out of Stock',
  });

  res.json(item);
}

export function deleteFbMenuItem(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const db = readDb();
  const idx = db.fbMenu.findIndex((item) => item.id === id && item.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Menu item not found in this hotel.' });
    return;
  }
  const [removed] = db.fbMenu.splice(idx, 1);
  writeDb(db);
  res.json({ deleted: removed.id });
}

export function listFbOrders(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();
  res.json(db.fbOrders.filter((order) => order.hotelId === hotelId));
}

export interface CreateOrderInput {
  hotelId: string;
  channel?: FbServiceChannel;
  tableId?: string | null;
  tableOrLocation?: string;
  bookingId?: string | null;
  guestName?: string;
  guestCount?: number;
  items?: { menuItemId: string; quantity: number }[];
  settlementMode?: FbSettlementMode;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  staffId?: string;
  portal?: 'F&B' | 'Waiter';
}

export function processAndStoreFbOrder(
  input: CreateOrderInput
): { ok: true; order: FbOrder; appendedRound?: number } | { ok: false; status: number; error: string } {
  const {
    hotelId,
    channel,
    tableId,
    tableOrLocation,
    bookingId,
    guestName,
    guestCount,
    items,
    settlementMode,
    paymentMethod,
    referenceNumber,
    notes,
    staffId,
    portal = 'F&B',
  } = input;

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, error: 'Select at least one food or beverage item.' };
  }

  const db = readDb();
  const actor = resolveStaff(hotelId, staffId);
  const orderItems: FbOrderItem[] = [];
  let totalAmount = 0;

  for (const entry of items) {
    const qty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
    const menuIdx = db.fbMenu.findIndex((m) => m.id === entry.menuItemId && m.hotelId === hotelId);
    if (menuIdx === -1) {
      return { ok: false, status: 404, error: `Menu item ${entry.menuItemId} not found in this hotel.` };
    }
    const menuItem = db.fbMenu[menuIdx];
    if (!menuItem.isAvailable) {
      return { ok: false, status: 409, error: `${menuItem.name} is currently marked unavailable.` };
    }
    if (menuItem.stockQty < qty) {
      return {
        ok: false,
        status: 409,
        error: `Insufficient stock for ${menuItem.name} (${menuItem.stockQty} ${menuItem.unit} remaining).`,
      };
    }
    const lineTotal = menuItem.price * qty;
    totalAmount += lineTotal;
    orderItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      amharicName: menuItem.amharicName,
      quantity: qty,
      unitPrice: menuItem.price,
      lineTotal,
      station: resolveMenuStation(menuItem.category),
    });
  }

  const mode: FbSettlementMode = settlementMode || 'Immediate Payment';
  let linkedRoomId: string | null = null;
  let linkedRoomNumber: string | null = null;
  let resolvedGuestName = guestName?.trim() || 'Walk-in Guest';
  let linkedBookingId: string | null = null;

  if (bookingId) {
    const bkIdx = db.bookings.findIndex(
      (b) => b.id === bookingId && b.hotelId === hotelId && b.bookingStatus === 'Checked In'
    );
    if (bkIdx === -1) {
      return {
        ok: false,
        status: 404,
        error: 'Active checked-in room booking not found in this hotel.',
      };
    }
    const bk = db.bookings[bkIdx];
    linkedBookingId = bk.id;
    linkedRoomId = bk.roomId;
    linkedRoomNumber = bk.roomNumber;
    resolvedGuestName = bk.guestName;

    if (mode === 'Charge to Room') {
      bk.totalAmount += totalAmount;
      bk.paymentStatus = computePaymentStatus(bk.paidAmount, bk.totalAmount);
      db.bookings[bkIdx] = bk;
    }
  } else if (mode === 'Charge to Room') {
    return {
      ok: false,
      status: 400,
      error: 'Please select an occupied room to charge order to room folio.',
    };
  }

  let resolvedTableId: string | null = null;
  let resolvedTableLabel =
    tableOrLocation?.trim() ||
    (linkedRoomNumber ? `Room ${linkedRoomNumber}` : 'Restaurant Table');

  if (tableId) {
    const tblIdx = db.tables.findIndex((t) => t.id === tableId && t.hotelId === hotelId);
    if (tblIdx === -1) {
      return { ok: false, status: 404, error: 'Selected table not found in this hotel.' };
    }
    const tbl = db.tables[tblIdx];
    resolvedTableId = tbl.id;
    resolvedTableLabel = `Table ${tbl.tableNumber} (${tbl.area})`;
    if (!guestName?.trim() && !linkedRoomNumber) {
      resolvedGuestName = `Table ${tbl.tableNumber} Guest`;
    }
  }

  // Deduct stock on menu items
  const nowIso = new Date().toISOString();
  for (const line of orderItems) {
    const mIdx = db.fbMenu.findIndex((m) => m.id === line.menuItemId && m.hotelId === hotelId);
    if (mIdx !== -1) {
      db.fbMenu[mIdx].stockQty = Math.max(0, db.fbMenu[mIdx].stockQty - line.quantity);
      if (db.fbMenu[mIdx].stockQty === 0) {
        db.fbMenu[mIdx].isAvailable = false;
      }
      db.fbMenu[mIdx].updatedAt = nowIso;
    }
  }

  const hasKitchen = orderItems.some((i) => i.station === 'kitchen');
  const hasBar = orderItems.some((i) => i.station === 'bar');

  // Consolidate repeat Table Tab orders onto the existing open bill for the same table until settled
  const existingTabIdx =
    mode === 'Table Tab'
      ? db.fbOrders.findIndex(
          (o) =>
            o.hotelId === hotelId &&
            o.status !== 'Cancelled' &&
            !o.isPaid &&
            o.settlementMode === 'Table Tab' &&
            (resolvedTableId
              ? o.tableId === resolvedTableId
              : o.tableOrLocation.trim().toLowerCase() === resolvedTableLabel.trim().toLowerCase())
        )
      : -1;

  if (existingTabIdx !== -1) {
    const existing = db.fbOrders[existingTabIdx];
    const nextRound = (existing.roundCount || 1) + 1;
    const normalizedExistingItems = existing.items.map((it) => ({
      ...it,
      round: it.round || 1,
      addedAt: it.addedAt || existing.createdAt,
    }));
    const newRoundItems = orderItems.map((it) => ({
      ...it,
      round: nextRound,
      addedAt: nowIso,
    }));

    existing.items = [...normalizedExistingItems, ...newRoundItems];
    existing.totalAmount += totalAmount;
    existing.roundCount = nextRound;
    existing.lastOrderedAt = nowIso;
    existing.billStatus = 'Open Tab';
    if (guestName?.trim() && existing.guestName.startsWith('Table ')) {
      existing.guestName = guestName.trim();
    }
    if (notes?.trim()) {
      existing.notes = existing.notes
        ? `${existing.notes} · [R${nextRound}] ${notes.trim()}`
        : `[R${nextRound}] ${notes.trim()}`;
    }

    if (hasKitchen) {
      existing.kitchenStatus = 'Pending';
      existing.kitchenUpdatedAt = nowIso;
    }
    if (hasBar) {
      existing.barStatus = 'Pending';
      existing.barUpdatedAt = nowIso;
    }
    existing.servedAt = null;
    syncOverallOrderStatus(existing);
    if (existing.status === 'Served') {
      existing.status = 'Preparing';
    }

    db.fbOrders[existingTabIdx] = existing;

    if (resolvedTableId) {
      const tblIdx = db.tables.findIndex((t) => t.id === resolvedTableId);
      if (tblIdx !== -1) {
        db.tables[tblIdx].status = 'Order Active';
        db.tables[tblIdx].assignedWaiterId = actor.id;
        db.tables[tblIdx].assignedWaiterName = actor.name;
        db.tables[tblIdx].guestCount = Math.max(
          1,
          Number(guestCount) || db.tables[tblIdx].guestCount || 2
        );
        db.tables[tblIdx].activeOrderId = existing.id;
        db.tables[tblIdx].updatedAt = nowIso;
      }
    }

    writeDb(db);

    const stationSummary = [hasKitchen ? 'Kitchen' : null, hasBar ? 'Bar' : null]
      .filter(Boolean)
      .join(' + ');

    appendActivityLog({
      hotelId,
      staffId: actor.id,
      portal,
      action: `Added Round #${nextRound} to ${existing.tableOrLocation} single bill (+${totalAmount.toLocaleString()} ETB → Total ${existing.totalAmount.toLocaleString()} ETB · ${stationSummary})`,
      amharicAction: `${actor.amharicName} በ${existing.tableOrLocation} ክፍት ቢል ላይ ዙር #${nextRound} ጨምረዋል (+${totalAmount.toLocaleString()} ብር → ጠቅላላ ${existing.totalAmount.toLocaleString()} ብር)`,
      targetRef: existing.tableOrLocation,
      details: `[Round ${nextRound}] ${orderItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
      amount: totalAmount,
      paymentMethod: existing.paymentMethod,
      orderId: existing.id,
      paymentId: existing.paymentId || null,
    });

    return { ok: true, order: existing, appendedRound: nextRound };
  }

  const chosenMethod: PaymentMethod | 'Room Folio' | 'Open Tab' =
    mode === 'Charge to Room'
      ? 'Room Folio'
      : mode === 'Table Tab'
        ? 'Open Tab'
        : paymentMethod || 'Cash';

  const ref =
    referenceNumber?.trim() ||
    (mode === 'Charge to Room'
      ? `FOLIO-${linkedRoomNumber}`
      : mode === 'Table Tab'
        ? `TAB-${Date.now().toString().slice(-4)}`
        : `FB-${Date.now().toString().slice(-5)}`);

  const orderId = `fbo-${Date.now()}`;
  const isImmediatePaid = mode === 'Immediate Payment';
  const autoVerified = isImmediatePaid && (actor.role === 'cashier' || actor.role === 'manager');
  let generatedPaymentId: string | null = null;

  if (isImmediatePaid) {
    generatedPaymentId = `pay-fb-${Date.now()}`;
    const fbPayment: ManualPayment = {
      id: generatedPaymentId,
      hotelId,
      bookingId: linkedBookingId || (channel === 'Room Service' ? 'room-service' : 'walk-in-fb'),
      orderId,
      sourceType: (channel || (linkedRoomNumber ? 'Room Service' : 'Dine-In')) === 'Room Service'
        ? 'Room Service'
        : 'Table / F&B Order',
      tableOrLocation: resolvedTableLabel,
      roomNumber: linkedRoomNumber || resolvedTableLabel,
      guestName: `${resolvedGuestName} (F&B)`,
      amount: totalAmount,
      method: (paymentMethod || 'Cash') as PaymentMethod,
      referenceNumber: ref,
      receivedBy: actor.name,
      receivedById: actor.id,
      receivedByRole: actor.role,
      verificationStatus: autoVerified ? 'Verified' : 'Pending Cashier',
      verifiedBy: autoVerified ? actor.name : null,
      verifiedByRole: autoVerified ? actor.role : null,
      verifiedAt: autoVerified ? nowIso : null,
      notes: `F&B Order ${orderId} · ${orderItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
      recordedAt: nowIso,
    };
    db.payments = [fbPayment, ...db.payments];
  }

  const stampedItems = orderItems.map((it) => ({
    ...it,
    round: 1,
    addedAt: nowIso,
  }));

  const order: FbOrder = {
    id: orderId,
    hotelId,
    channel: channel || (linkedRoomNumber ? 'Room Service' : 'Dine-In'),
    tableId: resolvedTableId,
    tableOrLocation: resolvedTableLabel,
    roomId: linkedRoomId,
    roomNumber: linkedRoomNumber,
    bookingId: linkedBookingId,
    guestName: resolvedGuestName,
    items: stampedItems,
    totalAmount,
    discountAmount: 0,
    roundCount: 1,
    lastOrderedAt: nowIso,
    settlementMode: mode,
    paymentMethod: chosenMethod,
    referenceNumber: ref,
    isPaid: isImmediatePaid,
    billStatus: isImmediatePaid
      ? 'Paid'
      : mode === 'Charge to Room'
        ? 'Charged to Room'
        : 'Open Tab',
    cashierId: autoVerified ? actor.id : null,
    cashierName: autoVerified ? actor.name : null,
    paymentId: generatedPaymentId,
    paidAt: isImmediatePaid ? nowIso : null,
    status: 'Pending',
    kitchenStatus: hasKitchen ? 'Pending' : 'None',
    barStatus: hasBar ? 'Pending' : 'None',
    kitchenUpdatedAt: hasKitchen ? nowIso : null,
    barUpdatedAt: hasBar ? nowIso : null,
    notes: notes?.trim() || '',
    takenBy: actor.name,
    createdAt: nowIso,
    servedAt: null,
  };

  if (resolvedTableId) {
    const tblIdx = db.tables.findIndex((t) => t.id === resolvedTableId);
    if (tblIdx !== -1) {
      db.tables[tblIdx].status = 'Order Active';
      db.tables[tblIdx].assignedWaiterId = actor.id;
      db.tables[tblIdx].assignedWaiterName = actor.name;
      db.tables[tblIdx].guestCount = Math.max(1, Number(guestCount) || db.tables[tblIdx].guestCount || 2);
      db.tables[tblIdx].activeOrderId = order.id;
      db.tables[tblIdx].updatedAt = nowIso;
    }
  }

  db.fbOrders = [order, ...db.fbOrders];

  writeDb(db);

  const stationSummary = [hasKitchen ? 'Kitchen' : null, hasBar ? 'Bar' : null]
    .filter(Boolean)
    .join(' + ');

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal,
    action: `Dispatched ${order.channel} order to ${stationSummary} (${totalAmount.toLocaleString()} ETB · ${order.settlementMode})`,
    amharicAction: `${actor.amharicName} የ${order.tableOrLocation} ትዕዛዝ ወደ ${hasKitchen ? 'ኪችን' : ''}${hasKitchen && hasBar ? ' እና ' : ''}${hasBar ? 'ባር' : ''} ልከዋል (${totalAmount.toLocaleString()} ብር)`,
    targetRef: order.tableOrLocation,
    details: orderItems.map((i) => `${i.quantity}x ${i.name}`).join(', '),
    amount: totalAmount,
    paymentMethod: chosenMethod,
    orderId: order.id,
    paymentId: generatedPaymentId,
  });

  return { ok: true, order };
}

export function createFbOrder(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const body = req.body as CreateOrderInput;
  const result = processAndStoreFbOrder({
    ...body,
    hotelId,
    staffId: body.staffId || req.user?.userId,
    portal: 'F&B',
  });

  if (result.ok === false) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(201).json(result.order);
}

export function updateFbOrderStatus(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { status, staffId } = req.body as { status?: FbOrderStatus; staffId?: string };

  if (!status || !['Pending', 'Preparing', 'Served', 'Cancelled'].includes(status)) {
    res.status(400).json({ error: 'Invalid F&B order status.' });
    return;
  }

  const db = readDb();
  const idx = db.fbOrders.findIndex((o) => o.id === id && o.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'F&B order not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const order = db.fbOrders[idx];
  const nowIso = new Date().toISOString();
  order.status = status;

  if (status === 'Served') {
    order.servedAt = nowIso;
    if (order.kitchenStatus && order.kitchenStatus !== 'None') order.kitchenStatus = 'Served';
    if (order.barStatus && order.barStatus !== 'None') order.barStatus = 'Served';
  } else if (status === 'Preparing') {
    if (order.kitchenStatus === 'Pending') order.kitchenStatus = 'Preparing';
    if (order.barStatus === 'Pending') order.barStatus = 'Preparing';
  }

  db.fbOrders[idx] = order;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'F&B',
    action: `Marked F&B order ${order.id} (${order.tableOrLocation}) as ${status}`,
    amharicAction: `የምግብ/መጠጥ ትዕዛዝ ${order.tableOrLocation} ሁኔታ ${status} ሆኗል`,
    targetRef: order.id,
    details: `${order.totalAmount.toLocaleString()} ETB`,
  });

  res.json(order);
}
