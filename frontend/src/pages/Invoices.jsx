import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus } from 'lucide-react'

const STATUS_TONE = { pending: 'amber', paid: 'green', overdue: 'red' }

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ sale_id: '', due_date: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get('/invoices/'), api.get('/sales/')])
      .then(([i, s]) => { setInvoices(i.data); setSales(s.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/invoices/', {
        sale_id: form.sale_id ? Number(form.sale_id) : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      })
      setShowForm(false)
      setForm({ sale_id: '', due_date: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create invoice.')
    }
  }

  const updateStatus = async (id, status) => {
    await api.patch(`/invoices/${id}/status`, { status })
    load()
  }

  if (loading) return <Loading label="Loading invoices..." />

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Invoice generation, tracking, and payment monitoring."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Invoice
          </button>
        }
      />

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600">Sale Transaction</label>
              <select className="input mt-1" value={form.sale_id} onChange={(e) => setForm({ ...form, sale_id: e.target.value })} required>
                <option value="">Select a sale</option>
                {sales.filter(s => s.payment_status !== 'completed' && !invoices.some(inv => inv.sale_id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.invoice_number} (₹{s.total_amount?.toLocaleString('en-IN')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Due Date</label>
              <input type="date" className="input mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary">Create Invoice</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        {invoices.length === 0 ? (
          <EmptyState message="No invoices yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Invoice #</th>
                <th className="py-2 pr-4">Sale Ref</th>
                <th className="py-2 pr-4">Due Date</th>
                <th className="py-2 pr-4">Payment Date</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const sale = sales.find((s) => s.id === inv.sale_id)
                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="py-2 pr-4">{sale ? sale.invoice_number : '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{inv.payment_date ? new Date(inv.payment_date).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-4"><Badge tone={STATUS_TONE[inv.invoice_status] || 'slate'}>{inv.invoice_status}</Badge></td>
                    <td className="py-2 pr-4">
                      {inv.invoice_status !== 'paid' && (
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
  )
}
