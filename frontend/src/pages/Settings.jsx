import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import Avatar from '../components/Avatar'
import { User, Lock, ShieldCheck, Globe, CheckCircle2, Save, KeyRound, Eye, EyeOff, Building2, Camera, Trash2, Loader2 } from 'lucide-react'
import { AVATAR_COLORS } from '../utils/avatar'

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
]

const TIMEZONES = [
  { code: 'Asia/Kolkata', label: 'IST (UTC+05:30)' },
  { code: 'UTC', label: 'UTC' },
  { code: 'Europe/London', label: 'GMT (UTC±00:00)' },
  { code: 'America/New_York', label: 'EST (UTC-05:00)' },
]

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
  const [phone, setPhone] = useState(user?.phone || '')
  const [currency, setCurrency] = useState(user?.preferred_currency || 'INR')
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata')
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || 'indigo')
  const [bio, setBio] = useState(user?.bio || '')
  const [business, setBusiness] = useState(null)
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' })
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef(null)
  const [prefsMsg, setPrefsMsg] = useState({ type: '', text: '' })
  const [prefsLoading, setPrefsLoading] = useState(false)
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
    setPhone(user?.phone || '')
    setCurrency(user?.preferred_currency || 'INR')
    setTimezone(user?.timezone || 'Asia/Kolkata')
    setAvatarColor(user?.avatar_color || 'indigo')
    setBio(user?.bio || '')
  }

  // Load company info for the tenant card
  useEffect(() => {
    api.get('/users/business')
      .then((res) => setBusiness(res.data))
      .catch(() => setBusiness(null))
  }, [])

  // Profile Update Handler
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    setProfileLoading(true)

    try {
      const res = await api.put('/auth/profile', {
        full_name: fullName,
        email,
        phone: phone || null,
        preferred_currency: currency,
        timezone,
        avatar_color: avatarColor,
        bio: bio || null,
      })
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

  // Profile Photo Handlers
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarMsg({ type: '', text: '' })
    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (setUser && res.data) {
        setUser((prev) => ({ ...prev, ...res.data }))
      }
      setAvatarMsg({ type: 'success', text: 'Profile photo updated!' })
    } catch (err) {
      setAvatarMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to upload photo.',
      })
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarMsg({ type: '', text: '' })
    setAvatarLoading(true)
    try {
      const res = await api.delete('/users/avatar')
      if (setUser && res.data) {
        setUser((prev) => ({ ...prev, ...res.data }))
      }
      setAvatarMsg({ type: 'success', text: 'Profile photo removed.' })
    } catch (err) {
      setAvatarMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to remove photo.',
      })
    } finally {
      setAvatarLoading(false)
    }
  }

  // Preferences Save Handler (shares the profile endpoint)
  const handleSavePreferences = async () => {
    setPrefsMsg({ type: '', text: '' })
    setPrefsLoading(true)
    try {
      const res = await api.put('/auth/profile', {
        full_name: fullName,
        email,
        phone: phone || null,
        preferred_currency: currency,
        timezone,
        avatar_color: avatarColor,
        bio: bio || null,
      })
      if (setUser && res.data) {
        setUser((prev) => ({ ...prev, ...res.data }))
      }
      setPrefsMsg({ type: 'success', text: 'Preferences saved!' })
    } catch (err) {
      setPrefsMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to save preferences.',
      })
    } finally {
      setPrefsLoading(false)
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

  // Profile completion meter
  const completionItems = [
    { label: 'Profile photo', done: !!user?.avatar_url },
    { label: 'Phone number', done: !!phone },
    { label: 'Bio', done: !!bio },
    { label: 'Preferences set', done: !!currency && !!timezone },
  ]
  const completionPct = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings & Profile</h1>
        <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
          Manage your profile credentials, system preferences, and security settings.
        </p>
      </div>

      {/* User Header Profile Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <Avatar
                user={{ full_name: fullName, avatar_color: avatarColor, avatar_url: user?.avatar_url }}
                size="lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                title="Upload photo"
                className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              >
                {avatarLoading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 disabled:opacity-50"
              >
                <Camera size={12} /> {user?.avatar_url ? 'Change photo' : 'Upload photo'}
              </button>
              {user?.avatar_url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  className="text-[11px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
            {avatarMsg.text && (
              <p className={`text-[11px] ${avatarMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {avatarMsg.text}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              {Object.entries(AVATAR_COLORS).map(([key, cls]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAvatarColor(key)}
                  title={`${key} avatar`}
                  className={`w-5 h-5 rounded-full ${cls} ${
                    avatarColor === key ? 'ring-2 ring-offset-2 ring-brand-500 dark:ring-offset-slate-800' : 'opacity-70 hover:opacity-100'
                  } transition-all`}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{fullName || 'User Profile'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
            {phone && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{phone}</p>}
            {bio && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic max-w-sm">{bio}</p>}
          </div>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900/60">
          Role: {ROLE_LABELS[user?.role] || user?.role || 'Business Owner'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information & Security Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-700/60">
            <User size={20} className="text-brand-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Profile Information</h3>
          </div>

          {profileMsg.text && (
            <div
              className={`p-3 rounded-lg text-sm ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional contact number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Short intro — e.g. Founder of Mega Mart, passionate about retail analytics."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 resize-none"
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
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Security & Password</h3>
            </div>

            {passwordMsg.text && (
              <div
                className={`p-3 rounded-lg text-sm mb-4 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
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
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Profile Completion</h3>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{completionPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <ul className="space-y-1.5 pt-1">
              {completionItems.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
              <Building2 size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Your Business</h3>
            </div>
            {business ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 text-xs font-medium dark:text-slate-300">Company</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{business.company_name}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-600 text-xs font-medium dark:text-slate-300">Team Members</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{business.member_count}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-600 text-xs font-medium dark:text-slate-300">Member Since</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {new Date(business.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading business info...</p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
              <ShieldCheck size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Role Permissions</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your assigned privileges as an active{' '}
              <span className="font-semibold">{ROLE_LABELS[user?.role] || 'User'}</span>:
            </p>
            <ul className="space-y-2 pt-1">
              {userPermissions.map((perm, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{perm}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/60">
              <Globe size={20} className="text-brand-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Preferences</h3>
            </div>
            {prefsMsg.text && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  prefsMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'
                }`}
              >
                {prefsMsg.text}
              </div>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-600 text-xs font-medium mb-1.5 dark:text-slate-300">Default Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 text-xs font-medium mb-1.5 dark:text-slate-300">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  {TIMEZONES.map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={prefsLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Save size={16} />
                {prefsLoading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}