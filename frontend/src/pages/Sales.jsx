import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, Badge, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Upload, Plus, Download } from 'lucide-react'
import { downloadCSV } from '../utils/csv'

export default function Sales() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ product_id: '', customer_id: '', quantity: 1, unit_price: '' })

  const load = useCallback(() => {
    Promise.all([api.get('/sales/'), api.get('/inventory/products'), api.get('/customers/')])
      .then(([s, p, c]) => {
        setSales(s.data)
        setProducts(p.data)
        setCustomers(c.data)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || 'Failed to load sales data.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startFetching() {
      try {
        const [s, p, c] = await Promise.all([api.get('/sales/'), api.get('/inventory/products'), api.get('/customers/')])
        if (!cancelled) {
          setSales(s.data)
          setProducts(p.data)
          setCustomers(c.data)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || err.message || 'Failed to load sales data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startFetching()
    return () => {
      cancelled = true
    }
  }, [])

  const handleProductChange = (e) => {
    const pid = e.target.value
    const product = products.find((p) => String(p.id) === pid)
    setForm({ ...form, product_id: pid, unit_price: product ? product.price : '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/sales/', {
        product_id: form.product_id ? Number(form.product_id) : null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price),
      })
      setShowForm(false)
      setForm({ product_id: '', customer_id: '', quantity: 1, unit_price: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record sale.')
    }
  }

  const handleExport = () => {
    const rows = sales.map((s) => {
      const product = products.find((p) => p.id === s.product_id)
      const customer = customers.find((c) => c.id === s.customer_id)
      return [
        s.sale_date ? s.sale_date.slice(0, 10) : '',
        product?.name || '',
        customer?.name || '',
        s.quantity,
        s.unit_price,
        s.total_amount,
        s.source,
      ]
    })
    downloadCSV('sales.csv', ['Date', 'Product', 'Customer', 'Qty', 'Unit Price', 'Total', 'Source'], rows)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = new FormData()
    data.append('file', file)
    setUploadMsg('Uploading...')
    try {
      const res = await api.post('/sales/upload-csv', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg(`Uploaded: ${res.data.sales_created} sales created, ${res.data.rows_skipped} rows skipped.`)
      load()
    } catch (err) {
      setUploadMsg(err.response?.data?.detail || 'Upload failed.')
    }
    e.target.value = ''
  }

  if (loading) return <Loading label="Loading sales..." />

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Sales data upload, transaction records, and history."
        action={
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer flex items-center gap-2">
              <Upload size={16} /> Upload CSV
              <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            </label>
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Sale
            </button>
          </div>
        }
      />

      {uploadMsg && <div className="bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-4 py-3 text-sm mb-4 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900/60">{uploadMsg}</div>}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Product</label>
              <select className="input mt-1" value={form.product_id} onChange={handleProductChange} required>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Customer</label>
              <select className="input mt-1" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Walk-in / none</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Quantity</label>
              <input type="number" min="1" className="input mt-1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Unit Price (₹)</label>
              <input type="number" step="0.01" className="input mt-1" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary col-span-2 md:col-span-1">Record Sale</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        {sales.length === 0 ? (
          <EmptyState message="No sales recorded yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">Unit Price</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 100).map((s) => {
                const product = products.find((p) => p.id === s.product_id)
                const customer = customers.find((c) => c.id === s.customer_id)
                return (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800">
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{product?.name || `#${s.product_id}`}</td>
                    <td className="py-2 pr-4">{customer?.name || '—'}</td>
                    <td className="py-2 pr-4">{s.quantity}</td>
                    <td className="py-2 pr-4">₹{s.unit_price.toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4 font-semibold">₹{s.total_amount.toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={s.source === 'csv_upload' ? 'blue' : s.source === 'seed' ? 'slate' : 'green'}>{s.source}</Badge>
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