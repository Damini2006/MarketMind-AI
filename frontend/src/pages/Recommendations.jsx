import { useEffect, useState } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { ShoppingBag } from 'lucide-react'

export default function Recommendations() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/ai/recommendations')
      .then((res) => setData(res.data))
      .catch((err) => console.error("Recommendations fetch error:", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Generating recommendations..." />
  
  // Safe array check using optional chaining
  const rows = data?.rows || []

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Product Recommendations" subtitle="Personalized cross-sell and upsell suggestions." />
        <EmptyState message="Not enough purchase history to generate recommendations yet." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Product Recommendations"
        subtitle="Collaborative filtering + association-rule mining across customer purchase history."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <div key={r.customer_id} className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
                <ShoppingBag size={18} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{r.customer_name}</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(r.recommended_products || []).map((p, i) => (
                <Badge key={i} tone="blue">🛍 {p}</Badge>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{r.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}