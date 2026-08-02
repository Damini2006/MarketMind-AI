import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus, PackagePlus, PackageMinus, Upload } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [form, setForm] = useState({ name: '', category: '', price: '', stock_quantity: 0, reorder_threshold: 10, warehouse_location: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get('/inventory/products'), api.get('/inventory/alerts')])
      .then(([p, a]) => { setProducts(p.data); setAlerts(a.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = new FormData()
    data.append('file', file)
    setUploadMsg('Uploading...')
    try {
      const res = await api.post('/inventory/products/upload-csv', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg(`Uploaded: ${res.data.products_created} created, ${res.data.products_updated} updated, ${res.data.rows_skipped} skipped.`)
      load()
    } catch (err) {
      setUploadMsg(err.response?.data?.detail || 'Upload failed.')
    }
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/inventory/products', {
        ...form,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        reorder_threshold: Number(form.reorder_threshold),
      })
      setShowForm(false)
      setForm({ name: '', category: '', price: '', stock_quantity: 0, reorder_threshold: 10, warehouse_location: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create product.')
    }
  }

  const adjustStock = async (productId, delta) => {
    await api.patch(`/inventory/products/${productId}/stock`, { quantity_delta: delta })
    load()
  }

  if (loading) return <Loading label="Loading inventory..." />

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock monitoring, reorder alerts, and warehouse tracking."
        action={
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer flex items-center gap-2">
              <Upload size={16} /> Upload CSV
              <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            </label>
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Product
            </button>
          </div>
        }
      />

      {uploadMsg && <div className="bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-4 py-3 text-sm mb-4">{uploadMsg}</div>}

      {alerts.length > 0 && (
        <div className="card mb-6 border-amber-200 bg-amber-50/50">
          <h3 className="font-semibold text-amber-800 mb-2 text-sm">⚠️ Active Reorder Alerts</h3>
          <ul className="space-y-1 text-sm text-amber-700">
            {alerts.map((a) => <li key={a.id}>• {a.message}</li>)}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600">Product Name</label>
              <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Category</label>
              <input className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Price (₹)</label>
              <input type="number" step="0.01" className="input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Initial Stock</label>
              <input type="number" className="input mt-1" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Reorder Threshold</label>
              <input type="number" className="input mt-1" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Warehouse</label>
              <input className="input mt-1" value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary col-span-2 md:col-span-1">Save Product</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        {products.length === 0 ? (
          <EmptyState message="No products yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Stock</th>
                <th className="py-2 pr-4">Warehouse</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-800">{p.name}</td>
                  <td className="py-2 pr-4 text-slate-500">{p.category || '—'}</td>
                  <td className="py-2 pr-4">₹{p.price.toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-4">{p.stock_quantity}</td>
                  <td className="py-2 pr-4 text-slate-500">{p.warehouse_location || '—'}</td>
                  <td className="py-2 pr-4">
                    {p.stock_quantity === 0 ? (
                      <Badge tone="red">Out of stock</Badge>
                    ) : p.stock_quantity <= p.reorder_threshold ? (
                      <Badge tone="amber">Low stock</Badge>
                    ) : (
                      <Badge tone="green">In stock</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-1">
                      <button onClick={() => adjustStock(p.id, 10)} title="Add 10 stock" className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600">
                        <PackagePlus size={16} />
                      </button>
                      <button onClick={() => adjustStock(p.id, -10)} title="Remove 10 stock" className="p-1.5 rounded-md hover:bg-red-50 text-red-600">
                        <PackageMinus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
