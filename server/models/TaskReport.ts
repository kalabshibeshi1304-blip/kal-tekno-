import { readDb, writeDb } from '../config/database.ts';
import type { TaskReport, TaskReportStatus, TaskTargetDepartment, UserRole } from '../../src/types/hotel.ts';

export function listHotelTaskReports(
  hotelId: string,
  department?: TaskTargetDepartment
): TaskReport[] {
  const db = readDb();
  let list = db.taskReports.filter((t) => t.hotelId === hotelId);
  if (department) {
    list = list.filter((t) => t.targetDepartment === department);
  }
  return list;
}

export function createTaskReportRecord(input: {
  hotelId: string;
  roomId: string | null;
  roomNumber: string;
  targetDepartment: TaskTargetDepartment;
  priority: 'Normal' | 'Urgent';
  title: string;
  notes: string;
  reportedBy: string;
  reportedByRole: UserRole;
}): TaskReport {
  const db = readDb();
  const task: TaskReport = {
    id: `tsk-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId: input.hotelId,
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    targetDepartment: input.targetDepartment,
    priority: input.priority,
    title: input.title,
    notes: input.notes,
    status: 'Pending',
    reportedBy: input.reportedBy,
    reportedByRole: input.reportedByRole,
    acceptedBy: null,
    completedBy: null,
    completionNotes: '',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  db.taskReports = [task, ...db.taskReports];
  writeDb(db);
  return task;
}

export function updateTaskReportStatus(input: {
  hotelId: string;
  taskId: string;
  status: TaskReportStatus;
  actorName: string;
  completionNotes?: string;
}): TaskReport | null {
  const db = readDb();
  const idx = db.taskReports.findIndex((t) => t.id === input.taskId && t.hotelId === input.hotelId);
  if (idx === -1) return null;

  const task = db.taskReports[idx];
  const nowIso = new Date().toISOString();
  task.status = input.status;
  if (input.status === 'In Progress') {
    task.acceptedBy = task.acceptedBy || input.actorName;
    task.startedAt = task.startedAt || nowIso;
  }
  if (input.status === 'Completed') {
    task.acceptedBy = task.acceptedBy || input.actorName;
    task.completedBy = input.actorName;
    task.completedAt = nowIso;
    if (typeof input.completionNotes === 'string') {
      task.completionNotes = input.completionNotes.trim();
    }
  }

  db.taskReports[idx] = task;
  writeDb(db);
  return task;
}
