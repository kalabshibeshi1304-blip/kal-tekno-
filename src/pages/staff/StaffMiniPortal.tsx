import React, { useMemo, useState } from 'react';
import { Check, Lock, LogOut, Send, X } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import { MobileSmsToast, NotificationBellMenu } from '../../components/MobileNotificationUI';
import type {
  CleaningStatus,
  MaintenanceCategory,
  MaintenanceSeverity,
  MessageCategory,
  MessagePriority,
  MessageTargetRole,
  UserRole,
} from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const STAFF_TERMINAL_ROLES: { role: UserRole; en: string; am: string; pin: string }[] = [
  { role: 'housekeeping', en: 'Housekeeping Terminal', am: 'ሃውስ ኪፒንግ (ጽዳት)', pin: '2020' },
  { role: 'maintenance', en: 'Maintenance Terminal', am: 'ሚንተናስ (ጥገና)', pin: '3030' },
  { role: 'manager', en: 'Manager Quick Brief', am: 'ማናጀር (ሪፖርት እና መልእክት)', pin: '4040' },
  { role: 'staff', en: 'Security / Store / Staff', am: 'ጥበቃ / ስቶር / ሌሎች ሰራተኞች', pin: '5050' },
];

export function StaffMiniPortal() {
  const {
    language,
    setLanguage,
    t,
    activeHotelId,
    activeHotel,
    users,
    activeUser,
    setActiveUserId,
    rooms,
    maintenance,
    messages,
    taskReports,
    managerOverview,
    dailyReport,
    setWorkspaceMode,
    loginWithPin,
    logout,
    refreshAll,
    announce,
  } = useHotel();

  // Restricted staff user: never expose reception/full system here
  const staffTerminalUsers = users.filter((u) => u.role !== 'reception');
  const currentStaff =
    staffTerminalUsers.find((u) => u.id === activeUser?.id) ?? staffTerminalUsers[0] ?? null;
  const role = currentStaff?.role || 'housekeeping';

  // Quick Report / Message state
  const [recipientRole, setRecipientRole] = useState<MessageTargetRole>('manager');
  const [category, setCategory] = useState<MessageCategory>('Status Report');
  const [priority, setPriority] = useState<MessagePriority>('Normal');
  const [roomNumber, setRoomNumber] = useState('General');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Maintenance quick fault form (used by Housekeeping / Staff / Maintenance)
  const [faultRoomId, setFaultRoomId] = useState<string>(rooms[0]?.id || 'common');
  const [faultCategory, setFaultCategory] = useState<MaintenanceCategory>('Plumbing');
  const [faultSeverity, setFaultSeverity] = useState<MaintenanceSeverity>('Medium');
  const [faultTitle, setFaultTitle] = useState('');
  const [faultSubmitting, setFaultSubmitting] = useState(false);

  // Unlock modal to return to Full PMS (requires PIN 1010 or 4040 for real-world separation)
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const roleMessages = useMemo(() => {
    return messages.filter(
      (m) => m.recipientRole === 'all' || m.recipientRole === role || m.senderRole === role
    );
  }, [messages, role]);

  const handleAck = async (messageId: string) => {
    if (!currentStaff) return;
    await hotelApi.acknowledgeMessage(activeHotelId, messageId, currentStaff.id);
    await refreshAll();
  };

  const handleSendQuickReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff) return;
    setSending(true);
    try {
      const msg = await hotelApi.sendMessage(activeHotelId, {
        staffId: currentStaff.id,
        recipientRole,
        category,
        priority,
        roomNumber,
        subject,
        body,
      });
      await refreshAll();
      announce(
        `Report sent to ${msg.recipientRole}: ${msg.subject}`,
        `ሪፖርት ለ${msg.recipientRole} ተልኳል: ${msg.subject}`,
        msg.priority === 'Urgent' ? 'warning' : 'success'
      );
      setSubject('');
      setBody('');
    } finally {
      setSending(false);
    }
  };

  const handleQuickCleaning = async (roomId: string, roomNum: string, status: CleaningStatus) => {
    if (!currentStaff) return;
    await hotelApi.updateHousekeeping(activeHotelId, roomId, {
      cleaningStatus: status,
      housekeepingNotes: `Updated via Staff Terminal by ${currentStaff.name}`,
      staffId: currentStaff.id,
    });
    await refreshAll();
    announce(
      `Room ${roomNum} marked ${status}.`,
      `ክፍል ${roomNum} ${status === 'Clean' ? 'ንጹህ' : status === 'Dirty' ? 'ቆሻሻ' : 'በምርመራ ላይ'} ተብሏል።`,
      status === 'Clean' ? 'success' : 'info'
    );
  };

  const handleQuickFaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff) return;
    setFaultSubmitting(true);
    try {
      const rm = rooms.find((r) => r.id === faultRoomId);
      await hotelApi.createMaintenance(activeHotelId, {
        roomId: faultRoomId === 'common' ? null : faultRoomId,
        locationLabel: rm ? `Room ${rm.roomNumber}` : 'Common Area',
        category: faultCategory,
        severity: faultSeverity,
        title: faultTitle,
        description: `Reported from ${currentStaff.departmentLabel} terminal`,
        blockRoom: false,
        staffId: currentStaff.id,
      });
      await refreshAll();
      announce(
        `Maintenance fault reported: ${faultTitle}`,
        `የጥገና ሪፖርት ተልኳል: ${faultTitle}`,
        'warning'
      );
      setFaultTitle('');
    } finally {
      setFaultSubmitting(false);
    }
  };

  const handleUnlockFullSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);
    try {
      const authenticated = await loginWithPin(activeHotelId, unlockPin);
      if (authenticated.role !== 'manager' && authenticated.role !== 'reception') {
        setUnlockError(
          language === 'am'
            ? 'ሙሉውን ሲስተም ለመክፈት የሪሴፕሽን (1010) ወይም የማናጀር (4040) PIN ያስፈልጋል።'
            : 'Reception (1010) or Manager (4040) PIN required.'
        );
        return;
      }
      setUnlockModalOpen(false);
      setUnlockPin('');
      setWorkspaceMode('full');
    } catch (err) {
      setUnlockError(
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Restricted Terminal Header — NO full PMS links, NO guest/finance menus */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white px-4 sm:px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-display font-extrabold text-amber-400">{t.brand}</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
              </span>
            </div>
            <h1 className="font-display text-base font-bold text-white mt-0.5">
              {language === 'am'
                ? 'የሰራተኞች ሪፖርት እና መልእክት ፖርታል'
                : 'Staff Dispatch & Reporting Terminal'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              onClick={() => setUnlockModalOpen(true)}
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
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Role Terminal Selector (Switch between Housekeeping, Maintenance, Manager Brief, Other Staff) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 mb-2.5">
            {language === 'am'
              ? 'የስራ ክፍልዎን ይምረጡ (ሙሉ ሲስተሙ ተደብቋል)'
              : 'Select Your Department Terminal (Full PMS & Finance Hidden)'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {STAFF_TERMINAL_ROLES.map((item) => {
              const matchedUser = staffTerminalUsers.find((u) => u.role === item.role);
              const isSelected = role === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => matchedUser && setActiveUserId(matchedUser.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    {language === 'am' ? item.am : item.en}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {matchedUser ? (language === 'am' ? matchedUser.amharicName : matchedUser.name) : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Role-Specific Action Area (Strictly Scoped — No Guest Names, No Full Ledger) */}
        {role === 'housekeeping' && (
          <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'ከሪሴፕሽን የመጡ የጽዳት ሪፖርቶች' : 'Assigned Cleaning Tasks from Reception'}
            </h2>
            <div className="mt-3 divide-y divide-slate-200">
              {taskReports.filter((t) => t.targetDepartment === 'housekeeping' && t.status !== 'Completed')
                .length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t.noRecords}</p>
              ) : (
                taskReports
                  .filter((t) => t.targetDepartment === 'housekeeping' && t.status !== 'Completed')
                  .map((tsk) => (
                    <div key={tsk.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">
                          {tsk.roomNumber === 'General' ? 'Common' : `Room ${tsk.roomNumber}`} · {tsk.priority}
                        </div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5">{tsk.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tsk.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await hotelApi.updateHousekeepingTask(activeHotelId, tsk.id, {
                                status: 'In Progress',
                                completionNotes: '',
                                staffId: currentStaff?.id || '',
                              });
                              await refreshAll();
                            }}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {language === 'am' ? 'ጽዳት ጀምር' : 'Start Cleaning'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await hotelApi.updateHousekeepingTask(activeHotelId, tsk.id, {
                              status: 'Completed',
                              completionNotes: 'Cleaned via Housekeeping Terminal',
                              staffId: currentStaff?.id || '',
                            });
                            await refreshAll();
                            announce(
                              `Room ${tsk.roomNumber} cleaning completed.`,
                              `የክፍል ${tsk.roomNumber} ጽዳት ተጠናቋል።`,
                              'success'
                            );
                          }}
                          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          {language === 'am' ? 'አጠናቅቄያለሁ' : 'Mark Completed'}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'የክፍሎች ጽዳት ፈጣን ማዘመኛ' : 'Quick Room Cleaning Status'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'የክፍል ቁጥር እና የጽዳት ሁኔታ ብቻ ይታያል (የእንግዳ እና የገንዘብ መረጃ አይታይም)'
                : 'Room numbers and cleaning state only — guest & billing records are hidden'}
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      Room {r.roomNumber}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        r.cleaningStatus === 'Clean'
                          ? 'text-emerald-700'
                          : r.cleaningStatus === 'Dirty'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {r.cleaningStatus}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.cleaningStatus !== 'Clean' && (
                      <button
                        type="button"
                        onClick={() => handleQuickCleaning(r.id, r.roomNumber, 'Clean')}
                        className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                      >
                        {t.markClean}
                      </button>
                    )}
                    {r.cleaningStatus === 'Clean' && (
                      <button
                        type="button"
                        onClick={() => handleQuickCleaning(r.id, r.roomNumber, 'Dirty')}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {t.flagDirty}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          </div>
        )}

        {role === 'maintenance' && (
          <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'ከሪሴፕሽን የመጡ የጥገና ትዕዛዞች' : 'Assigned Maintenance Requests from Reception'}
            </h2>
            <div className="mt-3 divide-y divide-slate-200">
              {taskReports.filter((t) => t.targetDepartment === 'maintenance' && t.status !== 'Completed')
                .length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t.noRecords}</p>
              ) : (
                taskReports
                  .filter((t) => t.targetDepartment === 'maintenance' && t.status !== 'Completed')
                  .map((tsk) => (
                    <div key={tsk.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">
                          {tsk.roomNumber === 'General' ? 'Common' : `Room ${tsk.roomNumber}`} · {tsk.priority}
                        </div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5">{tsk.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tsk.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await hotelApi.updateMaintenanceTask(activeHotelId, tsk.id, {
                                status: 'In Progress',
                                completionNotes: '',
                                staffId: currentStaff?.id || '',
                              });
                              await refreshAll();
                            }}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {t.startWork}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await hotelApi.updateMaintenanceTask(activeHotelId, tsk.id, {
                              status: 'Completed',
                              completionNotes: 'Repaired via Maintenance Terminal',
                              staffId: currentStaff?.id || '',
                            });
                            await refreshAll();
                            announce(
                              `Maintenance completed for Room ${tsk.roomNumber}.`,
                              `የክፍል ${tsk.roomNumber} ጥገና ተጠናቋል።`,
                              'success'
                            );
                          }}
                          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          {language === 'am' ? 'ተጠናቋል' : 'Mark Completed'}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {language === 'am' ? 'የተመደቡ የጥገና ስራዎች' : 'Assigned Maintenance Tickets'}
            </h2>
            <div className="mt-3 divide-y divide-slate-200">
              {maintenance.filter((m) => m.status !== 'Resolved').length === 0 ? (
                <p className="py-4 text-sm text-slate-500">{t.noRecords}</p>
              ) : (
                maintenance
                  .filter((m) => m.status !== 'Resolved')
                  .map((issue) => (
                    <div key={issue.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">
                          {issue.id} · {issue.locationLabel} · {issue.severity}
                        </div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5">{issue.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {issue.status === 'Open' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await hotelApi.updateMaintenance(activeHotelId, issue.id, {
                                status: 'In Progress',
                                resolutionNotes: 'Technician started repair',
                                restoreRoom: false,
                                staffId: currentStaff?.id || '',
                              });
                              await refreshAll();
                            }}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {t.startWork}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await hotelApi.updateMaintenance(activeHotelId, issue.id, {
                              status: 'Resolved',
                              resolutionNotes: 'Completed from Maintenance Terminal',
                              restoreRoom: true,
                              staffId: currentStaff?.id || '',
                            });
                            await refreshAll();
                            announce(
                              `Ticket ${issue.id} resolved.`,
                              `የጥገና ቲኬት ${issue.id} ተጠግኖ ተዘግቷል።`,
                              'success'
                            );
                          }}
                          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          {t.resolveIssue}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>
          </div>
        )}

        {role === 'manager' && dailyReport && (
          <div className="space-y-4">
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{t.kpiOccupancy}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {dailyReport.occupiedRooms} / {dailyReport.totalRooms}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{t.kpiRevenue}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
                {dailyReport.totalCollected.toLocaleString()} {t.currency}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{t.kpiDirty}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700 tabular-nums">
                {dailyReport.dirtyRooms}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{t.kpiMaintenance}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-red-700 tabular-nums">
                {dailyReport.openMaintenanceCount}
              </div>
            </div>
          </section>
          {managerOverview && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                {language === 'am'
                  ? 'የ3ቱ ክፍሎች (ሪሴፕሽን፣ ሃውስ ኪፒንግ፣ ሚንተናስ) ቀጥታ እንቅስቃሴ'
                  : 'Unified Department Activity (Reception · Housekeeping · Maintenance)'}
              </h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-slate-500">Reception Dispatches</div>
                  <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                    {managerOverview.receptionReportsToday}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-slate-500">Housekeeping Done / Open</div>
                  <div className="mt-1 font-mono text-base font-semibold text-emerald-700 tabular-nums">
                    {managerOverview.housekeepingCompleted} /{' '}
                    {managerOverview.housekeepingPending + managerOverview.housekeepingInProgress}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-slate-500">Maintenance Done / Open</div>
                  <div className="mt-1 font-mono text-base font-semibold text-amber-700 tabular-nums">
                    {managerOverview.maintenanceCompleted} /{' '}
                    {managerOverview.maintenancePending + managerOverview.maintenanceInProgress}
                  </div>
                </div>
              </div>
            </section>
          )}
          </div>
        )}

        {/* Two-Column Messaging + Quick Reporting Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Incoming Messages Inbox (መልእክት መቀበያ) */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">{t.inboxTitle}</h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">{roleMessages.length}</span>
            </div>

            {roleMessages.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {roleMessages.map((m) => {
                  const ack = currentStaff ? m.acknowledgedBy.includes(currentStaff.id) : false;
                  return (
                    <div key={m.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-slate-800">
                          {m.senderName} → {m.recipientRole}
                        </span>
                        <span className="font-mono tabular-nums">
                          {m.priority === 'Urgent' && (
                            <span className="text-red-700 font-semibold mr-2">Urgent</span>
                          )}
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{m.subject}</div>
                      <p className="text-xs text-slate-600">{m.body}</p>
                      <div className="pt-1 flex justify-end">
                        {ack ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" />
                            <span>{t.acknowledgedLabel}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAck(m.id)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {t.acknowledgeBtn}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Send Report / Message + Quick Fault Report */}
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t.sendReportTitle}
              </h2>
              <form onSubmit={handleSendQuickReport} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="st-rec" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.recipientRole}
                    </label>
                    <select
                      id="st-rec"
                      value={recipientRole}
                      onChange={(e) => setRecipientRole(e.target.value as MessageTargetRole)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="manager">Manager / ማናጀር</option>
                      <option value="reception">Reception / ሪሴፕሽን</option>
                      <option value="maintenance">Maintenance / ጥገና</option>
                      <option value="housekeeping">Housekeeping / ጽዳት</option>
                      <option value="all">All Staff / ሁሉም</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="st-prio" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.priority}
                    </label>
                    <select
                      id="st-prio"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as MessagePriority)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="st-cat" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.messageCategory}
                    </label>
                    <select
                      id="st-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as MessageCategory)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="Status Report">Status Report</option>
                      <option value="Incident Alert">Incident Alert</option>
                      <option value="Supply Request">Supply Request</option>
                      <option value="Manager Notice">Manager Notice</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="st-rm" className="block text-xs font-medium text-slate-700 mb-1">
                      {t.location}
                    </label>
                    <select
                      id="st-rm"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                    >
                      <option value="General">General</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.roomNumber}>
                          Room {r.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t.subject}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <textarea
                  rows={2}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t.messageBody}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{sending ? '...' : t.sendMessageBtn}</span>
                </button>
              </form>
            </section>

            {/* Quick Fault Report Widget */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {language === 'am' ? 'ፈጣን የጥገና ብልሽት ማሳወቂያ' : 'Quick Maintenance Fault Report'}
              </h3>
              <form onSubmit={handleQuickFaultSubmit} className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={faultRoomId}
                    onChange={(e) => setFaultRoomId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="common">Common</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Rm {r.roomNumber}
                      </option>
                    ))}
                  </select>
                  <select
                    value={faultCategory}
                    onChange={(e) => setFaultCategory(e.target.value as MaintenanceCategory)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Network & TV">Network & TV</option>
                  </select>
                  <select
                    value={faultSeverity}
                    onChange={(e) => setFaultSeverity(e.target.value as MaintenanceSeverity)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={faultTitle}
                  onChange={(e) => setFaultTitle(e.target.value)}
                  placeholder={language === 'am' ? 'የተበላሸውን ነገር ይጻፉ...' : 'Describe broken fixture...'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={faultSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {faultSubmitting ? '...' : t.submitIssue}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>

      {/* PIN Modal to Unlock Full System */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {language === 'am' ? 'ወደ ሙሉ ሲስተም መግቢያ' : 'Unlock Full Operations System'}
              </h3>
              <button
                type="button"
                onClick={() => setUnlockModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUnlockFullSystem} className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                {language === 'am'
                  ? 'ሙሉውን የሆቴል ሲስተም ለመክፈት የሪሴፕሽን (1010) ወይም የማናጀር (4040) PIN ያስገቡ።'
                  : 'Enter Reception (1010) or Manager (4040) PIN to exit the restricted staff terminal.'}
              </p>
              {unlockError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {unlockError}
                </div>
              )}
              <input
                type="password"
                inputMode="numeric"
                required
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
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
      <MobileSmsToast />
    </div>
  );
}
