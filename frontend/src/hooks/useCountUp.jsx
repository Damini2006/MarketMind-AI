import { useState, useEffect, useRef } from 'react'

/**
 * useCountUp: Animates a number from 0 to target over duration ms.
 * Returns the current displayed value.
 */
export function useCountUp(target, { duration = 1200, delay = 0 } = {}) {
  const [value, setValue] = useState(0)
  const startTime = useRef(null)
  const rafId = useRef(null)

  useEffect(() => {
    if (target === 0 || target === null || target === undefined) {
      setValue(target || 0)
      return
    }

    const numTarget = Number(target)
    if (isNaN(numTarget)) {
      setValue(target)
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
 * Usage: <CountUp value={45000} prefix=₹ suffix= />
 */
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 1200, delay = 0 }) {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
  const animated = useCountUp(Math.round(numericValue || 0), { duration, delay })

  // Format with locale separators
  const formatted = animated.toLocaleString('en-IN')

  return (
    <span className="tabular-nums">
      {prefix}{formatted}{suffix}
    </span>
  )
}
