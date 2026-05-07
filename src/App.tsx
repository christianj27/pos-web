import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout/AppLayout';
import { LoginPage } from './pages/Login/LoginPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { UsersPage } from './pages/Users/UsersPage';
import { LocationsPage } from './pages/Locations/LocationsPage';
import { ProductsPage } from './pages/Products/ProductsPage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { StockPage } from './pages/Stock/StockPage';
import { TransactionsPage } from './pages/Transactions/TransactionsPage';
import { DebtPaymentsPage } from './pages/DebtPayments/DebtPaymentsPage';
import { Spinner } from './components/common';
import type { UserRole } from './types';

function RequireAuth({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoot() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'owner') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/transactions" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/" element={<AppRoot />} />

            <Route path="/dashboard" element={
              <RequireAuth allowedRoles={['owner']}><DashboardPage /></RequireAuth>
            } />

            <Route path="/users" element={
              <RequireAuth allowedRoles={['owner']}><UsersPage /></RequireAuth>
            } />

            <Route path="/locations" element={
              <RequireAuth allowedRoles={['owner']}><LocationsPage /></RequireAuth>
            } />

            <Route path="/products" element={
              <RequireAuth allowedRoles={['owner']}><ProductsPage /></RequireAuth>
            } />

            <Route path="/customers" element={
              <RequireAuth><CustomersPage /></RequireAuth>
            } />

            <Route path="/stock" element={
              <RequireAuth allowedRoles={['owner', 'kurir']}><StockPage /></RequireAuth>
            } />

            <Route path="/transactions" element={
              <RequireAuth><TransactionsPage /></RequireAuth>
            } />

            <Route path="/debt-payments" element={
              <RequireAuth allowedRoles={['owner', 'kasir']}><DebtPaymentsPage /></RequireAuth>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


