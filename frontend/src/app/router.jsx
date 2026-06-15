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
import SettingsPage from '../features/settings/SettingsPage'
import ExportPage from '../features/export/ExportPage'
import ClientsPage from '../features/clients/ClientsPage'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
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
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<NewExpensePage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<NewInvoicePage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="export" element={<ExportPage />} />
      </Route>
    </Routes>
  )
}
