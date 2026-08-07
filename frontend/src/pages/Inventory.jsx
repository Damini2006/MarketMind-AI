import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus, PackagePlus, PackageMinus, Upload, Search } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [form, setForm] = useState({ name: '', category: '', price: '', stock_quantity: 0, reorder_threshold: 10, warehouse_location: '' })
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'low_stock' | 'in_stock'

  const load = useCallback(() => {
    Promise.all([api.get('/inventory/products'), api.get('/inventory/alerts')])
      .then(([p, a]) => { 
        setProducts(p.data) 
        setAlerts(a.data) 
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load inventory.')
      })
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
      setLoading(true)
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
      setLoading(true)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create product.')
    }
  }

  const adjustStock = async (productId, delta) => {
    try {
      await api.patch(`/inventory/products/${productId}/stock`, { quantity_delta: delta })
      setLoading(true)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update stock.')
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
    const isLow = p.stock_quantity <= p.reorder_threshold
    if (statusFilter === 'low_stock') return matchesSearch && isLow
    if (statusFilter === 'in_stock') return matchesSearch && !isLow
    return matchesSearch
  })

  if (loading) return <Loading label="Loading inventory..." />

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock monitoring, reorder alerts, and warehouse tracking."
        action={
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer flex items-center gap-2 text-xs">
              <Upload size={14} /> Upload CSV
              <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            </label>
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2 text-xs">
              <Plus size={14} /> Add Product
            </button>
          </div>
        }
      />

      {uploadMsg && (
        <div className="mb-4 p-3 bg-slate-100 rounded-lg text-sm text-slate-700 flex justify-between items-center">
          <span>{uploadMsg}</span>
          <button onClick={() => setUploadMsg(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600">Product Name</label>
              <input type="text" className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Category</label>
              <input type="text" className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Price (₹)</label>
              <input type="number" step="0.01" className="input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Initial Stock</label>
              <input type="number" className="input mt-1" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Reorder Threshold</label>
              <input type="number" className="input mt-1" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Warehouse Location</label>
              <input type="text" className="input mt-1" value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Low Stock Alerts</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert, idx) => (
              <Badge key={idx} tone="amber">
                {alert.name} (Stock: {alert.stock_quantity})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-xs pl-8 py-1.5"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === 'low_stock' ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === 'in_stock' ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              In Stock
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <EmptyState message="No matching products in inventory." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Stock</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium">{prod.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{prod.category || '—'}</td>
                    <td className="py-2 pr-4 font-semibold">₹{prod.price?.toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4">
                      <span className={prod.stock_quantity <= prod.reorder_threshold ? 'text-red-600 font-bold' : ''}>
                        {prod.stock_quantity}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{prod.warehouse_location || '—'}</td>
                    <td className="py-2 pr-4 flex items-center gap-2">
                      <button onClick={() => adjustStock(prod.id, 1)} title="Increase Stock" className="p-1 hover:bg-slate-200 rounded text-slate-600">
                        <PackagePlus size={16} />
                      </button>
                      <button onClick={() => adjustStock(prod.id, -1)} title="Decrease Stock" className="p-1 hover:bg-slate-200 rounded text-slate-600">
                        <PackageMinus size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}