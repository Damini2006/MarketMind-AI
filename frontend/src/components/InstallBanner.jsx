import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Detect platform
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent)
  const isEdge = /Edg/i.test(navigator.userAgent)

  useEffect(() => {
    if (sessionStorage.getItem('install_banner_dismissed')) {
      setDismissed(true)
      return
    }
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShow(false)
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      setDeferredPrompt(null)
    } else {
      setShowGuide(true)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
    sessionStorage.setItem('install_banner_dismissed', '1')
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Main Banner */}
        <div className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">MM</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Install MarketMind AI</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add to home screen for quick access</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleInstall}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
              <Download size={14} /> Install
            </button>
            <button onClick={handleDismiss}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Expandable Guide */}
        {showGuide && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3">
              {deferredPrompt ? 'Click Install above, then:' : 'Follow these steps:'}
            </p>

            {isAndroid && (
              <ol className="space-y-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                  <span>Tap the <strong>⋮</strong> (three dots) menu at top-right</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                  <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
                </li>
              </ol>
            )}

            {isIOS && (
              <ol className="space-y-2 text-[11px] text-amber-600 dark:text-amber-400">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                  <span>Tap the <strong>Share button</strong> (⬆️) at the bottom</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                  <span>Tap <strong>"Add to Home Screen"</strong></span>
                </li>
              </ol>
            )}

            {!isMobile && (
              <ol className="space-y-2 text-[11px] text-indigo-600 dark:text-indigo-400">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                  <span>Click the <strong>install icon</strong> (🖥️) in the address bar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                  <span>Click <strong>"Install"</strong> in the popup</span>
                </li>
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
