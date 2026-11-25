import { useState } from 'react';
import { CheckCircle2, Clock, Wrench } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { TaskReportStatus } from '../../types/hotel';

export function ManagerMonitorPage() {
  const { language, t, managerOverview, dailyReport, auditLogs, setActivePortal } = useHotel();
  const [deptFilter, setDeptFilter] = useState<'all' | 'housekeeping' | 'maintenance'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskReportStatus>('all');

  if (!managerOverview) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        {t.loadingData}
      </div>
    );
  }

  const tasks = managerOverview.recentTasks.filter((tsk) => {
    if (deptFilter !== 'all' && tsk.targetDepartment !== deptFilter) return false;
    if (statusFilter !== 'all' && tsk.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 3-Department Unified Overview Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Reception Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{language === 'am' ? '1. ሪሴፕሽን (የተላኩ ሪፖርቶች)' : '1. Reception Dispatches'}</span>
            <button
              type="button"
              onClick={() => setActivePortal('reception')}
              className="text-amber-700 hover:text-amber-800"
            >
              {language === 'am' ? 'ክፈት →' : 'Open →'}
            </button>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {managerOverview.receptionReportsToday}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {language === 'am' ? 'የተሰበሰበ ገቢ' : 'Collected'}: {(dailyReport?.totalCollected ?? 0).toLocaleString()} {t.currency}
          </div>
        </div>

        {/* 2. Housekeeping Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{language === 'am' ? '2. ሃውስ ኪፒንግ (ጽዳት)' : '2. Housekeeping Progress'}</span>
            <button
              type="button"
              onClick={() => setActivePortal('housekeeping')}
              className="text-amber-700 hover:text-amber-800"
            >
              {language === 'am' ? 'ክፈት →' : 'Open →'}
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-3 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-emerald-700">
              {managerOverview.housekeepingCompleted}
            </span>
            <span className="text-xs text-slate-500">
              {language === 'am' ? 'ተጠናቋል' : 'completed'} · {managerOverview.housekeepingInProgress}{' '}
              {language === 'am' ? 'በሂደት ላይ' : 'in progress'} · {managerOverview.housekeepingPending}{' '}
              {language === 'am' ? 'በመጠባበቅ ላይ' : 'pending'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {dailyReport?.cleanRooms ?? 0} {language === 'am' ? 'ንጹህ ክፍሎች' : 'clean rooms ready'}
          </div>
        </div>

        {/* 3. Maintenance Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{language === 'am' ? '3. ሚንተናስ (ጥገና)' : '3. Maintenance Progress'}</span>
            <button
              type="button"
              onClick={() => setActivePortal('maintenance')}
              className="text-amber-700 hover:text-amber-800"
            >
              {language === 'am' ? 'ክፈት →' : 'Open →'}
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-3 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-amber-700">
              {managerOverview.maintenancePending + managerOverview.maintenanceInProgress}
            </span>
            <span className="text-xs text-slate-500">
              {language === 'am' ? 'ንቁ ጥገና' : 'active'} · {managerOverview.maintenanceCompleted}{' '}
              {language === 'am' ? 'ተጠናቋል' : 'completed'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {dailyReport?.outOfOrderRooms ?? 0} {language === 'am' ? 'ከአገልግሎት ውጭ ክፍሎች' : 'out of order rooms'}
          </div>
        </div>
      </section>

      {/* Live Cross-Department Task & Report Tracker */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am'
                ? 'የሪሴፕሽን፣ ሃውስ ኪፒንግ እና ሚንተናስ የተግባር ክትትል'
                : 'Live Cross-Department Task Pipeline'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ሪሴፕሽን የላካቸውን ሪፖርቶች እና የክፍሎቹን ማጠናቀቂያ በአንድ ቦታ ይከታተሉ'
                : 'Monitor every Reception report, Housekeeping completion, and Maintenance repair end-to-end'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
              {(['all', 'housekeeping', 'maintenance'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeptFilter(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    deptFilter === d ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'all'
                    ? language === 'am'
                      ? 'ሁሉም'
                      : 'All Depts'
                    : d === 'housekeeping'
                      ? 'Housekeeping'
                      : 'Maintenance'}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
              {(['all', 'Pending', 'In Progress', 'Completed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? t.allStatuses : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">{language === 'am' ? 'ክፍል' : 'Room'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ዘርፍ' : 'Department'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'የስራ ሪፖርት' : 'Task & Notes'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ላኪ / ሰሪ' : 'Reported / Handled By'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ሁኔታ' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tasks.map((tsk) => (
                  <tr key={tsk.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {tsk.roomNumber === 'General' ? 'Common' : `Room ${tsk.roomNumber}`}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700 capitalize">
                      {tsk.targetDepartment}
                      {tsk.priority === 'Urgent' && (
                        <span className="ml-2 text-red-700 font-semibold">· Urgent</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tsk.title}</div>
                      {tsk.completionNotes ? (
                        <div className="text-xs text-emerald-700 mt-0.5">{tsk.completionNotes}</div>
                      ) : (
                        tsk.notes && <div className="text-xs text-slate-500 mt-0.5">{tsk.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>From: {tsk.reportedBy}</div>
                      {tsk.completedBy ? (
                        <div className="text-emerald-700">Done: {tsk.completedBy}</div>
                      ) : tsk.acceptedBy ? (
                        <div className="text-amber-700">Active: {tsk.acceptedBy}</div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tsk.status === 'Completed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{language === 'am' ? 'ተጠናቋል' : 'Completed'}</span>
                        </span>
                      ) : tsk.status === 'In Progress' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Wrench className="h-3.5 w-3.5" />
                          <span>{language === 'am' ? 'በስራ ላይ' : 'In Progress'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{language === 'am' ? 'በመጠባበቅ ላይ' : 'Pending'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Latest Cross-Department Audit Stream */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            {language === 'am' ? 'የቅርብ ጊዜ የሰራተኞች እንቅስቃሴ' : 'Latest Department Actions'}
          </h3>
          <button
            type="button"
            onClick={() => setActivePortal('audit')}
            className="text-xs font-medium text-amber-700 hover:text-amber-800"
          >
            {t.navAudit} →
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {auditLogs.slice(0, 6).map((log) => (
            <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-900">{log.staffName}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-700">
                  {language === 'am' ? log.amharicAction : log.action}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
