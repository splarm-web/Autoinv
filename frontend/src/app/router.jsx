import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import AppShell from '../components/AppShell'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import ExpensesPage from '../features/expenses/ExpensesPage'
import NewExpensePage from '../features/expenses/NewExpensePage'
import InvoicesPage from '../features/invoices/InvoicesPage'
import NewInvoicePage from '../features/invoices/NewInvoicePage'
import TransporteInvoicePage from '../features/invoices/TransporteInvoicePage'
import SettingsPage from '../features/settings/SettingsPage'
import ClientsPage from '../features/clients/ClientsPage'
import AdminPage from '../features/admin/AdminPage'
import AutomationPage from '../features/automation/AutomationPage'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// Exige una feature concreta; si no, redirige al dashboard.
function FeatureRoute({ feature, children }) {
  const { hasFeature } = useAuth()
  return hasFeature(feature) ? children : <Navigate to="/dashboard" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<PublicRoute><LoginPage /></PublicRoute>}
      />
      <Route
        path="/register"
        element={<PublicRoute><RegisterPage /></PublicRoute>}
      />
      <Route
        path="/"
        element={<PrivateRoute><AppShell /></PrivateRoute>}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="expenses" element={<FeatureRoute feature="gastos"><ExpensesPage /></FeatureRoute>} />
        <Route path="expenses/new" element={<FeatureRoute feature="gastos"><NewExpensePage /></FeatureRoute>} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<FeatureRoute feature="facturas"><NewInvoicePage /></FeatureRoute>} />
        <Route path="invoices/transporte" element={<FeatureRoute feature="transporte"><TransporteInvoicePage /></FeatureRoute>} />
        <Route path="clients" element={<FeatureRoute feature="clientes"><ClientsPage /></FeatureRoute>} />
        <Route path="automation" element={<FeatureRoute feature="automatizacion"><AutomationPage /></FeatureRoute>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<FeatureRoute feature="admin"><AdminPage /></FeatureRoute>} />
      </Route>
    </Routes>
  )
}
