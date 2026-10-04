import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutTemplate, Settings, RotateCcw } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import OwnerDashboard from '../components/dashboards/OwnerDashboard.jsx'
import ManagerDashboard from '../components/dashboards/ManagerDashboard.jsx'
import SalesDashboard from '../components/dashboards/SalesDashboard.jsx'
import AdminDashboard from '../components/dashboards/AdminDashboard.jsx'
import { DashboardSkeleton, Loading } from '../components/ui.jsx'
import api from '../services/api'
import { useDashboardData, CustomDashboardGrid, fetchActiveLayout } from '../components/dashboards/customDashboard.jsx'

export default function Dashboard() {
  const { user } = useAuth()

  if (!user) return <DashboardSkeleton />

  return <RoleOrCustomDashboard user={user} />
}

// The Dashboard Builder saves a layout with is_active=true; when one exists,
// THIS page renders it — that is what makes the builder's changes real. No
// saved layout (or the user opts out) falls back to the built-in dashboards.
function RoleOrCustomDashboard({ user }) {
  const [state, setState] = useState('loading') // 'loading' | 'custom' | 'static'
  const [active, setActive] = useState(null) // { id, name, layout }

  useEffect(() => {
    fetchActiveLayout()
      .then(a => {
        if (a) { setActive(a); setState('custom') } else { setState('static') }
      })
      .catch(() => setState('static'))
  }, [])

  if (state === 'loading') return <DashboardSkeleton />
  if (state === 'custom') return <CustomDashboardView active={active} onUseBuiltIn={() => setState('static')} />

  // Route to role-specific dashboard
  const role = typeof user.role === 'string' ? user.role : user.role?.role_name || user.role

  switch (role) {
    case 'store_manager':
      return <ManagerDashboard user={user} />
    case 'sales_executive':
      return <SalesDashboard user={user} />
    case 'admin':
      return <AdminDashboard user={user} />
    case 'business_owner':
    default:
      return <OwnerDashboard user={user} />
  }
}

function CustomDashboardView({ active, onUseBuiltIn }) {
  const { data, loading } = useDashboardData()
  const [deactivating, setDeactivating] = useState(false)

  const useBuiltIn = () => {
    setDeactivating(true)
    // Deactivate the saved layout (keep the arrangement so reactivating in
    // the builder restores it) — the main dashboard returns to built-in.
    api.put(`/user-data/dashboard-layouts/${active.id}`, {
      name: active.name || 'custom', layout_json: JSON.stringify(active.layout), is_active: false,
    })
      .catch(() => {})
      .finally(() => { setDeactivating(false); onUseBuiltIn() })
  }

  if (loading) return <Loading label="Loading your dashboard..." />

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 py-3 px-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <LayoutTemplate size={14} className="text-indigo-500" />
          <span>
            Custom dashboard{active.name ? ` · "${active.name}"` : ''} — arranged in the
            <Link to="/dashboard-builder" className="text-indigo-600 dark:text-indigo-400 font-semibold mx-1 hover:underline">Dashboard Builder</Link>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard-builder"
            className="btn-secondary flex items-center gap-1.5 text-xs">
            <Settings size={12} /> Customize
          </Link>
          <button onClick={useBuiltIn} disabled={deactivating}
            className="btn-secondary flex items-center gap-1.5 text-xs text-slate-500">
            <RotateCcw size={12} /> {deactivating ? 'Switching…' : 'Use built-in dashboard'}
          </button>
        </div>
      </div>
      <CustomDashboardGrid layout={active.layout} data={data} />
    </div>
  )
}
