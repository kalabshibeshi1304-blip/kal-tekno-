import { LayoutShell } from './components/LayoutShell';
import { useHotel, VoiceProvider } from './context/VoiceContext';
import { CentralHotelsPage } from './pages/admin/CentralHotelsPage';
import { LoginScreen } from './pages/auth/LoginScreen';
import { BarDisplayPage } from './pages/bar/BarDisplayPage';
import { CashierPortalPage } from './pages/cashier/CashierPortalPage';
import { DashboardPage } from './pages/DashboardPage';
import { FoodBeveragePage } from './pages/fb/FoodBeveragePage';
import { HousekeepingPage } from './pages/housekeeping/HousekeepingPage';
import { KitchenDisplayPage } from './pages/kitchen/KitchenDisplayPage';
import { MaintenancePage } from './pages/maintenance/MaintenancePage';
import { AuditLogsPage } from './pages/manager/AuditLogsPage';
import { ManagerMonitorPage } from './pages/manager/ManagerMonitorPage';
import { ReportsPage } from './pages/manager/ReportsPage';
import { DispatchHubPage } from './pages/messages/DispatchHubPage';
import { PortalCoverPage } from './pages/PortalCoverPage';
import { CheckInPage } from './pages/reception/CheckInPage';
import { CustomerPortalPage } from './pages/reception/CustomerPortalPage';
import { ManualPaymentPage } from './pages/reception/ManualPaymentPage';
import { ReceptionDeskShell } from './pages/reception/ReceptionDeskShell';
import { RoomSetupPage } from './pages/rooms/RoomSetupPage';
import { StaffMiniPortal } from './pages/staff/StaffMiniPortal';
import { WaiterPortalPage } from './pages/waiter/WaiterPortalPage';

function PortalRouter() {
  const { activePortal, workspaceMode, authUser, authLoading } = useHotel();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading session...
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  if (workspaceMode === 'staff-terminal') {
    return <StaffMiniPortal />;
  }

  if (workspaceMode === 'reception-desk') {
    return <ReceptionDeskShell />;
  }

  let content = <PortalCoverPage />;
  switch (activePortal) {
    case 'central':
      content = <CentralHotelsPage />;
      break;
    case 'overview':
      content = <DashboardPage />;
      break;
    case 'dispatch':
      content = <DispatchHubPage />;
      break;
    case 'customers':
      content = <CustomerPortalPage />;
      break;
    case 'reception':
      content = <CheckInPage />;
      break;
    case 'payments':
      content = <ManualPaymentPage />;
      break;
    case 'cashier':
      content = <CashierPortalPage />;
      break;
    case 'waiter':
      content = <WaiterPortalPage />;
      break;
    case 'kitchen':
      content = <KitchenDisplayPage />;
      break;
    case 'bar':
      content = <BarDisplayPage />;
      break;
    case 'fb':
      content = <FoodBeveragePage />;
      break;
    case 'room-setup':
      content = <RoomSetupPage />;
      break;
    case 'housekeeping':
      content = <HousekeepingPage />;
      break;
    case 'maintenance':
      content = <MaintenancePage />;
      break;
    case 'manager':
      content = <ManagerMonitorPage />;
      break;
    case 'reports':
      content = <ReportsPage />;
      break;
    case 'audit':
      content = <AuditLogsPage />;
      break;
    case 'cover':
    default:
      content = <PortalCoverPage />;
      break;
  }

  return <LayoutShell>{content}</LayoutShell>;
}

export default function App() {
  return (
    <VoiceProvider>
      <PortalRouter />
    </VoiceProvider>
  );
}
