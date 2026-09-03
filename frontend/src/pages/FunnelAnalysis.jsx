import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { Loading, PageHeader } from '../components/ui.jsx'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'
import {
  Download, TrendingDown, Users, ShoppingCart, ArrowDown, Eye, Clock,
  Repeat, Star, Crown, Filter, ChevronDown, BarChart3, Target, Zap,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area, Legend,
} from 'recharts'

// ─── Time Range Options ───────────────────────────────────────────────
const TIME_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: '1y', label: 'Last Year' },
]

// ─── Segment Options ──────────────────────────────────────────────────
const SEGMENTS = [
  { key: 'all', label: 'All Customers', icon: Users },
  { key: 'region', label: 'By Region', icon: Filter },
  { key: 'category', label: 'By Product Category', icon: ShoppingCart },
]

// ─── Funnel Stage Card ────────────────────────────────────────────────
function FunnelStageCard({ stage, index, total, maxCount }) {
  const width = Math.max(15, (stage.count / maxCount) * 100)
  const convRate = total > 0 ? ((stage.count / total) * 100).toFixed(1) : 0
  const Icon = stage.icon
  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        {/* Stage Number */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${stage.color}20` }}>
          <span className="text-sm font-bold" style={{ color: stage.color }}>{index + 1}</span>
        </div>

        <div className="flex-1">
          {/* Stage Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color: stage.color }} />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{stage.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{stage.count.toLocaleString()}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                {convRate}%
              </span>
            </div>
          </div>

          {/* Visual Bar */}
          <div className="relative h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <div className="absolute inset-0 rounded-lg transition-all duration-700" style={{ backgroundColor: stage.color, opacity: 0.15, width: `${width}%` }} />
            <div className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700" style={{ backgroundColor: stage.color, opacity: 0.7, width: `${width}%` }} />
            <div className="absolute inset-0 flex items-center px-3">
              <span className="text-[10px] font-bold text-white drop-shadow">{stage.count.toLocaleString()} customers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drop-off indicator */}
      {index > 0 && stage.dropoff > 0 && (
        <div className="flex items-center gap-2 ml-14 mt-1.5 mb-1">
          <TrendingDown size={10} className="text-red-400" />
          <span className="text-[10px] text-red-500 font-medium">
            -{stage.dropoff.toLocaleString()} ({stage.dropoffPct}% drop-off)
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Segment Comparison Bar ───────────────────────────────────────────
function SegmentBar({ segment, total }) {
  const rate = total > 0 ? ((segment.value / total) * 100).toFixed(1) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 dark:text-slate-400 w-32 shrink-0 truncate">{segment.label}</span>
      <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, backgroundColor: segment.color }} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 text-right">{segment.value.toLocaleString()} ({rate}%)</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
export default function FunnelAnalysis() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [timeRange, setTimeRange] = useState('all')
  const [segment, setSegment] = useState('all')
  const [showSegmentBreakdown, setShowSegmentBreakdown] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      api.get('/customers/').catch(() => ({ data: [] })),
      api.get('/sales/').catch(() => ({ data: [] })),
      api.get('/inventory/products').catch(() => ({ data: [] })),
    ]).then(([c, s, p]) => {
      setCustomers(c.data)
      setSales(s.data)
      setProducts(p.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Filter sales by time range
  const filteredSales = useMemo(() => {
    if (timeRange === 'all') return sales
    const now = new Date()
    const daysMap = { '30d': 30, '90d': 90, '1y': 365 }
    const cutoff = new Date(now - (daysMap[timeRange] || 365) * 24 * 60 * 60 * 1000)
    return sales.filter(s => new Date(s.sale_date) >= cutoff)
  }, [sales, timeRange])

  // Main funnel computation
  const funnel = useMemo(() => {
    const totalCustomers = customers.length
    const customersWithOrders = customers.filter(c => filteredSales.some(s => s.customer_id === c.id)).length
    const repeatBuyers = customers.filter(c => filteredSales.filter(s => s.customer_id === c.id).length >= 2).length
    const highValue = customers.filter(c => {
      const total = filteredSales.filter(s => s.customer_id === c.id).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      return total >= 5000
    }).length
    const vipCustomers = customers.filter(c => {
      const total = filteredSales.filter(s => s.customer_id === c.id).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      return total >= 10000
    }).length
    const loyalCustomers = customers.filter(c => {
      const orderCount = filteredSales.filter(s => s.customer_id === c.id).length
      return orderCount >= 5
    }).length
    const promoters = customers.filter(c => {
      const total = filteredSales.filter(s => s.customer_id === c.id).reduce((sum, s) => sum + (s.total_amount || 0), 0)
      return total >= 2000 && filteredSales.filter(s => s.customer_id === c.id).length >= 3
    }).length

    const stages = [
      { key: 'visitors', label: 'Total Visitors', count: totalCustomers, color: '#6366f1', icon: Users },
      { key: 'first_purchase', label: 'First Purchase', count: customersWithOrders, color: '#8b5cf6', icon: ShoppingCart },
      { key: 'repeat', label: 'Repeat Buyers (2+ orders)', count: repeatBuyers, color: '#a855f7', icon: Repeat },
      { key: 'engaged', label: 'Engaged Customers (3+ orders)', count: loyalCustomers, color: '#ec4899', icon: Star },
      { key: 'high_value', label: 'High Value (₹5000+)', count: highValue, color: '#d946ef', icon: Crown },
      { key: 'vip', label: 'VIP (₹10000+)', count: vipCustomers, color: '#f59e0b', icon: Zap },
      { key: 'promoter', label: 'Brand Promoters', count: promoters, color: '#10b981', icon: Target },
    ]

    // Calculate drop-offs
    return stages.map((s, i) => ({
      ...s,
      dropoff: i > 0 ? stages[i - 1].count - s.count : 0,
      dropoffPct: i > 0 && stages[i - 1].count > 0 ? (((stages[i - 1].count - s.count) / stages[i - 1].count) * 100).toFixed(1) : 0,
    }))
  }, [customers, filteredSales])

  const maxCount = funnel[0]?.count || 1
  const totalCustomers = funnel[0]?.count || 1

  // Conversion metrics
  const conversionMetrics = useMemo(() => {
    return funnel.slice(1).map((stage, i) => ({
      from: funnel[i].label,
      to: stage.label,
      rate: ((stage.count / (funnel[i].count || 1)) * 100).toFixed(1),
      overall: ((stage.count / totalCustomers) * 100).toFixed(1),
      dropoff: funnel[i].count - stage.count,
      color: stage.color,
    }))
  }, [funnel, totalCustomers])

  // Segment breakdown
  const segmentBreakdown = useMemo(() => {
    if (segment === 'all') return null

    if (segment === 'region') {
      const regionMap = {}
      customers.forEach(c => {
        const region = c.region || 'Unknown'
        if (!regionMap[region]) regionMap[region] = { total: 0, purchased: 0, repeat: 0, highValue: 0 }
        regionMap[region].total++
        const cSales = filteredSales.filter(s => s.customer_id === c.id)
        if (cSales.length > 0) regionMap[region].purchased++
        if (cSales.length >= 2) regionMap[region].repeat++
        const total = cSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        if (total >= 5000) regionMap[region].highValue++
      })
      const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
      return Object.entries(regionMap).map(([label, data], i) => ({
        label, value: data.purchased, total: data.total,
        repeat: data.repeat, highValue: data.highValue,
        color: COLORS[i % COLORS.length],
      })).sort((a, b) => b.value - a.value)
    }

    if (segment === 'category') {
      const catMap = {}
      filteredSales.forEach(s => {
        const prod = products.find(p => p.id === s.product_id)
        const cat = prod?.category || 'Other'
        if (!catMap[cat]) catMap[cat] = { revenue: 0, count: 0 }
        catMap[cat].revenue += (s.total_amount || 0)
        catMap[cat].count++
      })
      const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
      return Object.entries(catMap).map(([label, data], i) => ({
        label, value: data.count, total: data.count,
        revenue: data.revenue, color: COLORS[i % COLORS.length],
      })).sort((a, b) => b.value - a.value)
    }

    return null
  }, [segment, customers, filteredSales, products])

  // Conversion trend data (simulated for demo)
  const trendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return months.map((m, i) => ({
      month: m,
      visitorToPurchase: Math.round(30 + Math.random() * 15),
      purchaseToRepeat: Math.round(25 + Math.random() * 10),
      repeatToHighValue: Math.round(20 + Math.random() * 15),
    }))
  }, [])

  const handleExportPDF = () => {
    const headers = ['Stage', 'Count', 'Conversion Rate', 'Drop-off']
    const rows = funnel.map(f => [f.label, f.count, `${((f.count / totalCustomers) * 100).toFixed(1)}%`, f.dropoff > 0 ? `-${f.dropoff} (${f.dropoffPct}%)` : '—'])
    exportToPDF({ title: 'Funnel Analysis Report', subtitle: 'Customer Journey Conversion', headers, rows, filename: 'funnel-analysis' })
  }

  const handleExportExcel = () => {
    const headers = ['Stage', 'Count', 'Conversion Rate', 'Drop-off']
    const rows = funnel.map(f => [f.label, f.count, `${((f.count / totalCustomers) * 100).toFixed(1)}%`, f.dropoff > 0 ? `-${f.dropoff} (${f.dropoffPct}%)` : '—'])
    exportToExcel({ title: 'Funnel Analysis Report', headers, rows, filename: 'funnel-analysis' })
  }

  if (loading) return <Loading label="Analyzing customer funnel..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Funnel Analysis"
        subtitle="Track customer journey, conversion rates, and drop-off points"
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <Download size={14} /> PDF
            </button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Download size={14} /> Excel
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time Range */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {TIME_RANGES.map(tr => (
            <button key={tr.key} onClick={() => setTimeRange(tr.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${timeRange === tr.key ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {tr.label}
            </button>
          ))}
        </div>

        {/* Segment */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {SEGMENTS.map(seg => {
            const Icon = seg.icon
            return (
              <button key={seg.key} onClick={() => { setSegment(seg.key); setShowSegmentBreakdown(seg.key !== 'all') }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${segment === seg.key ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Icon size={12} /> {seg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center p-4">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalCustomers.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 uppercase mt-1">Total Visitors</p>
        </div>
        <div className="card text-center p-4">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{funnel[1]?.count?.toLocaleString() || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase mt-1">Converted</p>
        </div>
        <div className="card text-center p-4">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalCustomers > 0 ? ((funnel[1]?.count || 0) / totalCustomers * 100).toFixed(1) : 0}%</p>
          <p className="text-[10px] text-slate-500 uppercase mt-1">Conversion Rate</p>
        </div>
        <div className="card text-center p-4">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{funnel[4]?.count?.toLocaleString() || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase mt-1">High Value</p>
        </div>
      </div>

      {/* Main Visual Funnel */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" />
            Customer Journey Funnel
          </h3>
          <span className="text-[10px] text-slate-400">{TIME_RANGES.find(tr => tr.key === timeRange)?.label}</span>
        </div>

        <div className="space-y-4">
          {funnel.map((stage, i) => (
            <FunnelStageCard key={stage.key} stage={stage} index={i} total={totalCustomers} maxCount={maxCount} />
          ))}
        </div>
      </div>

      {/* Conversion Metrics Cards */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
          <Target size={14} /> Stage-to-Stage Conversion
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {conversionMetrics.map((m, i) => (
            <div key={i} className="card text-center p-3">
              <p className="text-xl font-bold" style={{ color: m.color }}>{m.rate}%</p>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1 leading-tight">
                {m.from.split('(')[0].trim().split(' ').slice(0, 2).join(' ')} →<br />
                {m.to.split('(')[0].trim().split(' ').slice(0, 2).join(' ')}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">{m.dropoff.toLocaleString()} dropped</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Trend Chart */}
      <div className="card">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" />
          Conversion Trend (6 months)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={v => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Area type="monotone" dataKey="visitorToPurchase" name="Visit → Purchase" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="purchaseToRepeat" name="Purchase → Repeat" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="repeatToHighValue" name="Repeat → High Value" stroke="#d946ef" fill="#d946ef" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment Breakdown */}
      {showSegmentBreakdown && segmentBreakdown && segmentBreakdown.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Filter size={16} className="text-indigo-500" />
            {segment === 'region' ? 'Funnel by Region' : 'Funnel by Category'}
          </h3>
          <div className="space-y-3">
            {segmentBreakdown.map((seg, i) => (
              <SegmentBar key={i} segment={seg} total={customers.length} />
            ))}
          </div>

          {/* Segment Comparison Chart */}
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentBreakdown.map(s => ({ name: s.label, converted: s.value, total: s.total }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="converted" name="Purchased" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
