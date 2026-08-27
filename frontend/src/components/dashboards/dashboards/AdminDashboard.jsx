import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../../services/api'
import { StatCard, Loading } from '../ui.jsx'
import { IndianRupee, ShoppingCart, Users, Boxes, ShieldCheck, Database, AlertTriangle, FileWarning } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function AdminDashboard({ user }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [kpis, setKpis] = useState(null)
  const [teamCount, setTeamCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/kpis'),
      api.get('/users/').catch(() => ({ data: [] })),
    ]).then(([kpiRes, teamRes]) => {
      setKpis(kpiRes.data)
      setTeamCount(Array.isArray(teamRes.data) ? teamRes.data.length : 0)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Loading admin dashboard..." />
  if (!kpis) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={22} />
          <h2 className="text-xl font-bold">System Administrator Dashboard</h2>
        </div>
        <p className="text-slate-300 text-sm">Full system overview — analytics, users, and data health.</p>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Team Members" value={teamCount} icon={Users} tone="brand" />
        <StatCard label="Total Products" value={kpis.total_products} icon={Boxes} tone="brand" />
        <StatCard label="System Alerts" value={kpis.low_stock_count + kpis.overdue_invoices} icon={AlertTriangle} tone="red" />
      </div>

      {/* Data Health */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className="text-green-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Database</h4>
          </div>
          <p className="text-2xl font-bold text-green-600">Healthy</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpis.total_products + kpis.total_customers + kpis.total_sales} records</p>
        </div>
        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Low Stock</h4>
          </div>
          <p className="text-2xl font-bold text-amber-600">{kpis.low_stock_count}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">items below reorder level</p>
        </div>
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-2 mb-2">
            <FileWarning size={16} className="text-red-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Overdue Invoices</h4>
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.overdue_invoices}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpis.pending_invoices} pending</p>
        </div>
      </div>

      {/* Full Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Revenue Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={(kpis.revenue_by_day || []).slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Line type="monotone" dataKey="revenue" stroke="#64748b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Top Products</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis type="category" dataKey="product" width={100} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Bar dataKey="revenue" fill="#64748b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Admin Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="/team" className="card hover:shadow-md transition-shadow border-l-4 border-slate-700">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Team Management</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{teamCount} members</p>
        </a>
        <a href="/datasets" className="card hover:shadow-md transition-shadow border-l-4 border-blue-500">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Data Ingestion</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Upload & manage datasets</p>
        </a>
        <a href="/anomalies" className="card hover:shadow-md transition-shadow border-l-4 border-red-500">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Anomaly Alerts</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review system anomalies</p>
        </a>
      </div>
    </div>
  )
}
