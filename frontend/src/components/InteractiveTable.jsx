import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, Eye } from 'lucide-react'

/**
 * Reusable searchable, clickable table wrapper.
 * Usage:
 *   <InteractiveTable
 *     data={items}
 *     columns={[{ key: 'name', label: 'Name', render: (v, row) => ... }]}
 *     searchableKeys={['name', 'email']}
 *     onRowClick={(row) => setSelected(row)}
 *     emptyMessage="No items found."
 *   />
 */
export default function InteractiveTable({ data = [], columns = [], searchableKeys = [], onRowClick, emptyMessage = 'No items found.', title }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const filtered = useMemo(() => {
    let list = [...data]
    if (search && searchableKeys.length) {
      const q = search.toLowerCase()
      list = list.filter(row => searchableKeys.some(k => String(row[k] || '').toLowerCase().includes(q)))
    }
    if (sortKey) {
      list.sort((a, b) => {
        const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [data, search, searchableKeys, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div>
      {searchableKeys.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          {search && <span className="text-[11px] text-slate-400">{filtered.length} results</span>}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:text-slate-400 dark:border-slate-700">
                {columns.map(col => (
                  <th key={col.key} className={`py-2.5 pr-4 ${col.align === 'right' ? 'text-right' : ''} ${col.width || ''}`}>
                    {col.sortable !== false ? (
                      <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        {col.label}
                        {sortKey === col.key && <ChevronDown size={12} className={`transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />}
                      </button>
                    ) : col.label}
                  </th>
                ))}
                {onRowClick && <th className="py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.id || i}
                  className={`border-b border-slate-100 dark:border-slate-700/60 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`py-2.5 pr-4 ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className="py-2.5">
                      <Eye size={14} className="text-slate-300 dark:text-slate-600" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Reusable detail modal for row clicks.
 */
export function DetailModal({ title, subtitle, onClose, children }) {
  if (!title) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

DetailModal.Row = function DetailRow({ label, value, icon: Icon, tone }) {
  const toneColors = { green: 'text-emerald-600 dark:text-emerald-400', red: 'text-red-600 dark:text-red-400', amber: 'text-amber-600 dark:text-amber-400', blue: 'text-blue-600 dark:text-blue-400' }
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        {Icon && <Icon size={14} className={toneColors[tone] || 'text-slate-400'} />}
        {label}
      </div>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value ?? '—'}</span>
    </div>
  )
}

DetailModal.Section = function DetailSection({ title, children }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
