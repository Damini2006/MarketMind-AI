import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { StatCard, Loading } from '../ui.jsx'
import DetailModal from '../DetailModal.jsx'
import { IndianRupee, ShoppingCart, Users, Boxes, AlertTriangle, FileWarning, Activity, Clock, ChevronRight } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'
import BusinessPulse from '../BusinessPulse.jsx'

export default function OwnerDashboard({ user }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(30)
  const [kpiModal, setKpiModal] = useState(null)

  useEffect(() => {
    api.get('/analytics/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!kpis) return null

  const filteredRevenueTrend = (kpis.revenue_by_day || []).slice(-trendDays)

  return (
    <div className="space-y-6">
      {/* Business Pulse */}
      <div data-tour="business-pulse"><BusinessPulse kpis={kpis} /></div>

      {/* KPI Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ClickableKPI label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" onClick={() => setKpiModal('revenue')} />
        <ClickableKPI label="Total Sales" value={kpis.total_sales.toLocaleString('en-IN')} icon={ShoppingCart} tone="brand" onClick={() => setKpiModal('sales')} />
        <ClickableKPI label="Customers" value={kpis.total_customers} icon={Users} tone="brand" onClick={() => setKpiModal('customers')} />
        <ClickableKPI label="Products" value={kpis.total_products} icon={Boxes} tone="brand" onClick={() => setKpiModal('products')} />
        <ClickableKPI label="Low Stock Items" value={kpis.low_stock_count} icon={AlertTriangle} tone="amber" onClick={() => setKpiModal('lowstock')} />
        <ClickableKPI label="Overdue Invoices" value={kpis.overdue_invoices} sub={`${kpis.pending_invoices} pending`} icon={FileWarning} tone="red" onClick={() => setKpiModal('invoices')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-tour="revenue-chart" className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue Trend</h3>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTrendDays(days)}
                  className={`px-2 py-1 rounded-md transition-all ${
                    trendDays === days ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredRevenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Line type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 dark:text-slate-100">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Bar dataKey="revenue" fill="#d97706" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityWidget />

      {/* KPI Detail Modals */}
      <DetailModal open={kpiModal === 'revenue'} onClose={() => setKpiModal(null)} title="Revenue Breakdown" subtitle="Detailed revenue analysis">
        <div className="space-y-1">
          <DetailModal.Row label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
          <DetailModal.Row label="Total Sales" value={kpis.total_sales} icon={ShoppingCart} />
          <DetailModal.Row label="Avg. Sale Value" value={`₹${kpis.total_sales > 0 ? Math.round(kpis.total_revenue / kpis.total_sales).toLocaleString('en-IN') : 0}`} />
          <DetailModal.Row label="Top Product" value={kpis.top_products?.[0]?.product || '—'} />
          <DetailModal.Row label="Top Product Revenue" value={`₹${(kpis.top_products?.[0]?.revenue || 0).toLocaleString('en-IN')}`} />
          <DetailModal.Section title="Revenue by Day (Last 7)">
            {(kpis.revenue_by_day || []).slice(-7).map((d, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">{d.date}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">₹{(d.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </DetailModal.Section>
        </div>
      </DetailModal>

      <DetailModal open={kpiModal === 'sales'} onClose={() => setKpiModal(null)} title="Sales Breakdown" subtitle="Transaction summary">
        <div className="space-y-1">
          <DetailModal.Row label="Total Sales" value={kpis.total_sales} icon={ShoppingCart} tone="brand" />
          <DetailModal.Row label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} />
          <DetailModal.Row label="Avg. Sale Value" value={`₹${kpis.total_sales > 0 ? Math.round(kpis.total_revenue / kpis.total_sales).toLocaleString('en-IN') : 0}`} />
          <DetailModal.Row label="Products Sold" value={kpis.total_products} icon={Boxes} />
          <DetailModal.Section title="Top Products">
            {(kpis.top_products || []).slice(0, 5).map((p, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">#{i + 1} {p.product}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">₹{(p.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </DetailModal.Section>
        </div>
      </DetailModal>

      <DetailModal open={kpiModal === 'customers'} onClose={() => setKpiModal(null)} title="Customer Overview" subtitle="Customer metrics">
        <div className="space-y-1">
          <DetailModal.Row label="Total Customers" value={kpis.total_customers} icon={Users} tone="brand" />
          <DetailModal.Row label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} />
          <DetailModal.Row label="Revenue per Customer" value={`₹${kpis.total_customers > 0 ? Math.round(kpis.total_revenue / kpis.total_customers).toLocaleString('en-IN') : 0}`} />
        </div>
      </DetailModal>

      <DetailModal open={kpiModal === 'products'} onClose={() => setKpiModal(null)} title="Product Overview" subtitle="Inventory metrics">
        <div className="space-y-1">
          <DetailModal.Row label="Total Products" value={kpis.total_products} icon={Boxes} tone="brand" />
          <DetailModal.Row label="Low Stock Items" value={kpis.low_stock_count} icon={AlertTriangle} tone={kpis.low_stock_count > 0 ? 'amber' : 'green'} />
          <DetailModal.Row label="In Stock" value={kpis.total_products - kpis.low_stock_count} tone="green" />
          <DetailModal.Row label="Stock Health" value={`${kpis.total_products > 0 ? Math.round(((kpis.total_products - kpis.low_stock_count) / kpis.total_products) * 100) : 100}%`} />
        </div>
      </DetailModal>

      <DetailModal open={kpiModal === 'lowstock'} onClose={() => setKpiModal(null)} title="Low Stock Alert" subtitle="Items below reorder level">
        <div className="space-y-1">
          <DetailModal.Row label="Low Stock Items" value={kpis.low_stock_count} icon={AlertTriangle} tone="amber" />
          <DetailModal.Row label="Total Products" value={kpis.total_products} icon={Boxes} />
          <DetailModal.Row label="Stock Health" value={`${kpis.total_products > 0 ? Math.round(((kpis.total_products - kpis.low_stock_count) / kpis.total_products) * 100) : 100}%`} tone={kpis.low_stock_count > 0 ? 'amber' : 'green'} />
          <DetailModal.Section title="Action Required">
            <p className="text-sm text-slate-600 dark:text-slate-300">{kpis.low_stock_count} product{kpis.low_stock_count !== 1 ? 's' : ''} need{kpis.low_stock_count === 1 ? 's' : ''} restocking. Go to Inventory to view details and adjust stock levels.</p>
          </DetailModal.Section>
        </div>
      </DetailModal>

      <DetailModal open={kpiModal === 'invoices'} onClose={() => setKpiModal(null)} title="Invoice Status" subtitle="Payment tracking">
        <div className="space-y-1">
          <DetailModal.Row label="Overdue Invoices" value={kpis.overdue_invoices} icon={FileWarning} tone="red" />
          <DetailModal.Row label="Pending Invoices" value={kpis.pending_invoices} icon={FileWarning} tone="amber" />
          <DetailModal.Row label="Total Open" value={kpis.overdue_invoices + kpis.pending_invoices} />
          <DetailModal.Row label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} />
          <DetailModal.Section title="Action Required">
            <p className="text-sm text-slate-600 dark:text-slate-300">{kpis.overdue_invoices} invoice{kpis.overdue_invoices !== 1 ? 's' : ''} overdue. Go to Invoices to follow up with customers.</p>
          </DetailModal.Section>
        </div>
      </DetailModal>
    </div>
  )
}

function ClickableKPI({ label, value, sub, icon: Icon, tone, onClick }) {
  const toneClasses = {
    brand: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  }
  return (
    <button
      onClick={onClick}
      className="card flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 text-left w-full"
    >
      {Icon && (
        <div className={`p-3 rounded-lg ${toneClasses[tone] || toneClasses.brand}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700/60 rounded-lg ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Business Pulse skeleton */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
          <SkeletonBlock className="h-16 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="card flex items-center gap-4">
            <SkeletonBlock className="h-11 w-11 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <SkeletonBlock className="h-7 w-20" />
              <SkeletonBlock className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <SkeletonBlock className="h-5 w-36 mb-4" />
          <SkeletonBlock className="h-[280px] w-full rounded-xl" />
        </div>
        <div className="card">
          <SkeletonBlock className="h-5 w-40 mb-4" />
          <SkeletonBlock className="h-[280px] w-full rounded-xl" />
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="card">
        <SkeletonBlock className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-2.5">
              <SkeletonBlock className="h-2 w-2 rounded-full shrink-0" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecentActivityWidget() {
  const [items, setItems] = useState([])
  useEffect(() => {
    api.get('/activity/recent', { params: { limit: 8 } })
      .then((res) => setItems(res.data.items))
      .catch(() => {})
  }, [])

  if (!items.length) return null

  const timeAgo = (d) => {
    if (!d) return ''
    const diff = (Date.now() - new Date(d).getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Activity size={16} className="text-amber-600 dark:text-amber-400" />
          Recent Activity
        </h3>
        <Link to="/activity" className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline flex items-center gap-1">
          View all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            <p className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
              <span className="font-medium">{item.user_name}</span>
              <span className="text-slate-500 dark:text-slate-400"> {item.description.toLowerCase()} </span>
            </p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1">
              <Clock size={10} />
              {timeAgo(item.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
