import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  MessageSquareText,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useHotel, type AlertMode } from '../context/VoiceContext';

export function MobileSmsToast() {
  const { lastAlert, dismissAlert, language, t } = useHotel();

  if (!lastAlert) return null;

  const badgeColors =
    lastAlert.tone === 'success'
      ? 'bg-emerald-500 text-white'
      : lastAlert.tone === 'warning'
        ? 'bg-rose-500 text-white'
        : 'bg-amber-400 text-slate-950';

  const Icon =
    lastAlert.tone === 'success'
      ? CheckCircle2
      : lastAlert.tone === 'warning'
        ? AlertTriangle
        : MessageSquareText;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-3 right-3 sm:top-4 sm:right-5 sm:left-auto sm:w-[390px] z-50 pointer-events-auto"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-md p-3.5 text-white shadow-2xl">
        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${badgeColors}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tracking-wide text-amber-400 truncate">
              {t.smsBannerHeader}
            </span>
            <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
              {lastAlert.timestamp || t.justNow}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium leading-snug text-slate-100 break-words">
            {lastAlert.message}
          </p>
        </div>
        <button
          type="button"
          onClick={dismissAlert}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          aria-label={language === 'am' ? 'ማሳወቂያ ዝጋ' : 'Dismiss notification'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function NotificationBellMenu({
  variant = 'light',
  showLabel = true,
}: {
  variant?: 'light' | 'dark';
  showLabel?: boolean;
}) {
  const {
    language,
    t,
    alertMode,
    setAlertMode,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    clearNotifications,
    announce,
  } = useHotel();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleToggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      markAllNotificationsRead();
    }
  };

  const handleSelectMode = (mode: AlertMode) => {
    setAlertMode(mode);
    if (mode === 'sms') {
      announce(
        'Mobile SMS text notifications are active.',
        'የሞባይል ጽሑፍ (SMS) ማሳወቂያ ተከፍቷል።',
        'info'
      );
    }
  };

  const buttonClasses =
    variant === 'dark'
      ? alertMode === 'silent'
        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
        : 'border-amber-500/40 bg-slate-800 text-amber-300 hover:bg-slate-700'
      : alertMode === 'silent'
        ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';

  const ActiveIcon = alertMode === 'silent' ? BellOff : alertMode === 'voice' ? Volume2 : Bell;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${buttonClasses}`}
        aria-label={t.notificationsTitle}
      >
        <ActiveIcon className="h-3.5 w-3.5" />
        {showLabel && (
          <span className="hidden sm:inline">
            {alertMode === 'silent' ? t.voiceOff : t.voiceOn}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[310px] sm:w-[360px] rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquareText className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-slate-900 truncate">
                {t.notificationsTitle}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {notifications.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200/70"
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span>{t.markAllRead}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t.clearAll}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="border-b border-slate-100 px-3 py-2.5 bg-white">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'sms', icon: MessageSquareText, en: 'SMS Ping', am: 'SMS ደወል' },
                  { id: 'voice', icon: Volume2, en: 'Speech', am: 'ንግግር' },
                  { id: 'silent', icon: BellOff, en: 'Silent', am: 'ጸጥታ' },
                ] as const
              ).map((opt) => {
                const OptIcon = opt.icon;
                const active = alertMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectMode(opt.id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <OptIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{language === 'am' ? opt.am : opt.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {t.noNotifications}
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      item.tone === 'success'
                        ? 'bg-emerald-500'
                        : item.tone === 'warning'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-relaxed text-slate-800 break-words">
                      {item.message}
                    </p>
                    <span className="mt-1 block text-[10px] font-medium text-slate-400 tabular-nums">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
