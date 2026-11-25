import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Edit3,
  Plus,
  Search,
  Send,
  Star,
  Users,
} from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type {
  HotelCategory,
  HotelOperationalStatus,
  HotelOverviewStat,
  MessagePriority,
  MessageTargetRole,
  RoomType,
} from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const HOTEL_CATEGORIES: HotelCategory[] = [
  'Boutique',
  'Resort',
  'Business Hotel',
  'Lodge',
  'City Hotel',
];

const HOTEL_STATUSES: HotelOperationalStatus[] = ['Active', 'Onboarding', 'Maintenance Mode'];

const AMENITY_OPTIONS = [
  'Wi-Fi',
  'Breakfast Included',
  'Airport Shuttle',
  'Parking',
  'Conference Hall',
  'Generator Backup',
  'Spa & Pool',
];

export function CentralHotelsPage() {
  const {
    language,
    t,
    hotels,
    activeHotelId,
    activeHotel,
    setActiveHotelId,
    setActivePortal,
    setWorkspaceMode,
    rooms,
    users,
    refreshAll,
    announce,
  } = useHotel();

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | HotelCategory>('All');

  // Right-side panel mode: create vs edit existing hotel
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);

  // Hotel Profile & Operational Policy Form State
  const [name, setName] = useState('');
  const [amharicName, setAmharicName] = useState('');
  const [city, setCity] = useState('');
  const [amharicCity, setAmharicCity] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [managerName, setManagerName] = useState('');
  const [starRating, setStarRating] = useState<number>(4);
  const [category, setCategory] = useState<HotelCategory>('Boutique');
  const [status, setStatus] = useState<HotelOperationalStatus>('Active');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [taxPercent, setTaxPercent] = useState(15);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  const [amenities, setAmenities] = useState<string[]>([
    'Wi-Fi',
    'Breakfast Included',
    'Parking',
    'Generator Backup',
  ]);

  // Room Tiers & Pricing State
  const [standardCount, setStandardCount] = useState(6);
  const [standardRate, setStandardRate] = useState(3200);
  const [deluxeCount, setDeluxeCount] = useState(4);
  const [deluxeRate, setDeluxeRate] = useState(4900);
  const [suiteCount, setSuiteCount] = useState(2);
  const [suiteRate, setSuiteRate] = useState(8500);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Practical Operations Tabs below Directory (Room Inventory, Staff PINs, HQ Broadcast)
  const [opsTab, setOpsTab] = useState<'rooms' | 'staff' | 'broadcast'>('rooms');

  // Add New Room to Active Hotel
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState(1);
  const [newRoomType, setNewRoomType] = useState<RoomType>('Standard');
  const [newRoomRate, setNewRoomRate] = useState(3500);
  const [roomAdding, setRoomAdding] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Inline Room Rate Editing
  const [editingRoomRateId, setEditingRoomRateId] = useState<string | null>(null);
  const [draftRoomRate, setDraftRoomRate] = useState<number>(3500);

  // HQ Broadcast State
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [broadcastRole, setBroadcastRole] = useState<MessageTargetRole>('all');
  const [broadcastPriority, setBroadcastPriority] = useState<MessagePriority>('Normal');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  const totalRoomsAll = hotels.reduce((s, h) => s + h.totalRooms, 0);
  const totalOccupiedAll = hotels.reduce((s, h) => s + h.occupiedRooms, 0);
  const totalRevenueAll = hotels.reduce((s, h) => s + h.totalCollected, 0);
  const totalOpenMntAll = hotels.reduce((s, h) => s + h.openMaintenanceCount, 0);

  const filteredHotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hotels.filter((h) => {
      if (categoryFilter !== 'All' && h.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.amharicName.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        h.tinNumber.toLowerCase().includes(q) ||
        h.managerName.toLowerCase().includes(q)
      );
    });
  }, [hotels, searchQuery, categoryFilter]);

  const plannedTotalRooms = standardCount + deluxeCount + suiteCount;
  const plannedPotentialRevenue =
    standardCount * standardRate + deluxeCount * deluxeRate + suiteCount * suiteRate;

  const resetFormToCreate = () => {
    setEditingHotelId(null);
    setName('');
    setAmharicName('');
    setCity('');
    setAmharicCity('');
    setCode('');
    setAddress('');
    setPhone('');
    setEmail('');
    setTinNumber('');
    setManagerName('');
    setStarRating(4);
    setCategory('Boutique');
    setStatus('Active');
    setCheckInTime('14:00');
    setCheckOutTime('12:00');
    setTaxPercent(15);
    setServiceChargePercent(10);
    setAmenities(['Wi-Fi', 'Breakfast Included', 'Parking', 'Generator Backup']);
    setStandardCount(6);
    setStandardRate(3200);
    setDeluxeCount(4);
    setDeluxeRate(4900);
    setSuiteCount(2);
    setSuiteRate(8500);
    setError(null);
  };

  const startEditingHotel = (h: HotelOverviewStat) => {
    setActiveHotelId(h.id);
    setEditingHotelId(h.id);
    setName(h.name);
    setAmharicName(h.amharicName);
    setCity(h.city);
    setAmharicCity(h.amharicCity);
    setCode(h.code);
    setAddress(h.address);
    setPhone(h.phone);
    setEmail(h.email);
    setTinNumber(h.tinNumber);
    setManagerName(h.managerName);
    setStarRating(h.starRating);
    setCategory(h.category);
    setStatus(h.status);
    setCheckInTime(h.checkInTime);
    setCheckOutTime(h.checkOutTime);
    setTaxPercent(h.taxPercent);
    setServiceChargePercent(h.serviceChargePercent);
    setAmenities(h.amenities || []);

    const std = h.tierBreakdown.find((tb) => tb.type === 'Standard');
    const dlx = h.tierBreakdown.find((tb) => tb.type === 'Deluxe');
    const ste = h.tierBreakdown.find((tb) => tb.type === 'Executive Suite');
    setStandardCount(std?.total || 0);
    setStandardRate(std?.minRate || 3200);
    setDeluxeCount(dlx?.total || 0);
    setDeluxeRate(dlx?.minRate || 4900);
    setSuiteCount(ste?.total || 0);
    setSuiteRate(ste?.minRate || 8500);
    setError(null);
  };

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingHotelId) {
        const res = await hotelApi.updateHotel(editingHotelId, {
          name,
          amharicName: amharicName || name,
          city,
          amharicCity: amharicCity || city,
          address,
          phone,
          email,
          tinNumber,
          managerName,
          starRating,
          category,
          status,
          checkInTime,
          checkOutTime,
          taxPercent,
          serviceChargePercent,
          amenities,
          tierRates: {
            Standard: standardRate,
            Deluxe: deluxeRate,
            'Executive Suite': suiteRate,
          },
        });
        await refreshAll(editingHotelId);
        announce(
          `${res.hotel.name} profile & ${res.roomsUpdated} room rates updated on Central Server.`,
          `የ${res.hotel.amharicName} መረጃ እና የ${res.roomsUpdated} ክፍሎች ዋጋ ተዘምኗል።`,
          'success'
        );
        resetFormToCreate();
      } else {
        const res = await hotelApi.createHotel({
          name,
          amharicName: amharicName || name,
          city,
          amharicCity: amharicCity || city,
          code,
          address,
          phone,
          email,
          tinNumber,
          managerName,
          starRating,
          category,
          status,
          checkInTime,
          checkOutTime,
          taxPercent,
          serviceChargePercent,
          amenities,
          standardCount,
          standardRate,
          deluxeCount,
          deluxeRate,
          suiteCount,
          suiteRate,
        });

        setActiveHotelId(res.hotel.id);
        await refreshAll(res.hotel.id);
        announce(
          `${res.hotel.name} provisioned on Central Server with ${res.roomsCreated} rooms.`,
          `${res.hotel.amharicName} በዋናው ሰርቨር ላይ ከ${res.roomsCreated} ክፍሎች ጋር ተመዝግቧል።`,
          'success'
        );
        resetFormToCreate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save hotel property');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) return;
    setRoomError(null);
    setRoomAdding(true);
    try {
      const created = await hotelApi.addHotelRoom(activeHotel.id, {
        roomNumber: newRoomNumber,
        floor: newRoomFloor,
        type: newRoomType,
        ratePerNight: newRoomRate,
      });
      await refreshAll(activeHotel.id);
      announce(
        `Added Room ${created.roomNumber} (${created.type}) to ${activeHotel.name}.`,
        `ክፍል ${created.roomNumber} (${created.type}) ወደ ${activeHotel.amharicName} ተጨምሯል።`,
        'success'
      );
      setNewRoomNumber('');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to add room');
    } finally {
      setRoomAdding(false);
    }
  };

  const handleSaveSingleRoomRate = async (roomId: string) => {
    if (!activeHotel) return;
    await hotelApi.updateRoomRateOrTier(activeHotel.id, roomId, { ratePerNight: draftRoomRate });
    setEditingRoomRateId(null);
    await refreshAll(activeHotel.id);
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastSending(true);
    try {
      const res = await hotelApi.broadcastCentralMessage({
        targetHotelId: broadcastTarget,
        recipientRole: broadcastRole,
        priority: broadcastPriority,
        subject: broadcastSubject,
        body: broadcastBody,
      });
      await refreshAll();
      announce(
        `HQ notice delivered to ${res.deliveredCount} hotel(s).`,
        `የዋናው ሰርቨር መልእክት ለ${res.deliveredCount} ሆቴሎች ተልኳል።`,
        broadcastPriority === 'Urgent' ? 'warning' : 'success'
      );
      setBroadcastSubject('');
      setBroadcastBody('');
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cross-Hotel Aggregate Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'በዋናው ሰርቨር ያሉ ሆቴሎች' : 'Connected Hotels'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {hotels.length}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {totalRoomsAll} {language === 'am' ? 'ጠቅላላ ክፍሎች' : 'total rooms across network'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ጠቅላላ የተያዙ ክፍሎች' : 'Network Occupancy'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totalOccupiedAll} / {totalRoomsAll}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {totalRoomsAll > 0 ? Math.round((totalOccupiedAll / totalRoomsAll) * 100) : 0}%{' '}
            {language === 'am' ? 'የተያዘ' : 'occupied'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ጠቅላላ የተሰበሰበ ገቢ' : 'Combined Revenue'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {totalRevenueAll.toLocaleString()} {t.currency}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {language === 'am' ? 'ከሁሉም ቅርንጫፎች' : 'Across all connected properties'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ያልተፈቱ ጥገናዎች' : 'Active Network Tickets'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {totalOpenMntAll}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {language === 'am' ? 'በሁሉም ሆቴሎች' : 'Open maintenance work orders'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Multi-Tenant Hotel Directory + Selected Hotel Operational Tools */}
        <div className="xl:col-span-7 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {language === 'am'
                      ? 'በዋናው ሰርቨር የሚተዳደሩ ሆቴሎች እና ሙሉ መረጃ'
                      : 'Central Server Hotel Directory & Room Tiers'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'am'
                      ? 'የእያንዳንዱን ሆቴል ደረጃ፣ የክፍሎች ብዛት፣ የዋጋ መጠን እና አድራሻ ይመልከቱ ወይም ያስተካክሉ'
                      : 'Inspect property star rating, TIN, contact info, room tiers, and nightly rates'}
                  </p>
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'am' ? 'ሆቴል / ከተማ / TIN ፈልግ...' : 'Search hotel, city, TIN...'}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {(['All', ...HOTEL_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredHotels.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredHotels.map((h) => {
                  const isSelected = h.id === activeHotelId;
                  return (
                    <div
                      key={h.id}
                      className={`p-5 space-y-3 ${
                        isSelected ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                            <Building2 className="h-3.5 w-3.5 text-slate-700 shrink-0" />
                            <span className="font-mono font-semibold text-slate-800">{h.code}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-amber-700">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {h.starRating}★
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{h.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{language === 'am' ? h.amharicCity : h.city}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-medium ${
                                h.status === 'Active'
                                  ? 'text-emerald-700'
                                  : h.status === 'Maintenance Mode'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {h.status}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-semibold text-slate-900">
                            {language === 'am' ? h.amharicName : h.name}
                          </h3>

                          <div className="text-xs text-slate-600">
                            {h.address} · <span className="font-mono tabular-nums">{h.phone}</span> ·{' '}
                            {h.email}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                            <span>
                              {language === 'am' ? 'ማናጀር' : 'Mgr'}: <span className="font-sans text-slate-700">{h.managerName}</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>TIN: {h.tinNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              In {h.checkInTime} / Out {h.checkOutTime}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              VAT {h.taxPercent}% + Svc {h.serviceChargePercent}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditingHotel(h)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{language === 'am' ? 'አስተካክል' : 'Edit Info'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveHotelId(h.id);
                              setWorkspaceMode('reception-desk');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>{t.hotelReceptionPortalBtn}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveHotelId(h.id);
                              setActivePortal('overview');
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                              isSelected
                                ? 'bg-slate-900 text-white hover:bg-slate-800'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{t.switchHotel}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Room Tier & Price Summary Row + Amenities */}
                      <div className="border-t border-slate-200/80 pt-3 flex flex-col gap-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {h.tierBreakdown.map((tier) => (
                            <div
                              key={tier.type}
                              className="flex items-center justify-between border border-slate-200 bg-white rounded-lg px-3 py-1.5"
                            >
                              <span className="font-medium text-slate-700">{tier.type}</span>
                              <span className="font-mono tabular-nums text-slate-900">
                                {tier.total} rms ·{' '}
                                {tier.minRate > 0 ? `${tier.minRate.toLocaleString()} ${t.currency}` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <div className="truncate">
                            {h.amenities.length > 0 ? h.amenities.join(' · ') : '—'}
                          </div>
                          <div className="font-mono tabular-nums text-slate-700 shrink-0">
                            Occ: {h.occupiedRooms}/{h.totalRooms} · Clean: {h.cleanReadyRooms} ·{' '}
                            <span className="font-semibold text-emerald-700">
                              {h.totalCollected.toLocaleString()} {t.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Practical Central Server Operational Tools for Selected Hotel */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'የተግባራዊ አስተዳደር መሳሪያዎች'
                    : 'Central Server Operational Controls'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeHotel
                    ? `${activeHotel.code} · ${language === 'am' ? activeHotel.amharicName : activeHotel.name}`
                    : ''}
                </p>
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setOpsTab('rooms')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
                    opsTab === 'rooms' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {language === 'am' ? 'ክፍሎች እና ዋጋ' : 'Rooms & Rates'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpsTab('staff')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
                    opsTab === 'staff' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {language === 'am' ? 'ሰራተኞች እና PIN' : 'Staff & PINs'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpsTab('broadcast')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
                    opsTab === 'broadcast' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {language === 'am' ? 'ለሁሉም መልእክት' : 'HQ Broadcast'}
                </button>
              </div>
            </div>

            {opsTab === 'rooms' && (
              <div className="p-5 space-y-5">
                {/* Add New Room Form */}
                <form onSubmit={handleAddRoom} className="space-y-3 border-b border-slate-200 pb-5">
                  <div className="text-xs font-semibold text-slate-800">
                    {language === 'am'
                      ? `ወደ ${activeHotel?.amharicName || 'ሆቴሉ'} አዲስ ክፍል ጨምር`
                      : `Add Individual Room to ${activeHotel?.name || 'Selected Hotel'}`}
                  </div>
                  {roomError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {roomError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      required
                      value={newRoomNumber}
                      onChange={(e) => setNewRoomNumber(e.target.value)}
                      placeholder={language === 'am' ? 'ክፍል ቁ. (305)' : 'Room # (e.g. 305)'}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-amber-600 focus:outline-none"
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newRoomFloor}
                      onChange={(e) => setNewRoomFloor(Number(e.target.value) || 1)}
                      placeholder="Floor"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                    />
                    <select
                      value={newRoomType}
                      onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Deluxe">Deluxe</option>
                      <option value="Executive Suite">Executive Suite</option>
                    </select>
                    <input
                      type="number"
                      min={500}
                      step={100}
                      value={newRoomRate}
                      onChange={(e) => setNewRoomRate(Number(e.target.value) || 1000)}
                      placeholder="Rate (ETB)"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={roomAdding}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{language === 'am' ? 'ክፍል ጨምር' : 'Add Room'}</span>
                    </button>
                  </div>
                </form>

                {/* Room Inventory & Pricing Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-3">{language === 'am' ? 'ክፍል' : 'Room'}</th>
                        <th className="py-2.5 px-3">{language === 'am' ? 'ፎቅ' : 'Floor'}</th>
                        <th className="py-2.5 px-3">{language === 'am' ? 'ደረጃ' : 'Tier'}</th>
                        <th className="py-2.5 px-3">{language === 'am' ? 'ሁኔታ' : 'Status'}</th>
                        <th className="py-2.5 px-3 text-right">{language === 'am' ? 'የሌሊት ዋጋ' : 'Rate / Night'}</th>
                        <th className="py-2.5 px-3 text-right">{language === 'am' ? 'አስተካክል' : 'Adjust'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {rooms.map((rm) => (
                        <tr key={rm.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 tabular-nums">
                            {rm.roomNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                            F{rm.floor}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">{rm.type}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {rm.occupancyStatus} · {rm.cleaningStatus}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {editingRoomRateId === rm.id ? (
                              <input
                                type="number"
                                min={500}
                                step={100}
                                value={draftRoomRate}
                                onChange={(e) => setDraftRoomRate(Number(e.target.value) || 500)}
                                className="w-24 rounded border border-amber-500 px-2 py-1 text-right font-mono text-xs"
                              />
                            ) : (
                              `${rm.ratePerNight.toLocaleString()} ${t.currency}`
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {editingRoomRateId === rm.id ? (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleRoomRate(rm.id)}
                                className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                              >
                                {language === 'am' ? 'አስቀምጥ' : 'Save'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoomRateId(rm.id);
                                  setDraftRoomRate(rm.ratePerNight);
                                }}
                                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {language === 'am' ? 'ዋጋ ቀይር' : 'Edit Rate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {opsTab === 'staff' && (
              <div className="p-5 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3">{language === 'am' ? 'ሰራተኛ' : 'Staff Member'}</th>
                      <th className="py-2.5 px-3">{language === 'am' ? 'የስራ ክፍል' : 'Department'}</th>
                      <th className="py-2.5 px-3">{language === 'am' ? 'ፈረቃ' : 'Shift'}</th>
                      <th className="py-2.5 px-3 text-right">{language === 'am' ? 'የመግቢያ PIN' : 'Terminal PIN'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {language === 'am' ? u.amharicName : u.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {u.departmentLabel} · <span className="capitalize">{u.role}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{u.shift}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {u.pinCode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {opsTab === 'broadcast' && (
              <form onSubmit={handleSendBroadcast} className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="hq-target" className="block text-xs font-medium text-slate-700 mb-1">
                      {language === 'am' ? 'ሆቴል ይምረጡ' : 'Target Property'}
                    </label>
                    <select
                      id="hq-target"
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="all">
                        {language === 'am' ? 'ሁሉም ሆቴሎች' : 'All Connected Hotels'}
                      </option>
                      {hotels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.code} · {language === 'am' ? h.amharicName : h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="hq-role" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.recipientRole}
                    </label>
                    <select
                      id="hq-role"
                      value={broadcastRole}
                      onChange={(e) => setBroadcastRole(e.target.value as MessageTargetRole)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="all">All Staff / ሁሉም ሰራተኞች</option>
                      <option value="manager">Managers / ማናጀሮች</option>
                      <option value="reception">Reception / ሪሴፕሽን</option>
                      <option value="housekeeping">Housekeeping / ጽዳት</option>
                      <option value="maintenance">Maintenance / ጥገና</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="hq-prio" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.priority}
                    </label>
                    <select
                      id="hq-prio"
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value as MessagePriority)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder={language === 'am' ? 'የማሳወቂያ ርዕስ (ለምሳሌ፡ የበዓል ዋጋ ማስተካከያ)...' : 'HQ notice subject (e.g. Holiday tariff update)...'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <textarea
                  rows={2}
                  required
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder={language === 'am' ? 'ለቅርንጫፍ ሆቴሎች የሚላክ መመሪያ...' : 'Operational instruction for selected hotels...'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={broadcastSending}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {broadcastSending
                      ? '...'
                      : language === 'am'
                        ? 'መልእክት ለሆቴሎች አስተላልፍ'
                        : 'Broadcast to Hotels'}
                  </span>
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Right Column (5 cols): Full Hotel Profile, Room Count by Tier & Pricing Registration / Editor */}
        <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                {editingHotelId
                  ? language === 'am'
                    ? 'የሆቴል መረጃ እና የክፍል ዋጋ ማስተካከያ'
                    : 'Edit Hotel Profile & Tier Pricing'
                  : t.registerHotel}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'am'
                  ? 'ሙሉ የሆቴል መረጃ፣ ደረጃ፣ የክፍሎች ብዛት እና የየክፍሉ ዋጋ በአንድ ጊዜ ይመዘገባሉ'
                  : 'Configure full property metadata, star rating, legal TIN, tax rates, and room tiers'}
              </p>
            </div>
            {editingHotelId && (
              <button
                type="button"
                onClick={resetFormToCreate}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                {language === 'am' ? 'አዲስ ፍጠር' : 'New Hotel'}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSaveHotel} className="mt-4 space-y-4">
            {/* 1. Identity & Classification */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="htl-name" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.hotelNameEn}
                  </label>
                  <input
                    id="htl-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tekno Adama Grand"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-name-am" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.hotelNameAm}
                  </label>
                  <input
                    id="htl-name-am"
                    type="text"
                    value={amharicName}
                    onChange={(e) => setAmharicName(e.target.value)}
                    placeholder="ለምሳሌ፡ ቴክኖ አዳማ ግራንድ"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="htl-city" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.city}
                  </label>
                  <input
                    id="htl-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Adama"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-city-am" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ከተማ (በአማርኛ)' : 'City (Amharic)'}
                  </label>
                  <input
                    id="htl-city-am"
                    type="text"
                    value={amharicCity}
                    onChange={(e) => setAmharicCity(e.target.value)}
                    placeholder="አዳማ"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-code" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.hotelCode}
                  </label>
                  <input
                    id="htl-code"
                    type="text"
                    disabled={Boolean(editingHotelId)}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ZMA-ADM"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:border-amber-600 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="htl-stars" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የኮከብ ደረጃ' : 'Star Rating'}
                  </label>
                  <select
                    id="htl-stars"
                    value={starRating}
                    onChange={(e) => setStarRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono focus:border-amber-600 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>
                        {s}★ Star
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="htl-cat" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የሆቴል አይነት' : 'Category'}
                  </label>
                  <select
                    id="htl-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HotelCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    {HOTEL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="htl-stat" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ሁኔታ' : 'Status'}
                  </label>
                  <select
                    id="htl-stat"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as HotelOperationalStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    {HOTEL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Contact, Legal & Operational Policy */}
            <div className="border-t border-slate-200 pt-3.5 space-y-3">
              <div className="text-xs font-semibold text-slate-800">
                {language === 'am' ? 'አድራሻ፣ ህጋዊ መረጃ እና የስራ ሰዓት/ታክስ' : 'Contact, Legal TIN & Tax Policy'}
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={language === 'am' ? 'ሙሉ አድራሻ (መንገድ፣ ክፍለ ከተማ)...' : 'Street address & district...'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 11 ..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reservations@hotel.et"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="htl-tin" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የግብር መለያ (TIN)' : 'TIN Number'}
                  </label>
                  <input
                    id="htl-tin"
                    type="text"
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    placeholder="0041928371"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-mgr" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የሆቴሉ ዋና ማናጀር' : 'Branch Manager'}
                  </label>
                  <input
                    id="htl-mgr"
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="e.g. Abebe Kebede"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label htmlFor="htl-in" className="block text-xs font-medium text-slate-700 mb-1">
                    Check-In
                  </label>
                  <input
                    id="htl-in"
                    type="text"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-out" className="block text-xs font-medium text-slate-700 mb-1">
                    Check-Out
                  </label>
                  <input
                    id="htl-out"
                    type="text"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-vat" className="block text-xs font-medium text-slate-700 mb-1">
                    VAT %
                  </label>
                  <input
                    id="htl-vat"
                    type="number"
                    min={0}
                    max={30}
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="htl-svc" className="block text-xs font-medium text-slate-700 mb-1">
                    Service %
                  </label>
                  <input
                    id="htl-svc"
                    type="number"
                    min={0}
                    max={25}
                    value={serviceChargePercent}
                    onChange={(e) => setServiceChargePercent(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. Room Count by Tier & Pricing */}
            <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  {language === 'am'
                    ? 'የክፍሎች ደረጃ፣ ብዛት እና ዋጋ (በብር)'
                    : 'Room Tiers, Counts & Nightly Rates (ETB)'}
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {plannedTotalRooms} rms · {plannedPotentialRevenue.toLocaleString()} {t.currency}
                </span>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center text-xs">
                  <span className="col-span-5 font-medium text-slate-700">Standard (መደበኛ)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    disabled={Boolean(editingHotelId)}
                    value={standardCount}
                    onChange={(e) => setStandardCount(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Standard room count"
                    className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums disabled:bg-slate-100"
                  />
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={standardRate}
                    onChange={(e) => setStandardRate(Math.max(500, Number(e.target.value) || 500))}
                    aria-label="Standard nightly rate"
                    className="col-span-4 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-12 gap-2 items-center text-xs">
                  <span className="col-span-5 font-medium text-slate-700">Deluxe (ዲላክስ)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    disabled={Boolean(editingHotelId)}
                    value={deluxeCount}
                    onChange={(e) => setDeluxeCount(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Deluxe room count"
                    className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums disabled:bg-slate-100"
                  />
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={deluxeRate}
                    onChange={(e) => setDeluxeRate(Math.max(500, Number(e.target.value) || 500))}
                    aria-label="Deluxe nightly rate"
                    className="col-span-4 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-12 gap-2 items-center text-xs">
                  <span className="col-span-5 font-medium text-slate-700">Executive Suite (ስዊት)</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    disabled={Boolean(editingHotelId)}
                    value={suiteCount}
                    onChange={(e) => setSuiteCount(Math.max(0, Number(e.target.value) || 0))}
                    aria-label="Executive suite count"
                    className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums disabled:bg-slate-100"
                  />
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={suiteRate}
                    onChange={(e) => setSuiteRate(Math.max(500, Number(e.target.value) || 500))}
                    aria-label="Executive suite nightly rate"
                    className="col-span-4 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
              </div>
              {editingHotelId && (
                <p className="text-xs text-slate-500">
                  {language === 'am'
                    ? 'የክፍሎችን ብዛት ለመጨመር በግራ በኩል ያለውን "ክፍሎች እና ዋጋ" ክፍል ይጠቀሙ።'
                    : 'Updating rates here updates all rooms in each tier. Add extra rooms via Rooms & Rates on the left.'}
                </p>
              )}
            </div>

            {/* 4. Amenities */}
            <div className="border-t border-slate-200 pt-3.5">
              <div className="text-xs font-semibold text-slate-800 mb-2">
                {language === 'am' ? 'የሆቴሉ አገልግሎቶች (Amenities)' : 'Hotel Facilities & Services'}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {AMENITY_OPTIONS.map((item) => (
                  <label key={item} className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amenities.includes(item)}
                      onChange={() => toggleAmenity(item)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {submitting
                ? '...'
                : editingHotelId
                  ? language === 'am'
                    ? 'የሆቴሉን መረጃ እና ዋጋ አዘምን'
                    : 'Save Hotel Profile & Tier Rates'
                  : t.createHotelBtn}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
