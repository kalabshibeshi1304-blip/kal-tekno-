import { Router } from 'express';
import {
  listHousekeepingTasks,
  updateHousekeepingTask,
} from '../controllers/housekeepingController.ts';
import {
  getManagerUnifiedOverview,
  listMaintenanceTasks,
  updateMaintenanceTask,
} from '../controllers/managerController.ts';
import {
  createReceptionTaskReport,
  listReceptionSentReports,
} from '../controllers/receptionController.ts';
import { verifyRole } from '../middleware/authMiddleware.ts';

const taskRoutes = Router();

// Reception: send task reports to Housekeeping or Maintenance
taskRoutes.get('/reception', verifyRole(['reception']), listReceptionSentReports);
taskRoutes.post('/reception', verifyRole(['reception']), createReceptionTaskReport);

// Housekeeping: receive reports and mark Completed ("አጠናቅቄያለሁ")
taskRoutes.get('/housekeeping', verifyRole(['housekeeping']), listHousekeepingTasks);
taskRoutes.patch('/housekeeping/:id', verifyRole(['housekeeping']), updateHousekeepingTask);

// Maintenance: receive repair tasks and mark Completed ("ተጠናቋል")
taskRoutes.get('/maintenance', verifyRole(['maintenance']), listMaintenanceTasks);
taskRoutes.patch('/maintenance/:id', verifyRole(['maintenance']), updateMaintenanceTask);

// Manager: unified monitoring across Reception, Housekeeping, and Maintenance
taskRoutes.get('/manager/overview', verifyRole(['manager']), getManagerUnifiedOverview);

export default taskRoutes;
