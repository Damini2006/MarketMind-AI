import { useState, useEffect } from 'react'
import api from '../services/api'

export default function SplashScreen({ children }) {
  const [ready, setReady] = useState(false)
  const [warming, setWarming] = useState(true)

  useEffect(() => {
    // Quick health check — if backend is cold, this wakes it up
    const start = Date.now()
    api.get('/health', { timeout: 30000 })
      .then(() => {
        setReady(true)
        setWarming(false)
      })
      .catch(() => {
        // Backend might still be waking up — wait and retry once
        setTimeout(() => {
          api.get('/health', { timeout: 30000 })
            .then(() => { setReady(true); setWarming(false) })
            .catch(() => { setReady(true); setWarming(false) })
        }, 3000)
      })
  }, [])

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-3xl font-bold text-white">M</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MarketMind AI</h1>
          <p className="text-indigo-200 text-sm mb-8">Warming up the server...</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-indigo-300 text-xs mt-6">First load takes ~10 seconds (Neon cold start)</p>
        </div>
      </div>
    )
  }

  return children
}
