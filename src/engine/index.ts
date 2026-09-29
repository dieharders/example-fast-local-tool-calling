import { createMockEngine } from './mockEngine'
import type { FillEngine } from './types'

export type { FillEngine, NeedleEnvelope, LoadProgress } from './types'

let engine: FillEngine | null = null

/** `?engine=mock|needle` overrides `VITE_ENGINE`. Phase 1 ships the mock only. */
export function getEngine(): FillEngine {
  if (engine) return engine
  const requested = new URLSearchParams(window.location.search).get('engine') ?? import.meta.env.VITE_ENGINE ?? 'mock'
  if (requested !== 'mock') console.warn(`[engine] "${requested}" is not wired yet; using the mock.`)
  engine = createMockEngine()
  return engine
}
