import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../services/api'
import { StatCard, Loading } from '../ui.jsx'
import { IndianRupee, Users, Boxes, ShieldCheck, Database, AlertTriangle, FileWarning, MapPinned } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function AdminDashboard() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }
    : undefined
  const [kpis, setKpis] = useState(null)
  const [teamCount, setTeamCount] = useState(0)
  const [loginMap, setLoginMap] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/kpis'),
      api.get('/users/').catch(() => ({ data: [] })),
      api.get('/system/login-map').catch(() => ({ data: null })),
    ]).then(([kpiRes, teamRes, mapRes]) => {
      setKpis(kpiRes.data)
      setTeamCount(Array.isArray(teamRes.data) ? teamRes.data.length : 0)
      setLoginMap(mapRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const mappedPoints = (loginMap?.items || []).filter((p) => p.latitude != null && p.longitude != null)

  if (loading) return <Loading label="Loading admin dashboard..." />
  if (!kpis) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={22} />
          <h2 className="text-xl font-bold">System Administrator Dashboard</h2>
        </div>
        <p className="text-slate-300 text-sm">Full system overview — analytics, users, and data health.</p>
      </div>

      {/* System Health Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${kpis.total_revenue.toLocaleString('en-IN')}`} icon={IndianRupee} tone="green" />
        <StatCard label="Team Members" value={teamCount} icon={Users} tone="brand" />
        <StatCard label="Total Products" value={kpis.total_products} icon={Boxes} tone="brand" />
        <StatCard label="System Alerts" value={kpis.low_stock_count + kpis.overdue_invoices} icon={AlertTriangle} tone="red" />
      </div>

      {/* Data Health */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className="text-green-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Database</h4>
          </div>
          <p className="text-2xl font-bold text-green-600">Healthy</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpis.total_products + kpis.total_customers + kpis.total_sales} records</p>
        </div>
        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Low Stock</h4>
          </div>
          <p className="text-2xl font-bold text-amber-600">{kpis.low_stock_count}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">items below reorder level</p>
        </div>
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-2 mb-2">
            <FileWarning size={16} className="text-red-600" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Overdue Invoices</h4>
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.overdue_invoices}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpis.pending_invoices} pending</p>
        </div>
      </div>

      {/* Full Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div data-tour="revenue-chart" className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Revenue Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={(kpis.revenue_by_day || []).slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Line type="monotone" dataKey="revenue" stroke="#64748b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Top Products</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kpis.top_products} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis type="category" dataKey="product" width={100} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={isDark ? { color: '#e2e8f0' } : undefined} />
              <Bar dataKey="revenue" fill="#64748b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* World Login Activity Map */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <MapPinned size={15} className="text-rose-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">World Login Activity</h3>
          <span className="text-[10px] text-slate-400 ml-auto">
            {mappedPoints.length} mapped · {loginMap?.total_logins ?? 0} total logins · {loginMap?.businesses?.length ?? 0} businesses
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-80 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {mappedPoints.length > 0 ? (
              <MapContainer center={[20.59, 78.96]} zoom={3} scrollWheelZoom={false} className="h-full w-full z-0">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <FitBounds points={mappedPoints} />
                {mappedPoints.map((p, i) => (
                  <CircleMarker
                    key={i}
                    center={[p.latitude, p.longitude]}
                    radius={Math.min(6 + p.count * 1.5, 26)}
                    pathOptions={{ color: '#e11d48', fillColor: '#f43f5e', fillOpacity: 0.55, weight: 1.5 }}
                  >
                    <MapTooltip direction="top" offset={[0, -6]}>
                      <div className="text-xs">
                        <strong>{p.location}</strong><br />
                        {p.count} login{p.count === 1 ? '' : 's'}
                        {p.businesses?.length > 0 ? ` · ${p.businesses.join(', ')}` : ''}
                      </div>
                    </MapTooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <MapPinned size={30} className="opacity-40 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No geolocated logins yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                  Pins appear once users sign in from real IP addresses — logins from this
                  machine are recorded as "Local".
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {!loginMap || loginMap.items.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No login location data yet.</p>
            ) : (
              loginMap.items.slice(0, 12).map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.latitude != null ? '#f43f5e' : '#94a3b8' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p.location}</p>
                    {p.businesses?.length > 0 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.businesses.join(', ')}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{p.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="/team" className="card hover:shadow-md transition-shadow border-l-4 border-slate-700">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Team Management</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{teamCount} members</p>
        </a>
        <a href="/datasets" className="card hover:shadow-md transition-shadow border-l-4 border-blue-500">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Data Ingestion</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Upload & manage datasets</p>
        </a>
        <a href="/anomalies" className="card hover:shadow-md transition-shadow border-l-4 border-red-500">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Anomaly Alerts</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review system anomalies</p>
        </a>
      </div>
    </div>
  )
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    map.fitBounds(
      points.map((p) => [p.latitude, p.longitude]),
      { padding: [40, 40], maxZoom: 6 }
    )
  }, [points, map])
  return null
}
