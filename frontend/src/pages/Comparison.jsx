import { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader } from '../components/ui.jsx'
import {
  Minus, IndianRupee, ShoppingCart,
  Users, BarChart3, Zap,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

function MetricCard({ label, period1, period2, icon: Icon, color, prefix = '' }) {
  const diff = period2 - period1
  const pct = period1 !== 0 ? ((diff / period1) * 100).toFixed(1) : period2 > 0 ? 100 : 0
  const isUp = diff > 0
  const isDown = diff < 0
  const isFlat = diff === 0

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{prefix}{Number(period1).toLocaleString('en-IN')}</p>
          <p className="text-[9px] text-slate-400 uppercase">Period 1</p>
        </div>
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{prefix}{Number(period2).toLocaleString('en-IN')}</p>
          <p className="text-[9px] text-slate-400 uppercase">Period 2</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1">
        {isUp && <ArrowUpRight size={12} className="text-emerald-500" />}
        {isDown && <ArrowDownRight size={12} className="text-red-500" />}
        {isFlat && <Minus size={12} className="text-slate-400" />}
        <span className={`text-xs font-bold ${isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-slate-400'}`}>
          {isUp ? '+' : ''}{pct}%
        </span>
      </div>
    </div>
  )
}

function TopProductsList({ products, label }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{label}</p>
      {products.length === 0 ? (
        <p className="text-xs text-slate-400">No products</p>
      ) : (
        <div className="space-y-1.5">
          {products.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{p.name}</span>
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{p.quantity} sold</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Comparison() {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [invoices, setInvoices] = useState([])
  const [products, setProducts] = useState([])

  // Default periods: This month vs Last month
  const now = new Date()
  const [period1Start, setPeriod1Start] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.toISOString().slice(0, 10)
  })
  const [period1End, setPeriod1End] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 0)
    return d.toISOString().slice(0, 10)
  })
  const [period2Start, setPeriod2Start] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d.toISOString().slice(0, 10)
  })
  const [period2End, setPeriod2End] = useState(() => now.toISOString().slice(0, 10))

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/sales/'),
      api.get('/invoices/'),
      api.get('/inventory/products'),
    ])
      .then(([s, inv, p]) => {
        if (!cancelled) {
          setSales(s.data)
          setInvoices(inv.data)
          setProducts(p.data)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const period1Data = useMemo(() => {
    const start = new Date(period1Start)
    const end = new Date(period1End + 'T23:59:59')
    const s = sales.filter(sale => {
      const d = new Date(sale.sale_date)
      return d >= start && d <= end
    })
    const inv = invoices.filter(inv => {
      const d = new Date(inv.created_at || inv.due_date)
      return d >= start && d <= end
    })
    return { sales: s, invoices: inv }
  }, [sales, invoices, period1Start, period1End])

  const period2Data = useMemo(() => {
    const start = new Date(period2Start)
    const end = new Date(period2End + 'T23:59:59')
    const s = sales.filter(sale => {
      const d = new Date(sale.sale_date)
      return d >= start && d <= end
    })
    const inv = invoices.filter(inv => {
      const d = new Date(inv.created_at || inv.due_date)
      return d >= start && d <= end
    })
    return { sales: s, invoices: inv }
  }, [sales, invoices, period2Start, period2End])

  const getTopProducts = useCallback((salesList) => {
    const qtyMap = {}
    salesList.forEach(s => {
      if (s.product_id) qtyMap[s.product_id] = (qtyMap[s.product_id] || 0) + (s.quantity || 1)
    })
    return Object.entries(qtyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, qty]) => {
        const p = products.find(p => p.id === Number(id))
        return { name: p ? p.name : `Product #${id}`, quantity: qty }
      })
  }, [products])

  const stats1 = useMemo(() => {
    const s = period1Data.sales
    const revenue = s.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)
    const uniqueCustomers = new Set(s.map(sale => sale.customer_id).filter(Boolean)).size
    const avgOrder = s.length > 0 ? revenue / s.length : 0
    const topProducts = getTopProducts(s)
    return { revenue, salesCount: s.length, uniqueCustomers, avgOrder, topProducts }
  }, [period1Data, getTopProducts])

  const stats2 = useMemo(() => {
    const s = period2Data.sales
    const revenue = s.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)
    const uniqueCustomers = new Set(s.map(sale => sale.customer_id).filter(Boolean)).size
    const avgOrder = s.length > 0 ? revenue / s.length : 0
    const topProducts = getTopProducts(s)
    return { revenue, salesCount: s.length, uniqueCustomers, avgOrder, topProducts }
  }, [period2Data, getTopProducts])

  if (loading) return <Loading label="Loading comparison data..." />

  const revenueDiff = stats2.revenue - stats1.revenue
  const salesDiff = stats2.salesCount - stats1.salesCount
  const customerDiff = stats2.uniqueCustomers - stats1.uniqueCustomers

  return (
    <div className="space-y-5">
      <PageHeader title="Compare Periods" subtitle="Side-by-side comparison of two time periods." />

      {/* Period Selectors */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Period 1</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Start</label>
                <input type="date" value={period1Start} onChange={(e) => setPeriod1Start(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">End</label>
                <input type="date" value={period1End} onChange={(e) => setPeriod1End(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300" />
              </div>
            </div>
          </div>
          {/* Period 2 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Period 2</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Start</label>
                <input type="date" value={period2Start} onChange={(e) => setPeriod2Start(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">End</label>
                <input type="date" value={period2End} onChange={(e) => setPeriod2End(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300" />
              </div>
            </div>
          </div>
        </div>
        {/* Quick Presets */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] text-slate-400">Quick:</span>
          {[
            { label: 'This Month vs Last Month', p1s: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), p1e: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10), p2s: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), p2e: now.toISOString().slice(0, 10) },
            { label: 'Last 7d vs Previous 7d', p1s: new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10), p1e: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10), p2s: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10), p2e: now.toISOString().slice(0, 10) },
            { label: 'Last 30d vs Previous 30d', p1s: new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10), p1e: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10), p2s: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10), p2e: now.toISOString().slice(0, 10) },
          ].map((preset, i) => (
            <button key={i} onClick={() => { setPeriod1Start(preset.p1s); setPeriod1End(preset.p1e); setPeriod2Start(preset.p2s); setPeriod2End(preset.p2e) }}
              className="px-2 py-1 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 transition-colors">
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Summary */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Zap size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Comparison Summary</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={`text-2xl font-bold ${revenueDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {revenueDiff >= 0 ? '+' : ''}₹{Number(Math.abs(revenueDiff)).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 uppercase">Revenue Change</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${salesDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {salesDiff >= 0 ? '+' : ''}{salesDiff}
            </p>
            <p className="text-[10px] text-slate-400 uppercase">Sales Change</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${customerDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {customerDiff >= 0 ? '+' : ''}{customerDiff}
            </p>
            <p className="text-[10px] text-slate-400 uppercase">Customer Change</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Revenue" period1={stats1.revenue} period2={stats2.revenue} icon={IndianRupee} color="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" prefix="₹" />
        <MetricCard label="Total Sales" period1={stats1.salesCount} period2={stats2.salesCount} icon={ShoppingCart} color="text-blue-500 bg-blue-50 dark:bg-blue-950/30" />
        <MetricCard label="Customers" period1={stats1.uniqueCustomers} period2={stats2.uniqueCustomers} icon={Users} color="text-purple-500 bg-purple-50 dark:bg-purple-950/30" />
        <MetricCard label="Avg Order" period1={Math.round(stats1.avgOrder)} period2={Math.round(stats2.avgOrder)} icon={BarChart3} color="text-amber-500 bg-amber-50 dark:bg-amber-950/30" prefix="₹" />
      </div>

      {/* Top Products Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <TopProductsList products={stats1.topProducts} label="Top Products — Period 1" />
        </div>
        <div className="card p-4">
          <TopProductsList products={stats2.topProducts} label="Top Products — Period 2" />
        </div>
      </div>

      {/* AI Insight */}
      <div className="card p-4 border-l-4 border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">AI Insight</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {revenueDiff > 0 && salesDiff > 0 && `Revenue is up ₹${Number(revenueDiff).toLocaleString('en-IN')} with ${salesDiff} more sales. Good momentum — consider increasing ad spend to sustain growth.`}
          {revenueDiff > 0 && salesDiff <= 0 && `Revenue increased despite fewer sales — average order value is higher. Customers are buying more premium products.`}
          {revenueDiff < 0 && `Revenue dropped by ₹${Number(Math.abs(revenueDiff)).toLocaleString('en-IN')}. Check if this is seasonal or if marketing spend needs adjustment.`}
          {revenueDiff === 0 && salesDiff === 0 && `Both periods show similar performance. Consider testing new promotions to break the plateau.`}
        </p>
      </div>
    </div>
  )
}
