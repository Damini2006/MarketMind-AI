import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus, Upload, Search, ArrowUpDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Customers() {
  const { hasRole } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)

  const load = useCallback(() => {
    api.get('/customers/')
      .then((res) => setCustomers(res.data))
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || 'Failed to load customers.')
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const canCreate = hasRole('business_owner', 'sales_executive', 'admin')

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = new FormData()
    data.append('file', file)
    setUploadMsg('Uploading...')
    try {
      const res = await api.post('/customers/upload-csv', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadMsg(`Uploaded: ${res.data.customers_created} created, ${res.data.rows_skipped} skipped (duplicates/invalid).`)
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
      await api.post('/customers/', form)
      setShowForm(false)
      setForm({ name: '', email: '', phone: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create customer.')
    }
  }

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const processedCustomers = customers
    .filter((c) => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortField] || ''
      let valB = b[sortField] || ''
      if (sortAsc) return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })

  if (loading) return <Loading label="Loading customers..." />

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer profiles and contact directory."
        action={
          canCreate && (
            <div className="flex gap-2">
              <label className="btn-secondary cursor-pointer flex items-center gap-2 text-xs">
                <Upload size={14} /> Upload CSV
                <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
              </label>
              <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2 text-xs">
                <Plus size={14} /> Add Customer
              </button>
            </div>
          )
        }
      />

      {uploadMsg && <div className="bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-4 py-3 text-sm mb-4">{uploadMsg}</div>}

      {showForm && (
        <div className="card mb-6">
          <ErrorBanner message={error} />
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
              <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
              <input type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Phone</label>
              <input className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary col-span-2 md:col-span-1">Save Customer</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-xs pl-8 py-1.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {processedCustomers.length === 0 ? (
            <EmptyState message="No customers found." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1">Joined <ArrowUpDown size={12} /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedCustomers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{c.email || '—'}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{c.phone || '—'}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
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