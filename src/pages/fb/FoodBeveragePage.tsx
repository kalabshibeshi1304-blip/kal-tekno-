import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type {
  FbCategory,
  FbMenuItem,
  FbOrderStatus,
  FbServiceChannel,
  FbSettlementMode,
  PaymentMethod,
} from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const FB_CATEGORIES: FbCategory[] = [
  'Breakfast',
  'Main Course',
  'Snacks & Pastry',
  'Hot Drinks',
  'Cold Drinks & Juice',
  'Bar & Beverages',
];

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'CBE Transfer', 'Telebirr', 'Awash Bank', 'POS Card Slip'];

export function FoodBeveragePage() {
  const {
    language,
    t,
    activeHotelId,
    activeHotel,
    activeUser,
    bookings,
    fbMenu,
    fbOrders,
    refreshAll,
    announce,
  } = useHotel();

  const [viewMode, setViewMode] = useState<'pos' | 'menu'>('pos');
  const [catFilter, setCatFilter] = useState<'All' | FbCategory>('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | FbOrderStatus>('All');

  // POS Cart & Order Form State
  const [cart, setCart] = useState<Record<string, number>>({});
  const [channel, setChannel] = useState<FbServiceChannel>('Dine-In');
  const [tableOrLocation, setTableOrLocation] = useState('Table 01');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [settlementMode, setSettlementMode] = useState<FbSettlementMode>('Immediate Payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Add Menu Item Form State
  const [itemName, setItemName] = useState('');
  const [itemAmharicName, setItemAmharicName] = useState('');
  const [itemCategory, setItemCategory] = useState<FbCategory>('Main Course');
  const [itemPrice, setItemPrice] = useState<number>(450);
  const [itemStock, setItemStock] = useState<number>(25);
  const [itemUnit, setItemUnit] = useState('Plate');
  const [menuSubmitting, setMenuSubmitting] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Inline Menu Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState<number>(0);
  const [draftStock, setDraftStock] = useState<number>(0);

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.bookingStatus === 'Checked In'),
    [bookings]
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

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'All') return fbOrders;
    return fbOrders.filter((o) => o.status === orderFilter);
  }, [fbOrders, orderFilter]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => {
        const item = fbMenu.find((m) => m.id === menuItemId);
        return item ? { item, qty, lineTotal: item.price * qty } : null;
      })
      .filter((x): x is { item: FbMenuItem; qty: number; lineTotal: number } => x !== null);
  }, [cart, fbMenu]);

  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);

  // KPIs
  const activeMenuCount = fbMenu.filter((m) => m.isAvailable && m.stockQty > 0).length;
  const openOrdersCount = fbOrders.filter((o) => o.status === 'Pending' || o.status === 'Preparing').length;
  const fbRevenue = fbOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const lowStockCount = fbMenu.filter((m) => m.stockQty <= 5).length;

  const adjustCartQty = (item: FbMenuItem, delta: number) => {
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

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartLines.length === 0) {
      setOrderError(language === 'am' ? 'እባክዎ ቢያንስ አንድ ምግብ ወይም መጠጥ ይምረጡ።' : 'Add at least one item to the order.');
      return;
    }
    setOrderSubmitting(true);
    setOrderError(null);

    try {
      const created = await hotelApi.createFbOrder(activeHotelId, {
        channel,
        tableOrLocation,
        bookingId: selectedBookingId || null,
        guestName: guestName || (channel === 'Bar Counter' ? 'Bar Guest' : 'Restaurant Guest'),
        items: cartLines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
        settlementMode,
        paymentMethod,
        referenceNumber,
        notes: orderNotes,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `F&B order ${created.tableOrLocation} (${created.totalAmount.toLocaleString()} ETB) sent to kitchen/bar.`,
        `የምግብ እና መጠጥ ትዕዛዝ ${created.tableOrLocation} (${created.totalAmount.toLocaleString()} ብር) ተመዝግቧል።`,
        'success'
      );
      setCart({});
      setReferenceNumber('');
      setOrderNotes('');
      setGuestName('');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Unable to submit order');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleOrderStatus = async (orderId: string, status: FbOrderStatus) => {
    await hotelApi.updateFbOrderStatus(activeHotelId, orderId, {
      status,
      staffId: activeUser?.id || '',
    });
    await refreshAll();
    if (status === 'Served') {
      announce(
        `Order ${orderId} marked Served.`,
        `የምግብ/መጠጥ ትዕዛዝ ${orderId} ተሰጥቷል።`,
        'success'
      );
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuSubmitting(true);
    setMenuError(null);
    try {
      const created = await hotelApi.createFbMenuItem(activeHotelId, {
        name: itemName,
        amharicName: itemAmharicName || itemName,
        category: itemCategory,
        price: itemPrice,
        stockQty: itemStock,
        unit: itemUnit,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Added ${created.name} (${created.price} ETB) to menu.`,
        `${created.amharicName} በ${created.price} ብር ወደ ሜኑ ተጨምሯል።`,
        'success'
      );
      setItemName('');
      setItemAmharicName('');
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Unable to add menu item');
    } finally {
      setMenuSubmitting(false);
    }
  };

  const handleToggleAvailable = async (item: FbMenuItem) => {
    await hotelApi.updateFbMenuItem(activeHotelId, item.id, {
      isAvailable: !item.isAvailable,
      staffId: activeUser?.id || '',
    });
    await refreshAll();
  };

  const handleRestock = async (item: FbMenuItem, addQty: number) => {
    await hotelApi.updateFbMenuItem(activeHotelId, item.id, {
      stockQty: item.stockQty + addQty,
      isAvailable: true,
      staffId: activeUser?.id || '',
    });
    await refreshAll();
  };

  const handleSaveMenuEdit = async (itemId: string) => {
    await hotelApi.updateFbMenuItem(activeHotelId, itemId, {
      price: draftPrice,
      stockQty: draftStock,
      isAvailable: draftStock > 0,
      staffId: activeUser?.id || '',
    });
    setEditingItemId(null);
    await refreshAll();
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    await hotelApi.deleteFbMenuItem(activeHotelId, itemId);
    await refreshAll();
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ዝግጁ የምግብ እና መጠጥ አይነቶች' : 'Active Menu Items'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {activeMenuCount} / {fbMenu.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'በዝግጅት ላይ ያሉ ትዕዛዞች' : 'Open Kitchen & Bar Orders'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {openOrdersCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'በመጠባበቅ እና በዝግጅት ላይ' : 'Pending & preparing'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የምግብ እና መጠጥ ሽያጭ ገቢ' : 'F&B Sales Total'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {fbRevenue.toLocaleString()} {t.currency}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {fbOrders.filter((o) => o.status !== 'Cancelled').length}{' '}
            {language === 'am' ? 'ትዕዛዞች' : 'orders recorded'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ክምችታቸው ያለቀ / አነስተኛ' : 'Low-Stock Menu Alerts'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {lowStockCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? '5 እና ከዚያ በታች የቀራቸው' : 'Items with <= 5 servings left'}
          </div>
        </div>
      </section>

      {/* Top Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('pos')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              viewMode === 'pos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{language === 'am' ? 'ትዕዛዝ መቀበያ እና ኩሽና' : 'Order Desk & Kitchen Queue'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('menu')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              viewMode === 'menu' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>{language === 'am' ? 'የምግብ/መጠጥ ሜኑ እና ክምችት' : 'Menu & Stock Management'}</span>
          </button>
        </div>
      </div>

      {viewMode === 'pos' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left (7 cols): Menu Selector + Cart Checkout */}
          <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {language === 'am' ? 'የሆቴሉ ምግብ እና መጠጥ ማዘዣ' : 'Hotel Restaurant, Bar & Room Service POS'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'am'
                      ? 'ምግብ እና መጠጥ መርጠው በቀጥታ ክፍያ ወይም በእንግዳው ክፍል ሂሳብ ላይ ይጨምሩ'
                      : 'Select items for dine-in, bar counter, or charge directly to a guest room folio'}
                  </p>
                </div>
                <div className="relative w-full sm:w-52">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder={language === 'am' ? 'ሜኑ ፈልግ...' : 'Search menu...'}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {(['All', ...FB_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      catFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Grid */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-200 max-h-[360px] overflow-y-auto">
              {filteredMenu.map((item) => {
                const qty = cart[item.id] || 0;
                const disabled = !item.isAvailable || item.stockQty <= 0;
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
                      <div className="text-xs text-slate-500">
                        {item.category} · <span className="font-mono tabular-nums">{item.stockQty} {item.unit}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate">
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
                            onClick={() => adjustCartQty(item, -1)}
                            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                            aria-label="Decrease quantity"
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
                        disabled={disabled || qty >= item.stockQty}
                        onClick={() => adjustCartQty(item, 1)}
                        className="rounded-md bg-slate-900 p-1.5 text-white hover:bg-slate-800 disabled:opacity-40"
                        aria-label="Add item"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Checkout Form */}
            <form onSubmit={handleSubmitOrder} className="p-5 space-y-4">
              {orderError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {orderError}
                </div>
              )}

              {cartLines.length > 0 && (
                <div className="border-b border-slate-200 pb-3 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800">
                    {language === 'am' ? 'የተመረጡ ትዕዛዞች' : 'Selected Items'}
                  </div>
                  {cartLines.map((l) => (
                    <div key={l.item.id} className="flex items-center justify-between text-xs text-slate-700">
                      <span>
                        <span className="font-mono font-semibold">{l.qty}x</span>{' '}
                        {language === 'am' ? l.item.amharicName : l.item.name}
                      </span>
                      <span className="font-mono tabular-nums font-medium">
                        {l.lineTotal.toLocaleString()} {t.currency}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-sm font-semibold text-slate-900">
                    <span>{language === 'am' ? 'ጠቅላላ ሂሳብ' : 'Order Total'}</span>
                    <span className="font-mono tabular-nums">
                      {cartTotal.toLocaleString()} {t.currency}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="fb-chan" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የአገልግሎት ቦታ' : 'Service Channel'}
                  </label>
                  <select
                    id="fb-chan"
                    value={channel}
                    onChange={(e) => {
                      const val = e.target.value as FbServiceChannel;
                      setChannel(val);
                      if (val === 'Room Service') {
                        setSettlementMode('Charge to Room');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="Dine-In">Dine-In (Restaurant)</option>
                    <option value="Bar Counter">Bar Counter</option>
                    <option value="Room Service">Room Service</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fb-room" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ክፍል (ካለ)' : 'Link Occupied Room'}
                  </label>
                  <select
                    id="fb-room"
                    value={selectedBookingId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedBookingId(id);
                      const bk = activeBookings.find((b) => b.id === id);
                      if (bk) {
                        setTableOrLocation(`Room ${bk.roomNumber}`);
                        setGuestName(bk.guestName);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="">
                      {language === 'am' ? 'የውጭ እንግዳ (Walk-In)' : 'Walk-in / Non-Room Guest'}
                    </option>
                    {activeBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        Room {b.roomNumber} · {b.guestName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="fb-loc" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ጠረጴዛ / ቦታ' : 'Table / Room #'}
                  </label>
                  <input
                    id="fb-loc"
                    type="text"
                    required
                    value={tableOrLocation}
                    onChange={(e) => setTableOrLocation(e.target.value)}
                    placeholder="Table 03 / Room 201"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="fb-settle" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የክፍያ ሁኔታ' : 'Settlement Mode'}
                  </label>
                  <select
                    id="fb-settle"
                    value={settlementMode}
                    onChange={(e) => setSettlementMode(e.target.value as FbSettlementMode)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="Immediate Payment">
                      {language === 'am' ? 'ወዲያውኑ ክፍያ' : 'Immediate Payment'}
                    </option>
                    <option value="Table Tab">
                      {language === 'am' ? 'የጠረጴዛ ክፍት ቢል (ጠቅልሎ መክፈያ)' : 'Open Table Tab (Consolidate on Table)'}
                    </option>
                    <option value="Charge to Room" disabled={!selectedBookingId}>
                      {language === 'am' ? 'ወደ ክፍል ሂሳብ ጨምር' : 'Charge to Room Folio'}
                    </option>
                  </select>
                </div>

                {settlementMode === 'Immediate Payment' ? (
                  <>
                    <div>
                      <label htmlFor="fb-method" className="block text-xs font-medium text-slate-700 mb-1">
                        {t.paymentMethod}
                      </label>
                      <select
                        id="fb-method"
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
                      <label htmlFor="fb-ref" className="block text-xs font-medium text-slate-700 mb-1">
                        {t.receiptRef}
                      </label>
                      <input
                        id="fb-ref"
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="CSH / TLB / FT..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 flex items-end">
                    <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {language === 'am'
                        ? 'ይህ ሂሳብ በእንግዳው የክፍል ቀሪ ሂሳብ ላይ ይጨመራል (Check-Out ላይ ይከፈላል)።'
                        : 'Charges will be added automatically to the guest room balance at Check-Out.'}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={language === 'am' ? 'የእንግዳ ስም (ካለ)...' : 'Guest name (optional)...'}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={language === 'am' ? 'የኩሽና ማስታወሻ...' : 'Kitchen / bar preparation notes...'}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={orderSubmitting || cartLines.length === 0}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {orderSubmitting
                  ? '...'
                  : `${language === 'am' ? 'ትዕዛዝ አስገባ' : 'Place F&B Order'} · ${cartTotal.toLocaleString()} ${t.currency}`}
              </button>
            </form>
          </section>

          {/* Right (5 cols): Kitchen / Bar / Room Service Orders Queue */}
          <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'የኩሽና እና ባር ትዕዛዞች' : 'Kitchen & Bar Order Queue'}
              </h2>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                {(['All', 'Pending', 'Preparing', 'Served'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderFilter(st)}
                    className={`px-2 py-1 rounded-md font-medium ${
                      orderFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredOrders.map((ord) => (
                  <div key={ord.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-900">{ord.tableOrLocation}</span>
                        <span className="mx-1.5">·</span>
                        <span>{ord.channel}</span>
                      </span>
                      <span
                        className={`font-medium ${
                          ord.status === 'Served'
                            ? 'text-emerald-700'
                            : ord.status === 'Preparing'
                              ? 'text-amber-700'
                              : ord.status === 'Cancelled'
                                ? 'text-red-700'
                                : 'text-slate-700'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-0.5">
                      {ord.items.map((it, idx) => (
                        <div key={`${ord.id}-${it.menuItemId}-${idx}`} className="flex justify-between">
                          <span>
                            <span className="font-mono font-semibold">{it.quantity}x</span>{' '}
                            {language === 'am' ? it.amharicName : it.name}
                            {(ord.roundCount || 1) > 1 && it.round ? (
                              <span className="ml-1.5 font-mono text-[10px] text-slate-400">R{it.round}</span>
                            ) : null}
                          </span>
                          <span className="font-mono tabular-nums">
                            {it.lineTotal.toLocaleString()} {t.currency}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs">
                      <div className="text-slate-500">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {ord.totalAmount.toLocaleString()} {t.currency}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>{ord.paymentMethod}</span>
                        {ord.billStatus && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span
                              className={`font-medium ${
                                ord.billStatus === 'Paid'
                                  ? 'text-emerald-700'
                                  : ord.billStatus === 'Bill Requested'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {ord.billStatus}
                            </span>
                          </>
                        )}
                        {ord.cashierName && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>{ord.cashierName}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ord.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(ord.id, 'Preparing')}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {language === 'am' ? 'ማዘጋጀት ጀምር' : 'Prepare'}
                          </button>
                        )}
                        {(ord.status === 'Pending' || ord.status === 'Preparing') && (
                          <button
                            type="button"
                            onClick={() => handleOrderStatus(ord.id, 'Served')}
                            className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                          >
                            {language === 'am' ? 'ተሰጥቷል' : 'Mark Served'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Menu & Inventory Management View */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <section className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'አዲስ ምግብ / መጠጥ መመዝገቢያ' : 'Add Menu & Bar Item'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ለዚህ ሆቴል ብቻ የሚያገለግል ምግብ ወይም መጠጥ፣ ዋጋ እና ክምችት ያስገቡ'
                : 'Add items, ETB prices, and kitchen/bar stock specifically for this hotel'}
            </p>

            {menuError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {menuError}
              </div>
            )}

            <form onSubmit={handleCreateMenuItem} className="mt-4 space-y-3">
              <div>
                <label htmlFor="m-name" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የምግብ/መጠጥ ስም (እንግሊዝኛ)' : 'Item Name (English)'}
                </label>
                <input
                  id="m-name"
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Kitfo Special"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="m-am" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'ስም (በአማርኛ)' : 'Item Name (Amharic)'}
                </label>
                <input
                  id="m-am"
                  type="text"
                  value={itemAmharicName}
                  onChange={(e) => setItemAmharicName(e.target.value)}
                  placeholder="ለምሳሌ፡ ስፔሻል ክትፎ"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="m-cat" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.category}
                </label>
                <select
                  id="m-cat"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value as FbCategory)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                >
                  {FB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="m-price" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ዋጋ (ብር)' : 'Price (ETB)'}
                  </label>
                  <input
                    id="m-price"
                    type="number"
                    min={10}
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-stock" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ክምችት' : 'Stock Qty'}
                  </label>
                  <input
                    id="m-stock"
                    type="number"
                    min={0}
                    required
                    value={itemStock}
                    onChange={(e) => setItemStock(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-unit" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'መለኪያ' : 'Unit'}
                  </label>
                  <input
                    id="m-unit"
                    type="text"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    placeholder="Plate / Cup"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={menuSubmitting}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {menuSubmitting ? '...' : language === 'am' ? 'ወደ ሜኑ ጨምር' : 'Add to Hotel Menu'}
              </button>
            </form>
          </section>

          <section className="xl:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'የሆቴሉ ሜኑ እና የክምችት ቁጥጥር' : 'Hotel Menu & Inventory Ledger'}
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">{fbMenu.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">{language === 'am' ? 'ምግብ / መጠጥ' : 'Item'}</th>
                    <th className="py-3 px-4">{t.category}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ዋጋ' : 'Price'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ክምችት' : 'Stock'}</th>
                    <th className="py-3 px-4 text-right">{language === 'am' ? 'ድርጊት' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {fbMenu.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {language === 'am' ? item.amharicName : item.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.isAvailable ? (
                            <span className="text-emerald-700 font-medium">Available</span>
                          ) : (
                            <span className="text-red-700 font-medium">Out of Stock</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{item.category}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {editingItemId === item.id ? (
                          <input
                            type="number"
                            min={10}
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(Number(e.target.value) || 0)}
                            className="w-20 rounded border border-amber-500 px-2 py-1 text-right text-xs"
                          />
                        ) : (
                          `${item.price.toLocaleString()} ${t.currency}`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {editingItemId === item.id ? (
                          <input
                            type="number"
                            min={0}
                            value={draftStock}
                            onChange={(e) => setDraftStock(Number(e.target.value) || 0)}
                            className="w-16 rounded border border-amber-500 px-2 py-1 text-right text-xs"
                          />
                        ) : (
                          <span className={item.stockQty <= 5 ? 'text-red-700 font-semibold' : 'text-slate-800'}>
                            {item.stockQty} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {editingItemId === item.id ? (
                            <button
                              type="button"
                              onClick={() => handleSaveMenuEdit(item.id)}
                              className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setDraftPrice(item.price);
                                setDraftStock(item.stockQty);
                              }}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRestock(item, 10)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAvailable(item)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {item.isAvailable ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="rounded-md border border-red-200 p-1 text-red-700 hover:bg-red-50"
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
