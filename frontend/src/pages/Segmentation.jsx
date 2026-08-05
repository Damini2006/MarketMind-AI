import  { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'

const COLORS = ['#3b5bdb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
const SEGMENT_TONE = {
  'High Value Customers': 'green',
  'Regular Customers': 'blue',
  'Occasional Customers': 'amber',
  'Low Engagement Customers': 'red',
  'No Purchase History': 'slate',
}

export default function Segmentation() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ai/segmentation').then((res) => setData(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Running customer segmentation model..." />
  if (!data || data.segments.length === 0) {
    return (
      <div>
        <PageHeader title="Customer Segmentation" subtitle="AI-driven behavioral clustering (K-Means)." />
        <EmptyState message="Not enough customer purchase history to build segments yet." />
      </div>
    )
  }

  const pieData = data.segments.map((s) => ({ name: s.segment, value: s.customer_count }))

  return (
    <div>
      <PageHeader
        title="Customer Segmentation"
        subtitle={`AI-driven behavioral clustering (K-Means)${data.silhouette_score != null ? ` — silhouette score ${data.silhouette_score}` : ''}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Segment Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Segment Summary</h3>
          <div className="space-y-3">
            {data.segments.map((s) => (
              <div key={s.segment} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                <div>
                  <Badge tone={SEGMENT_TONE[s.segment] || 'slate'}>{s.segment}</Badge>
                  <p className="text-xs text-slate-500 mt-1">{s.customer_count} customers</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-slate-800">₹{s.avg_purchase_value.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-400">avg. {s.avg_purchase_frequency} orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Customer Detail</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Segment</th>
              <th className="py-2 pr-4">Orders</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.customer_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-800">{c.customer_name}</td>
                <td className="py-2 pr-4"><Badge tone={SEGMENT_TONE[c.segment] || 'slate'}>{c.segment}</Badge></td>
                <td className="py-2 pr-4">{c.frequency ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
