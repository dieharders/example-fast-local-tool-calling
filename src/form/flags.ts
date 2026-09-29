import type { NeedleEnvelope, ToolCall } from '../engine/types'
import { toDisplay, validate } from './format'
import { ALL_FIELDS, type FieldDef, type SectionDef } from './schema'

// Needle gives one confidence per call, so per-field "check me" flags come from
// (a) the engine's `validation.ungrounded` list and (b) our plausibility checks.
// A low section confidence additionally tags the whole section for review.

export const SECTION_REVIEW_THRESHOLD = 0.7

export interface FieldResult {
  display: string
  flagged: boolean
  reason: string | null
}

export interface SectionResult {
  tool: string
  confidence: number
  lowConfidence: boolean
  suppressed: boolean
  notes: string
  fields: Record<string, FieldResult>
  error: string | null
  decodeTps?: number
  peakRamMb?: number
}

const LABELS = new Map(ALL_FIELDS.map((f) => [f.id, f.label]))

/** "'SF' -> cur_city San Francisco" → "'SF' → City San Francisco" (only the right side is rewritten). */
function prettifySegment(seg: string): string {
  const i = seg.indexOf('->')
  if (i < 0) return seg.trim()
  const rhs = seg.slice(i + 2).replace(/\b[a-z]+(?:_[a-z]+)*\b/g, (w) => LABELS.get(w) ?? w)
  return `${seg.slice(0, i).trim()} → ${rhs.trim()}`
}

function segments(reasoning: string): string[] {
  return reasoning
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function prettifyReasoning(reasoning: string): string {
  return segments(reasoning).map(prettifySegment).join('; ')
}

function reasonFor(reasoning: string, field: FieldDef): string | null {
  const re = new RegExp(`\\b${field.id}\\b`)
  const seg = segments(reasoning).find((s) => {
    const i = s.indexOf('->')
    return re.test(i < 0 ? s : s.slice(i + 2))
  })
  return seg ? prettifySegment(seg) : null
}

export function interpretEnvelope(section: SectionDef, env: NeedleEnvelope, today: Date): SectionResult {
  const base = {
    tool: section.tool,
    confidence: env.confidence ?? 0,
    notes: prettifyReasoning(env.reasoning ?? ''),
    decodeTps: env.decode_tps,
    peakRamMb: env.peak_ram_mb,
  }
  if (!env.success || env.error) {
    return { ...base, lowConfidence: true, suppressed: false, fields: {}, error: env.error ?? 'The engine failed on this section.' }
  }

  const pick = (calls: ToolCall[]) => calls.find((c) => c.name === section.tool) ?? calls[0]
  let call = pick(env.function_calls ?? [])
  let suppressed = false
  if (!call && env.suppressed_calls?.length) {
    call = pick(env.suppressed_calls)
    suppressed = true
  }
  if (!call) {
    return { ...base, lowConfidence: true, suppressed: false, fields: {}, error: null }
  }

  const ungrounded = new Set(env.validation?.ungrounded ?? [])
  const fields: Record<string, FieldResult> = {}
  for (const field of section.fields) {
    const raw = call.arguments?.[field.id]
    const display = toDisplay(field, raw)
    if (display === null) continue
    const invalid = validate(field, raw, today)
    const isUngrounded = ungrounded.has(`${section.tool}.${field.id}`) || ungrounded.has(field.id)
    const flagged = Boolean(invalid) || isUngrounded || suppressed
    const reason = !flagged
      ? null
      : invalid ??
        reasonFor(env.reasoning ?? '', field) ??
        (suppressed ? 'The model was very unsure about this whole section.' : 'Not stated outright, so this was inferred.')
    fields[field.id] = { display, flagged, reason }
  }

  return {
    ...base,
    lowConfidence: suppressed || base.confidence < SECTION_REVIEW_THRESHOLD,
    suppressed,
    fields,
    error: null,
  }
}
