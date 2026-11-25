import { Router } from 'express';
import {
  getCashierSummary,
  recordCashierBookingPayment,
  requestOrderBill,
  settleOrderAsCashier,
  verifyManualPayment,
} from '../controllers/cashierController.ts';
import { verifyRole } from '../middleware/authMiddleware.ts';
import { resolveTenantHotel } from '../middleware/tenantMiddleware.ts';

const cashierRoutes = Router();

cashierRoutes.use(resolveTenantHotel);

cashierRoutes.get('/summary', verifyRole(['cashier', 'reception']), getCashierSummary);
cashierRoutes.post('/orders/:id/request-bill', verifyRole(['cashier', 'waiter', 'reception', 'staff']), requestOrderBill);
cashierRoutes.post('/orders/:id/settle', verifyRole(['cashier', 'reception']), settleOrderAsCashier);
cashierRoutes.patch('/payments/:id/verify', verifyRole(['cashier']), verifyManualPayment);
cashierRoutes.post('/bookings/:id/pay', verifyRole(['cashier', 'reception']), recordCashierBookingPayment);

export default cashierRoutes;
