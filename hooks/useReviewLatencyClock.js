'use client'

import { useRef, useState, useLayoutEffect, useCallback } from 'react'

/**
 * Starts a high-resolution clock after the question shell has painted (double rAF).
 * @param {{ enabled: boolean; questionKey: string }} opts
 */
export function useReviewLatencyClock ({ enabled, questionKey }) {
  const startMsRef = useRef(null)
  const rafRef = useRef(null)
  const [displaySeconds, setDisplaySeconds] = useState(0)

  useLayoutEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startMsRef.current = null
      return undefined
    }

    setDisplaySeconds(0)

    let outer = 0
    let inner = 0

    const arm = () => {
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          const t0 = performance.now()
          startMsRef.current = t0
          const tick = () => {
            const s = startMsRef.current
            if (s == null) return
            setDisplaySeconds((performance.now() - s) / 1000)
            rafRef.current = requestAnimationFrame(tick)
          }
          rafRef.current = requestAnimationFrame(tick)
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

  const stopAndGetLatencySeconds = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const t0 = startMsRef.current
    startMsRef.current = null
    if (t0 == null) return 0
    const sec = (performance.now() - t0) / 1000
    setDisplaySeconds(sec)
    return sec
  }, [])

  return { displaySeconds, stopAndGetLatencySeconds }
}
