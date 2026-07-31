import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Loading, PageHeader, StatCard, EmptyState, Badge } from '../components/ui.jsx'
import { ShieldAlert, Percent, AlertOctagon } from 'lucide-react'

const SEVERITY_TONE = { high: 'red', medium: 'amber', low: 'blue' }
const SEVERITY_ICON = { high: '🔴', medium: '🟠', low: '🟡' }
const CATEGORY_LABEL = { sales: 'Unusual sales activity', inventory: 'Inventory anomaly', revenue: 'Revenue pattern deviation' }

export default function Anomalies() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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
        <h3 className="font-semibold text-slate-800 mb-4">AI Alerts</h3>
        <div className="space-y-2">
          {data.alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0">
              <span className="text-lg leading-none pt-0.5">{SEVERITY_ICON[a.severity] || '⚪'}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={SEVERITY_TONE[a.severity] || 'slate'}>{a.severity}</Badge>
                  <span className="text-xs text-slate-400">{CATEGORY_LABEL[a.category] || a.category}</span>
                </div>
                <p className="text-sm text-slate-700">{a.description}</p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
