import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  BedDouble,
  Building2,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Globe,
  History,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Receipt,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wine,
  Wrench,
  X,
} from 'lucide-react';
import { useHotel, type PortalKey } from '../context/VoiceContext';
import type { AuthenticatedSessionUser } from '../types/hotel';
import { MobileSmsToast, NotificationBellMenu } from './MobileNotificationUI';

function canAccessPortal(key: PortalKey, user: AuthenticatedSessionUser | null): boolean {
  if (!user) return false;
  if (key === 'central') return user.isCentralAdmin;
  if (user.isCentralAdmin || user.role === 'manager') return true;

  switch (key) {
    case 'cover':
    case 'dispatch':
      return true;
    case 'overview':
      return user.role !== 'kitchen' && user.role !== 'bar';
    case 'customers':
    case 'reception':
      return user.role === 'reception';
    case 'payments':
      return user.role === 'reception' || user.role === 'cashier';
    case 'cashier':
      return user.role === 'cashier' || user.role === 'reception';
    case 'waiter':
      return user.role === 'waiter' || user.role === 'reception' || user.role === 'staff';
    case 'kitchen':
      return user.role === 'kitchen' || user.role === 'waiter' || user.role === 'reception' || user.role === 'staff';
    case 'bar':
      return user.role === 'bar' || user.role === 'waiter' || user.role === 'reception' || user.role === 'staff';
    case 'fb':
      return user.role === 'reception' || user.role === 'staff' || user.role === 'cashier';
    case 'housekeeping':
      return user.role === 'housekeeping' || user.role === 'reception';
    case 'maintenance':
      return (
        user.role === 'maintenance' ||
        user.role === 'reception' ||
        user.role === 'housekeeping' ||
        user.role === 'staff'
      );
    case 'room-setup':
    case 'manager':
    case 'reports':
    case 'audit':
      return false;
    default:
      return false;
  }
}

interface NavSection {
  groupEn: string;
  groupAm: string;
  items: { key: PortalKey; labelKey: keyof ReturnType<typeof useHotel>['t']; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    groupEn: 'Portal Hub & Server',
    groupAm: 'መነሻ ከቨር እና ዋና ሰርቨር',
    items: [
      { key: 'cover', labelKey: 'navCover', icon: Home },
      { key: 'central', labelKey: 'navCentralHotels', icon: Globe },
      { key: 'overview', labelKey: 'navOverview', icon: Building2 },
      { key: 'dispatch', labelKey: 'navDispatch', icon: MessageSquare },
    ],
  },
  {
    groupEn: '1. Reception, Waiter & F&B',
    groupAm: '1. ሪሴፕሽን፣ አስተናጋጅ እና ምግብ/ባር',
    items: [
      { key: 'customers', labelKey: 'navCustomers', icon: Users },
      { key: 'reception', labelKey: 'navCheckIn', icon: UserCheck },
      { key: 'payments', labelKey: 'navPayments', icon: CreditCard },
      { key: 'cashier', labelKey: 'navCashier', icon: Receipt },
      { key: 'waiter', labelKey: 'navWaiter', icon: ClipboardList },
      { key: 'kitchen', labelKey: 'navKitchen', icon: ChefHat },
      { key: 'bar', labelKey: 'navBar', icon: Wine },
      { key: 'fb', labelKey: 'navFb', icon: UtensilsCrossed },
    ],
  },
  {
    groupEn: '2. Housekeeping',
    groupAm: '2. ሃውስ ኪፒንግ',
    items: [
      { key: 'housekeeping', labelKey: 'navHousekeeping', icon: ClipboardCheck },
    ],
  },
  {
    groupEn: '3. Maintenance',
    groupAm: '3. ሚንተናስ (ጥገና)',
    items: [
      { key: 'maintenance', labelKey: 'navMaintenance', icon: Wrench },
    ],
  },
  {
    groupEn: '4. Hotel Setup & Manager',
    groupAm: '4. የክፍል ማስተካከያ እና ማናጀር',
    items: [
      { key: 'room-setup', labelKey: 'navRoomSetup', icon: BedDouble },
      { key: 'manager', labelKey: 'navManagerMonitor', icon: Activity },
      { key: 'reports', labelKey: 'navReports', icon: BarChart3 },
      { key: 'audit', labelKey: 'navAudit', icon: History },
    ],
  },
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const {
    language,
    setLanguage,
    t,
    setWorkspaceMode,
    hotels,
    activeHotelId,
    setActiveHotelId,
    activeHotel,
    activePortal,
    setActivePortal,
    users,
    activeUser,
    setActiveUserId,
    messages,
    refreshAll,
    loading,
    error,
    dismissError,
    authUser,
    logout,
  } = useHotel();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadMsgCount = activeUser
    ? messages.filter((m) => !m.acknowledgedBy.includes(activeUser.id)).length
    : 0;

  const currentNavLabel = (() => {
    for (const sec of NAV_SECTIONS) {
      const match = sec.items.find((i) => i.key === activePortal);
      if (match) return t[match.labelKey];
    }
    return t.navCover;
  })();

  const handlePortalClick = (key: PortalKey) => {
    setActivePortal(key);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400 shrink-0">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap truncate">
            {t.brand}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Multi-Hotel Tenant Switcher */}
      <div className="border-b border-slate-800/80 px-4 py-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="hotel-select" className="block text-xs font-medium text-slate-400">
            {t.activeHotel}
          </label>
          {authUser && !authUser.isCentralAdmin && (
            <span className="font-mono text-[10px] text-amber-300">
              {language === 'am' ? 'የሆቴል ቅርንጫፍ' : 'Branch Locked'}
            </span>
          )}
        </div>
        <select
          id="hotel-select"
          value={activeHotelId}
          disabled={Boolean(authUser && !authUser.isCentralAdmin)}
          onChange={(e) => setActiveHotelId(e.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-amber-500 focus:outline-none disabled:opacity-75"
        >
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.code} · {language === 'am' ? h.amharicName : h.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Portal Navigation">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canAccessPortal(item.key, authUser));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.groupEn}>
              <div className="px-3 pb-1.5 text-xs font-medium text-slate-400">
                {language === 'am' ? section.groupAm : section.groupEn}
              </div>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activePortal === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handlePortalClick(item.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        active
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t[item.labelKey]}</span>
                      </span>
                      {item.key === 'dispatch' && unreadMsgCount > 0 && (
                        <span className="font-mono text-xs text-amber-300 tabular-nums shrink-0">
                          {unreadMsgCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Isolated Reception & Staff Terminal Launchers + Authenticated Session */}
      <div className="border-t border-slate-800 p-4 space-y-2.5">
        {(authUser?.role === 'reception' || authUser?.role === 'manager' || authUser?.isCentralAdmin) && (
          <button
            type="button"
            onClick={() => setWorkspaceMode('reception-desk')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-600/15 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-600/25 transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{t.hotelReceptionPortalBtn}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setWorkspaceMode('staff-terminal')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700 transition-colors"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{t.staffMiniPortalBtn}</span>
        </button>

        {authUser?.isCentralAdmin ? (
          <div>
            <label htmlFor="operator-select" className="block text-xs font-medium text-slate-400 mb-1.5">
              {t.activeOperator}
            </label>
            <select
              id="operator-select"
              value={activeUser?.id ?? ''}
              onChange={(e) => setActiveUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 focus:border-amber-500 focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {language === 'am' ? u.amharicName : u.name} · {u.role}
                </option>
              ))}
            </select>
          </div>
        ) : (
          authUser && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2">
              <div className="text-xs font-medium text-slate-100 truncate">
                {language === 'am' ? authUser.amharicName : authUser.name}
              </div>
              <div className="text-[11px] text-slate-400 capitalize truncate">
                {authUser.role} · {authUser.departmentLabel}
              </div>
            </div>
          )
        )}

        <button
          type="button"
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>{language === 'am' ? 'ውጣ / ሰራተኛ ቀይር' : 'Sign Out / Switch Role'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline font-display font-extrabold text-amber-700 whitespace-nowrap shrink-0">
                {t.brand}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
              <span className="hidden md:inline text-slate-500 whitespace-nowrap shrink-0 truncate max-w-[200px]">
                {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
              </span>
              <span className="hidden md:inline text-slate-300" aria-hidden="true">/</span>
              <h1 className="font-display text-sm sm:text-base font-bold text-slate-950 truncate">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'am' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                አማርኛ
              </button>
            </div>

            <NotificationBellMenu variant="light" />

            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{t.refresh}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {error && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
              <span className="min-w-0 break-words">{error}</span>
              <button
                type="button"
                onClick={dismissError}
                className="rounded p-1 text-red-600 hover:bg-red-100 shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      <MobileSmsToast />
    </div>
  );
}
