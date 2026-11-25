import React, { useState } from 'react';
import { useHotel } from '../../context/VoiceContext';
import type {
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceStatus,
} from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const CATEGORIES: MaintenanceCategory[] = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Furniture',
  'Network & TV',
  'Structural',
];

const SEVERITIES: MaintenanceSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

export function MaintenancePage() {
  const { language, t, activeHotelId, rooms, maintenance, taskReports, activeUser, refreshAll, announce } = useHotel();
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const mntTasks = taskReports.filter((tsk) => tsk.targetDepartment === 'maintenance');

  const [roomId, setRoomId] = useState<string>(rooms[0]?.id ?? '');
  const [locationLabel, setLocationLabel] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('Plumbing');
  const [severity, setSeverity] = useState<MaintenanceSeverity>('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blockRoom, setBlockRoom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | MaintenanceStatus>('all');
  const [resolutionDraft, setResolutionDraft] = useState<Record<string, string>>({});

  const filteredIssues = maintenance.filter((m) =>
    statusFilter === 'all' ? true : m.status === statusFilter
  );

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const selectedRoom = rooms.find((r) => r.id === roomId);
      const loc =
        locationLabel.trim() ||
        (selectedRoom ? `Room ${selectedRoom.roomNumber}` : 'Hotel Common Area');

      const created = await hotelApi.createMaintenance(activeHotelId, {
        roomId: roomId === 'common' ? null : roomId || null,
        locationLabel: loc,
        category,
        severity,
        title,
        description,
        blockRoom: roomId === 'common' ? false : blockRoom,
        staffId: activeUser?.id || '',
      });

      await refreshAll();
      announce(
        `${created.severity} maintenance issue logged in ${created.locationLabel}: ${created.title}.`,
        `በ${created.locationLabel} የ${created.category} ብልሽት ተመዝግቧል።`,
        created.severity === 'High' || created.severity === 'Critical' ? 'warning' : 'info'
      );

      setTitle('');
      setDescription('');
      setLocationLabel('');
      setBlockRoom(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log maintenance issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (
    issueId: string,
    nextStatus: MaintenanceStatus,
    restoreRoom: boolean
  ) => {
    const issue = maintenance.find((m) => m.id === issueId);
    const note = resolutionDraft[issueId] ?? issue?.resolutionNotes ?? '';

    const updated = await hotelApi.updateMaintenance(activeHotelId, issueId, {
      status: nextStatus,
      resolutionNotes: note,
      restoreRoom,
      staffId: activeUser?.id || '',
    });

    await refreshAll();
    if (nextStatus === 'Resolved') {
      announce(
        `Maintenance ticket ${updated.id} in ${updated.locationLabel} has been resolved.`,
        `የጥገና ቲኬት ${updated.id} (${updated.locationLabel}) ተጠግኖ ተዘግቷል።`,
        'success'
      );
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Report Issue Form (5 cols) */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">{t.reportIssue}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'am'
            ? 'የተበላሹ ዕቃዎችን ወይም የክፍል ጥገናዎችን መዝግበው ለሚንተናስ ይላኩ'
            : 'Log damaged fixtures, plumbing leaks, or electrical faults'}
        </p>

        {formError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateIssue} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mnt-room" className="block text-xs font-medium text-slate-700 mb-1">
                {t.location}
              </label>
              <select
                id="mnt-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="common">
                  {language === 'am' ? 'የጋራ ቦታ (Lobby / Hall)' : 'Common Area (Lobby / Hall)'}
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} ({r.occupancyStatus})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mnt-loc" className="block text-xs font-medium text-slate-700 mb-1">
                {language === 'am' ? 'ትክክለኛ ቦታ' : 'Specific Spot'}
              </label>
              <input
                id="mnt-loc"
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g. Room 203 · Bathroom"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mnt-cat" className="block text-xs font-medium text-slate-700 mb-1">
                {t.category}
              </label>
              <select
                id="mnt-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mnt-sev" className="block text-xs font-medium text-slate-700 mb-1">
                {t.severity}
              </label>
              <select
                id="mnt-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as MaintenanceSeverity)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="mnt-title" className="block text-xs font-medium text-slate-700 mb-1">
              {t.issueTitle}
            </label>
            <input
              id="mnt-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AC compressor not cooling"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mnt-desc" className="block text-xs font-medium text-slate-700 mb-1">
              {t.notes}
            </label>
            <textarea
              id="mnt-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'am' ? 'ዝርዝር ሁኔታውን ይጻፉ...' : 'Describe symptoms or parts needed...'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          {roomId !== 'common' && (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={blockRoom}
                onChange={(e) => setBlockRoom(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
              />
              <span>{t.blockRoomLabel}</span>
            </label>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : t.submitIssue}
          </button>
        </form>
      </section>

      {/* Right: Reception Maintenance Requests + Work Orders Queue (7 cols) */}
      <div className="xl:col-span-7 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'ከሪሴፕሽን የመጡ የጥገና ጥያቄዎች' : 'Incoming Maintenance Tasks from Reception'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'am'
                  ? 'ጥገናውን ሲጨርሱ "ተጠናቋል" የሚለውን ይጫኑ'
                  : 'Accept requests from Reception and mark Completed when repaired'}
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {mntTasks.filter((x) => x.status !== 'Completed').length} {language === 'am' ? 'ንቁ' : 'open'}
            </span>
          </div>

          {mntTasks.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">{t.noRecords}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {mntTasks.slice(0, 6).map((tsk) => (
                <div key={tsk.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {tsk.roomNumber === 'General' ? 'Common' : `Room ${tsk.roomNumber}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>From: {tsk.reportedBy}</span>
                      {tsk.priority === 'Urgent' && (
                        <span className="font-semibold text-red-700">· Urgent</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-900 mt-0.5">{tsk.title}</div>
                  </div>

                  {tsk.status !== 'Completed' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={taskNotes[tsk.id] ?? ''}
                        onChange={(e) => setTaskNotes((p) => ({ ...p, [tsk.id]: e.target.value }))}
                        placeholder={language === 'am' ? 'የጥገና ማስታወሻ...' : 'Repair note...'}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs focus:border-amber-600 focus:outline-none"
                      />
                      {tsk.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await hotelApi.updateMaintenanceTask(activeHotelId, tsk.id, {
                              status: 'In Progress',
                              completionNotes: taskNotes[tsk.id] || '',
                              staffId: activeUser?.id || '',
                            });
                            await refreshAll();
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          {t.startWork}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await hotelApi.updateMaintenanceTask(activeHotelId, tsk.id, {
                            status: 'Completed',
                            completionNotes: taskNotes[tsk.id] || 'Repair completed',
                            staffId: activeUser?.id || '',
                          });
                          await refreshAll();
                          announce(
                            `Maintenance completed for Room ${tsk.roomNumber}.`,
                            `የክፍል ${tsk.roomNumber} ጥገና ተጠናቋል።`,
                            'success'
                          );
                        }}
                        className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        {language === 'am' ? 'ተጠናቋል' : 'Mark Completed'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">
                      {language === 'am' ? 'ተጠናቋል' : 'Completed'} · {tsk.completedBy}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">{t.workOrders}</h2>

          <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
            {(['all', 'Open', 'In Progress', 'Resolved'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? t.allStatuses : st}
              </button>
            ))}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">{issue.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.locationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          issue.severity === 'Critical' || issue.severity === 'High'
                            ? 'font-medium text-red-700'
                            : 'text-slate-600'
                        }
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <h3 className="mt-1 font-medium text-slate-900 text-sm">{issue.title}</h3>
                    {issue.description && (
                      <p className="mt-1 text-xs text-slate-600">{issue.description}</p>
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      issue.status === 'Resolved'
                        ? 'text-emerald-700'
                        : issue.status === 'In Progress'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {issue.status}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <input
                    type="text"
                    value={resolutionDraft[issue.id] ?? issue.resolutionNotes}
                    onChange={(e) =>
                      setResolutionDraft((prev) => ({ ...prev, [issue.id]: e.target.value }))
                    }
                    disabled={issue.status === 'Resolved'}
                    placeholder={
                      language === 'am' ? 'የጥገና ማጠናቀቂያ ማስታወሻ...' : 'Technician resolution notes...'
                    }
                    className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 disabled:bg-slate-50 focus:border-amber-600 focus:outline-none"
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    {issue.status === 'Open' && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(issue.id, 'In Progress', false)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        {t.startWork}
                      </button>
                    )}
                    {issue.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(issue.id, 'Resolved', true)}
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        {t.resolveIssue}
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  {language === 'am' ? 'ሪፖርት ያደረገው' : 'Reported by'}: {issue.reportedBy} ·{' '}
                  {new Date(issue.reportedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
