import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Brain, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3,
  Cpu, Database, Layers3, Package, RefreshCw, Search, Sparkles, Target,
  TrendingUp, User, Users, Wallet, Zap,
} from 'lucide-react'
import api from '../services/api'

const TYPE_CONFIG = {
  cross_sell: { label: 'Cross-sell', className: 'border-cyan-200/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300' },
  upsell: { label: 'Upsell', className: 'border-violet-200/70 bg-violet-50/80 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300' },
  personalized: { label: 'Personalized', className: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
  popular: { label: 'Popular', className: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
}

// Ordered so the strongest, most specific signal wins when several are present.
// Each entry maps a raw signal key to the human-facing "why" framing requested
// for the card: a short label plus a plain-language sentence.
const SIGNAL_REASON_CONFIG = [
  { key: 'collaborative_score', icon: Users, label: 'Similar customers', text: 'Customers with similar purchase patterns also bought this.' },
  { key: 'association_score', icon: Layers3, label: 'Frequently bought together', text: "Often purchased alongside items in this customer's history." },
  { key: 'popularity_score', icon: TrendingUp, label: 'Popular choice', text: 'Frequently purchased and currently in stock.' },
  { key: 'price_score', icon: Wallet, label: 'Price fit', text: "Closely matches this customer's typical spending range." },
]

// Fallback used only when the engine didn't return per-signal detail, so the
// card still explains itself using the recommendation_type alone.
const TYPE_REASON_CONFIG = {
  cross_sell: { icon: Layers3, label: 'Frequently bought together', text: 'Customers who bought similar items also picked this up.' },
  upsell: { icon: Zap, label: 'Upsell opportunity', text: "A higher-value product aligned with this customer's purchasing behaviour." },
  personalized: { icon: Users, label: 'Similar customers', text: 'Customers with similar purchase patterns also bought this.' },
  popular: { icon: TrendingUp, label: 'Popular choice', text: 'Frequently purchased and currently in stock.' },
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || {
    label: type ? type.replaceAll('_', ' ') : 'Recommendation',
    className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

// Four tiers instead of three: high-confidence recommendations (0.85+) now
// read distinctly from merely "strong" ones, which matters once a page has
// several 0.9+ matches sitting next to 0.75s.
function matchTier(score) {
  if (score >= 0.85) return { label: 'Excellent match', color: '#059669' }
  if (score >= 0.7) return { label: 'Strong match', color: '#10b981' }
  if (score >= 0.45) return { label: 'Good match', color: '#6366f1' }
  return { label: 'Fair match', color: '#f59e0b' }
}

// Picks the single best "why" for a card: prefer the dominant real signal
// (so the explanation reflects what actually drove the score), and only
// fall back to a generic type-based reason when no signal detail exists.
function getReasonInfo(recommendation) {
  const signals = recommendation.signals || {}
  const scored = SIGNAL_REASON_CONFIG
    .map((entry) => ({ ...entry, value: Number(signals[entry.key] || 0) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)

  if (scored.length > 0) return scored[0]
  return TYPE_REASON_CONFIG[recommendation.recommendation_type] || {
    icon: Brain, label: 'Recommended', text: 'Recommended based on customer purchasing behaviour.',
  }
}

// Signature element: a single confident radial "match" ring built from the
// one score the engine actually returns, instead of four signal bars that
// would show misleading zeros whenever per-signal detail isn't available.
function MatchRing({ score, size = 64 }) {
  const pct = Math.max(0, Math.min(1, Number(score || 0)))
  const stroke = 6
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)
  const tier = matchTier(pct)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{Math.round(pct * 100)}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">match</span>
      </div>
    </div>
  )
}

function RecommendationCard({ recommendation, rank, delay }) {
  const [showDetail, setShowDetail] = useState(false)
  const typeConfig = getTypeConfig(recommendation.recommendation_type)
  const score = Math.max(0, Math.min(1, Number(recommendation.score || 0)))
  const tier = matchTier(score)
  const signals = recommendation.signals || {}
  const reasonInfo = getReasonInfo(recommendation)
  const ReasonIcon = reasonInfo.icon || Brain
  const stock = recommendation.inventory_available
  const hasStock = stock != null

  // Sort the breakdown so the signal that actually drove the score appears
  // first, rather than a fixed collaborative/association/popularity/price
  // order that can bury the one signal that matters for this product.
  const signalRows = useMemo(() => {
    return [
      { label: 'Collaborative', value: Number(signals.collaborative_score || 0) },
      { label: 'Association', value: Number(signals.association_score || 0) },
      { label: 'Popularity', value: Number(signals.popularity_score || 0) },
      { label: 'Price fit', value: Number(signals.price_score || 0) },
    ].sort((a, b) => b.value - a.value)
  }, [signals.collaborative_score, signals.association_score, signals.popularity_score, signals.price_score])

  const hasSignalDetail = signalRows.some((row) => row.value > 0)

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_18px_50px_-24px_rgba(79,70,229,0.45)] motion-safe:animate-[fadeSlideIn_0.5s_ease_both] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900/70"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start gap-3">
        <MatchRing score={score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300 dark:text-slate-600">
                <span>#{rank}</span>
                <span className="h-1 w-1 rounded-full bg-current" />
                <span style={{ color: tier.color }}>{tier.label}</span>
              </div>
              <h4 className="mt-0.5 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{recommendation.product_name}</h4>
              {recommendation.category && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{recommendation.category}</p>}
            </div>
            <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(recommendation.price)}</p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${typeConfig.className}`}>
              <Sparkles size={10} />{typeConfig.label}
            </span>
            {hasStock && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${stock > 0 ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' : 'border-red-200 bg-red-50 text-red-500 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400'}`}>
                <Package size={10} />{stock > 0 ? `${stock.toLocaleString('en-IN')} in stock` : 'Out of stock'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-3 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-violet-600 shadow-sm dark:bg-slate-900/60 dark:text-violet-300"><ReasonIcon size={12} /></div>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">{reasonInfo.label}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{recommendation.reason || reasonInfo.text}</p>
      </div>

      {hasSignalDetail && (
        <>
          <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[10px] font-bold text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300">
            <span>View signal breakdown</span>{showDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showDetail && (
            <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              {signalRows.map(({ label, value }, index) => {
                const p = Math.max(0, Math.min(100, value * 100))
                const isDominant = index === 0 && value > 0
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`font-medium ${isDominant ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {label}{isDominant && <span className="ml-1 text-slate-300 dark:text-slate-600">· driving this pick</span>}
                      </span>
                      <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{p.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" style={{ width: `${p}%` }} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </article>
  )
}

function MiniStat({ label, value }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-800/60"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{value}</p></div>
}

function CustomerCard({ customer, expanded, onToggle }) {
  const recommendations = customer.recommendations || []
  const bestScore = recommendations.reduce((max, r) => Math.max(max, Number(r.score || 0)), 0)

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <button type="button" onClick={onToggle} className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/20">
          {getInitials(customer.customer_name)}
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{customer.customer_name}</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">ID #{customer.customer_id}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Sparkles size={10} />{recommendations.length} recommendations</span>
            {bestScore > 0 && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Activity size={10} />Best match {Math.round(bestScore * 100)}%</span>}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <MiniStat label="Orders" value={customer.total_orders ?? '—'} />
          <MiniStat label="AOV" value={formatCurrency(customer.average_order_value)} />
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-violet-200 group-hover:text-violet-600 dark:border-slate-700 dark:group-hover:border-violet-900">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Recommendation workspace</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Ranked using customer behaviour and product signals</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"><Cpu size={10} />AI ranked</div>
          </div>
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {recommendations.map((recommendation, index) => (
                <RecommendationCard key={`${recommendation.product_id}-${index}`} recommendation={recommendation} rank={index + 1} delay={index * 60} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
              <Package className="mx-auto text-slate-400" size={25} />
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">No recommendations available</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MetricCard({ label, value, icon: Icon, detail, accent = false }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/75">
      <div className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl ${accent ? 'bg-emerald-400/10' : 'bg-violet-400/10'}`} />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-[9px] font-medium text-slate-400">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300'}`}><Icon size={18} /></div>
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, totalCustomers, onPageChange, loading }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-[10px] font-semibold text-slate-400">
        Page <span className="font-extrabold text-slate-700 dark:text-slate-200">{page}</span> of {totalPages} · {totalCustomers} customers total
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
        ><ChevronLeft size={13} />Prev</button>
        <button
          type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-900"
        >Next<ChevronRight size={13} /></button>
      </div>
    </div>
  )
}

export default function Recommendations() {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  // Global recommendation counts by type, when the API provides them, so the
  // feed header and filter chips can show real totals instead of just this
  // page's counts. Falls back to null and the UI degrades gracefully.
  const [globalTypeCounts, setGlobalTypeCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())

  const fetchRecommendations = async (targetPage = page) => {
    try {
      setLoading(true); setError('')
      const response = await api.get('/ai/recommendations', { params: { page: targetPage, page_size: 5 } })
      const nextRows = response.data?.rows || []
      setRows(nextRows)
      setPage(response.data?.page || targetPage)
      setTotalPages(response.data?.total_pages || 1)
      setTotalCustomers(response.data?.total_customers ?? nextRows.length)
      // Some backends already return aggregate counts (e.g. total_recommendations,
      // type_counts); use them when present without requiring a backend change.
      if (response.data?.type_counts) setGlobalTypeCounts(response.data.type_counts)
      else setGlobalTypeCounts(null)
      if (nextRows.length > 0) setExpandedCustomers(new Set([nextRows[0].customer_id]))
    } catch (err) {
      console.error('Recommendation API error:', err)
      setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to load product recommendations.')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRecommendations(1) }, [])

  const totalRecommendations = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations?.length || 0), 0), [rows])
  const strongMatches = useMemo(() => rows.reduce((total, customer) => total + (customer.recommendations || []).filter((item) => Number(item.score || 0) >= 0.75).length, 0), [rows])
  const typeCounts = useMemo(() => {
    if (globalTypeCounts) return globalTypeCounts
    const counts = { all: 0 }
    rows.forEach((customer) => (customer.recommendations || []).forEach((item) => { const type = item.recommendation_type || 'other'; counts[type] = (counts[type] || 0) + 1; counts.all += 1 }))
    return counts
  }, [rows, globalTypeCounts])
  const countsAreGlobal = Boolean(globalTypeCounts)
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.map((customer) => {
      const recommendations = (customer.recommendations || []).filter((item) => typeFilter === 'all' || (item.recommendation_type || 'other') === typeFilter)
      const customerMatches = customer.customer_name?.toLowerCase().includes(query)
      const productMatches = recommendations.some((item) => item.product_name?.toLowerCase().includes(query))
      return !query || customerMatches || productMatches ? { ...customer, recommendations } : null
    }).filter(Boolean)
  }, [rows, search, typeFilter])

  const toggleCustomer = (id) => setExpandedCustomers((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll = () => setExpandedCustomers(new Set(filteredRows.map((row) => row.customer_id)))
  const collapseAll = () => setExpandedCustomers(new Set())
  const goToPage = (nextPage) => fetchRecommendations(nextPage)

  return (
    <div className="relative min-h-full overflow-hidden">
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 lg:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-500/20">
                <Sparkles size={25} />
                <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white lg:text-3xl">Product Recommendations</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />AI engine online</span>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Intelligent product suggestions ranked from customer behaviour, product signals, and recommendation scores.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Database size={11} />Precomputed & cached</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={11} />Refreshed hourly</span>
                  <span className="inline-flex items-center gap-1.5"><Layers3 size={11} />Multi-signal ranking</span>
                </div>
              </div>
            </div>
            <button onClick={() => fetchRecommendations(page)} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-900 dark:hover:text-violet-300">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh page
            </button>
          </div>
        </header>

        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard label="Customers this page" value={rows.length.toLocaleString('en-IN')} icon={User} detail={`${totalCustomers} total across all pages`} />
            <MetricCard label="Recommendations" value={totalRecommendations.toLocaleString('en-IN')} icon={Target} detail="AI-ranked product opportunities" />
            <MetricCard label="Strong matches" value={strongMatches.toLocaleString('en-IN')} icon={TrendingUp} detail="85%+ and 70%+ match confidence" accent />
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recommendation feed</p>
              <p className="text-[10px] font-semibold text-slate-400">
                {countsAreGlobal
                  ? <>{totalCustomers.toLocaleString('en-IN')} customers · {(typeCounts.all || 0).toLocaleString('en-IN')} recommendations</>
                  : <>{rows.length.toLocaleString('en-IN')} customers · {totalRecommendations.toLocaleString('en-IN')} recommendations on this page</>}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this page's customers or products..." className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:border-violet-800 dark:focus:bg-slate-900" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['all', 'personalized', 'cross_sell', 'upsell', 'popular'].map((type) => {
                  const count = typeCounts[type] || 0
                  if (type !== 'all' && count === 0) return null
                  const active = typeFilter === type
                  const label = type === 'all' ? 'All' : getTypeConfig(type).label
                  return (
                    <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-lg px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide transition ${active ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>
                      {label}<span className="ml-1 opacity-50">{count.toLocaleString('en-IN')}</span>
                    </button>
                  )
                })}
              </div>
              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 lg:block" />
              <div className="flex items-center gap-1">
                <button type="button" onClick={expandAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Expand all</button>
                <button type="button" onClick={collapseAll} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Collapse</button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-12 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-950/50 dark:to-indigo-950/50 dark:text-violet-300"><RefreshCw size={26} className="animate-spin" /></div>
            <p className="mt-4 text-sm font-extrabold text-slate-800 dark:text-slate-100">Loading recommendations</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reading precomputed customer profiles and product signals...</p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" /></div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-6 dark:border-red-900/60 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"><Activity size={18} /></div>
              <div>
                <p className="text-sm font-extrabold text-red-700 dark:text-red-300">Recommendation service unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p>
                <button onClick={() => fetchRecommendations(page)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-red-700">Try again</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Package size={26} /></div>
            <p className="mt-4 text-sm font-extrabold text-slate-700 dark:text-slate-200">No recommendations available</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">There is not enough purchase history to generate recommendations.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && filteredRows.length > 0 && (
          <div className="space-y-3">
            {filteredRows.map((customer) => (
              <CustomerCard key={customer.customer_id} customer={customer} expanded={expandedCustomers.has(customer.customer_id)} onToggle={() => toggleCustomer(customer.customer_id)} />
            ))}
          </div>
        )}

        {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
            <Search className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 text-sm font-extrabold text-slate-700 dark:text-slate-200">No matching recommendations</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try another customer, product, or recommendation type.</p>
          </div>
        )}

        {!loading && !error && <Pagination page={page} totalPages={totalPages} totalCustomers={totalCustomers} onPageChange={goToPage} loading={loading} />}
      </div>
    </div>
  )
}
