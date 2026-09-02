import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import {
  Activity, LogIn, LogOut, ShoppingCart, Package, FileText,
  Users, Settings, Upload, AlertTriangle, RefreshCw,
  Clock, ChevronLeft, ChevronRight, Search, X, Download,
  Calendar, BarChart3, PieChart, Eye, Zap,
  CheckCircle2, ArrowUpRight,
} from 'lucide-react'

const ACTION_ICONS = {
  login: LogIn, logout: LogOut, create_sale: ShoppingCart,
  update_inventory: Package, create_product: Package, update_product: Package,
  create_customer: Users, update_customer: Users, create_invoice: FileText,
  update_invoice: FileText, update_profile: Settings, upload_dataset: Upload,
  create_category: Package, create_supplier: Package, register: Users,
  delete_sale: AlertTriangle, delete_product: AlertTriangle,
  delete_customer: AlertTriangle, resolve_alert: CheckCircle2,
  mark_paid: CheckCircle2, default: Activity,
}

const ACTION_COLORS = {
  login: '#3b82f6', logout: '#94a3b8', create_sale: '#22c55e',
  update_inventory: '#f59e0b', create_product: '#6366f1', update_product: '#6366f1',
  create_customer: '#06b6d4', update_customer: '#06b6d4', create_invoice: '#a855f7',
  update_invoice: '#a855f7', update_profile: '#94a3b8', upload_dataset: '#f97316',
  register: '#22c55e', delete_sale: '#ef4444', delete_product: '#ef4444',
  delete_customer: '#ef4444', resolve_alert: '#22c55e', mark_paid: '#22c55e',
  default: '#94a3b8',
}

const ACTION_BG = {
  login: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
  logout: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
  create_sale: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
  update_inventory: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
  create_product: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30',
  update_product: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30',
  create_customer: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
  update_customer: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
  create_invoice: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
  update_invoice: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
  update_profile: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
  upload_dataset: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
  register: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
  delete_sale: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  delete_product: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  delete_customer: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  resolve_alert: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
  mark_paid: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
  default: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
}

const ACTION_LABELS = {
  login: 'Logged in', logout: 'Logged out', create_sale: 'Created sale',
  update_inventory: 'Updated inventory', create_product: 'Added product',
  update_product: 'Updated product', create_customer: 'Added customer',
  update_customer: 'Updated customer', create_invoice: 'Created invoice',
  update_invoice: 'Updated invoice', update_profile: 'Updated profile',
  upload_dataset: 'Uploaded dataset', create_category: 'Added category',
  create_supplier: 'Added supplier', register: 'Registered',
  delete_sale: 'Deleted sale', delete_product: 'Deleted product',
  delete_customer: 'Deleted customer', resolve_alert: 'Resolved alert',
  mark_paid: 'Marked invoice paid',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Heatmap Component ──
function ActivityHeatmap({ data }) {
  if (!data || data.length === 0) return null
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const weeks = []
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7))
  }
  const getIntensity = (count) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800'
    const ratio = count / maxCount
    if (ratio > 0.75) return 'bg-emerald-500'
    if (ratio > 0.5) return 'bg-emerald-400'
    if (ratio > 25) return 'bg-emerald-300'
    return 'bg-emerald-200 dark:bg-emerald-800'
  }
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-emerald-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activity Heatmap</span>
        </div>
        <span className="text-[10px] text-slate-400">{data.length} days</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div key={di} className={`w-3 h-3 rounded-sm ${getIntensity(day.count)} transition-colors cursor-default`}
                title={`${day.date}: ${day.count} activities`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[9px] text-slate-400">Less</span>
        <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-300" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
        <span className="text-[9px] text-slate-400">More</span>
      </div>
    </div>
  )
}

// ── Hourly Chart ──
function HourlyChart({ data }) {
  if (!data || data.length === 0) return null
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activity by Hour</span>
      </div>
      <div className="flex items-end gap-0.5 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.hour}:00 — ${d.count} activities`}>
            <div className="w-full rounded-t transition-all duration-300 hover:opacity-80"
              style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%`, backgroundColor: d.count > 0 ? '#3b82f6' : '#e2e8f0', minHeight: d.count > 0 ? '3px' : '1px' }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] text-slate-400">12am</span>
        <span className="text-[8px] text-slate-400">6am</span>
        <span className="text-[8px] text-slate-400">12pm</span>
        <span className="text-[8px] text-slate-400">6pm</span>
        <span className="text-[8px] text-slate-400">11pm</span>
      </div>
    </div>
  )
}

// ── Action Distribution ──
function ActionDistribution({ data }) {
  if (!data || Object.keys(data).length === 0) return null
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const topEntries = entries.slice(0, 6)
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <PieChart size={14} className="text-purple-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Action Breakdown</span>
      </div>
      <div className="space-y-1.5">
        {topEntries.map(([action, count]) => (
          <div key={action} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 w-20 shrink-0 truncate">{ACTION_LABELS[action] || action}</span>
            <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 flex items-center pl-1.5"
                style={{ width: `${(count / total) * 100}%`, backgroundColor: ACTION_COLORS[action] || '#94a3b8', minWidth: count > 0 ? '16px' : '0' }}>
                {count > 0 && <span className="text-[8px] font-bold text-white">{count}</span>}
              </div>
            </div>
          </div>
        ))}
        {entries.length > 6 && (
          <p className="text-[9px] text-slate-400 mt-1">+{entries.length - 6} more categories</p>
        )}
      </div>
    </div>
  )
}

// ── Detail Modal ──
function ActivityDetailModal({ activity, onClose }) {
  if (!activity) return null
  const Icon = ACTION_ICONS[activity.action] || ACTION_ICONS.default
  const color = ACTION_COLORS[activity.action] || ACTION_COLORS.default
  const bgClass = ACTION_BG[activity.action] || ACTION_BG.default
  const label = ACTION_LABELS[activity.action] || activity.action
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${bgClass}`}>
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(activity.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{activity.description || 'No description'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-1">User</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{activity.user_name}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-1">Action</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
              </div>
            </div>

            {activity.entity_type && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase mb-1">Entity Type</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{activity.entity_type}</p>
                </div>
                {activity.entity_id && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 uppercase mb-1">Entity ID</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">#{activity.entity_id}</p>
                  </div>
                )}
              </div>
            )}

            {activity.ip_address && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase mb-1">IP Address</p>
                <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{activity.ip_address}</p>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase mb-1">Timestamp</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {activity.created_at ? new Date(activity.created_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="w-full mt-4 px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const now = Date.now()
const DEMO_ACTIVITIES = [
  { id: 1, user_name: 'Neelam', action: 'login', entity_type: null, description: 'Logged into the system', created_at: new Date(now - 300000).toISOString() },
  { id: 2, user_name: 'Rishika', action: 'create_sale', entity_type: 'sale', description: 'Created sale #INV-0042 for ₹12,500', created_at: new Date(now - 900000).toISOString() },
  { id: 3, user_name: 'Damini', action: 'update_inventory', entity_type: 'inventory', description: 'Updated stock for Whole Wheat Atta 10kg (-5 units)', created_at: new Date(now - 1800000).toISOString() },
  { id: 4, user_name: 'Neelam', action: 'create_customer', entity_type: 'customer', description: 'Added new customer Priya Sharma', created_at: new Date(now - 3600000).toISOString() },
  { id: 5, user_name: 'Rishika', action: 'create_invoice', entity_type: 'invoice', description: 'Generated invoice #INV-0041 for sale #41', created_at: new Date(now - 5400000).toISOString() },
  { id: 6, user_name: 'Damini', action: 'update_product', entity_type: 'product', description: 'Updated price for Organic Basmati Rice 5kg to ₹450', created_at: new Date(now - 7200000).toISOString() },
  { id: 7, user_name: 'Neelam', action: 'upload_dataset', entity_type: 'dataset', description: 'Uploaded sales_data_august.csv (245 records)', created_at: new Date(now - 10800000).toISOString() },
  { id: 8, user_name: 'Rishika', action: 'update_profile', entity_type: 'profile', description: 'Updated avatar color and bio', created_at: new Date(now - 14400000).toISOString() },
  { id: 9, user_name: 'Damini', action: 'create_product', entity_type: 'product', description: 'Added new product Stainless Steel Water Bottle', created_at: new Date(now - 18000000).toISOString() },
  { id: 10, user_name: 'Neelam', action: 'login', entity_type: null, description: 'Logged into the system', created_at: new Date(now - 21600000).toISOString() },
]
const DEMO_STATS = { total: 10, today: 3, this_week: 8, this_month: 10, active_users: 3 }
const DEMO_HEATMAP = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
  count: Math.floor(Math.random() * 8),
}))
const DEMO_HOURLY = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: h >= 9 && h <= 18 ? Math.floor(Math.random() * 10) + 1 : Math.floor(Math.random() * 3) }))
const DEMO_ACTION_DIST = { login: 15, create_sale: 12, update_inventory: 8, create_customer: 5, create_invoice: 4, update_product: 3 }

// ── Main Component ──
export default function ActivityLog() {
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [viewMode, setViewMode] = useState('list') // list | timeline
  const [filters, setFilters] = useState({ action: '', entity_type: '', user_id: '', date_from: '', date_to: '' })
  const limit = 20


  const fetchActivities = useCallback(async () => {
    try {
      const params = { limit, offset: page * limit }
      if (filters.action) params.action = filters.action
      if (filters.entity_type) params.entity_type = filters.entity_type
      if (filters.user_id) params.user_id = filters.user_id
      const res = await api.get('/activity/log', { params })
      let items = res.data.items || []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(a =>
          (a.description || '').toLowerCase().includes(q) ||
          (a.user_name || '').toLowerCase().includes(q) ||
          (a.action || '').toLowerCase().includes(q)
        )
      }
      setActivities(items)
      setTotal(res.data.total || items.length)
    } catch {
      let filtered = DEMO_ACTIVITIES
      if (filters.action) filtered = filtered.filter(a => a.action === filters.action)
      if (filters.entity_type) filtered = filtered.filter(a => a.entity_type === filters.entity_type)
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(a =>
          (a.description || '').toLowerCase().includes(q) ||
          (a.user_name || '').toLowerCase().includes(q)
        )
      }
      setActivities(filtered.slice(page * limit, (page + 1) * limit))
      setTotal(filtered.length)
    } finally {
      setLoading(false)
    }
  }, [page, filters, search])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/activity/stats')
      setStats(res.data)
    } catch { setStats(DEMO_STATS) }
  }, [])

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await api.get('/activity/heatmap', { params: { days: 30 } })
      setHeatmapData(res.data)
    } catch {
      setHeatmapData({ heatmap: DEMO_HEATMAP, hourly: DEMO_HOURLY, action_distribution: DEMO_ACTION_DIST, total_entries: 10 })
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/activity/users')
      setUsers(res.data.users || [])
    } catch {
      setUsers([
        { user_id: 1, name: 'Neelam', count: 4 },
        { user_id: 2, name: 'Rishika', count: 3 },
        { user_id: 3, name: 'Damini', count: 3 },
      ])
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchActivities is a shared useCallback used by auto-refresh interval
  useEffect(() => { fetchActivities() }, [fetchActivities])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- stats/heatmap/users are independent one-shot fetches
  useEffect(() => { fetchStats(); fetchHeatmap(); fetchUsers() }, [fetchStats, fetchHeatmap, fetchUsers])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => { fetchActivities(); fetchStats(); fetchHeatmap() }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchActivities, fetchStats, fetchHeatmap])

  const totalPages = Math.ceil(total / limit)

  const exportCSV = () => {
    const headers = ['ID', 'User', 'Action', 'Entity Type', 'Entity ID', 'Description', 'IP Address', 'Timestamp']
    const rows = activities.map(a => [
      a.id, a.user_name, a.action, a.entity_type || '', a.entity_id || '',
      `"${(a.description || '').replace(/"/g, '""')}"`, a.ip_address || '',
      a.created_at ? new Date(a.created_at).toISOString() : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Group activities by date for timeline view
  const groupedActivities = useMemo(() => {
    const groups = {}
    activities.forEach(a => {
      const date = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'
      if (!groups[date]) groups[date] = []
      groups[date].push(a)
    })
    return groups
  }, [activities])

  const getIcon = (action) => ACTION_ICONS[action] || ACTION_ICONS.default
  const getColor = (action) => ACTION_COLORS[action] || ACTION_COLORS.default
  const getBg = (action) => ACTION_BG[action] || ACTION_BG.default
  const getLabel = (action) => ACTION_LABELS[action] || action

  const trendToday = stats ? (stats.today > 0 ? 'up' : 'stable') : 'stable'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Activity Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {total} total actions across your team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              autoRefresh ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}>
            <Zap size={12} className={autoRefresh ? 'animate-pulse' : ''} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Download size={12} /> Export CSV
          </button>
          <button onClick={() => { fetchActivities(); fetchStats(); fetchHeatmap(); fetchUsers() }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today</p>
              {trendToday === 'up' && <ArrowUpRight size={12} className="text-emerald-500" />}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.today}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">actions logged</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">This Week</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.this_week}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">weekly activity</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">This Month</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.this_month}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">monthly total</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Active Users</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.active_users}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">team members</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">all time</p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityHeatmap data={heatmapData?.heatmap} />
        </div>
        <HourlyChart data={heatmapData?.hourly} />
      </div>

      <ActionDistribution data={heatmapData?.action_distribution} />

      {/* Filters + Search */}
      <div className="card">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search activities..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0) }}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filters.entity_type} onChange={(e) => { setFilters({ ...filters, entity_type: e.target.value }); setPage(0) }}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="">All Entities</option>
              <option value="sale">Sales</option>
              <option value="product">Products</option>
              <option value="customer">Customers</option>
              <option value="invoice">Invoices</option>
              <option value="inventory">Inventory</option>
              <option value="profile">Profile</option>
              <option value="dataset">Datasets</option>
            </select>
            {users.length > 0 && (
              <select value={filters.user_id} onChange={(e) => { setFilters({ ...filters, user_id: e.target.value }); setPage(0) }}
                className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
                <option value="">All Users</option>
                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name} ({u.count})</option>)}
              </select>
            )}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg dark:bg-slate-800">
              <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                <Activity size={14} />
              </button>
              <button onClick={() => setViewMode('timeline')} className={`p-1 rounded ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                <Clock size={14} />
              </button>
            </div>
          </div>
        </div>

        {(filters.action || filters.entity_type || filters.user_id || search) && (
          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <span className="text-slate-400">{activities.length} results · {[
              filters.action && 'action', filters.entity_type && 'entity', filters.user_id && 'user', search && 'search'
            ].filter(Boolean).length} filter(s) active</span>
            <button onClick={() => { setFilters({ action: '', entity_type: '', user_id: '', date_from: '', date_to: '' }); setSearch(''); setPage(0) }}
              className="text-indigo-500 hover:text-indigo-700 font-medium">Clear all</button>
          </div>
        )}

        {/* Activity List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading activities...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle2 size={24} className="mb-2 opacity-40 text-green-500" />
            <p className="text-sm">No activities found</p>
            <p className="text-xs text-slate-400 mt-1">{search ? 'Try a different search term' : 'Actions will appear here as your team uses the app'}</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {activities.map((item) => {
              const Icon = getIcon(item.action)
              const bgClass = getBg(item.action)
              const label = getLabel(item.action)
              return (
                <div key={item.id} onClick={() => setSelectedDetail(item)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-lg my-0.5">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${bgClass}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-semibold">{item.user_name}</span>
                      <span className="text-slate-500 dark:text-slate-400"> {label.toLowerCase()} </span>
                      {item.entity_type && (
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ''}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(item.created_at)}</span>
                    <Eye size={12} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Timeline View */
          <div className="space-y-4">
            {Object.entries(groupedActivities).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={12} className="text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{date}</span>
                  <span className="text-[10px] text-slate-400">({items.length} activities)</span>
                </div>
                <div className="relative ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-4 space-y-3">
                  {items.map((item) => {
                    const color = getColor(item.action)
                    const label = getLabel(item.action)
                    return (
                      <div key={item.id} onClick={() => setSelectedDetail(item)}
                        className="relative cursor-pointer group">
                        <div className="absolute -left-[21px] top-2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900" style={{ backgroundColor: color }} />
                        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 dark:text-slate-200">
                              <span className="font-semibold">{item.user_name}</span>
                              <span className="text-slate-500 dark:text-slate-400"> {label.toLowerCase()} </span>
                              {item.entity_type && (
                                <span className="font-medium text-slate-700 dark:text-slate-300">{item.entity_type}</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.description}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 mt-1">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
                Page {page + 1} of {totalPages}
              </span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ActivityDetailModal activity={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  )
}
