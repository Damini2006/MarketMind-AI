import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import ThemeToggle from '../components/ThemeToggle'
import {
  LayoutDashboard, ShoppingCart, Boxes, FileText, Users,
  TrendingUp, PieChart, UserMinus, Sparkles, ShieldAlert, LogOut,
  Settings, Bell, ChevronDown, UsersRound, Tags, Truck, Database
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/sales', label: 'Sales', icon: ShoppingCart, roles: null },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: null },
  { to: '/invoices', label: 'Invoices', icon: FileText, roles: null },
  { to: '/customers', label: 'Customers', icon: Users, roles: null },
  { to: '/categories', label: 'Categories', icon: Tags, roles: ['business_owner', 'store_manager', 'admin'] },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['business_owner', 'store_manager', 'admin'] },
  { to: '/team', label: 'Team', icon: UsersRound, roles: ['business_owner', 'admin'] },
  { to: '/datasets', label: 'Datasets', icon: Database, roles: ['business_owner', 'admin'] },
  { to: '/forecasting', label: 'Forecasting', icon: TrendingUp, roles: ['business_owner', 'store_manager', 'admin'] },
  { to: '/segmentation', label: 'Segmentation', icon: PieChart, roles: null },
  { to: '/churn', label: 'Churn Risk', icon: UserMinus, roles: ['business_owner', 'store_manager', 'admin'] },
  { to: '/recommendations', label: 'Recommendations', icon: Sparkles, roles: null },
  { to: '/anomalies', label: 'Anomaly Alerts', icon: ShieldAlert, roles: ['business_owner', 'store_manager', 'admin'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: null },
]

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
}

function NotificationBell() {
  const [alerts, setAlerts] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    api.get('/inventory/alerts').then((res) => setAlerts(res.data)).catch(() => setAlerts([]))
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Bell size={20} className="text-slate-500 dark:text-slate-400" />
        {alerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-2 z-50 max-h-80 overflow-y-auto">
          <p className="px-4 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Notifications</p>
          {alerts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No alerts right now.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-slate-800 text-brand-700 dark:text-slate-200 flex items-center justify-center text-sm font-semibold">
          {initials(user?.full_name)}
        </div>
        <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user?.full_name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/settings') }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()

  const visibleItems = NAV_ITEMS
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar with Dark Mode Theme Support */}
      <aside className="w-64 bg-brand-900 dark:bg-slate-900 text-white flex flex-col shrink-0 h-screen border-r border-transparent dark:border-slate-800 transition-colors duration-300">
        <div className="px-6 py-5 border-b border-white/10 dark:border-slate-800 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-white">MarketMind AI</h1>
          <p className="text-xs text-brand-100/70 dark:text-slate-400 mt-1">Sales Intelligence Platform</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role?.role_name || user?.role)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-brand-500 dark:bg-indigo-600 text-white shadow-sm' 
                    : 'text-brand-100/80 dark:text-slate-400 hover:bg-white/10 dark:hover:bg-slate-800/60 hover:text-white dark:hover:text-slate-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 dark:border-slate-800 shrink-0">
          <p className="text-sm font-semibold text-white">{user?.full_name}</p>
          <p className="text-xs text-brand-100/70 dark:text-slate-400">{ROLE_LABELS[user?.role?.role_name || user?.role] || user?.role?.role_name || user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-xs text-brand-100/80 dark:text-slate-400 hover:text-white dark:hover:text-slate-200 transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-6 md:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{today}</span>
            <ThemeToggle />
            <NotificationBell />
            <ProfileMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}