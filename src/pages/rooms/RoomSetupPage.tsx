import React, { useMemo, useState } from 'react';
import { BedDouble, Edit3, Plus, Trash2 } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { RoomType } from '../../types/hotel';
import { hotelApi, type RoomWithBooking } from '../../utils/api';

const PRESET_ROOM_TYPES: RoomType[] = [
  'Standard',
  'Deluxe',
  'Executive Suite',
  'Twin Room',
  'Family Suite',
  'Presidential Suite',
];

export function RoomSetupPage() {
  const { language, t, activeHotelId, activeHotel, activeUser, rooms, refreshAll, announce } =
    useHotel();

  const [formTab, setFormTab] = useState<'register' | 'tier-price'>('register');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Bulk / Single Room Registration State
  const [useCustomType, setUseCustomType] = useState(false);
  const [presetType, setPresetType] = useState<RoomType>('Standard');
  const [customType, setCustomType] = useState('');
  const [floor, setFloor] = useState<number>(1);
  const [startNumber, setStartNumber] = useState<number>(105);
  const [count, setCount] = useState<number>(1);
  const [ratePerNight, setRatePerNight] = useState<number>(3500);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Bulk Tier Price Update State
  const [selectedTierToReprice, setSelectedTierToReprice] = useState<string>('Standard');
  const [tierNewRate, setTierNewRate] = useState<number>(3600);
  const [repricing, setRepricing] = useState(false);
  const [repriceError, setRepriceError] = useState<string | null>(null);

  // Inline Single-Room Edit State
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [draftRoomNumber, setDraftRoomNumber] = useState('');
  const [draftFloor, setDraftFloor] = useState<number>(1);
  const [draftType, setDraftType] = useState<string>('Standard');
  const [draftRate, setDraftRate] = useState<number>(3500);

  const distinctTypes = useMemo(() => {
    return Array.from(new Set(rooms.map((r) => r.type)));
  }, [rooms]);

  const tierSummaries = useMemo(() => {
    return distinctTypes.map((type) => {
      const list = rooms.filter((r) => r.type === type);
      const rates = list.map((r) => r.ratePerNight);
      return {
        type,
        total: list.length,
        cleanReady: list.filter((r) => r.occupancyStatus === 'Available' && r.cleaningStatus === 'Clean')
          .length,
        occupied: list.filter((r) => r.occupancyStatus === 'Occupied').length,
        minRate: Math.min(...rates),
        maxRate: Math.max(...rates),
      };
    });
  }, [distinctTypes, rooms]);

  const filteredRooms = useMemo(() => {
    const list = typeFilter === 'All' ? rooms : rooms.filter((r) => r.type === typeFilter);
    return [...list].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  }, [rooms, typeFilter]);

  const avgRate =
    rooms.length > 0
      ? Math.round(rooms.reduce((sum, r) => sum + r.ratePerNight, 0) / rooms.length)
      : 0;
  const maxDailyRevenue = rooms.reduce((sum, r) => sum + r.ratePerNight, 0);

  const effectiveType = useCustomType ? customType.trim() : presetType;

  const handleBulkRegisterRooms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveType) {
      setCreateError(language === 'am' ? 'እባክዎ የክፍል አይነት ያስገቡ።' : 'Room type is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await hotelApi.bulkCreateRooms(activeHotelId, {
        type: effectiveType,
        floor,
        startNumber,
        count,
        ratePerNight,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Registered ${res.count} ${effectiveType} room(s) in ${activeHotel?.name || 'hotel'}.`,
        `${res.count} አዲስ ${effectiveType} ክፍሎች በሆቴሉ ውስጥ ተመዝግበዋል።`,
        'success'
      );
      setStartNumber(startNumber + res.count);
      setCustomType('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to register rooms');
    } finally {
      setCreating(false);
    }
  };

  const handleBulkTierReprice = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepricing(true);
    setRepriceError(null);
    try {
      const res = await hotelApi.updateRoomTypeRates(activeHotelId, {
        type: selectedTierToReprice,
        ratePerNight: tierNewRate,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Updated ${res.updatedCount} ${res.type} rooms to ${res.ratePerNight.toLocaleString()} ETB.`,
        `የ${res.updatedCount} ${res.type} ክፍሎች ዋጋ ወደ ${res.ratePerNight.toLocaleString()} ብር ተቀይሯል።`,
        'success'
      );
    } catch (err) {
      setRepriceError(err instanceof Error ? err.message : 'Unable to update tier rate');
    } finally {
      setRepricing(false);
    }
  };

  const startEditRoom = (rm: RoomWithBooking) => {
    setEditingRoomId(rm.id);
    setDraftRoomNumber(rm.roomNumber);
    setDraftFloor(rm.floor);
    setDraftType(rm.type);
    setDraftRate(rm.ratePerNight);
  };

  const handleSaveRoomEdit = async (roomId: string) => {
    await hotelApi.updateRoomDetails(activeHotelId, roomId, {
      roomNumber: draftRoomNumber,
      floor: draftFloor,
      type: draftType,
      ratePerNight: draftRate,
      staffId: activeUser?.id || '',
    });
    setEditingRoomId(null);
    await refreshAll();
  };

  const handleDeleteRoom = async (rm: RoomWithBooking) => {
    await hotelApi.deleteRoom(activeHotelId, rm.id);
    await refreshAll();
    announce(
      `Room ${rm.roomNumber} removed from hotel inventory.`,
      `ክፍል ${rm.roomNumber} ከሆቴሉ ዝርዝር ተሰርዟል።`,
      'info'
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የሆቴሉ ጠቅላላ ክፍሎች' : 'Total Hotel Rooms'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {rooms.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የክፍል አይነቶች ብዛት' : 'Configured Room Types'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {distinctTypes.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 truncate">
            {distinctTypes.join(' · ') || '—'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'አማካይ የሌሊት ዋጋ' : 'Average Nightly Rate'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {avgRate.toLocaleString()} {t.currency}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'በሁሉም ክፍሎች' : 'Across all room tiers'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ዕለታዊ ከፍተኛ የክፍል ገቢ' : '100% Occupancy Revenue'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {maxDailyRevenue.toLocaleString()} {t.currency}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ሁሉም ክፍሎች ሲያዙ በ1 ሌሊት' : 'Per night at full capacity'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Room Registration + Bulk Tier Pricing */}
        <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFormTab('register')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                formTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{language === 'am' ? 'ክፍሎች መዝግብ' : 'Register Rooms'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormTab('tier-price')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                formTab === 'tier-price'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{language === 'am' ? 'በአይነት ዋጋ ቀይር' : 'Bulk Tier Pricing'}</span>
            </button>
          </div>

          {formTab === 'register' ? (
            <form onSubmit={handleBulkRegisterRooms} className="mt-4 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'የሆቴሉን ክፍሎች ብዛት፣ አይነት እና ዋጋ መመዝገቢያ'
                    : 'Register Rooms by Type, Count & Nightly Price'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'አንድ ወይም ብዙ ተከታታይ ክፍሎችን ከአይነት እና ከዋጋ ጋር ለዚህ ሆቴል ይፍጠሩ'
                    : 'Add single or sequential rooms with preset or custom room tiers'}
                </p>
              </div>

              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="rm-type" className="text-xs font-medium text-slate-700">
                    {language === 'am' ? 'የክፍል አይነት' : 'Room Type / Tier'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomType(!useCustomType)}
                    className="text-xs font-medium text-amber-700 hover:text-amber-800"
                  >
                    {useCustomType
                      ? language === 'am'
                        ? 'ዝግጁ አይነት ምረጥ'
                        : 'Use preset type'
                      : language === 'am'
                        ? '+ ሌላ አዲስ አይነት ጻፍ'
                        : '+ Custom room type'}
                  </button>
                </div>

                {useCustomType ? (
                  <input
                    id="rm-type"
                    type="text"
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="e.g. Lakeside Bungalow / Twin Studio"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                ) : (
                  <select
                    id="rm-type"
                    value={presetType}
                    onChange={(e) => setPresetType(e.target.value as RoomType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  >
                    {PRESET_ROOM_TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        {tp}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="rm-floor" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.floor}
                  </label>
                  <input
                    id="rm-floor"
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={floor}
                    onChange={(e) => {
                      const fl = Math.max(1, Number(e.target.value) || 1);
                      setFloor(fl);
                      setStartNumber(fl * 100 + 1);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="rm-start" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'መነሻ ክፍል #' : 'Start Room #'}
                  </label>
                  <input
                    id="rm-start"
                    type="number"
                    min={1}
                    required
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="rm-count" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የክፍል ብዛት' : 'Quantity'}
                  </label>
                  <input
                    id="rm-count"
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={count}
                    onChange={(e) => setCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rm-rate" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የ1 ሌሊት ዋጋ (ብር)' : 'Nightly Rate per Room (ETB)'}
                </label>
                <input
                  id="rm-rate"
                  type="number"
                  min={500}
                  step={100}
                  required
                  value={ratePerNight}
                  onChange={(e) => setRatePerNight(Math.max(500, Number(e.target.value) || 500))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 font-mono tabular-nums">
                {language === 'am' ? 'የሚፈጠሩ ክፍሎች' : 'Will provision'}:{' '}
                {Array.from({ length: Math.min(count, 5) }, (_, i) => startNumber + i).join(', ')}
                {count > 5 ? ` ... (${count} total)` : ''} · {effectiveType || '—'} ·{' '}
                {ratePerNight.toLocaleString()} {t.currency}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {creating
                  ? '...'
                  : language === 'am'
                    ? `${count} ክፍል(ሎች) መዝግብ`
                    : `Register ${count} Room${count > 1 ? 's' : ''}`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkTierReprice} className="mt-4 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የክፍል አይነት ዋጋ በጅምላ ማስተካከያ' : 'Update Rate Across Entire Room Type'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'አንድ የክፍል አይነት መርጠው የሁሉንም ተመሳሳይ ክፍሎች የሌሊት ዋጋ በአንዴ ይቀይሩ'
                    : 'Set a uniform nightly price for all rooms in a selected category'}
                </p>
              </div>

              {repriceError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {repriceError}
                </div>
              )}

              <div>
                <label htmlFor="tier-sel" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የክፍል አይነት ይምረጡ' : 'Select Room Type'}
                </label>
                <select
                  id="tier-sel"
                  value={selectedTierToReprice}
                  onChange={(e) => setSelectedTierToReprice(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                >
                  {distinctTypes.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp} ({rooms.filter((r) => r.type === tp).length} rooms)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tier-rate" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'አዲሱ የሌሊት ዋጋ (ብር)' : 'New Nightly Rate (ETB)'}
                </label>
                <input
                  id="tier-rate"
                  type="number"
                  min={500}
                  step={100}
                  required
                  value={tierNewRate}
                  onChange={(e) => setTierNewRate(Math.max(500, Number(e.target.value) || 500))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={repricing || distinctTypes.length === 0}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {repricing
                  ? '...'
                  : language === 'am'
                    ? 'የክፍል አይነት ዋጋ አዘምን'
                    : 'Apply New Tier Rate'}
              </button>
            </form>
          )}
        </section>

        {/* Right Column (7 cols): Room Types Summary + Full Room Inventory Table */}
        <div className="xl:col-span-7 space-y-6">
          {/* Room Types Breakdown Table */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-slate-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የክፍል አይነቶች እና የዋጋ ማጠቃለያ' : 'Room Types & Pricing Summary'}
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">{distinctTypes.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">{language === 'am' ? 'የክፍል አይነት' : 'Room Type'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ብዛት' : 'Count'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ንጹህ ክፍት' : 'Ready'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'የተያዘ' : 'Occupied'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ዋጋ (ብር)' : 'Nightly Rate'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {tierSummaries.map((tier) => (
                    <tr key={tier.type} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900">{tier.type}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {tier.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {tier.cleanReady}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {tier.occupied}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {tier.minRate === tier.maxRate
                          ? `${tier.minRate.toLocaleString()} ${t.currency}`
                          : `${tier.minRate.toLocaleString()}–${tier.maxRate.toLocaleString()} ${t.currency}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Individual Room Inventory & Rate Editor */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'የእያንዳንዱ ክፍል ዝርዝር እና ዋጋ' : 'Individual Room Inventory & Rate Editor'}
              </h2>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                {['All', ...distinctTypes].map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeFilter(tp)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                      typeFilter === tp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {tp}
                  </button>
                ))}
              </div>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">{language === 'am' ? 'ክፍል #' : 'Room #'}</th>
                      <th className="py-3 px-4">{t.floor}</th>
                      <th className="py-3 px-4">{language === 'am' ? 'አይነት' : 'Type'}</th>
                      <th className="py-3 px-4">{language === 'am' ? 'ሁኔታ' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{language === 'am' ? 'ዋጋ (ብር)' : 'Rate'}</th>
                      <th className="py-3 px-4 text-right">{language === 'am' ? 'ድርጊት' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRooms.map((rm) => {
                      const isEditing = editingRoomId === rm.id;
                      return (
                        <tr key={rm.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                            {isEditing ? (
                              <input
                                type="text"
                                value={draftRoomNumber}
                                onChange={(e) => setDraftRoomNumber(e.target.value)}
                                className="w-16 rounded border border-amber-500 px-2 py-1 text-xs font-mono"
                              />
                            ) : (
                              rm.roomNumber
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                value={draftFloor}
                                onChange={(e) => setDraftFloor(Number(e.target.value) || 1)}
                                className="w-12 rounded border border-amber-500 px-1.5 py-1 text-xs font-mono"
                              />
                            ) : (
                              `F${rm.floor}`
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-800">
                            {isEditing ? (
                              <input
                                type="text"
                                value={draftType}
                                onChange={(e) => setDraftType(e.target.value)}
                                className="w-32 rounded border border-amber-500 px-2 py-1 text-xs"
                              />
                            ) : (
                              rm.type
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            {rm.occupancyStatus} · {rm.cleaningStatus}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min={500}
                                step={100}
                                value={draftRate}
                                onChange={(e) => setDraftRate(Number(e.target.value) || 500)}
                                className="w-24 rounded border border-amber-500 px-2 py-1 text-right text-xs font-mono"
                              />
                            ) : (
                              `${rm.ratePerNight.toLocaleString()} ${t.currency}`
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveRoomEdit(rm.id)}
                                  className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                                >
                                  Save
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditRoom(rm)}
                                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Edit
                                </button>
                              )}
                              {rm.occupancyStatus !== 'Occupied' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoom(rm)}
                                  className="rounded-md border border-red-200 p-1 text-red-700 hover:bg-red-50"
                                  aria-label={`Remove room ${rm.roomNumber}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
      </div>
    </div>
  );
}
