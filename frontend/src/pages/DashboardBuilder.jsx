import { useState, useCallback, useMemo, useEffect } from 'react'
import api from '../services/api'
import { Loading, PageHeader } from '../components/ui.jsx'
import {
  Plus, Save, RotateCcw, Settings, Move,
  LayoutTemplate, Download, Eye, EyeOff, Search,
} from 'lucide-react'
import { exportToPDF, exportToExcel } from '../utils/exportUtils'
import {
  WIDGET_REGISTRY, WIDGET_COLORS, LAYOUT_TEMPLATES, DEFAULT_LAYOUT,
  useDashboardData, CustomDashboardGrid, fetchActiveLayout,
} from '../components/dashboards/customDashboard.jsx'

const API_BASE = '/user-data'

// ─── Main Page ────────────────────────────────────────────────────────
export default function DashboardBuilder() {
  const { data, loading } = useDashboardData()
  const [layout, setLayout] = useState([])
  const [activeLayoutId, setActiveLayoutId] = useState(null)
  const [showWidgetPanel, setShowWidgetPanel] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [hiddenWidgets, setHiddenWidgets] = useState(new Set())
  const [widgetSearch, setWidgetSearch] = useState('')
  const [activeTemplate, setActiveTemplate] = useState('executive')
  const [showTemplates, setShowTemplates] = useState(false)

  // Load saved layout from Neon or use default; remember the active row id
  // so every save UPDATES that row instead of piling up duplicates.
  useEffect(() => {
    fetchActiveLayout()
      .then(active => {
        if (active) {
          setActiveLayoutId(active.id)
          setLayout(active.layout)
          return
        }
        setLayout(DEFAULT_LAYOUT.map(w => ({ ...w })))
      })
      .catch(() => setLayout(DEFAULT_LAYOUT.map(w => ({ ...w }))))
  }, [])

  const visibleLayout = useMemo(() => {
    return layout.filter(item => !hiddenWidgets.has(item.i))
  }, [layout, hiddenWidgets])

  const onLayoutChange = useCallback((newLayout) => {
    if (!editMode) return
    setLayout(prev => {
      const merged = newLayout.map(nl => {
        const old = prev.find(p => p.i === nl.i)
        return { ...old, ...nl }
      })
      // Keep items in prev that aren't in newLayout (hidden widgets)
      const newIds = new Set(newLayout.map(n => n.i))
      const kept = prev.filter(p => !newIds.has(p.i))
      return [...merged, ...kept]
    })
  }, [editMode])

  const addWidget = useCallback((widgetId) => {
    const widget = WIDGET_REGISTRY[widgetId]
    if (!widget) return
    // Check if already on layout
    if (layout.find(l => l.i === widgetId)) return
    const y = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0
    setLayout(prev => [...prev, { i: widgetId, x: 0, y, w: widget.defaultW, h: widget.defaultH }])
    setHiddenWidgets(prev => { const next = new Set(prev); next.delete(widgetId); return next })
  }, [layout])

  const removeWidget = useCallback((widgetId) => {
    setLayout(prev => prev.filter(l => l.i !== widgetId))
  }, [])

  const toggleWidget = useCallback((widgetId) => {
    setHiddenWidgets(prev => {
      const next = new Set(prev)
      if (next.has(widgetId)) next.delete(widgetId)
      else next.add(widgetId)
      return next
    })
  }, [])

  // Persist the layout: PUT the existing active row when we know its id,
  // POST once (and remember the new id) when we don't. Every save lands on
  // the SAME row, so the main Dashboard always reads the latest arrangement.
  const persistLayout = useCallback((layoutJson, name) => {
    const body = { name, layout_json: JSON.stringify(layoutJson), is_active: true }
    const req = activeLayoutId
      ? api.put(`${API_BASE}/dashboard-layouts/${activeLayoutId}`, body)
      : api.post(`${API_BASE}/dashboard-layouts`, body).then(res => {
          setActiveLayoutId(res.data?.id || null)
          return res
        })
    req.catch(() => {})
    return req
  }, [activeLayoutId])

  const applyTemplate = useCallback((templateKey) => {
    const tmpl = LAYOUT_TEMPLATES[templateKey]
    if (!tmpl) return
    setLayout(tmpl.layout.map(w => ({ ...w })))
    setHiddenWidgets(new Set())
    setActiveTemplate(templateKey)
    setShowTemplates(false)
    persistLayout(tmpl.layout, templateKey)
  }, [persistLayout])

  const resetLayout = useCallback(() => {
    const tmpl = LAYOUT_TEMPLATES[activeTemplate] || LAYOUT_TEMPLATES.executive
    setLayout(tmpl.layout.map(w => ({ ...w })))
    setHiddenWidgets(new Set())
    persistLayout(tmpl.layout, activeTemplate)
  }, [activeTemplate, persistLayout])

  const saveLayout = useCallback(() => {
    persistLayout(layout, 'custom')
  }, [layout, persistLayout])

  // Export
  const handleExportPDF = () => {
    const headers = ['Widget', 'Type']
    const rows = layout.map(l => [WIDGET_REGISTRY[l.i]?.name || l.i, WIDGET_REGISTRY[l.i]?.category || ''])
    exportToPDF({ title: 'Dashboard Layout', subtitle: 'Widget Configuration', headers, rows, filename: 'dashboard-layout' })
  }
  const handleExportExcel = () => {
    const headers = ['Widget', 'Type']
    const rows = layout.map(l => [WIDGET_REGISTRY[l.i]?.name || l.i, WIDGET_REGISTRY[l.i]?.category || ''])
    exportToExcel({ title: 'Dashboard Layout', headers, rows, filename: 'dashboard-layout' })
  }

  // Widget library filtered
  const filteredWidgets = useMemo(() => {
    const search = widgetSearch.toLowerCase()
    return Object.entries(WIDGET_REGISTRY).filter(([, w]) => {
      if (search && !w.name.toLowerCase().includes(search) && !w.category.toLowerCase().includes(search)) return false
      return true
    })
  }, [widgetSearch])

  const widgetCategories = useMemo(() => {
    const cats = {}
    filteredWidgets.forEach(([id, w]) => {
      if (!cats[w.category]) cats[w.category] = []
      cats[w.category].push({ id, ...w })
    })
    return cats
  }, [filteredWidgets])

  if (loading) return <Loading label="Loading dashboard data..." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Builder"
        subtitle={`${layout.length} widgets · Arrangement here is what your main Dashboard shows · ${editMode ? 'Drag to rearrange, resize to customize' : 'Click Edit Layout to customize'}`}
        action={
          <div className="flex items-center gap-2">
            {/* Templates */}
            <div className="relative">
              <button onClick={() => setShowTemplates(v => !v)} className="btn-secondary flex items-center gap-1.5 text-xs">
                <LayoutTemplate size={14} /> Templates
              </button>
              {showTemplates && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Layout Templates</p>
                  {Object.entries(LAYOUT_TEMPLATES).map(([key, tmpl]) => (
                    <button key={key} onClick={() => applyTemplate(key)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${activeTemplate === key ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tmpl.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{tmpl.description} · {tmpl.layout.length} widgets</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setEditMode(v => !v); if (editMode) saveLayout() }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${editMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'btn-primary'}`}>
              {editMode ? <><Save size={14} /> Save Layout</> : <><Settings size={14} /> Edit Layout</>}
            </button>

            {editMode && (
              <>
                <button onClick={resetLayout} className="btn-secondary flex items-center gap-1.5 text-xs text-orange-600">
                  <RotateCcw size={14} /> Reset
                </button>
                <button onClick={() => setShowWidgetPanel(v => !v)} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Plus size={14} /> Add Widget
                </button>
              </>
            )}

            <div className="relative group">
              <button className="btn-secondary flex items-center gap-1.5 text-xs"><Download size={14} /> Export</button>
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800">Export PDF</button>
                <button onClick={handleExportExcel} className="w-full text-left px-3 py-2 text-xs text-green-600 hover:bg-slate-50 dark:hover:bg-slate-800">Export Excel</button>
              </div>
            </div>
          </div>
        }
      />

      {/* Widget Library Panel */}
      {showWidgetPanel && editMode && (
        <div className="card border-2 border-dashed border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Widget Library</h3>
            <button onClick={() => setShowWidgetPanel(false)} className="text-slate-400 hover:text-slate-600"><EyeOff size={16} /></button>
          </div>
          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={widgetSearch} onChange={e => setWidgetSearch(e.target.value)} placeholder="Search widgets..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white" />
          </div>
          {/* Categories */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {Object.entries(widgetCategories).map(([cat, widgets]) => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {widgets.map(w => {
                    const Icon = w.icon
                    const alreadyAdded = layout.find(l => l.i === w.id)
                    return (
                      <button key={w.id} onClick={() => addWidget(w.id)} disabled={alreadyAdded}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${alreadyAdded ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'}`}>
                        <Icon size={12} className={WIDGET_COLORS[w.color]?.text || ''} />
                        {w.name}
                        {alreadyAdded && <span className="text-[9px] text-slate-400">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className={`relative ${editMode ? 'ring-2 ring-indigo-400/30 ring-offset-2 dark:ring-offset-slate-950 rounded-xl' : ''}`}>
        {editMode && (
          <div className="absolute top-2 left-4 z-10 flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
            <Move size={10} className="text-indigo-500" />
            <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400">Drag to rearrange · Resize from corners</span>
          </div>
        )}

        {visibleLayout.length > 0 ? (
          <CustomDashboardGrid
            layout={visibleLayout}
            data={data}
            editMode={editMode}
            onLayoutChange={onLayoutChange}
            onToggleHide={toggleWidget}
            onRemove={removeWidget}
          />
        ) : (
          <div className="card text-center py-16">
            <LayoutTemplate size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No widgets on dashboard</p>
            <p className="text-xs text-slate-400 mt-1">Click "Edit Layout" then "Add Widget" to get started</p>
          </div>
        )}
      </div>

      {/* Hidden Widgets */}
      {hiddenWidgets.size > 0 && editMode && (
        <div className="card">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hidden Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(hiddenWidgets).map(id => {
              const widget = WIDGET_REGISTRY[id]
              if (!widget) return null
              return (
                <button key={id} onClick={() => toggleWidget(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] transition-colors">
                  <Eye size={12} /> {widget.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
