import { useEffect, useState } from 'react'
import api from '../services/api'
import { Loading, PageHeader, StatCard, EmptyState, Badge } from '../components/ui.jsx'
import { ShieldAlert, Percent, AlertOctagon, Filter, LayoutGrid, List } from 'lucide-react'

const SEVERITY_TONE = { high: 'red', medium: 'amber', low: 'blue' }
const SEVERITY_ICON = { high: '🔴', medium: '🟠', low: '🟡' }
const CATEGORY_LABEL = { sales: 'Unusual sales activity', inventory: 'Inventory anomaly', revenue: 'Revenue pattern deviation' }

export default function Anomalies() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'

  useEffect(() => {
    api.get('/ai/anomalies').then((res) => setData(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Scanning for anomalies..." />
  if (!data || data.alerts.length === 0) {
    return (
      <div>
        <PageHeader title="Anomaly Detection" subtitle="Fraud detection and unusual activity alerts." />
        <EmptyState message="No anomalies detected — everything looks normal." />
      </div>
    )
  }

  const filteredAlerts = data.alerts.filter((a) => severityFilter === 'all' || a.severity === severityFilter)
  const highSeverity = data.alerts.filter((a) => a.severity === 'high').length

  return (
    <div>
      <PageHeader title="Anomaly Detection" subtitle="Isolation Forest model monitoring sales, inventory, and revenue patterns." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="High Severity Alerts" value={highSeverity} icon={AlertOctagon} tone="red" />
        <StatCard label="Detection Accuracy" value={data.detection_accuracy != null ? `${(data.detection_accuracy * 100).toFixed(1)}%` : '—'} icon={Percent} />
        <StatCard label="False Positive Rate" value={data.false_positive_rate != null ? `${(data.false_positive_rate * 100).toFixed(1)}%` : '—'} icon={ShieldAlert} tone="amber" />
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">AI Alerts</h3>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
              <Filter size={14} className="ml-1 text-slate-400 dark:text-slate-500" />
              {['all', 'high', 'medium', 'low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                    severityFilter === sev ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg dark:bg-slate-800">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-6 dark:text-slate-500">No alerts found for this severity filter.</p>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredAlerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-700/60">
                <span className="text-lg leading-none pt-0.5">{SEVERITY_ICON[a.severity] || '⚪'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={SEVERITY_TONE[a.severity] || 'slate'}>{a.severity}</Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{CATEGORY_LABEL[a.category] || a.category}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{a.description}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap dark:text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAlerts.map((a) => (
              <div key={a.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex flex-col justify-between gap-2 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge tone={SEVERITY_TONE[a.severity] || 'slate'}>{a.severity}</Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium mb-1 dark:text-slate-100">{a.description}</p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{CATEGORY_LABEL[a.category] || a.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}