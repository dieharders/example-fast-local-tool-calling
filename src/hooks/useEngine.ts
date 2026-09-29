import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEngine, type LoadProgress } from '../engine'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Visitors with Data Saver on get the 36 MB model on their first Fill, not on page load. */
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

export function useEngine() {
  const engine = useMemo(getEngine, [])
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = useRef<Promise<boolean> | null>(null)

  /** Resolves true once the model is ready; concurrent callers share one load. */
  const load = useCallback(() => {
    loading.current ??= (async () => {
      setStatus('loading')
      setError(null)
      try {
        await engine.load(setProgress)
        setStatus('ready')
        return true
      } catch (e) {
        loading.current = null
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    })()
    return loading.current
  }, [engine])

  useEffect(() => {
    if (!saveData()) void load()
  }, [load])

  return { engine, status, progress, error, load }
}
