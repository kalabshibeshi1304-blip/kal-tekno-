import { Router } from 'express';
import { listBarOrders, updateBarOrderStatus } from '../controllers/barController.ts';
import { requestOrderBill } from '../controllers/cashierController.ts';
import { listKitchenOrders, updateKitchenOrderStatus } from '../controllers/kitchenController.ts';
import {
  createTable,
  listTables,
  placeWaiterOrder,
  settleTableOrder,
  updateTableStatus,
} from '../controllers/waiterController.ts';
import { verifyRole } from '../middleware/authMiddleware.ts';
import { resolveTenantHotel } from '../middleware/tenantMiddleware.ts';

const orderRoutes = Router();

orderRoutes.use(resolveTenantHotel);

// Waiter & Dining Tables
orderRoutes.get('/tables', verifyRole(['waiter', 'cashier', 'reception', 'staff', 'kitchen', 'bar']), listTables);
orderRoutes.post('/tables', verifyRole(['manager']), createTable);
orderRoutes.patch('/tables/:id', verifyRole(['waiter', 'cashier', 'reception', 'staff']), updateTableStatus);

// Waiter Tableside Order Dispatch, Bill Request & Bill Settlement
orderRoutes.post('/waiter', verifyRole(['waiter', 'reception', 'staff']), placeWaiterOrder);
orderRoutes.post('/:id/request-bill', verifyRole(['waiter', 'cashier', 'reception', 'staff']), requestOrderBill);
orderRoutes.post('/:id/settle', verifyRole(['waiter', 'cashier', 'reception', 'staff']), settleTableOrder);

// Kitchen Display System (Food Queue)
orderRoutes.get('/kitchen', verifyRole(['kitchen', 'waiter', 'reception', 'staff']), listKitchenOrders);
orderRoutes.patch('/kitchen/:id', verifyRole(['kitchen']), updateKitchenOrderStatus);

// Bar Display System (Drinks & Espresso Queue)
orderRoutes.get('/bar', verifyRole(['bar', 'waiter', 'reception', 'staff']), listBarOrders);
orderRoutes.patch('/bar/:id', verifyRole(['bar']), updateBarOrderStatus);

export default orderRoutes;
