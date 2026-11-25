import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  History,
  Printer,
  Receipt,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { FbOrder, FbOrderItem, ManualPayment, PaymentMethod } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

function summarizeBillItems(items: FbOrderItem[]): FbOrderItem[] {
  const map = new Map<string, FbOrderItem>();
  for (const item of items) {
    const existing = map.get(item.menuItemId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.lineTotal += item.lineTotal;
    } else {
      map.set(item.menuItemId, { ...item });
    }
  }
  return Array.from(map.values());
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'CBE Transfer', 'Telebirr', 'Awash Bank', 'POS Card Slip'];

type CashierTab = 'orders' | 'payments' | 'activity';

export function CashierPortalPage() {
  const {
    language,
    t,
    activeHotelId,
    activeUser,
    bookings,
    payments,
    fbOrders,
    cashierSummary,
    refreshAll,
    announce,
  } = useHotel();

  const [tab, setTab] = useState<CashierTab>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderMethod, setOrderMethod] = useState<PaymentMethod>('Cash');
  const [orderRef, setOrderRef] = useState<string>('');
  const [orderDiscount, setOrderDiscount] = useState<string>('0');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [freeTableOnSettle, setFreeTableOnSettle] = useState<boolean>(true);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [settlingOrder, setSettlingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Room booking collection form
  const [bookingId, setBookingId] = useState<string>('');
  const [bookingMethod, setBookingMethod] = useState<PaymentMethod>('Cash');
  const [bookingAmount, setBookingAmount] = useState<string>('');
  const [bookingRef, setBookingRef] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [recordingBookingPay, setRecordingBookingPay] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Verification busy id & receipt modal
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<{
    payment: ManualPayment;
    order?: FbOrder | null;
  } | null>(null);

  const openOrders = useMemo(() => {
    const list =
      cashierSummary?.openOrders ??
      fbOrders.filter(
        (o) =>
          o.status !== 'Cancelled' &&
          !o.isPaid &&
          o.settlementMode !== 'Charge to Room' &&
          o.billStatus !== 'Charged to Room'
      );
    return [...list].sort((a, b) => {
      const aReq = a.billStatus === 'Bill Requested' ? 0 : 1;
      const bReq = b.billStatus === 'Bill Requested' ? 0 : 1;
      if (aReq !== bReq) return aReq - bReq;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [cashierSummary, fbOrders]);

  const activeOrder = useMemo(
    () => openOrders.find((o) => o.id === selectedOrderId) || openOrders[0] || null,
    [openOrders, selectedOrderId]
  );

  const pendingPayments = useMemo(
    () =>
      cashierSummary?.pendingPayments ??
      payments.filter((p) => p.verificationStatus === 'Pending Cashier'),
    [cashierSummary, payments]
  );

  const payableBookings = useMemo(
    () => bookings.filter((b) => b.paidAmount < b.totalAmount),
    [bookings]
  );

  const selectedBooking = useMemo(
    () => payableBookings.find((b) => b.id === bookingId) || payableBookings[0] || null,
    [payableBookings, bookingId]
  );

  const recentLogs = cashierSummary?.recentCashierLogs ?? [];

  const discountNum = Math.max(0, Number(orderDiscount) || 0);
  const netOrderTotal = activeOrder ? Math.max(1, activeOrder.totalAmount - discountNum) : 0;
  const tenderedNum = Number(cashTendered) || 0;
  const changeAmount = orderMethod === 'Cash' && tenderedNum > netOrderTotal ? tenderedNum - netOrderTotal : 0;

  const handleSettleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setOrderError(null);
    setSettlingOrder(true);
    try {
      const res = await hotelApi.settleOrderAsCashier(activeHotelId, activeOrder.id, {
        paymentMethod: orderMethod,
        referenceNumber: orderRef,
        discountAmount: discountNum,
        freeTable: freeTableOnSettle,
        notes: orderNotes,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Cashier settled ${res.order.tableOrLocation} (${res.payment.amount.toLocaleString()} Birr via ${res.payment.method}).`,
        `ካሸር የ${res.order.tableOrLocation} ሂሳብ (${res.payment.amount.toLocaleString()} ብር) በ${res.payment.method} አወራርደዋል።`,
        'success'
      );
      setOrderRef('');
      setOrderDiscount('0');
      setCashTendered('');
      setOrderNotes('');
      setSelectedOrderId('');
      setReceiptModal({ payment: res.payment, order: res.order });
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Unable to settle order bill');
    } finally {
      setSettlingOrder(false);
    }
  };

  const handleVerifySlip = async (payment: ManualPayment) => {
    setVerifyingId(payment.id);
    try {
      const verified = await hotelApi.verifyManualPayment(activeHotelId, payment.id, {
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Verified payment ${verified.referenceNumber} (${verified.amount.toLocaleString()} Birr).`,
        `የ${verified.referenceNumber} ደረሰኝ (${verified.amount.toLocaleString()} ብር) በካሸር ተረጋግጧል።`,
        'success'
      );
    } finally {
      setVerifyingId(null);
    }
  };

  const handleBookingPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setBookingError(null);
    setRecordingBookingPay(true);
    try {
      const res = await hotelApi.recordCashierBookingPayment(activeHotelId, selectedBooking.id, {
        amount: Number(bookingAmount),
        method: bookingMethod,
        referenceNumber: bookingRef,
        notes: bookingNotes,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Collected ${res.payment.amount.toLocaleString()} Birr for Room ${res.payment.roomNumber}.`,
        `ለክፍል ${res.payment.roomNumber} ${res.payment.amount.toLocaleString()} ብር በካሸር ተመዝግቧል።`,
        'success'
      );
      setBookingAmount('');
      setBookingRef('');
      setBookingNotes('');
      setReceiptModal({ payment: res.payment, order: null });
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Unable to record booking payment');
    } finally {
      setRecordingBookingPay(false);
    }
  };

  const openReceiptForPayment = (payment: ManualPayment) => {
    const linkedOrder = payment.orderId ? fbOrders.find((o) => o.id === payment.orderId) || null : null;
    setReceiptModal({ payment, order: linkedOrder });
  };

  return (
    <div className="space-y-6">
      {/* KPI Shift Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ጠቅላላ የተሰበሰበ ገቢ' : 'Cashier Shift Total Collected'}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {(cashierSummary?.totalCollected ?? 0).toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Cash: {(cashierSummary?.cashCollected ?? 0).toLocaleString()} · Bank:{' '}
            {(cashierSummary?.bankTransferCollected ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ክፍት የጠረጴዛ / የትዕዛዝ ሂሳቦች' : 'Open Order Bills'}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {openOrders.length}{' '}
            <span className="text-sm font-medium text-slate-500">
              ({(cashierSummary?.openOrdersTotal ?? 0).toLocaleString()} {t.currency})
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {cashierSummary?.billRequestedCount ?? 0}{' '}
            {language === 'am' ? 'ሂሳብ የተጠየቀባቸው (Bill Requested)' : 'bills requested by Waiter'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የካሸር ማረጋገጫ የሚጠብቁ ደረሰኞች' : 'Pending Slip Verification'}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {pendingPayments.length}{' '}
            <span className="text-sm font-medium text-slate-500">
              ({(cashierSummary?.pendingVerificationTotal ?? 0).toLocaleString()} {t.currency})
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {language === 'am' ? 'ከሪሴፕሽን / አስተናጋጅ የገቡ' : 'Submitted by Reception / Waiter'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ያልተከፈለ የክፍሎች ቀሪ ሂሳብ' : 'Room Folio Outstanding'}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {(cashierSummary?.outstandingBookingBalance ?? 0).toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Telebirr: {(cashierSummary?.telebirrCollected ?? 0).toLocaleString()} · POS:{' '}
            {(cashierSummary?.posCardCollected ?? 0).toLocaleString()}
          </div>
        </div>
      </section>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'orders' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>
              {language === 'am' ? '1. የትዕዛዝ ሂሳብ መዝጊያ (Order Bills)' : '1. Order Bills Queue'} (
              {openOrders.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('payments')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'payments' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              {language === 'am' ? '2. የደረሰኝ ማረጋገጫ እና ክፍል ሂሳብ' : '2. Slip Verification & Rooms'} (
              {pendingPayments.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'activity' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>
              {language === 'am' ? '3. የተረጋገጡ ደረሰኞች እና ኦዲት ሎግ' : '3. Receipts Ledger & ActivityLog'}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums px-2">
          {language === 'am' ? 'ካሸር፡ ' : 'Cashier: '}
          <span className="font-semibold text-slate-900">
            {activeUser ? (language === 'am' ? activeUser.amharicName : activeUser.name) : ''}
          </span>
        </div>
      </div>

      {/* TAB 1: ORDER BILLS SETTLEMENT */}
      {tab === 'orders' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Open Order Bills List */}
          <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'ክፍያ የሚጠብቁ የጠረጴዛ እና የምግብ/መጠጥ ትዕዛዞች'
                    : 'Open Restaurant, Bar & Room Service Bills'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'ከአስተናጋጅ (Waiter) ሂሳብ የተጠየቀባቸው ትዕዛዞች ቅድሚያ ይታያሉ'
                    : 'Select an order to collect payment, verify receipt, and update Table + ActivityLog'}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                {openOrders.length} {language === 'am' ? 'ክፍት' : 'open'}
              </span>
            </div>

            {openOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {language === 'am'
                  ? 'ሁሉም የምግብ እና የመጠጥ ትዕዛዝ ሂሳቦች ተዘግተዋል።'
                  : 'All table and F&B order bills are currently settled.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {openOrders.map((ord) => {
                  const isSelected = activeOrder?.id === ord.id;
                  const billRequested = ord.billStatus === 'Bill Requested';
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-left p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-slate-950">{ord.tableOrLocation}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-slate-700">{ord.guestName}</span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`font-semibold ${
                              billRequested ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            {billRequested
                              ? language === 'am'
                                ? 'ሂሳብ ተጠይቋል (Bill Requested)'
                                : 'Bill Requested'
                              : ord.billStatus || 'Open Tab'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 truncate">
                          {summarizeBillItems(ord.items)
                            .map((i) => `${i.quantity}x ${i.name}`)
                            .join(' · ')}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>ID: {ord.id}</span>
                          {(ord.roundCount || 1) > 1 && (
                            <span className="font-semibold text-amber-700">
                              {ord.roundCount} rounds (1 bill)
                            </span>
                          )}
                          <span>Waiter: {ord.takenBy}</span>
                          {ord.kitchenStatus && ord.kitchenStatus !== 'None' && (
                            <span>Kitchen: {ord.kitchenStatus}</span>
                          )}
                          {ord.barStatus && ord.barStatus !== 'None' && <span>Bar: {ord.barStatus}</span>}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                        <div className="font-mono text-base font-bold text-slate-950 tabular-nums">
                          {ord.totalAmount.toLocaleString()} {t.currency}
                        </div>
                        <span className="text-[11px] font-semibold text-amber-700">
                          {isSelected
                            ? language === 'am'
                              ? 'ተመርጧል →'
                              : 'Selected →'
                            : language === 'am'
                              ? 'ለመዝጋት ይምረጡ'
                              : 'Select to Settle'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Cashier Bill Settlement Terminal */}
          <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'የትዕዛዝ ሂሳብ መዝጊያ እና ደረሰኝ' : 'Settle Order Bill & Issue Receipt'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ክፍያው ሲረጋገጥ Order፣ ManualPayment እና ActivityLog በራስ-ሰር ይዘመናሉ'
                : 'Atomically updates Order status, creates Verified ManualPayment, and writes Cashier ActivityLog'}
            </p>

            {orderError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {orderError}
              </div>
            )}

            {!activeOrder ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                {language === 'am'
                  ? 'ሂሳብ ለመዝጋት ከግራ በኩል ያለውን ትዕዛዝ ይምረጡ።'
                  : 'Select an open order from the queue to settle payment.'}
              </div>
            ) : (
              <form onSubmit={handleSettleOrder} className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{activeOrder.tableOrLocation}</span>
                    <span className="font-mono text-slate-500">{activeOrder.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{activeOrder.guestName}</span>
                    {(activeOrder.roundCount || 1) > 1 && (
                      <span className="font-mono font-semibold text-amber-700">
                        {activeOrder.roundCount} {language === 'am' ? 'ዙሮች (የተጠቃለለ ቢል)' : 'rounds consolidated'}
                      </span>
                    )}
                  </div>
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    {summarizeBillItems(activeOrder.items).map((item) => (
                      <div key={item.menuItemId} className="flex justify-between text-xs">
                        <span className="text-slate-700">
                          {item.quantity}x {language === 'am' ? item.amharicName : item.name}
                        </span>
                        <span className="font-mono text-slate-900 tabular-nums">
                          {item.lineTotal.toLocaleString()} {t.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      {language === 'am' ? 'የሚከፈል ጠቅላላ ሂሳብ' : 'Net Payable Total'}
                    </span>
                    <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                      {netOrderTotal.toLocaleString()} {t.currency}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t.paymentMethod}
                    </label>
                    <select
                      value={orderMethod}
                      onChange={(e) => setOrderMethod(e.target.value as PaymentMethod)}
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {language === 'am' ? 'ቅናሽ (ብር)' : 'Discount (ETB)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, activeOrder.totalAmount - 1)}
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                </div>

                {orderMethod === 'Cash' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {language === 'am' ? 'የተሰጠ ጥሬ ገንዘብ' : 'Cash Tendered'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={String(netOrderTotal)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1">
                        {language === 'am' ? 'መልስ (Change)' : 'Change Due'}
                      </span>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono font-bold text-slate-900 tabular-nums">
                        {changeAmount.toLocaleString()} {t.currency}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.receiptRef}
                  </label>
                  <input
                    type="text"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder={orderMethod === 'Cash' ? 'CSH-... (Auto if blank)' : 'FT263... / TLB-...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.notes}
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder={language === 'am' ? 'የካሸር ማስታወሻ...' : 'Optional cashier note...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>

                {activeOrder.tableId && (
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeTableOnSettle}
                      onChange={(e) => setFreeTableOnSettle(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                    />
                    <span>
                      {language === 'am'
                        ? 'ክፍያው ሲጠናቀቅ ጠረጴዛውን ክፍት (Available) አድርግ'
                        : 'Mark dining table Available immediately upon settlement'}
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={settlingOrder}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  <span>
                    {settlingOrder
                      ? '...'
                      : language === 'am'
                        ? `ሂሳብ ዝጋ እና ደረሰኝ ስጥ (${netOrderTotal.toLocaleString()} ብር)`
                        : `Settle Bill (${netOrderTotal.toLocaleString()} ETB)`}
                  </span>
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: PENDING SLIP VERIFICATION & ROOM BALANCES */}
      {tab === 'payments' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Pending Verification Slips */}
          <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'የካሸር ማረጋገጫ የሚጠብቁ ደረሰኞች (Pending Cashier)'
                    : 'Manual Payments Pending Cashier Verification'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'በሪሴፕሽን ወይም በአስተናጋጅ የተመዘገቡ የባንክ/ቴሌብር ደረሰኞችን ያረጋግጡ'
                    : 'Verify bank transfers, Telebirr SMS receipts, or cash slips submitted by staff'}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                {pendingPayments.length} {language === 'am' ? 'በመጠባበቅ ላይ' : 'pending'}
              </span>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {language === 'am'
                  ? 'ሁሉም የገቡ ደረሰኞች በካሸር ተረጋግጠዋል።'
                  : 'All submitted manual payment receipts have been verified.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-950">{p.guestName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-700">{p.tableOrLocation || `Room ${p.roomNumber}`}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-amber-700 font-medium">{p.sourceType || 'Room Booking'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>{p.method}</span>
                        <span className="font-mono font-semibold text-slate-900">{p.referenceNumber}</span>
                        <span>
                          {language === 'am' ? 'መዝጋቢ፡' : 'Submitted by:'} {p.receivedBy}
                        </span>
                      </div>
                      {p.notes && <div className="text-xs text-slate-500">{p.notes}</div>}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                          {p.amount.toLocaleString()} {t.currency}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={verifyingId === p.id}
                        onClick={() => handleVerifySlip(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                      >
                        <BadgeCheck className="h-3.5 w-3.5 text-amber-400" />
                        <span>
                          {verifyingId === p.id
                            ? '...'
                            : language === 'am'
                              ? 'አረጋግጥ (Verify)'
                              : 'Verify Slip'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Direct Room Folio Payment Form */}
          <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'የክፍል ቀሪ ሂሳብ መቀበያ (Room Folio)' : 'Collect Room Booking Balance'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ካሸር በቀጥታ የክፍል ሂሳብ ሲቀበል በራስ-ሰር የተረጋገጠ (Verified) ይሆናል'
                : 'Payments collected directly by Cashier are automatically marked Verified'}
            </p>

            {bookingError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {bookingError}
              </div>
            )}

            {payableBookings.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                {language === 'am' ? 'ያልተከፈለ የክፍል ቀሪ ሂሳብ የለም።' : 'No unpaid room balances found.'}
              </div>
            ) : (
              <form onSubmit={handleBookingPayment} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.selectBooking}
                  </label>
                  <select
                    value={selectedBooking?.id || ''}
                    onChange={(e) => setBookingId(e.target.value)}
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
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {Math.max(0, selectedBooking.totalAmount - selectedBooking.paidAmount).toLocaleString()}{' '}
                      {t.currency}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.paymentMethod}
                  </label>
                  <select
                    value={bookingMethod}
                    onChange={(e) => setBookingMethod(e.target.value as PaymentMethod)}
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
                    <label className="block text-xs font-medium text-slate-700">{t.amountEtb}</label>
                    {selectedBooking && (
                      <button
                        type="button"
                        onClick={() =>
                          setBookingAmount(
                            String(Math.max(0, selectedBooking.totalAmount - selectedBooking.paidAmount))
                          )
                        }
                        className="text-xs font-medium text-amber-700 hover:text-amber-800"
                      >
                        {t.fillBalance}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bookingAmount}
                    onChange={(e) => setBookingAmount(e.target.value)}
                    placeholder="e.g. 4800"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.receiptRef}</label>
                  <input
                    type="text"
                    required
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    placeholder="CSH-... / FT263... / TLB-..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.notes}</label>
                  <input
                    type="text"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder={language === 'am' ? 'ማስታወሻ...' : 'Payment slip note...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={recordingBookingPay}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4 text-amber-400" />
                  <span>{recordingBookingPay ? '...' : t.submitPayment}</span>
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: RECEIPTS LEDGER & CASHIER ACTIVITY LOG */}
      {tab === 'activity' && (
        <div className="space-y-6">
          {/* Unified Payment Ledger */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'የካሸር እና ማኑዋል ክፍያዎች መዝገብ (ManualPayment)'
                    : 'Unified ManualPayment Ledger (Rooms & Orders)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'የእያንዳንዱ ክፍያ ምንጭ (ክፍል / ትዕዛዝ)፣ ተቀባይ እና የካሸር ማረጋገጫ ሁኔታ'
                    : 'Shows payment source (Room vs. Order), staff receiver, Cashier verification status, and linked Order ID'}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {payments.length} {language === 'am' ? 'መዝገቦች' : 'entries'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">{language === 'am' ? 'ሰዓት' : 'Time'}</th>
                    <th className="py-3 px-4">{language === 'am' ? 'ምንጭ እና እንግዳ' : 'Source & Guest'}</th>
                    <th className="py-3 px-4">{language === 'am' ? 'ዘዴ / ደረሰኝ' : 'Method & Ref'}</th>
                    <th className="py-3 px-4">{language === 'am' ? 'ማረጋገጫ' : 'Cashier Status'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'መጠን' : 'Amount'}</th>
                    <th className="py-3 px-4 text-right">{t.viewReceipt}</th>
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
                            {p.sourceType || 'Room Booking'} · {p.tableOrLocation || `Room ${p.roomNumber}`}
                            {p.orderId ? ` · Order ${p.orderId}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-900">{p.method}</div>
                          <div className="font-mono text-xs text-slate-500">{p.referenceNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {isVerified ? (
                            <div className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{p.verifiedBy ? `Verified (${p.verifiedBy})` : 'Verified'}</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              {language === 'am' ? 'የካሸር ማረጋገጫ ይጠብቃል' : 'Pending Cashier'}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-500">Rec: {p.receivedBy}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                          {p.amount.toLocaleString()} {t.currency}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openReceiptForPayment(p)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
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
          </section>

          {/* Cashier & Order ActivityLog Feed */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'የካሸር እና የትዕዛዝ እንቅስቃሴ ሎግ (ActivityLog)'
                    : 'Cashier, Order & Payment ActivityLog'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'እያንዳንዱ የትዕዛዝ ሂሳብ መዝጊያ፣ የደረሰኝ ማረጋገጫ እና የገንዘብ መጠን በሰዓት የተመዘገበ'
                    : 'Every order bill request, Cashier settlement, and receipt verification with amount & target reference'}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {recentLogs.length} {language === 'am' ? 'ሎጎች' : 'logs'}
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentLogs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-amber-700">{log.portal}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-medium text-slate-800">{log.staffName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {language === 'am' ? log.amharicAction : log.action}
                      </div>
                      <div className="text-xs text-slate-500">
                        {log.details}
                        {log.orderId ? ` · Order: ${log.orderId}` : ''}
                        {log.paymentId ? ` · Payment: ${log.paymentId}` : ''}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {typeof log.amount === 'number' && (
                        <div className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                          {log.amount.toLocaleString()} {t.currency}
                        </div>
                      )}
                      <div className="font-mono text-xs text-slate-500">
                        {log.paymentMethod ? `${log.paymentMethod} · ` : ''}
                        {log.targetRef}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Official Receipt Modal (Supports both Order & Room Booking Receipts) */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-950">{t.brand}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am' ? 'ይፋዊ የካሸር ክፍያ ደረሰኝ' : 'Official Cashier Payment Receipt'}
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
                <span className="font-mono font-semibold text-slate-900">
                  {receiptModal.payment.referenceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ምንጭ' : 'Source'}</span>
                <span className="text-slate-900">
                  {receiptModal.payment.sourceType || 'Room Booking'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'እንግዳ' : 'Guest'}</span>
                <span className="font-medium text-slate-900">{receiptModal.payment.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ቦታ / ክፍል' : 'Room / Table'}</span>
                <span className="font-mono text-slate-900">
                  {receiptModal.payment.tableOrLocation || `Room ${receiptModal.payment.roomNumber}`}
                </span>
              </div>

              {receiptModal.order && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
                  <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>
                      {language === 'am' ? 'የትዕዛዝ ዝርዝር' : 'Consolidated Order Bill'} ({receiptModal.order.id})
                    </span>
                    {(receiptModal.order.roundCount || 1) > 1 && (
                      <span className="font-mono text-[11px] text-amber-700">
                        {receiptModal.order.roundCount} {language === 'am' ? 'ዙሮች' : 'rounds'}
                      </span>
                    )}
                  </div>
                  {summarizeBillItems(receiptModal.order.items).map((item) => (
                    <div key={item.menuItemId} className="flex justify-between">
                      <span className="text-slate-700">
                        {item.quantity}x {language === 'am' ? item.amharicName : item.name}
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {item.lineTotal.toLocaleString()} {t.currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">{t.paymentMethod}</span>
                <span className="text-slate-900">{receiptModal.payment.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ተቀባይ' : 'Received By'}</span>
                <span className="text-slate-900">{receiptModal.payment.receivedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ያረጋገጠው ካሸር' : 'Verified By'}</span>
                <span className="font-medium text-emerald-700">
                  {receiptModal.payment.verifiedBy || 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'am' ? 'ቀን እና ሰዓት' : 'Date & Time'}</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {new Date(receiptModal.payment.recordedAt).toLocaleString()}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <span className="font-medium text-slate-900">
                  {language === 'am' ? 'የተከፈለ መጠን' : 'Amount Verified'}
                </span>
                <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                  {receiptModal.payment.amount.toLocaleString()} {t.currency}
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
                className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
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
