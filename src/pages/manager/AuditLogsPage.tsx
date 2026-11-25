import { useMemo, useState } from 'react';
import { useHotel } from '../../context/VoiceContext';
import type { ActivityPortal } from '../../types/hotel';

const PORTALS: ('All' | ActivityPortal)[] = [
  'All',
  'Reception',
  'Cashier',
  'Payment',
  'Waiter',
  'Kitchen',
  'Bar',
  'F&B',
  'Rooms',
  'Housekeeping',
  'Maintenance',
];

export function AuditLogsPage() {
  const { language, t, auditLogs, users } = useHotel();
  const [portalFilter, setPortalFilter] = useState<'All' | ActivityPortal>('All');
  const [staffFilter, setStaffFilter] = useState<string>('All');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      if (portalFilter !== 'All' && l.portal !== portalFilter) return false;
      if (staffFilter !== 'All' && l.staffId !== staffFilter) return false;
      return true;
    });
  }, [auditLogs, portalFilter, staffFilter]);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {PORTALS.map((portal) => (
            <button
              key={portal}
              type="button"
              onClick={() => setPortalFilter(portal)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                portalFilter === portal ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {portal === 'All' ? t.allPortals : portal}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="audit-staff" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            {t.allStaff}:
          </label>
          <select
            id="audit-staff"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-amber-600 focus:outline-none"
          >
            <option value="All">{t.allStaff}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {language === 'am' ? u.amharicName : u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chronological Hourly Audit Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">{t.auditTrail}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ሰራተኞች የሰሩት እያንዳንዱ ተግባር በሰዓት እና በስም ይመዘገባል'
                : 'Timestamped, tamper-evident log of every check-in, payment, cleaning update, and repair'}
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {filteredLogs.length} {language === 'am' ? 'መዝገቦች' : 'entries'}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">{language === 'am' ? 'ሰዓት' : 'Timestamp'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ሰራተኛ' : 'Staff Operator'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ክፍል' : 'Portal'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ተግባር' : 'Action'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ማጣቀሻ' : 'Target'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 text-xs">{log.staffName}</div>
                      <div className="text-xs text-slate-500 capitalize">{log.staffRole}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{log.portal}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900 text-sm">
                        {language === 'am' ? log.amharicAction : log.action}
                      </div>
                      {log.details && <div className="text-xs text-slate-500 mt-0.5">{log.details}</div>}
                      {(log.amount !== undefined || log.paymentMethod || log.orderId || log.paymentId) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                          {log.amount !== undefined && (
                            <span className="font-semibold text-emerald-700">
                              {log.amount.toLocaleString()} {t.currency}
                            </span>
                          )}
                          {log.paymentMethod && <span>{log.paymentMethod}</span>}
                          {log.orderId && <span>Order: {log.orderId}</span>}
                          {log.paymentId && <span>Pay: {log.paymentId}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {log.targetRef}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
