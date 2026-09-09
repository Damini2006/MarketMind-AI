import { useState, useEffect, useRef } from 'react'

/**
 * useCountUp: Animates a number from 0 to target over duration ms.
 * Returns the current displayed value.
 */
function useCountUp(target, { duration = 1200, delay = 0 } = {}) {
  const [value, setValue] = useState(() => {
    const num = Number(target)
    return isNaN(num) || num === 0 ? (target || 0) : 0
  })
  const startTime = useRef(null)
  const rafId = useRef(null)

  useEffect(() => {
    const numTarget = Number(target)
    if (isNaN(numTarget) || numTarget === 0) {
      return
    }

    const timeout = setTimeout(() => {
      startTime.current = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime.current
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(eased * numTarget)
        setValue(current)
        if (progress < 1) {
          rafId.current = requestAnimationFrame(animate)
        }
      }

      rafId.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [target, duration, delay])

  return value
}

/**
 * CountUp: Animated number display component.
 * Usage: <CountUp value={45000} prefix="₹" suffix="" />
 */
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 1200, delay = 0 }) {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
  const animated = useCountUp(Math.round(numericValue || 0), { duration, delay })

  // Format with locale separators
  const formatted = decimals > 0
    ? Number(animated).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : animated.toLocaleString('en-IN')

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
