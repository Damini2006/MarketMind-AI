import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Boxes, Users, FileText, TrendingUp, Settings, LayoutDashboard } from 'lucide-react'

const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Navigation' },
  { label: 'Sales', path: '/sales', icon: ShoppingCart, category: 'Operations' },
  { label: 'Inventory', path: '/inventory', icon: Boxes, category: 'Operations' },
  { label: 'Invoices', path: '/invoices', icon: FileText, category: 'Operations' },
  { label: 'Customers', path: '/customers', icon: Users, category: 'Operations' },
  { label: 'Categories', path: '/categories', icon: Boxes, category: 'Management', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Suppliers', path: '/suppliers', icon: Boxes, category: 'Management', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Forecasting', path: '/forecasting', icon: TrendingUp, category: 'AI Reports', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Segmentation', path: '/segmentation', icon: Users, category: 'AI Reports' },
  { label: 'Churn Risk', path: '/churn', icon: Users, category: 'AI Reports', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Recommendations', path: '/recommendations', icon: TrendingUp, category: 'AI Reports' },
  { label: 'Anomaly Alerts', path: '/anomalies', icon: TrendingUp, category: 'AI Reports', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Activity Log', path: '/activity', icon: LayoutDashboard, category: 'Management', roles: ['business_owner', 'store_manager', 'admin'] },
  { label: 'Settings', path: '/settings', icon: Settings, category: 'Account' },
]

export default function GlobalSearch({ userRole }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const filtered = PAGES
    .filter((p) => !p.roles || p.roles.includes(userRole))
    .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => {
          if (!prev) {
            // Opening — reset state
            setQuery('')
            setSelectedIdx(0)
            setTimeout(() => inputRef.current?.focus(), 50)
          }
          return !prev
        })
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])


  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      navigate(filtered[selectedIdx].path)
      setOpen(false)
    }
  }

  if (!open) return null

  // Group by category
  const grouped = {}
  filtered.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  })

  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No pages found</p>
          ) : (
            Object.entries(grouped).map(([category, pages]) => (
              <div key={category} className="mb-1">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {category}
                </p>
                {pages.map((p) => {
                  const Icon = p.icon
                  const idx = globalIdx++
                  const isSelected = idx === selectedIdx
                  return (
                    <button
                      key={p.path}
                      onClick={() => { navigate(p.path); setOpen(false) }}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="font-medium">{p.label}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
