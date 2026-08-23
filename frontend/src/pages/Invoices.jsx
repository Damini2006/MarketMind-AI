import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { DetailModal } from '../components/InteractiveTable.jsx'
import { FileText, IndianRupee, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(() => {
    api.get('/invoices/')
      .then((res) => setInvoices(Array.isArray(res.data) ? res.data : res.data.items || []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load invoices.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const markPaid = async (id) => {
    try { await api.patch(`/invoices/${id}/status`, { status: 'paid' }); load() }
    catch (err) { setError(err.response?.data?.detail || 'Failed to update status.') }
  }

  if (loading) return <Loading label="Loading invoices..." />

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (inv.invoice_number || '').toLowerCase().includes(q) || (inv.customer_name || '').toLowerCase().includes(q)
    }
    return true
  })

  const totalCount = invoices.length
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const pendingCount = invoices.filter(i => i.status === 'pending').length
  const overdueCount = invoices.filter(i => i.status === 'overdue').length
  const totalAmount = invoices.reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Track payment status and manage billing." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card text-center p-3"><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</p><p className="text-[10px] text-slate-500 uppercase">Total</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-emerald-600">{paidCount}</p><p className="text-[10px] text-slate-500 uppercase">Paid</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-amber-600">{pendingCount}</p><p className="text-[10px] text-slate-500 uppercase">Pending</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-red-600">{overdueCount}</p><p className="text-[10px] text-slate-500 uppercase">Overdue</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-blue-600">₹{totalAmount.toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-500 uppercase">Total Amount</p></div>
      </div>

      <ErrorBanner message={error} />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..."
            className="w-full pl-3 pr-8 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
          {['all', 'pending', 'paid', 'overdue'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md capitalize transition-all ${statusFilter === s ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {filtered.length === 0 ? <EmptyState message="No invoices found." /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">
                <th className="py-2.5 pr-4">Invoice #</th>
                <th className="py-2.5 pr-4">Customer</th>
                <th className="py-2.5 pr-4">Amount</th>
                <th className="py-2.5 pr-4">Due Date</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} onClick={() => setSelected(inv)}
                  className="border-b border-slate-100 dark:border-slate-700/60 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">{inv.invoice_number}</td>
                  <td className="py-2.5 pr-4">{inv.customer_name || '—'}</td>
                  <td className="py-2.5 pr-4 font-semibold">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : 'amber'}>{inv.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    {inv.status !== 'paid' && (
                      <button onClick={(e) => { e.stopPropagation(); markPaid(inv.id) }}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      <DetailModal title={selected?.invoice_number || ''} subtitle="Invoice Details" onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <DetailModal.Row label="Invoice #" value={selected.invoice_number} icon={FileText} tone="brand" />
            <DetailModal.Row label="Customer" value={selected.customer_name || 'Unknown'} />
            <DetailModal.Row label="Amount" value={`₹${Number(selected.amount || 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
            <DetailModal.Row label="Due Date" value={selected.due_date ? new Date(selected.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No due date'} icon={Calendar} />
            <DetailModal.Row label="Status" value={<Badge tone={selected.status === 'paid' ? 'green' : selected.status === 'overdue' ? 'red' : 'amber'}>{selected.status}</Badge>}
              icon={selected.status === 'paid' ? CheckCircle : selected.status === 'overdue' ? AlertTriangle : Clock}
              tone={selected.status === 'paid' ? 'green' : selected.status === 'overdue' ? 'red' : 'amber'} />
            {selected.status !== 'paid' && (
              <div className="mt-4">
                <button onClick={() => { markPaid(selected.id); setSelected(null) }} className="w-full btn-primary flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Mark as Paid
                </button>
              </div>
            )}
          </div>
        )}
      </DetailModal>
    </div>
  )
}
