import type { ToolSchema } from '../form/toolSchemas'

// Mirrors the JSON envelope returned by Needle's `needle_complete`, so the mock
// and the real WASM engine are interchangeable.

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface NeedleEnvelope {
  type: 'call' | 'respond' | 'refuse'
  success: boolean
  error: string | null
  error_code?: string | null
  function_calls: ToolCall[]
  /** Calls the engine produced but gated out for low confidence (< 0.1). */
  suppressed_calls: ToolCall[]
  /** Short trace, e.g. "'SF' -> cur_city San Francisco; '91' -> 1991". */
  reasoning: string
  /** One calibrated score for the whole response (not per field). */
  confidence: number
  /** Arguments the engine could not ground in the input, as "tool.field". */
  validation?: { ungrounded?: string[] }
  prefill_tps?: number
  decode_tps?: number
  peak_ram_mb?: number
}

export interface LoadProgress {
  stage: 'runtime' | 'weights' | 'init'
  loaded: number
  total: number
}

export interface CompleteRequest {
  systemPrompt: string
  tools: ToolSchema[]
  input: string
  maxNewTokens?: number
}

export interface FillEngine {
  kind: 'mock' | 'needle'
  /** Shown on the ticket, e.g. "Needle 3 · 20 layers". */
  modelLabel: string
  /** Where inference runs, e.g. "CPU · WebAssembly". */
  runtimeLabel: string
  load(onProgress: (p: LoadProgress) => void): Promise<void>
  complete(req: CompleteRequest): Promise<NeedleEnvelope>
}
