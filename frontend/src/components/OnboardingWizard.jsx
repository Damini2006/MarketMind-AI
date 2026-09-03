import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import {
  Building2, Globe, Database, CheckCircle2, Sparkles, Zap,
  ChevronRight, ChevronLeft, X, Store, ShoppingCart, Users,
  Upload, FileSpreadsheet, ArrowRight, PartyPopper, Star,
  BarChart3, Bell, Settings, LayoutDashboard, IndianRupee,
} from 'lucide-react'

const STORAGE_KEY = 'marketmind_onboarding_complete'
const SETUP_KEY = 'marketmind_setup_data'

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Retail Store', icon: Store, desc: 'Physical or online retail shop' },
  { id: 'restaurant', label: 'Restaurant / Cafe', icon: ShoppingCart, desc: 'Food & beverage business' },
  { id: 'services', label: 'Services', icon: Users, desc: 'Consulting, repairs, salon, etc.' },
  { id: 'wholesale', label: 'Wholesale / Distribution', icon: Database, desc: 'Bulk selling to other businesses' },
]

const CURRENCIES = [
  { id: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { id: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { id: 'EUR', symbol: '€', label: 'Euro (€)' },
  { id: 'GBP', symbol: '£', label: 'British Pound (£)' },
]

const QUICK_ACTIONS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, color: 'indigo' },
  { id: 'import', label: 'Import Data', icon: Upload, color: 'emerald' },
  { id: 'settings', label: 'Customize Settings', icon: Settings, color: 'purple' },
  { id: 'tour', label: 'Take a Tour', icon: Sparkles, color: 'amber' },
]

// ─── Step Components ──────────────────────────────────────────────────

function WelcomeStep({ onNext, user }) {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6">
        <img src="/logo.svg" alt="MarketMind AI" className="w-full h-full" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
        {t('onboarding.welcome', { name: user?.name || 'there' })}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
        {t('onboarding.welcomeDesc')}
      </p>
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-sm mx-auto">
        {[
          { icon: BarChart3, label: t('onboarding.analytics'), color: 'text-indigo-500' },
          { icon: Bell, label: t('onboarding.alerts'), color: 'text-amber-500' },
          { icon: Star, label: t('onboarding.aiInsights'), color: 'text-emerald-500' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Icon size={20} className={`${color} mx-auto mb-1.5`} />
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary px-8 py-3 text-sm flex items-center gap-2 mx-auto">
        {t('onboarding.getStarted')} <ChevronRight size={16} />
      </button>
    </div>
  )
}

function BusinessStep({ data, onChange }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('onboarding.businessSetup')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('onboarding.businessSetupDesc')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">{t('onboarding.businessName')}</label>
          <input
            type="text"
            value={data.businessName}
            onChange={e => onChange({ ...data, businessName: e.target.value })}
            placeholder={t('onboarding.businessNamePlaceholder')}
            className="input text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('onboarding.businessType')}</label>
          <div className="grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map(bt => {
              const Icon = bt.icon
              return (
                <button key={bt.id} onClick={() => onChange({ ...data, businessType: bt.id })}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${data.businessType === bt.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                  <Icon size={16} className={data.businessType === bt.id ? 'text-indigo-500' : 'text-slate-400'} />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{bt.label}</p>
                    <p className="text-[9px] text-slate-400">{bt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">{t('onboarding.currency')}</label>
          <div className="flex gap-2">
            {CURRENCIES.map(c => (
              <button key={c.id} onClick={() => onChange({ ...data, currency: c.id })}
                className={`flex-1 py-2.5 rounded-xl border-2 text-center text-xs font-bold transition-all ${data.currency === c.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                {c.symbol} {c.id}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">{t('onboarding.storeSize')}</label>
          <div className="flex gap-2">
            {['1-5', '6-20', '21-50', '50+'].map(size => (
              <button key={size} onClick={() => onChange({ ...data, storeSize: size })}
                className={`flex-1 py-2 rounded-xl border-2 text-center text-xs font-bold transition-all ${data.storeSize === size
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PreferencesStep({ data, onChange }) {
  const { t, i18n } = useTranslation()

  const languages = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { id: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { id: 'te', label: 'తెలుగు', flag: '🇮🇳' },
    { id: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  ]

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4">
          <Globe size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('onboarding.preferences')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('onboarding.preferencesDesc')}</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('onboarding.language')}</label>
          <div className="grid grid-cols-2 gap-2">
            {languages.map(lang => (
              <button key={lang.id} onClick={() => { onChange({ ...data, language: lang.id }); i18n.changeLanguage(lang.id) }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${data.language === lang.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                <span className="text-lg">{lang.flag}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">{t('onboarding.timezone')}</label>
          <select
            value={data.timezone}
            onChange={e => onChange({ ...data, timezone: e.target.value })}
            className="input text-sm"
          >
            <option value="Asia/Kolkata">IST (UTC+5:30) — India</option>
            <option value="America/New_York">EST (UTC-5) — New York</option>
            <option value="Europe/London">GMT (UTC+0) — London</option>
            <option value="Asia/Dubai">GST (UTC+4) — Dubai</option>
            <option value="Asia/Singapore">SGT (UTC+8) — Singapore</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-3">{t('onboarding.features')}</label>
          {[
            { key: 'enableAlerts', icon: Bell, label: t('onboarding.liveAlerts') },
            { key: 'enableAI', icon: Sparkles, label: t('onboarding.aiAssistant') },
            { key: 'enableExport', icon: FileSpreadsheet, label: t('onboarding.pdfExcelExport') },
          ].map(({ key, icon: Icon, label }) => (
            <label key={key} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-2.5">
                <Icon size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
              </div>
              <div className={`w-9 h-5 rounded-full cursor-pointer transition-colors relative ${data[key] ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                onClick={() => onChange({ ...data, [key]: !data[key] })}>
                <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${data[key] ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function ImportStep({ data, onChange }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
          <Database size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('onboarding.importData')}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('onboarding.importDataDesc')}</p>
      </div>

      <div className="space-y-3">
        <button onClick={() => onChange({ ...data, importOption: 'sample' })}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.importOption === 'sample'
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Sparkles size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('onboarding.loadSample')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('onboarding.loadSampleDesc')}</p>
          </div>
          {data.importOption === 'sample' && <CheckCircle2 size={16} className="text-indigo-500" />}
        </button>

        <button onClick={() => onChange({ ...data, importOption: 'csv' })}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.importOption === 'csv'
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Upload size={18} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('onboarding.importCSV')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('onboarding.importCSVDesc')}</p>
          </div>
          {data.importOption === 'csv' && <CheckCircle2 size={16} className="text-indigo-500" />}
        </button>

        <button onClick={() => onChange({ ...data, importOption: 'empty' })}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.importOption === 'empty'
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Database size={18} className="text-slate-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('onboarding.startEmpty')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('onboarding.startEmptyDesc')}</p>
          </div>
          {data.importOption === 'empty' && <CheckCircle2 size={16} className="text-indigo-500" />}
        </button>
      </div>
    </div>
  )
}

function CompletionStep({ data, onFinish }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleAction = (actionId) => {
    onFinish()
    switch (actionId) {
      case 'dashboard': navigate('/dashboard'); break
      case 'import': navigate('/datasets'); break
      case 'settings': navigate('/settings'); break
      case 'tour': localStorage.removeItem('marketmind_tour_seen'); window.location.reload(); break
    }
  }

  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 animate-bounce">
        <PartyPopper size={36} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('onboarding.allSet')}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
        {t('onboarding.allSetDesc')}
      </p>

      {/* Setup Summary */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 max-w-sm mx-auto text-left">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">{t('onboarding.setupSummary')}</p>
        <div className="space-y-2">
          {[
            { label: t('onboarding.businessName'), value: data.businessName || t('onboarding.notSet') },
            { label: t('onboarding.type'), value: BUSINESS_TYPES.find(b => b.id === data.businessType)?.label || t('onboarding.notSet') },
            { label: t('onboarding.language'), value: CURRENCIES.find(c => c.id === data.currency)?.label || 'Indian Rupee' },
            { label: t('onboarding.storeSize'), value: data.storeSize ? `${data.storeSize} employees` : t('onboarding.notSet') },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-[10px] text-slate-500">{label}</span>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
        {QUICK_ACTIONS.map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => handleAction(id)}
            className={`flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-${color}-300 hover:bg-${color}-50 dark:hover:bg-${color}-950/20 transition-all text-left`}>
            <Icon size={16} className={`text-${color}-500`} />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</span>
            <ArrowRight size={12} className="ml-auto text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Onboarding Wizard ───────────────────────────────────────────
export default function OnboardingWizard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [data, setData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETUP_KEY) || '{}')
    } catch { return {} }
  })

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  // Persist setup data
  useEffect(() => {
    if (Object.keys(data).length > 0) {
      localStorage.setItem(SETUP_KEY, JSON.stringify(data))
    }
  }, [data])

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  const STEPS = [
    { component: WelcomeStep, props: { user } },
    { component: BusinessStep, props: { data, onChange: setData } },
    { component: PreferencesStep, props: { data, onChange: setData } },
    { component: ImportStep, props: { data, onChange: setData } },
    { component: CompletionStep, props: { data, onFinish: finish } },
  ]

  const CurrentStep = STEPS[step].component
  const stepProps = STEPS[step].props
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={skip}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Close button */}
        {!isLast && (
          <button onClick={skip} className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        )}

        {/* Step content */}
        <div className="p-8">
          <CurrentStep {...stepProps} />
        </div>

        {/* Navigation footer */}
        {!isLast && (
          <div className="px-8 pb-6">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'bg-indigo-600 flex-1' : i < step ? 'bg-indigo-300 dark:bg-indigo-700 w-4' : 'bg-slate-200 dark:bg-slate-700 w-4'
                }`} />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">{step + 1} / {STEPS.length}</span>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button onClick={() => setStep(step - 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ChevronLeft size={12} /> {t('common.cancel')}
                  </button>
                )}
                <button onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                  {step === STEPS.length - 2 ? t('onboarding.finish') : t('onboarding.next')} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
