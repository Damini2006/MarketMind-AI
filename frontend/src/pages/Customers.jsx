import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, ErrorBanner } from '../components/ui.jsx'
import { Plus, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Customers() {
  const { hasRole } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', gender: '' })

  const load = useCallback(() => {
    setLoading(true)
    api.get('/customers/').then((res) => setCustomers(res.data)).finally(() => setLoading(false))
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
      setForm({ full_name: '', email: '', phone: '', address: '', gender: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create customer.')
    }
  }

  if (loading) return <Loading label="Loading customers..." />

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer profiles and contact directory."
        action={
          canCreate && (
            <div className="flex gap-2">
              <label className="btn-secondary cursor-pointer flex items-center gap-2">
                <Upload size={16} /> Upload CSV
                <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
              </label>
              <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Add Customer
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
              <label className="text-xs font-medium text-slate-600">Full Name</label>
              <input className="input mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Phone</label>
              <input className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Gender</label>
              <select className="input mt-1" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button type="submit" className="btn-primary md:col-span-1">Save Customer</button>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        {customers.length === 0 ? (
          <EmptyState message="No customers yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-800">{c.full_name}</td>
                  <td className="py-2 pr-4 text-slate-500">{c.email || '—'}</td>
                  <td className="py-2 pr-4 text-slate-500">{c.phone || '—'}</td>
                  <td className="py-2 pr-4 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
