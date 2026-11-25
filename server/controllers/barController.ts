import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type { StationPrepStatus } from '../../src/types/hotel.ts';
import { syncOverallOrderStatus } from './fbController.ts';

export function listBarOrders(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();
  const barOrders = db.fbOrders
    .filter(
      (o) =>
        o.hotelId === hotelId &&
        o.status !== 'Cancelled' &&
        o.items.some((item) => item.station === 'bar')
    )
    .map((o) => ({
      ...o,
      stationItems: o.items.filter((item) => item.station === 'bar'),
    }));
  res.json(barOrders);
}

export function updateBarOrderStatus(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { barStatus, staffId } = req.body as {
    barStatus?: StationPrepStatus;
    staffId?: string;
  };

  if (!barStatus || !['Pending', 'Preparing', 'Ready', 'Served'].includes(barStatus)) {
    res.status(400).json({ error: 'Invalid bar status.' });
    return;
  }

  const db = readDb();
  const idx = db.fbOrders.findIndex((o) => o.id === id && o.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Order not found in this hotel.' });
    return;
  }

  const order = db.fbOrders[idx];
  const actor = resolveStaff(hotelId, staffId || req.user?.userId);
  const nowIso = new Date().toISOString();

  order.barStatus = barStatus;
  order.barUpdatedAt = nowIso;
  syncOverallOrderStatus(order);

  db.fbOrders[idx] = order;
  writeDb(db);

  const barDrinkNames = order.items
    .filter((i) => i.station === 'bar')
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(', ');

  const statusAmMap: Record<StationPrepStatus, string> = {
    Pending: 'በመጠባበቅ ላይ',
    Preparing: 'በመዘጋጀት ላይ',
    Ready: 'ተዘጋጅቷል (ለመውሰድ ዝግጁ)',
    Served: 'ለእንግዳ ቀርቧል',
  };

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Bar',
    action: `Bar marked ${order.tableOrLocation} drinks as ${barStatus}`,
    amharicAction: `ባር የ${order.tableOrLocation} መጠጥ ${statusAmMap[barStatus]} ብለዋል`,
    targetRef: order.tableOrLocation,
    details: barDrinkNames,
  });

  res.json(order);
}
