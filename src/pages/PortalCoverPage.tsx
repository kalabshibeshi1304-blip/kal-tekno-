import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BedDouble,
  Building2,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Globe,
  History,
  MessageSquare,
  Receipt,
  ShieldAlert,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wine,
  Wrench,
} from 'lucide-react';
import { useHotel, type PortalKey } from '../context/VoiceContext';
import type { AuthenticatedSessionUser } from '../types/hotel';

const COVER_IMAGE_URL = '/src/assets/images/tekno_hotel_cover_1795381364972.jpg';

interface PortalDirectoryCard {
  key: PortalKey;
  titleEn: string;
  titleAm: string;
  descEn: string;
  descAm: string;
  groupEn: string;
  groupAm: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PORTAL_CARDS: PortalDirectoryCard[] = [
  {
    key: 'customers',
    titleEn: 'Customer Registry & Info',
    titleAm: 'የከስተመር መመዝገቢያ እና መረጃ',
    descEn: 'Register guests, verify ID/passport records, and track inquiries.',
    descAm: 'የእንግዶችን መረጃ መመዝገብ፣ መታወቂያ ማረጋገጥ እና ጥያቄዎችን መቀበል።',
    groupEn: 'Front Desk',
    groupAm: 'ሪሴፕሽን',
    icon: Users,
  },
  {
    key: 'reception',
    titleEn: 'Reception & Check-In',
    titleAm: 'ሪሴፕሽን እና እንግዳ መግቢያ',
    descEn: 'Assign clean rooms, check guests in/out, and manage stays.',
    descAm: 'እንግዶችን ማስገባት፣ ማውጣት እና የቆይታ ዝርዝር ማስተዳደር።',
    groupEn: 'Front Desk',
    groupAm: 'ሪሴፕሽን',
    icon: UserCheck,
  },
  {
    key: 'payments',
    titleEn: 'Manual Payments',
    titleAm: 'ማኑዋል ክፍያዎች',
    descEn: 'Record Cash, CBE/Awash Bank slips, Telebirr, and POS receipts.',
    descAm: 'ጥሬ ገንዘብ፣ የባንክ ደረሰኝ፣ ቴሌብር እና POS ክፍያዎችን መመዝገብ።',
    groupEn: 'Finance',
    groupAm: 'ክፍያ',
    icon: CreditCard,
  },
  {
    key: 'cashier',
    titleEn: 'Cashier & Billing Desk',
    titleAm: 'ካሸር እና የክፍያ ማረጋገጫ',
    descEn: 'Settle open restaurant/bar bills, verify bank slips, and sync ActivityLog.',
    descAm: 'የጠረጴዛ እና ባር ሂሳቦችን መዝጋት፣ የባንክ ደረሰኝ ማረጋገጥ እና ደረሰኝ መቁረጥ።',
    groupEn: 'Finance',
    groupAm: 'ካሸር / ሂሳብ',
    icon: Receipt,
  },
  {
    key: 'waiter',
    titleEn: 'Waiter & Tableside Orders',
    titleAm: 'አስተናጋጅ (ከስተመር ጋር ትዕዛዝ)',
    descEn: 'Take dining/room orders tableside with automatic Kitchen & Bar split.',
    descAm: 'ከስተመር ጋር ሆነው ትዕዛዝ ወስደው ለኪችን እና ለባር በራስ-ሰር መላኪያ።',
    groupEn: 'Restaurant & Bar',
    groupAm: 'ምግብ እና ባር',
    icon: ClipboardList,
  },
  {
    key: 'kitchen',
    titleEn: 'Kitchen Display (Food)',
    titleAm: 'ኪችን (የምግብ ትዕዛዝ ገጽ)',
    descEn: 'Live food-only preparation queue and waiter ready alerts.',
    descAm: 'የምግብ ትዕዛዞችን ብቻ ተቀብሎ ማብሰል እና ዝግጁ ሲሆን ማሳወቅ።',
    groupEn: 'Restaurant & Bar',
    groupAm: 'ምግብ እና ባር',
    icon: ChefHat,
  },
  {
    key: 'bar',
    titleEn: 'Bar & Espresso Display',
    titleAm: 'ባር እና ካፌ (የመጠጥ ገጽ)',
    descEn: 'Dedicated beverage & espresso ticket queue for bartenders.',
    descAm: 'የትኩስ፣ ቀዝቃዛ እና የባር መጠጦች ትዕዛዝ መቀበያ እና ማሳወቂያ።',
    groupEn: 'Restaurant & Bar',
    groupAm: 'ምግብ እና ባር',
    icon: Wine,
  },
  {
    key: 'fb',
    titleEn: 'F&B Menu & Stock',
    titleAm: 'የምግብ እና መጠጥ ሜኑ እና ክምችት',
    descEn: 'Configure menu prices, portions, and kitchen/bar inventory.',
    descAm: 'የምግብና መጠጥ ዝርዝር፣ ዋጋ እና የእቃ ክምችት ማስተዳደሪያ።',
    groupEn: 'Restaurant & Bar',
    groupAm: 'ምግብ እና ባር',
    icon: UtensilsCrossed,
  },
  {
    key: 'housekeeping',
    titleEn: 'Housekeeping Queue',
    titleAm: 'ሃውስ ኪፒንግ (ጽዳት)',
    descEn: 'Receive cleaning dispatches and mark rooms Clean or Inspecting.',
    descAm: 'የጽዳት ትዕዛዞችን ተቀብሎ ክፍሎችን ንጹህ ማድረግ እና ሪፖርት መላክ።',
    groupEn: 'Operations',
    groupAm: 'ኦፕሬሽን',
    icon: ClipboardCheck,
  },
  {
    key: 'maintenance',
    titleEn: 'Maintenance Work Orders',
    titleAm: 'ሚንተናስ (ጥገና)',
    descEn: 'Track plumbing, electrical, HVAC repairs and completion reports.',
    descAm: 'የጥገና ጥያቄዎችን ተቀብሎ መስራት እና መጠናቀቁን ማሳወቅ።',
    groupEn: 'Operations',
    groupAm: 'ኦፕሬሽን',
    icon: Wrench,
  },
  {
    key: 'dispatch',
    titleEn: 'Staff Messages & Reports',
    titleAm: 'የሰራተኞች መልእክት እና ሪፖርት',
    descEn: 'Internal inter-department messaging and urgent alert dispatch.',
    descAm: 'በዲፓርትመንቶች መካከል መልእክት እና አስቸኳይ ሪፖርት መላላኪያ።',
    groupEn: 'Communications',
    groupAm: 'መልእክት',
    icon: MessageSquare,
  },
  {
    key: 'room-setup',
    titleEn: 'Rooms, Types & Pricing',
    titleAm: 'የክፍል ብዛት፣ አይነት እና ዋጋ',
    descEn: 'Bulk provision rooms, configure room tiers, and update ETB rates.',
    descAm: 'የሆቴሉን ክፍሎች ብዛት፣ ደረጃ እና ዕለታዊ ዋጋ ማስተካከያ።',
    groupEn: 'Management',
    groupAm: 'ማኔጅመንት',
    icon: BedDouble,
  },
  {
    key: 'overview',
    titleEn: 'Room Status Matrix',
    titleAm: 'የክፍሎች ሁኔታ ዝርዝር',
    descEn: 'Inspect floor-by-floor live room occupancy and cleaning matrix.',
    descAm: 'የክፍሎችን የቆይታ እና የጽዳት ሁኔታ በዝርዝር መመልከቻ።',
    groupEn: 'Management',
    groupAm: 'ማኔጅመንት',
    icon: Building2,
  },
  {
    key: 'manager',
    titleEn: 'Manager Live Monitor',
    titleAm: 'የማናጀር ቀጥታ መከታተያ',
    descEn: 'Unified oversight across Reception, Housekeeping, Maintenance, and F&B.',
    descAm: 'የሁሉም ዲፓርትመንቶች እንቅስቃሴ በአንድ ላይ መከታተያ።',
    groupEn: 'Management',
    groupAm: 'ማኔጅመንት',
    icon: Activity,
  },
  {
    key: 'reports',
    titleEn: 'Daily Revenue & CSV',
    titleAm: 'ዕለታዊ የገቢ ሪፖርት',
    descEn: 'Cash drawer, CBE/Awash bank transfers, Telebirr, and CSV export.',
    descAm: 'የጥሬ ገንዘብ፣ የባንክ፣ የቴሌብር ገቢ ማጠቃለያ እና CSV ማውረጃ።',
    groupEn: 'Management',
    groupAm: 'ማኔጅመንት',
    icon: BarChart3,
  },
  {
    key: 'audit',
    titleEn: 'Staff Audit Trail',
    titleAm: 'የሰራተኞች ኦዲት ሎግ',
    descEn: 'Timestamped log of every action across Reception, Waiter, Kitchen, Bar.',
    descAm: 'በእያንዳንዱ ሰራተኛ የተሰሩ ተግባራት በሰዓት የተመዘገቡበት ኦዲት።',
    groupEn: 'Management',
    groupAm: 'ማኔጅመንት',
    icon: History,
  },
  {
    key: 'central',
    titleEn: 'Central Multi-Hotel Hub',
    titleAm: 'ዋና ሰርቨር (ሁሉም ሆቴሎች)',
    descEn: 'Manage branch hotels, profiles, amenities, and server broadcasts.',
    descAm: 'በዋናው ሰርቨር ስር ያሉ ሁሉንም ሆቴሎች መመዝገብ እና ማስተዳደር።',
    groupEn: 'Central Server',
    groupAm: 'ዋና ሰርቨር',
    icon: Globe,
  },
];

function isPortalPermitted(key: PortalKey, user: AuthenticatedSessionUser | null): boolean {
  if (!user) return false;
  if (key === 'central') return user.isCentralAdmin;
  if (user.isCentralAdmin || user.role === 'manager') return true;

  switch (key) {
    case 'cover':
    case 'dispatch':
      return true;
    case 'customers':
    case 'reception':
      return user.role === 'reception';
    case 'payments':
      return user.role === 'reception' || user.role === 'cashier';
    case 'cashier':
      return user.role === 'cashier' || user.role === 'reception';
    case 'overview':
      return user.role === 'reception' || user.role === 'cashier';
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
    default:
      return false;
  }
}

export function PortalCoverPage() {
  const {
    language,
    authUser,
    activeHotel,
    setActivePortal,
    setWorkspaceMode,
  } = useHotel();

  const [imgFailed, setImgFailed] = useState(false);

  const permittedPortals = PORTAL_CARDS.filter((card) => isPortalPermitted(card.key, authUser));

  return (
    <div className="space-y-8">
      {/* Architectural Obsidian Cover Banner — No Room Statuses Exposed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-800 bg-slate-950 text-white overflow-hidden items-stretch shadow-sm">
        <div className="lg:col-span-6 p-6 sm:p-9 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="text-xs font-bold tracking-widest uppercase text-amber-400">
              {language === 'am' ? 'ቃል ቴክኖ · ዋና ሰርቨር' : 'KAL TEKNO · CENTRAL SERVER'}
              {activeHotel ? ` · ${activeHotel.code} · ${language === 'am' ? activeHotel.amharicCity : activeHotel.city}` : ''}
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              {activeHotel
                ? language === 'am'
                  ? activeHotel.amharicName
                  : activeHotel.name
                : language === 'am'
                  ? 'ቃል ቴክኖ ዋና ሰርቨር'
                  : 'Kal Tekno Central Server'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              {language === 'am'
                ? 'እንኳን በደህና መጡ። ከዚህ መነሻ ከቨር ገጽ በቀጥታ የክፍል ሁኔታን ሳያጋልጡ የሚፈልጉትን የስራ ክፍል ፖርታል መርጠው ስራዎን መጀመር ይችላሉ።'
                : 'Welcome to your hotel portal hub. Launch directly into any authorized department workspace below without exposing live room inventory on the cover screen.'}
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-800 pt-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>
                {language === 'am' ? 'የገቡት ሰራተኛ፡ ' : 'Signed in: '}
                <strong className="font-semibold text-white">
                  {authUser ? (language === 'am' ? authUser.amharicName : authUser.name) : ''}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize text-amber-300">{authUser?.role}</span>
              {activeHotel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Check-in {activeHotel.checkInTime} / Out {activeHotel.checkOutTime}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {(authUser?.role === 'reception' || authUser?.role === 'manager' || authUser?.isCentralAdmin) && (
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('reception-desk')}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {language === 'am' ? 'የሪሴፕሽን ብቻ ፖርታል ክፈት' : 'Open Reception Desk Portal'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setWorkspaceMode('staff-terminal')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {language === 'am' ? 'የሰራተኞች ሪፖርት ተርሚናል' : 'Open Staff Report Terminal'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[260px] bg-slate-900">
          {!imgFailed ? (
            <img
              src={COVER_IMAGE_URL}
              alt={activeHotel ? activeHotel.name : 'Kal Tekno Hotel Lobby'}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-slate-200">
              <Building2 className="h-12 w-12 text-amber-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
          <div className="hidden lg:block absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-slate-100">
            <span className="font-display font-bold">
              {language === 'am' ? 'ቃል ቴክኖ ሆቴል ኦፕሬሽንስ' : 'Kal Tekno Hospitality Suite'}
            </span>
            {activeHotel && (
              <span className="font-mono text-amber-300 tabular-nums">
                {activeHotel.starRating}★ · {activeHotel.city}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Portal Launcher Grid */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-950">
              {language === 'am' ? 'ወደ ስራ ክፍል ፖርታል ይግቡ' : 'Department Portals'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'am'
                ? 'ለስራዎ የተፈቀደውን ፖርታል በመንካት በቀጥታ ይክፈቱ'
                : 'Select any portal below to open its dedicated operational workspace'}
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {permittedPortals.length} {language === 'am' ? 'ፖርታሎች' : 'portals'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {permittedPortals.map((card, index) => {
            const Icon = card.icon;
            const numLabel = String(index + 1).padStart(2, '0');
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setActivePortal(card.key)}
                className="group rounded-xl border border-slate-200 bg-white p-5 text-left hover:-translate-y-0.5 hover:border-amber-500 transition-all duration-200 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-amber-700 tabular-nums">
                        {numLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium">
                        {language === 'am' ? card.groupAm : card.groupEn}
                      </span>
                    </div>
                    <span className="rounded-lg border border-slate-200/80 bg-slate-50 p-2 text-slate-600 group-hover:border-amber-200 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="font-display text-base font-bold text-slate-950 group-hover:text-amber-800 transition-colors">
                    {language === 'am' ? card.titleAm : card.titleEn}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {language === 'am' ? card.descAm : card.descEn}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 pt-2.5 border-t border-slate-100">
                  <span>{language === 'am' ? 'ፖርታል ክፈት' : 'Open Portal'}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
