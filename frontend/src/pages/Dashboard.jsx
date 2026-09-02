import { useAuth } from '../context/AuthContext.jsx'
import OwnerDashboard from '../components/dashboards/OwnerDashboard.jsx'
import ManagerDashboard from '../components/dashboards/ManagerDashboard.jsx'
import SalesDashboard from '../components/dashboards/SalesDashboard.jsx'
import AdminDashboard from '../components/dashboards/AdminDashboard.jsx'
import { Loading } from '../components/ui.jsx'

export default function Dashboard() {
  const { user } = useAuth()

  if (!user) return <Loading label="Loading dashboard..." />

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
