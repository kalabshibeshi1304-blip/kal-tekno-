export type UserRole =
  | 'reception'
  | 'cashier'
  | 'housekeeping'
  | 'maintenance'
  | 'manager'
  | 'waiter'
  | 'kitchen'
  | 'bar'
  | 'staff';

export type HotelCategory = 'Boutique' | 'Resort' | 'Business Hotel' | 'Lodge' | 'City Hotel';
export type HotelOperationalStatus = 'Active' | 'Maintenance Mode' | 'Onboarding';

export interface RoomTierSummary {
  type: RoomType;
  total: number;
  availableClean: number;
  occupied: number;
  minRate: number;
  maxRate: number;
}

export interface HotelProperty {
  id: string;
  code: string;
  name: string;
  amharicName: string;
  city: string;
  amharicCity: string;
  address: string;
  phone: string;
  email: string;
  tinNumber: string;
  managerName: string;
  starRating: number;
  category: HotelCategory;
  status: HotelOperationalStatus;
  checkInTime: string;
  checkOutTime: string;
  taxPercent: number;
  serviceChargePercent: number;
  amenities: string[];
  floors: number;
  createdAt: string;
}

export interface HotelOverviewStat extends HotelProperty {
  totalRooms: number;
  occupiedRooms: number;
  cleanReadyRooms: number;
  dirtyRooms: number;
  openMaintenanceCount: number;
  unreadUrgentMessages: number;
  totalCollected: number;
  tierBreakdown: RoomTierSummary[];
}

export interface StaffUser {
  id: string;
  hotelId: string;
  name: string;
  amharicName: string;
  role: UserRole;
  departmentLabel: string;
  shift: string;
  pinCode?: string;
}

export interface AuthenticatedSessionUser {
  userId: string;
  hotelId: string;
  role: UserRole;
  name: string;
  amharicName: string;
  departmentLabel: string;
  isCentralAdmin: boolean;
}

export interface AuthLoginResponse {
  token: string;
  user: AuthenticatedSessionUser;
}

export type RoomType =
  | 'Standard'
  | 'Deluxe'
  | 'Executive Suite'
  | 'Twin Room'
  | 'Family Suite'
  | 'Presidential Suite'
  | (string & {});
export type OccupancyStatus = 'Available' | 'Occupied' | 'Out of Order';
export type CleaningStatus = 'Clean' | 'Dirty' | 'Inspecting';

export interface Room {
  id: string;
  hotelId: string;
  roomNumber: string;
  floor: number;
  type: RoomType;
  ratePerNight: number;
  occupancyStatus: OccupancyStatus;
  cleaningStatus: CleaningStatus;
  currentBookingId: string | null;
  housekeepingNotes: string;
  lastCleanedAt: string | null;
  lastCleanedBy: string | null;
}

export type PaymentMethod = 'Cash' | 'CBE Transfer' | 'Telebirr' | 'Awash Bank' | 'POS Card Slip';
export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid';
export type BookingStatus = 'Checked In' | 'Checked Out';

export type PaymentSourceType =
  | 'Room Booking'
  | 'Check-In Deposit'
  | 'Table / F&B Order'
  | 'Room Service';
export type PaymentVerificationStatus = 'Pending Cashier' | 'Verified';

export interface ManualPayment {
  id: string;
  hotelId: string;
  bookingId: string;
  orderId?: string | null;
  sourceType?: PaymentSourceType;
  tableOrLocation?: string | null;
  roomNumber: string;
  guestName: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  receivedBy: string;
  receivedById?: string;
  receivedByRole?: UserRole;
  verificationStatus?: PaymentVerificationStatus;
  verifiedBy?: string | null;
  verifiedByRole?: UserRole | null;
  verifiedAt?: string | null;
  notes: string;
  recordedAt: string;
}

export interface Booking {
  id: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  guestPhone: string;
  idNumber: string;
  nationality: string;
  nights: number;
  ratePerNight: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  checkInAt: string;
  checkOutAt: string | null;
  checkedInBy: string;
  notes: string;
}

export type MaintenanceSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type MaintenanceCategory = 'Plumbing' | 'Electrical' | 'HVAC' | 'Furniture' | 'Network & TV' | 'Structural';
export type MaintenanceStatus = 'Open' | 'In Progress' | 'Resolved';

export interface MaintenanceIssue {
  id: string;
  hotelId: string;
  roomId: string | null;
  roomNumber: string;
  locationLabel: string;
  category: MaintenanceCategory;
  severity: MaintenanceSeverity;
  status: MaintenanceStatus;
  title: string;
  description: string;
  blockRoom: boolean;
  reportedBy: string;
  assignedTo: string | null;
  resolutionNotes: string;
  reportedAt: string;
  resolvedAt: string | null;
}

export type ActivityPortal =
  | 'Reception'
  | 'Cashier'
  | 'Payment'
  | 'Housekeeping'
  | 'Maintenance'
  | 'Dispatch'
  | 'F&B'
  | 'Waiter'
  | 'Kitchen'
  | 'Bar'
  | 'Rooms'
  | 'System';

export interface ActivityLog {
  id: string;
  hotelId: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  portal: ActivityPortal;
  action: string;
  amharicAction: string;
  targetRef: string;
  details: string;
  amount?: number;
  paymentMethod?: string;
  orderId?: string | null;
  paymentId?: string | null;
}

export type MessageTargetRole = 'all' | UserRole;
export type MessagePriority = 'Normal' | 'Urgent';
export type MessageCategory = 'Task Dispatch' | 'Status Report' | 'Incident Alert' | 'Supply Request' | 'Manager Notice';

export interface StaffMessage {
  id: string;
  hotelId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientRole: MessageTargetRole;
  category: MessageCategory;
  priority: MessagePriority;
  roomNumber: string;
  subject: string;
  body: string;
  createdAt: string;
  acknowledgedBy: string[];
}

export interface DailyReportSummary {
  hotelId: string;
  date: string;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
  telebirrCollected: number;
  posCardCollected: number;
  outstandingBalance: number;
  occupiedRooms: number;
  totalRooms: number;
  cleanRooms: number;
  dirtyRooms: number;
  outOfOrderRooms: number;
  openMaintenanceCount: number;
  payments: ManualPayment[];
}

export type TaskTargetDepartment = 'housekeeping' | 'maintenance';
export type TaskReportStatus = 'Pending' | 'In Progress' | 'Completed';

export interface TaskReport {
  id: string;
  hotelId: string;
  roomId: string | null;
  roomNumber: string;
  targetDepartment: TaskTargetDepartment;
  priority: MessagePriority;
  title: string;
  notes: string;
  status: TaskReportStatus;
  reportedBy: string;
  reportedByRole: UserRole;
  acceptedBy: string | null;
  completedBy: string | null;
  completionNotes: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ManagerUnifiedSummary {
  hotelId: string;
  receptionReportsToday: number;
  housekeepingPending: number;
  housekeepingInProgress: number;
  housekeepingCompleted: number;
  maintenancePending: number;
  maintenanceInProgress: number;
  maintenanceCompleted: number;
  recentTasks: TaskReport[];
}

export interface CustomerProfile {
  id: string;
  hotelId: string;
  fullName: string;
  phone: string;
  email: string;
  idType: 'National ID' | 'Passport' | 'Driver License' | 'Kebele ID';
  idNumber: string;
  nationality: string;
  cityOrAddress: string;
  company: string;
  preferences: string;
  totalStays: number;
  lastVisitAt: string | null;
  registeredBy: string;
  createdAt: string;
}

export type InquiryCategory =
  | 'Room Inquiry'
  | 'Reservation Request'
  | 'Guest Request'
  | 'Airport Pickup'
  | 'Feedback / Complaint';

export type InquiryStatus = 'Open' | 'Handled';

export interface CustomerInquiry {
  id: string;
  hotelId: string;
  customerId: string | null;
  contactName: string;
  contactPhone: string;
  category: InquiryCategory;
  channel: 'Walk-In' | 'Phone Call' | 'WhatsApp / Telegram' | 'Email';
  subject: string;
  details: string;
  preferredRoomType: RoomType | 'Any';
  status: InquiryStatus;
  receivedBy: string;
  handledBy: string | null;
  responseNotes: string;
  createdAt: string;
  handledAt: string | null;
}

export type FbCategory =
  | 'Breakfast'
  | 'Main Course'
  | 'Snacks & Pastry'
  | 'Hot Drinks'
  | 'Cold Drinks & Juice'
  | 'Bar & Beverages';

export interface FbMenuItem {
  id: string;
  hotelId: string;
  name: string;
  amharicName: string;
  category: FbCategory;
  price: number;
  stockQty: number;
  unit: string;
  isAvailable: boolean;
  updatedAt: string;
}

export type FbServiceChannel = 'Dine-In' | 'Bar Counter' | 'Room Service';
export type FbOrderStatus = 'Pending' | 'Preparing' | 'Served' | 'Cancelled';
export type FbSettlementMode = 'Immediate Payment' | 'Charge to Room' | 'Table Tab';
export type OrderStation = 'kitchen' | 'bar';
export type StationPrepStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served';

export type TableArea = 'Main Dining' | 'Terrace' | 'VIP Lounge' | 'Poolside';
export type DiningTableStatus = 'Available' | 'Seated' | 'Order Active' | 'Needs Bill';

export interface DiningTable {
  id: string;
  hotelId: string;
  tableNumber: string;
  area: TableArea;
  seats: number;
  status: DiningTableStatus;
  assignedWaiterId: string | null;
  assignedWaiterName: string | null;
  guestCount: number;
  activeOrderId: string | null;
  updatedAt: string;
}

export interface FbOrderItem {
  menuItemId: string;
  name: string;
  amharicName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  station?: OrderStation;
  round?: number;
  addedAt?: string;
}

export type OrderBillStatus = 'Open Tab' | 'Bill Requested' | 'Charged to Room' | 'Paid';

export interface FbOrder {
  id: string;
  hotelId: string;
  channel: FbServiceChannel;
  tableId?: string | null;
  tableOrLocation: string;
  roomId: string | null;
  roomNumber: string | null;
  bookingId: string | null;
  guestName: string;
  items: FbOrderItem[];
  totalAmount: number;
  discountAmount?: number;
  roundCount?: number;
  lastOrderedAt?: string | null;
  settlementMode: FbSettlementMode;
  paymentMethod: PaymentMethod | 'Room Folio' | 'Open Tab';
  referenceNumber: string;
  isPaid: boolean;
  billStatus?: OrderBillStatus;
  cashierId?: string | null;
  cashierName?: string | null;
  paymentId?: string | null;
  paidAt?: string | null;
  status: FbOrderStatus;
  kitchenStatus?: StationPrepStatus | 'None';
  barStatus?: StationPrepStatus | 'None';
  kitchenUpdatedAt?: string | null;
  barUpdatedAt?: string | null;
  notes: string;
  takenBy: string;
  createdAt: string;
  servedAt: string | null;
}

export interface CashierSummary {
  hotelId: string;
  date: string;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
  telebirrCollected: number;
  posCardCollected: number;
  openOrdersCount: number;
  openOrdersTotal: number;
  billRequestedCount: number;
  pendingVerificationCount: number;
  pendingVerificationTotal: number;
  outstandingBookingBalance: number;
  openOrders: FbOrder[];
  pendingPayments: ManualPayment[];
  recentCashierLogs: ActivityLog[];
}


