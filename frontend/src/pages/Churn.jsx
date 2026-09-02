import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Loading,
  PageHeader,
  EmptyState,
} from '../components/ui.jsx'
import {
  UserMinus,
  Percent,
  Search,
  Filter,
  Sparkles,
  Activity,
  ShoppingBag,
  Target,
  Gauge,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Download,
  X,
  Crown,
  Repeat,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react'

/* ============================================================
   RISK CONFIG -- single source of truth for every risk color
   (previously the dot used orange/yellow/emerald while the badge
   used a separate red/amber/green mapping -- fixed here so the
   dot, badge, bar, and icon for the same risk always match)
   ============================================================ */

const RISK_CONFIG = {
  High: {
    label: 'High',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    text: 'text-orange-600 dark:text-orange-400',
    bar: 'bg-orange-500',
  },
  Medium: {
    label: 'Medium',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
    text: 'text-yellow-600 dark:text-yellow-400',
    bar: 'bg-yellow-500',
  },
  Low: {
    label: 'Low',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
}

/* ============================================================
   CUSTOMER-SPECIFIC RECOMMENDATIONS (unchanged from your version)
   ============================================================ */

function getCustomerRecommendation(customer, index) {
  const risk = customer.risk_category || customer.risk_tier || 'Low'
  const inactiveDays = Number(customer.recency_days ?? customer.metrics?.days_inactive ?? 0)
  const orders = Number(customer.order_count ?? customer.metrics?.total_orders ?? 0)
  const driver = String(customer.primary_driver || '').toLowerCase()
  const name = customer.customer_name || 'This customer'

  const recommendations = {
    High: [
      { title: 'RE-ENGAGEMENT CAMPAIGN', text: `${name} is showing declining engagement. Use personalized product recommendations and a targeted re-engagement campaign.` },
      { title: 'TARGETED INCENTIVE', text: `${name} may be at risk of becoming inactive. Offer a limited-time loyalty incentive to encourage another purchase.` },
      { title: 'PERSONALIZED OUTREACH', text: `${name} has reduced recent activity. Send a personalized message with products related to their previous purchases.` },
      { title: 'WIN-BACK OFFER', text: `${name} appears likely to disengage. Consider a targeted discount or win-back offer based on their purchase history.` },
      { title: 'LOYALTY FOLLOW-UP', text: `${name} needs proactive attention. Follow up with a loyalty benefit and highlight relevant products or services.` },
    ],
    Medium: [
      { title: 'ENGAGEMENT NUDGE', text: `${name} is showing early signs of reduced activity. Send a reminder with relevant products to encourage the next purchase.` },
      { title: 'PRODUCT RECOMMENDATION', text: `${name} has moderate churn risk. Recommend products related to their previous purchases and maintain regular communication.` },
      { title: 'LOYALTY REMINDER', text: `${name} could benefit from a small loyalty incentive to maintain engagement and encourage another order.` },
      { title: 'FOLLOW-UP CAMPAIGN', text: `${name} shows moderate inactivity. Add this customer to a light re-engagement campaign rather than an aggressive win-back campaign.` },
    ],
    Low: [
      { title: 'CUSTOMER RETENTION', text: `${name} currently shows healthy purchasing behaviour. Continue regular communication and maintain the existing relationship.` },
      { title: 'VIP OPPORTUNITY', text: `${name} is a healthy customer. Consider offering early access, loyalty rewards or VIP benefits to strengthen retention.` },
      { title: 'UPSELL OPPORTUNITY', text: `${name} has relatively stable activity. Consider complementary products or an upsell based on their purchase history.` },
      { title: 'LOYALTY BUILDING', text: `${name} has low churn risk. Maintain engagement with personalized offers and occasional loyalty rewards.` },
    ],
  }

  let pool = recommendations[risk] || recommendations.Low
  let recommendationIndex = index % pool.length

  if (inactiveDays >= 90 && risk === 'High') {
    recommendationIndex = 3
  } else if (orders <= 1 && risk !== 'Low') {
    recommendationIndex = 2
  } else if (driver.includes('frequency') && risk === 'Medium') {
    recommendationIndex = 1
  }

  const selected = pool[recommendationIndex]
  return { ...selected, inactiveDays, orders }
}

/* ============================================================
   HELPERS
   ============================================================ */

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0
  const idx = (p / 100) * (sortedArr.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedArr[lo]
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo)
}

function median(sortedArr) {
  return percentile(sortedArr, 50)
}

function initials(name) {
  return String(name || 'C').trim().charAt(0).toUpperCase()
}

function SortHeader({ label, sortKey, sortConfig, onToggle, className = '' }) {
  const active = sortConfig.key === sortKey
  return (
    <th
      className={`py-3.5 pr-5 font-semibold cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${className}`}
      onClick={() => onToggle(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={active ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'} />
      </span>
    </th>
  )
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Churn() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [riskFilter, setRiskFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'churn_probability', direction: 'desc' })
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    let mounted = true
    api
      .get('/ai/churn')
      .then((res) => { if (mounted) setData(res.data) })
      .catch((error) => {
        console.error('Churn prediction error:', error)
        if (mounted) setData(null)
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return <Loading label="Running churn prediction model..." />
  }

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <PageHeader title="Churn Prediction" subtitle="AI-powered customer retention risk analysis." />
        <EmptyState message="Not enough customer history to predict churn yet." />
      </div>
    )
  }

  const rows = Array.isArray(data.rows) ? data.rows : []

  const visibleRows = rows.filter((row) => {
    const category = row.risk_category || row.risk_tier || 'Low'
    return category === 'High' || category === 'Medium' || category === 'Low'
  })

  const highRisk = visibleRows.filter((r) => (r.risk_category || r.risk_tier) === 'High').length
  const mediumRisk = visibleRows.filter((r) => (r.risk_category || r.risk_tier) === 'Medium').length
  const lowRisk = visibleRows.filter((r) => (r.risk_category || r.risk_tier) === 'Low').length
  const totalAttention = highRisk

  const accuracy = data.accuracy ?? data.model_performance?.accuracy ?? null
  const precision = data.precision ?? data.model_performance?.precision ?? null
  const f1 = data.f1 ?? data.model_performance?.f1 ?? null
  const usingHeuristic = accuracy == null

  const totalCustomers = visibleRows.length || 1

  const riskChartData = [
    { label: 'High', value: highRisk, color: RISK_CONFIG.High.bar, textColor: RISK_CONFIG.High.text },
    { label: 'Medium', value: mediumRisk, color: RISK_CONFIG.Medium.bar, textColor: RISK_CONFIG.Medium.text },
    { label: 'Low', value: lowRisk, color: RISK_CONFIG.Low.bar, textColor: RISK_CONFIG.Low.text },
  ]

  const probabilityRanges = [
    { label: '0–20%', min: 0, max: 0.2 },
    { label: '21–40%', min: 0.2, max: 0.4 },
    { label: '41–60%', min: 0.4, max: 0.6 },
    { label: '61–80%', min: 0.6, max: 0.8 },
    { label: '81–100%', min: 0.8, max: 1.01 },
  ].map((range) => ({
    ...range,
    value: visibleRows.filter((row) => {
      const p = Number(row.churn_probability ?? 0)
      return p >= range.min && p < range.max
    }).length,
  }))

  const maxProbabilityRange = Math.max(...probabilityRanges.map((r) => r.value), 1)

  /* -------- NEW: population-relative customer segments -------- */
  const monetaryValues = visibleRows
    .map((r) => Number(r.monetary_total))
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b)
  const monetaryP75 = monetaryValues.length >= 4 ? percentile(monetaryValues, 75) : null

  const orderCounts = visibleRows
    .map((r) => Number(r.order_count ?? 0))
    .sort((a, b) => a - b)
  const frequencyMedian = orderCounts.length ? median(orderCounts) : 1

  function getSegment(row) {
    const monetaryTotal = Number(row.monetary_total)
    const orderCount = Number(row.order_count ?? 0)
    if (orderCount <= 1) return { label: 'New', icon: UserPlus, tone: 'text-sky-500' }
    if (monetaryP75 !== null && monetaryTotal >= monetaryP75 && monetaryP75 > 0) {
      return { label: 'VIP', icon: Crown, tone: 'text-amber-500' }
    }
    if (orderCount >= frequencyMedian && frequencyMedian > 1) {
      return { label: 'Frequent', icon: Repeat, tone: 'text-indigo-500' }
    }
    return null
  }

  function getSpendTrendIcon(row) {
    const trend = row.spend_trend
    if (trend === undefined || trend === null) return null
    if (trend < 0.85) return { Icon: TrendingDown, tone: 'text-red-500', label: 'Spending down' }
    if (trend > 1.15) return { Icon: TrendingUp, tone: 'text-emerald-500', label: 'Spending up' }
    return { Icon: Minus, tone: 'text-slate-400', label: 'Spending steady' }
  }

  /* -------- search + risk filter -------- */
  const filteredRows = visibleRows.filter((row) => {
    const category = row.risk_category || row.risk_tier || 'Low'
    const customerName = String(row.customer_name || '').toLowerCase()
    const searchValue = search.trim().toLowerCase()
    const matchesRisk = riskFilter === 'All' || category === riskFilter
    const matchesSearch = searchValue === '' || customerName.includes(searchValue)
    return matchesRisk && matchesSearch
  })

  /* -------- NEW: sorting -------- */
  const RISK_ORDER = { High: 3, Medium: 2, Low: 1 }
  function sortValue(row, key) {
    if (key === 'risk_category') return RISK_ORDER[row.risk_category || row.risk_tier || 'Low']
    if (key === 'churn_probability') return Number(row.churn_probability ?? 0)
    if (key === 'recency_days') return Number(row.recency_days ?? row.metrics?.days_inactive ?? 0)
    if (key === 'order_count') return Number(row.order_count ?? row.metrics?.total_orders ?? 0)
    return 0
  }
  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = sortValue(a, sortConfig.key)
    const bv = sortValue(b, sortConfig.key)
    return sortConfig.direction === 'asc' ? av - bv : bv - av
  })

  function toggleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    )
  }



  /* -------- NEW: CSV export -------- */
  function exportCSV() {
    const header = ['Customer', 'Risk', 'Probability (%)', 'Inactive (days)', 'Orders', 'Recommendation']
    const lines = sortedRows.map((row, index) => {
      const rec = getCustomerRecommendation(row, index)
      const probability = Math.round(Number(row.churn_probability || 0) * 100)
      const inactiveDays = Number(row.recency_days ?? row.metrics?.days_inactive ?? 0)
      const orderCount = Number(row.order_count ?? row.metrics?.total_orders ?? 0)
      const category = row.risk_category || row.risk_tier || 'Low'
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
      return [escape(row.customer_name), category, probability, inactiveDays, orderCount, escape(rec.text)].join(',')
    })
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `churn-risk-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyRecommendation(id, text) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <PageHeader
        title="Churn Prediction"
        subtitle="AI-powered customer retention risk analysis using purchase inactivity and engagement signals."
      />

      {/* ===================== KPI CARDS ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">High-Risk Customers</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalAttention}</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Needs attention now</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
              <UserMinus size={21} className="text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Model Accuracy</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {accuracy != null ? `${(Number(accuracy) * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Cross-validated</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <Percent size={21} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Precision</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {precision != null ? Number(precision).toFixed(3) : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Positive prediction quality</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
              <Target size={21} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          {precision != null && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(Number(precision) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">F1 Score</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {f1 != null ? Number(f1).toFixed(3) : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Precision + recall balance</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
              <Gauge size={21} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          {f1 != null && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(Number(f1) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      
      {/* ===================== RISK DISTRIBUTION + PROBABILITY HISTOGRAM (unchanged) ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                <BarChart3 size={19} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Risk Distribution</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customer distribution by churn risk</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{visibleRows.length} customers</span>
          </div>
          <div className="space-y-5">
            {riskChartData.map((item) => {
              const percentage = (item.value / totalCustomers) * 100
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label} Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${item.textColor}`}>{item.value}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">({percentage.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20 transition-colors duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <TrendingUp size={19} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Churn Probability</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customers grouped by predicted probability</p>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 h-48 pt-4">
            {probabilityRanges.map((item) => {
              const height = item.value === 0 ? 4 : Math.max((item.value / maxProbabilityRange) * 100, 8)
              return (
                <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{item.value}</span>
                  <div className="w-full max-w-[55px] rounded-t-lg bg-indigo-500 dark:bg-indigo-500 transition-all duration-500" style={{ height: `${height}%` }} />
                  <span className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Lower ranges indicate healthier customers, while higher ranges represent greater churn risk.
            </p>
          </div>
        </div>
      </div>

      {usingHeuristic && (
        <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 shadow-sm">
          <div className="flex items-start gap-3">
            <Activity size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Behaviour-based prediction</p>
              <p className="text-xs leading-5 opacity-90">
                Not enough historical data is available to train the model reliably yet. The current results
                use each customer's purchase inactivity and buying cadence.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MAIN CUSTOMER TABLE ===================== */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-black/20 transition-colors duration-300">

        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                <UserMinus size={19} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Customer Churn Risk</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing {filteredRows.length} of {visibleRows.length} customers
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full xl:w-auto">
              {/* Search with clear button */}
              <div className="relative w-full sm:w-64">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 pr-9 py-2.5 text-sm outline-none transition-all focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Risk filter */}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1">
                <div className="flex items-center justify-center px-2 text-slate-400 dark:text-slate-500">
                  <Filter size={14} />
                </div>
                {['All', 'High', 'Medium', 'Low'].map((level) => {
                  const count = level === 'All' ? visibleRows.length : level === 'High' ? highRisk : level === 'Medium' ? mediumRisk : lowRisk
                  const active = riskFilter === level
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setRiskFilter(level)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        active
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/60 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {level}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* NEW: export button */}
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Risk summary mini-cards (unchanged) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
          {(['High', 'Medium', 'Low']).map((level) => {
            const config = RISK_CONFIG[level]
            const value = level === 'High' ? highRisk : level === 'Medium' ? mediumRisk : lowRisk
            return (
              <div key={level} className={`rounded-xl border p-4 ${config.badge} bg-opacity-50`} style={{ borderColor: 'currentColor', opacity: 1 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-medium ${config.text}`}>{level} Risk</p>
                    <p className={`mt-1 text-2xl font-bold ${config.text}`}>{value}</p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${config.dot} shadow-lg`} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-5 font-semibold">Customer</th>
                <SortHeader label="Risk" sortKey="risk_category" sortConfig={sortConfig} onToggle={toggleSort} />
                <SortHeader label="Probability" sortKey="churn_probability" sortConfig={sortConfig} onToggle={toggleSort} />
                <SortHeader label="Inactive" sortKey="recency_days" sortConfig={sortConfig} onToggle={toggleSort} />
                <SortHeader label="Orders" sortKey="order_count" sortConfig={sortConfig} onToggle={toggleSort} />
                <th className="py-3.5 pr-5 font-semibold min-w-[380px]">AI Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={28} />
                      <p className="font-medium">No customers found</p>
                      <p className="text-xs">Try changing your search or risk filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, index) => {
                  const category = row.risk_category || row.risk_tier || 'Low'
                  const config = RISK_CONFIG[category] || RISK_CONFIG.Low
                  const probability = Number(row.churn_probability || 0)
                  const percentage = Math.round(probability * 100)
                  const inactiveDays = Number(row.recency_days ?? row.metrics?.days_inactive ?? 0)
                  const orderCount = Number(row.order_count ?? row.metrics?.total_orders ?? 0)
                  const recommendation = getCustomerRecommendation(row, index)
                  const segment = getSegment(row)
                  const trend = getSpendTrendIcon(row)
                  const recId = row.customer_id ?? `${row.customer_name}-${index}`

                  return (
                    <tr key={recId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Customer + segment badge */}
                      <td className="py-5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {initials(row.customer_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-800 dark:text-slate-100">{row.customer_name}</p>
                              {segment && (
                                <span title={segment.label} className={segment.tone}>
                                  <segment.icon size={13} />
                                </span>
                              )}
                            </div>
                            {segment && (
                              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{segment.label} customer</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Risk -- dot + badge now share the same RISK_CONFIG colors */}
                      <td className="py-5 pr-5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
                            {category}
                          </span>
                        </div>
                      </td>

                      {/* Probability */}
                      <td className="py-5 pr-5 min-w-[130px]">
                        <div className="space-y-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{percentage}%</span>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${config.bar}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                          </div>
                        </div>
                      </td>

                      {/* Inactive + spend trend */}
                      <td className="py-5 pr-5">
                        <div className="flex items-center gap-2">
                          <Activity size={15} className={config.text} />
                          <span className={`font-medium ${config.text}`}>{inactiveDays} days</span>
                          {trend && (
                            <span title={trend.label} className={trend.tone}>
                              <trend.Icon size={13} />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="py-5 pr-5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                            <ShoppingBag size={14} className="text-slate-500 dark:text-slate-400" />
                          </div>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {orderCount}
                          </span>
                        </div>
                      </td>

                      {/* Recommendation + copy button */}
                      <td className="py-5 pr-5">
                        <div className="max-w-xl rounded-xl border border-indigo-100 dark:border-indigo-500/15 bg-indigo-50/50 dark:bg-indigo-500/5 px-4 py-3 relative group">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <Sparkles size={15} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                              <span className="text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                                {recommendation.title}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyRecommendation(recId, recommendation.text)}
                              className="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy recommendation"
                            >
                              {copiedId === recId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{recommendation.text}</p>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}