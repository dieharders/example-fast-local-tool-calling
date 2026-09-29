import { createMockEngine } from './mockEngine'
import { createNeedleEngine } from './needleEngine'
import type { FillEngine } from './types'

export type { FillEngine, NeedleEnvelope, LoadProgress, ToolSchema } from './types'

let engine: FillEngine | null = null

/** The real Needle engine by default; `?engine=mock` (or VITE_ENGINE=mock) swaps in the stand-in. */
export function getEngine(): FillEngine {
  if (engine) return engine
  const requested = new URLSearchParams(window.location.search).get('engine') ?? import.meta.env.VITE_ENGINE ?? 'needle'
  engine = requested === 'mock' ? createMockEngine() : createNeedleEngine()
  return engine
}
