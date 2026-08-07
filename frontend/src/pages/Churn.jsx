import { useEffect, useState } from 'react'
import api from '../services/api'
import { Loading, PageHeader, StatCard, EmptyState, Badge } from '../components/ui.jsx'
import { UserMinus, Percent, Search } from 'lucide-react'

const RISK_TONE = { High: 'red', Medium: 'amber', Low: 'green' }

export default function Churn() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [riskFilter, setRiskFilter] = useState('All')
  const [search, setSearch] = useState('')

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
  const filteredRows = data.rows.filter((r) => {
    const matchesRisk = riskFilter === 'All' || r.risk_category === riskFilter
    const matchesSearch = r.customer_name.toLowerCase().includes(search.toLowerCase())
    return matchesRisk && matchesSearch
  })

  return (
    <div>
      <PageHeader title="Churn Prediction" subtitle="Classification model (Random Forest) trained on purchase inactivity and engagement." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="High-Risk Customers" value={highRisk} icon={UserMinus} tone="red" />
        <StatCard label="Model Accuracy" value={data.accuracy != null ? `${(data.accuracy * 100).toFixed(1)}%` : '—'} icon={Percent} />
        <StatCard label="Precision" value={data.precision ?? '—'} />
        <StatCard label="F1-Score" value={data.f1 ?? '—'} />
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-slate-800">Customer Churn Risk</h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input text-xs pl-8 py-1.5"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              {['All', 'High', 'Medium', 'Low'].map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskFilter(level)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    riskFilter === level ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {filteredRows.map((r) => (
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
    </div>
  )
}