import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../services/api'
import { StatCard, Loading, PageHeader } from '../components/ui.jsx'
import { IndianRupee, ShoppingCart, Users, Boxes, AlertTriangle, FileWarning, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

/* ------------------------------------------------------------------ */
/* Business Pulse — a single health score + plain-language briefing,   */
/* derived client-side from the same KPI data the rest of the          */
/* dashboard already fetches. No new backend endpoint required yet —   */
/* once a dedicated /analytics/pulse endpoint exists, swap this out    */
/* for the server-computed version (it'll be more accurate over time). */
/* ------------------------------------------------------------------ */
const PULSE_TONE_CLASSES = {
  green: {
    ring: '#16a34a',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    dot: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    ring: '#d97706',
    badgeBg: 'bg-amber-100 dark:bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-400',
    dot: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    ring: '#dc2626',
    badgeBg: 'bg-red-100 dark:bg-red-500/15',
    badgeText: 'text-red-700 dark:text-red-400',
    dot: 'text-red-600 dark:text-red-400',
  },
}

function computeBusinessPulse(kpis) {
  if (!kpis) return null

  // Revenue trend: compare the first half of the visible window to the second half.
  const days = kpis.revenue_by_day || []
  let revenueGrowthPct = 0
  if (days.length >= 4) {
    const mid = Math.floor(days.length / 2)
    const firstHalf = days.slice(0, mid).reduce((s, d) => s + (d.revenue || 0), 0)
    const secondHalf = days.slice(mid).reduce((s, d) => s + (d.revenue || 0), 0)
    if (firstHalf > 0) revenueGrowthPct = ((secondHalf - firstHalf) / firstHalf) * 100
  }
  const revenueScore = Math.max(0, Math.min(100, 50 + revenueGrowthPct * 1.5))

  // Inventory health: share of products currently at/under reorder threshold.
  const totalProducts = kpis.total_products || 0
  const lowStockRatio = totalProducts > 0 ? kpis.low_stock_count / totalProducts : 0
  const inventoryScore = Math.max(0, 100 - lowStockRatio * 160)

  // Invoice collection: share of open invoices that are overdue rather than just pending.
  const totalOpenInvoices = (kpis.pending_invoices || 0) + (kpis.overdue_invoices || 0)
  const overdueRatio = totalOpenInvoices > 0 ? kpis.overdue_invoices / totalOpenInvoices : 0
  const invoiceScore = Math.max(0, 100 - overdueRatio * 130)

  const score = Math.round(revenueScore * 0.4 + inventoryScore * 0.3 + invoiceScore * 0.3)

  let band = 'Needs attention'
  let tone = 'red'
  if (score >= 75) {
    band = 'Good'
    tone = 'green'
  } else if (score >= 50) {
    band = 'Fair'
    tone = 'amber'
  }

  const bullets = []

  if (revenueGrowthPct > 3) {
    bullets.push({ tone: 'green', text: `Revenue is trending up ${revenueGrowthPct.toFixed(0)}% over this period.` })
  } else if (revenueGrowthPct < -3) {
    bullets.push({ tone: 'red', text: `Revenue has dipped ${Math.abs(revenueGrowthPct).toFixed(0)}% over this period.` })
  } else {
    bullets.push({ tone: 'amber', text: 'Revenue is holding roughly steady over this period.' })
  }

  const topProduct = kpis.top_products?.[0]
  if (topProduct) {
    bullets.push({ tone: 'green', text: `${topProduct.product} is your strongest seller by revenue right now.` })
  }

  if (kpis.low_stock_count > 0) {
    bullets.push({
      tone: 'amber',
      text: `${kpis.low_stock_count} product${kpis.low_stock_count > 1 ? 's are' : ' is'} running low on stock — check Inventory.`,
    })
  }

  if (kpis.overdue_invoices > 0) {
    bullets.push({
      tone: 'red',
      text: `${kpis.overdue_invoices} invoice${kpis.overdue_invoices > 1 ? 's are' : ' is'} overdue and need${
        kpis.overdue_invoices > 1 ? '' : 's'
      } follow-up.`,
    })
  }

  if (bullets.length < 2) {
    bullets.push({ tone: 'amber', text: 'Not enough activity yet for a fuller picture — check back after a few more sales.' })
  }

  return { score, band, tone, bullets: bullets.slice(0, 4) }
}

function BusinessPulseCard({ kpis }) {
  const [serverPulse, setServerPulse] = useState(undefined) // undefined = not tried yet, null = failed/unavailable

  useEffect(() => {
    api
      .get('/analytics/pulse')
      .then((res) => setServerPulse(res.data))
      .catch(() => setServerPulse(null)) // endpoint not deployed yet, or errored — fall back below
  }, [])

  // Prefer the real backend-computed score (has an actual trend delta and can't be
  // spoofed client-side) once it's live; fall back to the client-side estimate
  // from computeBusinessPulse() until then, so this keeps working either way.
  const pulse = serverPulse || computeBusinessPulse(kpis)
  if (!pulse) return null

  const { score, band, tone, bullets, delta } = pulse
  const colors = PULSE_TONE_CLASSES[tone]
  const circumference = 2 * Math.PI * 46
  const dashOffset = circumference * (1 - score / 100)

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 md:p-7 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 transition-colors">
      <div className="relative w-28 h-28 shrink-0">
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r="46" fill="none" stroke="currentColor" strokeWidth="10" className="text-indigo-100 dark:text-slate-800" />
          <circle
            cx="56"
            cy="56"
            r="46"
            fill="none"
            stroke={colors.ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 56 56)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{score}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">/ 100</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
          <Sparkles size={16} className="text-indigo-500 dark:text-indigo-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Business Pulse</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colors.badgeBg} ${colors.badgeText}`}>{band}</span>
          {typeof delta === 'number' && (
            <span className={`text-xs font-medium ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts vs last check
            </span>
          )}
        </div>

        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2 justify-center sm:justify-start">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PULSE_TONE_CLASSES[b.tone].dot} bg-current`} />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(30) // 7 | 14 | 30 days filter

  useEffect(() => {
    api.get('/analytics/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Loading dashboard..." />
  if (!kpis) return null

  const filteredRevenueTrend = (kpis.revenue_by_day || []).slice(-trendDays)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || ''}`}
        subtitle="Here's how your business is performing today."
      />

      <BusinessPulseCard kpis={kpis} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Total Sales" value={kpis.total_sales.toLocaleString('en-IN')} icon={ShoppingCart} tone="brand" />
        <StatCard label="Customers" value={kpis.total_customers} icon={Users} tone="brand" />
        <StatCard label="Products" value={kpis.total_products} icon={Boxes} tone="brand" />
        <StatCard label="Low Stock Items" value={kpis.low_stock_count} icon={AlertTriangle} tone="amber" />
        <StatCard label="Overdue Invoices" value={kpis.overdue_invoices} sub={`${kpis.pending_invoices} pending`} icon={FileWarning} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue Trend</h3>
            
            {/* Timeframe Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3b5bdb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#3b5bdb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}