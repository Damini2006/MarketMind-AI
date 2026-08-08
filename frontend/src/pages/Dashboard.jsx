import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../services/api'
import { StatCard, Loading, PageHeader } from '../components/ui.jsx'
import { IndianRupee, ShoppingCart, Users, Boxes, AlertTriangle, FileWarning } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(30) // 7 | 14 | 30 days filter

  useEffect(() => {
    api.get('/analytics/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Loading dashboard..." />
  if (!kpis) return null

  const filteredRevenueTrend = (kpis.revenue_by_day || []).slice(-trendDays)

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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue Trend</h3>
            
            {/* Timeframe Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTrendDays(days)}
                  className={`px-2 py-1 rounded-md transition-all ${
                    trendDays === days ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredRevenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Line type="monotone" dataKey="revenue" stroke="#3b5bdb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 dark:text-slate-100">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Bar dataKey="revenue" fill="#3b5bdb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}