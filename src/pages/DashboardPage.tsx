import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useHotel } from '../context/VoiceContext';

export function DashboardPage() {
  const {
    language,
    t,
    rooms,
    dailyReport,
    auditLogs,
    maintenance,
    loading,
    error,
    setActivePortal,
    setSelectedRoomIdForCheckIn,
    setSelectedBookingIdForPayment,
  } = useHotel();

  const [floorFilter, setFloorFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'occupied' | 'dirty' | 'ooo'>('all');

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (floorFilter !== 'all' && r.floor !== floorFilter) return false;
      if (statusFilter === 'ready') return r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean';
      if (statusFilter === 'occupied') return r.occupancyStatus === 'Occupied';
      if (statusFilter === 'dirty') return r.cleaningStatus !== 'Clean';
      if (statusFilter === 'ooo') return r.occupancyStatus === 'Out of Order';
      return true;
    });
  }, [rooms, floorFilter, statusFilter]);

  const occupiedCount = rooms.filter((r) => r.occupancyStatus === 'Occupied').length;
  const readyCount = rooms.filter((r) => r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean').length;
  const dirtyCount = rooms.filter((r) => r.cleaningStatus !== 'Clean').length;
  const openMaintenanceCount = maintenance.filter((m) => m.status !== 'Resolved').length;

  if (loading && rooms.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse p-5" />
          ))}
        </div>
        <div className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Column Operational KPI Strip */}
      <section aria-label="Key Hotel Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.kpiOccupancy}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {occupiedCount} / {rooms.length}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {rooms.length > 0 ? Math.round((occupiedCount / rooms.length) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {readyCount} {language === 'am' ? 'ክፍት እና ንጹህ' : 'ready for check-in'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.kpiDirty}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-amber-700 tabular-nums">
              {dirtyCount}
            </span>
            <button
              type="button"
              onClick={() => setActivePortal('housekeeping')}
              className="text-xs font-medium text-slate-700 hover:text-amber-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>{t.navHousekeeping}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {rooms.filter((r) => r.cleaningStatus === 'Inspecting').length}{' '}
            {language === 'am' ? 'በምርመራ ላይ' : 'awaiting inspection'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.kpiMaintenance}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {openMaintenanceCount}
            </span>
            <button
              type="button"
              onClick={() => setActivePortal('maintenance')}
              className="text-xs font-medium text-slate-700 hover:text-amber-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>{t.navMaintenance}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {rooms.filter((r) => r.occupancyStatus === 'Out of Order').length}{' '}
            {language === 'am' ? 'ከአገልግሎት ውጭ ክፍሎች' : 'rooms out of order'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.kpiRevenue}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
              {(dailyReport?.totalCollected ?? 0).toLocaleString()} {t.currency}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {t.kpiOutstanding}: {(dailyReport?.outstandingBalance ?? 0).toLocaleString()} {t.currency}
          </div>
        </div>
      </section>

      {/* Main Two-Column Grid: Room Matrix + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Room Matrix (2/3 width) */}
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'የሁሉም ክፍሎች ቀጥታ ሁኔታ' : 'Live Room Operations Matrix'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'am'
                  ? 'ክፍል በመምረጥ እንግዳ ማስገባት፣ ክፍያ መመዝገብ ወይም የጽዳት ሁኔታ መቀየር ይችላሉ'
                  : 'Select any room to launch check-in, payment verification, or housekeeping'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                {(['all', 1, 2, 3] as const).map((fl) => (
                  <button
                    key={String(fl)}
                    type="button"
                    onClick={() => setFloorFilter(fl)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      floorFilter === fl ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {fl === 'all' ? t.allFloors : `${t.floor} ${fl}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Segmented Status Filter */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-2.5 bg-slate-50/70">
            {(
              [
                { key: 'all', label: t.allStatuses },
                { key: 'ready', label: t.kpiReady },
                { key: 'occupied', label: t.occupied },
                { key: 'dirty', label: t.kpiDirty },
                { key: 'ooo', label: t.outOfOrder },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Room Cards Grid */}
          {filteredRooms.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200">
              {filteredRooms.map((room) => {
                const isReady = room.occupancyStatus === 'Available' && room.cleaningStatus === 'Clean';
                const isOccupied = room.occupancyStatus === 'Occupied';
                const isOOO = room.occupancyStatus === 'Out of Order';

                return (
                  <div key={room.id} className="bg-white p-4 flex flex-col justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                          {room.roomNumber}
                        </span>
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          {room.ratePerNight.toLocaleString()} {t.currency}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <span>{room.type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.floor} {room.floor}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                        {isOOO ? (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>{t.outOfOrder}</span>
                          </span>
                        ) : isOccupied ? (
                          <span className="inline-flex items-center gap-1 text-slate-900">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span>{t.occupied}</span>
                          </span>
                        ) : isReady ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t.clean}</span>
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            {room.cleaningStatus === 'Dirty' ? t.dirty : t.inspecting}
                          </span>
                        )}

                        {!isOOO && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="text-slate-500">
                              {room.cleaningStatus === 'Clean'
                                ? t.clean
                                : room.cleaningStatus === 'Dirty'
                                  ? t.dirty
                                  : t.inspecting}
                            </span>
                          </>
                        )}
                      </div>

                      {room.activeBooking ? (
                        <div className="mt-2 text-xs text-slate-700 truncate">
                          {room.activeBooking.guestName} ·{' '}
                          <span className="font-mono tabular-nums">
                            {room.activeBooking.paidAmount.toLocaleString()}/{room.activeBooking.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-400 truncate">
                          {room.housekeepingNotes || '—'}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isReady ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomIdForCheckIn(room.id);
                            setActivePortal('reception');
                          }}
                          className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap shrink-0"
                        >
                          {language === 'am' ? 'እንግዳ አስገባ →' : 'Check In Guest →'}
                        </button>
                      ) : isOccupied && room.activeBooking ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingIdForPayment(room.activeBooking!.id);
                            setActivePortal('payments');
                          }}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
                        >
                          {language === 'am' ? 'ክፍያ / ሂሳብ →' : 'Verify Payment →'}
                        </button>
                      ) : isOOO ? (
                        <button
                          type="button"
                          onClick={() => setActivePortal('maintenance')}
                          className="text-xs font-medium text-red-700 hover:text-red-800 whitespace-nowrap shrink-0"
                        >
                          {language === 'am' ? 'ጥገና ይመልከቱ →' : 'View Ticket →'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePortal('housekeeping')}
                          className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap shrink-0"
                        >
                          {language === 'am' ? 'ጽዳት አስተካክል →' : 'Update Cleaning →'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Audit Trail (1/3 width) */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'የቅርብ ጊዜ እንቅስቃሴዎች' : 'Recent Staff Activity'}
            </h2>
            <button
              type="button"
              onClick={() => setActivePortal('audit')}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap shrink-0"
            >
              {language === 'am' ? 'ሁሉንም ይመልከቱ' : 'Full Log'}
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 7).map((log) => (
              <div key={log.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{log.staffName}</span>
                  <span className="font-mono tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-900 leading-snug">
                  {language === 'am' ? log.amharicAction : log.action}
                </p>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {log.portal} · {log.targetRef}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
