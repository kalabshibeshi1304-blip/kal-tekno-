import { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { CleaningStatus } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

export function HousekeepingPage() {
  const { language, t, activeHotelId, rooms, taskReports, activeUser, refreshAll, announce } = useHotel();

  const [filter, setFilter] = useState<'all' | CleaningStatus>('all');
  const [search, setSearch] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [taskCompletionNotes, setTaskCompletionNotes] = useState<Record<string, string>>({});

  const hkTasks = taskReports.filter((tsk) => tsk.targetDepartment === 'housekeeping');

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => {
        if (filter !== 'all' && r.cleaningStatus !== filter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            r.roomNumber.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.housekeepingNotes.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<CleaningStatus, number> = { Dirty: 0, Inspecting: 1, Clean: 2 };
        if (order[a.cleaningStatus] !== order[b.cleaningStatus]) {
          return order[a.cleaningStatus] - order[b.cleaningStatus];
        }
        return a.roomNumber.localeCompare(b.roomNumber);
      });
  }, [rooms, filter, search]);

  const handleStatusChange = async (roomId: string, roomNumber: string, status: CleaningStatus) => {
    setBusyId(roomId);
    try {
      const targetRoom = rooms.find((r) => r.id === roomId);
      const nextNote = notesDraft[roomId] ?? targetRoom?.housekeepingNotes ?? '';

      await hotelApi.updateHousekeeping(activeHotelId, roomId, {
        cleaningStatus: status,
        housekeepingNotes: nextNote,
        staffId: activeUser?.id || '',
      });
      await refreshAll();

      if (status === 'Clean') {
        announce(
          `Housekeeping update: Room ${roomNumber} is now clean and ready for check-in.`,
          `የሃውስ ኪፒንግ ማሳወቂያ: ክፍል ${roomNumber} አሁን ንጹህ እና ለእንግዳ ዝግጁ ነው።`,
          'success'
        );
      } else if (status === 'Dirty') {
        announce(
          `Room ${roomNumber} flagged dirty for cleaning.`,
          `ክፍል ${roomNumber} ጽዳት ያስፈልገዋል ተብሎ ተመዝግቧል።`,
          'warning'
        );
      } else {
        announce(
          `Room ${roomNumber} is now under cleaning inspection.`,
          `የክፍል ${roomNumber} ጽዳት በምርመራ ላይ ነው።`,
          'info'
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const dirtyCount = rooms.filter((r) => r.cleaningStatus === 'Dirty').length;
  const inspectingCount = rooms.filter((r) => r.cleaningStatus === 'Inspecting').length;
  const cleanCount = rooms.filter((r) => r.cleaningStatus === 'Clean').length;

  const handleTaskAction = async (taskId: string, roomNum: string, status: 'In Progress' | 'Completed') => {
    setBusyId(taskId);
    try {
      await hotelApi.updateHousekeepingTask(activeHotelId, taskId, {
        status,
        completionNotes: taskCompletionNotes[taskId] || 'Cleaned and inspected',
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      if (status === 'Completed') {
        announce(
          `Housekeeping completed cleaning for Room ${roomNum}.`,
          `ሃውስ ኪፒንግ የክፍል ${roomNum} ጽዳትን አጠናቅቄያለሁ ብሏል።`,
          'success'
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Incoming Cleaning Reports from Reception */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'ከሪሴፕሽን የመጡ የጽዳት ሪፖርቶች' : 'Incoming Cleaning Reports from Reception'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ሪፖርቱን አይተው ካጸዱ በኋላ "አጠናቅቄያለሁ" የሚለውን ይጫኑ'
                : 'Accept assigned room turnovers and mark Completed when ready for check-in'}
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {hkTasks.filter((x) => x.status !== 'Completed').length} {language === 'am' ? 'ንቁ' : 'open'}
          </span>
        </div>

        {hkTasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {hkTasks.slice(0, 6).map((tsk) => (
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
                  {tsk.notes && <div className="text-xs text-slate-500">{tsk.notes}</div>}
                </div>

                {tsk.status !== 'Completed' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={taskCompletionNotes[tsk.id] ?? ''}
                      onChange={(e) =>
                        setTaskCompletionNotes((prev) => ({ ...prev, [tsk.id]: e.target.value }))
                      }
                      placeholder={language === 'am' ? 'ማስታወሻ...' : 'Completion note...'}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs focus:border-amber-600 focus:outline-none"
                    />
                    {tsk.status === 'Pending' && (
                      <button
                        type="button"
                        disabled={busyId === tsk.id}
                        onClick={() => handleTaskAction(tsk.id, tsk.roomNumber, 'In Progress')}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        {language === 'am' ? 'ጽዳት ጀምር' : 'Start Cleaning'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === tsk.id}
                      onClick={() => handleTaskAction(tsk.id, tsk.roomNumber, 'Completed')}
                      className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                    >
                      {language === 'am' ? 'አጠናቅቄያለሁ' : 'Mark Completed'}
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

      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { key: 'all', label: `${t.allStatuses} (${rooms.length})` },
              { key: 'Dirty', label: `${t.dirty} (${dirtyCount})` },
              { key: 'Inspecting', label: `${t.inspecting} (${inspectingCount})` },
              { key: 'Clean', label: `${t.clean} (${cleanCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'am' ? 'ክፍል ፈልግ...' : 'Search room # or note...'}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Housekeeping Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">{t.housekeepingBoard}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'am'
              ? 'ቆሻሻ ክፍሎች በቅድሚያ ይታያሉ፤ ሁኔታውን በአንድ ጠቅታ ያዘምኑ'
              : 'Dirty turnover rooms are prioritized at the top; update status with one click'}
          </p>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">{language === 'am' ? 'ክፍል' : 'Room'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ሁኔታ' : 'Occupancy'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'የጽዳት ሁኔታ' : 'Cleaning State'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ማስታወሻ' : 'Housekeeping Note'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'አስተካክል' : 'Update Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRooms.map((room) => {
                  const noteValue = notesDraft[room.id] ?? room.housekeepingNotes;
                  const isBusy = busyId === room.id;
                  return (
                    <tr key={room.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {room.roomNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {room.type} · {t.floor} {room.floor}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {room.occupancyStatus === 'Occupied'
                          ? t.occupied
                          : room.occupancyStatus === 'Out of Order'
                            ? t.outOfOrder
                            : t.available}
                      </td>

                      <td className="py-3 px-4">
                        {room.cleaningStatus === 'Clean' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t.clean}</span>
                          </span>
                        ) : room.cleaningStatus === 'Dirty' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{t.dirty}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">{t.inspecting}</span>
                        )}
                        {room.lastCleanedAt && (
                          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                            {new Date(room.lastCleanedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[220px]">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({ ...prev, [room.id]: e.target.value }))
                          }
                          placeholder={language === 'am' ? 'ማስታወሻ ጨምር...' : 'Add room note...'}
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-amber-600 focus:outline-none"
                        />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {room.cleaningStatus !== 'Inspecting' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(room.id, room.roomNumber, 'Inspecting')}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              {t.markInspecting}
                            </button>
                          )}
                          {room.cleaningStatus !== 'Clean' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(room.id, room.roomNumber, 'Clean')}
                              className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              {t.markClean}
                            </button>
                          )}
                          {room.cleaningStatus !== 'Dirty' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(room.id, room.roomNumber, 'Dirty')}
                              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              {t.flagDirty}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
