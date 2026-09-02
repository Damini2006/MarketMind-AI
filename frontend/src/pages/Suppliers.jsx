import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader } from '../components/ui.jsx'
import InteractiveTable, { DetailModal } from '../components/InteractiveTable.jsx'
import { Plus, Trash2, Truck, Mail, Phone, MapPin } from 'lucide-react'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ supplier_name: '', phone: '', email: '', address: '' })

  useEffect(() => {
    let cancelled = false
    api.get('/suppliers/')
      .then(res => { if (!cancelled) setSuppliers(res.data) })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || 'Failed to load suppliers.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await api.get('/suppliers/'); setSuppliers(res.data) }
    catch (err) { setError(err.response?.data?.detail || 'Failed to load suppliers.') }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.supplier_name.trim()) { setError('Supplier name is required.'); return }
    try {
      setSaving(true); setError('')
      await api.post('/suppliers/', { supplier_name: form.supplier_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null })
      setForm({ supplier_name: '', phone: '', email: '', address: '' }); setShowForm(false); setLoading(true); load()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create supplier.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return
    try { setError(''); setLoading(true); await api.delete(`/suppliers/${id}`); load() }
    catch (err) { setError(err.response?.data?.detail || 'Failed to delete supplier.') }
  }

  if (loading) return <Loading label="Loading suppliers..." />

  const columns = [
    { key: 'supplier_name', label: 'Name', render: (v) => <span className="font-medium text-slate-800 dark:text-slate-100">{v}</span> },
    { key: 'phone', label: 'Phone', render: (v) => v || '—' },
    { key: 'email', label: 'Email', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v || '—'}</span> },
    { key: 'address', label: 'Address', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v || '—'}</span> },
    { key: 'actions', label: '', sortable: false, render: (_, row) => (
      <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manage product suppliers and vendors."
        action={<button onClick={() => { setShowForm(!showForm); setError('') }} className="btn-primary flex items-center gap-2"><Plus size={16} /> {showForm ? 'Cancel' : 'Add Supplier'}</button>}
      />

      <div className="card text-center p-3 mb-6"><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{suppliers.length}</p><p className="text-[10px] text-slate-500 uppercase">Total Suppliers</p></div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Supplier</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Supplier Name *</label>
                <input type="text" name="supplier_name" value={form.supplier_name} onChange={handleChange} placeholder="Enter supplier name" className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2" required /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="Enter phone number" className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter email address" className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Address</label>
                <input type="text" name="address" value={form.address} onChange={handleChange} placeholder="Enter address" className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2" /></div>
            </div>
            <div className="flex justify-end mt-4"><button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save Supplier'}</button></div>
          </form>
        </div>
      )}

      <div className="card">
        <InteractiveTable data={suppliers} columns={columns} searchableKeys={['supplier_name', 'email', 'address', 'phone']}
          onRowClick={setSelected} emptyMessage="No suppliers yet." />
      </div>

      <DetailModal title={selected?.supplier_name || ''} subtitle="Supplier Details" onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <DetailModal.Row label="Name" value={selected.supplier_name} icon={Truck} tone="brand" />
            <DetailModal.Row label="Phone" value={selected.phone || 'Not provided'} icon={Phone} />
            <DetailModal.Row label="Email" value={selected.email || 'Not provided'} icon={Mail} />
            <DetailModal.Row label="Address" value={selected.address || 'Not provided'} icon={MapPin} />
          </div>
        )}
      </DetailModal>
    </div>
  )
}
