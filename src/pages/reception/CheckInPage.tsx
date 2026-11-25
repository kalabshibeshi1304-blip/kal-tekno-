import React, { useEffect, useState } from 'react';
import { useHotel } from '../../context/VoiceContext';
import type { PaymentMethod, TaskTargetDepartment } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'CBE Transfer', 'Telebirr', 'Awash Bank', 'POS Card Slip'];

export function CheckInPage() {
  const {
    language,
    t,
    activeHotelId,
    rooms,
    bookings,
    taskReports,
    activeUser,
    selectedRoomIdForCheckIn,
    setSelectedRoomIdForCheckIn,
    prefillCustomerForCheckIn,
    setPrefillCustomerForCheckIn,
    setSelectedBookingIdForPayment,
    setActivePortal,
    refreshAll,
    announce,
  } = useHotel();

  const cleanAvailableRooms = rooms.filter(
    (r) => r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean'
  );

  const [roomId, setRoomId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [nationality, setNationality] = useState('Ethiopian');
  const [nights, setNights] = useState(1);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<{ bookingId: string; message: string } | null>(null);

  // Reception Task Dispatch -> Housekeeping / Maintenance
  const [taskDept, setTaskDept] = useState<TaskTargetDepartment>('housekeeping');
  const [taskRoomId, setTaskRoomId] = useState<string>('common');
  const [taskPriority, setTaskPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskSending, setTaskSending] = useState(false);

  useEffect(() => {
    if (selectedRoomIdForCheckIn && cleanAvailableRooms.some((r) => r.id === selectedRoomIdForCheckIn)) {
      setRoomId(selectedRoomIdForCheckIn);
      setSelectedRoomIdForCheckIn(null);
    } else if (!roomId && cleanAvailableRooms.length > 0) {
      setRoomId(cleanAvailableRooms[0].id);
    }
  }, [selectedRoomIdForCheckIn, cleanAvailableRooms, roomId, setSelectedRoomIdForCheckIn]);

  useEffect(() => {
    if (prefillCustomerForCheckIn) {
      setGuestName(prefillCustomerForCheckIn.fullName);
      setGuestPhone(prefillCustomerForCheckIn.phone);
      setIdNumber(prefillCustomerForCheckIn.idNumber);
      setNationality(prefillCustomerForCheckIn.nationality || 'Ethiopian');
      if (prefillCustomerForCheckIn.preferences) {
        setNotes(prefillCustomerForCheckIn.preferences);
      }
      setPrefillCustomerForCheckIn(null);
    }
  }, [prefillCustomerForCheckIn, setPrefillCustomerForCheckIn]);

  const selectedRoom = cleanAvailableRooms.find((r) => r.id === roomId);
  const estimatedTotal = selectedRoom ? selectedRoom.ratePerNight * Math.max(1, nights) : 0;

  const activeBookings = bookings.filter((b) => b.bookingStatus === 'Checked In');

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) {
      setFormError(language === 'am' ? 'እባክዎ ንጹህ ክፍል ይምረጡ' : 'Please select a clean available room.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      const result = await hotelApi.checkIn(activeHotelId, {
        roomId,
        guestName,
        guestPhone,
        idNumber,
        nationality,
        nights,
        initialPaymentAmount: Number(initialPaymentAmount) || 0,
        paymentMethod,
        referenceNumber,
        notes,
        staffId: activeUser?.id || '',
      });

      await refreshAll();
      announce(
        `Room ${result.room.roomNumber} checked in for ${result.booking.guestName}.`,
        `ክፍል ${result.room.roomNumber} ለእንግዳ ${result.booking.guestName} ተመዝግቧል።`,
        'success'
      );

      setGuestName('');
      setGuestPhone('');
      setIdNumber('');
      setNights(1);
      setInitialPaymentAmount('0');
      setReferenceNumber('');
      setNotes('');
      setRoomId('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (bookingId: string, forceCheckout = false) => {
    setCheckoutError(null);
    try {
      const res = await hotelApi.checkOut(activeHotelId, bookingId, {
        staffId: activeUser?.id || '',
        forceCheckout,
      });
      await refreshAll();
      announce(
        `Room ${res.booking.roomNumber} checked out. Housekeeping alerted to clean room.`,
        `ክፍል ${res.booking.roomNumber} ተለቋል። ሃውስ ኪፒንግ ክፍሉን እንዲያጸዳ ማሳወቂያ ተልኳል።`,
        'info'
      );
    } catch (err) {
      setCheckoutError({
        bookingId,
        message: err instanceof Error ? err.message : 'Checkout error',
      });
    }
  };

  const handleSendTaskReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskSending(true);
    try {
      const created = await hotelApi.sendReceptionTask(activeHotelId, {
        roomId: taskRoomId === 'common' ? null : taskRoomId,
        targetDepartment: taskDept,
        priority: taskPriority,
        title: taskTitle,
        notes: taskNotes,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Reception dispatched ${created.targetDepartment} task for ${
          created.roomNumber === 'General' ? 'Common Area' : `Room ${created.roomNumber}`
        }.`,
        `ሪሴፕሽን ለ${created.targetDepartment === 'housekeeping' ? 'ሃውስ ኪፒንግ' : 'ሚንተናስ'} የስራ ሪፖርት ልኳል።`,
        created.priority === 'Urgent' ? 'warning' : 'info'
      );
      setTaskTitle('');
      setTaskNotes('');
    } finally {
      setTaskSending(false);
    }
  };

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left/Main: Active Stays Table (7 cols) */}
      <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">{t.activeStays}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeBookings.length} {language === 'am' ? 'ንቁ እንግዶች' : 'currently checked-in guests'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePortal('payments')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {t.navPayments}
          </button>
        </div>

        {checkoutError && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
            <span>{checkoutError.message}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingIdForPayment(checkoutError.bookingId);
                  setActivePortal('payments');
                }}
                className="rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                {t.settlePay}
              </button>
              <button
                type="button"
                onClick={() => handleCheckOut(checkoutError.bookingId, true)}
                className="rounded-md border border-amber-400 px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
              >
                {language === 'am' ? 'ያለ ክፍያ አስወጣ' : 'Override & Check Out'}
              </button>
            </div>
          </div>
        )}

        {activeBookings.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">{language === 'am' ? 'ክፍል' : 'Room'}</th>
                  <th className="py-3 px-4">{language === 'am' ? 'እንግዳ' : 'Guest'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'ጠቅላላ' : 'Total'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'ቀሪ' : 'Balance'}</th>
                  <th className="py-3 px-4 text-right">{language === 'am' ? 'ድርጊት' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeBookings.map((b) => {
                  const balance = Math.max(0, b.totalAmount - b.paidAmount);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                        {b.roomNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{b.guestName}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {b.guestPhone} · {b.nights}n
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                        {b.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className={balance > 0 ? 'font-medium text-amber-700' : 'text-emerald-700'}>
                          {balance > 0 ? balance.toLocaleString() : language === 'am' ? 'ተከፍሏል' : 'Settled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {balance > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBookingIdForPayment(b.id);
                                setActivePortal('payments');
                              }}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                            >
                              {t.settlePay}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCheckOut(b.id)}
                            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                          >
                            {t.checkOut}
                          </button>
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

      {/* Right: Check-In Form (5 cols) */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">{t.newCheckIn}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'am'
            ? 'ንጹህ እና ክፍት የሆኑ ክፍሎች ብቻ ለምዝገባ ይታያሉ'
            : 'Only Clean & Available rooms appear in the check-in selector'}
        </p>

        {formError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleCheckInSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="checkin-room" className="block text-xs font-medium text-slate-700 mb-1">
              {t.selectRoom}
            </label>
            <select
              id="checkin-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
            >
              {cleanAvailableRooms.length === 0 ? (
                <option value="">
                  {language === 'am' ? 'ምንም ንጹህ ክፍት ክፍል የለም' : 'No clean available rooms'}
                </option>
              ) : (
                cleanAvailableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} · {r.type} · {r.ratePerNight.toLocaleString()} {t.currency}/night
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-name" className="block text-xs font-medium text-slate-700 mb-1">
                {t.guestName}
              </label>
              <input
                id="guest-name"
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Dawit Haile"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="guest-phone" className="block text-xs font-medium text-slate-700 mb-1">
                {t.guestPhone}
              </label>
              <input
                id="guest-phone"
                type="tel"
                required
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+251 911 ..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="guest-id" className="block text-xs font-medium text-slate-700 mb-1">
                {t.idNumber}
              </label>
              <input
                id="guest-id"
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="ETH-..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="guest-nat" className="block text-xs font-medium text-slate-700 mb-1">
                {t.nationality}
              </label>
              <input
                id="guest-nat"
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="guest-nights" className="block text-xs font-medium text-slate-700 mb-1">
                {t.nights}
              </label>
              <input
                id="guest-nights"
                type="number"
                min={1}
                max={90}
                required
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                {language === 'am' ? 'ጠቅላላ ክፍያ' : 'Total Stay Charge'}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {estimatedTotal.toLocaleString()} {t.currency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="initial-pay" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.initialDeposit}
                </label>
                <input
                  id="initial-pay"
                  type="number"
                  min={0}
                  value={initialPaymentAmount}
                  onChange={(e) => setInitialPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="initial-method" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.paymentMethod}
                </label>
                <select
                  id="initial-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {Number(initialPaymentAmount) > 0 && (
              <div>
                <label htmlFor="initial-ref" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.receiptRef}
                </label>
                <input
                  id="initial-ref"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="FT263... / TLB-... / CSH-..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="checkin-notes" className="block text-xs font-medium text-slate-700 mb-1">
              {t.notes}
            </label>
            <input
              id="checkin-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'am' ? 'ተጨማሪ ማስታወሻ...' : 'Optional guest preferences or notes...'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || cleanAvailableRooms.length === 0}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : t.completeCheckIn}
          </button>
        </form>
      </section>
    </div>

    {/* Reception -> Housekeeping & Maintenance Task Report Pipeline */}
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          {language === 'am'
            ? 'ለሃውስ ኪፒንግ እና ሚንተናስ ሪፖርት / ትዕዛዝ መላኪያ'
            : 'Dispatch Report to Housekeeping / Maintenance'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'am'
            ? 'የጽዳት ወይም የጥገና ትዕዛዝ ሲልኩ የሚመለከተው ክፍል ወዲያው ይቀበለዋል፤ ማናጀሩም ይከታተለዋል'
            : 'Tasks sent here appear immediately in Housekeeping or Maintenance terminals and Manager monitor'}
        </p>

        <form onSubmit={handleSendTaskReport} className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="tsk-dept" className="block text-xs font-medium text-slate-700 mb-1">
                {language === 'am' ? 'ክፍል' : 'Department'}
              </label>
              <select
                id="tsk-dept"
                value={taskDept}
                onChange={(e) => setTaskDept(e.target.value as TaskTargetDepartment)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
              >
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label htmlFor="tsk-room" className="block text-xs font-medium text-slate-700 mb-1">
                {t.location}
              </label>
              <select
                id="tsk-room"
                value={taskRoomId}
                onChange={(e) => setTaskRoomId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
              >
                <option value="common">Common Area</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tsk-prio" className="block text-xs font-medium text-slate-700 mb-1">
                {t.priority}
              </label>
              <select
                id="tsk-prio"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'Normal' | 'Urgent')}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            required
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder={language === 'am' ? 'የስራው ርዕስ (ለምሳሌ፡ ክፍል 104 ጽዳት)...' : 'Task summary (e.g. Clean Room 104 / Fix AC)...'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
          <input
            type="text"
            value={taskNotes}
            onChange={(e) => setTaskNotes(e.target.value)}
            placeholder={language === 'am' ? 'ተጨማሪ ማብራሪያ...' : 'Additional instructions (optional)...'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={taskSending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {taskSending ? '...' : language === 'am' ? 'ሪፖርት / ትዕዛዝ ላክ' : 'Send Task Report'}
          </button>
        </form>
      </section>

      <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {language === 'am' ? 'የተላኩ የጽዳት እና ጥገና ሪፖርቶች ሁኔታ' : 'Dispatched Reports Status'}
          </h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">{taskReports.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {taskReports.slice(0, 6).map((tsk) => (
            <div key={tsk.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-700">
                    {tsk.roomNumber === 'General' ? 'Common' : `Room ${tsk.roomNumber}`}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span className="capitalize">{tsk.targetDepartment}</span>
                  {tsk.priority === 'Urgent' && (
                    <span className="ml-1.5 text-red-700 font-semibold">· Urgent</span>
                  )}
                </div>
                <div className="font-medium text-slate-900">{tsk.title}</div>
                {tsk.completionNotes && (
                  <div className="text-xs text-emerald-700 mt-0.5">{tsk.completionNotes}</div>
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  tsk.status === 'Completed'
                    ? 'text-emerald-700'
                    : tsk.status === 'In Progress'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                {tsk.status === 'Completed'
                  ? language === 'am'
                    ? 'ተጠናቋል'
                    : 'Completed'
                  : tsk.status === 'In Progress'
                    ? language === 'am'
                      ? 'በስራ ላይ'
                      : 'In Progress'
                    : language === 'am'
                      ? 'በመጠባበቅ ላይ'
                      : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
    </div>
  );
}
