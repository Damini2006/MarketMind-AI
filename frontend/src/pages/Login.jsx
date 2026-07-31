import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../context/AuthContext.jsx";
import { ErrorBanner } from "../components/ui.jsx";

const ROLES = [
  { value: "business_owner", label: "Business Owner" },
  { value: "store_manager", label: "Store Manager" },
  { value: "sales_executive", label: "Sales Executive" },
  { value: "admin", label: "System Administrator" },
];

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales_executive");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const ok = await login(email, password, role);

    if (ok) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Left Side */}
        <div className="hidden md:flex flex-col justify-center bg-brand-900 text-white p-12">

          <h1 className="text-5xl font-bold mb-6">
            MarketMind AI
          </h1>

          <p className="text-brand-100 text-lg leading-8">
            AI-powered sales intelligence platform designed for
            retail stores, supermarkets and small businesses.

            <br /><br />

            Manage inventory, customers, invoices, sales,
            analytics and business insights—all from one dashboard.
          </p>

          <div className="mt-10 space-y-4 text-lg">
            <div>📊 Smart Sales Analytics</div>
            <div>📦 Inventory Management</div>
            <div>👥 Customer Management</div>
            <div>📈 Business Insights</div>
          </div>

        </div>


        {/* Right Side */}
        <div className="p-10 flex flex-col justify-center">

          <h2 className="text-4xl font-bold text-slate-900 mb-2">
            Welcome back
          </h2>

          <p className="text-slate-500 mb-8">
            Sign in to your account to continue.
          </p>

          <ErrorBanner message={error} />


          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Email
              </label>

              <input
                type="email"
                required
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>


            {/* Password */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="relative">

                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? (
                    <FiEyeOff size={20} />
                  ) : (
                    <FiEye size={20} />
                  )}
                </button>

              </div>
            </div>


            {/* Role Dropdown */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Role
              </label>

              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>


            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex justify-center"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>


          </form>


          <p className="text-center text-slate-500 mt-8">
            New business?{" "}
            <Link
              to="/register"
              className="text-brand-600 font-semibold hover:underline"
            >
              Create an account
            </Link>
          </p>


        </div>
      </div>
    </div>
  );
}