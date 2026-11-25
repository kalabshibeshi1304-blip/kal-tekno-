import { Download } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';

export function ReportsPage() {
  const { language, t, dailyReport } = useHotel();

  if (!dailyReport) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        {t.loadingData}
      </div>
    );
  }

  const total = Math.max(1, dailyReport.totalCollected);
  const channels = [
    { label: t.cashDrawer, amount: dailyReport.cashCollected, color: 'bg-emerald-600' },
    { label: t.bankTransfers, amount: dailyReport.bankTransferCollected, color: 'bg-slate-800' },
    { label: t.telebirr, amount: dailyReport.telebirrCollected, color: 'bg-amber-600' },
    { label: t.posSlips, amount: dailyReport.posCardCollected, color: 'bg-slate-500' },
  ];

  const handleExportCsv = () => {
    const header = ['Payment ID', 'Recorded At', 'Room', 'Guest Name', 'Method', 'Reference', 'Amount (ETB)', 'Verified By'];
    const rows = dailyReport.payments.map((p) => [
      p.id,
      p.recordedAt,
      p.roomNumber,
      `"${p.guestName.replace(/"/g, '""')}"`,
      p.method,
      p.referenceNumber,
      String(p.amount),
      `"${p.receivedBy.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kal-tekno-daily-revenue-${dailyReport.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            {language === 'am' ? 'ዕለታዊ የካሽ እና ማኑዋል የባንክ ዝውውር ሪፖርት' : 'Daily Revenue & Payment Channel Summary'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {dailyReport.date} · {dailyReport.payments.length}{' '}
            {language === 'am' ? 'የተረጋገጡ ደረሰኞች' : 'verified receipts'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t.exportCsv}</span>
        </button>
      </div>

      {/* 4 Financial Channel Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.kpiRevenue}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {dailyReport.totalCollected.toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {t.kpiOutstanding}: {dailyReport.outstandingBalance.toLocaleString()} {t.currency}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.cashDrawer}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {dailyReport.cashCollected.toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {Math.round((dailyReport.cashCollected / total) * 100)}% of collected
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.bankTransfers}</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {dailyReport.bankTransferCollected.toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {Math.round((dailyReport.bankTransferCollected / total) * 100)}% of collected
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">{t.telebirr} & POS</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {(dailyReport.telebirrCollected + dailyReport.posCardCollected).toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Telebirr: {dailyReport.telebirrCollected.toLocaleString()} · POS: {dailyReport.posCardCollected.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Payment Channel Mix Bar Breakdown */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {language === 'am' ? 'የክፍያ ዘዴዎች ስርጭት' : 'Collection Breakdown by Channel'}
        </h3>
        <div className="mt-4 space-y-3">
          {channels.map((ch) => {
            const pct = Math.round((ch.amount / total) * 100);
            return (
              <div key={ch.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{ch.label}</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {ch.amount.toLocaleString()} {t.currency} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${ch.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Verified Receipts Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-display text-sm font-semibold text-slate-900">{t.paymentLedger}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">{language === 'am' ? 'ሰዓት' : 'Timestamp'}</th>
                <th className="py-3 px-4">{language === 'am' ? 'ደረሰኝ ቁጥር' : 'Reference'}</th>
                <th className="py-3 px-4">{language === 'am' ? 'ክፍል' : 'Room'}</th>
                <th className="py-3 px-4">{language === 'am' ? 'እንግዳ' : 'Guest'}</th>
                <th className="py-3 px-4">{t.paymentMethod}</th>
                <th className="py-3 px-4">{language === 'am' ? 'ተቀባይ' : 'Received By'}</th>
                <th className="py-3 px-4 text-right">{language === 'am' ? 'መጠን' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {dailyReport.payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(p.recordedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900">{p.referenceNumber}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">{p.roomNumber}</td>
                  <td className="py-3 px-4 text-slate-900">{p.guestName}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">{p.method}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{p.receivedBy}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                    {p.amount.toLocaleString()} {t.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
