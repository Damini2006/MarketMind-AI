import React, { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'

export default function Datasets() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/datasets/')
      .then((res) => setDatasets(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading label="Loading datasets..." />

  return (
    <div>
      <PageHeader
        title="Datasets"
        subtitle="Manage and view uploaded datasets."
      />
      <div className="card">
        {datasets.length === 0 ? (
          <EmptyState message="No datasets uploaded yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Dataset Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Rows Count</th>
                <th className="py-2">Upload Date</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">{d.dataset_name}</td>
                  <td className="py-2">
                    <Badge tone="blue">{d.dataset_type}</Badge>
                  </td>
                  <td className="py-2">{d.rows_count}</td>
                  <td className="py-2 text-slate-500">{new Date(d.upload_date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
