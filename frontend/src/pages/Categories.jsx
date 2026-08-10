import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState } from '../components/ui.jsx'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    setLoading(true)

    api.get('/categories/')
      .then((res) => setCategories(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startFetching() {
      try {
        const res = await api.get('/categories/')
        if (!cancelled) setCategories(res.data)
      } catch (err) {
        if (!cancelled) console.error('Failed to load categories:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startFetching()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!categoryName.trim()) {
      setMessage('Category name is required.')
      return
    }

    try {
      await api.post('/categories/', {
        category_name: categoryName.trim(),
        description: description.trim() || null,
      })

      setCategoryName('')
      setDescription('')
      setShowForm(false)
      setMessage('Category added successfully.')
      load()
    } catch (err) {
      setMessage(
        err.response?.data?.detail || 'Failed to add category.'
      )
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return
    }

    try {
      await api.delete(`/categories/${id}`)
      load()
    } catch (err) {
      setMessage(
        err.response?.data?.detail || 'Failed to delete category.'
      )
    }
  }

  if (loading) {
    return <Loading label="Loading categories..." />
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Manage product categories."
      />

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setShowForm(!showForm)
            setMessage('')
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Category Name
              </label>

              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Kitchen Appliances"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter category description"
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save Category
            </button>
          </form>
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="card">
        {categories.length === 0 ? (
          <EmptyState message="No categories yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>

            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2 font-medium">
                    {c.category_name}
                  </td>

                  <td className="py-2 text-slate-500 dark:text-slate-400">
                    {c.description || '—'}
                  </td>

                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
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
