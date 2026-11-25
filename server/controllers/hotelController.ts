import type { Request, Response } from 'express';
import {
  createDefaultHotelMenu,
  createDefaultHotelTables,
  createHotelStaffUsers,
  readDb,
  writeDb,
} from '../config/database.ts';
import { appendActivityLog } from '../models/ActivityLog.ts';
import type {
  HotelCategory,
  HotelOperationalStatus,
  HotelOverviewStat,
  HotelProperty,
  MessagePriority,
  MessageTargetRole,
  Room,
  RoomTierSummary,
  RoomType,
  StaffMessage,
} from '../../src/types/hotel.ts';

const DEFAULT_ROOM_TIERS: RoomType[] = ['Standard', 'Deluxe', 'Executive Suite'];

function buildTierBreakdown(hotelRooms: Room[]): RoomTierSummary[] {
  const dynamicTiers = Array.from(
    new Set([...DEFAULT_ROOM_TIERS, ...hotelRooms.map((r) => r.type)])
  );
  return dynamicTiers
    .map((type) => {
      const tierRooms = hotelRooms.filter((r) => r.type === type);
      const rates = tierRooms.map((r) => r.ratePerNight);
      return {
        type,
        total: tierRooms.length,
        availableClean: tierRooms.filter(
          (r) => r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean'
        ).length,
        occupied: tierRooms.filter((r) => r.occupancyStatus === 'Occupied').length,
        minRate: rates.length > 0 ? Math.min(...rates) : 0,
        maxRate: rates.length > 0 ? Math.max(...rates) : 0,
      };
    })
    .filter((tb) => DEFAULT_ROOM_TIERS.includes(tb.type) || tb.total > 0);
}

export function listHotels(_req: Request, res: Response): void {
  const db = readDb();

  const stats: HotelOverviewStat[] = db.hotels.map((hotel) => {
    const hotelRooms = db.rooms.filter((r) => r.hotelId === hotel.id);
    const hotelMaintenance = db.maintenance.filter((m) => m.hotelId === hotel.id && m.status !== 'Resolved');
    const hotelPayments = db.payments.filter((p) => p.hotelId === hotel.id);
    const urgentMsgs = db.messages.filter(
      (msg) => msg.hotelId === hotel.id && msg.priority === 'Urgent' && msg.acknowledgedBy.length === 0
    );

    return {
      ...hotel,
      totalRooms: hotelRooms.length,
      occupiedRooms: hotelRooms.filter((r) => r.occupancyStatus === 'Occupied').length,
      cleanReadyRooms: hotelRooms.filter(
        (r) => r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean'
      ).length,
      dirtyRooms: hotelRooms.filter((r) => r.cleaningStatus !== 'Clean').length,
      openMaintenanceCount: hotelMaintenance.length,
      unreadUrgentMessages: urgentMsgs.length,
      totalCollected: hotelPayments.reduce((sum, p) => sum + p.amount, 0),
      tierBreakdown: buildTierBreakdown(hotelRooms),
    };
  });

  res.json(stats);
}

export function createHotel(req: Request, res: Response): void {
  const {
    name,
    amharicName,
    city,
    amharicCity,
    code,
    address,
    phone,
    email,
    tinNumber,
    managerName,
    starRating,
    category,
    status,
    checkInTime,
    checkOutTime,
    taxPercent,
    serviceChargePercent,
    amenities,
    floors,
    roomsPerFloor,
    baseRate,
    standardCount,
    standardRate,
    deluxeCount,
    deluxeRate,
    suiteCount,
    suiteRate,
  } = req.body as {
    name?: string;
    amharicName?: string;
    city?: string;
    amharicCity?: string;
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
    tinNumber?: string;
    managerName?: string;
    starRating?: number;
    category?: HotelCategory;
    status?: HotelOperationalStatus;
    checkInTime?: string;
    checkOutTime?: string;
    taxPercent?: number;
    serviceChargePercent?: number;
    amenities?: string[];
    floors?: number;
    roomsPerFloor?: number;
    baseRate?: number;
    standardCount?: number;
    standardRate?: number;
    deluxeCount?: number;
    deluxeRate?: number;
    suiteCount?: number;
    suiteRate?: number;
  };

  if (!name?.trim() || !city?.trim()) {
    res.status(400).json({ error: 'Hotel name and city are required.' });
    return;
  }

  const db = readDb();
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 14);
  const hotelId = `htl-${slug}-${Date.now().toString().slice(-4)}`;
  const prefix = slug.slice(0, 4) || 'htl';

  const hasExplicitTiers =
    standardCount !== undefined || deluxeCount !== undefined || suiteCount !== undefined;

  const stdCount = Math.max(0, Math.min(30, Number(standardCount) || 0));
  const dlxCount = Math.max(0, Math.min(30, Number(deluxeCount) || 0));
  const steCount = Math.max(0, Math.min(20, Number(suiteCount) || 0));

  if (hasExplicitTiers && stdCount + dlxCount + steCount === 0) {
    res.status(400).json({ error: 'At least 1 room across Standard, Deluxe, or Executive Suite is required.' });
    return;
  }

  const calculatedFloors = hasExplicitTiers
    ? Math.max(1, (stdCount > 0 ? 1 : 0) + (dlxCount > 0 ? 1 : 0) + (steCount > 0 ? 1 : 0))
    : Math.min(6, Math.max(1, Number(floors) || 2));

  const newHotel: HotelProperty = {
    id: hotelId,
    code: (code?.trim() || `ZMA-${city.trim().slice(0, 3)}`).toUpperCase(),
    name: name.trim(),
    amharicName: amharicName?.trim() || name.trim(),
    city: city.trim(),
    amharicCity: amharicCity?.trim() || city.trim(),
    address: address?.trim() || `${city.trim()} Central District`,
    phone: phone?.trim() || '+251 11 000 0000',
    email: email?.trim() || `info@${slug || 'hotel'}.et`,
    tinNumber: tinNumber?.trim() || `00${Math.floor(10000000 + Math.random() * 89999999)}`,
    managerName: managerName?.trim() || 'Branch General Manager',
    starRating: Math.min(5, Math.max(1, Number(starRating) || 4)),
    category: category || 'City Hotel',
    status: status || 'Active',
    checkInTime: checkInTime?.trim() || '14:00',
    checkOutTime: checkOutTime?.trim() || '12:00',
    taxPercent: Math.max(0, Math.min(30, Number(taxPercent ?? 15))),
    serviceChargePercent: Math.max(0, Math.min(25, Number(serviceChargePercent ?? 10))),
    amenities:
      Array.isArray(amenities) && amenities.length > 0
        ? amenities
        : ['Wi-Fi', 'Breakfast Included', 'Parking', 'Generator Backup'],
    floors: calculatedFloors,
    createdAt: new Date().toISOString(),
  };

  const generatedUsers = createHotelStaffUsers(hotelId, `${prefix}-${Date.now().toString().slice(-3)}`);
  if (managerName?.trim() && generatedUsers[3]) {
    generatedUsers[3].name = managerName.trim();
    generatedUsers[3].amharicName = managerName.trim();
  }

  const generatedRooms: Room[] = [];
  const nowIso = new Date().toISOString();

  if (hasExplicitTiers) {
    const tierConfigs: { type: RoomType; floor: number; count: number; rate: number }[] = [
      { type: 'Standard', floor: 1, count: stdCount, rate: Math.max(500, Number(standardRate) || 3200) },
      { type: 'Deluxe', floor: 2, count: dlxCount, rate: Math.max(500, Number(deluxeRate) || 4800) },
      { type: 'Executive Suite', floor: 3, count: steCount, rate: Math.max(500, Number(suiteRate) || 8200) },
    ];

    for (const tc of tierConfigs) {
      for (let i = 1; i <= tc.count; i++) {
        const roomNumber = `${tc.floor}${String(i).padStart(2, '0')}`;
        generatedRooms.push({
          id: `${hotelId}-${roomNumber}`,
          hotelId,
          roomNumber,
          floor: tc.floor,
          type: tc.type,
          ratePerNight: tc.rate,
          occupancyStatus: 'Available',
          cleaningStatus: 'Clean',
          currentBookingId: null,
          housekeepingNotes: `Provisioned ready (${tc.type})`,
          lastCleanedAt: nowIso,
          lastCleanedBy: generatedUsers[1]?.name || 'Housekeeping',
        });
      }
    }
  } else {
    const floorCount = Math.min(6, Math.max(1, Number(floors) || 2));
    const perFloor = Math.min(10, Math.max(2, Number(roomsPerFloor) || 4));
    const stdRate = Math.max(1000, Number(baseRate) || 3500);

    for (let fl = 1; fl <= floorCount; fl++) {
      for (let idx = 1; idx <= perFloor; idx++) {
        const roomNumber = `${fl}${String(idx).padStart(2, '0')}`;
        const type: RoomType =
          fl === floorCount && floorCount > 1
            ? 'Executive Suite'
            : fl >= 2
              ? 'Deluxe'
              : 'Standard';
        const multiplier = type === 'Executive Suite' ? 2.2 : type === 'Deluxe' ? 1.45 : 1;
        generatedRooms.push({
          id: `${hotelId}-${roomNumber}`,
          hotelId,
          roomNumber,
          floor: fl,
          type,
          ratePerNight: Math.round((stdRate * multiplier) / 100) * 100,
          occupancyStatus: 'Available',
          cleaningStatus: 'Clean',
          currentBookingId: null,
          housekeepingNotes: 'Provisioned ready by Central Server',
          lastCleanedAt: nowIso,
          lastCleanedBy: generatedUsers[1]?.name || 'Housekeeping',
        });
      }
    }
  }

  const welcomeMsg: StaffMessage = {
    id: `msg-${Date.now()}`,
    hotelId,
    senderId: generatedUsers[3]?.id || 'system',
    senderName: 'Central Server Admin',
    senderRole: 'manager',
    recipientRole: 'all',
    category: 'Manager Notice',
    priority: 'Normal',
    roomNumber: 'All',
    subject: `${newHotel.name} connected to Central Server`,
    body: `Property ${newHotel.code} (${newHotel.starRating}★ ${newHotel.category}) initialized with ${generatedRooms.length} rooms and isolated staff & reception portals.`,
    createdAt: nowIso,
    acknowledgedBy: [],
  };

  const starterMenu = createDefaultHotelMenu(hotelId, `${prefix}-${Date.now().toString().slice(-3)}`);
  const starterTables = createDefaultHotelTables(hotelId, `${prefix}-${Date.now().toString().slice(-3)}`);

  db.hotels.push(newHotel);
  db.users.push(...generatedUsers);
  db.rooms.push(...generatedRooms);
  db.tables.push(...starterTables);
  db.fbMenu.push(...starterMenu);
  db.messages.unshift(welcomeMsg);
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: generatedUsers[3]?.id || 'system',
    portal: 'System',
    action: `Provisioned hotel ${newHotel.name} (${newHotel.code}) with ${generatedRooms.length} rooms`,
    amharicAction: `${newHotel.amharicName} (${newHotel.code}) ከ${generatedRooms.length} ክፍሎች ጋር በዋናው ሰርቨር ተመዝግቧል`,
    targetRef: newHotel.code,
    details: `${newHotel.starRating}★ ${newHotel.category} · TIN ${newHotel.tinNumber}`,
  });

  res.status(201).json({
    hotel: newHotel,
    roomsCreated: generatedRooms.length,
    staffCreated: generatedUsers.length,
  });
}

export function updateHotel(req: Request, res: Response): void {
  const { id } = req.params;
  const {
    name,
    amharicName,
    city,
    amharicCity,
    address,
    phone,
    email,
    tinNumber,
    managerName,
    starRating,
    category,
    status,
    checkInTime,
    checkOutTime,
    taxPercent,
    serviceChargePercent,
    amenities,
    tierRates,
  } = req.body as Partial<HotelProperty> & {
    tierRates?: Partial<Record<RoomType, number>>;
  };

  const db = readDb();
  const idx = db.hotels.findIndex((h) => h.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Hotel property not found on Central Server.' });
    return;
  }

  const hotel = db.hotels[idx];
  if (typeof name === 'string' && name.trim()) hotel.name = name.trim();
  if (typeof amharicName === 'string' && amharicName.trim()) hotel.amharicName = amharicName.trim();
  if (typeof city === 'string' && city.trim()) hotel.city = city.trim();
  if (typeof amharicCity === 'string' && amharicCity.trim()) hotel.amharicCity = amharicCity.trim();
  if (typeof address === 'string') hotel.address = address.trim();
  if (typeof phone === 'string') hotel.phone = phone.trim();
  if (typeof email === 'string') hotel.email = email.trim();
  if (typeof tinNumber === 'string') hotel.tinNumber = tinNumber.trim();
  if (typeof managerName === 'string' && managerName.trim()) hotel.managerName = managerName.trim();
  if (typeof starRating === 'number') hotel.starRating = Math.min(5, Math.max(1, starRating));
  if (category) hotel.category = category;
  if (status) hotel.status = status;
  if (typeof checkInTime === 'string' && checkInTime.trim()) hotel.checkInTime = checkInTime.trim();
  if (typeof checkOutTime === 'string' && checkOutTime.trim()) hotel.checkOutTime = checkOutTime.trim();
  if (typeof taxPercent === 'number') hotel.taxPercent = Math.max(0, Math.min(30, taxPercent));
  if (typeof serviceChargePercent === 'number') {
    hotel.serviceChargePercent = Math.max(0, Math.min(25, serviceChargePercent));
  }
  if (Array.isArray(amenities)) hotel.amenities = amenities;

  let roomsUpdated = 0;
  if (tierRates && typeof tierRates === 'object') {
    for (const room of db.rooms) {
      if (room.hotelId !== id) continue;
      const nextRate = tierRates[room.type];
      if (typeof nextRate === 'number' && nextRate >= 500) {
        room.ratePerNight = nextRate;
        roomsUpdated += 1;
      }
    }
  }

  db.hotels[idx] = hotel;
  writeDb(db);

  const mgrUser = db.users.find((u) => u.hotelId === id && u.role === 'manager') || db.users[0];
  appendActivityLog({
    hotelId: id,
    staffId: mgrUser?.id || 'system',
    portal: 'System',
    action: `Updated hotel profile & rates for ${hotel.name} (${roomsUpdated} rooms repriced)`,
    amharicAction: `የ${hotel.amharicName} መረጃ እና የክፍል ዋጋ (${roomsUpdated} ክፍሎች) ተዘምኗል`,
    targetRef: hotel.code,
    details: `${hotel.starRating}★ ${hotel.category} · ${hotel.status}`,
  });

  res.json({ hotel, roomsUpdated });
}

export function addHotelRoom(req: Request, res: Response): void {
  const { id } = req.params;
  const { roomNumber, floor, type, ratePerNight } = req.body as {
    roomNumber?: string;
    floor?: number;
    type?: RoomType;
    ratePerNight?: number;
  };

  if (!roomNumber?.trim() || !type || !ratePerNight || Number(ratePerNight) < 500) {
    res.status(400).json({ error: 'Room number, room tier, and valid nightly rate (>= 500 ETB) are required.' });
    return;
  }

  const db = readDb();
  const hotel = db.hotels.find((h) => h.id === id);
  if (!hotel) {
    res.status(404).json({ error: 'Hotel property not found.' });
    return;
  }

  const normalizedRoomNum = roomNumber.trim();
  const duplicate = db.rooms.find(
    (r) => r.hotelId === id && r.roomNumber.toLowerCase() === normalizedRoomNum.toLowerCase()
  );
  if (duplicate) {
    res.status(409).json({ error: `Room ${normalizedRoomNum} already exists in ${hotel.name}.` });
    return;
  }

  const floorNum = Math.max(1, Number(floor) || 1);
  if (floorNum > hotel.floors) {
    hotel.floors = floorNum;
  }

  const newRoom: Room = {
    id: `${id}-${normalizedRoomNum}-${Date.now().toString().slice(-3)}`,
    hotelId: id,
    roomNumber: normalizedRoomNum,
    floor: floorNum,
    type,
    ratePerNight: Number(ratePerNight),
    occupancyStatus: 'Available',
    cleaningStatus: 'Clean',
    currentBookingId: null,
    housekeepingNotes: 'Added via Central Server Room Manager',
    lastCleanedAt: new Date().toISOString(),
    lastCleanedBy: 'Central Server Admin',
  };

  db.rooms.push(newRoom);
  writeDb(db);

  const mgrUser = db.users.find((u) => u.hotelId === id && u.role === 'manager') || db.users[0];
  appendActivityLog({
    hotelId: id,
    staffId: mgrUser?.id || 'system',
    portal: 'System',
    action: `Added Room ${newRoom.roomNumber} (${newRoom.type}) at ${newRoom.ratePerNight.toLocaleString()} ETB/night`,
    amharicAction: `አዲስ ክፍል ${newRoom.roomNumber} (${newRoom.type}) በ${newRoom.ratePerNight.toLocaleString()} ብር ተጨምሯል`,
    targetRef: `Room ${newRoom.roomNumber}`,
    details: `Floor ${newRoom.floor}`,
  });

  res.status(201).json(newRoom);
}

export function updateRoomRateOrTier(req: Request, res: Response): void {
  const { id, roomId } = req.params;
  const { type, ratePerNight } = req.body as {
    type?: RoomType;
    ratePerNight?: number;
  };

  const db = readDb();
  const idx = db.rooms.findIndex((r) => r.id === roomId && r.hotelId === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Room not found in this hotel.' });
    return;
  }

  const room = db.rooms[idx];
  if (typeof type === 'string' && type.trim()) room.type = type.trim();
  if (typeof ratePerNight === 'number' && ratePerNight >= 500) room.ratePerNight = ratePerNight;

  db.rooms[idx] = room;
  writeDb(db);
  res.json(room);
}

export function broadcastCentralMessage(req: Request, res: Response): void {
  const { targetHotelId, recipientRole, priority, subject, body } = req.body as {
    targetHotelId?: string;
    recipientRole?: MessageTargetRole;
    priority?: MessagePriority;
    subject?: string;
    body?: string;
  };

  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'Broadcast subject and message details are required.' });
    return;
  }

  const db = readDb();
  const targets =
    targetHotelId && targetHotelId !== 'all'
      ? db.hotels.filter((h) => h.id === targetHotelId)
      : db.hotels;

  if (targets.length === 0) {
    res.status(404).json({ error: 'Target hotel not found.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const createdMessages: StaffMessage[] = [];

  for (const h of targets) {
    const msg: StaffMessage = {
      id: `msg-hq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hotelId: h.id,
      senderId: 'central-hq',
      senderName: 'Central Server HQ',
      senderRole: 'manager',
      recipientRole: recipientRole || 'all',
      category: 'Manager Notice',
      priority: priority || 'Normal',
      roomNumber: 'All',
      subject: subject.trim(),
      body: body.trim(),
      createdAt: nowIso,
      acknowledgedBy: [],
    };
    db.messages.unshift(msg);
    createdMessages.push(msg);
  }

  writeDb(db);
  res.status(201).json({ deliveredCount: createdMessages.length, messages: createdMessages });
}
