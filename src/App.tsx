import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import VendorsPage from "./pages/VendorsPage";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import DeliveryPage from "./pages/DeliveryPage";
import PaymentsPage from "./pages/PaymentsPage";
import NotificationsPage from "./pages/NotificationsPage";
import DisputesPage from "./pages/DisputesPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><AdminLayout><DashboardPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AdminLayout><UsersPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><AdminLayout><VendorsPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><AdminLayout><ProductsPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><AdminLayout><OrdersPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><AdminLayout><OrderDetailPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><AdminLayout><DeliveryPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><AdminLayout><PaymentsPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><AdminLayout><NotificationsPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/disputes" element={<ProtectedRoute><AdminLayout><DisputesPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><AdminLayout><SettingsPage /></AdminLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
