'use client'

import { useRef, useLayoutEffect, useCallback } from 'react'

/**
 * Starts a high-resolution clock after the question shell has painted (double rAF).
 * @param {{ enabled: boolean; questionKey: string }} opts
 */
export function useReviewLatencyClock ({ enabled, questionKey }) {
  const startMsRef = useRef(null)
  const rafRef = useRef(null)

  useLayoutEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startMsRef.current = null
      return undefined
    }

    let outer = 0
    let inner = 0

    const arm = () => {
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          const t0 = performance.now()
          startMsRef.current = t0
        })
      })
    }

    arm()

    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startMsRef.current = null
    }
  }, [enabled, questionKey])

  const stopAndGetLatencyMs = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const t0 = startMsRef.current
    startMsRef.current = null
    if (t0 == null) return 0
    return Math.max(0, Math.round(performance.now() - t0))
  }, [])

  return { stopAndGetLatencyMs }
}
