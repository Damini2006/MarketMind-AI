import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../services/api'
import { StatCard, Loading, PageHeader } from '../components/ui.jsx'
import { IndianRupee, ShoppingCart, Users, Boxes, AlertTriangle, FileWarning } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Loading dashboard..." />
  if (!kpis) return null

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || ''}`}
        subtitle="Here's how your business is performing today."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Total Sales" value={kpis.total_sales.toLocaleString('en-IN')} icon={ShoppingCart} tone="brand" />
        <StatCard label="Customers" value={kpis.total_customers} icon={Users} tone="brand" />
        <StatCard label="Products" value={kpis.total_products} icon={Boxes} tone="brand" />
        <StatCard label="Low Stock Items" value={kpis.low_stock_count} icon={AlertTriangle} tone="amber" />
        <StatCard label="Overdue Invoices" value={kpis.overdue_invoices} sub={`${kpis.pending_invoices} pending`} icon={FileWarning} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Revenue Trend (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={kpis.revenue_by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3b5bdb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#3b5bdb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
