import React from 'react'
import { Loader2 } from 'lucide-react'

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className="card flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-lg ${toneClasses[tone]}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  return <span className={`badge ${toneClasses[tone]}`}>{children}</span>
}

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-500 py-16">
      <Loader2 className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ message }) {
  return <div className="text-center text-slate-400 py-16 text-sm">{message}</div>
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
      {message}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
