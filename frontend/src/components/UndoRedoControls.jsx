import { useState } from 'react'
import { useUndoRedo } from '../context/UndoRedoContext'
import { Undo2, Redo2, History, X, Clock, ShoppingCart, Boxes, FileText, Users, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_ICONS = {
  Sales: ShoppingCart,
  Inventory: Boxes,
  Invoices: FileText,
  Customers: Users,
}

const CATEGORY_COLORS = {
  Sales: 'text-indigo-500',
  Inventory: 'text-amber-500',
  Invoices: 'text-blue-500',
  Customers: 'text-purple-500',
}

export default function UndoRedoControls() {
  const { history, future, canUndo, canRedo, undo, redo, clearHistory, isUndoing } = useUndoRedo()
  const [showHistory, setShowHistory] = useState(false)

  const handleUndo = async () => {
    const result = await undo()
    if (result.success) {
      toast.success(result.message, { icon: '↩️', duration: 3000 })
    } else {
      toast.error(result.message)
    }
  }

  const handleRedo = async () => {
    const result = await redo()
    if (result.success) {
      toast.success(result.message, { icon: '↪️', duration: 3000 })
    } else {
      toast.error(result.message)
    }
  }

  return (
    <>
      {/* Floating Controls */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        {/* History toggle */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="relative w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          title="Action History"
        >
          <History size={16} className="text-slate-600 dark:text-slate-300" />
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {history.length}
            </span>
          )}
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className={`w-10 h-10 rounded-full border shadow-lg flex items-center justify-center transition-all ${
            canUndo
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title={canUndo ? `Undo: ${history[0]?.label}` : 'Nothing to undo'}
        >
          <Undo2 size={16} className={isUndoing ? 'animate-spin' : ''} />
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className={`w-10 h-10 rounded-full border shadow-lg flex items-center justify-center transition-all ${
            canRedo
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title={canRedo ? `Redo: ${future[0]?.label}` : 'Nothing to redo'}
        >
          <Redo2 size={16} className={isUndoing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="fixed bottom-20 right-6 z-40 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History size={14} className="text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Action History</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded font-medium">
                {history.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button onClick={clearHistory} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400" title="Clear history">
                  <Trash2 size={12} />
                </button>
              )}
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X size={14} className="text-slate-400" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-8 text-center">
                <Clock size={20} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400">No actions yet</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Actions appear here as you work</p>
              </div>
            ) : (
              history.map((action, i) => {
                const Icon = CATEGORY_ICONS[action.category] || Clock
                const colorClass = CATEGORY_COLORS[action.category] || 'text-slate-500'
                return (
                  <div key={action.id} className={`flex items-start gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/50 ${i === 0 ? 'bg-indigo-50/50 dark:bg-indigo-950/10' : ''}`}>
                    <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{action.label}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {action.category} · {new Date(action.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {i === 0 && (
                      <span className="text-[8px] px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded font-bold shrink-0">LATEST</span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {future.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[9px] text-slate-400">{future.length} action{future.length > 1 ? 's' : ''} available to redo</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
