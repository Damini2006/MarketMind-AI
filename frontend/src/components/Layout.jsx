import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Avatar from '../components/Avatar'
import ChatBot from '../components/ChatBot'
import UndoRedoControls from '../components/UndoRedoControls'
import LiveAlerts from '../components/LiveAlerts'
import GuidedTour, { useTourAutoShow } from '../components/GuidedTour'
import {
  LayoutDashboard, ShoppingCart, Boxes, FileText, Users,
  UsersRound, Tags, Truck, Database,
  TrendingUp, PieChart, UserMinus, Sparkles, ShieldAlert, LogOut,
  Settings, Bell, ChevronDown, CheckCheck, ClipboardList, GitCompare,
  IndianRupee, Filter, LayoutTemplate, Clock,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/sales', labelKey: 'nav.sales', icon: ShoppingCart },
  { to: '/inventory', labelKey: 'nav.inventory', icon: Boxes },
  { to: '/invoices', labelKey: 'nav.invoices', icon: FileText },
  { to: '/customers', labelKey: 'nav.customers', icon: Users },
  { to: '/team', labelKey: 'nav.team', icon: UsersRound },
  { to: '/categories', labelKey: 'nav.categories', icon: Tags },
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: Truck },
  { to: '/datasets', labelKey: 'nav.datasets', icon: Database },
  { to: '/forecasting', labelKey: 'nav.forecasting', icon: TrendingUp },
  { to: '/segmentation', labelKey: 'nav.segmentation', icon: PieChart },
  { to: '/churn', labelKey: 'nav.churn', icon: UserMinus },
  { to: '/recommendations', labelKey: 'nav.recommendations', icon: Sparkles },
  { to: '/anomalies', labelKey: 'nav.anomalies', icon: ShieldAlert },
  { to: '/comparison', labelKey: 'nav.comparison', icon: GitCompare },
  { to: '/funnel', labelKey: 'nav.funnel', icon: Filter },
  { to: '/reports', labelKey: 'nav.reports', icon: LayoutTemplate },
  { to: '/scheduled-reports', labelKey: 'nav.scheduledReports', icon: Clock },
  { to: '/dashboard-builder', labelKey: 'nav.dashboardBuilder', icon: LayoutTemplate },
  { to: '/revenue-prediction', labelKey: 'nav.revenuePrediction', icon: IndianRupee },
  { to: '/activity', labelKey: 'nav.activity', icon: ClipboardList },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
]

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

// Pages visible to each role — if a page is missing from a role's list,
// it is hidden from the sidebar for that role.
const ROLE_PAGES = {
  business_owner: [    '/dashboard', '/sales', '/inventory', '/invoices', '/customers',
    '/categories', '/suppliers', '/team', '/datasets', '/forecasting',
    '/segmentation', '/churn',    '/recommendations', '/anomalies', '/comparison',
    '/revenue-prediction', '/activity', '/funnel', '/reports', '/scheduled-reports', '/dashboard-builder', '/settings',
  ],
  store_manager: [
    '/dashboard', '/sales', '/inventory', '/invoices', '/customers',
    '/categories', '/suppliers', '/forecasting', '/segmentation', '/churn',
    '/recommendations', '/anomalies', '/comparison',
    '/revenue-prediction', '/activity', '/settings',
  ],
  sales_executive: [
    '/dashboard', '/sales', '/inventory', '/invoices', '/customers',
    '/segmentation', '/recommendations', '/settings',
  ],
  admin: [
    '/dashboard', '/sales', '/inventory', '/invoices', '/customers',
    '/categories', '/suppliers', '/team', '/datasets', '/forecasting',
    '/segmentation', '/churn', '/recommendations', '/anomalies', '/comparison',
    '/revenue-prediction', '/activity', '/funnel', '/reports', '/scheduled-reports', '/dashboard-builder', '/settings',
  ],
}

const NOTIF_META = {
  inventory: { icon: Boxes, color: 'text-amber-500 dark:text-amber-400', label: 'Inventory' },
  anomaly: { icon: ShieldAlert, color: 'text-red-500 dark:text-red-400', label: 'Anomaly' },
  invoice: { icon: FileText, color: 'text-blue-500 dark:text-blue-400', label: 'Invoice' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function NotificationBell() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const refreshCount = useCallback(() => {
    api.get('/notifications/unread-count')
      .then((res) => setUnread(res.data.unread_count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = setInterval(refreshCount, 30000)
    return () => clearInterval(timer)
  }, [refreshCount])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleDropdown = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setItems(res.data.items)
      setUnread(res.data.unread_count)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const markRead = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
    } catch {
      // ignore mark-read failures (bell state refreshes on next poll)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((prev) => prev.map((x) => ({ ...x, read: true })))
      setUnread(0)
    } catch {
      // ignore read-all failures (bell state refreshes on next poll)
    }
  }

  const handleItemClick = async (n) => {
    if (!n.read) await markRead(n)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        data-tour="notifications"
        onClick={toggleDropdown}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-slate-500 dark:text-slate-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 flex flex-col max-h-[28rem]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Notifications
              {unread > 0 && <span className="ml-2 text-xs font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{unread}</span>}
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                You're all caught up 🎉
              </p>
            ) : (
              items.map((n) => {
                const meta = NOTIF_META[n.type] || { icon: Bell, color: 'text-slate-500', label: n.type }
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 transition-colors ${
                      n.read
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'bg-brand-50/60 dark:bg-brand-950/20 hover:bg-brand-50 dark:hover:bg-brand-950/40'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${meta.color}`}>
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>
                          {n.title}
                        </span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.message}</span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {meta.label} · {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
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
        <Avatar user={user} size="sm" />
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
  const { t } = useTranslation()
  const location = useLocation()

  const userRole = typeof user?.role === 'string' ? user?.role : user?.role?.role_name;
  const allowedPages = ROLE_PAGES[userRole] || ROLE_PAGES.business_owner;
  const visibleItems = NAV_ITEMS.filter((item) => allowedPages.includes(item.to));

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  const { showTour, closeTour } = useTourAutoShow(user?.role)

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-900 dark:bg-slate-900 text-white flex flex-col shrink-0 h-screen border-r border-transparent dark:border-slate-800">
        <div className="px-6 py-5 border-b border-white/10 dark:border-slate-800 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-white">MarketMind AI</h1>
          <p className="text-xs text-brand-100/70 dark:text-slate-400 mt-1">Sales Intelligence Platform</p>
        </div>
        <nav data-tour="sidebar" className="sidebar-scroll flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleItems.map(({ to, labelKey, icon: Icon }) => (
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
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-brand-100/70 dark:text-slate-400">{ROLE_LABELS[userRole] || userRole}</p>
            </div>
          </div>
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
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{today}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <LiveAlerts showIcon={false} />
            <ProfileMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <div data-tour="chatbot"><ChatBot /></div>
      <UndoRedoControls />
      <GuidedTour show={showTour} onClose={closeTour} role={user?.role} />
    </div>
  )
}