import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sales from './pages/Sales.jsx'
import Inventory from './pages/Inventory.jsx'
import Invoices from './pages/Invoices.jsx'
import Customers from './pages/Customers.jsx'
import Forecasting from './pages/Forecasting.jsx'
import Segmentation from './pages/Segmentation.jsx'
import Churn from './pages/Churn.jsx'
import Recommendations from './pages/Recommendations.jsx'
import Anomalies from './pages/Anomalies.jsx'
import Categories from './pages/Categories.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Datasets from './pages/Datasets.jsx'
import Team from './pages/Team.jsx'
import Settings from './pages/Settings.jsx'
import ForgotPassword from "./pages/ForgotPassword.jsx"

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  const { user } = useAuth()
  const location = useLocation()

  // Routes where Layout header is NOT present
  const isPublicAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Floating Theme Toggle on Login / Register / Forgot Password */}
      {isPublicAuthPage && (
        <div className="fixed top-5 right-6 z-50">
          <ThemeToggle />
        </div>
      )}

      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />

        {/* Protected Dashboard App Routes (All share Layout & Header ThemeToggle) */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/forecasting" element={<Forecasting />} />
          <Route path="/segmentation" element={<Segmentation />} />
          <Route path="/churn" element={<Churn />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Catch-all Wildcard Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}