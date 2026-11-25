import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  MessageCategory,
  MessagePriority,
  MessageTargetRole,
  StaffMessage,
  UserRole,
} from '../../src/types/hotel.ts';

export function listMessages(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const role = req.query.role as UserRole | undefined;
  const db = readDb();

  let messages = db.messages.filter((m) => m.hotelId === hotelId);
  if (role && role !== 'manager' && role !== 'reception') {
    messages = messages.filter(
      (m) => m.recipientRole === 'all' || m.recipientRole === role || m.senderRole === role
    );
  }
  res.json(messages);
}

export function sendMessage(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { staffId, recipientRole, category, priority, roomNumber, subject, body } = req.body as {
    staffId?: string;
    recipientRole?: MessageTargetRole;
    category?: MessageCategory;
    priority?: MessagePriority;
    roomNumber?: string;
    subject?: string;
    body?: string;
  };

  if (!subject?.trim() || !body?.trim() || !recipientRole) {
    res.status(400).json({ error: 'Recipient, subject, and message body are required.' });
    return;
  }

  const db = readDb();
  const sender = resolveStaff(hotelId, staffId);

  const msg: StaffMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    recipientRole,
    category: category || 'Status Report',
    priority: priority || 'Normal',
    roomNumber: roomNumber?.trim() || 'General',
    subject: subject.trim(),
    body: body.trim(),
    createdAt: new Date().toISOString(),
    acknowledgedBy: [],
  };

  db.messages = [msg, ...db.messages];
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: sender.id,
    portal: 'Dispatch',
    action: `Sent ${msg.priority} ${msg.category} to ${msg.recipientRole}: ${msg.subject}`,
    amharicAction: `ለ${msg.recipientRole} (${msg.priority}) መልእክት/ሪፖርት ልከዋል: ${msg.subject}`,
    targetRef: msg.roomNumber === 'General' ? msg.id : `Room ${msg.roomNumber}`,
    details: msg.body,
  });

  res.status(201).json(msg);
}

export function acknowledgeMessage(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { staffId } = req.body as { staffId?: string };

  const db = readDb();
  const idx = db.messages.findIndex((m) => m.id === id && m.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const msg = db.messages[idx];
  if (!msg.acknowledgedBy.includes(actor.id)) {
    msg.acknowledgedBy.push(actor.id);
    db.messages[idx] = msg;
    writeDb(db);

    appendActivityLog({
      hotelId,
      staffId: actor.id,
      portal: 'Dispatch',
      action: `Acknowledged dispatch: ${msg.subject}`,
      amharicAction: `የተላከውን መልእክት ተቀብለው አረጋግጠዋል: ${msg.subject}`,
      targetRef: msg.id,
      details: `From ${msg.senderName}`,
    });
  }

  res.json(msg);
}
