import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './context/AuthContext.jsx'
import './i18n'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import OnboardingWizard from './components/OnboardingWizard.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Layout from './components/Layout.jsx'

// Lazy-load all page components for code-splitting (smaller initial bundle)
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Sales = lazy(() => import('./pages/Sales.jsx'))
const Inventory = lazy(() => import('./pages/Inventory.jsx'))
const Invoices = lazy(() => import('./pages/Invoices.jsx'))
const Customers = lazy(() => import('./pages/Customers.jsx'))
const Forecasting = lazy(() => import('./pages/Forecasting.jsx'))
const Segmentation = lazy(() => import('./pages/Segmentation.jsx'))
const Churn = lazy(() => import('./pages/Churn.jsx'))
const Recommendations = lazy(() => import('./pages/Recommendations.jsx'))
const Anomalies = lazy(() => import('./pages/Anomalies.jsx'))
const Categories = lazy(() => import('./pages/Categories.jsx'))
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'))
const Datasets = lazy(() => import('./pages/Datasets.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const ActivityLog = lazy(() => import('./pages/ActivityLog.jsx'))
const AuditTrail = lazy(() => import('./pages/AuditTrail.jsx'))
const FunnelAnalysis = lazy(() => import('./pages/FunnelAnalysis.jsx'))
const ReportTemplates = lazy(() => import('./pages/ReportTemplates.jsx'))
const ScheduledReports = lazy(() => import('./pages/ScheduledReports.jsx'))
const DashboardBuilder = lazy(() => import('./pages/DashboardBuilder.jsx'))
const Comparison = lazy(() => import('./pages/Comparison.jsx'))
const RevenuePrediction = lazy(() => import('./pages/RevenuePrediction.jsx'))

// Loading fallback for lazy routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const userRole = typeof user.role === 'string' ? user.role : user.role?.role_name;
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  const { user } = useAuth()
  const location = useLocation()
  const [cmdOpen, setCmdOpen] = useState(false)

  // Ctrl+K command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
      // ? key opens shortcuts (only when not typing in an input)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault()
          setCmdOpen((v) => !v)
        }
      }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Routes where Layout header is NOT present
  const isPublicAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname)

  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: '14px', borderRadius: '12px' },
          success: { style: { background: '#10b981', color: '#fff' } },
          error: { style: { background: '#ef4444', color: '#fff' } },
        }}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* PWA Install Banner */}
      <InstallBanner />
      <OnboardingWizard />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        {/* Floating Theme Toggle on Login / Register / Forgot Password */}
        {isPublicAuthPage && (
          <div className="fixed top-5 right-6 z-50">
            <ThemeToggle />
          </div>
        )}

        <Suspense fallback={<PageLoader />}>
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
            <Route path="/forecasting" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><Forecasting /></ProtectedRoute>} />
            <Route path="/segmentation" element={<Segmentation />} />
            <Route path="/churn" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><Churn /></ProtectedRoute>} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/anomalies" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><Anomalies /></ProtectedRoute>} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/team" element={<ProtectedRoute allowedRoles={['business_owner', 'admin']}><Team /></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><AuditTrail /></ProtectedRoute>} />
            <Route path="/comparison" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><Comparison /></ProtectedRoute>} />
            <Route path="/funnel" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><FunnelAnalysis /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><ReportTemplates /></ProtectedRoute>} />
            <Route path="/scheduled-reports" element={<ProtectedRoute allowedRoles={['business_owner', 'admin']}><ScheduledReports /></ProtectedRoute>} />
            <Route path="/dashboard-builder" element={<ProtectedRoute allowedRoles={['business_owner', 'admin']}><DashboardBuilder /></ProtectedRoute>} />
            <Route path="/revenue-prediction" element={<ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}><RevenuePrediction /></ProtectedRoute>} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all Wildcard Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}
