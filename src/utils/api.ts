import type {
  ActivityLog,
  AuthLoginResponse,
  AuthenticatedSessionUser,
  Booking,
  CashierSummary,
  CleaningStatus,
  CustomerInquiry,
  CustomerProfile,
  DailyReportSummary,
  DiningTable,
  DiningTableStatus,
  FbCategory,
  FbMenuItem,
  FbOrder,
  FbOrderItem,
  FbOrderStatus,
  FbServiceChannel,
  FbSettlementMode,
  HotelCategory,
  HotelOperationalStatus,
  HotelOverviewStat,
  HotelProperty,
  InquiryCategory,
  InquiryStatus,
  MaintenanceCategory,
  MaintenanceIssue,
  MaintenanceSeverity,
  MaintenanceStatus,
  ManagerUnifiedSummary,
  ManualPayment,
  MessageCategory,
  MessagePriority,
  MessageTargetRole,
  OccupancyStatus,
  PaymentMethod,
  Room,
  RoomType,
  StaffMessage,
  StaffUser,
  StationPrepStatus,
  TableArea,
  TaskReport,
  TaskReportStatus,
  TaskTargetDepartment,
  UserRole,
} from '../types/hotel';

export interface RoomWithBooking extends Room {
  activeBooking: Booking | null;
}

export interface StationOrderTicket extends FbOrder {
  stationItems: FbOrderItem[];
}

const TOKEN_STORAGE_KEY = 'tekno_auth_token';

export function getApiAuthToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function setApiAuthToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function requestJson<T>(url: string, hotelId?: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (hotelId) {
    headers['x-hotel-id'] = hotelId;
  }
  const token = getApiAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const hotelApi = {
  // Authentication & Session
  loginWithPin: (payload: { hotelId: string; userId?: string; pinCode: string }) =>
    requestJson<AuthLoginResponse>('/api/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSession: () => requestJson<{ user: AuthenticatedSessionUser }>('/api/auth/me'),

  // Central Multi-Hotel Endpoints
  getHotels: () => requestJson<HotelOverviewStat[]>('/api/hotels'),
  createHotel: (payload: {
    name: string;
    amharicName: string;
    city: string;
    amharicCity: string;
    code: string;
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
    standardCount: number;
    standardRate: number;
    deluxeCount: number;
    deluxeRate: number;
    suiteCount: number;
    suiteRate: number;
  }) =>
    requestJson<{ hotel: HotelProperty; roomsCreated: number; staffCreated: number }>(
      '/api/hotels',
      undefined,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  updateHotel: (
    hotelId: string,
    payload: Partial<HotelProperty> & { tierRates?: Partial<Record<RoomType, number>> }
  ) =>
    requestJson<{ hotel: HotelProperty; roomsUpdated: number }>(`/api/hotels/${hotelId}`, undefined, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  addHotelRoom: (
    hotelId: string,
    payload: { roomNumber: string; floor: number; type: RoomType; ratePerNight: number }
  ) =>
    requestJson<Room>(`/api/hotels/${hotelId}/rooms`, undefined, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoomRateOrTier: (
    hotelId: string,
    roomId: string,
    payload: { type?: RoomType; ratePerNight?: number }
  ) =>
    requestJson<Room>(`/api/hotels/${hotelId}/rooms/${roomId}`, undefined, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  broadcastCentralMessage: (payload: {
    targetHotelId: string;
    recipientRole: MessageTargetRole;
    priority: MessagePriority;
    subject: string;
    body: string;
  }) =>
    requestJson<{ deliveredCount: number; messages: StaffMessage[] }>('/api/hotels/broadcast', undefined, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Staff Messaging & Quick Reporting
  getMessages: (hotelId: string, role?: UserRole) =>
    requestJson<StaffMessage[]>(`/api/messages${role ? `?role=${role}` : ''}`, hotelId),
  sendMessage: (
    hotelId: string,
    payload: {
      staffId: string;
      recipientRole: MessageTargetRole;
      category: MessageCategory;
      priority: MessagePriority;
      roomNumber: string;
      subject: string;
      body: string;
    }
  ) =>
    requestJson<StaffMessage>('/api/messages', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acknowledgeMessage: (hotelId: string, messageId: string, staffId: string) =>
    requestJson<StaffMessage>(`/api/messages/${messageId}/ack`, hotelId, {
      method: 'POST',
      body: JSON.stringify({ staffId }),
    }),

  // Tenant-Scoped Hotel Operations
  getUsers: (hotelId: string) => requestJson<StaffUser[]>('/api/users', hotelId),
  getRooms: (hotelId: string) => requestJson<RoomWithBooking[]>('/api/rooms', hotelId),
  getBookings: (hotelId: string) => requestJson<Booking[]>('/api/bookings', hotelId),
  getPayments: (hotelId: string) => requestJson<ManualPayment[]>('/api/payments', hotelId),
  getMaintenance: (hotelId: string) => requestJson<MaintenanceIssue[]>('/api/maintenance', hotelId),
  getAuditLogs: (hotelId: string, portal?: string, staffId?: string) => {
    const params = new URLSearchParams();
    if (portal && portal !== 'All') params.set('portal', portal);
    if (staffId && staffId !== 'All') params.set('staffId', staffId);
    const qs = params.toString();
    return requestJson<ActivityLog[]>(`/api/audit-logs${qs ? `?${qs}` : ''}`, hotelId);
  },
  getDailyReport: (hotelId: string) => requestJson<DailyReportSummary>('/api/reports/daily', hotelId),

  checkIn: (
    hotelId: string,
    payload: {
      roomId: string;
      guestName: string;
      guestPhone: string;
      idNumber: string;
      nationality: string;
      nights: number;
      initialPaymentAmount: number;
      paymentMethod: PaymentMethod;
      referenceNumber: string;
      notes: string;
      staffId: string;
    }
  ) =>
    requestJson<{ booking: Booking; payment: ManualPayment | null; room: Room }>(
      '/api/bookings/check-in',
      hotelId,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  checkOut: (hotelId: string, bookingId: string, payload: { staffId: string; forceCheckout?: boolean }) =>
    requestJson<{ booking: Booking; room: Room | null }>(
      `/api/bookings/${bookingId}/check-out`,
      hotelId,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  recordManualPayment: (
    hotelId: string,
    payload: {
      bookingId: string;
      amount: number;
      method: PaymentMethod;
      referenceNumber: string;
      notes: string;
      staffId: string;
    }
  ) =>
    requestJson<{ payment: ManualPayment; booking: Booking }>('/api/payments/manual', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateHousekeeping: (
    hotelId: string,
    roomId: string,
    payload: { cleaningStatus: CleaningStatus; housekeepingNotes: string; staffId: string }
  ) =>
    requestJson<Room>(`/api/rooms/${roomId}/housekeeping`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  overrideOccupancy: (
    hotelId: string,
    roomId: string,
    payload: { occupancyStatus: OccupancyStatus; staffId: string; reason: string }
  ) =>
    requestJson<Room>(`/api/rooms/${roomId}/occupancy`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createMaintenance: (
    hotelId: string,
    payload: {
      roomId: string | null;
      locationLabel: string;
      category: MaintenanceCategory;
      severity: MaintenanceSeverity;
      title: string;
      description: string;
      blockRoom: boolean;
      staffId: string;
    }
  ) =>
    requestJson<MaintenanceIssue>('/api/maintenance', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMaintenance: (
    hotelId: string,
    issueId: string,
    payload: { status: MaintenanceStatus; resolutionNotes: string; restoreRoom: boolean; staffId: string }
  ) =>
    requestJson<MaintenanceIssue>(`/api/maintenance/${issueId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Department Task & Report Pipeline (Reception -> Housekeeping / Maintenance -> Manager)
  getReceptionTasks: (hotelId: string) => requestJson<TaskReport[]>('/api/tasks/reception', hotelId),
  sendReceptionTask: (
    hotelId: string,
    payload: {
      roomId: string | null;
      targetDepartment: TaskTargetDepartment;
      priority: MessagePriority;
      title: string;
      notes: string;
      staffId: string;
    }
  ) =>
    requestJson<TaskReport>('/api/tasks/reception', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getHousekeepingTasks: (hotelId: string) => requestJson<TaskReport[]>('/api/tasks/housekeeping', hotelId),
  updateHousekeepingTask: (
    hotelId: string,
    taskId: string,
    payload: { status: TaskReportStatus; completionNotes: string; staffId: string }
  ) =>
    requestJson<TaskReport>(`/api/tasks/housekeeping/${taskId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getMaintenanceTasks: (hotelId: string) => requestJson<TaskReport[]>('/api/tasks/maintenance', hotelId),
  updateMaintenanceTask: (
    hotelId: string,
    taskId: string,
    payload: { status: TaskReportStatus; completionNotes: string; staffId: string }
  ) =>
    requestJson<TaskReport>(`/api/tasks/maintenance/${taskId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getManagerUnifiedOverview: (hotelId: string) =>
    requestJson<ManagerUnifiedSummary>('/api/tasks/manager/overview', hotelId),

  // Per-Hotel Reception Customer Registry & Information Receiving Desk
  getCustomers: (hotelId: string, query?: string) => {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return requestJson<CustomerProfile[]>(`/api/customers${qs}`, hotelId);
  },
  registerCustomer: (
    hotelId: string,
    payload: {
      fullName: string;
      phone: string;
      email: string;
      idType: CustomerProfile['idType'];
      idNumber: string;
      nationality: string;
      cityOrAddress: string;
      company: string;
      preferences: string;
      staffId: string;
    }
  ) =>
    requestJson<CustomerProfile>('/api/customers', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomer: (
    hotelId: string,
    customerId: string,
    payload: Partial<CustomerProfile> & { staffId: string }
  ) =>
    requestJson<CustomerProfile>(`/api/customers/${customerId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getInquiries: (hotelId: string) => requestJson<CustomerInquiry[]>('/api/inquiries', hotelId),
  createInquiry: (
    hotelId: string,
    payload: {
      customerId?: string | null;
      contactName: string;
      contactPhone: string;
      category: InquiryCategory;
      channel: CustomerInquiry['channel'];
      subject: string;
      details: string;
      preferredRoomType: RoomType | 'Any';
      staffId: string;
    }
  ) =>
    requestJson<CustomerInquiry>('/api/inquiries', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateInquiryStatus: (
    hotelId: string,
    inquiryId: string,
    payload: { status: InquiryStatus; responseNotes: string; staffId: string }
  ) =>
    requestJson<CustomerInquiry>(`/api/inquiries/${inquiryId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Per-Hotel Room Count, Types & Pricing Management
  bulkCreateRooms: (
    hotelId: string,
    payload: {
      type: RoomType;
      floor: number;
      startNumber: number;
      count: number;
      ratePerNight: number;
      staffId: string;
    }
  ) =>
    requestJson<{ createdRooms: Room[]; count: number }>('/api/rooms/bulk', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoomTypeRates: (
    hotelId: string,
    payload: { type: RoomType; ratePerNight: number; staffId: string }
  ) =>
    requestJson<{ type: RoomType; ratePerNight: number; updatedCount: number }>(
      '/api/rooms/tier-rate',
      hotelId,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),
  updateRoomDetails: (
    hotelId: string,
    roomId: string,
    payload: { roomNumber?: string; floor?: number; type?: RoomType; ratePerNight?: number; staffId: string }
  ) =>
    requestJson<Room>(`/api/rooms/${roomId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRoom: (hotelId: string, roomId: string) =>
    requestJson<{ deleted: string; roomNumber: string }>(`/api/rooms/${roomId}`, hotelId, {
      method: 'DELETE',
    }),

  // Per-Hotel Food & Beverage (Menu, Stock & Orders)
  getFbMenu: (hotelId: string) => requestJson<FbMenuItem[]>('/api/fb/menu', hotelId),
  createFbMenuItem: (
    hotelId: string,
    payload: {
      name: string;
      amharicName: string;
      category: FbCategory;
      price: number;
      stockQty: number;
      unit: string;
      staffId: string;
    }
  ) =>
    requestJson<FbMenuItem>('/api/fb/menu', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFbMenuItem: (
    hotelId: string,
    itemId: string,
    payload: Partial<FbMenuItem> & { staffId: string }
  ) =>
    requestJson<FbMenuItem>(`/api/fb/menu/${itemId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFbMenuItem: (hotelId: string, itemId: string) =>
    requestJson<{ deleted: string }>(`/api/fb/menu/${itemId}`, hotelId, {
      method: 'DELETE',
    }),
  getFbOrders: (hotelId: string) => requestJson<FbOrder[]>('/api/fb/orders', hotelId),
  createFbOrder: (
    hotelId: string,
    payload: {
      channel: FbServiceChannel;
      tableOrLocation: string;
      bookingId: string | null;
      guestName: string;
      items: { menuItemId: string; quantity: number }[];
      settlementMode: FbSettlementMode;
      paymentMethod: PaymentMethod;
      referenceNumber: string;
      notes: string;
      staffId: string;
    }
  ) =>
    requestJson<FbOrder>('/api/fb/orders', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFbOrderStatus: (
    hotelId: string,
    orderId: string,
    payload: { status: FbOrderStatus; staffId: string }
  ) =>
    requestJson<FbOrder>(`/api/fb/orders/${orderId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Waiter Tableside, Kitchen Display & Bar Display Pipeline
  getTables: (hotelId: string) => requestJson<DiningTable[]>('/api/orders/tables', hotelId),
  createTable: (
    hotelId: string,
    payload: { tableNumber: string; area: TableArea; seats: number; staffId: string }
  ) =>
    requestJson<DiningTable>('/api/orders/tables', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTableStatus: (
    hotelId: string,
    tableId: string,
    payload: { status: DiningTableStatus; guestCount?: number; staffId: string }
  ) =>
    requestJson<DiningTable>(`/api/orders/tables/${tableId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  placeWaiterOrder: (
    hotelId: string,
    payload: {
      channel: FbServiceChannel;
      tableId?: string | null;
      tableOrLocation: string;
      bookingId?: string | null;
      guestName?: string;
      guestCount?: number;
      items: { menuItemId: string; quantity: number }[];
      settlementMode: FbSettlementMode;
      paymentMethod?: PaymentMethod;
      referenceNumber?: string;
      notes?: string;
      staffId: string;
    }
  ) =>
    requestJson<FbOrder>('/api/orders/waiter', hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  settleTableOrder: (
    hotelId: string,
    orderId: string,
    payload: {
      paymentMethod: PaymentMethod;
      referenceNumber?: string;
      freeTable?: boolean;
      staffId: string;
    }
  ) =>
    requestJson<FbOrder>(`/api/orders/${orderId}/settle`, hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getKitchenOrders: (hotelId: string) =>
    requestJson<StationOrderTicket[]>('/api/orders/kitchen', hotelId),
  updateKitchenOrderStatus: (
    hotelId: string,
    orderId: string,
    payload: { kitchenStatus: StationPrepStatus; staffId: string }
  ) =>
    requestJson<FbOrder>(`/api/orders/kitchen/${orderId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getBarOrders: (hotelId: string) => requestJson<StationOrderTicket[]>('/api/orders/bar', hotelId),
  updateBarOrderStatus: (
    hotelId: string,
    orderId: string,
    payload: { barStatus: StationPrepStatus; staffId: string }
  ) =>
    requestJson<FbOrder>(`/api/orders/bar/${orderId}`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Cashier Portal Endpoints
  getCashierSummary: (hotelId: string) =>
    requestJson<CashierSummary>('/api/cashier/summary', hotelId),
  requestOrderBill: (hotelId: string, orderId: string, payload: { staffId: string }) =>
    requestJson<FbOrder>(`/api/orders/${orderId}/request-bill`, hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  settleOrderAsCashier: (
    hotelId: string,
    orderId: string,
    payload: {
      paymentMethod: PaymentMethod;
      referenceNumber?: string;
      discountAmount?: number;
      freeTable?: boolean;
      notes?: string;
      staffId: string;
    }
  ) =>
    requestJson<{ order: FbOrder; payment: ManualPayment }>(`/api/cashier/orders/${orderId}/settle`, hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyManualPayment: (
    hotelId: string,
    paymentId: string,
    payload: { notes?: string; staffId: string }
  ) =>
    requestJson<ManualPayment>(`/api/cashier/payments/${paymentId}/verify`, hotelId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  recordCashierBookingPayment: (
    hotelId: string,
    bookingId: string,
    payload: {
      amount: number;
      method: PaymentMethod;
      referenceNumber: string;
      notes?: string;
      staffId: string;
    }
  ) =>
    requestJson<{ payment: ManualPayment; booking: Booking }>(`/api/cashier/bookings/${bookingId}/pay`, hotelId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
