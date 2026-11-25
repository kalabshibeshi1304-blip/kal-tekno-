import type { Request } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import type { ActivityLog, ActivityPortal, StaffUser, UserRole } from '../../src/types/hotel.ts';

export function resolveHotelId(req: Request): string {
  const headerHotel = req.header('x-hotel-id');
  const queryHotel = typeof req.query.hotelId === 'string' ? req.query.hotelId : undefined;
  const candidate = headerHotel || queryHotel;
  const db = readDb();
  if (candidate && db.hotels.some((h) => h.id === candidate)) {
    return candidate;
  }
  return db.hotels[0]?.id ?? 'htl-addis';
}

export function resolveStaff(hotelId: string, staffId?: string): StaffUser {
  const db = readDb();
  const hotelUsers = db.users.filter((u) => u.hotelId === hotelId);
  const found = hotelUsers.find((u) => u.id === staffId) ?? db.users.find((u) => u.id === staffId);
  return (
    found ??
    hotelUsers[0] ?? {
      id: `${hotelId}-rec-1`,
      hotelId,
      name: 'Selamawit Tadesse',
      amharicName: 'ሰላማዊት ታደሰ',
      role: 'reception',
      departmentLabel: 'Front Desk',
      shift: 'Morning Desk',
      pinCode: '1010',
    }
  );
}

export function appendActivityLog(input: {
  hotelId: string;
  staffId?: string;
  staffName?: string;
  staffRole?: UserRole;
  portal: ActivityPortal;
  action: string;
  amharicAction: string;
  targetRef: string;
  details: string;
  amount?: number;
  paymentMethod?: string;
  orderId?: string | null;
  paymentId?: string | null;
}): ActivityLog {
  const db = readDb();
  const actor = resolveStaff(input.hotelId, input.staffId);
  const entry: ActivityLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    hotelId: input.hotelId,
    timestamp: new Date().toISOString(),
    staffId: actor.id,
    staffName: input.staffName || actor.name,
    staffRole: input.staffRole || actor.role,
    portal: input.portal,
    action: input.action,
    amharicAction: input.amharicAction,
    targetRef: input.targetRef,
    details: input.details,
    ...(typeof input.amount === 'number' ? { amount: input.amount } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.paymentId ? { paymentId: input.paymentId } : {}),
  };
  db.activityLogs = [entry, ...db.activityLogs];
  writeDb(db);
  return entry;
}
