import type { Request, Response } from 'express';
import { readDb } from '../config/database.ts';
import { resolveHotelId } from '../models/ActivityLog.ts';
import type { DailyReportSummary } from '../../src/types/hotel.ts';

export function listUsers(req: Request, res: Response): void {
  const headerOrQuery =
    req.header('x-hotel-id') || (typeof req.query.hotelId === 'string' ? req.query.hotelId : undefined);
  const hotelId = headerOrQuery === 'central' ? 'central' : resolveHotelId(req);
  const db = readDb();
  const safeUsers = db.users
    .filter((u) => u.hotelId === hotelId)
    .map(({ pinCode: _pinCode, ...safeUser }) => safeUser);
  res.json(safeUsers);
}

export function listAuditLogs(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  const portalFilter = req.query.portal as string | undefined;
  const staffFilter = req.query.staffId as string | undefined;

  let logs = db.activityLogs.filter((l) => l.hotelId === hotelId);
  if (portalFilter && portalFilter !== 'All') {
    logs = logs.filter((l) => l.portal === portalFilter);
  }
  if (staffFilter && staffFilter !== 'All') {
    logs = logs.filter((l) => l.staffId === staffFilter);
  }
  res.json(logs);
}

export function getDailyReport(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();

  const hotelPayments = db.payments.filter((p) => p.hotelId === hotelId);
  const hotelBookings = db.bookings.filter((b) => b.hotelId === hotelId);
  const hotelRooms = db.rooms.filter((r) => r.hotelId === hotelId);
  const hotelMaintenance = db.maintenance.filter((m) => m.hotelId === hotelId);

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
  const outstandingBalance = hotelBookings
    .filter((b) => b.bookingStatus === 'Checked In' || b.paidAmount < b.totalAmount)
    .reduce((acc, b) => acc + Math.max(0, b.totalAmount - b.paidAmount), 0);

  const summary: DailyReportSummary = {
    hotelId,
    date: new Date().toISOString().slice(0, 10),
    totalCollected,
    cashCollected,
    bankTransferCollected,
    telebirrCollected,
    posCardCollected,
    outstandingBalance,
    occupiedRooms: hotelRooms.filter((r) => r.occupancyStatus === 'Occupied').length,
    totalRooms: hotelRooms.length,
    cleanRooms: hotelRooms.filter((r) => r.cleaningStatus === 'Clean' && r.occupancyStatus === 'Available').length,
    dirtyRooms: hotelRooms.filter((r) => r.cleaningStatus !== 'Clean').length,
    outOfOrderRooms: hotelRooms.filter((r) => r.occupancyStatus === 'Out of Order').length,
    openMaintenanceCount: hotelMaintenance.filter((m) => m.status !== 'Resolved').length,
    payments: hotelPayments,
  };

  res.json(summary);
}
