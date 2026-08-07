import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
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

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />

      {/* Protected Dashboard App Routes */}
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
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Catch-all Wildcard Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}