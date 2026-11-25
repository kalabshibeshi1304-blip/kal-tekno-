import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import { listHotelTaskReports, updateTaskReportStatus } from '../models/TaskReport.ts';
import type { ManagerUnifiedSummary, StaffMessage, TaskReportStatus } from '../../src/types/hotel.ts';

export function listMaintenanceTasks(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  res.json(listHotelTaskReports(hotelId, 'maintenance'));
}

export function updateMaintenanceTask(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { status, completionNotes, staffId } = req.body as {
    status?: TaskReportStatus;
    completionNotes?: string;
    staffId?: string;
  };

  if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
    res.status(400).json({ error: 'Valid maintenance task status is required.' });
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
    res.status(404).json({ error: 'Maintenance task report not found.' });
    return;
  }

  if (status === 'Completed') {
    const db = readDb();
    if (updated.roomId) {
      const rmIdx = db.rooms.findIndex((r) => r.id === updated.roomId && r.hotelId === hotelId);
      if (rmIdx !== -1 && db.rooms[rmIdx].occupancyStatus === 'Out of Order') {
        db.rooms[rmIdx].occupancyStatus = 'Available';
      }
    }
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
      subject: `Maintenance Completed: ${updated.roomNumber === 'General' ? updated.title : `Room ${updated.roomNumber}`}`,
      body: updated.completionNotes || 'Repair completed and verified.',
      createdAt: new Date().toISOString(),
      acknowledgedBy: [],
    };
    db.messages = [notify, ...db.messages];
    writeDb(db);
  }

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Maintenance',
    action: `Updated Maintenance task ${updated.id} (${updated.roomNumber}) to ${status}`,
    amharicAction:
      status === 'Completed'
        ? `የክፍል ${updated.roomNumber} ጥገናን "ተጠናቋል" ብለው ዘግተዋል`
        : `የክፍል ${updated.roomNumber} ጥገናን ጀምረዋል (${status})`,
    targetRef: updated.id,
    details: updated.completionNotes || updated.title,
  });

  res.json(updated);
}

export function getManagerUnifiedOverview(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const tasks = listHotelTaskReports(hotelId);

  const hk = tasks.filter((t) => t.targetDepartment === 'housekeeping');
  const mnt = tasks.filter((t) => t.targetDepartment === 'maintenance');

  const summary: ManagerUnifiedSummary = {
    hotelId,
    receptionReportsToday: tasks.length,
    housekeepingPending: hk.filter((t) => t.status === 'Pending').length,
    housekeepingInProgress: hk.filter((t) => t.status === 'In Progress').length,
    housekeepingCompleted: hk.filter((t) => t.status === 'Completed').length,
    maintenancePending: mnt.filter((t) => t.status === 'Pending').length,
    maintenanceInProgress: mnt.filter((t) => t.status === 'In Progress').length,
    maintenanceCompleted: mnt.filter((t) => t.status === 'Completed').length,
    recentTasks: tasks,
  };

  res.json(summary);
}
