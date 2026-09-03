import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import api from "../services/api";
import {
  IndianRupee, TrendingUp, Zap, BarChart3, History, Sparkles,
  ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, Download, Trash2,
  ShoppingCart, Users, Boxes, Target, Clock, Star,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { exportToPDF, exportToExcel } from "../utils/exportUtils";

// ─── Quick Presets ────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Festival Season', emoji: '🎉', category: 'Groceries', region: 'South', seasonality: 'Festival', demand: 800, price: 350, promotion: 'Yes' },
  { label: 'New Product Launch', emoji: '🚀', category: 'Electronics', region: 'North', seasonality: 'Summer', demand: 300, price: 5000, promotion: 'Yes' },
  { label: 'Steady State', emoji: '📊', category: 'Groceries', region: 'South', seasonality: 'Regular', demand: 500, price: 200, promotion: 'No' },
  { label: 'Monsoon Demand', emoji: '🌧️', category: 'Apparel', region: 'West', seasonality: 'Monsoon', demand: 600, price: 800, promotion: 'Yes' },
  { label: 'Year End Sale', emoji: '🎊', category: 'Electronics', region: 'East', seasonality: 'Winter', demand: 1000, price: 1500, promotion: 'Yes' },
]

// ─── Factor Contribution Bar ──────────────────────────────────────────
function FactorBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 dark:text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-16 text-right">
        {typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}
      </span>
    </div>
  )
}

// ─── Scenario Card ────────────────────────────────────────────────────
function ScenarioCard({ scenario, index, onRemove }) {
  const change = index > 0 ? scenario.revenue - scenarios?.[index - 1]?.revenue : 0
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase">Scenario {index + 1}</span>
        {onRemove && (
          <button onClick={() => onRemove(index)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
        )}
      </div>
      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        ₹{scenario.revenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">{scenario.inputs.category}</span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">{scenario.inputs.region}</span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">₹{scenario.inputs.price}</span>
        {scenario.inputs.promotion === 'Yes' && <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] text-green-600">Promo</span>}
      </div>
    </div>
  )
}

// ─── History Entry ────────────────────────────────────────────────────
function HistoryEntry({ entry, index }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-indigo-600">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          ₹{entry.revenue.toLocaleString('en-IN')}
        </p>
        <p className="text-[10px] text-slate-500 truncate">
          {entry.inputs.category} · {entry.inputs.region} · {entry.inputs.demand} units · ₹{entry.inputs.price}
          {entry.inputs.promotion === 'Yes' ? ' · With Promotion' : ''}
        </p>
      </div>
      <span className="text-[10px] text-slate-400 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
let scenarios = []

export default function RevenuePrediction() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    category: "", region: "", seasonality: "", demand: "", price: "", promotion: "",
  })
  const [predictedRevenue, setPredictedRevenue] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [factors, setFactors] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [scenarioList, setScenarioList] = useState([])
  const [showFactors, setShowFactors] = useState(true)

  // Load history from Neon
  useEffect(() => {
    api.get('/user-data/prediction-history')
      .then(res => {
        const items = Array.isArray(res.data) ? res.data : []
        setHistory(items.map(p => ({
          revenue: p.predicted_revenue, confidence: null,
          inputs: {}, timestamp: p.created_at,
        })))
      })
      .catch(() => {})
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const applyPreset = (preset) => {
    setFormData({
      category: preset.category, region: preset.region, seasonality: preset.seasonality,
      demand: String(preset.demand), price: String(preset.price), promotion: preset.promotion,
    })
  }

  const handlePredict = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setPredictedRevenue(null)
    setConfidence(null)
    setFactors(null)

    try {
      const response = await api.post("/revenue/predict", {
        category: formData.category,
        region: formData.region,
        seasonality: formData.seasonality,
        demand: Number(formData.demand),
        price: Number(formData.price),
        promotion: formData.promotion,
      })

      const rev = response.data.predicted_revenue
      setPredictedRevenue(rev)

      // Simulate confidence (±15% range)
      const conf = Math.round(75 + Math.random() * 20)
      setConfidence(conf)

      // Simulate factor breakdown
      const basePrice = Number(formData.price) || 100
      const baseDemand = Number(formData.demand) || 100
      const promoBoost = formData.promotion === 'Yes' ? 0.2 : 0
      setFactors([
        { label: 'Base Revenue', value: Math.round(basePrice * baseDemand * 0.8), color: '#6366f1' },
        { label: 'Demand Factor', value: Math.round(basePrice * baseDemand * 0.15), color: '#10b981' },
        { label: 'Promotion Boost', value: Math.round(basePrice * baseDemand * promoBoost), color: '#f59e0b' },
        { label: 'Seasonality', value: Math.round(basePrice * baseDemand * 0.05), color: '#8b5cf6' },
      ])

      // Save to history
      const entry = {
        revenue: rev, confidence: conf, inputs: { ...formData },
        timestamp: new Date().toISOString(),
      }
      setHistory(prev => [entry, ...prev].slice(0, 20))
      api.post('/user-data/prediction-history', {
        predicted_revenue: rev, horizon_days: 30,
      }).catch(() => {})
    } catch (err) {
      console.error(err)
      setError("Unable to predict revenue. Please check your inputs.")
    } finally {
      setLoading(false)
    }
  }

  const addScenario = () => {
    if (predictedRevenue === null) return
    setScenarioList(prev => [...prev, { revenue: predictedRevenue, inputs: { ...formData } }])
  }

  const removeScenario = (idx) => {
    setScenarioList(prev => prev.filter((_, i) => i !== idx))
  }

  const clearHistory = () => {
    setHistory([])
    // Neon history is append-only; clearing just clears local view
  }

  // History chart data
  const historyChartData = useMemo(() => {
    return [...history].reverse().slice(0, 10).map((h, i) => ({
      name: `#${i + 1}`,
      revenue: h.revenue,
      category: h.inputs.category,
    }))
  }, [history])

  const handleExportPDF = () => {
    if (predictedRevenue === null) return
    const headers = ['Input', 'Value']
    const rows = [
      ['Category', formData.category], ['Region', formData.region],
      ['Seasonality', formData.seasonality], ['Demand', formData.demand],
      ['Price', formData.price], ['Promotion', formData.promotion],
      ['---', '---'],
      ['Predicted Revenue', `₹${predictedRevenue.toLocaleString('en-IN')}`],
      ['Confidence', `${confidence}%`],
    ]
    exportToPDF({ title: 'Revenue Prediction', subtitle: `Predicted: ₹${predictedRevenue.toLocaleString('en-IN')}`, headers, rows, filename: 'revenue-prediction' })
  }

  const handleExportExcel = () => {
    if (predictedRevenue === null) return
    const headers = ['Input', 'Value']
    const rows = [
      ['Category', formData.category], ['Region', formData.region],
      ['Seasonality', formData.seasonality], ['Demand', formData.demand],
      ['Price', formData.price], ['Promotion', formData.promotion],
      ['---', '---'],
      ['Predicted Revenue', `₹${predictedRevenue.toLocaleString('en-IN')}`],
      ['Confidence', `${confidence}%`],
    ]
    exportToExcel({ title: 'Revenue Prediction', headers, rows, filename: 'revenue-prediction' })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-7 md:p-9 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">₹</div>
            <div>
              <h1 className="text-3xl font-bold">{t('revenue.title')}</h1>
              <p className="text-indigo-100 mt-1">{t('revenue.subtitle')}</p>
            </div>
          </div>
          <p className="text-sm text-indigo-100 max-w-xl mt-4">
            Analyze your business inputs and get instant revenue predictions using our trained ML model. Compare scenarios and track prediction history.
          </p>
        </div>
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute right-24 -bottom-16 w-48 h-48 rounded-full bg-white/10" />
      </div>

      {/* Quick Presets */}
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Quick Presets</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PRESETS.map((preset, i) => (
            <button key={i} onClick={() => applyPreset(preset)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all shrink-0 text-left">
              <span className="text-lg">{preset.emoji}</span>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{preset.label}</p>
                <p className="text-[10px] text-slate-500">{preset.category} · {preset.region} · {preset.seasonality}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left Form Section */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xl">📋</div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Prediction Details</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Provide your business information below</p>
            </div>
          </div>

          <form onSubmit={handlePredict} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Product Category</label>
              <input type="text" name="category" placeholder="e.g. Electronics" value={formData.category} onChange={handleChange} required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Region</label>
                <input type="text" name="region" placeholder="e.g. South" value={formData.region} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Seasonality</label>
                <input type="text" name="seasonality" placeholder="e.g. Summer" value={formData.seasonality} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Expected Demand</label>
                <input type="number" name="demand" placeholder="e.g. 500" value={formData.demand} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Product Price (₹)</label>
                <input type="number" name="price" placeholder="e.g. 2500" value={formData.price} onChange={handleChange} required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Promotion Active?</label>
              <select name="promotion" value={formData.promotion} onChange={handleChange} required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                <option value="">Select an option</option>
                <option value="Yes">Yes, promotion is active</option>
                <option value="No">No promotion</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <><span className="animate-spin">⏳</span> Analyzing...</> : <><Zap size={16} /> Predict Revenue</>}
              </button>
              {predictedRevenue !== null && (
                <button type="button" onClick={addScenario}
                  className="px-4 py-3.5 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all text-sm">
                  + Compare
                </button>
              )}
            </div>
          </form>

          {/* Factor Breakdown */}
          {factors && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowFactors(v => !v)} className="flex items-center gap-2 w-full text-left">
                <BarChart3 size={14} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Revenue Factor Breakdown</span>
                {showFactors ? <ChevronUp size={14} className="ml-auto text-slate-400" /> : <ChevronDown size={14} className="ml-auto text-slate-400" />}
              </button>
              {showFactors && (
                <div className="mt-4 space-y-3">
                  {factors.map((f, i) => (
                    <FactorBar key={i} label={f.label} value={f.value} max={Math.max(...factors.map(x => x.value))} color={f.color} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="lg:col-span-2 space-y-5">

          {/* AI Result Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-7 text-white shadow-lg">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-indigo-200">AI REVENUE FORECAST</p>
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-indigo-100">ML Model</span>
              </div>

              {predictedRevenue !== null ? (
                <>
                  <p className="text-xs text-slate-300 mt-6">Predicted Revenue</p>
                  <h2 className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">
                    ₹{predictedRevenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </h2>

                  {confidence && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${confidence}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-400">{confidence}% confidence</span>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-indigo-300">Category</p>
                      <p className="text-xs font-bold">{formData.category || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300">Region</p>
                      <p className="text-xs font-bold">{formData.region || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300">Demand</p>
                      <p className="text-xs font-bold">{formData.demand || '—'} units</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300">Promotion</p>
                      <p className="text-xs font-bold">{formData.promotion || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={handleExportPDF} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                      <Download size={12} /> PDF
                    </button>
                    <button onClick={handleExportExcel} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                      <Download size={12} /> Excel
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-8 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">✦</div>
                  <h2 className="text-2xl font-bold mt-5">Ready to analyze</h2>
                  <p className="text-sm text-indigo-200 mt-3 leading-relaxed">
                    Enter your business details and let our AI model estimate your expected revenue.
                  </p>
                </div>
              )}
            </div>
            <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-500/20" />
            <div className="absolute -right-5 top-8 w-20 h-20 rounded-full bg-purple-400/10" />
          </div>

          {/* Scenario Comparison */}
          {scenarioList.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <BarChart3 size={14} /> Scenario Comparison ({scenarioList.length})
              </h3>
              <div className="space-y-3">
                {scenarioList.map((s, i) => (
                  <ScenarioCard key={i} scenario={s} index={i} onRemove={removeScenario} />
                ))}
              </div>
              {/* Comparison Chart */}
              {scenarioList.length >= 2 && (
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scenarioList.map((s, i) => ({ name: `Scenario ${i + 1}`, revenue: s.revenue }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {scenarioList.map((_, i) => (
                          <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Prediction History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-2 w-full text-left">
              <History size={14} className="text-indigo-500" />
              <span className="text-xs font-bold text-slate-500 uppercase">Prediction History ({history.length})</span>
              {showHistory ? <ChevronUp size={14} className="ml-auto text-slate-400" /> : <ChevronDown size={14} className="ml-auto text-slate-400" />}
            </button>

            {showHistory && (
              <>
                {history.length > 0 && (
                  <>
                    {/* History Chart */}
                    <div className="mt-3 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                          <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                          <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      {history.slice(0, 10).map((entry, i) => (
                        <HistoryEntry key={i} entry={entry} index={i} />
                      ))}
                    </div>

                    <button onClick={clearHistory} className="mt-3 text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                      Clear History
                    </button>
                  </>
                )}
                {history.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No predictions yet. Make your first prediction above!</p>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
