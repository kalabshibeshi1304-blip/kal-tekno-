import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Globe,
  KeyRound,
  Lock,
  Receipt,
  ShieldCheck,
  UserCheck,
  UtensilsCrossed,
  Wine,
  Wrench,
} from 'lucide-react';
import { useHotel, type WorkspaceMode } from '../../context/VoiceContext';
import type { UserRole } from '../../types/hotel';
import { MobileSmsToast, NotificationBellMenu } from '../../components/MobileNotificationUI';

const COVER_HERO_IMAGE = '/src/assets/images/tekno_hotel_cover_1795381364972.jpg';

const ROLE_PORTALS: {
  role: UserRole;
  pin: string;
  en: string;
  am: string;
  scopeEn: string;
  scopeAm: string;
  deptEn: string;
  deptAm: string;
  mode: WorkspaceMode;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: 'reception',
    pin: '1010',
    en: 'Reception Portal',
    am: 'የሪሴፕሽን ፖርታል',
    scopeEn: 'Customer Registry, Check-In & Manual Payments',
    scopeAm: 'ከስተመር ምዝገባ፣ እንግዳ መግቢያ እና ማኑዋል ክፍያ',
    deptEn: 'Front Desk',
    deptAm: 'ፊት ዴስክ',
    mode: 'reception-desk',
    icon: UserCheck,
  },
  {
    role: 'cashier',
    pin: '9090',
    en: 'Cashier Portal',
    am: 'የካሸር (ሂሳብ) ፖርታል',
    scopeEn: 'Order Billing, Bank Slip Verification & Receipts',
    scopeAm: 'የትዕዛዝ ሂሳብ መዝጋት፣ ደረሰኝ ማረጋገጥ እና ሪፖርት',
    deptEn: 'Cashier Desk',
    deptAm: 'ካሸር ክፍል',
    mode: 'full',
    icon: Receipt,
  },
  {
    role: 'waiter',
    pin: '6060',
    en: 'Waiter Portal',
    am: 'የአስተናጋጅ ፖርታል',
    scopeEn: 'Tableside Customer Orders -> Kitchen & Bar Split',
    scopeAm: 'ከስተመር ጋር ሆኖ ለኪችን እና ለባር ትዕዛዝ መላኪያ',
    deptEn: 'Dining Service',
    deptAm: 'ጠረጴዛ አገልግሎት',
    mode: 'full',
    icon: ClipboardList,
  },
  {
    role: 'kitchen',
    pin: '7070',
    en: 'Kitchen Display',
    am: 'የኪችን (ኩሽና) ፖርታል',
    scopeEn: 'Food-Only Ticket Queue & Ready Alerts',
    scopeAm: 'የምግብ ትዕዛዝ መቀበያ እና ዝግጁ ማሳወቂያ',
    deptEn: 'Culinary Line',
    deptAm: 'ምግብ ዝግጅት',
    mode: 'full',
    icon: ChefHat,
  },
  {
    role: 'bar',
    pin: '8080',
    en: 'Bar & Espresso',
    am: 'የባር እና ካፌ ፖርታል',
    scopeEn: 'Beverage Ticket Queue & Ready Alerts',
    scopeAm: 'የመጠጥ ትዕዛዝ መቀበያ እና ዝግጁ ማሳወቂያ',
    deptEn: 'Bar Counter',
    deptAm: 'መጠጥ ክፍል',
    mode: 'full',
    icon: Wine,
  },
  {
    role: 'housekeeping',
    pin: '2020',
    en: 'Housekeeping Portal',
    am: 'የሃውስ ኪፒንግ ፖርታል',
    scopeEn: 'Isolated Cleaning Queue & Completion Reports',
    scopeAm: 'የጽዳት ትዕዛዝ መቀበያ እና ሪፖርት መላኪያ',
    deptEn: 'Housekeeping',
    deptAm: 'ጽዳት ክፍል',
    mode: 'staff-terminal',
    icon: ClipboardCheck,
  },
  {
    role: 'maintenance',
    pin: '3030',
    en: 'Maintenance Portal',
    am: 'የሚንተናስ (ጥገና) ፖርታል',
    scopeEn: 'Isolated Repair Queue & Technician Reports',
    scopeAm: 'የጥገና ስራ መቀበያ እና ሪፖርት መላኪያ',
    deptEn: 'Engineering',
    deptAm: 'ጥገና ክፍል',
    mode: 'staff-terminal',
    icon: Wrench,
  },
  {
    role: 'staff',
    pin: '5050',
    en: 'F&B / Store Portal',
    am: 'የምግብ እና ስቶር ፖርታል',
    scopeEn: 'Menu Pricing, Inventory Stock & Store Alerts',
    scopeAm: 'የምግብ/መጠጥ ሜኑ፣ ክምችት እና የስቶር መልእክት',
    deptEn: 'F&B & Store',
    deptAm: 'ስቶር እና ሜኑ',
    mode: 'full',
    icon: UtensilsCrossed,
  },
  {
    role: 'manager',
    pin: '4040',
    en: 'Branch Manager Portal',
    am: 'የሆቴል ማናጀር ፖርታል',
    scopeEn: 'Hotel Portal Hub, Revenue Reports, Setup & Audit',
    scopeAm: 'የሆቴሉ ፖርታሎች፣ የገቢ ሪፖርት፣ የክፍል ማስተካከያ እና ኦዲት',
    deptEn: 'Branch Management',
    deptAm: 'የሆቴል አስተዳደር',
    mode: 'full',
    icon: ShieldCheck,
  },
];

export function LoginScreen() {
  const {
    language,
    setLanguage,
    hotels,
    activeHotelId,
    setActiveHotelId,
    users,
    loginWithPin,
    announce,
  } = useHotel();

  const [selectedHotelId, setSelectedHotelId] = useState<string>(activeHotelId || 'htl-addis');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [centralPin, setCentralPin] = useState<string>('9999');
  const [preferredMode, setPreferredMode] = useState<WorkspaceMode>('full');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState<boolean>(false);

  useEffect(() => {
    if (
      selectedHotelId !== 'central' &&
      hotels.length > 0 &&
      !hotels.some((h) => h.id === selectedHotelId)
    ) {
      setSelectedHotelId(hotels[0].id);
    }
  }, [hotels, selectedHotelId]);

  const branchHotelId = selectedHotelId === 'central' ? hotels[0]?.id || 'htl-addis' : selectedHotelId;
  const currentHotel = hotels.find((h) => h.id === branchHotelId) || hotels[0];

  const handleHotelChange = (nextHotelId: string) => {
    setSelectedHotelId(nextHotelId);
    setSelectedUserId('');
    if (nextHotelId !== 'central') {
      setActiveHotelId(nextHotelId);
    }
    setErrorMsg(null);
  };

  const handleCentralAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const user = await loginWithPin('central', centralPin, 'central-admin-1', 'full');
      announce(
        `Welcome ${user.name} to Kal Tekno Central Server.`,
        `እንኳን ወደ ቃል ቴክኖ ዋና ሰርቨር በደህና መጡ፣ ${user.amharicName}።`,
        'success'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Central Admin authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const user = await loginWithPin(
        selectedHotelId,
        pinCode,
        selectedUserId || undefined,
        selectedHotelId === 'central' ? 'full' : preferredMode
      );
      announce(
        `Signed in to Kal Tekno as ${user.name} (${user.role}).`,
        `ወደ ቃል ቴክኖ ሲስተም በ${user.amharicName} ገብተዋል።`,
        'success'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPortalEnter = async (preset: (typeof ROLE_PORTALS)[number]) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const matchedUser = users.find((u) => u.role === preset.role);
      const user = await loginWithPin(
        branchHotelId,
        preset.pin,
        matchedUser?.id,
        preset.mode
      );
      announce(
        `Opened ${preset.en} for ${user.name}.`,
        `${preset.am} ለ${user.amharicName} ተከፍቷል።`,
        'success'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to enter portal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Translucent Architectural Top Bar (Clean 3-Zone Contract) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-3 font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-amber-400">
              <Building2 className="h-4 w-4" />
            </span>
            <span>{language === 'am' ? 'ቃል ቴክኖ' : 'Kal Tekno'}</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#central-admin" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              {language === 'am' ? 'ዋና አድሚን' : 'Central Admin'}
            </a>
            <a href="#portals" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              {language === 'am' ? 'የሆቴል ፖርታሎች' : 'Hotel Portals'}
            </a>
            <a href="#pin-access" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              {language === 'am' ? 'በPIN መግቢያ' : 'Staff PIN'}
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'am' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                አማርኛ
              </button>
            </div>

            <NotificationBellMenu variant="light" showLabel={false} />
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* Hero Cover Showcase — Deep Obsidian & Architectural Lobby Photography */}
        <section className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-800 bg-slate-950 text-white overflow-hidden items-stretch shadow-sm">
          <div className="lg:col-span-5 p-7 sm:p-10 flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="text-xs font-bold tracking-widest uppercase text-amber-400">
                {language === 'am'
                  ? 'የብዙ ሆቴሎች ማዕከላዊ አስተዳደር ዋና ሰርቨር'
                  : 'CENTRAL MULTI-HOTEL HOSPITALITY SERVER'}
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white text-balance">
                {language === 'am' ? 'ቃል ቴክኖ' : 'Kal Tekno'}
              </h1>

              <p className="text-base sm:text-lg font-semibold text-amber-100/95">
                {language === 'am'
                  ? 'ሁሉም የስራ ክፍል ወደ ራሱ ፖርታል በቀላሉ የሚገባበት ዋና ከቨር ገጽ'
                  : 'Unified Hospitality Server & Department Portal Gateway'}
              </p>

              <p className="text-sm text-slate-300 leading-relaxed">
                {language === 'am'
                  ? 'የክፍሎችን ሁኔታ በፊት ገጽ ሳያሳይ ዋና አድሚን፣ ሪሴፕሽን፣ አስተናጋጅ፣ ኪችን፣ ባር፣ ሃውስ ኪፒንግ፣ ሚንተናስ እና የሆቴል ማናጀር ወደ ተፈቀደላቸው ፖርታል በቀጥታ ይገባሉ።'
                  : 'Keep live room availability private at arrival while routing Central Admin, Branch Managers, Reception, Waiter, Kitchen, Bar, Housekeeping, and Maintenance straight into their portals.'}
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-800 pt-6">
              <div>
                <label htmlFor="cover-hotel-select" className="block text-xs font-medium text-slate-300 mb-2">
                  {language === 'am' ? 'የሚሰሩበትን ሆቴል ይምረጡ (ለሆቴል ሰራተኞች)' : 'Select Hotel Property (For Branch Portals)'}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <select
                    id="cover-hotel-select"
                    value={branchHotelId}
                    onChange={(e) => handleHotelChange(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white focus:border-amber-500 focus:outline-none"
                  >
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.code} · {language === 'am' ? h.amharicName : h.name} ({language === 'am' ? h.amharicCity : h.city})
                      </option>
                    ))}
                  </select>
                  <a
                    href="#portals"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{language === 'am' ? 'ፖርታል ክፈት' : 'Open Portal'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {currentHotel && (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-400">
                  <span>{language === 'am' ? currentHotel.amharicCity : currentHotel.city}</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentHotel.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-amber-300 tabular-nums">{currentHotel.starRating}★</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{currentHotel.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 relative min-h-[300px] lg:min-h-[430px] bg-slate-900">
            {!heroImgFailed ? (
              <img
                src={COVER_HERO_IMAGE}
                alt="Kal Tekno Hospitality Lobby"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover lg:absolute lg:inset-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-slate-200 gap-3">
                <Building2 className="h-12 w-12 text-amber-400" />
                <span className="font-display text-2xl font-extrabold">ቃል ቴክኖ</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />
            <div className="hidden lg:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-100">
              <span className="font-display text-base font-extrabold tracking-tight text-white">
                {currentHotel
                  ? language === 'am'
                    ? currentHotel.amharicName
                    : currentHotel.name
                  : 'Kal Tekno Hotels'}
              </span>
              <span className="font-mono text-amber-300">
                {language === 'am' ? 'ቃል ቴክኖ ዋና ሰርቨር · RBAC' : 'Kal Tekno Server · Role-Scoped'}
              </span>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Executive Central Server Admin Sign-In Threshold */}
        <section
          id="central-admin"
          className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        >
          <div className="flex items-start gap-4 max-w-2xl">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-400 shrink-0 hidden sm:block">
              <Globe className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-bold tracking-wider uppercase text-amber-400">
                {language === 'am'
                  ? 'የቃል ቴክኖ ዋና ሰርቨር አድሚን መግቢያ'
                  : 'KAL TEKNO CENTRAL SERVER SUPER ADMIN'}
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {language === 'am'
                  ? 'ዋና አድሚን — የሁሉም ሆቴሎች መቆጣጠሪያ'
                  : 'Central Server Admin Portal'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {language === 'am'
                  ? 'አዲስ ሆቴሎችን በዋናው ሰርቨር ስር ለመመዝገብ፣ የሆቴሎችን መረጃና ዋጋ ለማስተካከል እና ወደ ሁሉም ሆቴሎች መልእክት ለማስተላለፍ በዋና አድሚን PIN (9999) ይግቡ።'
                  : 'Provision new hotel branches, configure property rates and amenities, and send network-wide broadcasts across all hotels using Central Admin PIN (9999).'}
              </p>
            </div>
          </div>

          <form
            onSubmit={handleCentralAdminLogin}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shrink-0"
          >
            <div>
              <label htmlFor="central-admin-pin" className="block text-xs font-medium text-slate-300 mb-1.5">
                {language === 'am' ? 'የዋና አድሚን PIN ኮድ' : 'Central Admin PIN'}
              </label>
              <input
                id="central-admin-pin"
                type="password"
                inputMode="numeric"
                required
                value={centralPin}
                onChange={(e) => setCentralPin(e.target.value)}
                placeholder="9999"
                className="w-full sm:w-36 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-white tabular-nums focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {submitting
                  ? '...'
                  : language === 'am'
                    ? 'ወደ ዋና ሰርቨር ግባ (PIN 9999)'
                    : 'Enter Central Server (PIN 9999)'}
              </span>
            </button>
          </form>
        </section>

        {/* Department Portal Cards Grid */}
        <section id="portals" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950">
                {language === 'am'
                  ? 'የሆቴል ሰራተኞች እና የስራ ክፍሎች ፖርታሎች'
                  : 'Hotel Branch Department Portals'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {language === 'am'
                  ? 'ለተመረጠው ሆቴል የራስዎን የስራ ድርሻ ካርድ በመንካት በቀጥታ ወደ ፖርታልዎ ይግቡ'
                  : 'Select your department card below to authenticate directly into your role-scoped workspace'}
              </p>
            </div>
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
              {ROLE_PORTALS.length} {language === 'am' ? 'የስራ ፖርታሎች' : 'portals'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLE_PORTALS.map((portal, index) => {
              const Icon = portal.icon;
              const numLabel = String(index + 1).padStart(2, '0');
              return (
                <button
                  key={portal.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleQuickPortalEnter(portal)}
                  className="group rounded-xl border border-slate-200 bg-white p-5 text-left hover:-translate-y-0.5 hover:border-amber-500 transition-all duration-200 flex flex-col justify-between gap-4 disabled:opacity-50"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-amber-700 tabular-nums">
                          {numLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium">
                          {language === 'am' ? portal.deptAm : portal.deptEn}
                        </span>
                      </div>
                      <span className="rounded-lg border border-slate-200/80 bg-slate-50 p-2 text-slate-600 group-hover:border-amber-200 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>

                    <div>
                      <div className="font-display text-base font-bold text-slate-950 group-hover:text-amber-800 transition-colors">
                        {language === 'am' ? portal.am : portal.en}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        {language === 'am' ? portal.scopeAm : portal.scopeEn}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="font-mono font-semibold text-slate-500 tabular-nums">
                      PIN {portal.pin}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                      <span>{language === 'am' ? 'ግባ' : 'Enter'}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Manual PIN Sign-In Section */}
        <section id="pin-access" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-950">
                {language === 'am' ? 'በግል የሰራተኛ ወይም የዋና አድሚን PIN መግቢያ' : 'Manual Staff & Central Admin PIN Sign-In'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'am'
                  ? 'ቃል ቴክኖ ዋና ሰርቨር ወይም ሆቴል መርጠው በሚስጥራዊ PIN ኮድዎ ይግቡ'
                  : 'Select Kal Tekno Central Server or any branch hotel and enter your personal PIN'}
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            <div>
              <label htmlFor="login-hotel" className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'am' ? 'ዋና ሰርቨር / ሆቴል' : 'Server / Hotel Property'}
              </label>
              <select
                id="login-hotel"
                value={selectedHotelId}
                onChange={(e) => handleHotelChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              >
                <option value="central">
                  {language === 'am'
                    ? '★ ቃል ቴክኖ ዋና ሰርቨር (Central Admin)'
                    : '★ Kal Tekno Central Server (Admin HQ)'}
                </option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} · {language === 'am' ? h.amharicName : h.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="login-staff" className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'am' ? 'ሰራተኛ / አድሚን (አማራጭ)' : 'Staff / Admin (Optional)'}
              </label>
              <select
                id="login-staff"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={selectedHotelId === 'central'}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {selectedHotelId === 'central'
                    ? language === 'am'
                      ? 'ቃል ቴክኖ ዋና አድሚን'
                      : 'Kal Tekno Central Admin'
                    : language === 'am'
                      ? 'በPIN በራስ-ሰር ይለይ'
                      : 'Auto-detect by PIN'}
                </option>
                {selectedHotelId !== 'central' &&
                  users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {language === 'am' ? u.amharicName : u.name} · {u.role}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="login-pin" className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'am' ? 'PIN ኮድ' : 'PIN Code'}
              </label>
              <input
                id="login-pin"
                type="password"
                inputMode="numeric"
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="9999 / 4040 / 1010 / 6060"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-mode" className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'am' ? 'የስራ ገጽ (Workspace)' : 'Workspace View'}
              </label>
              <select
                id="login-mode"
                value={selectedHotelId === 'central' ? 'full' : preferredMode}
                disabled={selectedHotelId === 'central'}
                onChange={(e) => setPreferredMode(e.target.value as WorkspaceMode)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none disabled:opacity-60"
              >
                <option value="full">
                  {language === 'am' ? 'የተፈቀደው ሙሉ ፖርታል' : 'Role Default Portal'}
                </option>
                <option value="reception-desk">
                  {language === 'am' ? 'የሪሴፕሽን ፖርታል ብቻ' : 'Isolated Reception Desk'}
                </option>
                <option value="staff-terminal">
                  {language === 'am' ? 'የሰራተኞች ሪፖርት ተርሚናል' : 'Isolated Staff Terminal'}
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              <KeyRound className="h-4 w-4 text-amber-400" />
              <span>{submitting ? '...' : language === 'am' ? 'አረጋግጠህ ግባ' : 'Verify & Enter'}</span>
            </button>
          </form>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 sm:px-8 py-5 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-display font-bold text-slate-900">
            {language === 'am' ? 'ቃል ቴክኖ — የሆቴሎች ዋና ሰርቨር' : 'Kal Tekno — Central Hospitality Server'}
          </span>
          <span>
            {language === 'am'
              ? 'ባለብዙ ሆቴል እና በሚና የተገደበ (RBAC) ሲስተም'
              : 'Multi-Tenant · Central Admin & Role-Scoped Portals'}
          </span>
        </div>
      </footer>
      <MobileSmsToast />
    </div>
  );
}
