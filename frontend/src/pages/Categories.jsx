import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState } from '../components/ui.jsx'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/categories/')
      .then((res) => setCategories(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading label="Loading categories..." />

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Manage product categories."
      />
      <div className="card">
        {categories.length === 0 ? (
          <EmptyState message="No categories yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">{c.category_name}</td>
                  <td className="py-2 text-slate-500">{c.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
