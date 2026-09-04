import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Avatar from '../components/Avatar'
import ChatBot from '../components/ChatBot'
import LiveAlerts from '../components/LiveAlerts'
import GuidedTour, { useTourAutoShow } from '../components/GuidedTour'
import {
  LayoutDashboard, ShoppingCart, Boxes, FileText, Users,
  UsersRound, Tags, Truck, Database,
  TrendingUp, PieChart, UserMinus, Sparkles, ShieldAlert, LogOut,
  Settings, Bell, ChevronDown, CheckCheck, ClipboardList, GitCompare,
  IndianRupee, Filter, LayoutTemplate, Clock,
  BarChart3, Brain, FileBarChart, Shield,
  ChevronRight, ChevronsUpDown, HelpCircle, Zap, Download,
} from 'lucide-react'

// ── Grouped Navigation ──────────────────────────────────────────────

const NAV_GROUPS = [
  {
    id: 'overview',
    labelKey: 'navGroup.overview',
    icon: BarChart3,
    accent: 'from-blue-500 to-cyan-500',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/activity', labelKey: 'nav.activity', icon: ClipboardList },
    ],
  },
  {
    id: 'operations',
    labelKey: 'navGroup.operations',
    icon: ShoppingCart,
    accent: 'from-emerald-500 to-teal-500',
    items: [
      { to: '/sales', labelKey: 'nav.sales', icon: ShoppingCart },
      { to: '/inventory', labelKey: 'nav.inventory', icon: Boxes },
      { to: '/invoices', labelKey: 'nav.invoices', icon: FileText },
      { to: '/customers', labelKey: 'nav.customers', icon: Users },
      { to: '/categories', labelKey: 'nav.categories', icon: Tags },
      { to: '/suppliers', labelKey: 'nav.suppliers', icon: Truck },
    ],
  },
  {
    id: 'ai',
    labelKey: 'navGroup.aiAnalytics',
    icon: Brain,
    accent: 'from-purple-500 to-pink-500',
    items: [
      { to: '/forecasting', labelKey: 'nav.forecasting', icon: TrendingUp },
      { to: '/segmentation', labelKey: 'nav.segmentation', icon: PieChart },
      { to: '/churn', labelKey: 'nav.churn', icon: UserMinus },
      { to: '/recommendations', labelKey: 'nav.recommendations', icon: Sparkles },
      { to: '/anomalies', labelKey: 'nav.anomalies', icon: ShieldAlert },
      { to: '/revenue-prediction', labelKey: 'nav.revenuePrediction', icon: IndianRupee },
    ],
  },
  {
    id: 'reports',
    labelKey: 'navGroup.reports',
    icon: FileBarChart,
    accent: 'from-amber-500 to-orange-500',
    items: [
      { to: '/reports', labelKey: 'nav.reports', icon: LayoutTemplate },
      { to: '/scheduled-reports', labelKey: 'nav.scheduledReports', icon: Clock },
      { to: '/dashboard-builder', labelKey: 'nav.dashboardBuilder', icon: LayoutTemplate },
      { to: '/comparison', labelKey: 'nav.comparison', icon: GitCompare },
      { to: '/funnel', labelKey: 'nav.funnel', icon: Filter },
    ],
  },
  {
    id: 'admin',
    labelKey: 'navGroup.admin',
    icon: Shield,
    accent: 'from-rose-500 to-red-500',
    items: [
      { to: '/team', labelKey: 'nav.team', icon: UsersRound },
      { to: '/datasets', labelKey: 'nav.datasets', icon: Database },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
]

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

const ROLE_BADGE_COLORS = {
  business_owner: 'bg-gradient-to-r from-amber-400 to-orange-500',
  store_manager: 'bg-gradient-to-r from-blue-400 to-indigo-500',
  sales_executive: 'bg-gradient-to-r from-emerald-400 to-teal-500',
  admin: 'bg-gradient-to-r from-purple-400 to-pink-500',
}

const ROLE_PAGES = {
  business_owner: [
    '/dashboard', '/sales', '/inventory', '/invoices', '/customers',
    '/categories', '/suppliers', '/team', '/datasets', '/forecasting',
    '/segmentation', '/churn', '/recommendations', '/anomalies', '/comparison',
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

// ── Collapsible Sidebar Group ──────────────────────────────────────

const SIDEBAR_EXPANDED_KEY = 'marketmind-sidebar-groups'

function SidebarGroup({ group, allowedPages, isExpanded, onToggle, pathname }) {
  const { t } = useTranslation()
  const GroupIcon = group.icon
  const visibleItems = group.items.filter((item) => allowedPages.includes(item.to))
  if (visibleItems.length === 0) return null

  const hasActiveChild = visibleItems.some(
    (item) => pathname === item.to || pathname.startsWith(item.to + '/')
  )

  return (
    <div className="mb-1.5">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 group ${
          hasActiveChild
            ? 'text-white/95 dark:text-indigo-300 bg-white/5 dark:bg-slate-800/50'
            : 'text-white/50 dark:text-slate-500 hover:text-white/80 dark:hover:text-slate-300 hover:bg-white/5 dark:hover:bg-slate-800/40'
        }`}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-200 ${
          hasActiveChild
            ? `bg-gradient-to-br ${group.accent} shadow-sm`
            : 'bg-white/8 dark:bg-slate-700/60'
        }`}>
          <GroupIcon size={11} className="text-white" />
        </div>
        <span className="flex-1 text-left">{t(group.labelKey)}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-all duration-200 ${
          hasActiveChild
            ? 'bg-white/15 text-white/80'
            : 'bg-white/8 dark:bg-slate-700/50 text-white/30 dark:text-slate-600'
        }`}>
          {visibleItems.length}
        </span>
        <ChevronRight
          size={12}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? visibleItems.length * 40 + 'px' : '0px' }}
      >
        <div className="pl-3 py-1 space-y-0.5 ml-3 border-l border-white/8 dark:border-slate-700/50">
          {visibleItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group/item ' +
                (isActive
                  ? 'bg-gradient-to-r from-brand-500/90 to-brand-600/90 dark:from-indigo-600/90 dark:to-indigo-700/90 text-white shadow-sm shadow-brand-500/20 dark:shadow-indigo-600/20'
                  : 'text-brand-100/60 dark:text-slate-400 hover:bg-white/8 dark:hover:bg-slate-800/50 hover:text-white dark:hover:text-slate-100 hover:translate-x-0.5')
              }
            >
              <Icon size={14} className="shrink-0 opacity-80 group-hover/item:opacity-100 transition-opacity" />
              <span className="truncate">{t(labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Expand/Collapse All Toggle ─────────────────────────────────────

function ExpandAllToggle({ allIds, expandedGroups, toggleGroup }) {
  const { t } = useTranslation()
  const allExpanded = allIds.every((id) => expandedGroups.includes(id))
  return (
    <button
      onClick={() => {
        allIds.forEach((id) => {
          if (allExpanded && expandedGroups.includes(id)) toggleGroup(id)
          if (!allExpanded && !expandedGroups.includes(id)) toggleGroup(id)
        })
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-white/35 dark:text-slate-600 hover:text-white/60 dark:hover:text-slate-400 transition-colors uppercase tracking-widest"
    >
      <ChevronsUpDown size={12} />
      {allExpanded ? 'Collapse All' : 'Expand All'}
    </button>
  )
}

// ── Notification Bell ──────────────────────────────────────────────

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
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setItems(res.data.items)
      setUnread(res.data.unread_count)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }

  const markRead = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((prev) => prev.map((x) => ({ ...x, read: true })))
      setUnread(0)
    } catch {}
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
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 flex flex-col max-h-[28rem]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Notifications
              {unread > 0 && <span className="ml-2 text-xs font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{unread}</span>}
            </p>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">You're all caught up</p>
            ) : (
              items.map((n) => {
                const meta = NOTIF_META[n.type] || { icon: Bell, color: 'text-slate-500', label: n.type }
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-slate-800 transition-colors ${
                      n.read ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-brand-50/60 dark:bg-brand-950/20 hover:bg-brand-50 dark:hover:bg-brand-950/40'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${meta.color}`}><Icon size={18} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>{n.title}</span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.message}</span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">{meta.label} &middot; {timeAgo(n.created_at)}</span>
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

// ── Profile Menu ───────────────────────────────────────────────────

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
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.full_name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
          <button onClick={() => { setOpen(false); navigate('/settings') }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Settings size={16} /> Settings
          </button>
          <button onClick={() => { setOpen(false); onLogout() }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Layout ────────────────────────────────────────────────────

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  const userRole = typeof user?.role === 'string' ? user?.role : user?.role?.role_name
  const allowedPages = ROLE_PAGES[userRole] || ROLE_PAGES.business_owner
  const pathname = location.pathname

  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return ['overview']
  })

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) => pathname === item.to || pathname.startsWith(item.to + '/'))
    )
    if (activeGroup && !expandedGroups.includes(activeGroup.id)) {
      setExpandedGroups((prev) => [...prev, activeGroup.id])
    }
  }, [pathname]) // eslint-disable-line

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const allGroupIds = NAV_GROUPS.map((g) => g.id)
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  const { showTour, closeTour } = useTourAutoShow(user?.role)
  const handleLogout = () => { logout() }

  // Get current page name for breadcrumb
  const currentPageName = (() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (pathname === item.to) return t(item.labelKey)
      }
    }
    return ''
  })()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <aside aria-label="Sidebar" className="w-64 bg-brand-900 dark:bg-slate-900 text-white flex flex-col shrink-0 h-screen border-r border-transparent dark:border-slate-800">
        {/* ── Logo Header with gradient accent ── */}
        <div className="px-4 py-5 shrink-0 relative overflow-hidden">
          {/* Decorative gradient orb */}
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-brand-500/20 to-purple-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 relative">
            <img src="/logo.svg" alt="MarketMind AI" className="w-10 h-10 rounded-xl shadow-lg shadow-brand-600/30 dark:shadow-indigo-600/30" />
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold tracking-tight text-white leading-tight">MarketMind AI</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[9px] text-emerald-400/80 font-semibold tracking-wider uppercase">System Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Expand/Collapse All ── */}
        <div className="px-3 pb-1">
          <ExpandAllToggle allIds={allGroupIds} expandedGroups={expandedGroups} toggleGroup={toggleGroup} />
        </div>

        {/* ── Sidebar Groups ── */}
        <nav data-tour="sidebar" aria-label="Main Navigation" className="sidebar-scroll flex-1 overflow-y-auto py-2 px-3">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup
              key={group.id}
              group={group}
              allowedPages={allowedPages}
              isExpanded={expandedGroups.includes(group.id)}
              onToggle={() => toggleGroup(group.id)}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* ── Help Shortcut ── */}
        <div className="px-3 pb-1">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-white/30 dark:text-slate-600 hover:text-white/60 dark:hover:text-slate-400 hover:bg-white/5 dark:hover:bg-slate-800/40 transition-all w-full"
          >
            <HelpCircle size={13} />
            <span>Press ? for shortcuts</span>
            <kbd className="ml-auto text-[9px] bg-white/10 dark:bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">?</kbd>
          </button>
        </div>

        {/* ── User Card ── */}
        <div className="px-3 pb-3 shrink-0">
          <div className="bg-white/5 dark:bg-slate-800/50 rounded-xl p-3 border border-white/5 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar user={user} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-brand-900 dark:border-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
                <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white ${ROLE_BADGE_COLORS[userRole] || 'bg-slate-500'}`}>
                  {ROLE_LABELS[userRole] || userRole}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{today}</span>
            {currentPageName && (
              <>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:block">/</span>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 hidden sm:block">{currentPageName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <LiveAlerts showIcon={false} />
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-install-modal'))}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Install App"
              aria-label="Install MarketMind AI"
            >
              <Download size={18} className="text-slate-500 dark:text-slate-400" />
            </button>
            <ProfileMenu user={user} onLogout={handleLogout} />
          </div>
        </header>
        <main role="main" aria-label="Page Content" className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <div data-tour="chatbot"><ChatBot /></div>
      <GuidedTour show={showTour} onClose={closeTour} role={user?.role} />
    </div>
  )
}
