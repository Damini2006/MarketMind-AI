import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import {Loading, PageHeader, Badge, ErrorBanner, TableSkeleton, PageSkeleton} from '../components/ui.jsx'
import InteractiveTable, { DetailModal } from '../components/InteractiveTable.jsx'
import { Upload, Plus, Download, ShoppingCart, IndianRupee, Users, Calendar, FileText } from 'lucide-react'
import { downloadCSV } from '../utils/csv'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'

const PAGE_SIZE = 50

export default function Sales() {
  const { t } = useTranslation()
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [error, setError] = useState(null)
  const [selectedSale, setSelectedSale] = useState(null)
  const [form, setForm] = useState({ product_id: '', customer_id: '', quantity: 1, unit_price: '' })
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const load = useCallback(() => {
    const offset = page * PAGE_SIZE
    Promise.all([
      api.get(`/sales/?limit=${PAGE_SIZE}&offset=${offset}`),
      api.get('/inventory/products'),
      api.get('/customers/'),
    ])
      .then(([s, p, c]) => {
        setSales(s.data.items || s.data)
        setTotal(s.data.total ?? (s.data.items || s.data).length)
        setProducts(p.data)
        setCustomers(c.data)
      })
      .catch((err) => setError(err.response?.data?.detail || err.message || 'Failed to load sales data.'))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])
  // Reset to page 0 when load changes (new sale, upload, etc.)
  const reload = useCallback(() => { setPage(0); setLoading(true) }, [])

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
        quantity: Number(form.quantity), unit_price: Number(form.unit_price),
      })
      setShowForm(false)
      setForm({ product_id: '', customer_id: '', quantity: 1, unit_price: '' })
      reload()
    } catch (err) { setError(err.response?.data?.detail || 'Could not record sale.') }
  }

  const getExportRows = () => sales.map((s) => {
    const product = products.find((p) => p.id === s.product_id)
    const customer = customers.find((c) => c.id === s.customer_id)
    return [s.sale_date ? s.sale_date.slice(0, 10) : '', product?.name || '', customer?.name || '', s.quantity, s.unit_price, s.total_amount, s.source]
  })
  const exportHeaders = ['Date', 'Product', 'Customer', 'Qty', 'Unit Price', 'Total', 'Source']

  const handleExportCSV = () => downloadCSV('sales.csv', exportHeaders, getExportRows())
  const handleExportPDF = () => exportToPDF({ title: 'Sales Report', subtitle: `${total} transactions`, headers: exportHeaders, rows: getExportRows(), filename: 'sales-report' })
  const handleExportExcel = () => exportToExcel({ title: 'Sales Report', headers: exportHeaders, rows: getExportRows(), filename: 'sales-report' })

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = new FormData(); data.append('file', file)
    setUploadMsg('Uploading...')
    try {
      const res = await api.post('/sales/upload-csv', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg(`Uploaded: ${res.data.sales_created} sales created, ${res.data.rows_skipped} rows skipped.`)
      reload()
    } catch (err) { setUploadMsg(err.response?.data?.detail || 'Upload failed.') }
    e.target.value = ''
  }

  if (loading) return <Loading label={t('sales.loading')} />

  const totalRevenue = sales.reduce((s, x) => s + (x.total_amount || 0), 0)
  const avgSale = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0

  const columns = [
    { key: 'sale_date', label: t('common.date'), render: (v) => <span className="text-slate-500 dark:text-slate-400">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
    { key: 'product_name', label: t('sales.product'), render: (v) => <span className="font-medium text-slate-800 dark:text-slate-100">{v || '—'}</span> },
    { key: 'customer_name', label: t('sales.customer') },
    { key: 'quantity', label: 'Qty' },
    { key: 'unit_price', label: t('common.price'), render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}` },
    { key: 'total_amount', label: t('common.total'), render: (v) => <span className="font-semibold">₹{Number(v || 0).toLocaleString('en-IN')}</span> },
    { key: 'source', label: t('sales.source'), render: (v) => <Badge tone={v === 'csv_upload' ? 'blue' : v === 'seed' ? 'slate' : 'green'}>{v}</Badge> },
  ]

  const enrichedSales = sales.map(s => ({
    ...s,
    product_name: products.find(p => p.id === s.product_id)?.name || `#${s.product_id}`,
    customer_name: customers.find(c => c.id === s.customer_id)?.name || '—',
  }))

  return (
    <div>
      <PageHeader title={t('sales.title')} subtitle={t('sales.subtitle')}
        action={
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer flex items-center gap-2">
              <Upload size={16} /> {t('sales.uploadCSV')}
              <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            </label>
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 text-xs"><Download size={14} /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 text-xs text-red-600 dark:text-red-400"><FileText size={14} /> PDF</button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 text-xs text-green-600 dark:text-green-400"><Download size={14} /> Excel</button>
            <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2"><Plus size={16} /> {t('sales.addSale')}</button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card text-center p-3"><p className="text-xl font-bold text-slate-900 dark:text-slate-100">{total}</p><p className="text-[10px] text-slate-500 uppercase">{t('sales.totalSales')}</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-emerald-600">₹{totalRevenue.toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-500 uppercase">{t('sales.totalRevenue')}</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-blue-600">₹{avgSale.toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-500 uppercase">{t('sales.avgSale')}</p></div>
        <div className="card text-center p-3"><p className="text-xl font-bold text-purple-600">{customers.length}</p><p className="text-[10px] text-slate-500 uppercase">{t('dashboard.customers')}</p></div>
      </div>

      {uploadMsg && <div className="bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-4 py-3 text-sm mb-4 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900/60">{uploadMsg}</div>}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('sales.product')}</label>
              <select className="input mt-1" value={form.product_id} onChange={handleProductChange} required>
                <option value="">{t('sales.selectProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('sales.customer')}</label>
              <select className="input mt-1" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">{t('sales.walkIn')}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('common.quantity')}</label>
              <input type="number" min="1" className="input mt-1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('common.price')} (₹)</label>
              <input type="number" step="0.01" className="input mt-1" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary col-span-2 md:col-span-1">{t('sales.recordSale')}</button>
          </form>
        </div>
      )}

      <div className="card">
        <InteractiveTable
          data={enrichedSales}
          columns={columns}
          searchableKeys={['product_name', 'customer_name', 'source']}
          onRowClick={setSelectedSale}
          emptyMessage={t('sales.noRecords')}
        />
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
              {/* Page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i
                } else if (page < 3) {
                  pageNum = i
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 5 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                      page === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      <DetailModal title={selectedSale ? `Sale #${selectedSale.id}` : ''} subtitle={selectedSale ? new Date(selectedSale.sale_date).toLocaleString() : ''} onClose={() => setSelectedSale(null)}>
        {selectedSale && (
          <div>
            <DetailModal.Row label={t('sales.product')} value={selectedSale.product_name} icon={ShoppingCart} tone="brand" />
            <DetailModal.Row label={t('sales.customer')} value={selectedSale.customer_name} icon={Users} />
            <DetailModal.Row label={t('common.quantity')} value={selectedSale.quantity} />
            <DetailModal.Row label={t('common.price')} value={`₹${Number(selectedSale.unit_price || 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
            <DetailModal.Row label={t('common.total')} value={`₹${Number(selectedSale.total_amount || 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
            <DetailModal.Row label={t('sales.source')} value={<Badge tone={selectedSale.source === 'csv_upload' ? 'blue' : selectedSale.source === 'seed' ? 'slate' : 'green'}>{selectedSale.source}</Badge>} />
            <DetailModal.Row label={t('common.date')} value={new Date(selectedSale.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} icon={Calendar} />
          </div>
        )}
      </DetailModal>
    </div>
  )
}
