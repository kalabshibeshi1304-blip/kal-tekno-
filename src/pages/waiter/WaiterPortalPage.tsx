import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
  CreditCard,
  Minus,
  Plus,
  Receipt,
  Search,
  Send,
  Users,
  Utensils,
  Wine,
} from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type {
  DiningTable,
  FbCategory,
  FbMenuItem,
  FbOrderItem,
  FbSettlementMode,
  PaymentMethod,
  TableArea,
} from '../../types/hotel';
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

const TABLE_AREAS: ('All' | TableArea)[] = ['All', 'Main Dining', 'Terrace', 'VIP Lounge', 'Poolside'];

const FB_CATEGORIES: ('All' | FbCategory)[] = [
  'All',
  'Breakfast',
  'Main Course',
  'Snacks & Pastry',
  'Hot Drinks',
  'Cold Drinks & Juice',
  'Bar & Beverages',
];

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'CBE Transfer', 'Telebirr', 'Awash Bank', 'POS Card Slip'];

function isBarCategory(cat: FbCategory): boolean {
  return cat === 'Hot Drinks' || cat === 'Cold Drinks & Juice' || cat === 'Bar & Beverages';
}

export function WaiterPortalPage() {
  const {
    language,
    t,
    authUser,
    activeHotelId,
    activeUser,
    tables,
    bookings,
    fbMenu,
    fbOrders,
    refreshAll,
    announce,
  } = useHotel();

  const canCreateTable = authUser?.role === 'manager' || authUser?.isCentralAdmin;
  const canOperateWaiter =
    authUser?.role === 'waiter' ||
    authUser?.role === 'reception' ||
    authUser?.role === 'staff' ||
    authUser?.role === 'manager' ||
    authUser?.isCentralAdmin;

  // Table & Channel Selection
  const [areaFilter, setAreaFilter] = useState<'All' | TableArea>('All');
  const [destinationType, setDestinationType] = useState<'table' | 'room'>('table');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestCount, setGuestCount] = useState<number>(2);

  // Menu & Cart
  const [catFilter, setCatFilter] = useState<'All' | FbCategory>('All');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [settlementMode, setSettlementMode] = useState<FbSettlementMode>('Table Tab');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Add New Table Form (Manager)
  const [showAddTable, setShowAddTable] = useState<boolean>(false);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableArea, setNewTableArea] = useState<TableArea>('Main Dining');
  const [newTableSeats, setNewTableSeats] = useState<number>(4);
  const [tableFormError, setTableFormError] = useState<string | null>(null);

  // Settle Open Table Tab State
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('Cash');
  const [settleRef, setSettleRef] = useState<string>('');
  const [settleFreeTable, setSettleFreeTable] = useState<boolean>(true);
  const [settlingBusy, setSettlingBusy] = useState<boolean>(false);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.bookingStatus === 'Checked In'),
    [bookings]
  );

  const filteredTables = useMemo(() => {
    if (areaFilter === 'All') return tables;
    return tables.filter((tb) => tb.area === areaFilter);
  }, [tables, areaFilter]);

  const selectedTable: DiningTable | undefined = useMemo(
    () => tables.find((tb) => tb.id === selectedTableId) || tables[0],
    [tables, selectedTableId]
  );

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return fbMenu.filter((item) => {
      if (catFilter !== 'All' && item.category !== catFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.amharicName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [fbMenu, catFilter, menuSearch]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => {
        const item = fbMenu.find((m) => m.id === menuItemId);
        if (!item) return null;
        return {
          item,
          qty,
          station: isBarCategory(item.category) ? ('bar' as const) : ('kitchen' as const),
          lineTotal: item.price * qty,
        };
      })
      .filter(
        (x): x is { item: FbMenuItem; qty: number; station: 'kitchen' | 'bar'; lineTotal: number } =>
          x !== null
      );
  }, [cart, fbMenu]);

  const kitchenPreview = useMemo(() => cartLines.filter((l) => l.station === 'kitchen'), [cartLines]);
  const barPreview = useMemo(() => cartLines.filter((l) => l.station === 'bar'), [cartLines]);
  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.lineTotal, 0), [cartLines]);

  const activeOrders = useMemo(
    () =>
      fbOrders.filter(
        (o) =>
          o.status !== 'Cancelled' &&
          (!o.isPaid || o.kitchenStatus !== 'Served' || o.barStatus !== 'Served')
      ),
    [fbOrders]
  );

  const openTableTabByTableId = useMemo(() => {
    const map = new Map<string, (typeof fbOrders)[number]>();
    for (const o of fbOrders) {
      if (o.status !== 'Cancelled' && !o.isPaid && o.settlementMode === 'Table Tab' && o.tableId) {
        map.set(o.tableId, o);
      }
    }
    return map;
  }, [fbOrders]);

  const activeTabForSelectedTable = useMemo(() => {
    if (destinationType !== 'table' || !selectedTable) return null;
    return openTableTabByTableId.get(selectedTable.id) || null;
  }, [destinationType, selectedTable, openTableTabByTableId]);

  // KPIs
  const availableTablesCount = tables.filter((tb) => tb.status === 'Available').length;
  const activeTablesCount = tables.filter((tb) => tb.status !== 'Available').length;
  const readyForPickupCount = fbOrders.filter(
    (o) => o.status !== 'Cancelled' && (o.kitchenStatus === 'Ready' || o.barStatus === 'Ready')
  ).length;
  const openTabsTotal = fbOrders
    .filter((o) => o.status !== 'Cancelled' && !o.isPaid && o.settlementMode === 'Table Tab')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const adjustCart = (item: FbMenuItem, delta: number) => {
    setCart((prev) => {
      const current = prev[item.id] || 0;
      const next = Math.max(0, Math.min(item.stockQty, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return { ...prev, [item.id]: next };
    });
  };

  const handleSelectTable = (tb: DiningTable) => {
    setDestinationType('table');
    setSelectedTableId(tb.id);
    if (tb.guestCount > 0) setGuestCount(tb.guestCount);
    if (settlementMode === 'Charge to Room' && !selectedBookingId) {
      setSettlementMode('Table Tab');
    }
  };

  const handleTableQuickStatus = async (tb: DiningTable, status: DiningTable['status']) => {
    await hotelApi.updateTableStatus(activeHotelId, tb.id, {
      status,
      guestCount: status === 'Available' ? 0 : guestCount,
      staffId: activeUser?.id || '',
    });
    await refreshAll();
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTableFormError(null);
    try {
      const created = await hotelApi.createTable(activeHotelId, {
        tableNumber: newTableNumber,
        area: newTableArea,
        seats: newTableSeats,
        staffId: activeUser?.id || '',
      });
      setSelectedTableId(created.id);
      setNewTableNumber('');
      setShowAddTable(false);
      await refreshAll();
    } catch (err) {
      setTableFormError(err instanceof Error ? err.message : 'Unable to add table');
    }
  };

  const handleSendTablesideOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartLines.length === 0) {
      setOrderError(
        language === 'am' ? 'እባክዎ ቢያንስ አንድ ምግብ ወይም መጠጥ ይምረጡ።' : 'Select at least one food or drink item.'
      );
      return;
    }

    const activeBooking = activeBookings.find((b) => b.id === selectedBookingId);
    const targetTable = destinationType === 'table' ? selectedTable : undefined;

    if (destinationType === 'room' && !activeBooking) {
      setOrderError(
        language === 'am' ? 'እባክዎ የእንግዳውን ክፍል ይምረጡ።' : 'Select an occupied room for room service.'
      );
      return;
    }

    const locationLabel =
      destinationType === 'room' && activeBooking
        ? `Room ${activeBooking.roomNumber}`
        : targetTable?.tableNumber || 'T-01';

    setSubmitting(true);
    setOrderError(null);
    try {
      const created = await hotelApi.placeWaiterOrder(activeHotelId, {
        channel: destinationType === 'room' ? 'Room Service' : 'Dine-In',
        tableId: targetTable?.id || null,
        tableOrLocation: locationLabel,
        bookingId: activeBooking?.id || null,
        guestName:
          guestName.trim() ||
          activeBooking?.guestName ||
          (destinationType === 'table' ? `Table ${locationLabel} Guest` : 'Hotel Guest'),
        guestCount,
        items: cartLines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
        settlementMode,
        paymentMethod,
        referenceNumber,
        notes: orderNotes,
        staffId: activeUser?.id || '',
      });

      await refreshAll();
      const foodCount = kitchenPreview.reduce((s, l) => s + l.qty, 0);
      const drinkCount = barPreview.reduce((s, l) => s + l.qty, 0);
      const rounds = created.roundCount || 1;
      if (rounds > 1) {
        announce(
          `Added Round #${rounds} to ${created.tableOrLocation} single bill (Total ${created.totalAmount.toLocaleString()} ETB).`,
          `በ${created.tableOrLocation} ክፍት ቢል ላይ ዙር #${rounds} ተጨምሯል (ጠቅላላ ${created.totalAmount.toLocaleString()} ብር)።`,
          'success'
        );
      } else {
        announce(
          `Order sent for ${created.tableOrLocation}: ${foodCount} to Kitchen, ${drinkCount} to Bar.`,
          `የ${created.tableOrLocation} ትዕዛዝ ተልኳል፤ ${foodCount} ምግብ ወደ ኪችን፣ ${drinkCount} መጠጥ ወደ ባር ተላልፏል።`,
          'success'
        );
      }

      setCart({});
      setOrderNotes('');
      setReferenceNumber('');
      setGuestName('');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Order dispatch failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestBill = async (orderId: string) => {
    setSettlingBusy(true);
    try {
      const updated = await hotelApi.requestOrderBill(activeHotelId, orderId, {
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Bill requested at Cashier for ${updated.tableOrLocation} (${updated.totalAmount.toLocaleString()} ETB).`,
        `ለ${updated.tableOrLocation} (${updated.totalAmount.toLocaleString()} ብር) የሂሳብ ደረሰኝ ወደ ካሸር ተልኳል።`,
        'info'
      );
    } finally {
      setSettlingBusy(false);
    }
  };

  const handleSettleOrderSubmit = async (orderId: string) => {
    setSettlingBusy(true);
    try {
      const settled = await hotelApi.settleTableOrder(activeHotelId, orderId, {
        paymentMethod: settleMethod,
        referenceNumber: settleRef,
        freeTable: settleFreeTable,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Settled ${settled.tableOrLocation} tab (${settled.totalAmount.toLocaleString()} ETB).`,
        `የ${settled.tableOrLocation} ሂሳብ (${settled.totalAmount.toLocaleString()} ብር) በ${settleMethod} ተከፍሏል።`,
        'success'
      );
      setSettlingOrderId(null);
      setSettleRef('');
    } finally {
      setSettlingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ክፍት ጠረጴዛዎች' : 'Available Tables'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {availableTablesCount} / {tables.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? `${activeTablesCount} በአገልግሎት ላይ` : `${activeTablesCount} seated or active`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ለማድረስ ዝግጁ (ኪችን/ባር)' : 'Ready to Pick Up'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {readyForPickupCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ምግብ ወይም መጠጥ ተዘጋጅቷል' : 'Kitchen or bar tickets marked Ready'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ክፍት የጠረጴዛ ሂሳቦች (Open Tabs)' : 'Open Table Tabs'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {openTabsTotal.toLocaleString()} {t.currency}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'እስካሁን ያልተዘጋ ሂሳብ' : 'Awaiting settlement at table'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'በሂደት ላይ ያሉ ትዕዛዞች' : 'Active Tableside Orders'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {activeOrders.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ቀጥታ ወደ ኪችን እና ባር የተላኩ' : 'Synced live with Kitchen & Bar'}
          </div>
        </div>
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Floor Tables + Active Order Status Tracker */}
        <div className="xl:col-span-5 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {language === 'am' ? 'የጠረጴዛዎች ሁኔታ' : 'Dining Floor Tables'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'am'
                      ? 'ከስተመር ጋር ሆነው ትዕዛዝ ለመውሰድ ጠረጴዛ ይምረጡ'
                      : 'Tap a table right beside guests to open a tableside order'}
                  </p>
                </div>
                {canCreateTable && (
                  <button
                    type="button"
                    onClick={() => setShowAddTable((v) => !v)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {showAddTable ? (language === 'am' ? 'ዝጋ' : 'Close') : language === 'am' ? '+ ጠረጴዛ' : '+ Add Table'}
                  </button>
                )}
              </div>

              {showAddTable && (
                <form
                  onSubmit={handleCreateTable}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5"
                >
                  {tableFormError && (
                    <div className="text-xs font-medium text-red-700">{tableFormError}</div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                      placeholder="T-09"
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase"
                    />
                    <select
                      value={newTableArea}
                      onChange={(e) => setNewTableArea(e.target.value as TableArea)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      {TABLE_AREAS.filter((a) => a !== 'All').map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newTableSeats}
                      onChange={(e) => setNewTableSeats(Number(e.target.value) || 4)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    {language === 'am' ? 'ጠረጴዛ መዝግብ' : 'Save New Table'}
                  </button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {TABLE_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter(area)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      areaFilter === area
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {filteredTables.map((tb) => {
                const isSelected = destinationType === 'table' && selectedTable?.id === tb.id;
                const openTab = openTableTabByTableId.get(tb.id);
                const statusTextColor =
                  tb.status === 'Order Active'
                    ? 'text-amber-700'
                    : tb.status === 'Seated'
                      ? 'text-blue-700'
                      : tb.status === 'Needs Bill'
                        ? 'text-red-700'
                        : 'text-emerald-700';

                return (
                  <div
                    key={tb.id}
                    onClick={() => handleSelectTable(tb)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectTable(tb);
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {tb.tableNumber}
                      </span>
                      <span className={`text-xs font-semibold ${statusTextColor}`}>{tb.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {tb.area} · <span className="font-mono tabular-nums">{tb.seats}</span> seats
                    </div>
                    {openTab ? (
                      <div className="mt-1 flex items-center justify-between text-xs font-mono font-semibold text-amber-800 tabular-nums">
                        <span>{openTab.totalAmount.toLocaleString()} {t.currency}</span>
                        <span className="text-[11px] font-sans text-slate-500">
                          {openTab.roundCount || 1} {language === 'am' ? 'ዙር' : 'rd'}
                        </span>
                      </div>
                    ) : (
                      tb.assignedWaiterName && (
                        <div className="mt-1 text-xs text-slate-600 truncate">
                          {tb.assignedWaiterName} · {tb.guestCount} guests
                        </div>
                      )
                    )}
                    {canOperateWaiter && (
                      <div
                        className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tb.status === 'Available' ? (
                          <button
                            type="button"
                            onClick={() => void handleTableQuickStatus(tb, 'Seated')}
                            className="text-xs font-medium text-slate-700 hover:text-amber-700"
                          >
                            {language === 'am' ? 'እንግዳ አስቀምጥ' : 'Seat Guests'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleTableQuickStatus(tb, 'Available')}
                            className="text-xs font-medium text-slate-600 hover:text-emerald-700"
                          >
                            {language === 'am' ? 'ክፍት አድርግ' : 'Mark Free'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Active Table Orders & Kitchen/Bar Tracking */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የኪችን እና ባር ሁኔታ ክትትል' : 'Live Kitchen & Bar Tracker'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'ምግብ እና መጠጥ መድረሱን ተከታትለው ሂሳብ ይዝጉ'
                    : 'Track prep progress per station and settle open table tabs'}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">{activeOrders.length}</span>
            </div>

            {activeOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {activeOrders.map((ord) => {
                  const isSettlingThis = settlingOrderId === ord.id;
                  return (
                    <div key={ord.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          <span className="font-mono">{ord.tableOrLocation}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-normal text-slate-600">{ord.guestName}</span>
                          {(ord.roundCount || 1) > 1 && (
                            <>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="font-mono text-amber-700">
                                {ord.roundCount} {language === 'am' ? 'ዙሮች (1 ቢል)' : 'rounds (1 bill)'}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {ord.totalAmount.toLocaleString()} {t.currency}
                        </span>
                      </div>

                      {/* Station Breakdown Status */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {ord.kitchenStatus && ord.kitchenStatus !== 'None' && (
                          <span className="inline-flex items-center gap-1.5">
                            <ChefHat className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-slate-600">Kitchen:</span>
                            <span
                              className={`font-semibold ${
                                ord.kitchenStatus === 'Ready'
                                  ? 'text-emerald-700'
                                  : ord.kitchenStatus === 'Preparing'
                                    ? 'text-amber-700'
                                    : 'text-slate-800'
                              }`}
                            >
                              {ord.kitchenStatus}
                            </span>
                          </span>
                        )}
                        {ord.barStatus && ord.barStatus !== 'None' && (
                          <span className="inline-flex items-center gap-1.5">
                            <Wine className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-slate-600">Bar:</span>
                            <span
                              className={`font-semibold ${
                                ord.barStatus === 'Ready'
                                  ? 'text-emerald-700'
                                  : ord.barStatus === 'Preparing'
                                    ? 'text-amber-700'
                                    : 'text-slate-800'
                              }`}
                            >
                              {ord.barStatus}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600">
                        {summarizeBillItems(ord.items)
                          .map((it) => `${it.quantity}x ${language === 'am' ? it.amharicName : it.name}`)
                          .join(' · ')}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs">
                        <div className="space-y-0.5">
                          <span
                            className={
                              ord.isPaid
                                ? 'font-medium text-emerald-700'
                                : ord.billStatus === 'Bill Requested'
                                  ? 'font-semibold text-red-700'
                                  : 'font-medium text-amber-700'
                            }
                          >
                            {ord.isPaid
                              ? `${language === 'am' ? 'ተከፍሏል' : 'Paid'} · ${ord.paymentMethod}`
                              : ord.billStatus === 'Bill Requested'
                                ? language === 'am'
                                  ? 'ለካሸር ሂሳብ ተጠይቋል (Bill Requested)'
                                  : 'Bill Sent to Cashier'
                                : ord.settlementMode === 'Charge to Room'
                                  ? language === 'am'
                                    ? 'በክፍል ሂሳብ'
                                    : 'Room Folio'
                                  : language === 'am'
                                    ? 'ክፍት ሂሳብ (Open Tab)'
                                    : 'Open Table Tab'}
                          </span>
                          {(ord.cashierName || ord.paymentId) && (
                            <div className="font-mono text-[11px] text-slate-500">
                              {ord.cashierName ? `Cashier: ${ord.cashierName}` : ''}
                              {ord.cashierName && ord.paymentId ? ' · ' : ''}
                              {ord.paymentId ? ord.paymentId : ''}
                            </div>
                          )}
                        </div>

                        {!ord.isPaid && ord.settlementMode === 'Table Tab' && canOperateWaiter && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ord.billStatus !== 'Bill Requested' && (
                              <button
                                type="button"
                                disabled={settlingBusy}
                                onClick={() => void handleRequestBill(ord.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                <Receipt className="h-3.5 w-3.5" />
                                <span>{language === 'am' ? 'ለካሸር ሂሳብ ላክ' : 'Send Bill to Cashier'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSettlingOrderId(isSettlingThis ? null : ord.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{language === 'am' ? 'ሂሳብ ዝጋ' : 'Settle Bill'}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {isSettlingThis && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                              value={settleMethod}
                              onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                            >
                              {PAYMENT_METHODS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={settleRef}
                              onChange={(e) => setSettleRef(e.target.value)}
                              placeholder="Ref / Bank Receipt #"
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={settleFreeTable}
                              onChange={(e) => setSettleFreeTable(e.target.checked)}
                            />
                            <span>
                              {language === 'am'
                                ? 'ክፍያው ሲፈጸም ጠረጴዛውን ክፍት አድርግ'
                                : 'Release table to Available after payment'}
                            </span>
                          </label>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSettlingOrderId(null)}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
                            >
                              {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                            </button>
                            <button
                              type="button"
                              disabled={settlingBusy}
                              onClick={() => void handleSettleOrderSubmit(ord.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{language === 'am' ? 'ክፍያ አረጋግጥ' : 'Confirm Payment'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right 7 cols: Tableside Customer Order Pad */}
        <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am'
                    ? 'ከስተመር ጋር ሆኖ ትዕዛዝ መውሰጃ (Tableside Order Pad)'
                    : 'Tableside Order Pad · Auto Kitchen & Bar Routing'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'ምግብ እና መጠጥ በአንድ ላይ ይምረጡ — ሲስተሙ በራሱ ለኪችን እና ለባር ይለያቸዋል'
                    : 'Add food & drinks together — food routes to Kitchen Display, drinks route to Bar Display'}
                </p>
              </div>

              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationType('table');
                    if (settlementMode === 'Charge to Room' && !selectedBookingId) {
                      setSettlementMode('Table Tab');
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
                    destinationType === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5" />
                  <span>{language === 'am' ? 'ጠረጴዛ' : 'Table'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDestinationType('room');
                    setSettlementMode('Charge to Room');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
                    destinationType === 'room' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{language === 'am' ? 'ክፍል አገልግሎት' : 'Room Service'}</span>
                </button>
              </div>
            </div>

            {/* Destination Summary Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {destinationType === 'table' ? (
                <div>
                  <label htmlFor="wt-table" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የተመረጠ ጠረጴዛ' : 'Dining Table'}
                  </label>
                  <select
                    id="wt-table"
                    value={selectedTable?.id || ''}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-amber-600 focus:outline-none"
                  >
                    {tables.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.tableNumber} · {tb.area} ({tb.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="wt-room" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ያለ እንግዳ ክፍል' : 'Occupied Guest Room'}
                  </label>
                  <select
                    id="wt-room"
                    value={selectedBookingId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedBookingId(id);
                      const bk = activeBookings.find((b) => b.id === id);
                      if (bk) setGuestName(bk.guestName);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-amber-600 focus:outline-none"
                  >
                    <option value="">{language === 'am' ? 'ክፍል ይምረጡ...' : 'Select checked-in room...'}</option>
                    {activeBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        Room {b.roomNumber} · {b.guestName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="wt-guests" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የእንግዳ ብዛት' : 'Guest Count'}
                </label>
                <input
                  id="wt-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="wt-search" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'ሜኑ ፈልግ' : 'Search Menu'}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    id="wt-search"
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder={language === 'am' ? 'ጥብስ፣ ቡና፣ ቢራ...' : 'Tibs, Macchiato, Beer...'}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              {FB_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    catFilter === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items Tap Grid */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 max-h-[340px] overflow-y-auto">
            {filteredMenu.map((item) => {
              const qty = cart[item.id] || 0;
              const disabled = !item.isAvailable || item.stockQty <= 0;
              const toBar = isBarCategory(item.category);
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                    qty > 0
                      ? 'border-amber-500 bg-amber-50/40'
                      : disabled
                        ? 'border-slate-200 bg-slate-50 opacity-60'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={toBar ? 'text-indigo-700 font-medium' : 'text-amber-800 font-medium'}>
                        {toBar ? (language === 'am' ? 'ባር' : 'Bar') : language === 'am' ? 'ኪችን' : 'Kitchen'}
                      </span>
                      <span>·</span>
                      <span className="truncate">{item.category}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{item.stockQty}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 truncate mt-0.5">
                      {language === 'am' ? item.amharicName : item.name}
                    </div>
                    <div className="font-mono text-xs font-semibold text-emerald-700 tabular-nums mt-0.5">
                      {item.price.toLocaleString()} {t.currency}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => adjustCart(item, -1)}
                          className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={!canOperateWaiter || disabled || qty >= item.stockQty}
                      onClick={() => adjustCart(item, 1)}
                      className="rounded-md bg-slate-900 p-1.5 text-white hover:bg-slate-800 disabled:opacity-40"
                      aria-label="Add"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Automatic Station Routing Preview + Checkout */}
          <form onSubmit={handleSendTablesideOrder} className="p-5 space-y-4">
            {orderError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {orderError}
              </div>
            )}

            {cartLines.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 pb-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                    <span className="inline-flex items-center gap-1.5">
                      <ChefHat className="h-3.5 w-3.5" />
                      <span>{language === 'am' ? 'ወደ ኪችን (Kitchen)' : 'Route to Kitchen'}</span>
                    </span>
                    <span className="font-mono tabular-nums">{kitchenPreview.length}</span>
                  </div>
                  {kitchenPreview.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      {language === 'am' ? 'የምግብ ትዕዛዝ የለም' : 'No food items'}
                    </div>
                  ) : (
                    kitchenPreview.map((l) => (
                      <div key={l.item.id} className="flex justify-between text-xs text-slate-800">
                        <span>
                          <span className="font-mono font-semibold">{l.qty}x</span>{' '}
                          {language === 'am' ? l.item.amharicName : l.item.name}
                        </span>
                        <span className="font-mono tabular-nums">{l.lineTotal.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                    <span className="inline-flex items-center gap-1.5">
                      <Wine className="h-3.5 w-3.5" />
                      <span>{language === 'am' ? 'ወደ ባር (Bar)' : 'Route to Bar'}</span>
                    </span>
                    <span className="font-mono tabular-nums">{barPreview.length}</span>
                  </div>
                  {barPreview.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      {language === 'am' ? 'የመጠጥ ትዕዛዝ የለም' : 'No bar drinks'}
                    </div>
                  ) : (
                    barPreview.map((l) => (
                      <div key={l.item.id} className="flex justify-between text-xs text-slate-800">
                        <span>
                          <span className="font-mono font-semibold">{l.qty}x</span>{' '}
                          {language === 'am' ? l.item.amharicName : l.item.name}
                        </span>
                        <span className="font-mono tabular-nums">{l.lineTotal.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="wt-settle" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የሂሳብ አያያዝ' : 'Billing Mode'}
                </label>
                <select
                  id="wt-settle"
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value as FbSettlementMode)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                >
                  <option value="Table Tab">
                    {language === 'am' ? 'የጠረጴዛ ክፍት ሂሳብ (Open Tab)' : 'Open Table Tab (Pay Later)'}
                  </option>
                  <option value="Immediate Payment">
                    {language === 'am' ? 'ወዲያውኑ ክፍያ' : 'Immediate Payment'}
                  </option>
                  <option value="Charge to Room" disabled={destinationType !== 'room' || !selectedBookingId}>
                    {language === 'am' ? 'ወደ ክፍል ሂሳብ ጨምር' : 'Charge to Room Folio'}
                  </option>
                </select>
              </div>

              {settlementMode === 'Immediate Payment' ? (
                <>
                  <div>
                    <label htmlFor="wt-paymethod" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.paymentMethod}
                    </label>
                    <select
                      id="wt-paymethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="wt-ref" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.receiptRef}
                    </label>
                    <input
                      id="wt-ref"
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="CSH / TLB / FT..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-amber-600 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label htmlFor="wt-guestname" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የእንግዳ ስም (ካለ)' : 'Guest Name (Optional)'}
                  </label>
                  <input
                    id="wt-guestname"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={language === 'am' ? 'የእንግዳ ስም...' : 'Walk-in / VIP guest name...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="wt-notes" className="block text-xs font-medium text-slate-700 mb-1">
                {language === 'am' ? 'ልዩ የዝግጅት ማስታወሻ (ለኪችን እና ለባር)' : 'Special Prep Notes (Kitchen & Bar)'}
              </label>
              <input
                id="wt-notes"
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={
                  language === 'am'
                    ? 'ምሳሌ፡ በርበሬ ሳይበዛ፣ መጠጡ ከምግብ በፊት ይቅረብ...'
                    : 'e.g. Medium rare, less chili, serve drinks first...'
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
              />
            </div>

            {activeTabForSelectedTable && settlementMode === 'Table Tab' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
                <div>
                  <span className="font-semibold">
                    {language === 'am'
                      ? `ጠረጴዛ ${selectedTable?.tableNumber} ክፍት ቢል አለው (${activeTabForSelectedTable.roundCount || 1} ዙር)`
                      : `Open Consolidated Bill on ${selectedTable?.tableNumber} (${activeTabForSelectedTable.roundCount || 1} round${(activeTabForSelectedTable.roundCount || 1) > 1 ? 's' : ''})`}
                  </span>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    {language === 'am'
                      ? 'ጠረጴዛው እስካልተዘጋ ድረስ አዲስ ትዕዛዞች በዚሁ አንድ ቢል ላይ ይጠቀለላሉ።'
                      : 'Repeat orders consolidate automatically onto this single bill until the table is settled.'}
                  </div>
                </div>
                <span className="font-mono font-bold tabular-nums text-amber-900">
                  {activeTabForSelectedTable.totalAmount.toLocaleString()} {t.currency}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canOperateWaiter || submitting || cartLines.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>
                {submitting
                  ? '...'
                  : activeTabForSelectedTable && settlementMode === 'Table Tab'
                    ? language === 'am'
                      ? `ወደ አንድ ቢል ጨምር (+${cartTotal.toLocaleString()} → ${(activeTabForSelectedTable.totalAmount + cartTotal).toLocaleString()} ብር)`
                      : `Add Round to Single Bill (+${cartTotal.toLocaleString()} → ${(activeTabForSelectedTable.totalAmount + cartTotal).toLocaleString()} ETB)`
                    : `${language === 'am' ? 'ወደ ኪችን እና ባር ትዕዛዝ ላክ' : 'Dispatch Order to Kitchen & Bar'} · ${cartTotal.toLocaleString()} ${t.currency}`}
              </span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
