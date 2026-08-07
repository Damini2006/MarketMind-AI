import {} from 'react'
import { Loader2 } from 'lucide-react'

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  }
  return (
    <div className="card flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-lg ${toneClasses[tone]}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const toneClasses = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    green: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
    blue: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
    purple: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  }
  return <span className={`badge ${toneClasses[tone] || toneClasses.slate}`}>{children}</span>
}

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 py-16">
      <Loader2 className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ message }) {
  return <div className="text-center text-slate-400 dark:text-slate-500 py-16 text-sm">{message}</div>
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 text-sm mb-4">
      {message}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}