import { Routes, Route } from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Unauthorized from "../pages/auth/Unauthorized";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import DashboardLayout from "../components/layout/DashboardLayout";
import Dashboard from "../pages/dashboard/Dashboard";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        
        {/* Placeholders for future routes based on Access Matrix */}
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <div>User Management Content Placeholder</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="forecast"
          element={
            <ProtectedRoute allowedRoles={["business_owner", "admin"]}>
              <div>Forecast Reports Content Placeholder</div>
            </ProtectedRoute>
          }
        />
        {/* Add more specific routes as needed */}
      </Route>
    </Routes>
  );
}

export default AppRoutes;