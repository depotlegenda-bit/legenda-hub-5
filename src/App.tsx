import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, AppRole } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { ViewModeProvider } from "@/hooks/useViewMode";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SettingsPage from "./pages/Settings";
import ProfilePage from "./pages/Profile";
import DashboardPage from "./pages/Dashboard";
import StaffManagement from "./pages/StaffManagement";
import NotFound from "./pages/NotFound";

// Personalia
import AttendancePage from "./pages/personalia/Attendance";
import CheckInPage from "./pages/personalia/CheckIn";
import CashbonPage from "./pages/personalia/Cashbon";
import PerformanceReviewPage from "./pages/personalia/PerformanceReview";
import PunishmentPage from "./pages/personalia/Punishment";
import LeaveVerificationPage from "./pages/personalia/LeaveVerification";
import PayrollPage from "./pages/personalia/Payroll";
import RoleManagementPage from "./pages/personalia/RoleManagement";
import ActivityLogPage from "./pages/ActivityLog";

// Finance
import DailyRecapPage from "./pages/finance/DailyRecap";
import ProfitLossPage from "./pages/finance/ProfitLoss";
import InvoicePage from "./pages/finance/Invoice";
import NoteArchivePage from "./pages/finance/NoteArchive";

// Inventory
import InventoryPage from "./pages/Inventory";
import ShoppingListPage from "./pages/inventory/ShoppingList";
import MaterialControlPage from "./pages/inventory/MaterialControl";

// Daily Report (crew)
import FinancialReport from "./pages/FinancialReport";

// Marketing
import ContentPlanPage from "./pages/marketing/ContentPlan";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: AppRole[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Admin selalu boleh akses semua route
  if (role === 'admin') return <>{children}</>;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Memuat...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/profile" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to={user ? "/profile" : "/login"} replace />} />

      {/* Profil */}
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['management']}><DashboardPage /></ProtectedRoute>} />

      {/* Personalia */}
      <Route path="/personalia/staff" element={<ProtectedRoute allowedRoles={['management', 'pic']}><StaffManagement /></ProtectedRoute>} />
      <Route path="/personalia/performance" element={<ProtectedRoute allowedRoles={['management', 'pic']}><PerformanceReviewPage /></ProtectedRoute>} />
      <Route path="/personalia/attendance" element={<ProtectedRoute allowedRoles={['management', 'pic']}><AttendancePage /></ProtectedRoute>} />
      <Route path="/attendance/check-in" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
      <Route path="/personalia/cashbon" element={<ProtectedRoute><CashbonPage /></ProtectedRoute>} />
      <Route path="/personalia/punishment" element={<ProtectedRoute allowedRoles={['management', 'pic']}><PunishmentPage /></ProtectedRoute>} />
      <Route path="/personalia/leave" element={<ProtectedRoute allowedRoles={['management', 'pic']}><LeaveVerificationPage /></ProtectedRoute>} />
      <Route path="/personalia/payroll" element={<ProtectedRoute allowedRoles={['management', 'pic']}><PayrollPage /></ProtectedRoute>} />
      <Route path="/personalia/roles" element={<ProtectedRoute allowedRoles={['admin', 'management']}><RoleManagementPage /></ProtectedRoute>} />
      <Route path="/activity-log" element={<ProtectedRoute allowedRoles={['management']}><ActivityLogPage /></ProtectedRoute>} />

      {/* Finance */}
      <Route path="/finance/daily-recap" element={<ProtectedRoute allowedRoles={['management', 'pic']}><DailyRecapPage /></ProtectedRoute>} />
      <Route path="/finance/profit-loss" element={<ProtectedRoute allowedRoles={['management', 'pic']}><ProfitLossPage /></ProtectedRoute>} />
      <Route path="/finance/invoice" element={<ProtectedRoute allowedRoles={['management', 'pic']}><InvoicePage /></ProtectedRoute>} />
      <Route path="/finance/note-archive" element={<ProtectedRoute allowedRoles={['management', 'pic']}><NoteArchivePage /></ProtectedRoute>} />

      {/* Inventory */}
      <Route path="/inventory/daily-stock" element={<ProtectedRoute allowedRoles={['management', 'pic', 'stockman', 'staff']}><InventoryPage /></ProtectedRoute>} />
      <Route path="/inventory/shopping-list" element={<ProtectedRoute allowedRoles={['management', 'pic', 'stockman']}><ShoppingListPage /></ProtectedRoute>} />
      <Route path="/inventory/material-control" element={<ProtectedRoute allowedRoles={['management', 'pic', 'stockman']}><MaterialControlPage /></ProtectedRoute>} />

      {/* Daily Report */}
      <Route path="/daily-report" element={<ProtectedRoute><FinancialReport /></ProtectedRoute>} />

      {/* Marketing */}
      <Route path="/marketing/content-plan" element={<ProtectedRoute allowedRoles={['management', 'pic']}><ContentPlanPage /></ProtectedRoute>} />

      {/* Settings (admin & management) */}
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'management']}><SettingsPage /></ProtectedRoute>} />

      {/* Legacy redirects */}
      <Route path="/financial-report" element={<Navigate to="/daily-report" replace />} />
      <Route path="/inventory" element={<Navigate to="/inventory/daily-stock" replace />} />
      <Route path="/staff" element={<Navigate to="/personalia/staff" replace />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AppSettingsProvider>
        <ViewModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ViewModeProvider>
      </AppSettingsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
