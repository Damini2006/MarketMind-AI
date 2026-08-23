import { useState, useEffect } from 'react'
import api from '../services/api'
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const BAND_COLORS = {
  good: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', ring: 'text-emerald-500' },
  fair: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', ring: 'text-amber-500' },
  needs_attention: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', ring: 'text-red-500' },
}

function getBand(score) {
  if (score >= 70) return 'good'
  if (score >= 40) return 'fair'
  return 'needs_attention'
}

function getBandLabel(band) {
  return band === 'good' ? 'Good' : band === 'fair' ? 'Fair' : 'Needs Attention'
}

function computeClientScore(kpis) {
  if (!kpis) return { score: 0, breakdown: [], briefing: 'Loading...' }

  // Revenue trend (40%): compare last 7 days avg vs previous 7 days
  const days = kpis.revenue_by_day || []
  const recent7 = days.slice(-7)
  const prev7 = days.slice(-14, -7)
  const recentAvg = recent7.length ? recent7.reduce((s, d) => s + (d.revenue || 0), 0) / recent7.length : 0
  const prevAvg = prev7.length ? prev7.reduce((s, d) => s + (d.revenue || 0), 0) / prev7.length : 1
  const revenueScore = prevAvg > 0 ? Math.min(100, Math.round((recentAvg / prevAvg) * 80)) : (recentAvg > 0 ? 70 : 0)

  // Inventory health (30%)
  const invScore = kpis.total_products > 0
    ? Math.round(Math.max(0, 100 - (kpis.low_stock_count / kpis.total_products) * 100))
    : 100

  // Invoice collection (30%)
  const totalInv = kpis.pending_invoices + kpis.overdue_invoices
  const invoiceScore = totalInv === 0 ? 100 : Math.round(Math.max(0, 100 - (kpis.overdue_invoices / Math.max(1, totalInv)) * 100))

  const score = Math.round(revenueScore * 0.4 + invScore * 0.3 + invoiceScore * 0.3)

  // Briefing
  const parts = []
  if (recentAvg > prevAvg) parts.push('Revenue is trending up')
  else if (recentAvg < prevAvg) parts.push('Revenue is trending down')
  else parts.push('Revenue is steady')
  if (kpis.low_stock_count > 0) parts.push(`${kpis.low_stock_count} item${kpis.low_stock_count > 1 ? 's' : ''} low on stock`)
  if (kpis.overdue_invoices > 0) parts.push(`${kpis.overdue_invoices} overdue invoice${kpis.overdue_invoices > 1 ? 's' : ''}`)
  if (kpis.top_products?.length) parts.push(`Top seller: ${kpis.top_products[0].product}`)

  return {
    score,
    breakdown: [
      { label: 'Revenue Trend', value: revenueScore, weight: 40 },
      { label: 'Inventory Health', value: invScore, weight: 30 },
      { label: 'Invoice Collection', value: invoiceScore, weight: 30 },
    ],
    briefing: parts.join(' · '),
  }
}

export default function BusinessPulse({ kpis }) {
  const [pulse, setPulse] = useState(null)

  useEffect(() => {
    // Try server endpoint first, fall back to client-side
    api.get('/analytics/pulse')
      .then((res) => setPulse(res.data))
      .catch(() => {
        if (kpis) setPulse(computeClientScore(kpis))
      })
  }, [kpis])

  if (!pulse) return null

  const band = getBand(pulse.score)
  const colors = BAND_COLORS[band]

  return (
    <div className={`rounded-xl border-2 p-4 ${colors.bg} ${colors.border} transition-colors`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full border-2 border-current flex items-center justify-center ${colors.ring}`}>
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Business Pulse</h3>
            <p className={`text-xs ${colors.text} font-semibold`}>{getBandLabel(band)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${colors.text}`}>{pulse.score}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">/100</p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="flex items-center gap-4 mb-2">
        {pulse.breakdown.map((item) => (
          <div key={item.label} className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value}%</span>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-700/60 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${colors.ring} bg-current transition-all duration-500`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Briefing */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{pulse.briefing}</p>
    </div>
  )
}
