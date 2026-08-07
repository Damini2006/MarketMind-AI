import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sales from './pages/Sales.jsx'
import Inventory from './pages/Inventory.jsx'
import Invoices from './pages/Invoices.jsx'
import Customers from './pages/Customers.jsx'
import Forecasting from './pages/Forecasting.jsx'
import Segmentation from './pages/Segmentation.jsx'
import Churn from './pages/Churn.jsx'
import Recommendations from './pages/Recommendations.jsx'
import Anomalies from './pages/Anomalies.jsx'
import Categories from './pages/Categories.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Team from './pages/Team.jsx'
import Datasets from './pages/Datasets.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role.role_name))) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="sales" element={<Sales />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="customers" element={<Customers />} />
        <Route path="categories" element={<Categories />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="datasets" element={<Datasets />} />
        
        <Route
          path="team"
          element={
            <ProtectedRoute allowedRoles={['business_owner', 'admin']}>
              <Team />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="forecasting"
          element={
            <ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}>
              <Forecasting />
            </ProtectedRoute>
          }
        />
        <Route path="segmentation" element={<Segmentation />} />
        <Route
          path="churn"
          element={
            <ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}>
              <Churn />
            </ProtectedRoute>
          }
        />
        <Route path="recommendations" element={<Recommendations />} />
        <Route
          path="anomalies"
          element={
            <ProtectedRoute allowedRoles={['business_owner', 'store_manager', 'admin']}>
              <Anomalies />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
