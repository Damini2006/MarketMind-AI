import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import {Loading, PageHeader, Badge, TableSkeleton, PageSkeleton} from '../components/ui.jsx'
import jsPDF from 'jspdf'
import {
  AlertOctagon, LayoutGrid, List,
  Search, Download, RefreshCw, X, BarChart3, PieChart,
  TrendingUp, Sparkles, Info,
  Clock, Database, Activity, EyeOff, CheckCircle2, XCircle,
  TrendingDown, Zap, Target, Layers, Calendar, FileText, ShoppingCart
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
  business_rule_large_qty: 'Large Quantity Sale',
  business_rule_depletion: 'Stock Depletion',
}
const METHOD_ICONS = {
  zscore: Target, iqr: Layers, isolation_forest: Zap,
  moving_avg: TrendingUp, temporal: Calendar, benford: Activity,
  price_anomaly: TrendingDown, velocity: Clock, concentration: PieChart,
  margin: BarChart3, turnover: RefreshCw, out_of_stock: AlertOctagon,
  round_number: Info, revenue_gap: XCircle,
  seasonal: TrendingUp, duplicate: AlertOctagon,
  business_rule_large_qty: ShoppingCart,
  business_rule_depletion: AlertOctagon,
}

function TimelineChart({ data, onBarClick, selectedDate }) {
  const { t } = useTranslation()
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.total || 0), 1)
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.timeline')}</span>
          {selectedDate && <span className="text-[10px] text-indigo-500 font-medium">— filtering {selectedDate}</span>}
        </div>
        <span className="text-[10px] text-slate-400">{data.length} {t('anomalies.daysWithAnomalies')}</span>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto">
        {data.map((d, i) => (
          <button key={i} onClick={() => onBarClick(d.date)}
            className={`flex flex-col items-center gap-1 min-w-[28px] flex-1 group rounded transition-all ${selectedDate === d.date ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-1 ring-indigo-400' : ''}`} title={d.date}>
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
      <div className="flex items-center gap-3 mt-2 justify-center">            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-red-400" /> {t('anomalies.highLabel')}</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t('anomalies.mediumLabel')}</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-400" /> {t('anomalies.lowLabel')}</span>
      </div>
    </div>
  )
}

function ConfidenceChart({ data }) {
  const { t } = useTranslation()
  if (!data) return null
  const entries = Object.entries(data)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  const colors = { 'high (>85%)': '#22c55e', 'medium (60-85%)': '#f59e0b', 'low (<60%)': '#3b82f6' }
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Target size={14} className="text-emerald-500" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.confidenceDist')}</span>
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
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 h-24" style={{ minWidth: `${data.length * 48}px` }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[36px]">
            <div className="w-full rounded-t transition-all duration-500 hover:opacity-80"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color || '#3b5bdb', minHeight: '4px' }}
              title={`${d.label}: ${d.value}`} />
            <span className="text-[9px] text-slate-400 dark:text-slate-500 w-full text-center leading-tight">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniPieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const slices = useMemo(() => {
    let running = 0
    const result = []
    for (const d of data) {
      const pct = (d.value / total) * 100
      const offset = 100 - (running / total) * 100
      running += d.value
      result.push({ ...d, pct, offset })
    }
    return result
  }, [data, total])
  return (
    <div className="flex items-center gap-3">
      <svg width="80" height="80" viewBox="0 0 36 36">
        {slices.map((d, i) => (
            <circle key={i} cx="18" cy="18" r="15.915" fill="none"
              stroke={d.color} strokeWidth="3.5"
              strokeDasharray={`${d.pct} ${100 - d.pct}`} strokeDashoffset={d.offset}
              className="transition-all duration-500" />
          ))}
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
  const { t } = useTranslation()
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('common.confidence')}</span>
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
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><Sparkles size={12} /> {t('anomalies.suggestedAction')}</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{anomaly.suggested_action}</p>
            </div>
          )}

          {anomaly.affected_entity && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {t('anomalies.affected')} <span className="font-medium text-slate-700 dark:text-slate-300">{anomaly.affected_entity}</span>
            </p>
          )}

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">{t('anomalies.technicalDetails')}</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(meta).map(([key, val]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {typeof val === 'number' ? val.toLocaleString() : Array.isArray(val) ? val.length + ' ' + t('anomalies.items') : String(val)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button onClick={() => onDismiss(anomaly)} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1">
              <CheckCircle2 size={12} /> {t('anomalies.markReviewed')}
            </button>
            <button onClick={onClose} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Anomalies() {
  const { t } = useTranslation()
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
  const [dateFilter, setDateFilter] = useState('')

  const rescanAnomalies = useCallback(() => {
    setScanning(true)
    api.post('/ai/anomalies/rescan')
      .then((res) => setData(res.data || { alerts: [] }))
      .catch(() => setData({ alerts: [], summary: {} }))
      .finally(() => setScanning(false))
  }, [])

  // Fetch once on mount (async — setState only in .then(), not synchronous)
  useEffect(() => {
    let cancelled = false
    api.get('/ai/anomalies')
      .then((res) => { if (!cancelled) setData(res.data || { alerts: [] }) })
      .catch(() => { if (!cancelled) setData({ alerts: [], summary: {} }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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
    if (dateFilter) {
      list = list.filter(a => {
        if (!a.created_at) return false
        const d = new Date(a.created_at)
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return ymd === dateFilter
      })
    }

    const sevOrder = { high: 0, medium: 1, low: 2 }
    list.sort((a, b) => {
      if (sortBy === 'severity') return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3)
      if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
    return list
  }, [data.alerts, severityFilter, categoryFilter, methodFilter, search, sortBy, salesOnly, dismissed, showDismissed, dateFilter])

  const activeFilters = [severityFilter !== 'all', categoryFilter !== 'all', methodFilter !== 'all', salesOnly, !!search, !!dateFilter].filter(Boolean).length

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

  if (loading) return <Loading label={t('anomalies.loadingMessage')} />

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('anomalies.title')}
        subtitle={`${visibleCount} anomalies${dismissedCount > 0 ? ` (${dismissedCount} dismissed)` : ''} · ${methodsUsed} detection techniques · ${(data.total_records_scanned || 0).toLocaleString()} records scanned`}
        action={
          <div className="flex items-center gap-2">
            {scanning && <span className="flex items-center gap-1 text-xs text-indigo-500"><RefreshCw size={12} className="animate-spin" /> Scanning...</span>}
            <button onClick={rescanAnomalies} disabled={scanning}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} /> {scanning ? t('anomalies.scanning') : t('anomalies.rescan')}
            </button>
          </div>
        }
      />

      {/* Scan Info Bar */}
      {data.scan_timestamp && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock size={10} /> {t('anomalies.lastScan')} {new Date(data.scan_timestamp).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Database size={10} /> {(data.total_records_scanned || 0).toLocaleString()} {t('anomalies.recordsScanned')}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Zap size={10} /> {methodsUsed} {t('anomalies.techniquesActive')}
          </span>
          {data.detection_accuracy != null && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Target size={10} /> {(data.detection_accuracy * 100).toFixed(0)}% {t('anomalies.accuracy')}
            </span>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button onClick={() => setSeverityFilter('all')} className="card text-center p-3 hover:shadow-md transition-all cursor-pointer">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.total')}</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'high' ? 'border-red-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-red-600">{highCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.high')}</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'medium' ? 'border-amber-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-amber-600">{medCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.medium')}</p>
        </button>
        <button onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${severityFilter === 'low' ? 'border-blue-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-blue-600">{lowCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.low')}</p>
        </button>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-emerald-600">{data.detection_accuracy != null ? `${(data.detection_accuracy * 100).toFixed(0)}%` : '—'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.accuracy')}</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-slate-600">{data.false_positive_rate != null ? `${(data.false_positive_rate * 100).toFixed(1)}%` : '—'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.falsePos')}</p>
        </div>
        <button onClick={() => setShowDismissed(!showDismissed)}
          className={`card text-center p-3 hover:shadow-md transition-all cursor-pointer border-2 ${showDismissed ? 'border-slate-400' : 'border-transparent'}`}>
          <p className="text-2xl font-bold text-slate-600">{dismissedCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{t('anomalies.dismissed')}</p>
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
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('anomalies.weekOverWeek')}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{weekComparison.thisCount}</p>
                  <p className="text-[9px] text-slate-400 uppercase">{t('anomalies.thisWeek')}</p>
                </div>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-500 dark:text-slate-400">{weekComparison.lastCount}</p>
                  <p className="text-[9px] text-slate-400 uppercase">{t('anomalies.lastWeek')}</p>
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
                  <span className="text-red-500">{t('anomalies.highVs')} {weekComparison.thisHigh} {t('anomalies.vs')} {weekComparison.lastHigh}</span>
                  <span className="text-amber-500">{t('anomalies.medVs')} {weekComparison.thisMed} {t('anomalies.vs')} {weekComparison.lastMed}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
            {weekComparison.direction === 'increasing' && t('anomalies.countIncreasing')}
            {weekComparison.direction === 'decreasing' && t('anomalies.countDecreasing')}
            {weekComparison.direction === 'stable' && t('anomalies.countStable')}
          </p>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <TimelineChart data={data.timeline} onBarClick={(date) => setDateFilter(dateFilter === date ? '' : date)} selectedDate={dateFilter} />
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
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.byCategory')}</span>
          </div>
          <MiniPieChart data={categoryData} />
        </button>
        <button onClick={() => setActiveChart(activeChart === 'method' ? null : 'method')}
          className={`card text-left hover:shadow-md transition-all cursor-pointer ${activeChart === 'method' ? 'ring-2 ring-indigo-400' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.byMethod')}</span>
          </div>
          <MiniBarChart data={methodData} color="#3b5bdb" />
        </button>
      </div>

      {/* Expanded Charts */}
      {activeChart === 'category' && (
        <div className="card">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-3">{t('anomalies.categoryBreakdown')}</h3>
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
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-3">{t('anomalies.methodBreakdown')}</h3>
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

      {/* Severity Heatmap: Category × Detection Method */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.severityHeatmap')}</span>
          <span className="text-[10px] text-slate-400 ml-auto">{t('anomalies.categoryMethod')}</span>
        </div>
        {(() => {
          const allAlerts = data.alerts || []
          const cats = [...new Set(allAlerts.map(a => a.category))].sort()
          const methods = [...new Set(allAlerts.map(a => a.anomaly_type))].sort()
          const grid = {}
          allAlerts.forEach(a => {
            const key = `${a.category}|${a.anomaly_type}`
            if (!grid[key]) grid[key] = { high: 0, medium: 0, low: 0 }
            grid[key][a.severity]++
          })
          if (cats.length === 0 || methods.length === 0) return <p className="text-xs text-slate-400">{t('common.noData')}</p>
          return (
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid gap-px" style={{ gridTemplateColumns: `120px repeat(${methods.length}, 1fr)` }}>
                  <div />{methods.map(m => (
                    <div key={m} className="text-[9px] text-slate-500 dark:text-slate-400 text-center px-1 py-1 truncate" title={METHOD_LABELS[m] || m}>{METHOD_LABELS[m] || m}</div>
                  ))}
                  {cats.map(cat => (
                    <React.Fragment key={cat}>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium pr-2 py-1 truncate">{CATEGORY_LABELS[cat] || cat}</div>
                      {methods.map(m => {
                        const cell = grid[`${cat}|${m}`]
                        const total = cell ? cell.high + cell.medium + cell.low : 0
                        const intensity = Math.min(total / 8, 1)
                        const bg = total === 0 ? 'transparent' : cell.high > cell.medium ? `rgba(239,68,68,${0.15 + intensity * 0.6})` : cell.medium > 0 ? `rgba(245,158,11,${0.15 + intensity * 0.5})` : `rgba(59,130,246,${0.15 + intensity * 0.5})`
                        return (
                          <button key={m} onClick={() => { setCategoryFilter(cat); setMethodFilter(m); setActiveChart(null) }}
                            className="rounded text-center py-1.5 transition-all hover:ring-1 hover:ring-indigo-400"
                            style={{ backgroundColor: bg }}
                            title={`${CATEGORY_LABELS[cat]} × ${METHOD_LABELS[m] || m}: ${total} anomalies`}>
                            {total > 0 && <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{total}</span>}
                          </button>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Top Affected Entities + Anomaly Freshness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Affected Entities */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-red-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.mostFlagged')}</span>
          </div>
          {(() => {
            const allAlerts = data.alerts || []
            const entityCounts = {}
            allAlerts.forEach(a => {
              const entity = a.affected_entity || 'Unknown'
              if (!entityCounts[entity]) entityCounts[entity] = { total: 0, high: 0, methods: new Set() }
              entityCounts[entity].total++
              if (a.severity === 'high') entityCounts[entity].high++
              entityCounts[entity].methods.add(a.anomaly_type)
            })
            const sorted = Object.entries(entityCounts)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 5)
            if (sorted.length === 0) return <p className="text-xs text-slate-400">{t('common.noData')}</p>
            const maxCount = sorted[0][1].total
            return (
              <div className="space-y-2">
                {sorted.map(([entity, info]) => (
                  <button key={entity} onClick={() => { setSearch(entity); setActiveChart(null) }}
                    className="w-full text-left group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]" title={entity}>{entity}</span>
                      <span className="text-[10px] text-slate-400">{info.total} alerts{info.high > 0 ? ` · ${info.high} high` : ''}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-500"
                        style={{ width: `${(info.total / maxCount) * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Anomaly Freshness */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('anomalies.freshness')}</span>
          </div>
          {(() => {
            const allAlerts = data.alerts || []
            const now = new Date()
            const buckets = { 'Last 7 days': 0, '7-30 days': 0, '30-90 days': 0, 'Older than 90 days': 0 }
            allAlerts.forEach(a => {
              if (!a.created_at) return
              const age = (now - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
              if (age <= 7) buckets['Last 7 days']++
              else if (age <= 30) buckets['7-30 days']++
              else if (age <= 90) buckets['30-90 days']++
              else buckets['Older than 90 days']++
            })
            const entries = Object.entries(buckets)
            const maxAge = Math.max(...entries.map(([, v]) => v), 1)
            const colors = { 'Last 7 days': '#22c55e', '7-30 days': '#f59e0b', '30-90 days': '#f97316', 'Older than 90 days': '#ef4444' }
            return (
              <div className="space-y-2">
                {entries.map(([label, count]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 w-28 shrink-0 text-right">{label}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxAge) * 100}%`, backgroundColor: colors[label], minWidth: count > 0 ? '18px' : '0' }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Filters + Alerts */}
      <div className="card">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}              placeholder={t('anomalies.search')}
                className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
            </div>
            <button onClick={() => setSalesOnly(!salesOnly)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${salesOnly ? 'bg-green-50 border-green-400 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-green-300 dark:hover:border-green-700'}`}>
              {t('anomalies.salesOnly')}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="all">{t('anomalies.allCategories')}</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="all">{t('anomalies.allMethods')}</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300">
              <option value="severity">{t('anomalies.sortSeverity')}</option>
              <option value="confidence">{t('anomalies.sortConfidence')}</option>
              <option value="date">{t('anomalies.sortDate')}</option>
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
          <div className="flex items-center gap-2 mb-3 text-[11px] flex-wrap">
            <span className="text-slate-400">{t('anomalies.resultsFilters', { count: visibleCount, filters: activeFilters })}</span>
            {dateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                <Calendar size={10} /> {dateFilter}
                <button onClick={() => setDateFilter('')} className="hover:text-indigo-900 dark:hover:text-indigo-200"><X size={10} /></button>
              </span>
            )}
            <button onClick={() => { setSeverityFilter('all'); setCategoryFilter('all'); setMethodFilter('all'); setSalesOnly(false); setSearch(''); setDateFilter('') }}
              className="text-indigo-500 hover:text-indigo-700 font-medium">{t('anomalies.clearAll')}</button>
          </div>
        )}

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40 text-green-500" />
            <p className="text-sm">{t('anomalies.noMatch')}</p>
            <p className="text-[10px] text-slate-400 mt-1">{dismissedCount > 0 ? t('anomalies.dismissedCount', { count: dismissedCount }) : t('anomalies.allClear')}</p>
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
