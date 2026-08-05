import {} from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  LayoutDashboard, ShoppingCart, Boxes, FileText, Users,
  TrendingUp, PieChart, UserMinus, Sparkles, ShieldAlert, LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/forecasting', label: 'Forecasting', icon: TrendingUp },
  { to: '/segmentation', label: 'Segmentation', icon: PieChart },
  { to: '/churn', label: 'Churn Risk', icon: UserMinus },
  { to: '/recommendations', label: 'Recommendations', icon: Sparkles },
  { to: '/anomalies', label: 'Anomaly Alerts', icon: ShieldAlert },
]

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // All NAV_ITEMS are now directly visible without checking hasRole(...)
  const visibleItems = NAV_ITEMS

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-brand-900 text-white flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-tight">MarketMind AI</h1>
          <p className="text-xs text-brand-100/70 mt-1">Sales Intelligence Platform</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-500 text-white' : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-semibold">{user?.full_name}</p>
          <p className="text-xs text-brand-100/70">{ROLE_LABELS[user?.role] || user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-xs text-brand-100/80 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}