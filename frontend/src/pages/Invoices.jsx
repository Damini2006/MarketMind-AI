import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus, Filter } from 'lucide-react'

const STATUS_TONE = { pending: 'amber', paid: 'green', overdue: 'red' }

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ customer_id: '', amount: '', due_date: '' })
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(() => {
    Promise.all([api.get('/invoices/'), api.get('/customers/')])
      .then(([i, c]) => { 
        setInvoices(i.data)
        setCustomers(c.data) 
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load data.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startFetching() {
      try {
        const [i, c] = await Promise.all([api.get('/invoices/'), api.get('/customers/')])
        if (!cancelled) {
          setInvoices(i.data)
          setCustomers(c.data)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startFetching()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/invoices/', {
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        amount: Number(form.amount),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      })
      setShowForm(false)
      setForm({ customer_id: '', amount: '', due_date: '' })
      setLoading(true)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create invoice.')
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}/status`, { status })
      setLoading(true)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update invoice status.')
    }
  }

  const filteredInvoices = invoices.filter((inv) => statusFilter === 'all' || inv.status === statusFilter)

  if (loading) return <Loading label="Loading invoices..." />

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Invoice generation, tracking, and payment monitoring."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={14} /> New Invoice
          </button>
        }
      />

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Customer</label>
              <select className="input mt-1" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Amount (₹)</label>
              <input type="number" step="0.01" className="input mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Due Date</label>
              <input type="date" className="input mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary">Create Invoice</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Invoices List</h3>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium dark:bg-slate-800">
            <Filter size={14} className="ml-1 text-slate-400 dark:text-slate-500" />
            {['all', 'pending', 'paid', 'overdue'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                  statusFilter === st ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <EmptyState message="No matching invoices found." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">Invoice #</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Due Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const customer = customers.find((c) => c.id === inv.customer_id)
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800">
                      <td className="py-2 pr-4 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="py-2 pr-4">{customer?.name || '—'}</td>
                      <td className="py-2 pr-4 font-semibold">₹{inv.amount.toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                      <td className="py-2 pr-4"><Badge tone={STATUS_TONE[inv.status] || 'slate'}>{inv.status}</Badge></td>
                      <td className="py-2 pr-4">
                        {inv.status !== 'paid' && (
                          <button onClick={() => updateStatus(inv.id, 'paid')} className="text-xs text-brand-600 font-medium hover:underline">
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}