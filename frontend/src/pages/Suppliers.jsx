import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState } from '../components/ui.jsx'
import { Plus, Trash2, X } from 'lucide-react'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    supplier_name: '',
    phone: '',
    email: '',
    address: '',
  })

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await api.get('/suppliers/')
      setSuppliers(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load suppliers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startFetching() {
      try {
        const res = await api.get('/suppliers/')
        if (!cancelled) setSuppliers(res.data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load suppliers.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startFetching()
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.supplier_name.trim()) {
      setError('Supplier name is required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      await api.post('/suppliers/', {
        supplier_name: form.supplier_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      })

      setForm({
        supplier_name: '',
        phone: '',
        email: '',
        address: '',
      })

      setShowForm(false)
      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Failed to create supplier.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this supplier?'
    )

    if (!confirmed) return

    try {
      setError('')
      await api.delete(`/suppliers/${id}`)
      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Failed to delete supplier.'
      )
    }
  }

  if (loading) {
    return <Loading label="Loading suppliers..." />
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Manage product suppliers and vendors."
      />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setShowForm(!showForm)
            setError('')
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Supplier
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Add Supplier
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  name="supplier_name"
                  value={form.supplier_name}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter address"
                  className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2"
                />
              </div>

            </div>

            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {suppliers.length === 0 ? (
          <EmptyState message="No suppliers yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2">Name</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Email</th>
                <th className="py-2">Address</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 font-medium">
                    {s.supplier_name}
                  </td>

                  <td className="py-3">
                    {s.phone || '—'}
                  </td>

                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    {s.email || '—'}
                  </td>

                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    {s.address || '—'}
                  </td>

                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
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
