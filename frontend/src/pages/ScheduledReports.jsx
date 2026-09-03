import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { Loading, PageHeader, Badge } from '../components/ui.jsx'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'
import {
  Calendar, Clock, Mail, Send, Plus, Trash2, Edit3, Check, X,
  FileText, Download, RefreshCw, Users, Bell, Eye,
  ShoppingCart, Boxes, IndianRupee, BarChart3, LayoutTemplate, AlertTriangle,
} from 'lucide-react'

const STORAGE_KEY = 'marketmind-scheduled-reports'
const HISTORY_KEY = 'marketmind-report-delivery-history'

const REPORT_TYPES = [
  { id: 'sales-summary', name: 'Sales Summary', icon: ShoppingCart, color: 'indigo', sections: ['kpi_cards', 'top_products', 'sales_by_date', 'recent_sales'] },
  { id: 'inventory-status', name: 'Inventory Status', icon: Boxes, color: 'amber', sections: ['kpi_cards', 'low_stock_alerts', 'product_list', 'category_breakdown'] },
  { id: 'customer-analysis', name: 'Customer Analysis', icon: Users, color: 'blue', sections: ['kpi_cards', 'segment_breakdown', 'top_customers'] },
  { id: 'financial-overview', name: 'Financial Overview', icon: IndianRupee, color: 'green', sections: ['kpi_cards', 'revenue_trend', 'invoice_status'] },
  { id: 'anomaly-report', name: 'Anomaly Report', icon: AlertTriangle, color: 'red', sections: ['anomaly_summary', 'severity_breakdown', 'top_anomalies'] },
  { id: 'executive-dashboard', name: 'Executive Dashboard', icon: LayoutTemplate, color: 'purple', sections: ['kpi_cards', 'business_pulse', 'revenue_trend', 'top_products'] },
]

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', icon: Clock, description: 'Every day at 9:00 AM' },
  { id: 'weekly', label: 'Weekly', icon: Calendar, description: 'Every Monday at 9:00 AM' },
  { id: 'monthly', label: 'Monthly', icon: Calendar, description: '1st of every month at 9:00 AM' },
]

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-600' },
  { id: 'excel', label: 'Excel', icon: Download, color: 'text-green-600' },
  { id: 'both', label: 'Both', icon: FileText, color: 'text-indigo-600' },
]

const COLOR_MAP = {
  indigo: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border-indigo-200 dark:border-indigo-800',
  amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-200 dark:border-amber-800',
  blue: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 border-blue-200 dark:border-blue-800',
  green: 'bg-green-50 dark:bg-green-950/20 text-green-600 border-green-200 dark:border-green-800',
  red: 'bg-red-50 dark:bg-red-950/20 text-red-600 border-red-200 dark:border-red-800',
  purple: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 border-purple-200 dark:border-purple-800',
}

function getDefaultSchedule() {
  return {
    id: `sched_${Date.now()}`,
    reportType: 'sales-summary',
    frequency: 'weekly',
    format: 'pdf',
    recipients: [],
    enabled: true,
    nextRun: null,
    createdAt: new Date().toISOString(),
    lastRun: null,
  }
}

// ─── Recipient Input ──────────────────────────────────────────────────
function RecipientInput({ recipients, onChange }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')

  const addRecipient = () => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) return
    if (recipients.includes(trimmed)) return
    onChange([...recipients, trimmed])
    setEmail('')
  }

  const removeRecipient = (idx) => {
    onChange(recipients.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
        <Mail size={12} className="inline mr-1" />
        {t('scheduled.emailRecipients')}
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRecipient()}
          placeholder={t('scheduled.enterEmail')}
          className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:text-white placeholder-slate-400"
        />
        <button onClick={addRecipient} className="btn-primary text-xs px-3 py-2">
          <Plus size={12} />
        </button>
      </div>
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-medium text-slate-600 dark:text-slate-300">
              {r}
              <button onClick={() => removeRecipient(i)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Schedule Form Modal ──────────────────────────────────────────────
function ScheduleForm({ schedule, onSave, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(schedule || getDefaultSchedule())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {schedule ? t('scheduled.editSchedule') : t('scheduled.newSchedule')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Report Type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('scheduled.reportType')}</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(rt => {
                const Icon = rt.icon
                return (
                  <button key={rt.id} onClick={() => setForm({ ...form, reportType: rt.id })}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-xs ${form.reportType === rt.id ? `${COLOR_MAP[rt.color]} border-current` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <Icon size={14} />
                    <span className="font-medium">{rt.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('scheduled.frequency')}</label>
            <div className="flex gap-2">
              {FREQUENCIES.map(f => {
                const Icon = f.icon
                return (
                  <button key={f.id} onClick={() => setForm({ ...form, frequency: f.id })}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${form.frequency === f.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <Icon size={16} className={`mx-auto mb-1 ${form.frequency === f.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{f.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{f.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('scheduled.format')}</label>
            <div className="flex gap-2">
              {FORMATS.map(f => {
                const Icon = f.icon
                return (
                  <button key={f.id} onClick={() => setForm({ ...form, format: f.id })}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${form.format === f.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <Icon size={14} className={f.color} />
                    <span className="text-xs font-bold">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recipients */}
          <RecipientInput recipients={form.recipients} onChange={recipients => setForm({ ...form, recipients })} />

          {/* Enabled toggle */}
          <label className="flex items-center justify-between py-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('scheduled.enabled')}</span>
            <div className={`w-9 h-5 rounded-full cursor-pointer transition-colors relative ${form.enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              onClick={() => setForm({ ...form, enabled: !form.enabled })}>
              <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${form.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary text-xs">{t('common.cancel')}</button>
          <button onClick={() => onSave(form)} className="btn-primary text-xs flex items-center gap-1.5">
            <Check size={12} /> {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delivery History ─────────────────────────────────────────────────
function DeliveryHistory({ history, onClose }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-indigo-500" /> {t('scheduled.deliveryHistory')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="text-center py-10">
              <Send size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{t('scheduled.noDeliveries')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${h.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {h.status === 'success' ? <Check size={14} className="text-green-600" /> : <X size={14} className="text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{h.reportName}</p>
                    <p className="text-[10px] text-slate-400">{h.recipients?.length || 0} recipients · {h.format?.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">{new Date(h.sentAt).toLocaleDateString()}</p>
                    <p className="text-[9px] text-slate-400">{new Date(h.sentAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function ScheduledReports() {
  const { t } = useTranslation()
  const [schedules, setSchedules] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editSchedule, setEditSchedule] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [deliveryHistory, setDeliveryHistory] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load from localStorage
  useEffect(() => {
    try {
      setSchedules(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
      setDeliveryHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'))
    } catch { /* ignore */ }
  }, [])

  // Load data for instant report generation
  useEffect(() => {
    Promise.all([
      api.get('/analytics/kpis').catch(() => ({ data: {} })),
      api.get('/sales/').catch(() => ({ data: [] })),
      api.get('/inventory/products').catch(() => ({ data: [] })),
      api.get('/customers/').catch(() => ({ data: [] })),
      api.get('/invoices/').catch(() => ({ data: [] })),
    ]).then(([kpis, sales, products, customers, invoices]) => {
      setData({
        kpis: kpis.data,
        sales: Array.isArray(sales.data) ? sales.data : [],
        products: Array.isArray(products.data) ? products.data : [],
        customers: Array.isArray(customers.data) ? customers.data : [],
        invoices: Array.isArray(invoices.data) ? invoices.data : (invoices.data?.items || []),
      })
    }).finally(() => setLoading(false))
  }, [])

  const saveSchedule = useCallback((schedule) => {
    setSchedules(prev => {
      const exists = prev.findIndex(s => s.id === schedule.id)
      const updated = exists >= 0 ? prev.map((s, i) => i === exists ? schedule : s) : [...prev, schedule]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
    setShowForm(false)
    setEditSchedule(null)
  }, [])

  const deleteSchedule = useCallback((id) => {
    setSchedules(prev => {
      const updated = prev.filter(s => s.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const toggleSchedule = useCallback((id) => {
    setSchedules(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const sendNow = useCallback((schedule) => {
    const reportType = REPORT_TYPES.find(rt => rt.id === schedule.reportType)
    if (!reportType || !data) return

    const now = new Date()
    const record = {
      reportName: reportType.name,
      format: schedule.format,
      recipients: schedule.recipients,
      sentAt: now.toISOString(),
      status: 'success',
    }

    // Generate and send
    if (schedule.format === 'pdf' || schedule.format === 'both') {
      const headers = ['Metric', 'Value']
      const rows = [
        ['Report', reportType.name],
        ['Generated', now.toLocaleString()],
        ['Recipients', schedule.recipients.join(', ') || 'N/A'],
      ]
      if (data.kpis) {
        rows.push(['Revenue', `₹${(data.kpis.total_revenue || 0).toLocaleString('en-IN')}`])
        rows.push(['Total Sales', String(data.kpis.total_sales || 0)])
        rows.push(['Customers', String(data.kpis.total_customers || 0)])
      }
      exportToPDF({ title: `${reportType.name} Report`, subtitle: `Scheduled · ${now.toLocaleDateString()}`, headers, rows, filename: `${reportType.id}-scheduled` })
    }
    if (schedule.format === 'excel' || schedule.format === 'both') {
      const headers = ['Metric', 'Value']
      const rows = [['Report', reportType.name], ['Generated', now.toLocaleString()]]
      if (data.kpis) {
        rows.push(['Revenue', data.kpis.total_revenue || 0])
        rows.push(['Total Sales', data.kpis.total_sales || 0])
      }
      exportToExcel({ title: `${reportType.name} Report`, headers, rows, filename: `${reportType.id}-scheduled` })
    }

    setDeliveryHistory(prev => {
      const updated = [record, ...prev].slice(0, 50)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      return updated
    })

    setSchedules(prev => {
      const updated = prev.map(s => s.id === schedule.id ? { ...s, lastRun: now.toISOString() } : s)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [data])

  if (loading) return <Loading label="Loading..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('scheduled.title')}
        subtitle={`${schedules.length} ${t('scheduled.schedulesConfigured')}`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(true)} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Clock size={14} /> {t('scheduled.history')}
            </button>
            <button onClick={() => { setEditSchedule(null); setShowForm(true) }} className="btn-primary flex items-center gap-1.5 text-xs">
              <Plus size={14} /> {t('scheduled.newSchedule')}
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-indigo-600">{schedules.length}</p>
          <p className="text-[10px] text-slate-500 uppercase">{t('scheduled.totalSchedules')}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">{schedules.filter(s => s.enabled).length}</p>
          <p className="text-[10px] text-slate-500 uppercase">{t('scheduled.active')}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">{deliveryHistory.length}</p>
          <p className="text-[10px] text-slate-500 uppercase">{t('scheduled.delivered')}</p>
        </div>
      </div>

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">{t('scheduled.noSchedules')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('scheduled.clickToCreate')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(schedule => {
            const rt = REPORT_TYPES.find(r => r.id === schedule.reportType)
            const freq = FREQUENCIES.find(f => f.id === schedule.frequency)
            const fmt = FORMATS.find(f => f.id === schedule.format)
            const Icon = rt?.icon || FileText
            return (
              <div key={schedule.id} className={`card flex items-center gap-4 transition-all ${!schedule.enabled ? 'opacity-50' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLOR_MAP[rt?.color || 'indigo']}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{rt?.name || schedule.reportType}</p>
                    <Badge tone={schedule.enabled ? 'green' : 'slate'}>{schedule.enabled ? t('scheduled.active') : t('scheduled.paused')}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock size={10} /> {freq?.label}</span>
                    <span className="flex items-center gap-1"><FileText size={10} /> {fmt?.label}</span>
                    <span className="flex items-center gap-1"><Mail size={10} /> {schedule.recipients.length || 0} {t('scheduled.recipients')}</span>
                    {schedule.lastRun && <span>{t('scheduled.lastRun')}: {new Date(schedule.lastRun).toLocaleDateString()}</span>}
                  </div>
                  {schedule.recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {schedule.recipients.slice(0, 3).map((r, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">{r}</span>
                      ))}
                      {schedule.recipients.length > 3 && <span className="text-[9px] text-slate-400">+{schedule.recipients.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => sendNow(schedule)} className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-500 transition-colors" title={t('scheduled.sendNow')}>
                    <Send size={14} />
                  </button>
                  <button onClick={() => toggleSchedule(schedule.id)} className={`p-2 rounded-lg transition-colors ${schedule.enabled ? 'hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-500' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-500'}`} title={schedule.enabled ? t('scheduled.pause') : t('scheduled.resume')}>
                    {schedule.enabled ? <RefreshCw size={14} /> : <Check size={14} />}
                  </button>
                  <button onClick={() => { setEditSchedule(schedule); setShowForm(true) }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors" title={t('common.edit')}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => deleteSchedule(schedule.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-400 transition-colors" title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ScheduleForm
          schedule={editSchedule}
          onSave={saveSchedule}
          onClose={() => { setShowForm(false); setEditSchedule(null) }}
        />
      )}
      {showHistory && (
        <DeliveryHistory
          history={deliveryHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
