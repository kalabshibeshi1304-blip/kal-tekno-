import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import { createTaskReportRecord, listHotelTaskReports } from '../models/TaskReport.ts';
import type { StaffMessage, TaskTargetDepartment } from '../../src/types/hotel.ts';

export function listReceptionSentReports(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  res.json(listHotelTaskReports(hotelId));
}

export function createReceptionTaskReport(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { roomId, targetDepartment, priority, title, notes, staffId } = req.body as {
    roomId?: string | null;
    targetDepartment?: TaskTargetDepartment;
    priority?: 'Normal' | 'Urgent';
    title?: string;
    notes?: string;
    staffId?: string;
  };

  if (!targetDepartment || !['housekeeping', 'maintenance'].includes(targetDepartment) || !title?.trim()) {
    res.status(400).json({ error: 'Target department (housekeeping or maintenance) and task title are required.' });
    return;
  }

  const db = readDb();
  const actor = resolveStaff(hotelId, staffId);

  let roomNumber = 'General';
  if (roomId && roomId !== 'common') {
    const rmIdx = db.rooms.findIndex((r) => r.id === roomId && r.hotelId === hotelId);
    if (rmIdx !== -1) {
      roomNumber = db.rooms[rmIdx].roomNumber;
      if (targetDepartment === 'housekeeping') {
        db.rooms[rmIdx].cleaningStatus = 'Dirty';
        db.rooms[rmIdx].housekeepingNotes = title.trim();
        writeDb(db);
      }
    }
  }

  const task = createTaskReportRecord({
    hotelId,
    roomId: roomId && roomId !== 'common' ? roomId : null,
    roomNumber,
    targetDepartment,
    priority: priority || 'Normal',
    title: title.trim(),
    notes: notes?.trim() || '',
    reportedBy: actor.name,
    reportedByRole: actor.role,
  });

  // Also push an instant StaffMessage notification to the target department inbox
  const latestDb = readDb();
  const msg: StaffMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    recipientRole: targetDepartment,
    category: 'Task Dispatch',
    priority: task.priority,
    roomNumber: task.roomNumber,
    subject: `${task.roomNumber !== 'General' ? `Room ${task.roomNumber}: ` : ''}${task.title}`,
    body: task.notes || `Dispatched from ${actor.name} (${actor.role})`,
    createdAt: task.createdAt,
    acknowledgedBy: [],
  };
  latestDb.messages = [msg, ...latestDb.messages];
  writeDb(latestDb);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Dispatch',
    action: `Dispatched ${task.priority} ${targetDepartment} report for ${
      roomNumber === 'General' ? 'Common Area' : `Room ${roomNumber}`
    }: ${task.title}`,
    amharicAction: `ለ${targetDepartment === 'housekeeping' ? 'ሃውስ ኪፒንግ' : 'ሚንተናስ'} (${
      roomNumber === 'General' ? 'የጋራ ቦታ' : `ክፍል ${roomNumber}`
    }) የስራ ሪፖርት ልከዋል: ${task.title}`,
    targetRef: task.id,
    details: task.notes || 'Task report created',
  });

  res.status(201).json(task);
}
