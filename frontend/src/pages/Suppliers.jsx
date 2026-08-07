import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState } from '../components/ui.jsx'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/suppliers/')
      .then((res) => setSuppliers(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading label="Loading suppliers..." />

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Manage product suppliers and vendors."
      />
      <div className="card">
        {suppliers.length === 0 ? (
          <EmptyState message="No suppliers yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Name</th>
                <th className="py-2">Contact</th>
                <th className="py-2">Email</th>
                <th className="py-2">Phone</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">{s.supplier_name}</td>
                  <td className="py-2">{s.contact_name || '—'}</td>
                  <td className="py-2 text-slate-500">{s.email || '—'}</td>
                  <td className="py-2 text-slate-500">{s.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
