import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  ActivityLog,
  AuthenticatedSessionUser,
  Booking,
  CashierSummary,
  CustomerInquiry,
  CustomerProfile,
  DailyReportSummary,
  DiningTable,
  FbMenuItem,
  FbOrder,
  HotelOverviewStat,
  MaintenanceIssue,
  ManagerUnifiedSummary,
  ManualPayment,
  StaffMessage,
  StaffUser,
  TaskReport,
} from '../types/hotel';
import {
  getApiAuthToken,
  hotelApi,
  setApiAuthToken,
  type RoomWithBooking,
  type StationOrderTicket,
} from '../utils/api';
import { translations, type Language } from '../utils/i18n';
import {
  playMobileSmsChime,
  sendOsTextNotification,
  speakVoiceAlert,
  stopVoiceAlert,
  triggerMobileHaptic,
} from '../utils/speech';

export type PortalKey =
  | 'cover'
  | 'central'
  | 'overview'
  | 'customers'
  | 'reception'
  | 'payments'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'bar'
  | 'fb'
  | 'room-setup'
  | 'housekeeping'
  | 'maintenance'
  | 'dispatch'
  | 'manager'
  | 'reports'
  | 'audit';

export type WorkspaceMode = 'full' | 'staff-terminal' | 'reception-desk';

export type AlertMode = 'sms' | 'voice' | 'silent';

export interface AlertNotice {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
  timestamp: string;
  read?: boolean;
}

interface VoiceContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (typeof translations)['en'];
  alertMode: AlertMode;
  setAlertMode: (mode: AlertMode) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  authUser: AuthenticatedSessionUser | null;
  authLoading: boolean;
  loginWithPin: (
    hotelId: string,
    pinCode: string,
    userId?: string,
    preferredMode?: WorkspaceMode
  ) => Promise<AuthenticatedSessionUser>;
  logout: () => void;
  activeHotelId: string;
  setActiveHotelId: (id: string) => void;
  hotels: HotelOverviewStat[];
  activeHotel: HotelOverviewStat | null;
  activePortal: PortalKey;
  setActivePortal: (portal: PortalKey) => void;
  selectedBookingIdForPayment: string | null;
  setSelectedBookingIdForPayment: (id: string | null) => void;
  selectedRoomIdForCheckIn: string | null;
  setSelectedRoomIdForCheckIn: (id: string | null) => void;
  prefillCustomerForCheckIn: CustomerProfile | null;
  setPrefillCustomerForCheckIn: (customer: CustomerProfile | null) => void;
  users: StaffUser[];
  activeUser: StaffUser | null;
  setActiveUserId: (id: string) => void;
  rooms: RoomWithBooking[];
  bookings: Booking[];
  payments: ManualPayment[];
  maintenance: MaintenanceIssue[];
  auditLogs: ActivityLog[];
  messages: StaffMessage[];
  taskReports: TaskReport[];
  customers: CustomerProfile[];
  inquiries: CustomerInquiry[];
  fbMenu: FbMenuItem[];
  fbOrders: FbOrder[];
  tables: DiningTable[];
  kitchenOrders: StationOrderTicket[];
  barOrders: StationOrderTicket[];
  managerOverview: ManagerUnifiedSummary | null;
  dailyReport: DailyReportSummary | null;
  cashierSummary: CashierSummary | null;
  loading: boolean;
  error: string | null;
  dismissError: () => void;
  lastAlert: AlertNotice | null;
  dismissAlert: () => void;
  notifications: AlertNotice[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  announce: (enText: string, amText: string, tone?: 'info' | 'success' | 'warning') => void;
  refreshAll: (overrideHotelId?: string, overrideUser?: AuthenticatedSessionUser | null) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

function defaultPortalForRole(user: AuthenticatedSessionUser): PortalKey {
  if (user.isCentralAdmin) return 'central';
  switch (user.role) {
    case 'manager':
      return 'cover';
    case 'reception':
      return 'customers';
    case 'cashier':
      return 'cashier';
    case 'waiter':
      return 'waiter';
    case 'kitchen':
      return 'kitchen';
    case 'bar':
      return 'bar';
    case 'housekeeping':
      return 'housekeeping';
    case 'maintenance':
      return 'maintenance';
    case 'staff':
    default:
      return 'fb';
  }
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const initialParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const modeParam = initialParams?.get('mode');
  const initialMode: WorkspaceMode =
    modeParam === 'staff-terminal'
      ? 'staff-terminal'
      : modeParam === 'reception-desk'
        ? 'reception-desk'
        : 'full';
  const initialHotel = initialParams?.get('hotelId') || 'htl-addis';

  const [language, setLanguageState] = useState<Language>('en');
  const [alertMode, setAlertModeState] = useState<AlertMode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('tekno_alert_mode');
        if (saved === 'sms' || saved === 'voice' || saved === 'silent') {
          return saved;
        }
      }
    } catch {
      // Ignore storage access errors
    }
    return 'sms';
  });
  const voiceFallbackNotifiedRef = useRef<boolean>(false);

  const setAlertMode = useCallback((nextMode: AlertMode) => {
    setAlertModeState(nextMode);
    if (nextMode !== 'voice') {
      stopVoiceAlert();
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('tekno_alert_mode', nextMode);
      }
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const voiceEnabled = alertMode !== 'silent';
  const setVoiceEnabled = useCallback(
    (enabled: boolean) => {
      setAlertMode(enabled ? 'sms' : 'silent');
    },
    [setAlertMode]
  );

  const handleVoiceFallback = useCallback((errMsg: string) => {
    if (voiceFallbackNotifiedRef.current) return;
    voiceFallbackNotifiedRef.current = true;
    const notice: AlertNotice = {
      id: Date.now(),
      message: errMsg,
      tone: 'warning',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setLastAlert(notice);
  }, []);

  const [authUser, setAuthUser] = useState<AuthenticatedSessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>(initialMode);
  const [activeHotelId, setActiveHotelIdState] = useState<string>(initialHotel);
  const [activePortal, setActivePortal] = useState<PortalKey>(
    initialMode === 'reception-desk' ? 'customers' : 'cover'
  );
  const [selectedBookingIdForPayment, setSelectedBookingIdForPayment] = useState<string | null>(null);
  const [selectedRoomIdForCheckIn, setSelectedRoomIdForCheckIn] = useState<string | null>(null);
  const [prefillCustomerForCheckIn, setPrefillCustomerForCheckIn] = useState<CustomerProfile | null>(null);

  const [hotels, setHotels] = useState<HotelOverviewStat[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomWithBooking[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceIssue[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [taskReports, setTaskReports] = useState<TaskReport[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [fbMenu, setFbMenu] = useState<FbMenuItem[]>([]);
  const [fbOrders, setFbOrders] = useState<FbOrder[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<StationOrderTicket[]>([]);
  const [barOrders, setBarOrders] = useState<StationOrderTicket[]>([]);
  const [managerOverview, setManagerOverview] = useState<ManagerUnifiedSummary | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReportSummary | null>(null);
  const [cashierSummary, setCashierSummary] = useState<CashierSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAlert, setLastAlert] = useState<AlertNotice | null>(null);
  const [notifications, setNotifications] = useState<AlertNotice[]>([]);

  const setWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    setWorkspaceModeState(mode);
    if (mode === 'reception-desk') {
      setActivePortal('customers');
    }
  }, []);

  // Restore saved JWT session on initial mount
  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      try {
        const token = getApiAuthToken();
        if (token) {
          const { user } = await hotelApi.getSession();
          if (!active) return;
          setAuthUser(user);
          if (!user.isCentralAdmin) {
            setActiveHotelIdState(user.hotelId);
          }
          setActiveUserId(user.userId);
          setActivePortal(defaultPortalForRole(user));
          if (initialMode === 'full' && (user.role === 'housekeeping' || user.role === 'maintenance')) {
            setWorkspaceModeState('staff-terminal');
          }
        }
      } catch {
        setApiAuthToken(null);
        if (active) setAuthUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void bootstrapSession();
    return () => {
      active = false;
    };
  }, [initialMode]);

  const refreshAll = useCallback(
    async (overrideHotelId?: string, overrideUser?: AuthenticatedSessionUser | null) => {
      const currentSession = overrideUser !== undefined ? overrideUser : authUser;
      const targetHotel =
        currentSession && !currentSession.isCentralAdmin
          ? currentSession.hotelId
          : overrideHotelId || activeHotelId;

      try {
        setError(null);
        const [h, u] = await Promise.all([
          hotelApi.getHotels(),
          hotelApi.getUsers(targetHotel),
        ]);
        setHotels(h);
        setUsers(u);

        if (!currentSession) {
          setRooms([]);
          setBookings([]);
          setPayments([]);
          setMaintenance([]);
          setAuditLogs([]);
          setMessages([]);
          setTaskReports([]);
          setCustomers([]);
          setInquiries([]);
          setFbMenu([]);
          setFbOrders([]);
          setTables([]);
          setKitchenOrders([]);
          setBarOrders([]);
          setManagerOverview(null);
          setDailyReport(null);
          setCashierSummary(null);
          return;
        }

        const role = currentSession.role;
        const isMgr = role === 'manager' || currentSession.isCentralAdmin;
        const canReception = isMgr || role === 'reception';
        const canCashier = isMgr || role === 'cashier' || role === 'reception';
        const canPaymentsRead = isMgr || role === 'reception' || role === 'cashier';
        const canBookingsRead = canReception || role === 'cashier' || role === 'waiter';
        const canFb =
          isMgr ||
          role === 'reception' ||
          role === 'cashier' ||
          role === 'staff' ||
          role === 'waiter' ||
          role === 'kitchen' ||
          role === 'bar';
        const canTables = canFb;
        const canKitchen = isMgr || role === 'kitchen' || role === 'waiter' || role === 'reception' || role === 'staff';
        const canBar = isMgr || role === 'bar' || role === 'waiter' || role === 'reception' || role === 'staff';
        const canHousekeeping = isMgr || role === 'housekeeping';
        const canMaintenance = isMgr || role === 'maintenance';

        const [
          r,
          m,
          msg,
          b,
          p,
          cust,
          inq,
          recTsk,
          hkTsk,
          mntTsk,
          fbm,
          fbo,
          tbls,
          kitOrd,
          barOrd,
          l,
          dr,
          mgr,
          csh,
        ] = await Promise.all([
          hotelApi.getRooms(targetHotel),
          hotelApi.getMaintenance(targetHotel),
          hotelApi.getMessages(targetHotel),
          canBookingsRead ? hotelApi.getBookings(targetHotel) : Promise.resolve<Booking[]>([]),
          canPaymentsRead ? hotelApi.getPayments(targetHotel) : Promise.resolve<ManualPayment[]>([]),
          canReception ? hotelApi.getCustomers(targetHotel) : Promise.resolve<CustomerProfile[]>([]),
          canReception ? hotelApi.getInquiries(targetHotel) : Promise.resolve<CustomerInquiry[]>([]),
          canReception ? hotelApi.getReceptionTasks(targetHotel) : Promise.resolve<TaskReport[]>([]),
          !canReception && canHousekeeping
            ? hotelApi.getHousekeepingTasks(targetHotel)
            : Promise.resolve<TaskReport[]>([]),
          !canReception && canMaintenance
            ? hotelApi.getMaintenanceTasks(targetHotel)
            : Promise.resolve<TaskReport[]>([]),
          canFb ? hotelApi.getFbMenu(targetHotel) : Promise.resolve<FbMenuItem[]>([]),
          canFb ? hotelApi.getFbOrders(targetHotel) : Promise.resolve<FbOrder[]>([]),
          canTables ? hotelApi.getTables(targetHotel) : Promise.resolve<DiningTable[]>([]),
          canKitchen ? hotelApi.getKitchenOrders(targetHotel) : Promise.resolve<StationOrderTicket[]>([]),
          canBar ? hotelApi.getBarOrders(targetHotel) : Promise.resolve<StationOrderTicket[]>([]),
          isMgr ? hotelApi.getAuditLogs(targetHotel) : Promise.resolve<ActivityLog[]>([]),
          isMgr ? hotelApi.getDailyReport(targetHotel) : Promise.resolve<DailyReportSummary | null>(null),
          isMgr
            ? hotelApi.getManagerUnifiedOverview(targetHotel)
            : Promise.resolve<ManagerUnifiedSummary | null>(null),
          canCashier ? hotelApi.getCashierSummary(targetHotel) : Promise.resolve<CashierSummary | null>(null),
        ]);

        setRooms(r);
        setMaintenance(m);
        setMessages(msg);
        setBookings(b);
        setPayments(p);
        setCustomers(cust);
        setInquiries(inq);
        setTaskReports(canReception ? recTsk : canHousekeeping ? hkTsk : mntTsk);
        setFbMenu(fbm);
        setFbOrders(fbo);
        setTables(tbls);
        setKitchenOrders(kitOrd);
        setBarOrders(barOrd);
        setAuditLogs(l);
        setDailyReport(dr);
        setManagerOverview(mgr);
        setCashierSummary(csh);

        setActiveUserId((prev) => {
          if (currentSession.isCentralAdmin) {
            if (prev && u.some((usr) => usr.id === prev)) return prev;
            return u.find((usr) => usr.role === 'manager')?.id || u[0]?.id || '';
          }
          if (u.some((usr) => usr.id === currentSession.userId)) return currentSession.userId;
          return u[0]?.id || '';
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load central server data.');
      } finally {
        setLoading(false);
      }
    },
    [activeHotelId, authUser]
  );

  useEffect(() => {
    if (!authLoading) {
      void refreshAll(activeHotelId, authUser);
    }
  }, [activeHotelId, authUser, authLoading, refreshAll]);

  const loginWithPin = useCallback(
    async (
      hotelId: string,
      pinCode: string,
      userId?: string,
      preferredMode?: WorkspaceMode
    ): Promise<AuthenticatedSessionUser> => {
      const { token, user } = await hotelApi.loginWithPin({ hotelId, userId, pinCode });
      setApiAuthToken(token);
      setAuthUser(user);
      setActiveHotelIdState(user.hotelId);
      setActiveUserId(user.userId);
      setSelectedBookingIdForPayment(null);
      setSelectedRoomIdForCheckIn(null);
      setPrefillCustomerForCheckIn(null);

      if (preferredMode) {
        setWorkspaceModeState(preferredMode);
      } else if (user.role === 'housekeeping' || user.role === 'maintenance' || user.role === 'staff') {
        setWorkspaceModeState('staff-terminal');
      } else {
        setWorkspaceModeState('full');
      }

      setActivePortal(defaultPortalForRole(user));
      await refreshAll(user.hotelId, user);
      return user;
    },
    [refreshAll]
  );

  const logout = useCallback(() => {
    stopVoiceAlert();
    setApiAuthToken(null);
    setAuthUser(null);
    setActiveUserId('');
    setWorkspaceModeState('full');
    setActivePortal('cover');
    setError(null);
  }, []);

  const setActiveHotelId = useCallback(
    (nextId: string) => {
      if (authUser && !authUser.isCentralAdmin && nextId !== authUser.hotelId) {
        setError(
          language === 'am'
            ? 'የሌላ ሆቴል መረጃ የመጠቀም ፈቃድ የለዎትም!'
            : 'Branch staff are scoped strictly to their assigned hotel.'
        );
        return;
      }
      setActiveHotelIdState(nextId);
      setActiveUserId('');
      setSelectedBookingIdForPayment(null);
      setSelectedRoomIdForCheckIn(null);
      setPrefillCustomerForCheckIn(null);
    },
    [authUser, language]
  );

  const activeHotel = hotels.find((h) => h.id === activeHotelId) ?? hotels[0] ?? null;
  const activeUser = users.find((u) => u.id === activeUserId) ?? users[0] ?? null;

  const deliverNotification = useCallback(
    (msg: string, targetLang: Language, tone: 'info' | 'success' | 'warning' = 'info') => {
      const notice: AlertNotice = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        message: msg,
        tone,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      setLastAlert(notice);
      setNotifications((prev) => [notice, ...prev].slice(0, 30));

      if (alertMode === 'sms') {
        playMobileSmsChime(tone);
        triggerMobileHaptic(tone);
        sendOsTextNotification(
          targetLang === 'am' ? 'ቃል ቴክኖ · ማሳወቂያ' : 'Kal Tekno · Text Alert',
          msg
        );
      } else if (alertMode === 'voice') {
        void speakVoiceAlert(msg, targetLang, tone, handleVoiceFallback);
      }
    },
    [alertMode, handleVoiceFallback]
  );

  const setLanguage = useCallback(
    (nextLang: Language) => {
      if (nextLang !== language) {
        if (nextLang === 'am') {
          deliverNotification('የማሳወቂያ ቋንቋ ወደ አማርኛ ተቀይሯል።', 'am', 'info');
        } else {
          deliverNotification('Notification language switched to English.', 'en', 'info');
        }
      }
      setLanguageState(nextLang);
    },
    [language, deliverNotification]
  );

  const announce = useCallback(
    (enText: string, amText: string, tone: 'info' | 'success' | 'warning' = 'info') => {
      const msg = language === 'am' ? amText : enText;
      deliverNotification(msg, language, tone);
    },
    [language, deliverNotification]
  );

  useEffect(() => {
    if (!lastAlert) return;
    const timer = window.setTimeout(() => {
      setLastAlert((prev) => (prev?.id === lastAlert.id ? null : prev));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [lastAlert]);

  const dismissAlert = useCallback(() => setLastAlert(null), []);
  const dismissError = useCallback(() => setError(null), []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setLastAlert(null);
  }, []);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const t = translations[language] as (typeof translations)['en'];

  return (
    <VoiceContext.Provider
      value={{
        language,
        setLanguage,
        t,
        alertMode,
        setAlertMode,
        voiceEnabled,
        setVoiceEnabled,
        workspaceMode,
        setWorkspaceMode,
        authUser,
        authLoading,
        loginWithPin,
        logout,
        activeHotelId,
        setActiveHotelId,
        hotels,
        activeHotel,
        activePortal,
        setActivePortal,
        selectedBookingIdForPayment,
        setSelectedBookingIdForPayment,
        selectedRoomIdForCheckIn,
        setSelectedRoomIdForCheckIn,
        prefillCustomerForCheckIn,
        setPrefillCustomerForCheckIn,
        users,
        activeUser,
        setActiveUserId,
        rooms,
        bookings,
        payments,
        maintenance,
        auditLogs,
        messages,
        taskReports,
        customers,
        inquiries,
        fbMenu,
        fbOrders,
        tables,
        kitchenOrders,
        barOrders,
        managerOverview,
        dailyReport,
        cashierSummary,
        loading,
        error,
        dismissError,
        lastAlert,
        dismissAlert,
        notifications,
        unreadCount,
        markAllNotificationsRead,
        clearNotifications,
        announce,
        refreshAll,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useHotel(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useHotel must be used inside VoiceProvider');
  }
  return ctx;
}
