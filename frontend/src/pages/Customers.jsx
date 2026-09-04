import { useEffect, useState, useCallback, useMemo } from 'react'
import api from '../services/api'
import {Loading, PageHeader, Badge, ErrorBanner, TableSkeleton, PageSkeleton} from '../components/ui.jsx'
import InteractiveTable, { DetailModal } from '../components/InteractiveTable.jsx'
import {
  Plus, Users, Mail, Phone, IndianRupee, ShoppingCart,
  TrendingUp, AlertTriangle, Crown, Star,
  Clock, Target, Download, FileText,
} from 'lucide-react'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'

const SEGMENT_META = {
  high: { label: 'High Value', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400', icon: Crown, badge: 'emerald' },
  medium: { label: 'Medium Value', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400', icon: Star, badge: 'blue' },
  low: { label: 'Low Value', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400', icon: Target, badge: 'slate' },
  at_risk: { label: 'At Risk', color: 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400', icon: AlertTriangle, badge: 'red' },
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [clvData, setClvData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [clvSort] = useState('predicted_6m_clv')
  const [segmentFilter, setSegmentFilter] = useState('all')
  const [recommendations, setRecommendations] = useState(null)
  const [loadingRecs, setLoadingRecs] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/customers/'),
      api.get('/sales/'),
      api.get('/ai/clv').catch(() => ({ data: null })),
    ])
      .then(([c, s, clv]) => {
        setCustomers(c.data)
        setSales(Array.isArray(s.data) ? s.data : s.data.items || [])
        setClvData(clv.data)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load customers.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null)
    try {
      await api.post('/customers/', form)
      setForm({ name: '', email: '', phone: '' }); setShowForm(false); load()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to add customer.') }
  }

  // Fetch AI recommendations for selected customer
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (selected?.id) {
        setLoadingRecs(true)
        try {
          const res = await api.get(`/ai/recommendations/customer/${selected.id}`)
          setRecommendations(res.data.recommendations)
        } catch (err) {
          console.error('Recs error', err)
        } finally {
          setLoadingRecs(false)
        }
      } else {
        setRecommendations(null)
      }
    }
    fetchRecommendations()
  }, [selected?.id])

  // Build CLV map for quick lookup
  const clvMap = useMemo(() => {
    const map = {}
    if (clvData?.customers) {
      clvData.customers.forEach(c => { map[c.customer_id] = c })
    }
    return map
  }, [clvData])

  const enriched = useMemo(() => {
    const getCustomerStats = (cid) => {
      const cSales = sales.filter(s => s.customer_id === cid)
      const totalSpent = cSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
      return { orderCount: cSales.length, totalSpent }
    }

    let list = customers.map(c => {
      const stats = getCustomerStats(c.id)
      const clv = clvMap[c.id] || {}
      return {
        ...c,
        orders: stats.orderCount,
        total_spent: stats.totalSpent,
        clv: clv.clv || 0,
        predicted_6m_clv: clv.predicted_6m_clv || 0,
        avg_order_value: clv.avg_order_value || 0,
        purchase_frequency: clv.purchase_frequency || 0,
        lifespan_months: clv.lifespan_months || 0,
        segment: clv.segment || 'at_risk',
        last_purchase_days: clv.last_purchase_days,
      }
    })
    if (segmentFilter !== 'all') {
      list = list.filter(c => c.segment === segmentFilter)
    }
    list.sort((a, b) => (b[clvSort] || 0) - (a[clvSort] || 0))
    return list
  }, [customers, sales, clvMap, clvSort, segmentFilter])

  const totalSpentAll = enriched.reduce((s, c) => s + c.total_spent, 0)

  if (loading) return <PageSkeleton variant="table" />

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v || '\u2014'}</span> },
    { key: 'orders', label: 'Orders', render: (v) => <Badge tone={v > 0 ? 'blue' : 'slate'}>{v}</Badge> },
    { key: 'total_spent', label: 'Total Spent', render: (v) => <span className="font-semibold text-emerald-600">{'\u20B9'}{Number(v || 0).toLocaleString('en-IN')}</span> },
    {
      key: 'segment', label: 'Segment', render: (v) => {
        const meta = SEGMENT_META[v] || SEGMENT_META.low
        return <Badge tone={meta.badge}>{meta.label}</Badge>
      }
    },
    {
      key: 'predicted_6m_clv', label: 'Predicted 6M CLV', render: (v) => (
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{Number(v || 0).toLocaleString('en-IN')}</span>
      )
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Customer profiles with lifetime value predictions."
        action={
          <div className="flex gap-2">
            <button onClick={() => {
              const headers = ['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Segment', 'Predicted 6M CLV']
              const rows = enriched.map(c => [c.name, c.email || '', c.phone || '', c.orders, c.total_spent, c.segment, c.predicted_6m_clv])
              exportToPDF({ title: 'Customer Report', subtitle: `${enriched.length} customers`, headers, rows, filename: 'customer-report' })
            }} className="btn-secondary flex items-center gap-2 text-xs"><FileText size={14} /> PDF</button>
            <button onClick={() => {
              const headers = ['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Segment', 'Predicted 6M CLV']
              const rows = enriched.map(c => [c.name, c.email || '', c.phone || '', c.orders, c.total_spent, c.segment, c.predicted_6m_clv])
              exportToExcel({ title: 'Customer Report', headers, rows, filename: 'customer-report' })
            }} className="btn-secondary flex items-center gap-2 text-xs text-green-600 dark:text-green-400"><Download size={14} /> Excel</button>
            <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Customer</button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{customers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">{'\u20B9'}{totalSpentAll.toLocaleString('en-IN')}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1 mb-1">
            <IndianRupee size={10} className="text-indigo-500" />
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg CLV</p>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{Number(clvData?.summary?.avg_clv || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1 mb-1">
            <Crown size={10} className="text-emerald-500" />
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">High Value</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{clvData?.summary?.high_value || 0}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={10} className="text-red-500" />
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">At Risk</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{clvData?.summary?.at_risk || 0}</p>
        </div>
      </div>

      {/* Segment Breakdown */}
      {clvData?.summary && (
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(SEGMENT_META).map(([key, meta]) => {
            const count = clvData.summary[key === 'high' ? 'high_value' : key === 'medium' ? 'medium_value' : key === 'low' ? 'low_value' : 'at_risk'] || 0
            const Icon = meta.icon
            return (
              <button key={key} onClick={() => setSegmentFilter(segmentFilter === key ? 'all' : key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  segmentFilter === key
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}>
                <Icon size={12} className={meta.color.split(' ')[0]} />
                {meta.label}
                <span className="text-[10px] text-slate-400">({count})</span>
              </button>
            )
          })}
          {segmentFilter !== 'all' && (
            <button onClick={() => setSegmentFilter('all')} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
              Clear filter
            </button>
          )}
        </div>
      )}

      <ErrorBanner message={error} />

      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Name *</label>
              <input type="text" className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required /></div>
            <div><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
              <input type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Phone</label>
              <input type="tel" className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
            <button type="submit" className="btn-primary md:col-span-1">Save Customer</button>
          </form>
        </div>
      )}

      <div className="card">
        <InteractiveTable data={enriched} columns={columns} searchableKeys={['name', 'email']}
          onRowClick={setSelected} emptyMessage="No customers found." />
      </div>

      {/* Detail Modal with CLV */}
      <DetailModal title={selected?.name || ''} subtitle="Customer Profile & Lifetime Value" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Contact</p>
              <DetailModal.Row label="Name" value={selected.name} icon={Users} tone="brand" />
              <DetailModal.Row label="Email" value={selected.email || 'Not provided'} icon={Mail} />
              <DetailModal.Row label="Phone" value={selected.phone || 'Not provided'} icon={Phone} />
            </div>

            {/* Purchase Stats */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Purchase History</p>
              <DetailModal.Row label="Total Orders" value={selected.orders} icon={ShoppingCart} tone="blue" />
              <DetailModal.Row label="Total Spent" value={`\u20B9${Number(selected.total_spent || 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
              <DetailModal.Row label="Avg Order Value" value={`\u20B9${Number(selected.avg_order_value || 0).toLocaleString('en-IN')}`} />
              <DetailModal.Row label="Purchase Frequency" value={`${selected.purchase_frequency || 0}/month`} />
              <DetailModal.Row label="Customer Since" value={`${Math.round(selected.lifespan_months || 0)} months`} icon={Clock} />
            </div>

            {/* CLV Section */}
            <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800/50">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-indigo-500" />
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">Customer Lifetime Value</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Historical CLV</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{'\u20B9'}{Number(selected.clv || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Predicted 6M</p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{Number(selected.predicted_6m_clv || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  SEGMENT_META[selected.segment]?.color || 'text-slate-500 bg-slate-50'
                }`}>
                  {(() => { const M = SEGMENT_META[selected.segment]; return M ? <M.icon size={10} /> : null })()}
                  {SEGMENT_META[selected.segment]?.label || selected.segment}
                </span>
                {selected.last_purchase_days !== null && selected.last_purchase_days !== undefined && (
                  <span className="text-[10px] text-slate-400">
                    Last purchase: {selected.last_purchase_days === 0 ? 'Today' : `${selected.last_purchase_days}d ago`}
                  </span>
                )}
              </div>
            </div>

            {/* Recent Sales */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Recent Sales</p>
              {sales.filter(s => s.customer_id === selected.id).slice(-5).reverse().map(s => (
                <div key={s.id} className="flex justify-between py-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{s.sale_date ? new Date(s.sale_date).toLocaleDateString() : '\u2014'}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{'\u20B9'}{Number(s.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {sales.filter(s => s.customer_id === selected.id).length === 0 && (
                <p className="text-xs text-slate-400 py-2">No sales for this customer.</p>
              )}
            </div>

            {/* AI Recommendations */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{'\u2728'} AI Recommendations</p>
              {loadingRecs ? (
                <p className="text-xs text-slate-400 py-2 animate-pulse">Analyzing purchase history...</p>
              ) : recommendations && recommendations.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {recommendations.map((r) => (
                    <div key={r.product_id} className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/30 shadow-sm hover:shadow transition-all duration-300">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-indigo-900 dark:text-indigo-100">{r.name}</span>
                        <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-semibold">Recommended Match</span>
                      </div>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">{'\u20B9'}{r.price}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2">No recommendations available.</p>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
