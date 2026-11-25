import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Inbox, MessageSquare, Search, UserPlus } from 'lucide-react';
import { useHotel } from '../../context/VoiceContext';
import type {
  CustomerInquiry,
  CustomerProfile,
  InquiryCategory,
  RoomType,
} from '../../types/hotel';
import { hotelApi } from '../../utils/api';

const ID_TYPES: CustomerProfile['idType'][] = ['National ID', 'Passport', 'Driver License', 'Kebele ID'];
const INQUIRY_CATEGORIES: InquiryCategory[] = [
  'Room Inquiry',
  'Reservation Request',
  'Guest Request',
  'Airport Pickup',
  'Feedback / Complaint',
];
const INQUIRY_CHANNELS: CustomerInquiry['channel'][] = [
  'Walk-In',
  'Phone Call',
  'WhatsApp / Telegram',
  'Email',
];

export function CustomerPortalPage() {
  const {
    language,
    t,
    activeHotelId,
    activeHotel,
    activeUser,
    customers,
    inquiries,
    messages,
    setPrefillCustomerForCheckIn,
    setActivePortal,
    refreshAll,
    announce,
  } = useHotel();

  // Segmented left-panel form mode: Register Customer vs Receive Information / Inquiry
  const [formTab, setFormTab] = useState<'register' | 'inquiry'>('register');

  // Customer Registration state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idType, setIdType] = useState<CustomerProfile['idType']>('National ID');
  const [idNumber, setIdNumber] = useState('');
  const [nationality, setNationality] = useState('Ethiopian');
  const [cityOrAddress, setCityOrAddress] = useState('');
  const [company, setCompany] = useState('');
  const [preferences, setPreferences] = useState('');
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custError, setCustError] = useState<string | null>(null);

  // Inquiry / Info Receiving state
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [category, setCategory] = useState<InquiryCategory>('Room Inquiry');
  const [channel, setChannel] = useState<CustomerInquiry['channel']>('Phone Call');
  const [preferredRoomType, setPreferredRoomType] = useState<RoomType | 'Any'>('Any');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [inqSubmitting, setInqSubmitting] = useState(false);
  const [inqError, setInqError] = useState<string | null>(null);

  // Registry Search & Inquiry Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [inquiryFilter, setInquiryFilter] = useState<'All' | 'Open' | 'Handled'>('All');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.idNumber.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const filteredInquiries = useMemo(() => {
    if (inquiryFilter === 'All') return inquiries;
    return inquiries.filter((i) => i.status === inquiryFilter);
  }, [inquiries, inquiryFilter]);

  const receptionIncomingMessages = useMemo(() => {
    return messages.filter((m) => m.recipientRole === 'reception' || m.recipientRole === 'all');
  }, [messages]);

  const returningCount = customers.filter((c) => c.totalStays > 0).length;
  const openInquiriesCount = inquiries.filter((i) => i.status === 'Open').length;
  const unreadReceptionMsgs = activeUser
    ? receptionIncomingMessages.filter((m) => !m.acknowledgedBy.includes(activeUser.id)).length
    : 0;

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustSubmitting(true);
    setCustError(null);
    try {
      const created = await hotelApi.registerCustomer(activeHotelId, {
        fullName,
        phone,
        email,
        idType,
        idNumber,
        nationality,
        cityOrAddress,
        company,
        preferences,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Customer ${created.fullName} registered in ${activeHotel?.name || 'hotel'} directory.`,
        `ከስተመር ${created.fullName} በሆቴሉ የደንበኞች መዝገብ ውስጥ ተመዝግበዋል።`,
        'success'
      );
      setFullName('');
      setPhone('');
      setEmail('');
      setIdNumber('');
      setCityOrAddress('');
      setCompany('');
      setPreferences('');
    } catch (err) {
      setCustError(err instanceof Error ? err.message : 'Unable to register customer');
    } finally {
      setCustSubmitting(false);
    }
  };

  const handleLogInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setInqSubmitting(true);
    setInqError(null);
    try {
      const created = await hotelApi.createInquiry(activeHotelId, {
        customerId: linkedCustomerId,
        contactName,
        contactPhone,
        category,
        channel,
        subject,
        details,
        preferredRoomType,
        staffId: activeUser?.id || '',
      });
      await refreshAll();
      announce(
        `Received ${created.category} via ${created.channel} from ${created.contactName}.`,
        `ከ${created.contactName} በ${created.channel} የመጣ መረጃ ተመዝግቧል።`,
        'info'
      );
      setLinkedCustomerId(null);
      setContactName('');
      setContactPhone('');
      setSubject('');
      setDetails('');
    } catch (err) {
      setInqError(err instanceof Error ? err.message : 'Unable to log customer information');
    } finally {
      setInqSubmitting(false);
    }
  };

  const handleToggleInquiryStatus = async (inq: CustomerInquiry) => {
    const nextStatus = inq.status === 'Open' ? 'Handled' : 'Open';
    const note = responseDrafts[inq.id] ?? inq.responseNotes ?? '';
    await hotelApi.updateInquiryStatus(activeHotelId, inq.id, {
      status: nextStatus,
      responseNotes: note,
      staffId: activeUser?.id || '',
    });
    await refreshAll();
    announce(
      `Inquiry from ${inq.contactName} marked ${nextStatus}.`,
      `የ${inq.contactName} መረጃ ሁኔታ ${nextStatus === 'Handled' ? 'ተስተናግዷል' : 'ክፍት'} ተብሏል።`,
      nextStatus === 'Handled' ? 'success' : 'info'
    );
  };

  const handleCheckInCustomer = (customer: CustomerProfile) => {
    setPrefillCustomerForCheckIn(customer);
    setActivePortal('reception');
  };

  const handlePrefillInquiryFromCustomer = (customer: CustomerProfile) => {
    setLinkedCustomerId(customer.id);
    setContactName(customer.fullName);
    setContactPhone(customer.phone);
    setFormTab('inquiry');
  };

  const handleAckReceptionMessage = async (msgId: string) => {
    if (!activeUser) return;
    await hotelApi.acknowledgeMessage(activeHotelId, msgId, activeUser.id);
    await refreshAll();
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'የተመዘገቡ ከስተመሮች' : 'Registered Customers'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {customers.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {activeHotel ? (language === 'am' ? activeHotel.amharicName : activeHotel.name) : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ተመላላሽ እንግዶች' : 'Returning Guests'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {returningCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ቢያንስ 1 ጊዜ ያረፉ' : 'Profiles with recorded stays'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ምላሽ የሚጠብቁ መረጃዎች' : 'Open Customer Inquiries'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {openInquiriesCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'በስልክ፣ በአካል እና በኦንላይን' : 'Walk-in, phone & message desk'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {language === 'am' ? 'ለሪሴፕሽን የመጡ መልእክቶች' : 'Incoming Dept Updates'}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {unreadReceptionMsgs}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {language === 'am' ? 'ያልተረጋገጡ የውስጥ መልእክቶች' : 'Unacknowledged staff notices'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Customer Registration OR Information / Inquiry Receiving Form */}
        <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFormTab('register')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                formTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{language === 'am' ? 'ከስተመር መዝግብ' : 'Register Customer'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormTab('inquiry')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                formTab === 'inquiry'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>{language === 'am' ? 'መረጃ መቀበያ' : 'Receive Info / Inquiry'}</span>
            </button>
          </div>

          {formTab === 'register' ? (
            <form onSubmit={handleRegisterCustomer} className="mt-4 space-y-3.5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'አዲስ ከስተመር መመዝገቢያ' : 'New Customer Profile Registration'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'የደንበኛ መረጃን ለዚህ ሆቴል ብቻ በቋሚነት ይመዝግቡ'
                    : 'Save verified guest contact, ID, and preferences for quick future check-ins'}
                </p>
              </div>

              {custError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {custError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cust-name" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.guestName}
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kidist Worku"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="cust-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.guestPhone}
                  </label>
                  <input
                    id="cust-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251 911 ..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cust-id-type" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የመታወቂያ አይነት' : 'ID Type'}
                  </label>
                  <select
                    id="cust-id-type"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as CustomerProfile['idType'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    {ID_TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        {tp}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cust-id-num" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.idNumber}
                  </label>
                  <input
                    id="cust-id-num"
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="ETH-NID-..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cust-email" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ኢሜይል' : 'Email'}
                  </label>
                  <input
                    id="cust-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="cust-nat" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.nationality}
                  </label>
                  <input
                    id="cust-nat"
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cust-city" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ከተማ / አድራሻ' : 'City / Address'}
                  </label>
                  <input
                    id="cust-city"
                    type="text"
                    value={cityOrAddress}
                    onChange={(e) => setCityOrAddress(e.target.value)}
                    placeholder="Addis Ababa, Bole"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="cust-comp" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'ድርጅት (ካለ)' : 'Company / Organization'}
                  </label>
                  <input
                    id="cust-comp"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cust-pref" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'የከስተመር ምርጫዎች / ማስታወሻ' : 'Preferences & Reception Notes'}
                </label>
                <input
                  id="cust-pref"
                  type="text"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder={language === 'am' ? 'ለምሳሌ፡ ጸጥ ያለ ክፍል፣ የኤርፖርት ትራንስፖርት...' : 'e.g. Quiet upper floor, airport pickup...'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={custSubmitting}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {custSubmitting
                  ? '...'
                  : language === 'am'
                    ? 'ከስተመር መዝግብ'
                    : 'Register Customer Profile'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogInquiry} className="mt-4 space-y-3.5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የከስተመር መረጃ እና ጥያቄ መቀበያ' : 'Receive Customer Info & Inquiry'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'በስልክ፣ በአካል ወይም በቴሌግራም የሚመጡ የደንበኛ መረጃዎችን መዝግቡ'
                    : 'Record walk-in questions, booking requests, pickup info, or guest feedback'}
                </p>
              </div>

              {inqError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {inqError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inq-name" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የጠያቂ ስም' : 'Contact Name'}
                  </label>
                  <input
                    id="inq-name"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Samuel Tadesse"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="inq-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.guestPhone}
                  </label>
                  <input
                    id="inq-phone"
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+251 9..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="inq-cat" className="block text-xs font-medium text-slate-700 mb-1">
                    {t.category}
                  </label>
                  <select
                    id="inq-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InquiryCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    {INQUIRY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inq-chan" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'መንገድ' : 'Channel'}
                  </label>
                  <select
                    id="inq-chan"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CustomerInquiry['channel'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    {INQUIRY_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inq-room" className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'am' ? 'የሚፈለግ ክፍል' : 'Room Type'}
                  </label>
                  <select
                    id="inq-room"
                    value={preferredRoomType}
                    onChange={(e) => setPreferredRoomType(e.target.value as RoomType | 'Any')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="Any">Any</option>
                    <option value="Standard">Standard</option>
                    <option value="Deluxe">Deluxe</option>
                    <option value="Executive Suite">Executive Suite</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="inq-subj" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.subject}
                </label>
                <input
                  id="inq-subj"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={language === 'am' ? 'የመረጃው አጭር ርዕስ...' : 'e.g. Weekend booking availability'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="inq-det" className="block text-xs font-medium text-slate-700 mb-1">
                  {language === 'am' ? 'ዝርዝር መረጃ' : 'Received Information Details'}
                </label>
                <textarea
                  id="inq-det"
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={language === 'am' ? 'ቀን፣ ሰዓት፣ የበረራ ቁጥር ወይም ሌላ መረጃ...' : 'Arrival dates, flight number, requests...'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={inqSubmitting}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {inqSubmitting
                  ? '...'
                  : language === 'am'
                    ? 'መረጃውን መዝግብ'
                    : 'Save Received Info'}
              </button>
            </form>
          )}
        </section>

        {/* Right Column (7 cols): Searchable Customer Directory + Information & Inquiry Receiving Feed */}
        <div className="xl:col-span-7 space-y-6">
          {/* Customer Directory Table */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የሆቴሉ የከስተመሮች መዝገብ' : 'Hotel Customer Directory'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'am'
                    ? 'የተመዘገቡ ደንበኞችን በስም፣ በስልክ ወይም በመታወቂያ ፈልገው በ1 ጠቅታ ወደ ክፍል ያስገቡ'
                    : 'Search registered guests and launch 1-click room check-in'}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'am' ? 'በስም / ስልክ / መታወቂያ ፈልግ...' : 'Search name, phone, ID...'}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">{language === 'am' ? 'ከስተመር' : 'Customer'}</th>
                      <th className="py-3 px-4">{language === 'am' ? 'መታወቂያ' : 'ID / Nationality'}</th>
                      <th className="py-3 px-4 text-right">{language === 'am' ? 'ቆይታ' : 'Stays'}</th>
                      <th className="py-3 px-4 text-right">{language === 'am' ? 'ድርጊት' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{c.fullName}</div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums">
                            {c.phone}
                            {c.company && <span className="font-sans"> · {c.company}</span>}
                          </div>
                          {c.preferences && (
                            <div className="text-xs text-amber-800 mt-0.5">{c.preferences}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-mono text-slate-800 tabular-nums">{c.idNumber}</div>
                          <div className="text-xs text-slate-500">
                            {c.idType} · {c.nationality}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-700 tabular-nums">
                          {c.totalStays}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrefillInquiryFromCustomer(c)}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                            >
                              {language === 'am' ? 'መረጃ መዝግብ' : 'Log Info'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCheckInCustomer(c)}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                            >
                              <span>{language === 'am' ? 'አስገባ' : 'Check In'}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Information & Inquiries Feed */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'የተቀበልናቸው የከስተመር መረጃዎች እና ጥያቄዎች' : 'Received Customer Information & Inquiries'}
                </h2>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                {(['All', 'Open', 'Handled'] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setInquiryFilter(statusKey)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      inquiryFilter === statusKey
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {statusKey}
                  </button>
                ))}
              </div>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredInquiries.map((inq) => (
                  <div key={inq.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{inq.contactName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{inq.contactPhone}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inq.channel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inq.category}</span>
                      </div>
                      <span
                        className={`font-medium ${
                          inq.status === 'Handled' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {inq.status === 'Handled'
                          ? language === 'am'
                            ? 'ተስተናግዷል'
                            : 'Handled'
                          : language === 'am'
                            ? 'ምላሽ የሚጠብቅ'
                            : 'Open'}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-slate-900">{inq.subject}</div>
                    {inq.details && <p className="text-xs text-slate-600">{inq.details}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="text-xs text-slate-500">
                        {language === 'am' ? 'ተቀባይ' : 'Received by'}: {inq.receivedBy}
                        {inq.handledBy && (
                          <span>
                            {' '}
                            · {language === 'am' ? 'ያስተናገደው' : 'Handled by'}: {inq.handledBy}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {inq.status === 'Open' && (
                          <input
                            type="text"
                            value={responseDrafts[inq.id] ?? ''}
                            onChange={(e) =>
                              setResponseDrafts((prev) => ({ ...prev, [inq.id]: e.target.value }))
                            }
                            placeholder={language === 'am' ? 'የተሰጠ ምላሽ...' : 'Action note...'}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs focus:border-amber-600 focus:outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleInquiryStatus(inq)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                            inq.status === 'Open'
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                              : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {inq.status === 'Open'
                            ? language === 'am'
                              ? 'ተስተናግዷል በል'
                              : 'Mark Handled'
                            : language === 'am'
                              ? 'እንደገና ክፈት'
                              : 'Reopen'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Incoming Internal Updates Addressed to Reception */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {language === 'am' ? 'ከሌሎች ክፍሎች ለሪሴፕሽን የመጡ መልእክቶች' : 'Incoming Staff Updates for Reception'}
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {receptionIncomingMessages.length}
              </span>
            </div>

            {receptionIncomingMessages.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">{t.noRecords}</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {receptionIncomingMessages.slice(0, 6).map((m) => {
                  const ack = activeUser ? m.acknowledgedBy.includes(activeUser.id) : false;
                  return (
                    <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-xs text-slate-500">
                          <span className="font-medium text-slate-800">{m.senderName}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono tabular-nums">
                            {m.roomNumber === 'General' ? 'General' : `Room ${m.roomNumber}`}
                          </span>
                          {m.priority === 'Urgent' && (
                            <span className="ml-1.5 text-red-700 font-semibold">· Urgent</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-900">{m.subject}</div>
                        <p className="text-xs text-slate-600">{m.body}</p>
                      </div>
                      {ack ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                          <Check className="h-3.5 w-3.5" />
                          <span>{t.acknowledgedLabel}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAckReceptionMessage(m.id)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          {t.acknowledgeBtn}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
