import { useMemo, useState } from 'react';
import { BellRing, CheckCircle2, ChefHat, Clock, Flame } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { StationPrepStatus } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

type StatusFilter = 'Active' | 'All' | StationPrepStatus;

export function KitchenDisplayPage() {
  const {
    language,
    t,
    authUser,
    activeHotelId,
    activeUser,
    kitchenOrders,
    refreshAll,
    announce,
  } = useHotel();

  const [filter, setFilter] = useState<StatusFilter>('Active');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canUpdateKitchen =
    authUser?.role === 'kitchen' || authUser?.role === 'manager' || authUser?.isCentralAdmin;

  const filteredTickets = useMemo(() => {
    return kitchenOrders.filter((ord) => {
      const st = (ord.kitchenStatus && ord.kitchenStatus !== 'None' ? ord.kitchenStatus : 'Pending') as StationPrepStatus;
      if (filter === 'All') return true;
      if (filter === 'Active') return st !== 'Served';
      return st === filter;
    });
  }, [kitchenOrders, filter]);

  const counts = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let served = 0;
    for (const ord of kitchenOrders) {
      const st = ord.kitchenStatus || 'Pending';
      if (st === 'Pending') pending += 1;
      else if (st === 'Preparing') preparing += 1;
      else if (st === 'Ready') ready += 1;
      else if (st === 'Served') served += 1;
    }
    return { pending, preparing, ready, served };
  }, [kitchenOrders]);

  const handleUpdateStatus = async (orderId: string, locationLabel: string, nextStatus: StationPrepStatus) => {
    setBusyId(orderId);
    try {
      await hotelApi.updateKitchenOrderStatus(activeHotelId, orderId, {
        kitchenStatus: nextStatus,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      if (nextStatus === 'Preparing') {
        announce(
          `Kitchen started cooking food for ${locationLabel}.`,
          `ኪችን የ${locationLabel} ምግብ ማብሰል ጀምሯል።`,
          'info'
        );
      } else if (nextStatus === 'Ready') {
        announce(
          `Food is ready at Kitchen for ${locationLabel}. Waiter please pick up!`,
          `የ${locationLabel} ምግብ በኪችን ተዘጋጅቷል፤ አስተናጋጅ ይውሰድ!`,
          'success'
        );
      } else if (nextStatus === 'Served') {
        announce(
          `Kitchen ticket ${locationLabel} marked served.`,
          `የ${locationLabel} የምግብ ትዕዛዝ ለእንግዳ ቀርቧል።`,
          'success'
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'አዲስ የመጡ ትዕዛዞች' : 'Pending Tickets'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {counts.pending}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ምግብ ማዘጋጀት ያልተጀመረ' : 'Waiting to start cooking'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'በመበሰል ላይ' : 'Cooking Now'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {counts.preparing}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'በኪችን ስራ ላይ ያሉ' : 'Currently on the line'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ለአስተናጋጅ ዝግጁ' : 'Ready for Pickup'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {counts.ready}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'አስተናጋጅ እንዲወስድ የተጠራ' : 'Waiting on waiter pass'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የቀረቡ ትዕዛዞች' : 'Served Today'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {counts.served}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'የተጠናቀቁ የምግብ ትዕዛዞች' : 'Completed kitchen tickets'}
          </div>
        </div>
      </section>

      {/* Header & Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am'
                ? 'የኪችን (ኩሽና) የምግብ ትዕዛዝ ገጽ'
                : 'Kitchen Display System · Food Orders Only'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'am'
                ? 'አስተናጋጆች ከስተመር ጋር ሆነው የላኳቸው የምግብ ትዕዛዞች ብቻ እዚህ ይታያሉ'
                : 'Automatically receives only food items from unified tableside & room orders'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs">
          {(['Active', 'Pending', 'Preparing', 'Ready', 'Served', 'All'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {!canUpdateKitchen && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
          {language === 'am'
            ? 'ይህ ገጽ በእይታ ብቻ ነው — የምግብ ዝግጅት ሁኔታን መቀየር የሚችሉት የኪችን ሰራተኛ ወይም ማናጀር ብቻ ናቸው።'
            : 'Read-only view — only Kitchen chefs or Managers can update cooking ticket statuses.'}
        </div>
      )}

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          {t.noRecords}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((ticket) => {
            const kStatus = (ticket.kitchenStatus && ticket.kitchenStatus !== 'None'
              ? ticket.kitchenStatus
              : 'Pending') as StationPrepStatus;
            const borderTone =
              kStatus === 'Pending'
                ? 'border-red-300'
                : kStatus === 'Preparing'
                  ? 'border-amber-400'
                  : kStatus === 'Ready'
                    ? 'border-emerald-400'
                    : 'border-slate-200';
            const statusColor =
              kStatus === 'Pending'
                ? 'text-red-700'
                : kStatus === 'Preparing'
                  ? 'text-amber-700'
                  : kStatus === 'Ready'
                    ? 'text-emerald-700'
                    : 'text-slate-600';

            return (
              <article
                key={ticket.id}
                className={`rounded-xl border ${borderTone} bg-white p-5 flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="font-mono text-base font-bold text-slate-900">
                        {ticket.tableOrLocation}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {ticket.channel} · {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: {ticket.takenBy}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-semibold ${statusColor}`}>{kStatus}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 tabular-nums">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Food Items */}
                  <ul className="space-y-2">
                    {ticket.stationItems.map((item, idx) => {
                      const isLatestRound =
                        (ticket.roundCount || 1) > 1 && item.round === ticket.roundCount;
                      return (
                        <li
                          key={`${ticket.id}-${item.menuItemId}-${idx}`}
                          className="flex items-center justify-between text-sm text-slate-900"
                        >
                          <span className="font-medium">
                            <span className="inline-block w-8 font-mono font-bold text-amber-800">
                              {item.quantity}x
                            </span>
                            {language === 'am' ? item.amharicName : item.name}
                          </span>
                          {(ticket.roundCount || 1) > 1 && (
                            <span
                              className={`font-mono text-[11px] ${
                                isLatestRound ? 'font-bold text-red-700' : 'text-slate-400'
                              }`}
                            >
                              R{item.round || 1}
                              {isLatestRound ? (language === 'am' ? ' (አዲስ)' : ' NEW') : ''}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {ticket.notes && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <span className="font-semibold">
                        {language === 'am' ? 'ማስታወሻ፡ ' : 'Note: '}
                      </span>
                      {ticket.notes}
                    </div>
                  )}

                  {ticket.barStatus && ticket.barStatus !== 'None' && (
                    <div className="text-xs text-slate-500">
                      {language === 'am' ? 'ተጓዳኝ የባር መጠጥ ሁኔታ፡ ' : 'Companion Bar Drinks: '}
                      <span className="font-semibold text-slate-700">{ticket.barStatus}</span>
                    </div>
                  )}
                </div>

                {canUpdateKitchen && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {kStatus === 'Pending' && (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() =>
                          void handleUpdateStatus(ticket.id, ticket.tableOrLocation, 'Preparing')
                        }
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        <Flame className="h-3.5 w-3.5" />
                        <span>{language === 'am' ? 'ማብሰል ጀምር' : 'Start Cooking'}</span>
                      </button>
                    )}

                    {kStatus === 'Preparing' && (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() =>
                          void handleUpdateStatus(ticket.id, ticket.tableOrLocation, 'Ready')
                        }
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        <span>{language === 'am' ? 'ተዘጋጅቷል · አስተናጋጅ ጥራ' : 'Food Ready (Alert Waiter)'}</span>
                      </button>
                    )}

                    {kStatus === 'Ready' && (
                      <button
                        type="button"
                        disabled={busyId === ticket.id}
                        onClick={() =>
                          void handleUpdateStatus(ticket.id, ticket.tableOrLocation, 'Served')
                        }
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{language === 'am' ? 'አስተናጋጅ ወስዷል (Served)' : 'Mark Picked Up / Served'}</span>
                      </button>
                    )}

                    {kStatus === 'Served' && (
                      <div className="w-full text-center text-xs font-medium text-emerald-700 py-1">
                        {language === 'am' ? 'ተጠናቋል' : 'Completed'}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
