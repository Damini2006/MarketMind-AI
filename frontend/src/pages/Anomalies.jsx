import { useEffect, useState, useMemo, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge } from '../components/ui.jsx'
import jsPDF from 'jspdf'
import {
  ShieldAlert, AlertOctagon, Filter, LayoutGrid, List,
  Search, Download, RefreshCw, X, ChevronDown, BarChart3, PieChart,
  TrendingUp, ArrowUpDown, Sparkles, Info, ExternalLink,
  Clock, Database, Activity, Eye, EyeOff, CheckCircle2, XCircle,
  TrendingDown, Zap, Target, Layers, Calendar, FileText
} from 'lucide-react'

const SEVERITY_TONE = { high: 'red', medium: 'amber', low: 'blue' }
const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' }
const CATEGORY_LABELS = {
  sales: 'Sales', inventory: 'Inventory', revenue: 'Revenue',
  customer: 'Customer', temporal: 'Temporal',
}
const CATEGORY_COLORS = {
  sales: '#3b5bdb', inventory: '#f59e0b', revenue: '#22c55e',
  customer: '#8b5cf6', temporal: '#06b6d4',
}
const METHOD_LABELS = {
  zscore: 'Z-Score', iqr: 'IQR', isolation_forest: 'Isolation Forest',
  moving_avg: 'Moving Average', temporal: 'Temporal', benford: "Benford's Law",
  price_anomaly: 'Price Anomaly', velocity: 'Velocity', concentration: 'Revenue Concentration',
  margin: 'Margin Analysis', turnover: 'Turnover Rate', out_of_stock: 'Out of Stock',
  round_number: 'Round-Number Bias', revenue_gap: 'Revenue Gap',
  seasonal: 'Seasonal Deviation', duplicate: 'Duplicate Transaction',
}
const METHOD_ICONS = {
  zscore: Target, iqr: Layers, isolation_forest: Zap,
  moving_avg: TrendingUp, temporal: Calendar, benford: Activity,
  price_anomaly: TrendingDown, velocity: Clock, concentration: PieChart,
  margin: BarChart3, turnover: RefreshCw, out_of_stock: AlertOctagon,
  round_number: Info, revenue_gap: XCircle,
  seasonal: TrendingUp, duplicate: AlertOctagon,
}

function TimelineChart({ data, onBarClick }) {
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.total || 0), 1)
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Anomaly Timeline</span>
        </div>
        <span className="text-[10px] text-slate-400">{data.length} days with anomalies</span>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto">
        {data.map((d, i) => (
          <button key={i} onClick={() => onBarClick(d.date)}
            className="flex flex-col items-center gap-1 min-w-[28px] flex-1 group" title={d.date}>
            <div className="w-full flex flex-col items-stretch" style={{ height: `${Math.max(4, (d.total / maxVal) * 100)}%` }}>
              {d.low > 0 && <div className="w-full bg-blue-400 rounded-t transition-all" style={{ height: `${(d.low / d.total) * 100}%`, minHeight: '2px' }} />}
              {d.medium > 0 && <div className="w-full bg-amber-400 transition-all" style={{ height: `${(d.medium / d.total) * 100}%`, minHeight: '2px' }} />}
              {d.high > 0 && <div className="w-full bg-red-400 rounded-b transition-all" style={{ height: `${(d.high / d.total) * 100}%`, minHeight: '2px' }} />}
            </div>
            <span className="text-[8px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors truncate w-full text-center">
              {d.date.slice(5)}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 justify-center">
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-red-400" /> High</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400" /> Medium</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-400" /> Low</span>
      </div>
    </div>
  )
}

function ConfidenceChart({ data }) {
  if (!data) return null
  const entries = Object.entries(data)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  const colors = { 'high (>85%)': '#22c55e', 'medium (60-85%)': '#f59e0b', 'low (<60%)': '#3b82f6' }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Target size={14} className="text-emerald-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confidence Distribution</span>
      </div>
      <div className="space-y-2">
        {entries.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 w-24 shrink-0 text-right">{label}</span>
            <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 flex items-center pl-2"
                style={{ width: `${(count / total) * 100}%`, backgroundColor: colors[label] || '#94a3b8', minWidth: count > 0 ? '20px' : '0' }}>
                {count > 0 && <span className="text-[9px] font-bold text-white">{count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniBarChart({ data, maxVal, color }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full rounded-t transition-all duration-500 hover:opacity-80"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color || '#3b5bdb', minHeight: '4px' }}
            title={`${d.label}: ${d.value}`} />
          <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function MiniPieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let acc = 0
  return (
    <div className="flex items-center gap-3">
      <svg width="80" height="80" viewBox="0 0 36 36">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100
          const offset = 100 - (acc / total) * 100
          acc += d.value
          return (
            <circle key={i} cx="18" cy="18" r="15.915" fill="none"
              stroke={d.color} strokeWidth="3.5"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset}
              className="transition-all duration-500" />
          )
        })}
        <text x="18" y="19" textAnchor="middle" className="text-[5px] fill-slate-600 dark:fill-slate-300 font-bold">{total}</text>
      </svg>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600 dark:text-slate-400">{d.label}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailModal({ anomaly, onClose, onDismiss }) {
  if (!anomaly) return null
  const meta = anomaly.details || {}
  const MethodIcon = METHOD_ICONS[anomaly.anomaly_type] || AlertOctagon
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge tone={SEVERITY_TONE[anomaly.severity]}>{anomaly.severity}</Badge>
              <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <MethodIcon size={10} /> {METHOD_LABELS[anomaly.anomaly_type] || anomaly.anomaly_type}
              </span>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{anomaly.description}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            {new Date(anomaly.created_at).toLocaleString()} · {anomaly.category}
          </p>

          {/* Confidence meter */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Confidence</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{(anomaly.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${anomaly.confidence * 100}%`,
                  backgroundColor: anomaly.confidence > 0.85 ? '#22c55e' : anomaly.confidence > 0.6 ? '#f59e0b' : '#3b82f6'
                }} />
            </div>
          </div>

          {anomaly.suggested_action && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 mb-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><Sparkles size={12} /> Suggested Action</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{anomaly.suggested_action}</p>
            </div>
          )}

          {anomaly.affected_entity && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Affected: <span className="font-medium text-slate-700 dark:text-slate-300">{anomaly.affected_entity}</span>
            </p>
          )}

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">Technical Details</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(meta).map(([key, val]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {typeof val === 'number' ? val.toLocaleString() : Array.isArray(val) ? val.length + ' items' : String(val)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button onClick={() => onDismiss(anomaly)} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1">
              <CheckCircle2 size={12} /> Mark Reviewed
            </button>
            <button onClick={onClose} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Anomalies() {
  const [data, setData] = useState({ alerts: [], summary: {}, detection_accuracy: null, false_positive_rate: null, benford_analysis: null, timeline: [], confidence_distribution: null, scan_timestamp: null, total_records_scanned: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [sortBy, setSortBy] = useState('severity')
  const [viewMode, setViewMode] = useState('list')
  const [salesOnly, setSalesOnly] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)
  const [activeChart, setActiveChart] = useState(null)
  const [dismissed, setDismissed] = useState(new Set())
  const [showDismissed, setShowDismissed] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [minConfidence, setMinConfidence] = useState(0)
  const [autoDismissEnabled, setAutoDismissEnabled] = useState(false)

  const fetchAnomalies = useCallback(() => {
    setScanning(true)
    const params = {}
    if (autoDismissEnabled && minConfidence > 0) {
      params.min_confidence = minConfidence / 100
    }
    api.get('/ai/anomalies', { params })
      .then((res) => setData(res.data || { alerts: [] }))
      .catch(() => setData({ alerts: [], summary: {} }))
      .finally(() => { setLoading(false); setScanning(false) })
  }, [autoDismissEnabled, minConfidence])

  useEffect(() => { fetchAnomalies() }, [fetchAnomalies])

  const dismissAnomaly = useCallback((anomaly) => {
    setDismissed(prev => new Set([...prev, `${anomaly.id}-${anomaly.anomaly_type}`]))
    setSelectedAnomaly(null)
  }, [])

  const alerts = useMemo(() => {
    let list = Array.isArray(data.alerts) ? [...data.alerts] : []

    // Filter dismissed
    if (!showDismissed) {
      list = list.filter(a => !dismissed.has(`${a.id}-${a.anomaly_type}`))
    }

    if (salesOnly) list = list.filter(a => a.category === 'sales')
    if (severityFilter !== 'all') list = list.filter(a => a.severity === severityFilter)
    if (categoryFilter !== 'all') list = list.filter(a => a.category === categoryFilter)
    if (methodFilter !== 'all') list = list.filter(a => a.anomaly_type === methodFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        (a.description || '').toLowerCase().includes(q) ||
        (a.affected_entity || '').toLowerCase().includes(q) ||
        (a.anomaly_type || '').toLowerCase().includes(q) ||
        (a.suggested_action || '').toLowerCase().includes(q)
      )
    }

    const sevOrder = { high: 0, medium: 1, low: 2 }
    list.sort((a, b) => {
      if (sortBy === 'severity') return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3)
      if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
    return list
  }, [data.alerts, severityFilter, categoryFilter, methodFilter, search, sortBy, salesOnly, dismissed, showDismissed])

  const activeFilters = [severityFilter !== 'all', categoryFilter !== 'all', methodFilter !== 'all', salesOnly, !!search].filter(Boolean).length

  const categoryData = useMemo(() => {
    const counts = {}
    ;(data.alerts || []).forEach(a => { if (!dismissed.has(`${a.id}-${a.anomaly_type}`)) { counts[a.category] = (counts[a.category] || 0) + 1 } })
    return Object.entries(counts).map(([k, v]) => ({ label: CATEGORY_LABELS[k] || k, value: v, color: CATEGORY_COLORS[k] || '#94a3b8' }))
  }, [data.alerts, dismissed])

  const methodData = useMemo(() => {
    const counts = {}
    ;(data.alerts || []).forEach(a => { if (!dismissed.has(`${a.id}-${a.anomaly_type}`)) { counts[a.anomaly_type] = (counts[a.anomaly_type] || 0) + 1 } })
    return Object.entries(counts).map(([k, v]) => ({ label: METHOD_LABELS[k] || k, value: v }))
  }, [data.alerts, dismissed])

  const totalCount = (data.alerts || []).length
  const visibleCount = alerts.length
  const dismissedCount = dismissed.size

  const highCount = alerts.filter(a => a.severity === 'high').length
  const medCount = alerts.filter(a => a.severity === 'medium').length
  const lowCount = alerts.filter(a => a.severity === 'low').length
  const methodsUsed = data.summary?.methods_count || new Set((data.alerts || []).map(a => a.anomaly_type)).size

  // Week-over-week comparison
  const weekComparison = useMemo(() => {
    const allAlerts = data.alerts || []
    if (allAlerts.length === 0) return null
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay())
    thisWeekStart.setHours(0, 0, 0, 0)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(thisWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setHours(0, 0, 0, -1)

    const thisWeek = allAlerts.filter(a => new Date(a.created_at) >= thisWeekStart)
    const lastWeek = allAlerts.filter(a => new Date(a.created_at) >= lastWeekStart && new Date(a.created_at) <= lastWeekEnd)

    const thisCount = thisWeek.length
    const lastCount = lastWeek.length
    const change = lastCount > 0 ? ((thisCount - lastCount) / lastCount) * 100 : thisCount > 0 ? 100 : 0
    const direction = change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable'

    const thisHigh = thisWeek.filter(a => a.severity === 'high').length
    const lastHigh = lastWeek.filter(a => a.severity === 'high').length
    const thisMed = thisWeek.filter(a => a.severity === 'medium').length
    const lastMed = lastWeek.filter(a => a.severity === 'medium').length

    return { thisCount, lastCount, change, direction, thisHigh, lastHigh, thisMed, lastMed }
  }, [data.alerts])

  const exportCSV = () => {
    const headers = ['ID', 'Category', 'Severity', 'Type', 'Confidence', 'Description', 'Entity', 'Action', 'Date']
    const rows = alerts.map(a => [a.id, a.category, a.severity, a.anomaly_type, a.confidence, `"${(a.description || '').replace(/"/g, '""')}"`, a.affected_entity, `"${(a.suggested_action || '').replace(/"/g, '""')}"`, a.created_at])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'anomalies.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let y = 15

    const addPage = () => { doc.addPage(); y = 15 }
    const checkPage = (needed) => { if (y + needed > 270) addPage() }

    // ── Header ──
    doc.setFillColor(30, 30, 60)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Anomaly Detection Report', margin, 18)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()} | MarketMind AI`, margin, 26)
    doc.text(`${totalCount} anomalies detected across ${methodsUsed} techniques | ${data.total_records_scanned || 0} records scanned`, margin, 31)
    y = 45

    // ── Summary Section ──
    doc.setTextColor(30, 30, 60)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', margin, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const summaryItems = [
      [`Total Anomalies: ${totalCount}`, `High Severity: ${highCount}`, `Medium: ${medCount}`, `Low: ${lowCount}`],
      [`Detection Accuracy: ${data.detection_accuracy != null ? (data.detection_accuracy * 100).toFixed(1) + '%' : 'N/A'}`, `False Positive Rate: ${data.false_positive_rate != null ? (data.false_positive_rate * 100).toFixed(1) + '%' : 'N/A'}`, `Methods Active: ${methodsUsed}`],
    ]
    for (const row of summaryItems) {
      let x = margin
      for (const item of row) {
        doc.text(item, x, y)
        x += 60
      }
      y += 5
    }
    y += 5

    // ── Severity Distribution (drawn bar chart) ──
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Severity Distribution', margin, y)
    y += 6

    const barData = [
      { label: 'High', value: highCount, color: [239, 68, 68] },
      { label: 'Medium', value: medCount, color: [245, 158, 11] },
      { label: 'Low', value: lowCount, color: [59, 130, 246] },
    ]
    const maxBar = Math.max(...barData.map(b => b.value), 1)
    const barWidth = 80
    for (const bar of barData) {
      const w = Math.max(2, (bar.value / maxBar) * barWidth)
      doc.setFillColor(...bar.color)
      doc.roundedRect(margin, y - 4, w, 6, 1, 1, 'F')
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`${bar.label}: ${bar.value}`, margin + barWidth + 8, y)
      y += 8
    }
    y += 5

    // ── Category Breakdown ──
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 60)
    doc.text('Category Breakdown', margin, y)
    y += 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    for (const cat of categoryData) {
      doc.text(`${cat.label}: ${cat.value} anomalies (${((cat.value / totalCount) * 100).toFixed(0)}%)`, margin, y)
      y += 4
    }
    y += 5

    // ── Method Breakdown ──
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Detection Methods Used', margin, y)
    y += 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    for (const m of methodData.sort((a, b) => b.value - a.value)) {
      doc.text(`${m.label}: ${m.value} anomalies`, margin, y)
      y += 4
    }
    y += 8

    // ── Anomaly List ──
    checkPage(20)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 60)
    doc.text('Anomaly Details', margin, y)
    y += 8

    const sevColors = { high: [239, 68, 68], medium: [245, 158, 11], low: [59, 130, 246] }
    for (let i = 0; i < alerts.length; i++) {
      const a = alerts[i]
      checkPage(22)

      // Severity dot
      const col = sevColors[a.severity] || [150, 150, 150]
      doc.setFillColor(...col)
      doc.circle(margin + 2, y - 1.5, 1.5, 'F')

      // Title line
      doc.setTextColor(30, 30, 60)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      const title = `[${a.severity.toUpperCase()}] ${METHOD_LABELS[a.anomaly_type] || a.anomaly_type} — ${a.category}`
      doc.text(title, margin + 6, y)

      // Confidence
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'normal')
      doc.text(`${(a.confidence * 100).toFixed(0)}% confidence`, pageWidth - margin - 30, y)
      y += 4

      // Description (word wrap)
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(7.5)
      const descLines = doc.splitTextToSize(a.description || '', pageWidth - margin * 2 - 6)
      for (const line of descLines) {
        doc.text(line, margin + 6, y)
        y += 3.5
      }

      // Suggested action
      if (a.suggested_action) {
        doc.setTextColor(180, 120, 20)
        doc.setFontSize(7)
        const actionLines = doc.splitTextToSize(`Action: ${a.suggested_action}`, pageWidth - margin * 2 - 6)
        for (const line of actionLines) {
          doc.text(line, margin + 6, y)
          y += 3
        }
      }

      // Date + Entity
      doc.setTextColor(140, 140, 140)
      doc.setFontSize(6.5)
      const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString() : ''
      doc.text(`${dateStr}${a.affected_entity ? ' | ' + a.affected_entity : ''}`, margin + 6, y)
      y += 4

      // Separator
      if (i < alerts.length - 1) {
        doc.setDrawColor(230, 230, 230)
        doc.line(margin + 6, y, pageWidth - margin, y)
        y += 3
      }
    }

    // ── Footer ──
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text(`MarketMind AI — Anomaly Detection Report — Page ${i}/${totalPages}`, margin, 290)
    }

    doc.save('anomaly-report.pdf')
  }

  if (loading) return <Loading label="Scanning for anomalies across all data..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Anomaly Detection"
        subtitle={`${visibleCount} anomalies${dismissedCount > 0 ? ` (${dismissedCount} dismissed)` : ''} · ${methodsUsed} detection techniques · ${(data.total_records_scanned || 0).toLocaleString()} records scanned`}
        action={
          <div className="flex items-center gap-2">
            {scanning && <span className="flex items-center gap-1 text-xs text-indigo-500"><RefreshCw size={12} className="animate-spin" /> Scanning...</span>}
            <button onClick={fetchAnomalies}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1">
              <RefreshCw size={12} /> Rescan
            </button>
          </div>
        }
      />

      {/* Scan Info Bar */}
      {data.scan_timestamp && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock size={10} /> Last scan: {new Date(data.scan_timestamp).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Database size={10} /> {(data.total_records_scanned || 0).toLocaleString()} records scanned
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Zap size={10} /> {methodsUsed} techniques active
          </span>
          {data.detection_accuracy != null && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Target size={10} /> {(data.detection_accuracy * 100).toFixed(0)}% accuracy
            </span>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button onClick={() => setSeverityFilter('all')} className="card text-center p-3 hover:shadow-md transition-all cursor-pointer">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Total</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'high' ? 'border-red-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-red-600">{highCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">High</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'medium' ? 'border-amber-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-amber-600">{medCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Medium</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'low' ? 'border-blue-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-blue-600">{lowCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Low</p>
        </button>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-emerald-600">{data.detection_accuracy != null ? `${(data.detection_accuracy * 100).toFixed(0)}%` : '—'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Accuracy</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-slate-600">{data.false_positive_rate != null ? `${(data.false_positive_rate * 100).toFixed(1)}%` : '—'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">False Pos.</p>
        </div>
        <button onClick={() => setShowDismissed(!showDismissed)}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${showDismissed ? 'border-slate-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-slate-600">{dismissedCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Dismissed</p>
        </button>
      </div>

      {/* Week-over-Week Comparison */}
      {weekComparison && (
        <div className={`card border-l-4 ${
          weekComparison.direction === 'increasing' ? 'border-l-red-400 bg-red-50/50 dark:bg-red-950/20' :
          weekComparison.direction === 'decreasing' ? 'border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' :
          'border-l-slate-300 bg-slate-50/50 dark:bg-slate-800/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className={`${
                  weekComparison.direction === 'increasing' ? 'text-red-500 rotate-0' :
                  weekComparison.direction === 'decreasing' ? 'text-emerald-500 rotate-180' :
                  'text-slate-400'
                } transition-transform`} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Week-over-Week</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{weekComparison.thisCount}</p>
                  <p className="text-[9px] text-slate-400 uppercase">This Week</p>
                </div>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-500 dark:text-slate-400">{weekComparison.lastCount}</p>
                  <p className="text-[9px] text-slate-400 uppercase">Last Week</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                weekComparison.direction === 'increasing' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                weekComparison.direction === 'decreasing' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {weekComparison.direction === 'increasing' ? '↑' : weekComparison.direction === 'decreasing' ? '↓' : '→'}
                {Math.abs(weekComparison.change).toFixed(1)}%
              </span>
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-red-500">High: {weekComparison.thisHigh} vs {weekComparison.lastHigh}</span>
                  <span className="text-amber-500">Med: {weekComparison.thisMed} vs {weekComparison.lastMed}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
            {weekComparison.direction === 'increasing' && `Anomaly count is increasing — ${weekComparison.thisCount - weekComparison.lastCount > 0 ? '+' : ''}${weekComparison.thisCount - weekComparison.lastCount} more anomalies this week. Investigate potential data quality issues.`}
            {weekComparison.direction === 'decreasing' && `Anomaly count is decreasing — ${weekComparison.lastCount - weekComparison.thisCount} fewer anomalies this week. Data quality improving.`}
            {weekComparison.direction === 'stable' && 'Anomaly count is stable week-over-week. No significant change detected.'}
          </p>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <TimelineChart data={data.timeline} onBarClick={(date) => setSearch(date)} />
        </div>
        {/* Confidence Distribution */}
        <ConfidenceChart data={data.confidence_distribution} />
      </div>

      {/* Category + Method charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setActiveChart(activeChart === 'category' ? null : 'category')}
          className={`card text-left hover:shadow-md transition-all cursor-pointer ${activeChart === 'category' ? 'ring-2 ring-indigo-400' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">By Category</span>
          </div>
          <MiniPieChart data={categoryData} />
        </button>
        <button onClick={() => setActiveChart(activeChart === 'method' ? null : 'method')}
          className={`card text-left hover:shadow-md transition-all cursor-pointer ${activeChart === 'method' ? 'ring-2 ring-indigo-400' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">By Detection Method</span>
          </div>
          <MiniBarChart data={methodData} color="#3b5bdb" />
        </button>
      </div>

      {/* Expanded Charts */}
      {activeChart === 'category' && (
        <div className="card">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-3">Category Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {categoryData.map(d => (
              <button key={d.label} onClick={() => { setCategoryFilter(d.label.toLowerCase()); setActiveChart(null) }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-all text-center">
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: d.color }} />
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{d.value}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{d.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'method' && (
        <div className="card">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-3">Method Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {methodData.sort((a, b) => b.value - a.value).map(d => (
              <button key={d.label} onClick={() => { setMethodFilter(Object.keys(METHOD_LABELS).find(k => (METHOD_LABELS[k] === d.label)) || d.label); setActiveChart(null) }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-all text-left">
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{d.value}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{d.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Dismiss Settings */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setAutoDismissEnabled(!autoDismissEnabled) }}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoDismissEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoDismissEnabled ? 'left-5.5 translate-x-0' : 'left-0.5'}`} style={{ transform: autoDismissEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto-Dismiss Low Confidence</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Automatically filter out anomalies below the confidence threshold</p>
            </div>
          </div>
          {autoDismissEnabled && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Min: {minConfidence}%</span>
              <input type="range" min="0" max="90" step="5" value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-32 accent-indigo-500" />
              <div className="flex gap-1">
                {[0, 30, 50, 70].map(v => (
                  <button key={v} onClick={() => setMinConfidence(v)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${minConfidence === v ? 'bg-indigo-500 text-white border-indigo-500' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'}`}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {autoDismissEnabled && minConfidence > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="text-indigo-500 font-medium">Active:</span>
            <span className="text-slate-500 dark:text-slate-400">Anomalies below {minConfidence}% confidence will be hidden from results</span>
            {data.auto_dismissed_count != null && (
              <span className="text-slate-400">({data.auto_dismissed_count} shown after filtering)</span>
            )}
          </div>
        )}
      </div>

      {/* Filters + Alerts */}
      <div className="card">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anomalies..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
            </div>
            <button onClick={() => setSalesOnly(!salesOnly)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${salesOnly ? 'bg-green-50 border-green-400 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-green-300 dark:hover:border-green-700'}`}>
              Sales Only
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="all">All Methods</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="severity">Sort by Severity</option>
              <option value="confidence">Sort by Confidence</option>
              <option value="date">Sort by Date</option>
            </select>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg dark:bg-slate-800">
              <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}><List size={14} /></button>
              <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Download size={12} /> CSV
            </button>
            <button onClick={exportPDF} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <FileText size={12} /> PDF
            </button>
          </div>
        </div>

        {activeFilters > 0 && (
          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <span className="text-slate-400">{visibleCount} results · {activeFilters} filter{activeFilters > 1 ? 's' : ''} active</span>
            <button onClick={() => { setSeverityFilter('all'); setCategoryFilter('all'); setMethodFilter('all'); setSalesOnly(false); setSearch('') }}
              className="text-indigo-500 hover:text-indigo-700 font-medium">Clear all</button>
          </div>
        )}

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40 text-green-500" />
            <p className="text-sm">No anomalies match your filters.</p>
            <p className="text-[10px] text-slate-400 mt-1">{dismissedCount > 0 ? `${dismissedCount} anomalies dismissed` : 'All clear!'}</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-1">
            {alerts.map((a) => {
              const MIcon = METHOD_ICONS[a.anomaly_type] || AlertOctagon
              return (
                <div key={`${a.id}-${a.anomaly_type}`} onClick={() => setSelectedAnomaly(a)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group cursor-pointer">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: SEVERITY_COLORS[a.severity] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <MIcon size={9} /> {METHOD_LABELS[a.anomaly_type] || a.anomaly_type}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{CATEGORY_LABELS[a.category] || a.category}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{(a.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{a.description}</p>
                    {a.suggested_action && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{a.suggested_action}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
                    <button onClick={(e) => { e.stopPropagation(); dismissAnomaly(a) }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss">
                      <EyeOff size={12} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((a) => (
              <button key={`${a.id}-${a.anomaly_type}`} onClick={() => setSelectedAnomaly(a)}
                className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{a.description}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{METHOD_LABELS[a.anomaly_type] || a.anomaly_type}</span>
                  <span className="text-[10px] text-slate-400">{(a.confidence * 100).toFixed(0)}%</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <DetailModal anomaly={selectedAnomaly} onClose={() => setSelectedAnomaly(null)} onDismiss={dismissAnomaly} />
    </div>
  )
}
