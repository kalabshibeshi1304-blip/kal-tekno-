import { Router } from 'express';
import { getCurrentSession, loginWithPin } from '../controllers/authController.ts';
import {
  checkInGuest,
  checkOutGuest,
  listBookings,
  listPayments,
  recordManualPayment,
} from '../controllers/bookingController.ts';
import {
  createInquiry,
  listCustomers,
  listInquiries,
  registerCustomer,
  updateCustomer,
  updateInquiryStatus,
} from '../controllers/customerController.ts';
import {
  createFbMenuItem,
  createFbOrder,
  deleteFbMenuItem,
  listFbMenu,
  listFbOrders,
  updateFbMenuItem,
  updateFbOrderStatus,
} from '../controllers/fbController.ts';
import {
  addHotelRoom,
  broadcastCentralMessage,
  createHotel,
  listHotels,
  updateHotel,
  updateRoomRateOrTier,
} from '../controllers/hotelController.ts';
import {
  createMaintenanceIssue,
  listMaintenance,
  updateMaintenanceIssue,
} from '../controllers/maintenanceController.ts';
import { acknowledgeMessage, listMessages, sendMessage } from '../controllers/messageController.ts';
import {
  bulkCreateRooms,
  deleteRoom,
  listRooms,
  updateHousekeepingStatus,
  updateRoomDetails,
  updateRoomOccupancyOverride,
  updateRoomTypeRates,
} from '../controllers/roomController.ts';
import { generateSpeechAudio } from '../controllers/ttsController.ts';
import { getDailyReport, listAuditLogs, listUsers } from '../controllers/userController.ts';
import { verifyRole } from '../middleware/authMiddleware.ts';
import { resolveTenantHotel } from '../middleware/tenantMiddleware.ts';
import cashierRoutes from './cashierRoutes.ts';
import orderRoutes from './orderRoutes.ts';
import taskRoutes from './taskRoutes.ts';

const apiRouter = Router();

// Authentication & Session
apiRouter.post('/auth/login', loginWithPin);
apiRouter.get(
  '/auth/me',
  verifyRole(['reception', 'cashier', 'housekeeping', 'maintenance', 'manager', 'waiter', 'kitchen', 'bar', 'staff'], {
    requireSameHotel: false,
  }),
  getCurrentSession
);

// Public login directory helpers (hotels list & safe staff names without PINs)
apiRouter.get('/hotels', listHotels);
apiRouter.get('/users', listUsers);

// Department Task & Report Pipeline (Reception -> Housekeeping / Maintenance -> Manager)
apiRouter.use('/tasks', taskRoutes);

// Waiter, Tables, Kitchen & Bar Order Dispatch Pipeline
apiRouter.use('/orders', orderRoutes);

// Cashier Settlement, Verification & Billing Pipeline
apiRouter.use('/cashier', cashierRoutes);

// Central Multi-Hotel Registry & Operations (Central Admin / HQ Manager only)
apiRouter.post('/hotels', verifyRole(['manager'], { centralAdminOnly: true }), createHotel);
apiRouter.post(
  '/hotels/broadcast',
  verifyRole(['manager'], { centralAdminOnly: true }),
  broadcastCentralMessage
);
apiRouter.patch('/hotels/:id', verifyRole(['manager'], { centralAdminOnly: true }), updateHotel);
apiRouter.post('/hotels/:id/rooms', verifyRole(['manager'], { centralAdminOnly: true }), addHotelRoom);
apiRouter.patch(
  '/hotels/:id/rooms/:roomId',
  verifyRole(['manager'], { centralAdminOnly: true }),
  updateRoomRateOrTier
);

// Staff Messaging & Quick Reporting (All authenticated hotel staff)
apiRouter.get(
  '/messages',
  verifyRole(['reception', 'cashier', 'housekeeping', 'maintenance', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  listMessages
);
apiRouter.post(
  '/messages',
  verifyRole(['reception', 'cashier', 'housekeeping', 'maintenance', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  sendMessage
);
apiRouter.post(
  '/messages/:id/ack',
  verifyRole(['reception', 'cashier', 'housekeeping', 'maintenance', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  acknowledgeMessage
);

// Per-Hotel Rooms, Types, Pricing & Housekeeping
apiRouter.get(
  '/rooms',
  verifyRole(['reception', 'cashier', 'housekeeping', 'maintenance', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  listRooms
);
apiRouter.post('/rooms/bulk', verifyRole(['manager']), bulkCreateRooms);
apiRouter.patch('/rooms/tier-rate', verifyRole(['manager']), updateRoomTypeRates);
apiRouter.patch('/rooms/:id', verifyRole(['manager']), updateRoomDetails);
apiRouter.delete('/rooms/:id', verifyRole(['manager']), deleteRoom);
apiRouter.patch(
  '/rooms/:id/housekeeping',
  verifyRole(['housekeeping', 'reception']),
  updateHousekeepingStatus
);
apiRouter.patch(
  '/rooms/:id/occupancy',
  verifyRole(['maintenance', 'reception']),
  updateRoomOccupancyOverride
);

// Per-Hotel Food & Beverage Management (Menu, Stock & Orders)
apiRouter.get(
  '/fb/menu',
  verifyRole(['reception', 'cashier', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  listFbMenu
);
apiRouter.post('/fb/menu', verifyRole(['manager']), resolveTenantHotel, createFbMenuItem);
apiRouter.patch('/fb/menu/:id', verifyRole(['manager', 'staff', 'kitchen', 'bar']), resolveTenantHotel, updateFbMenuItem);
apiRouter.delete('/fb/menu/:id', verifyRole(['manager']), resolveTenantHotel, deleteFbMenuItem);
apiRouter.get(
  '/fb/orders',
  verifyRole(['reception', 'cashier', 'waiter', 'kitchen', 'bar', 'staff']),
  resolveTenantHotel,
  listFbOrders
);
apiRouter.post('/fb/orders', verifyRole(['reception', 'cashier', 'waiter', 'staff']), resolveTenantHotel, createFbOrder);
apiRouter.patch('/fb/orders/:id', verifyRole(['reception', 'cashier', 'waiter', 'staff']), resolveTenantHotel, updateFbOrderStatus);

// Reception, Customers & Manual Payments
apiRouter.get('/customers', verifyRole(['reception', 'cashier']), listCustomers);
apiRouter.post('/customers', verifyRole(['reception']), registerCustomer);
apiRouter.patch('/customers/:id', verifyRole(['reception']), updateCustomer);
apiRouter.get('/inquiries', verifyRole(['reception']), listInquiries);
apiRouter.post('/inquiries', verifyRole(['reception']), createInquiry);
apiRouter.patch('/inquiries/:id', verifyRole(['reception']), updateInquiryStatus);

apiRouter.get('/bookings', verifyRole(['reception', 'cashier', 'waiter']), listBookings);
apiRouter.post('/bookings/check-in', verifyRole(['reception']), checkInGuest);
apiRouter.post('/bookings/:id/check-out', verifyRole(['reception']), checkOutGuest);
apiRouter.get('/payments', verifyRole(['reception', 'cashier']), listPayments);
apiRouter.post('/payments/manual', verifyRole(['reception', 'cashier']), recordManualPayment);

// Maintenance
apiRouter.get(
  '/maintenance',
  verifyRole(['reception', 'housekeeping', 'maintenance', 'staff']),
  listMaintenance
);
apiRouter.post(
  '/maintenance',
  verifyRole(['reception', 'housekeeping', 'maintenance', 'staff']),
  createMaintenanceIssue
);
apiRouter.patch('/maintenance/:id', verifyRole(['maintenance']), updateMaintenanceIssue);

// Manager Reports & Audit Logs (Strictly Manager)
apiRouter.get('/audit-logs', verifyRole(['manager']), listAuditLogs);
apiRouter.get('/reports/daily', verifyRole(['manager']), getDailyReport);

// Bilingual Amharic & English Speech Synthesis (Gemini TTS)
apiRouter.post('/tts/speak', generateSpeechAudio);

export default apiRouter;
