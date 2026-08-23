import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Activity, LogIn, LogOut, ShoppingCart, Package, FileText,
  Users, Settings, Upload, AlertTriangle, RefreshCw, Filter,
  Clock, User, ChevronLeft, ChevronRight,
} from 'lucide-react'

const ACTION_ICONS = {
  login: LogIn,
  logout: LogOut,
  create_sale: ShoppingCart,
  update_inventory: Package,
  create_product: Package,
  update_product: Package,
  create_customer: Users,
  update_customer: Users,
  create_invoice: FileText,
  update_invoice: FileText,
  update_profile: Settings,
  upload_dataset: Upload,
  create_category: Package,
  create_supplier: Package,
  register: Users,
  default: Activity,
}

const ACTION_COLORS = {
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
  default: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
}

const ACTION_LABELS = {
  login: 'Logged in',
  logout: 'Logged out',
  create_sale: 'Created sale',
  update_inventory: 'Updated inventory',
  create_product: 'Added product',
  update_product: 'Updated product',
  create_customer: 'Added customer',
  update_customer: 'Updated customer',
  create_invoice: 'Created invoice',
  update_invoice: 'Updated invoice',
  update_profile: 'Updated profile',
  upload_dataset: 'Uploaded dataset',
  create_category: 'Added category',
  create_supplier: 'Added supplier',
  register: 'Registered',
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
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ActivityLog() {
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ action: '', entity_type: '', user_id: '' })
  const limit = 20

  const DEMO_ACTIVITIES = [
    { id: 1, user_name: 'Neelam', action: 'login', entity_type: null, description: 'Logged into the system', created_at: new Date(Date.now() - 300000).toISOString() },
    { id: 2, user_name: 'Rishika', action: 'create_sale', entity_type: 'sale', description: 'Created sale #INV-0042 for ₹12,500', created_at: new Date(Date.now() - 900000).toISOString() },
    { id: 3, user_name: 'Damini', action: 'update_inventory', entity_type: 'inventory', description: 'Updated stock for Whole Wheat Atta 10kg (-5 units)', created_at: new Date(Date.now() - 1800000).toISOString() },
    { id: 4, user_name: 'Neelam', action: 'create_customer', entity_type: 'customer', description: 'Added new customer Priya Sharma', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, user_name: 'Rishika', action: 'create_invoice', entity_type: 'invoice', description: 'Generated invoice #INV-0041 for sale #41', created_at: new Date(Date.now() - 5400000).toISOString() },
    { id: 6, user_name: 'Damini', action: 'update_product', entity_type: 'product', description: 'Updated price for Organic Basmati Rice 5kg to ₹450', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 7, user_name: 'Neelam', action: 'upload_dataset', entity_type: 'dataset', description: 'Uploaded sales_data_august.csv (245 records)', created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: 8, user_name: 'Rishika', action: 'update_profile', entity_type: 'profile', description: 'Updated avatar color and bio', created_at: new Date(Date.now() - 14400000).toISOString() },
    { id: 9, user_name: 'Damini', action: 'create_product', entity_type: 'product', description: 'Added new product Stainless Steel Water Bottle', created_at: new Date(Date.now() - 18000000).toISOString() },
    { id: 10, user_name: 'Neelam', action: 'login', entity_type: null, description: 'Logged into the system', created_at: new Date(Date.now() - 21600000).toISOString() },
  ]

  const DEMO_STATS = { total: 10, today: 3, this_week: 8, this_month: 10, active_users: 3 }

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const params = { limit, offset: page * limit }
      if (filters.action) params.action = filters.action
      if (filters.entity_type) params.entity_type = filters.entity_type
      if (filters.user_id) params.user_id = filters.user_id
      const res = await api.get('/activity/log', { params })
      setActivities(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      // Fallback to demo data when backend is unavailable
      let filtered = DEMO_ACTIVITIES
      if (filters.action) filtered = filtered.filter(a => a.action === filters.action)
      if (filters.entity_type) filtered = filtered.filter(a => a.entity_type === filters.entity_type)
      setActivities(filtered.slice(page * limit, (page + 1) * limit))
      setTotal(filtered.length)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/activity/stats')
      setStats(res.data)
    } catch (err) {
      setStats(DEMO_STATS)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [page, filters])

  useEffect(() => {
    fetchStats()
  }, [])

  const totalPages = Math.ceil(total / limit)

  const getIcon = (action) => ACTION_ICONS[action] || ACTION_ICONS.default
  const getColor = (action) => ACTION_COLORS[action] || ACTION_COLORS.default
  const getLabel = (action) => ACTION_LABELS[action] || action

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Activity Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track all actions across your team
          </p>
        </div>
        <button
          onClick={() => { fetchActivities(); fetchStats() }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.today}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">This Week</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.this_week}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">This Month</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.this_month}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Users</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.active_users}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Filter size={14} />
          <span>Filters:</span>
        </div>
        <select
          value={filters.action}
          onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0) }}
          className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20"
        >
          <option value="">All Actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="create_sale">Create Sale</option>
          <option value="update_inventory">Update Inventory</option>
          <option value="create_product">Add Product</option>
          <option value="update_product">Update Product</option>
          <option value="create_customer">Add Customer</option>
          <option value="update_customer">Update Customer</option>
          <option value="create_invoice">Create Invoice</option>
          <option value="update_invoice">Update Invoice</option>
          <option value="update_profile">Update Profile</option>
          <option value="upload_dataset">Upload Dataset</option>
          <option value="register">Register</option>
        </select>
        <select
          value={filters.entity_type}
          onChange={(e) => { setFilters({ ...filters, entity_type: e.target.value }); setPage(0) }}
          className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20"
        >
          <option value="">All Entities</option>
          <option value="sale">Sales</option>
          <option value="product">Products</option>
          <option value="customer">Customers</option>
          <option value="invoice">Invoices</option>
          <option value="inventory">Inventory</option>
          <option value="profile">Profile</option>
          <option value="dataset">Datasets</option>
        </select>
        {(filters.action || filters.entity_type) && (
          <button
            onClick={() => { setFilters({ action: '', entity_type: '', user_id: '' }); setPage(0) }}
            className="text-xs text-[#2e2b8f] dark:text-indigo-400 font-medium hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Loading...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Activity size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Actions will appear here as your team uses the app</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {activities.map((item) => {
              const Icon = getIcon(item.action)
              const colorClass = getColor(item.action)
              const label = getLabel(item.action)
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${colorClass}`}>
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 shrink-0 mt-1">
                    <Clock size={12} />
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
