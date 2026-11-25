import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import { listHotelTaskReports, updateTaskReportStatus } from '../models/TaskReport.ts';
import type { StaffMessage, TaskReportStatus } from '../../src/types/hotel.ts';

export function listHousekeepingTasks(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  res.json(listHotelTaskReports(hotelId, 'housekeeping'));
}

export function updateHousekeepingTask(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { status, completionNotes, staffId } = req.body as {
    status?: TaskReportStatus;
    completionNotes?: string;
    staffId?: string;
  };

  if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
    res.status(400).json({ error: 'Valid task status is required.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const updated = updateTaskReportStatus({
    hotelId,
    taskId: id,
    status,
    actorName: actor.name,
    completionNotes,
  });

  if (!updated) {
    res.status(404).json({ error: 'Housekeeping task report not found.' });
    return;
  }

  // Sync room cleaning state automatically when Housekeeping accepts or completes
  const db = readDb();
  if (updated.roomId) {
    const rmIdx = db.rooms.findIndex((r) => r.id === updated.roomId && r.hotelId === hotelId);
    if (rmIdx !== -1) {
      if (status === 'In Progress') {
        db.rooms[rmIdx].cleaningStatus = 'Inspecting';
      } else if (status === 'Completed') {
        db.rooms[rmIdx].cleaningStatus = 'Clean';
        db.rooms[rmIdx].lastCleanedAt = new Date().toISOString();
        db.rooms[rmIdx].lastCleanedBy = actor.name;
        if (updated.completionNotes) {
          db.rooms[rmIdx].housekeepingNotes = updated.completionNotes;
        }
      }
      writeDb(db);
    }
  }

  if (status === 'Completed') {
    const latestDb = readDb();
    const notify: StaffMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      hotelId,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: actor.role,
      recipientRole: 'reception',
      category: 'Status Report',
      priority: 'Normal',
      roomNumber: updated.roomNumber,
      subject: `Cleaning Completed: ${updated.roomNumber === 'General' ? updated.title : `Room ${updated.roomNumber}`}`,
      body: updated.completionNotes || 'Housekeeping marked task completed and room clean.',
      createdAt: new Date().toISOString(),
      acknowledgedBy: [],
    };
    latestDb.messages = [notify, ...latestDb.messages];
    writeDb(latestDb);
  }

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Housekeeping',
    action: `Marked Housekeeping task ${updated.id} (${updated.roomNumber === 'General' ? 'Common' : `Room ${updated.roomNumber}`}) as ${status}`,
    amharicAction:
      status === 'Completed'
        ? `የክፍል ${updated.roomNumber} ጽዳትን "አጠናቅቄያለሁ" ብለው ዘግተዋል`
        : `የክፍል ${updated.roomNumber} ጽዳትን ጀምረዋል (${status})`,
    targetRef: updated.roomNumber === 'General' ? updated.id : `Room ${updated.roomNumber}`,
    details: updated.completionNotes || updated.title,
  });

  res.json(updated);
}
