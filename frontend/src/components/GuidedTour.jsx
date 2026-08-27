import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, RotateCcw } from 'lucide-react'
import api from '../services/api'

const TOUR_KEY = 'marketmind_tour_completed'

// ── Role-Specific Tour Steps ──
const STEPS_BY_ROLE = {
  business_owner: [
    { target: null, title: 'Welcome to MarketMind AI!', content: 'This guided tour will walk you through the key features of your dashboard. You can skip at any time or replay later from Settings.', icon: Sparkles, color: '#6366f1', position: 'center' },
    { target: '[data-tour="business-pulse"]', title: 'Business Pulse', content: 'Your business health score out of 100. It combines revenue trend (40%), inventory health (30%), and invoice collection (30%) into a single actionable metric.', icon: Sparkles, color: '#f59e0b', position: 'bottom' },
    { target: '[data-tour="kpi-cards"]', title: 'Key Performance Indicators', content: 'Quick-glance metrics: Total Revenue, Total Sales, Customers, Products, Low Stock Items, and Overdue Invoices. Each card is clickable.', icon: Sparkles, color: '#22c55e', position: 'bottom' },
    { target: '[data-tour="revenue-chart"]', title: 'Revenue Trend Chart', content: 'Interactive line chart showing daily revenue. Toggle between 7-day, 14-day, and 30-day views.', icon: Sparkles, color: '#3b82f6', position: 'top' },
    { target: '[data-tour="sidebar"]', title: 'Sidebar Navigation', content: 'Access all 17+ pages from the sidebar. As Business Owner, you have full access to every feature.', icon: Sparkles, color: '#8b5cf6', position: 'right' },
    { target: '[data-tour="notifications"]', title: 'Notification Bell', content: 'Real-time alerts for low stock items, overdue invoices, and anomaly detections. Click any notification to navigate directly.', icon: Sparkles, color: '#ef4444', position: 'bottom' },
    { target: '[data-tour="chatbot"]', title: 'AI Assistant', content: 'Ask natural language questions about your business data. Uses RAG knowledge base for instant responses. Supports voice input.', icon: Sparkles, color: '#6366f1', position: 'left' },
    { target: '[data-tour="settings"]', title: 'Settings & Profile', content: 'Manage your account, update your profile, change theme, and replay this tour anytime.', icon: Sparkles, color: '#06b6d4', position: 'right' },
  ],
  store_manager: [
    { target: null, title: 'Welcome, Store Manager!', content: 'You manage daily operations. This tour highlights the tools most relevant to your role.', icon: Sparkles, color: '#3b82f6', position: 'center' },
    { target: '[data-tour="kpi-cards"]', title: 'Key Metrics', content: 'Track revenue, sales, stock alerts, and invoices. Click any card for details.', icon: Sparkles, color: '#22c55e', position: 'bottom' },
    { target: '[data-tour="revenue-chart"]', title: 'Revenue Trend', content: 'The revenue trend chart shows your daily sales performance. Watch for dips that need attention.', icon: Sparkles, color: '#3b82f6', position: 'top' },
    { target: '[data-tour="sidebar"]', title: 'Navigation', content: 'You have access to 15 pages including Sales, Inventory, Invoices, and Categories. Team and Datasets are restricted to owners.', icon: Sparkles, color: '#8b5cf6', position: 'right' },
    { target: '[data-tour="chatbot"]', title: 'AI Assistant', content: 'Quickly check stock levels, invoice status, or sales data by asking the AI chatbot.', icon: Sparkles, color: '#6366f1', position: 'left' },
  ],
  sales_executive: [
    { target: null, title: 'Welcome, Sales Executive!', content: 'Your dashboard is focused on sales performance. This tour shows you what matters most.', icon: Sparkles, color: '#22c55e', position: 'center' },
    { target: '[data-tour="sales-target"]', title: 'Sales Target', content: 'Track your monthly sales target progress. The green bar shows how close you are to your goal.', icon: Sparkles, color: '#22c55e', position: 'bottom' },
    { target: '[data-tour="kpi-cards"]', title: 'Your Metrics', content: 'Revenue, total sales, average sale value, and customers. Focus on growing these numbers.', icon: Sparkles, color: '#f59e0b', position: 'bottom' },
    { target: '[data-tour="revenue-chart"]', title: 'Revenue Trend', content: 'Your 14-day revenue trend. Watch for patterns to plan your sales strategy.', icon: Sparkles, color: '#3b82f6', position: 'top' },
    { target: '[data-tour="sidebar"]', title: 'Your Pages', content: 'You have 8 focused pages: Dashboard, Sales, Inventory, Invoices, Customers, Segmentation, Recommendations, and Settings.', icon: Sparkles, color: '#8b5cf6', position: 'right' },
    { target: '[data-tour="chatbot"]', title: 'AI Sales Assistant', content: 'Ask about top customers, best-selling products, or sales trends. The AI has instant answers.', icon: Sparkles, color: '#6366f1', position: 'left' },
  ],
  admin: [
    { target: null, title: 'Welcome, Admin!', content: 'You have system-level access. This tour covers admin-specific features.', icon: Sparkles, color: '#8b5cf6', position: 'center' },
    { target: '[data-tour="kpi-cards"]', title: 'System Health Cards', content: 'Monitor total revenue, team size, products, and system alerts. These give you the full picture.', icon: Sparkles, color: '#f59e0b', position: 'bottom' },
    { target: '[data-tour="revenue-chart"]', title: 'Revenue Trend', content: '30-day revenue trend for the entire system. Spot anomalies and patterns across all stores.', icon: Sparkles, color: '#3b82f6', position: 'top' },
    { target: '[data-tour="sidebar"]', title: 'Full Access', content: 'You have access to all 17 pages including Team management, Datasets, and Activity Log.', icon: Sparkles, color: '#8b5cf6', position: 'right' },
    { target: '[data-tour="chatbot"]', title: 'AI Admin Tools', content: 'Ask the AI about system status, team activity, anomalies, or any data point.', icon: Sparkles, color: '#6366f1', position: 'left' },
  ],
}

// Hook to check first visit + backend sync
export function useTourAutoShow(role) {
  const [showTour, setShowTour] = useState(false)
  const [canReplay, setCanReplay] = useState(true)

  useEffect(() => {
    // Always show the tour on dashboard load
    const timer = setTimeout(() => setShowTour(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const closeTour = useCallback(async () => {
    setShowTour(false)
  }, [])

  return { showTour, closeTour, canReplay }
}

export function TourReplayButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-sm font-medium active:scale-95">
      <RotateCcw size={16} />
      Replay Guided Tour
    </button>
  )
}

export default function GuidedTour({ show, onClose, role }) {
  const [step, setStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const overlayRef = useRef(null)
  const tooltipRef = useRef(null)

  const STEPS = STEPS_BY_ROLE[role] || STEPS_BY_ROLE.business_owner
  const current = STEPS[step]
  const isCenter = current.position === 'center'
  const total = STEPS.length

  useEffect(() => {
    if (!show) return
    if (isCenter) { setHighlightRect(null); return }
    let retries = 0
    const maxRetries = 15
    const updatePos = () => {
      const el = document.querySelector(current.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        const pad = 8
        setHighlightRect({ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, scrollTop: rect.top - 100 })
        setTimeout(() => {
          const tEl = tooltipRef.current
          if (!tEl) return
          const tRect = tEl.getBoundingClientRect()
          let top, left
          switch (current.position) {
            case 'bottom': top = rect.bottom + pad + 12; left = rect.left + rect.width / 2 - tRect.width / 2; break
            case 'top': top = rect.top - pad - tRect.height - 12; left = rect.left + rect.width / 2 - tRect.width / 2; break
            case 'left': top = rect.top + rect.height / 2 - tRect.height / 2; left = rect.left - pad - tRect.width - 12; break
            case 'right': top = rect.top + rect.height / 2 - tRect.height / 2; left = rect.right + pad + 12; break
            default: top = rect.bottom + 12; left = rect.left
          }
          left = Math.max(12, Math.min(left, window.innerWidth - tRect.width - 12))
          top = Math.max(12, Math.min(top, window.innerHeight - tRect.height - 12))
          setTooltipPos({ top, left })
        }, 10)
      } else if (retries < maxRetries) {
        retries++
        setTimeout(updatePos, 200)
      }
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    return () => window.removeEventListener('resize', updatePos)
  }, [show, step, current, isCenter])

  useEffect(() => {
    if (highlightRect?.scrollTop != null) window.scrollTo({ top: highlightRect.scrollTop, behavior: 'smooth' })
  }, [highlightRect])

  const goNext = useCallback(() => {
    if (step < total - 1) setStep(s => s + 1)
    else onClose()
  }, [step, total, onClose])

  const goPrev = useCallback(() => { if (step > 0) setStep(s => s - 1) }, [step])
  const skip = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (!show) return
    const handler = (e) => {
      if (e.key === 'Escape') skip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [show, skip, goNext, goPrev])

  if (!show) return null
  const Icon = current.icon

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100]" style={{ animation: 'tourFadeIn 0.3s ease-out' }}>
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourTooltipIn { from { opacity: 0; transform: scale(0.95) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>

      <div className="absolute inset-0 bg-black/50" onClick={skip}>
        {highlightRect && (
          <div className="absolute rounded-xl transition-all duration-500 ease-out"
            style={{ top: highlightRect.top, left: highlightRect.left, width: highlightRect.width, height: highlightRect.height, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', border: `2px solid ${current.color}` }} />
        )}
      </div>

      {isCenter ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div ref={tooltipRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 max-w-sm pointer-events-auto" style={{ animation: 'tourTooltipIn 0.3s ease-out' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: current.color + '15' }}>
                <Icon size={20} style={{ color: current.color }} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{current.title}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">{current.content}</p>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-5' : 'w-1.5'}`}
                    style={{ backgroundColor: i === step ? current.color : i < step ? current.color + '60' : '#e2e8f0' }} />
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{step + 1} / {total}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={skip} className="flex-1 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Skip Tour</button>
              <button onClick={goNext} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all duration-200 active:scale-95" style={{ backgroundColor: current.color }}>
                {step === total - 1 ? 'Get Started' : 'Next'}<ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div ref={tooltipRef} className="absolute bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 w-[320px] pointer-events-auto"
          style={{ ...tooltipPos, animation: 'tourTooltipIn 0.3s ease-out' }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: current.color + '15' }}>
              <Icon size={16} style={{ color: current.color }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{current.title}</h3>
          </div>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{current.content}</p>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-5' : 'w-1.5'}`}
                  style={{ backgroundColor: i === step ? current.color : i < step ? current.color + '60' : '#e2e8f0' }} />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{step + 1} / {total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button onClick={goPrev} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronLeft size={14} />
              </button>
            )}
            <button onClick={skip} className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Skip</button>
            <button onClick={goNext} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white rounded-lg transition-all duration-200 active:scale-95" style={{ backgroundColor: current.color }}>
              {step === total - 1 ? 'Finish' : 'Next'}<ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
