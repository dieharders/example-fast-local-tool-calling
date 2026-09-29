// Mirrors Needle's C/WASM API: a tool schema array in, the JSON envelope from
// `needle_complete` out. The mock and the real WASM engine are interchangeable.

export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, Record<string, unknown>>
    required: string[]
  }
}

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
  /** Calls the engine produced but held back (confidence under 0.1 or a grounding gate). */
  suppressed_calls: ToolCall[]
  /** Short trace, e.g. "'415 555 0192' -> phone". */
  reasoning: string
  /** One calibrated score for the whole response. */
  confidence: number
  /** Arguments the engine could not ground in the input, as "tool.field". */
  validation?: { ungrounded?: string[]; negation?: boolean }
  prefill_tps?: number
  decode_tps?: number
  peak_ram_mb?: number
}

export interface LoadProgress {
  stage: 'runtime' | 'weights' | 'init'
  loaded: number
  total: number
  /** True when the files came from this browser's cache instead of the network. */
  cached?: boolean
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
  /** How many calls can run at once (one model instance per lane). */
  lanes: number
  load(onProgress: (p: LoadProgress) => void): Promise<void>
  /** `lane` pins the call to one instance so consecutive calls with the same tools skip re-init. */
  complete(req: CompleteRequest, opts?: { lane?: number }): Promise<NeedleEnvelope>
}
