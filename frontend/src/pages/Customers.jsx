import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge, ErrorBanner } from '../components/ui.jsx'
import InteractiveTable, { DetailModal } from '../components/InteractiveTable.jsx'
import { Plus, Users, Mail, Phone, IndianRupee, ShoppingCart } from 'lucide-react'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  const load = useCallback(() => {
    Promise.all([api.get('/customers/'), api.get('/sales/')])
      .then(([c, s]) => { setCustomers(c.data); setSales(s.data) })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load customers.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null)
    try {
      await api.post('/customers/', form)
      setForm({ name: '', email: '', phone: '' }); setShowForm(false); load()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to add customer.') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return
    try { await api.delete(`/customers/${id}`); load() }
    catch (err) { setError(err.response?.data?.detail || 'Failed to delete customer.') }
  }

  if (loading) return <Loading label="Loading customers..." />

  const getCustomerStats = (cid) => {
    const cSales = sales.filter(s => s.customer_id === cid)
    const totalSpent = cSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
    return { orderCount: cSales.length, totalSpent }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v || '—'}</span> },
    { key: 'phone', label: 'Phone' },
    { key: 'orders', label: 'Orders', render: (v) => <Badge tone={v > 0 ? 'blue' : 'slate'}>{v}</Badge> },
    { key: 'total_spent', label: 'Total Spent', render: (v) => <span className="font-semibold text-emerald-600">₹{Number(v || 0).toLocaleString('en-IN')}</span> },
  ]

  const enriched = customers.map(c => {
    const stats = getCustomerStats(c.id)
    return { ...c, orders: stats.orderCount, total_spent: stats.totalSpent }
  })

  const totalSpentAll = enriched.reduce((s, c) => s + c.total_spent, 0)
  const avgSpend = customers.length > 0 ? Math.round(totalSpentAll / customers.length) : 0

  return (
    <div>
      <PageHeader title="Customers" subtitle="Customer profiles and contact directory."
        action={<button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Customer</button>}
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-3"><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{customers.length}</p><p className="text-[10px] text-slate-500 uppercase">Total Customers</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-emerald-600">₹{totalSpentAll.toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-500 uppercase">Total Revenue</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-blue-600">₹{avgSpend.toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-500 uppercase">Avg Spend/Customer</p></div>
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <div className="card mb-6">
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
        <InteractiveTable data={enriched} columns={columns} searchableKeys={['name', 'email', 'phone']}
          onRowClick={setSelected} emptyMessage="No customers found." />
      </div>

      <DetailModal title={selected?.name || ''} subtitle="Customer Profile" onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <DetailModal.Row label="Name" value={selected.name} icon={Users} tone="brand" />
            <DetailModal.Row label="Email" value={selected.email || 'Not provided'} icon={Mail} />
            <DetailModal.Row label="Phone" value={selected.phone || 'Not provided'} icon={Phone} />
            <DetailModal.Row label="Total Orders" value={selected.orders} icon={ShoppingCart} tone="blue" />
            <DetailModal.Row label="Total Spent" value={`₹${Number(selected.total_spent || 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
            <DetailModal.Row label="Avg Order" value={`₹${selected.orders > 0 ? Math.round(selected.total_spent / selected.orders).toLocaleString('en-IN') : 0}`} />
            <DetailModal.Section title="Recent Sales">
              {sales.filter(s => s.customer_id === selected.id).slice(-5).reverse().map(s => (
                <div key={s.id} className="flex justify-between py-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{s.sale_date ? new Date(s.sale_date).toLocaleDateString() : '—'}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">₹{Number(s.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {sales.filter(s => s.customer_id === selected.id).length === 0 && (
                <p className="text-xs text-slate-400 py-2">No sales for this customer.</p>
              )}
            </DetailModal.Section>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
