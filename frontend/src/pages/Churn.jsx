import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Loading, PageHeader, StatCard, EmptyState, Badge } from '../components/ui.jsx'
import { UserMinus, Percent } from 'lucide-react'

const RISK_TONE = { High: 'red', Medium: 'amber', Low: 'green' }

export default function Churn() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ai/churn').then((res) => setData(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Running churn prediction model..." />
  if (!data || data.rows.length === 0) {
    return (
      <div>
        <PageHeader title="Churn Prediction" subtitle="Customer retention risk analysis." />
        <EmptyState message="Not enough customer history to predict churn yet." />
      </div>
    )
  }

  const highRisk = data.rows.filter((r) => r.risk_category === 'High').length

  return (
    <div>
      <PageHeader title="Churn Prediction" subtitle="Classification model (Random Forest) trained on purchase inactivity and engagement." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="High-Risk Customers" value={highRisk} icon={UserMinus} tone="red" />
        <StatCard label="Model Accuracy" value={data.accuracy != null ? `${(data.accuracy * 100).toFixed(1)}%` : '—'} icon={Percent} />
        <StatCard label="Precision" value={data.precision ?? '—'} />
        <StatCard label="F1-Score" value={data.f1 ?? '—'} />
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Customer Churn Risk</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Risk</th>
              <th className="py-2 pr-4">Probability</th>
              <th className="py-2 pr-4">AI Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.customer_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-800">{r.customer_name}</td>
                <td className="py-2 pr-4"><Badge tone={RISK_TONE[r.risk_category]}>{r.risk_category}</Badge></td>
                <td className="py-2 pr-4">{(r.churn_probability * 100).toFixed(0)}%</td>
                <td className="py-2 pr-4 text-slate-500 max-w-md">{r.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
