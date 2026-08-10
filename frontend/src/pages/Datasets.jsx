import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import api, { uploadSalesCSV } from '../services/api'
import { Loading, PageHeader, EmptyState, Badge } from '../components/ui.jsx'

export default function Datasets() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)

  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await api.get('/datasets/')
      setDatasets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to load datasets:', err)
      setError(
        err.response?.data?.detail ||
        'Failed to load datasets.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startFetching() {
      try {
        const res = await api.get('/datasets/')
        if (!cancelled) setDatasets(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load datasets:', err)
          setError(err.response?.data?.detail || 'Failed to load datasets.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    startFetching()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await uploadSalesCSV(formData)
      setMessage(
        `Imported ${res.data.sales_created ?? 0} sales from "${file.name}".`
      )
      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Failed to upload CSV. Check the file and try again.'
      )
    } finally {
      setUploading(false)
      // Allow re-selecting the same file next time
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="Datasets"
        subtitle="Upload a sales CSV or view previously imported datasets."
        action={
          <div className="flex items-center gap-3">
            {message && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                {message}
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload Sales CSV'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <Loading label="Loading datasets..." />
        ) : datasets.length === 0 ? (
          <EmptyState message="No datasets uploaded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-2">Dataset Name</th>
                  <th className="py-3 px-2">Validation</th>
                  <th className="py-3 px-2">Total Records</th>
                  <th className="py-3 px-2">Valid</th>
                  <th className="py-3 px-2">Invalid</th>
                  <th className="py-3 px-2">Upload Date</th>
                </tr>
              </thead>

              <tbody>
                {datasets.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-2 font-medium">
                      {d.file_name || 'Unnamed dataset'}
                    </td>

                    <td className="py-3 px-2">
                      <Badge
                        tone={
                          d.validation_status?.toLowerCase() === 'valid'
                            ? 'green'
                            : 'blue'
                        }
                      >
                        {d.validation_status || 'Pending'}
                      </Badge>
                    </td>

                    <td className="py-3 px-2">
                      {d.total_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-green-600">
                      {d.valid_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-red-600">
                      {d.invalid_records ?? 0}
                    </td>

                    <td className="py-3 px-2 text-slate-500 dark:text-slate-400">
                      {d.upload_date
                        ? new Date(d.upload_date).toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
