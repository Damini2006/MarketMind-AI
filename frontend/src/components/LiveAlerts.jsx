import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'

import {
  Bell, BellOff, AlertTriangle, ShoppingCart, TrendingDown,
  TrendingUp, Package, X, Check,
} from 'lucide-react'

const ALERT_TYPES = {
  low_stock: { icon: Package, color: 'amber', label: 'Low Stock' },
  out_of_stock: { icon: TrendingDown, color: 'red', label: 'Out of Stock' },
  sale_high: { icon: ShoppingCart, color: 'emerald', label: 'High Sale' },
  anomaly: { icon: AlertTriangle, color: 'red', label: 'Anomaly Detected' },
  anomaly_resolved: { icon: Check, color: 'green', label: 'Anomaly Resolved' },
  inventory_restock: { icon: Package, color: 'blue', label: 'Restock Suggestion' },
  revenue_milestone: { icon: TrendingUp, color: 'purple', label: 'Revenue Milestone' },
}

const COLOR_MAP = {
  amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  red: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
  green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
  blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  purple: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
}

const PREFS_KEY = 'marketmind-notification-prefs'

function getDefaultPrefs() {
  return {
    pushEnabled: false,
    soundEnabled: true,
    inventoryAlerts: true,
    salesAlerts: true,
    anomalyAlerts: true,
    lowStockThreshold: 10,
  }
}

// ─── Toast notification for new alerts ────────────────────────────────
function AlertToast({ alert, onDismiss }) {
  const { t } = useTranslation()
  const config = ALERT_TYPES[alert.type] || ALERT_TYPES.anomaly
  const Icon = config.icon
  const colors = COLOR_MAP[config.color] || COLOR_MAP.blue

  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border shadow-lg animate-slide-in ${colors}`}>
      <div className="shrink-0 mt-0.5">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">{config.label}</p>
        <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{alert.message}</p>
        <p className="text-[9px] opacity-60 mt-1">
          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : t('alerts.justNow')}
        </p>
      </div>
      <button onClick={onDismiss} className="shrink-0 p-0.5 hover:opacity-60 transition-opacity">
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Settings panel for notification preferences ──────────────────────
function NotificationPrefs({ prefs, onChange, onClose }) {
  const { t } = useTranslation()

  const Toggle = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div
        className={`w-9 h-5 rounded-full cursor-pointer transition-colors relative ${checked ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        onClick={onChange}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  )

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('alerts.preferences')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      <Toggle
        label={t('alerts.pushNotifications')}
        checked={prefs.pushEnabled}
        onChange={() => {
          if (!prefs.pushEnabled && 'Notification' in window) {
            Notification.requestPermission().then(perm => {
              onChange({ ...prefs, pushEnabled: perm === 'granted' })
            })
          } else {
            onChange({ ...prefs, pushEnabled: false })
          }
        }}
      />
      <Toggle
        label={t('alerts.soundEnabled')}
        checked={prefs.soundEnabled}
        onChange={() => onChange({ ...prefs, soundEnabled: !prefs.soundEnabled })}
      />
      <Toggle
        label={t('alerts.inventoryAlerts')}
        checked={prefs.inventoryAlerts}
        onChange={() => onChange({ ...prefs, inventoryAlerts: !prefs.inventoryAlerts })}
      />
      <Toggle
        label={t('alerts.salesAlerts')}
        checked={prefs.salesAlerts}
        onChange={() => onChange({ ...prefs, salesAlerts: !prefs.salesAlerts })}
      />
      <Toggle
        label={t('alerts.anomalyAlerts')}
        checked={prefs.anomalyAlerts}
        onChange={() => onChange({ ...prefs, anomalyAlerts: !prefs.anomalyAlerts })}
      />

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <label className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('alerts.lowStockThreshold')}</span>
          <input
            type="number"
            value={prefs.lowStockThreshold}
            onChange={e => onChange({ ...prefs, lowStockThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-16 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800"
          />
        </label>
      </div>
    </div>
  )
}

// ─── Main LiveAlerts hook ─────────────────────────────────────────────
export function useLiveAlerts(prefs) {
  const [toasts, setToasts] = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const toastId = useRef(0)
  const reconnectTimer = useRef(null)
  const { user } = useAuth()
  const businessId = user?.business_id || user?.id || '1'

  const pushToast = useCallback((alert) => {
    const id = ++toastId.current
    setToasts(prev => [...prev.slice(-4), { ...alert, id }])
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Send browser push notification
  const sendBrowserPush = useCallback((title, body, tag) => {
    if (!prefs.pushEnabled || !('Notification' in window) || Notification.permission !== 'granted') return
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
        requireInteraction: false,
      })
    } catch { /* notification API not available */ }
  }, [prefs.pushEnabled])

  // Play alert sound
  const playSound = useCallback(() => {
    if (!prefs.soundEnabled) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      osc.type = 'sine'
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* audio not available */ }
  }, [prefs.soundEnabled])

  // Connect to WebSocket
  useEffect(() => {
    if (!businessId) return

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.hostname
        const port = '8000' // Backend port
        const wsUrl = `${protocol}//${host}:${port}/ws/alerts/${businessId}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current)
            reconnectTimer.current = null
          }
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'connected' || data.type === 'pong') return

            // Filter based on user preferences
            if (data.type === 'low_stock' && !prefs.inventoryAlerts) return
            if (data.type === 'out_of_stock' && !prefs.inventoryAlerts) return
            if (data.type === 'sale_high' && !prefs.salesAlerts) return
            if (data.type === 'anomaly' && !prefs.anomalyAlerts) return

            pushToast(data)

            // Browser push notification
            const titles = {
              low_stock: '📦 Low Stock Alert',
              out_of_stock: '⚠️ Out of Stock',
              sale_high: '💰 High-Value Sale',
              anomaly: '🔍 Anomaly Detected',
            }
            sendBrowserPush(titles[data.type] || 'MarketMind Alert', data.message, `${data.type}_${Date.now()}`)
            playSound()
          } catch { /* parse error */ }
        }

        ws.onclose = () => {
          setConnected(false)
          // Reconnect after 3 seconds
          reconnectTimer.current = setTimeout(connectWs, 3000)
        }

        ws.onerror = () => {
          setConnected(false)
          ws.close()
        }
      } catch {
        // WebSocket not available — fallback to silence
        setConnected(false)
      }
    }

    connectWs()

    // Send periodic pings to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => {
      clearInterval(pingInterval)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // Prevent reconnect on unmount
        wsRef.current.close()
      }
    }
  }, [businessId, prefs, pushToast, sendBrowserPush, playSound])

  return { toasts, dismissToast, connected }
}

// ─── LiveAlerts Panel Component ───────────────────────────────────────
export default function LiveAlerts({ showIcon = true }) {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...getDefaultPrefs(), ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
    } catch { return getDefaultPrefs() }
  })
  const [showPrefs, setShowPrefs] = useState(false)
  const { toasts, dismissToast, connected } = useLiveAlerts(prefs)

  // Save prefs
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  // Initial browser push permission check
  useEffect(() => {
    if (prefs.pushEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [prefs.pushEnabled])

  return (
    <>
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <AlertToast key={toast.id} alert={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>

      {/* Settings button in Layout header area — rendered inline */}
      {showIcon && <div className="relative">
        <button
          onClick={() => setShowPrefs(!showPrefs)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={t('alerts.notificationSettings')}
        >
          {connected ? (
            <Bell size={18} className="text-emerald-500" />
          ) : (
            <BellOff size={18} className="text-slate-400" />
          )}
          {connected && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
        </button>
        {showPrefs && (
          <NotificationPrefs
            prefs={prefs}
            onChange={setPrefs}
            onClose={() => setShowPrefs(false)}
          />
        )}
      </div>}
    </>
  )
}
