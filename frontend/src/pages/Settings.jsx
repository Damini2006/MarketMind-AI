import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import { User, Lock, ShieldCheck, Globe, CheckCircle2, Save, KeyRound, Eye, EyeOff } from 'lucide-react'

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

const PERMISSIONS_MAP = {
  business_owner: [
    'Full access to Sales, Revenue & Inventory analytics',
    'Access to Customer Segmentation & Churn Risk models',
    'AI Recommendations & Anomaly Alerts management',
    'User & Store Management Control',
  ],
  admin: [
    'System-wide administrative privileges',
    'Database ingestion & direct API management',
    'User permission overrides & role assignments',
    'Full access to all ML prediction modules',
  ],
  store_manager: [
    'Access to Sales ingestion & Inventory updates',
    'Customer view & Invoice generation',
    'Stock Anomaly alerts & basic forecasting',
  ],
  sales_executive: [
    'Sales entry & Invoice creation',
    'Customer directory access',
    'View-only access to basic dashboard KPIs',
  ],
}

export default function Settings() {
  const { user, setUser } = useAuth()

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [prevUser, setPrevUser] = useState(user)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Synchronize state when user object loads without triggering useEffect warnings
  if (user !== prevUser) {
    setPrevUser(user)
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
  }

  // Profile Update Handler
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    setProfileLoading(true)

    try {
      const res = await api.put('/auth/profile', { full_name: fullName, email })
      if (setUser && res.data) {
        setUser((prev) => ({ ...prev, ...res.data }))
      }
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update profile details.',
      })
    } finally {
      setProfileLoading(false)
    }
  }

  // Password Update Handler
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg({ type: '', text: '' })

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long.' })
      return
    }

    setPasswordLoading(true)

    try {
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update password.',
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  const userPermissions = PERMISSIONS_MAP[user?.role] || PERMISSIONS_MAP['business_owner']

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings & Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your profile credentials, system preferences, and security settings.
        </p>
      </div>

      {/* User Header Profile Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">
            {fullName ? fullName.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{fullName || 'User Profile'}</h2>
            <p className="text-sm text-slate-500">{email}</p>
          </div>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
          Role: {ROLE_LABELS[user?.role] || user?.role || 'Business Owner'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information & Security Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <User size={20} className="text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Profile Information</h3>
          </div>

          {profileMsg.text && (
            <div
              className={`p-3 rounded-lg text-sm ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Password Reset Form */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Security & Password</h3>
            </div>

            {passwordMsg.text && (
              <div
                className={`p-3 rounded-lg text-sm mb-4 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <KeyRound size={16} />
                  {passwordLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Role Permissions</h3>
            </div>
            <p className="text-xs text-slate-500">
              Your assigned privileges as an active{' '}
              <span className="font-semibold">{ROLE_LABELS[user?.role] || 'User'}</span>:
            </p>
            <ul className="space-y-2 pt-1">
              {userPermissions.map((perm, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{perm}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">Preferences</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 text-xs font-medium">Default Currency</span>
                <span className="font-semibold text-slate-800">₹ INR</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-slate-100">
                <span className="text-slate-600 text-xs font-medium">Timezone</span>
                <span className="text-xs text-slate-800 font-mono">IST (UTC+05:30)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}