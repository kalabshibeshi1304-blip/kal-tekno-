import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type { CleaningStatus, OccupancyStatus, Room, RoomType } from '../../src/types/hotel.ts';

export function listRooms(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  const roomsWithBooking = db.rooms
    .filter((r) => r.hotelId === hotelId)
    .map((room) => {
      const activeBooking = room.currentBookingId
        ? db.bookings.find((b) => b.id === room.currentBookingId && b.hotelId === hotelId) ?? null
        : null;
      return {
        ...room,
        activeBooking,
      };
    });
  res.json(roomsWithBooking);
}

export function bulkCreateRooms(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { type, floor, startNumber, count, ratePerNight, staffId } = req.body as {
    type?: RoomType;
    floor?: number;
    startNumber?: number;
    count?: number;
    ratePerNight?: number;
    staffId?: string;
  };

  if (!type?.trim() || !ratePerNight || Number(ratePerNight) < 500) {
    res.status(400).json({ error: 'Room type and valid nightly rate (>= 500 ETB) are required.' });
    return;
  }

  const qty = Math.min(30, Math.max(1, Number(count) || 1));
  const floorNum = Math.min(20, Math.max(1, Number(floor) || 1));
  const firstNum = Math.max(1, Number(startNumber) || floorNum * 100 + 1);
  const rate = Number(ratePerNight);
  const roomType = type.trim();

  const db = readDb();
  const existingNumbers = new Set(
    db.rooms.filter((r) => r.hotelId === hotelId).map((r) => r.roomNumber.toLowerCase())
  );

  const createdRooms: Room[] = [];
  let cursor = firstNum;
  let attempts = 0;

  while (createdRooms.length < qty && attempts < 200) {
    const candidate = String(cursor);
    cursor += 1;
    attempts += 1;
    if (existingNumbers.has(candidate.toLowerCase())) continue;

    existingNumbers.add(candidate.toLowerCase());
    createdRooms.push({
      id: `${hotelId}-${candidate}-${Date.now().toString().slice(-3)}-${createdRooms.length}`,
      hotelId,
      roomNumber: candidate,
      floor: floorNum,
      type: roomType,
      ratePerNight: rate,
      occupancyStatus: 'Available',
      cleaningStatus: 'Clean',
      currentBookingId: null,
      housekeepingNotes: `Registered in ${roomType} tier`,
      lastCleanedAt: new Date().toISOString(),
      lastCleanedBy: 'Property Setup',
    });
  }

  if (createdRooms.length === 0) {
    res.status(409).json({ error: 'Could not allocate unique room numbers in that range.' });
    return;
  }

  const hotelIdx = db.hotels.findIndex((h) => h.id === hotelId);
  if (hotelIdx !== -1 && floorNum > db.hotels[hotelIdx].floors) {
    db.hotels[hotelIdx].floors = floorNum;
  }

  db.rooms.push(...createdRooms);
  writeDb(db);

  const actor = resolveStaff(hotelId, staffId);
  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Rooms',
    action: `Registered ${createdRooms.length} ${roomType} room(s) at ${rate.toLocaleString()} ETB/night`,
    amharicAction: `${createdRooms.length} አዲስ ${roomType} ክፍሎችን በ${rate.toLocaleString()} ብር መዝግበዋል`,
    targetRef: createdRooms.map((r) => r.roomNumber).join(', '),
    details: `Floor ${floorNum}`,
  });

  res.status(201).json({ createdRooms, count: createdRooms.length });
}

export function updateRoomTypeRates(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { type, ratePerNight, staffId } = req.body as {
    type?: RoomType;
    ratePerNight?: number;
    staffId?: string;
  };

  if (!type?.trim() || !ratePerNight || Number(ratePerNight) < 500) {
    res.status(400).json({ error: 'Room type and valid nightly rate (>= 500 ETB) are required.' });
    return;
  }

  const db = readDb();
  const nextRate = Number(ratePerNight);
  let updatedCount = 0;

  for (const r of db.rooms) {
    if (r.hotelId === hotelId && r.type.toLowerCase() === type.trim().toLowerCase()) {
      r.ratePerNight = nextRate;
      updatedCount += 1;
    }
  }

  if (updatedCount === 0) {
    res.status(404).json({ error: `No ${type} rooms found in this hotel.` });
    return;
  }

  writeDb(db);
  const actor = resolveStaff(hotelId, staffId);
  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Rooms',
    action: `Updated all ${type} rooms (${updatedCount}) to ${nextRate.toLocaleString()} ETB/night`,
    amharicAction: `የሁሉንም ${type} ክፍሎች (${updatedCount}) ዋጋ ወደ ${nextRate.toLocaleString()} ብር ቀይረዋል`,
    targetRef: type,
    details: `${updatedCount} rooms updated`,
  });

  res.json({ type, ratePerNight: nextRate, updatedCount });
}

export function updateRoomDetails(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { roomNumber, floor, type, ratePerNight, staffId } = req.body as {
    roomNumber?: string;
    floor?: number;
    type?: RoomType;
    ratePerNight?: number;
    staffId?: string;
  };

  const db = readDb();
  const idx = db.rooms.findIndex((r) => r.id === id && r.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Room not found in this hotel.' });
    return;
  }

  const room = db.rooms[idx];
  if (typeof roomNumber === 'string' && roomNumber.trim()) {
    const duplicate = db.rooms.find(
      (r) =>
        r.hotelId === hotelId &&
        r.id !== id &&
        r.roomNumber.toLowerCase() === roomNumber.trim().toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: `Room number ${roomNumber.trim()} already exists.` });
      return;
    }
    room.roomNumber = roomNumber.trim();
  }
  if (typeof floor === 'number' && floor >= 1) room.floor = floor;
  if (typeof type === 'string' && type.trim()) room.type = type.trim();
  if (typeof ratePerNight === 'number' && ratePerNight >= 500) room.ratePerNight = ratePerNight;

  db.rooms[idx] = room;
  writeDb(db);

  const actor = resolveStaff(hotelId, staffId);
  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Rooms',
    action: `Updated Room ${room.roomNumber} (${room.type}) to ${room.ratePerNight.toLocaleString()} ETB/night`,
    amharicAction: `የክፍል ${room.roomNumber} (${room.type}) መረጃና ዋጋ ${room.ratePerNight.toLocaleString()} ብር አዘምነዋል`,
    targetRef: `Room ${room.roomNumber}`,
    details: `Floor ${room.floor}`,
  });

  res.json(room);
}

export function deleteRoom(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const db = readDb();
  const idx = db.rooms.findIndex((r) => r.id === id && r.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Room not found in this hotel.' });
    return;
  }
  if (db.rooms[idx].occupancyStatus === 'Occupied') {
    res.status(409).json({ error: 'Cannot remove an occupied room. Check out the guest first.' });
    return;
  }
  const [removed] = db.rooms.splice(idx, 1);
  writeDb(db);
  res.json({ deleted: removed.id, roomNumber: removed.roomNumber });
}

export function updateHousekeepingStatus(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { cleaningStatus, housekeepingNotes, staffId } = req.body as {
    cleaningStatus?: CleaningStatus;
    housekeepingNotes?: string;
    staffId?: string;
  };

  if (!cleaningStatus || !['Clean', 'Dirty', 'Inspecting'].includes(cleaningStatus)) {
    res.status(400).json({ error: 'Invalid cleaning status' });
    return;
  }

  const db = readDb();
  const roomIdx = db.rooms.findIndex((r) => r.id === id && r.hotelId === hotelId);
  if (roomIdx === -1) {
    res.status(404).json({ error: 'Room not found in this hotel property' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const room = db.rooms[roomIdx];
  const previousStatus = room.cleaningStatus;

  room.cleaningStatus = cleaningStatus;
  if (typeof housekeepingNotes === 'string') {
    room.housekeepingNotes = housekeepingNotes.trim();
  }
  if (cleaningStatus === 'Clean') {
    room.lastCleanedAt = new Date().toISOString();
    room.lastCleanedBy = actor.name;
  }

  db.rooms[roomIdx] = room;
  writeDb(db);

  const amharicMap: Record<CleaningStatus, string> = {
    Clean: `ክፍል ${room.roomNumber}ን ንጹህ (Clean) አድርገው አዘጋጅተዋል`,
    Dirty: `ክፍል ${room.roomNumber}ን ቆሻሻ (Dirty) ብለው መዝግበዋል`,
    Inspecting: `የክፍል ${room.roomNumber}ን ጽዳት በምርመራ (Inspecting) ላይ አድርገዋል`,
  };

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Housekeeping',
    action: `Changed Room ${room.roomNumber} cleaning status from ${previousStatus} to ${cleaningStatus}`,
    amharicAction: amharicMap[cleaningStatus],
    targetRef: `Room ${room.roomNumber}`,
    details: room.housekeepingNotes || `Previous status: ${previousStatus}`,
  });

  res.json(room);
}

export function updateRoomOccupancyOverride(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { occupancyStatus, staffId, reason } = req.body as {
    occupancyStatus?: OccupancyStatus;
    staffId?: string;
    reason?: string;
  };

  if (!occupancyStatus || !['Available', 'Out of Order'].includes(occupancyStatus)) {
    res.status(400).json({ error: 'Only Available or Out of Order overrides are permitted here' });
    return;
  }

  const db = readDb();
  const roomIdx = db.rooms.findIndex((r) => r.id === id && r.hotelId === hotelId);
  if (roomIdx === -1) {
    res.status(404).json({ error: 'Room not found in this hotel property' });
    return;
  }

  const room = db.rooms[roomIdx];
  if (room.occupancyStatus === 'Occupied') {
    res.status(409).json({ error: 'Cannot override an occupied room. Please check out the guest first.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  room.occupancyStatus = occupancyStatus;
  db.rooms[roomIdx] = room;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Maintenance',
    action: `Set Room ${room.roomNumber} availability to ${occupancyStatus}`,
    amharicAction:
      occupancyStatus === 'Out of Order'
        ? `ክፍል ${room.roomNumber}ን ከአገልግሎት ውጭ (Out of Order) አድርገዋል`
        : `ክፍል ${room.roomNumber}ን ወደ አገልግሎት (Available) መልሰዋል`,
    targetRef: `Room ${room.roomNumber}`,
    details: reason || 'Manual room availability update',
  });

  res.json(room);
}
