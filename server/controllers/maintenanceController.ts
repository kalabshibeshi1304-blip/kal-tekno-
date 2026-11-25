import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  MaintenanceCategory,
  MaintenanceIssue,
  MaintenanceSeverity,
  MaintenanceStatus,
  StaffMessage,
} from '../../src/types/hotel.ts';

export function listMaintenance(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  res.json(db.maintenance.filter((m) => m.hotelId === hotelId));
}

export function createMaintenanceIssue(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { roomId, locationLabel, category, severity, title, description, blockRoom, staffId } = req.body as {
    roomId?: string | null;
    locationLabel?: string;
    category?: MaintenanceCategory;
    severity?: MaintenanceSeverity;
    title?: string;
    description?: string;
    blockRoom?: boolean;
    staffId?: string;
  };

  if (!title?.trim() || !category || !severity) {
    res.status(400).json({ error: 'Title, category, and severity are required.' });
    return;
  }

  const db = readDb();
  const actor = resolveStaff(hotelId, staffId);

  let roomNumber = 'Common';
  let resolvedLocation = locationLabel?.trim() || 'Hotel Common Area';
  if (roomId) {
    const roomIdx = db.rooms.findIndex((r) => r.id === roomId && r.hotelId === hotelId);
    if (roomIdx !== -1) {
      roomNumber = db.rooms[roomIdx].roomNumber;
      resolvedLocation = locationLabel?.trim() || `Room ${roomNumber}`;
      if (blockRoom && db.rooms[roomIdx].occupancyStatus !== 'Occupied') {
        db.rooms[roomIdx].occupancyStatus = 'Out of Order';
      }
    }
  }

  const nowIso = new Date().toISOString();
  const issue: MaintenanceIssue = {
    id: `mnt-${Date.now().toString().slice(-5)}`,
    hotelId,
    roomId: roomId || null,
    roomNumber,
    locationLabel: resolvedLocation,
    category,
    severity,
    status: 'Open',
    title: title.trim(),
    description: description?.trim() || '',
    blockRoom: Boolean(blockRoom),
    reportedBy: actor.name,
    assignedTo:
      db.users.find((u) => u.hotelId === hotelId && u.role === 'maintenance')?.name || 'Engineering',
    resolutionNotes: '',
    reportedAt: nowIso,
    resolvedAt: null,
  };

  db.maintenance = [issue, ...db.maintenance];

  // Auto-dispatch message to maintenance team
  const mntMsg: StaffMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    recipientRole: 'maintenance',
    category: 'Incident Alert',
    priority: severity === 'High' || severity === 'Critical' ? 'Urgent' : 'Normal',
    roomNumber,
    subject: `${severity} ${category}: ${issue.title}`,
    body: `${resolvedLocation} — ${issue.description || 'Please inspect and repair.'}`,
    createdAt: nowIso,
    acknowledgedBy: [],
  };
  db.messages = [mntMsg, ...db.messages];

  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Maintenance',
    action: `Logged ${severity} ${category} ticket: ${issue.title}`,
    amharicAction: `በ${resolvedLocation} የ${category} ጥገና መዝግበዋል: ${issue.title}`,
    targetRef: issue.id,
    details: `${resolvedLocation}${blockRoom ? ' · Room placed Out of Order' : ''}`,
  });

  res.status(201).json(issue);
}

export function updateMaintenanceIssue(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { status, resolutionNotes, restoreRoom, staffId } = req.body as {
    status?: MaintenanceStatus;
    resolutionNotes?: string;
    restoreRoom?: boolean;
    staffId?: string;
  };

  if (!status || !['Open', 'In Progress', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid maintenance status' });
    return;
  }

  const db = readDb();
  const idx = db.maintenance.findIndex((m) => m.id === id && m.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Maintenance ticket not found in this hotel' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const issue = db.maintenance[idx];
  issue.status = status;
  if (typeof resolutionNotes === 'string') {
    issue.resolutionNotes = resolutionNotes.trim();
  }
  if (status === 'Resolved') {
    issue.resolvedAt = new Date().toISOString();
    if (restoreRoom && issue.roomId) {
      const rIdx = db.rooms.findIndex((r) => r.id === issue.roomId && r.hotelId === hotelId);
      if (rIdx !== -1 && db.rooms[rIdx].occupancyStatus === 'Out of Order') {
        db.rooms[rIdx].occupancyStatus = 'Available';
      }
    }
  } else {
    issue.resolvedAt = null;
  }

  db.maintenance[idx] = issue;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Maintenance',
    action: `Updated ticket ${issue.id} (${issue.locationLabel}) to ${status}`,
    amharicAction: `የጥገና ቲኬት ${issue.id} (${issue.locationLabel}) ሁኔታን ወደ ${status} ቀይረዋል`,
    targetRef: issue.id,
    details: issue.resolutionNotes || issue.title,
  });

  res.json(issue);
}
