import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import api from '../../services/api'
import { StatCard, Loading } from '../ui.jsx'
import { IndianRupee, ShoppingCart, Boxes, AlertTriangle, TrendingUp, Users, Clock, CheckCircle, Package, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

const COLORS = ['#3b5bdb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function ManagerDashboard({ user }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading label="Loading dashboard..." />
  if (!kpis) return null

  const avgSale = kpis.total_sales > 0 ? Math.round(kpis.total_revenue / kpis.total_sales) : 0
  const revenueGrowth = kpis.revenue_by_day?.length > 1
    ? Math.round(((kpis.revenue_by_day[kpis.revenue_by_day.length - 1]?.revenue || 0) - (kpis.revenue_by_day[0]?.revenue || 0)) / Math.max(1, kpis.revenue_by_day[0]?.revenue || 1) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0] || 'Manager'}</h2>
            <p className="text-indigo-100 text-sm mt-1">Here's what's happening with your store today.</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-100 text-xs">Today is</p>
            <p className="text-white font-semibold">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Total Sales" value={kpis.total_sales.toLocaleString('en-IN')} icon={ShoppingCart} tone="brand" />
        <StatCard label="Avg Sale Value" value={`₹${avgSale.toLocaleString('en-IN')}`} icon={TrendingUp} tone="blue" />
        <StatCard label="Customers" value={kpis.total_customers.toLocaleString('en-IN')} icon={Users} tone="purple" />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Products" value={kpis.total_products.toLocaleString('en-IN')} icon={Package} tone="blue" />
        <StatCard label="Low Stock Alerts" value={kpis.low_stock_count} icon={AlertTriangle} tone={kpis.low_stock_count > 3 ? 'red' : 'amber'} />
        <StatCard label="Pending Invoices" value={kpis.pending_invoices} icon={Clock} tone="amber" />
        <StatCard label="Overdue Invoices" value={kpis.overdue_invoices} icon={AlertTriangle} tone="red" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div data-tour="revenue-chart" className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue Trend</h3>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${revenueGrowth >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {revenueGrowth >= 0 ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />}
              {Math.abs(revenueGrowth)}% overall
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={(kpis.revenue_by_day || []).slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Boxes size={18} className="text-indigo-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Top Products</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(kpis.top_products || []).slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} />
              <YAxis type="category" dataKey="product" tick={{ fontSize: 9, fill: axisColor }} width={90} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Stock Alerts</h3>
          </div>
          {kpis.low_stock_count === 0 ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle size={16} />
              <span className="text-sm">All products are well-stocked</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{kpis.low_stock_count} items below minimum stock level</p>
              <a href="/inventory" className="inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View Inventory →</a>
            </div>
          )}
        </div>

        {/* Invoice Status */}
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-red-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Invoice Status</h3>
          </div>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-amber-600">{kpis.pending_invoices}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-red-600">{kpis.overdue_invoices}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Overdue</p>
            </div>
          </div>
          <a href="/invoices" className="block text-center mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Manage Invoices →</a>
        </div>

        {/* Quick Stats */}
        <div className="card border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Performance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Avg Order Value</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">₹{avgSale}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Revenue/Customer</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                ₹{kpis.total_customers > 0 ? Math.round(kpis.total_revenue / kpis.total_customers).toLocaleString('en-IN') : 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Products/Order</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {kpis.total_sales > 0 ? (kpis.total_products / kpis.total_sales * 10).toFixed(1) : 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <a href="/inventory" className="card hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Package size={20} className="text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Inventory</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage stock</p>
          </div>
        </a>
        <a href="/sales" className="card hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <ShoppingCart size={20} className="text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Sales</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Record transactions</p>
          </div>
        </a>
        <a href="/invoices" className="card hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Clock size={20} className="text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Invoices</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpis.pending_invoices + kpis.overdue_invoices} pending</p>
          </div>
        </a>
        <a href="/customers" className="card hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Users size={20} className="text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Customers</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpis.total_customers} total</p>
          </div>
        </a>
      </div>
    </div>
  )
}
