import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import Avatar from '../components/Avatar'
import { User, Lock, Shield, Globe, CheckCircle2, Save, KeyRound, Eye, EyeOff, Building2, Camera, Loader2, Calendar, RotateCcw, Download, Smartphone, ShieldCheck } from 'lucide-react'
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

const ROLE_PAGES = {
  business_owner: [
    'Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers',
    'Categories', 'Suppliers', 'Team', 'Datasets', 'Forecasting',
    'Segmentation', 'Churn Risk', 'Recommendations', 'Anomaly Alerts',
    'Activity Log', 'Settings',
  ],
  store_manager: [
    'Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers',
    'Categories', 'Suppliers', 'Forecasting', 'Segmentation',
    'Churn Risk', 'Recommendations', 'Anomaly Alerts', 'Activity Log', 'Settings',
  ],
  sales_executive: [
    'Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers',
    'Segmentation', 'Recommendations', 'Settings',
  ],
  admin: [
    'Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers',
    'Categories', 'Suppliers', 'Team', 'Datasets', 'Forecasting',
    'Segmentation', 'Churn Risk', 'Recommendations', 'Anomaly Alerts',
    'Activity Log', 'Settings',
  ],
}

const ROLE_COLORS = {
  business_owner: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/60', dot: 'bg-amber-500' },
  store_manager: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/60', dot: 'bg-blue-500' },
  sales_executive: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/60', dot: 'bg-emerald-500' },
  admin: { bg: 'bg-slate-50 dark:bg-slate-700/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-600', dot: 'bg-slate-500' },
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
]

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'preferences', label: 'Preferences', icon: Globe },
]

// ─── Two-Factor Authentication Section ────────────────────────────────
const TOTP_KEY = 'marketmind_2fa'
const BACKUP_CODES_KEY = 'marketmind_2fa_backup'

function generateBackupCodes() {
  const codes = []
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase()
    codes.push(code)
  }
  return codes
}

function generateTOTPUri(email) {
  const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(20)))).replace(/=/g, '').substring(0, 32)
  return { secret, uri: `otpauth://totp/MarketMind:${email}?secret=${secret}&issuer=MarketMind&algorithm=SHA1&digits=6&period=30` }
}

function TwoFactorSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOTP_KEY))?.enabled || false } catch { return false }
  })
  const [setupStep, setSetupStep] = useState(null)
  const [totpSecret, setTotpSecret] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BACKUP_CODES_KEY)) || [] } catch { return [] }
  })
  const [error, setError] = useState('')
  const [showBackup, setShowBackup] = useState(false)

  const startSetup = () => {
    const email = user?.email || 'user@marketmind.ai'
    const { secret, uri } = generateTOTPUri(email)
    setTotpSecret({ secret, uri })
    setSetupStep('qr')
    setError('')
  }

  const verifyAndEnable = () => {
    if (verifyCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    const codes = generateBackupCodes()
    setBackupCodes(codes)
    localStorage.setItem(BACKUP_CODES_KEY, JSON.stringify(codes))
    localStorage.setItem(TOTP_KEY, JSON.stringify({ enabled: true, secret: totpSecret?.secret }))
    setEnabled(true)
    setSetupStep('backup')
    setError('')
  }

  const disable2FA = () => {
    if (!window.confirm('Are you sure you want to disable 2FA? This reduces your account security.')) return
    localStorage.removeItem(TOTP_KEY)
    localStorage.removeItem(BACKUP_CODES_KEY)
    setEnabled(false)
    setBackupCodes([])
    setSetupStep(null)
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
  }

  const qrUrl = totpSecret?.uri ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSecret.uri)}` : ''

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
          <Shield size={20} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h3>
            {enabled && <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full">ENABLED</span>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {enabled ? 'Your account is protected with an authenticator app.' : 'Add an extra layer of security with an authenticator app.'}
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* Status / Enable / Disable */}
        {!setupStep && (
          <div className="flex items-center gap-3">
            {enabled ? (
              <>
                <button onClick={() => setShowBackup(!showBackup)} className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5">
                  <KeyRound size={12} /> {showBackup ? 'Hide' : 'View'} Backup Codes
                </button>
                <button onClick={disable2FA} className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
                  Disable 2FA
                </button>
              </>
            ) : (
              <button onClick={startSetup} className="px-4 py-2.5 text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-1.5 shadow-sm">
                <Shield size={14} /> Enable Two-Factor Authentication
              </button>
            )}
          </div>
        )}

        {/* Backup Codes Display */}
        {showBackup && backupCodes.length > 0 && !setupStep && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Backup Codes</p>
              <button onClick={copyBackupCodes} className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium">Copy All</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-center">{code}</code>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Save these codes somewhere safe. Each code can only be used once.</p>
          </div>
        )}

        {/* Setup Flow - QR */}
        {setupStep === 'qr' && (
          <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Step 1: Scan QR Code</p>
            <p className="text-[11px] text-slate-500 mb-4">Open your authenticator app (Google Authenticator, Authy, 1Password) and scan this QR code.</p>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                {qrUrl && <img src={qrUrl} alt="TOTP QR Code" className="w-[180px] h-[180px]" />}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 mb-1">Or enter this secret manually:</p>
                <code className="text-xs font-mono bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 select-all">{totpSecret?.secret}</code>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSetupStep(null)} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => setSetupStep('verify')} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Next →</button>
            </div>
          </div>
        )}

        {/* Setup Flow - Verify */}
        {setupStep === 'verify' && (
          <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Step 2: Verify Code</p>
            <p className="text-[11px] text-slate-500 mb-4">Enter the 6-digit code from your authenticator app.</p>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <input
              type="text"
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-48 text-center text-2xl font-mono tracking-[0.3em] px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSetupStep('qr')} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">← Back</button>
              <button onClick={verifyAndEnable} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Verify & Enable</button>
            </div>
          </div>
        )}

        {/* Setup Flow - Backup Codes */}
        {setupStep === 'backup' && (
          <div className="mt-4 p-5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">2FA Enabled Successfully!</p>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-4">Save these backup codes somewhere safe.</p>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-center">{code}</code>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={copyBackupCodes} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">Copy Codes</button>
              <button onClick={() => { setSetupStep(null); setShowBackup(false) }} className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Install App Section ─────────────────────────────────────────────
function InstallAppSection() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setIsInstalled(true)
        setDeferredPrompt(null)
      } else {
        setShowInstructions(true)
      }
    } catch {
      setShowInstructions(true)
    } finally {
      setInstalling(false)
    }
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent)
  const isEdge = /Edg/i.test(navigator.userAgent)

  if (isInstalled) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Install MarketMind AI</h3>
            <p className="text-xs text-green-600 dark:text-green-400">✓ App is installed and running</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <Smartphone size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Install MarketMind AI</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add to your home screen for quick access</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Install on your device for faster access, offline support, and an app-like experience.
        </p>
        <button onClick={handleInstall} disabled={installing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
          <Download size={16} />
          {installing ? 'Installing...' : deferredPrompt ? 'Install App Now' : isMobile ? 'Add to Home Screen' : 'Install as App'}
        </button>
        {!deferredPrompt && !showInstructions && (
          <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {isChrome && <p>💡 Look for the install icon 🖥️ in Chrome's address bar</p>}
            {isEdge && <p>💡 Click ⋮ menu → Apps → "Install this site as an app"</p>}
            {isAndroid && <p>💡 Tap ⋮ menu → "Add to Home screen"</p>}
            {isIOS && <p>💡 Tap Share → "Add to Home Screen"</p>}
            {!isChrome && !isEdge && !isAndroid && !isIOS && (
              <p>💡 Use Chrome/Edge for easiest installation, or check your browser's menu for "Install" option</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Settings Component ─────────────────────────────────────────
export default function Settings() {
  const { user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [currency, setCurrency] = useState(user?.preferred_currency || 'INR')
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata')
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || 'indigo')
  const [bio, setBio] = useState(user?.bio || '')
  const [dob, setDob] = useState(user?.dob || '')
  const [business, setBusiness] = useState(null)
  const [, setAvatarMsg] = useState({ type: '', text: '' })
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

  // Synchronize state when user object loads
  if (user !== prevUser) {
    setPrevUser(user)
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
    setPhone(user?.phone || '')
    setCurrency(user?.preferred_currency || 'INR')
    setTimezone(user?.timezone || 'Asia/Kolkata')
    setAvatarColor(user?.avatar_color || 'indigo')
    setBio(user?.bio || '')
    setDob(user?.dob || '')
  }

  useEffect(() => {
    api.get('/users/business')
      .then((res) => setBusiness(res.data))
      .catch(() => setBusiness(null))
  }, [])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    setProfileLoading(true)
    try {
      const res = await api.put('/auth/profile', {
        full_name: fullName, email, phone: phone || null,
        preferred_currency: currency, timezone, avatar_color: avatarColor,
        bio: bio || null, dob: dob || null,
      })
      if (setUser && res.data) setUser((prev) => ({ ...prev, ...res.data }))
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile.' })
    } finally { setProfileLoading(false) }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarMsg({ type: '', text: '' })
    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/users/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (setUser && res.data) setUser((prev) => ({ ...prev, ...res.data }))
      setAvatarMsg({ type: 'success', text: 'Profile photo updated!' })
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to upload photo.' })
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSavePreferences = async () => {
    setPrefsMsg({ type: '', text: '' })
    setPrefsLoading(true)
    try {
      const res = await api.put('/auth/profile', {
        full_name: fullName, email, phone: phone || null,
        preferred_currency: currency, timezone, avatar_color: avatarColor,
        bio: bio || null, dob: dob || null,
      })
      if (setUser && res.data) setUser((prev) => ({ ...prev, ...res.data }))
      setPrefsMsg({ type: 'success', text: 'Preferences saved!' })
    } catch (err) {
      setPrefsMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to save preferences.' })
    } finally { setPrefsLoading(false) }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg({ type: '', text: '' })
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' }); return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return
    }
    setPasswordLoading(true)
    try {
      await api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword })
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update password.' })
    } finally { setPasswordLoading(false) }
  }

  const userRole = user?.role?.role_name || user?.role || 'business_owner'
  const userPages = ROLE_PAGES[userRole] || ROLE_PAGES.business_owner
  const roleColor = ROLE_COLORS[userRole] || ROLE_COLORS.business_owner

  const completionItems = [
    { label: 'Profile photo', done: !!user?.avatar_url },
    { label: 'Phone number', done: !!phone },
    { label: 'Bio', done: !!bio },
    { label: 'Preferences set', done: !!currency && !!timezone },
  ]
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const SectionCard = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>
      {children}
    </div>
  )

  const SectionHeader = ({ icon: Icon, title, subtitle, iconBg = 'bg-brand-100 dark:bg-brand-500/20', iconColor = 'text-brand-600 dark:text-brand-400' }) => (
    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )

  const InputField = ({ label, children }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  )

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Manage your profile, security, and preferences.</p>
        </div>
        <button onClick={async () => { localStorage.removeItem('marketmind_tour_seen'); try { await api.put('/users/tour-status', { tour_completed: false }) } catch { /* noop */ } window.location.reload() }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-medium shrink-0">
          <RotateCcw size={16} /> Replay Tour
        </button>
      </div>

      {/* Profile Header Card */}
      <SectionCard className="mb-6">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <Avatar user={{ full_name: fullName, avatar_color: avatarColor, avatar_url: user?.avatar_url }} size="lg" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}
                className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0">
                {avatarLoading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div className="flex items-center gap-1">
              {Object.entries(AVATAR_COLORS).map(([key, cls]) => (
                <button key={key} type="button" onClick={() => setAvatarColor(key)} title={`${key} avatar`}
                  className={`w-4 h-4 rounded-full ${cls} ${avatarColor === key ? 'ring-2 ring-offset-1 ring-brand-500 dark:ring-offset-slate-800' : 'opacity-60 hover:opacity-100'} transition-all`} />
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{fullName || 'User Profile'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{email}</p>
            {bio && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic truncate">{bio}</p>}
          </div>
          <div className="flex items-center gap-4">
            {/* Completion */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Profile</p>
                <p className="text-sm font-bold text-brand-600">{completionPct}%</p>
              </div>
              <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${roleColor.bg} ${roleColor.text} border ${roleColor.border}`}>
              <span className={`w-2 h-2 rounded-full ${roleColor.dot}`} />
              {ROLE_LABELS[userRole] || 'Business Owner'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 border border-slate-200 dark:border-slate-700">
        {TABS.map(({ key, label, icon: TabIcon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}>
            <TabIcon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <SectionCard>
              <SectionHeader icon={User} title="Profile Information" subtitle="Your personal details and bio" />
              <div className="p-6">
                {profileMsg.text && (
                  <div className={`p-3 rounded-lg text-sm mb-4 ${profileMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'}`}>
                    {profileMsg.text}
                  </div>
                )}
                <form onSubmit={handleUpdateProfile} className="space-y-4" autoComplete="off">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Full Name">
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} required />
                    </InputField>
                    <InputField label="Email Address">
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                    </InputField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Phone">
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className={inputClass} />
                    </InputField>
                    <InputField label="Date of Birth">
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${inputClass} pl-9`} />
                      </div>
                    </InputField>
                  </div>
                  <InputField label="Bio">
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Short intro about yourself" className={`${inputClass} resize-none`} />
                  </InputField>
                  <button type="submit" disabled={profileLoading}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
                    <Save size={16} />{profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SectionCard>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Profile Completion</h3>
                  <span className="text-sm font-bold text-brand-600">{completionPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${completionPct}%` }} />
                </div>
                <ul className="space-y-1.5">
                  {completionItems.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader icon={Building2} title="Your Business" iconBg="bg-blue-100 dark:bg-blue-500/20" iconColor="text-blue-600 dark:text-blue-400" />
              <div className="p-5">
                {business ? (
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Company</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{business.company_name}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Team Members</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{business.member_count}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Member Since</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {new Date(business.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Loading business info...</p>
                )}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader icon={ShieldCheck} title="Your Role" iconBg="bg-amber-100 dark:bg-amber-500/20" iconColor="text-amber-600 dark:text-amber-400" />
              <div className="p-5 space-y-3">
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${roleColor.bg} ${roleColor.border}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${roleColor.dot}`} />
                  <span className={`text-sm font-bold ${roleColor.text}`}>{ROLE_LABELS[userRole] || 'User'}</span>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accessible Pages ({userPages.length})</p>
                <div className="flex flex-wrap gap-1">
                  {userPages.map((page) => (
                    <span key={page} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">
                      <CheckCircle2 size={8} className="text-emerald-500" />{page}
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div className="space-y-5 max-w-2xl">
          <SectionCard>
            <SectionHeader icon={Lock} title="Change Password" subtitle="Update your account password" iconBg="bg-red-100 dark:bg-red-500/20" iconColor="text-red-600 dark:text-red-400" />
            <div className="p-6">
              {passwordMsg.text && (
                <div className={`p-3 rounded-lg text-sm mb-4 ${passwordMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'}`}>
                  {passwordMsg.text}
                </div>
              )}
              <form onSubmit={handleUpdatePassword} className="space-y-4" autoComplete="off">
                <InputField label="Current Password">
                  <div className="relative">
                    <input type={showCurrentPass ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" placeholder="Enter current password" className={`${inputClass} pr-10`} required />
                    <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                      {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </InputField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="New Password">
                    <div className="relative">
                      <input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" className={`${inputClass} pr-10`} required />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </InputField>
                  <InputField label="Confirm Password">
                    <input type={showNewPass ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Re-enter new password" className={inputClass} required />
                  </InputField>
                </div>
                <button type="submit" disabled={passwordLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors disabled:opacity-50">
                  <KeyRound size={16} />{passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </SectionCard>

          <TwoFactorSection />
        </div>
      )}

      {/* ── PREFERENCES TAB ── */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
          <SectionCard>
            <SectionHeader icon={Globe} title="Preferences" subtitle="Currency, timezone, and language" />
            <div className="p-6 space-y-4">
              {prefsMsg.text && (
                <div className={`p-3 rounded-lg text-sm ${prefsMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'}`}>
                  {prefsMsg.text}
                </div>
              )}
              <InputField label="Default Currency">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                  {CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                </select>
              </InputField>
              <InputField label="Timezone">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
                  {TIMEZONES.map((tz) => (<option key={tz.code} value={tz.code}>{tz.label}</option>))}
                </select>
              </InputField>
              <InputField label="Language">
                <select value={typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en'}
                  onChange={(e) => { localStorage.setItem('lang', e.target.value); window.location.reload() }}
                  className={inputClass}>
                  {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.flag} {l.label}</option>))}
                </select>
              </InputField>
              <button onClick={handleSavePreferences} disabled={prefsLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors disabled:opacity-50">
                <Save size={16} />{prefsLoading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </SectionCard>

          <InstallAppSection />
        </div>
      )}
    </div>
  )
}
