import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type { StationPrepStatus } from '../../src/types/hotel.ts';
import { syncOverallOrderStatus } from './fbController.ts';

export function listKitchenOrders(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const db = readDb();
  const kitchenOrders = db.fbOrders
    .filter(
      (o) =>
        o.hotelId === hotelId &&
        o.status !== 'Cancelled' &&
        o.items.some((item) => (item.station || 'kitchen') === 'kitchen')
    )
    .map((o) => ({
      ...o,
      stationItems: o.items.filter((item) => (item.station || 'kitchen') === 'kitchen'),
    }));
  res.json(kitchenOrders);
}

export function updateKitchenOrderStatus(req: Request, res: Response): void {
  const hotelId = req.tenantHotelId || resolveHotelId(req);
  const { id } = req.params;
  const { kitchenStatus, staffId } = req.body as {
    kitchenStatus?: StationPrepStatus;
    staffId?: string;
  };

  if (!kitchenStatus || !['Pending', 'Preparing', 'Ready', 'Served'].includes(kitchenStatus)) {
    res.status(400).json({ error: 'Invalid kitchen status.' });
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

  order.kitchenStatus = kitchenStatus;
  order.kitchenUpdatedAt = nowIso;
  syncOverallOrderStatus(order);

  db.fbOrders[idx] = order;
  writeDb(db);

  const kitchenFoodNames = order.items
    .filter((i) => (i.station || 'kitchen') === 'kitchen')
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(', ');

  const statusAmMap: Record<StationPrepStatus, string> = {
    Pending: 'በመጠባበቅ ላይ',
    Preparing: 'በመበሰል ላይ',
    Ready: 'ተዘጋጅቷል (ለመውሰድ ዝግጁ)',
    Served: 'ለእንግዳ ቀርቧል',
  };

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Kitchen',
    action: `Kitchen marked ${order.tableOrLocation} food as ${kitchenStatus}`,
    amharicAction: `ኪችን የ${order.tableOrLocation} ምግብ ${statusAmMap[kitchenStatus]} ብለዋል`,
    targetRef: order.tableOrLocation,
    details: kitchenFoodNames,
  });

  res.json(order);
}
