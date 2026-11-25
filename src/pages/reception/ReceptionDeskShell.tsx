import React, { useState } from 'react';
import {
  Building2,
  CreditCard,
  Lock,
  LogOut,
  RefreshCw,
  UserCheck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useHotel, type PortalKey } from '../../context/VoiceContext';
import { MobileSmsToast, NotificationBellMenu } from '../../components/MobileNotificationUI';
import { DashboardPage } from '../DashboardPage';
import { FoodBeveragePage } from '../fb/FoodBeveragePage';
import { CheckInPage } from './CheckInPage';
import { CustomerPortalPage } from './CustomerPortalPage';
import { ManualPaymentPage } from './ManualPaymentPage';

const RECEPTION_TABS: {
  key: Extract<PortalKey, 'customers' | 'reception' | 'payments' | 'fb' | 'overview'>;
  en: string;
  am: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'customers',
    en: 'Customer Registry & Info Desk',
    am: 'የከስተመር መመዝገቢያ እና መረጃ መቀበያ',
    icon: Users,
  },
  {
    key: 'reception',
    en: 'Check-In & Task Dispatch',
    am: 'እንግዳ ማስገቢያ እና ትዕዛዝ',
    icon: UserCheck,
  },
  {
    key: 'payments',
    en: 'Manual Payments',
    am: 'ማኑዋል ክፍያዎች',
    icon: CreditCard,
  },
  {
    key: 'fb',
    en: 'Food & Beverage',
    am: 'ምግብ እና መጠጥ (F&B)',
    icon: UtensilsCrossed,
  },
  {
    key: 'overview',
    en: 'Room Matrix',
    am: 'የክፍሎች ሁኔታ',
    icon: Building2,
  },
];

export function ReceptionDeskShell() {
  const {
    language,
    setLanguage,
    t,
    activeHotelId,
    activeHotel,
    activePortal,
    setActivePortal,
    users,
    activeUser,
    setActiveUserId,
    setWorkspaceMode,
    loginWithPin,
    logout,
    refreshAll,
    loading,
    error,
    dismissError,
    announce,
  } = useHotel();

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Scoped strictly to Reception staff of the active hotel
  const receptionStaff = users.filter((u) => u.role === 'reception');
  const currentTab: Extract<PortalKey, 'customers' | 'reception' | 'payments' | 'fb' | 'overview'> =
    activePortal === 'reception' ||
    activePortal === 'payments' ||
    activePortal === 'fb' ||
    activePortal === 'overview'
      ? activePortal
      : 'customers';

  const handleUnlockFullSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setUnlocking(true);
    try {
      const authenticated = await loginWithPin(activeHotelId, pin);
      if (authenticated.role !== 'manager' && authenticated.role !== 'reception') {
        setPinError(
          language === 'am'
            ? 'ሙሉ ሲስተም ለመክፈት የማናጀር (4040) ወይም የሪሴፕሽን (1010) PIN ያስፈልጋል።'
            : 'Manager (4040) or Reception (1010) PIN required.'
        );
        return;
      }
      setUnlockOpen(false);
      setPin('');
      setWorkspaceMode('full');
    } catch (err) {
      setPinError(
        err instanceof Error
          ? err.message
          : language === 'am'
            ? 'የተሳሳተ PIN።'
            : 'Invalid PIN.'
      );
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Per-Hotel Isolated Receptionist Header — NO Central Server / Other Hotel Switching */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
              <span className="font-display font-extrabold text-amber-300">{t.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{activeHotel?.code || 'HOTEL'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-sans text-slate-300 truncate">
                {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
              </span>
            </div>
            <h1 className="font-display text-base font-bold text-white truncate mt-0.5">
              {language === 'am'
                ? 'የሪሴፕሽን ሰራተኛ ከስተመር መመዝገቢያ እና መረጃ መቀበያ ፖርታል'
                : 'Hotel Receptionist Customer & Information Portal'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {receptionStaff.length > 0 && (
              <select
                aria-label={t.activeOperator}
                value={activeUser?.id ?? ''}
                onChange={(e) => setActiveUserId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus:border-amber-500 focus:outline-none"
              >
                {receptionStaff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {language === 'am' ? u.amharicName : u.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  language === 'en' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  language === 'am' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                አማርኛ
              </button>
            </div>

            <NotificationBellMenu variant="dark" showLabel={false} />

            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{t.fullSystemBtn}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white whitespace-nowrap"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clean Reception Tab Bar */}
        <div className="bg-white border-t border-slate-200 text-slate-700">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2">
            {RECEPTION_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = currentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActivePortal(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{language === 'am' ? tab.am : tab.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8">
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
        {currentTab === 'customers' && <CustomerPortalPage />}
        {currentTab === 'reception' && <CheckInPage />}
        {currentTab === 'payments' && <ManualPaymentPage />}
        {currentTab === 'fb' && <FoodBeveragePage />}
        {currentTab === 'overview' && <DashboardPage />}
      </main>

      <MobileSmsToast />

      {unlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'ወደ ሙሉ ሲስተም መግቢያ' : 'Unlock Full Operations System'}
              </h3>
              <button
                type="button"
                onClick={() => setUnlockOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUnlockFullSystem} className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                {language === 'am'
                  ? 'ከሆቴሉ ሪሴፕሽን ፖርታል ወጥተው ሙሉ ሲስተም ለመክፈት PIN (1010 / 4040) ያስገቡ።'
                  : 'Enter Manager (4040) or Admin (1010) PIN to return to Central Multi-Hotel Operations.'}
              </p>
              {pinError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {pinError}
                </div>
              )}
              <input
                type="password"
                inputMode="numeric"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN (1010 / 4040)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={unlocking}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {unlocking ? '...' : t.fullSystemBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
