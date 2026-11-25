import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { ManualPayment, PaymentMethod } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'CBE Transfer', 'Telebirr', 'Awash Bank', 'POS Card Slip'];

export function ManualPaymentPage() {
  const {
    language,
    t,
    activeHotelId,
    bookings,
    payments,
    activeUser,
    selectedBookingIdForPayment,
    setSelectedBookingIdForPayment,
    refreshAll,
    announce,
  } = useHotel();

  const payableBookings = bookings.filter(
    (b) => b.bookingStatus === 'Checked In' || b.paidAmount < b.totalAmount
  );

  const [bookingId, setBookingId] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('CBE Transfer');
  const [amount, setAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<ManualPayment | null>(null);

  useEffect(() => {
    if (selectedBookingIdForPayment) {
      setBookingId(selectedBookingIdForPayment);
      const target = bookings.find((b) => b.id === selectedBookingIdForPayment);
      if (target) {
        const rem = Math.max(0, target.totalAmount - target.paidAmount);
        setAmount(rem > 0 ? String(rem) : '');
      }
      setSelectedBookingIdForPayment(null);
    } else if (!bookingId && payableBookings.length > 0) {
      setBookingId(payableBookings[0].id);
    }
  }, [selectedBookingIdForPayment, bookings, payableBookings, bookingId, setSelectedBookingIdForPayment]);

  const selectedBooking = bookings.find((b) => b.id === bookingId);
  const remainingBalance = selectedBooking
    ? Math.max(0, selectedBooking.totalAmount - selectedBooking.paidAmount)
    : 0;

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await hotelApi.recordManualPayment(activeHotelId, {
        bookingId,
        amount: Number(amount),
        method,
        referenceNumber,
        notes,
        staffId: activeUser?.id || '',
      });

      await refreshAll();
      announce(
        `Verified ${res.payment.amount.toLocaleString()} Birr payment via ${res.payment.method} for Room ${res.payment.roomNumber}.`,
        `ለክፍል ${res.payment.roomNumber} የ${res.payment.amount.toLocaleString()} ብር ክፍያ በ${res.payment.method} ተረጋግጧል።`,
        'success'
      );

      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setReceiptModal(res.payment);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Record Manual Payment (5 cols) */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">{t.recordPayment}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'am'
            ? 'የባንክ ደረሰኝ፣ ቴሌብር ወይም የጥሬ ገንዘብ ክፍያን ያረጋግጡ'
            : 'Verify Cash, CBE/Awash Bank slips, Telebirr SMS, or POS receipts'}
        </p>

        {formError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="pay-booking" className="block text-xs font-medium text-slate-700 mb-1">
              {t.selectBooking}
            </label>
            <select
              id="pay-booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            >
              {payableBookings.map((b) => {
                const rem = Math.max(0, b.totalAmount - b.paidAmount);
                return (
                  <option key={b.id} value={b.id}>
                    Room {b.roomNumber} · {b.guestName} · Bal: {rem.toLocaleString()} {t.currency}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedBooking && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                {language === 'am' ? 'ቀሪ ሂሳብ' : 'Remaining Balance'}
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {remainingBalance.toLocaleString()} {t.currency}
              </span>
            </div>
          )}

          <div>
            <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700 mb-1">
              {t.paymentMethod}
            </label>
            <select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-700">
                {t.amountEtb}
              </label>
              {remainingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingBalance))}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  {t.fillBalance}
                </button>
              )}
            </div>
            <input
              id="pay-amount"
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5100"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="pay-ref" className="block text-xs font-medium text-slate-700 mb-1">
              {t.receiptRef}
            </label>
            <input
              id="pay-ref"
              type="text"
              required
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="FT26318CBE... / TLB-... / CSH-..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="pay-notes" className="block text-xs font-medium text-slate-700 mb-1">
              {t.notes}
            </label>
            <input
              id="pay-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'am' ? 'የደረሰኝ ማረጋገጫ ማስታወሻ...' : 'Verified transfer screenshot or cash drawer slip'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !bookingId}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : t.submitPayment}
          </button>
        </form>
      </section>

      {/* Right: Verified Payment Ledger (7 cols) */}
      <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">{t.paymentLedger}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {payments.length} {language === 'am' ? 'ደረሰኞች' : 'verified transactions'}
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">{language === 'am' ? 'ሰዓት' : 'Time'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ምንጭ / እንግዳ' : 'Source & Guest'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'ዘዴ እና ማረጋገጫ' : 'Method & Verification'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'መጠን' : 'Amount'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'ደረሰኝ' : 'Slip'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => {
                  const isVerified = p.verificationStatus !== 'Pending Cashier';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{p.guestName}</div>
                        <div className="text-xs text-slate-500">
                          {p.tableOrLocation || `Room ${p.roomNumber}`}
                          {p.sourceType && (
                            <>
                              <span className="mx-1">·</span>
                              <span className="text-slate-700">{p.sourceType}</span>
                            </>
                          )}
                          {p.orderId && (
                            <>
                              <span className="mx-1">·</span>
                              <span className="font-mono text-slate-600">{p.orderId}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900 text-xs font-medium">{p.method}</div>
                        <div className="font-mono text-xs text-slate-500">{p.referenceNumber}</div>
                        <div
                          className={`mt-0.5 text-[11px] font-semibold ${
                            isVerified ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isVerified
                            ? `${language === 'am' ? 'በካሸር ተረጋግጧል' : 'Verified'}${p.verifiedBy ? ` · ${p.verifiedBy}` : ''}`
                            : language === 'am'
                              ? 'የካሸር ማረጋገጫ ይጠብቃል'
                              : 'Pending Cashier Verification'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                        {p.amount.toLocaleString()} {t.currency}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptModal(p)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                        >
                          {t.viewReceipt}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Receipt Preview Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">{t.brand}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am' ? 'ይፋዊ የክፍያ ማረጋገጫ ደረሰኝ' : 'Official Manual Payment Receipt'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close receipt"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'የደረሰኝ ቁጥር' : 'Reference'}</span>
                <span className="font-mono font-semibold text-slate-900">{receiptModal.referenceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'እንግዳ' : 'Guest'}</span>
                <span className="font-medium text-slate-900">{receiptModal.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ምንጭ እና ቦታ' : 'Source & Location'}</span>
                <span className="font-mono text-slate-900">
                  {receiptModal.sourceType || 'Room Booking'} · {receiptModal.tableOrLocation || `Room ${receiptModal.roomNumber}`}
                </span>
              </div>
              {receiptModal.orderId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === 'am' ? 'የትዕዛዝ መለያ' : 'Order ID'}</span>
                  <span className="font-mono text-slate-900">{receiptModal.orderId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{t.paymentMethod}</span>
                <span className="text-slate-900">{receiptModal.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'መዝጋቢ ሰራተኛ' : 'Recorded By'}</span>
                <span className="text-slate-900">{receiptModal.receivedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'የካሸር ማረጋገጫ' : 'Cashier Status'}</span>
                <span
                  className={`font-semibold ${
                    receiptModal.verificationStatus === 'Pending Cashier' ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {receiptModal.verificationStatus === 'Pending Cashier'
                    ? language === 'am'
                      ? 'በካሸር ያልተረጋገጠ'
                      : 'Pending Cashier'
                    : `${language === 'am' ? 'ተረጋግጧል' : 'Verified'}${receiptModal.verifiedBy ? ` (${receiptModal.verifiedBy})` : ''}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ቀን እና ሰዓት' : 'Date & Time'}</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {new Date(receiptModal.recordedAt).toLocaleString()}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <span className="font-medium text-slate-900">{language === 'am' ? 'የተከፈለ መጠን' : 'Amount Verified'}</span>
                <span className="font-mono text-lg font-semibold text-emerald-700 tabular-nums">
                  {receiptModal.amount.toLocaleString()} {t.currency}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{language === 'am' ? 'አትም' : 'Print'}</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {language === 'am' ? 'ዝጋ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
