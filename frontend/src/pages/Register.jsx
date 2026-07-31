import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ErrorBanner } from '../components/ui.jsx'

const ROLES = [
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'admin', label: 'System Administrator' },
]

export default function Register() {
  const { register, loading, error } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'sales_executive'
  })

  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()

    const ok = await register(form)

    if (ok) {
      setSuccess(true)
      setTimeout(() => navigate('/login'), 1200)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Create an account
        </h2>

        <p className="text-slate-500 text-sm mb-6">
          Join MarketMind AI to start managing your business.
        </p>

        <ErrorBanner message={error} />

        {success && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-4 py-3 text-sm mb-4">
            Account created! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="text-sm font-medium text-slate-700">
              Full name
            </label>

            <input
              name="full_name"
              required
              className="input mt-1"
              value={form.full_name}
              onChange={handleChange}
            />
          </div>


          <div>
            <label className="text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              name="email"
              required
              className="input mt-1"
              value={form.email}
              onChange={handleChange}
            />
          </div>


          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                className="input pr-10"
                value={form.password}
                onChange={handleChange}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>


          <div>
            <label className="text-sm font-medium text-slate-700">
              Role
            </label>

            <select
              name="role"
              className="input mt-1"
              value={form.role}
              onChange={handleChange}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>


          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center flex"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

        </form>


        <p className="text-sm text-slate-500 mt-6 text-center">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-brand-600 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}