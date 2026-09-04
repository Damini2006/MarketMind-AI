import { useState, useEffect } from 'react'
import { Download, X, Monitor, Smartphone, ChevronRight, Info, CheckCircle2 } from 'lucide-react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [installing, setInstalling] = useState(false)

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent)
  const isEdge = /Edg/i.test(navigator.userAgent)

  useEffect(() => {
    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Listen for custom event from Settings page or header
  useEffect(() => {
    const openModal = () => setShowModal(true)
    window.addEventListener('open-install-modal', openModal)
    return () => window.removeEventListener('open-install-modal', openModal)
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
          setIsInstalled(true)
          setShowModal(false)
        }
        setDeferredPrompt(null)
      } else {
        setShowModal(true)
      }
    } catch {
      setShowModal(true)
    } finally {
      setInstalling(false)
    }
  }

  if (isInstalled) return null

  return (
    <>
      {/* Install Modal — always accessible */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-indigo-600 to-violet-700">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.svg" alt="MarketMind" className="w-12 h-12 rounded-xl" />
                <div>
                  <h2 className="text-lg font-bold text-white">Install MarketMind AI</h2>
                  <p className="text-xs text-white/70">Quick access from your home screen</p>
                </div>
              </div>
              {deferredPrompt && (
                <button onClick={handleInstall} disabled={installing}
                  className="w-full py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
                  <Download size={16} />
                  {installing ? 'Installing...' : 'Install Now'}
                </button>
              )}
            </div>

            {/* Platform Instructions */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {deferredPrompt
                  ? 'Click "Install Now" above, or follow the steps below:'
                  : 'Follow these steps to install on your device:'}
              </p>

              {/* Chrome Desktop */}
              <PlatformGuide
                icon={<Monitor size={16} />}
                title="Chrome / Edge (Desktop)"
                color="indigo"
                steps={[
                  'Click the install icon (🖥️) in the address bar',
                  'Click "Install" in the popup',
                  'Or press ⋮ menu → "Install MarketMind AI"'
                ]}
              />

              {/* Android */}
              <PlatformGuide
                icon={<Smartphone size={16} />}
                title="Android (Chrome)"
                color="green"
                steps={[
                  'Tap the ⋮ (three dots) menu at top-right',
                  'Tap "Add to Home screen" or "Install app"',
                  'Tap "Install" to confirm'
                ]}
              />

              {/* iOS */}
              <PlatformGuide
                icon={<Smartphone size={16} />}
                title="iPhone / iPad (Safari)"
                color="amber"
                steps={[
                  'Tap the Share button (⬆️) at the bottom',
                  'Scroll down and tap "Add to Home Screen"',
                  'Tap "Add" to confirm'
                ]}
              />

              {/* Benefits */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Benefits</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Instant launch', 'Offline access', 'Push notifications', 'App-like UI'].map((b) => (
                    <div key={b} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlatformGuide({ icon, title, color, steps }) {
  const colors = {
    indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    green: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  }
  const dotColors = {
    indigo: 'bg-indigo-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
  }
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${colors[color]} flex items-center justify-center`}>{icon}</div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`w-4 h-4 rounded-full ${dotColors[color]} text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5`}>{i + 1}</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
