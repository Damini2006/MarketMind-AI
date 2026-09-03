import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { Loading, PageHeader } from '../components/ui.jsx'
import { ClipboardList, Search, Download, User, Globe, Clock, Filter, BarChart3, Zap, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'

export default function AuditTrail() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const load = useCallback(() => {
    api.get('/audit/logs')
      .then((res) => setLogs(Array.isArray(res.data) ? res.data : res.data.items || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = logs.filter((log) => {
    const matchesSearch = !search ||
      log.user?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.resource?.toLowerCase().includes(search.toLowerCase())
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter
    return matchesSearch && matchesAction
  })

  // Generate heatmap data from logs
  const heatmapData = (() => {
    const now = Date.now()
    const dayMs = 86400000
    const days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * dayMs).toISOString().slice(0, 10)
      const count = logs.filter(l => l.timestamp?.startsWith(date)).length
      days.push({ date, count })
    }
    return days
  })()

  // Generate hourly distribution
  const hourlyData = (() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    logs.forEach(l => {
      if (l.timestamp) {
        const h = new Date(l.timestamp).getHours()
        hours[h].count++
      }
    })
    return hours
  })()

  // Generate action distribution
  const actionDist = (() => {
    const dist = {}
    logs.forEach(l => { if (l.action_type) dist[l.action_type] = (dist[l.action_type] || 0) + 1 })
    return Object.entries(dist).map(([name, value]) => ({ name, value }))
  })()

  const actionTypes = [...new Set(logs.map(l => l.action_type))].filter(Boolean)

  const handleExportPDF = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Details']
    const rows = filtered.map(l => [l.timestamp, l.user, l.action, l.resource, l.ip_address, l.details || ''])
    exportToPDF({ title: 'Audit Trail Report', subtitle: `${filtered.length} events`, headers, rows, filename: 'audit-trail' })
  }

  const handleExportExcel = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Details']
    const rows = filtered.map(l => [l.timestamp, l.user, l.action, l.resource, l.ip_address, l.details || ''])
    exportToExcel({ title: 'Audit Trail Report', headers, rows, filename: 'audit-trail' })
  }

  const getActionColor = (type) => {
    const colors = {
      create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      export: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      view: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    }
    return colors[type] || colors.view
  }

  if (loading) return <Loading label="Loading audit trail..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('activity.title')}
        subtitle={`${filtered.length} events tracked`}
        action={
          <div className="flex gap-2">
            <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <Download size={14} /> PDF
            </button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Download size={14} /> Excel
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{logs.length}</p>
          <p className="text-[10px] text-slate-500 uppercase">Total Events</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-green-600">{logs.filter(l => l.action_type === 'create').length}</p>
          <p className="text-[10px] text-slate-500 uppercase">Created</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-blue-600">{logs.filter(l => l.action_type === 'update').length}</p>
          <p className="text-[10px] text-slate-500 uppercase">Updated</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-2xl font-bold text-purple-600">{logs.filter(l => l.action_type === 'login').length}</p>
          <p className="text-[10px] text-slate-500 uppercase">Logins</p>
        </div>
      </div>

      {/* Heatmap + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-emerald-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activity Heatmap</span>
            <span className="text-[10px] text-slate-400 ml-auto">30 days</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(() => {
              const maxCount = Math.max(...heatmapData.map(d => d.count), 1)
              const weeks = []
              for (let i = 0; i < heatmapData.length; i += 7) weeks.push(heatmapData.slice(i, i + 7))
              const getColor = (count) => {
                if (count === 0) return 'bg-slate-100 dark:bg-slate-800'
                const ratio = count / maxCount
                if (ratio > 0.75) return 'bg-emerald-500'
                if (ratio > 0.5) return 'bg-emerald-400'
                if (ratio > 0.25) return 'bg-emerald-300'
                return 'bg-emerald-200 dark:bg-emerald-800'
              }
              return weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day, di) => (
                    <div key={di} className={`w-3 h-3 rounded-sm ${getColor(day.count)} cursor-default transition-colors`} title={`${day.date}: ${day.count} events`} />
                  ))}
                </div>
              ))
            })()}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activity by Hour</span>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" tick={{ fontSize: 8 }} tickFormatter={h => `${h}`} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Action Distribution */}
      {actionDist.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-violet-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Action Breakdown</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {actionDist.map((a, i) => {
              const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 capitalize">{a.name?.replace('_', ' ')}</span>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{a.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit logs..."
              className="w-full pl-8 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-slate-300"
          >
            <option value="all">All Actions</option>
            {actionTypes.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase">Timestamp</th>
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase">User</th>
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase">Action</th>
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase">Resource</th>
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase">IP Address</th>
              <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase hidden md:table-cell">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  <ClipboardList size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No audit events found.</p>
                </td>
              </tr>
            ) : filtered.map((log, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock size={10} />
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <User size={12} className="text-slate-400" />
                    {log.user || '—'}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${getActionColor(log.action_type)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">{log.resource || '—'}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Globe size={10} />
                    {log.ip_address || '127.0.0.1'}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[11px] text-slate-500 hidden md:table-cell">{log.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


