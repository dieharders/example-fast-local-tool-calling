import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEngine, type LoadProgress } from '../engine'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useEngine() {
  const engine = useMemo(getEngine, [])
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const load = useCallback(async () => {
    if (started.current) return
    started.current = true
    setStatus('loading')
    setError(null)
    try {
      await engine.load(setProgress)
      setStatus('ready')
    } catch (e) {
      started.current = false
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [engine])

  useEffect(() => {
    void load()
  }, [load])

  return { engine, status, progress, error, load }
}
