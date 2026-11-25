import React, { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type { MessageCategory, MessagePriority, MessageTargetRole } from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const TARGET_ROLES: { value: MessageTargetRole; en: string; am: string }[] = [
  { value: 'housekeeping', en: 'Housekeeping Team', am: 'ሃውስ ኪፒንግ (ጽዳት)' },
  { value: 'maintenance', en: 'Maintenance Team', am: 'ሚንተናስ (ጥገና)' },
  { value: 'manager', en: 'Hotel Manager', am: 'ማናጀር' },
  { value: 'reception', en: 'Reception Desk', am: 'ሪሴፕሽን' },
  { value: 'staff', en: 'Security / Store / Other Staff', am: 'ጥበቃ / ስቶር / ሌሎች ሰራተኞች' },
  { value: 'all', en: 'All Staff (Broadcast)', am: 'ሁሉም ሰራተኞች' },
];

const CATEGORIES: MessageCategory[] = [
  'Task Dispatch',
  'Status Report',
  'Incident Alert',
  'Supply Request',
  'Manager Notice',
];

export function DispatchHubPage() {
  const {
    language,
    t,
    activeHotelId,
    activeUser,
    rooms,
    messages,
    refreshAll,
    announce,
  } = useHotel();

  const [recipientRole, setRecipientRole] = useState<MessageTargetRole>('housekeeping');
  const [category, setCategory] = useState<MessageCategory>('Task Dispatch');
  const [priority, setPriority] = useState<MessagePriority>('Normal');
  const [roomNumber, setRoomNumber] = useState('General');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const msg = await hotelApi.sendMessage(activeHotelId, {
        staffId: activeUser?.id || '',
        recipientRole,
        category,
        priority,
        roomNumber,
        subject,
        body,
      });
      await refreshAll();
      announce(
        `Dispatched ${msg.priority} message to ${msg.recipientRole}: ${msg.subject}`,
        `ለ${msg.recipientRole} መልእክት ተልኳል: ${msg.subject}`,
        msg.priority === 'Urgent' ? 'warning' : 'info'
      );
      setSubject('');
      setBody('');
    } finally {
      setSending(false);
    }
  };

  const handleAck = async (messageId: string) => {
    if (!activeUser) return;
    await hotelApi.acknowledgeMessage(activeHotelId, messageId, activeUser.id);
    await refreshAll();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Send Dispatch / Report Form (5 cols) */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-slate-900">{t.sendReportTitle}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'am'
            ? 'ለሚመለከታቸው የስራ ክፍሎች ቀጥታ መልእክት ወይም የስራ ትዕዛዝ ይላኩ'
            : 'Send instant task dispatches, supply requests, or notices to any department'}
        </p>

        <form onSubmit={handleSend} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="disp-role" className="block text-xs font-medium text-slate-700 mb-1">
                {t.recipientRole}
              </label>
              <select
                id="disp-role"
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value as MessageTargetRole)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {TARGET_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {language === 'am' ? r.am : r.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="disp-room" className="block text-xs font-medium text-slate-700 mb-1">
                {t.location}
              </label>
              <select
                id="disp-room"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="General">{language === 'am' ? 'አጠቃላይ ቦታ' : 'General / Hotel'}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.roomNumber}>
                    Room {r.roomNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="disp-cat" className="block text-xs font-medium text-slate-700 mb-1">
                {t.messageCategory}
              </label>
              <select
                id="disp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="disp-prio" className="block text-xs font-medium text-slate-700 mb-1">
                {t.priority}
              </label>
              <select
                id="disp-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value as MessagePriority)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="disp-sub" className="block text-xs font-medium text-slate-700 mb-1">
              {t.subject}
            </label>
            <input
              id="disp-sub"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={language === 'am' ? 'ለምሳሌ፡ ክፍል 204 በአስቸኳይ ይጽዳ' : 'e.g. Room 204 priority clean'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="disp-body" className="block text-xs font-medium text-slate-700 mb-1">
              {t.messageBody}
            </label>
            <textarea
              id="disp-body"
              rows={3}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={language === 'am' ? 'ዝርዝር መመሪያ ወይም ሪፖርት...' : 'Write instructions or report details...'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>{sending ? '...' : t.sendMessageBtn}</span>
          </button>
        </form>
      </section>

      {/* Right: Central Dispatch & Report Feed (7 cols) */}
      <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">{t.inboxTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {messages.length} {language === 'am' ? 'መልእክቶች' : 'messages'}
            </p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{t.noRecords}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {messages.map((m) => {
              const isAck = activeUser ? m.acknowledgedBy.includes(activeUser.id) : false;
              return (
                <div key={m.id} className="p-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{m.senderName}</span>
                      <span>({m.senderRole})</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-medium text-slate-800 capitalize">{m.recipientRole}</span>
                      {m.roomNumber !== 'General' && m.roomNumber !== 'All' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-700">Room {m.roomNumber}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      {m.priority === 'Urgent' && (
                        <span className="font-semibold text-red-700">Urgent</span>
                      )}
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900">{m.subject}</h3>
                  <p className="text-sm text-slate-700">{m.body}</p>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{m.category}</span>
                    {isAck ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t.acknowledgedLabel}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAck(m.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
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
    </div>
  );
}
