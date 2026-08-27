import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import api from '../../services/api'
import { StatCard, Loading } from '../ui.jsx'
import { IndianRupee, ShoppingCart, Users, FileText, TrendingUp, Target, Award, Calendar, ArrowUpRight, ArrowDownRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

const COLORS = ['#3b5bdb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function SalesDashboard({ user }) {
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

  const salesTarget = 50000
  const progress = Math.min(100, Math.round((kpis.total_revenue / salesTarget) * 100))
  const avgSale = kpis.total_sales > 0 ? Math.round(kpis.total_revenue / kpis.total_sales) : 0
  const conversionRate = kpis.total_customers > 0 ? ((kpis.total_sales / kpis.total_customers) * 100).toFixed(1) : 0
  
  // Calculate daily average
  const dailyRevenue = (kpis.revenue_by_day || []).slice(-7)
  const avgDailyRevenue = dailyRevenue.length > 0 
    ? Math.round(dailyRevenue.reduce((sum, d) => sum + (d.revenue || 0), 0) / dailyRevenue.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Hey {user?.full_name?.split(' ')[0] || 'Sales Rep'}!</h2>
            <p className="text-green-100 text-sm mt-1">Let's crush today's sales goals.</p>
          </div>
          <div className="text-right">
            <p className="text-green-100 text-xs">Today</p>
            <p className="text-white font-semibold">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
      </div>

      {/* Sales Target Progress */}
      <div data-tour="sales-target" className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Monthly Sales Target</h3>
          </div>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">{progress}%</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${progress}%` }}
          >
            {progress > 15 && <span className="text-[10px] text-white font-bold">{progress}%</span>}
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>₹{kpis.total_revenue.toLocaleString('en-IN')} earned</span>
          <span>₹{salesTarget.toLocaleString('en-IN')} target</span>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Total Sales" value={kpis.total_sales.toLocaleString('en-IN')} icon={ShoppingCart} tone="brand" />
        <StatCard label="Avg Sale Value" value={`₹${avgSale.toLocaleString('en-IN')}`} icon={TrendingUp} tone="blue" />
        <StatCard label="Customers" value={kpis.total_customers.toLocaleString('en-IN')} icon={Users} tone="purple" />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-amber-600" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily Avg Revenue</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">₹{avgDailyRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Last 7 days average</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-blue-600" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Conversion Rate</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{conversionRate}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sales per customer</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-amber-600" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Invoice Collection</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {kpis.total_sales > 0 ? Math.round(((kpis.total_sales - kpis.pending_invoices - kpis.overdue_invoices) / kpis.total_sales) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Paid vs total</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Day */}
        <div data-tour="revenue-chart" className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Revenue Trend (14 Days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={(kpis.revenue_by_day || []).slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Top Products by Revenue</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(kpis.top_products || []).slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="product" tick={{ fontSize: 9, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoice Status + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Status Pie */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Invoice Breakdown</h3>
          </div>
          <div className="flex items-center justify-around">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Paid', value: kpis.total_sales - kpis.pending_invoices - kpis.overdue_invoices },
                    { name: 'Pending', value: kpis.pending_invoices },
                    { name: 'Overdue', value: kpis.overdue_invoices },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                >
                  {COLORS.map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{kpis.total_sales - kpis.pending_invoices - kpis.overdue_invoices}</p>
                  <p className="text-xs text-slate-500">Paid</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{kpis.pending_invoices}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{kpis.overdue_invoices}</p>
                  <p className="text-xs text-slate-500">Overdue</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-green-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a href="/sales" className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ShoppingCart size={20} className="text-green-600 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Record Sale</p>
              <p className="text-xs text-slate-500">Log new transaction</p>
            </a>
            <a href="/customers" className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Users size={20} className="text-blue-600 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Add Customer</p>
              <p className="text-xs text-slate-500">Grow directory</p>
            </a>
            <a href="/invoices" className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <FileText size={20} className="text-amber-600 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Invoices</p>
              <p className="text-xs text-slate-500">{kpis.pending_invoices} pending</p>
            </a>
            <a href="/forecasting" className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <TrendingUp size={20} className="text-purple-600 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Forecasting</p>
              <p className="text-xs text-slate-500">View predictions</p>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-green-600" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sales Tips</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle size={16} className="text-green-600 mb-2" />
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Revenue is {progress >= 50 ? 'on track' : 'behind target'}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{progress}% of monthly goal achieved</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Users size={16} className="text-blue-600 mb-2" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{kpis.total_customers} customers served</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{conversionRate}% buy rate</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={16} className="text-amber-600 mb-2" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{kpis.pending_invoices + kpis.overdue_invoices} invoices open</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Follow up on overdue</p>
          </div>
        </div>
      </div>
    </div>
  )
}
