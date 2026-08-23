import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Reusable detail modal.
 * Usage: <DetailModal open={show} onClose={close} title="..." size="md">
 *   <DetailModal.Row label="Name" value={item.name} />
 *   <DetailModal.Row label="Email" value={item.email} />
 *   <DetailModal.Section title="Purchase History">...</DetailModal.Section>
 * </DetailModal>
 */
export default function DetailModal({ open, onClose, title, subtitle, size = 'md', children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-xl'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${sizeClass} max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

/* Sub-components for structured detail display */

DetailModal.Row = function Row({ label, value, icon: Icon, tone }) {
  const toneColors = {
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <span className={`text-sm font-semibold ${tone ? toneColors[tone] : 'text-slate-800 dark:text-slate-100'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

DetailModal.Section = function Section({ title, children }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{title}</h4>
      <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
        {children}
      </div>
    </div>
  )
}

DetailModal.Badge = function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    green: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
