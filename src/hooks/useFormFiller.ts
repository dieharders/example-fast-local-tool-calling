import { useCallback, useReducer, useRef } from 'react'
import type { FillEngine, NeedleEnvelope } from '../engine'
import { interpretEnvelope, type SectionResult } from '../form/flags'
import { FORM_SECTIONS, fieldDomId, type SectionDef } from '../form/schema'
import { TOOL_SCHEMAS, systemPrompt } from '../form/toolSchemas'

export type Phase = 'idle' | 'running' | 'done'
export type SectionStatus = 'idle' | 'reading' | 'queued' | 'typing' | 'done'

export interface SectionView {
  status: SectionStatus
  confidence?: number
  lowConfidence?: boolean
  notes?: string
  error?: string | null
}

export interface FillStats {
  filled: number
  flagged: number
  inferenceMs: number
  /** Network requests observed while filling. The whole point is that this is 0. */
  requests: number
  decodeTps?: number
  peakRamMb?: number
}

interface State {
  phase: Phase
  values: Record<string, string>
  flags: Record<string, string>
  sections: Record<string, SectionView>
  active: string | null
  /** Index of the section the model is currently reading, or -1. */
  reading: number
  stats: FillStats | null
  envelopes: Record<string, NeedleEnvelope>
  ticket: number
}

type Action =
  | { type: 'reset' }
  | { type: 'start' }
  | { type: 'section'; tool: string; view: SectionView }
  | { type: 'reading'; index: number }
  | { type: 'envelope'; tool: string; env: NeedleEnvelope }
  | { type: 'value'; id: string; value: string }
  | { type: 'userValue'; id: string; value: string }
  | { type: 'flag'; id: string; reason: string }
  | { type: 'active'; id: string | null }
  | { type: 'finish'; stats: FillStats }

const emptySections = () => Object.fromEntries(FORM_SECTIONS.map((s) => [s.tool, { status: 'idle' } as SectionView]))

const initial: State = {
  phase: 'idle',
  values: {},
  flags: {},
  sections: emptySections(),
  active: null,
  reading: -1,
  stats: null,
  envelopes: {},
  ticket: 42,
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'reset':
      return { ...initial, ticket: state.ticket }
    case 'start':
      return { ...initial, phase: 'running', ticket: state.ticket + 1 }
    case 'section':
      return { ...state, sections: { ...state.sections, [a.tool]: { ...state.sections[a.tool], ...a.view } } }
    case 'reading':
      return { ...state, reading: a.index }
    case 'envelope':
      return { ...state, envelopes: { ...state.envelopes, [a.tool]: a.env } }
    case 'value':
      return { ...state, values: { ...state.values, [a.id]: a.value } }
    case 'userValue': {
      const { [a.id]: _cleared, ...flags } = state.flags
      return { ...state, values: { ...state.values, [a.id]: a.value }, flags }
    }
    case 'flag':
      return { ...state, flags: { ...state.flags, [a.id]: a.reason } }
    case 'active':
      return { ...state, active: a.id }
    case 'finish':
      return { ...state, phase: 'done', active: null, reading: -1, stats: a.stats }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TYPE_BUDGET_MS = 260 // max time to type one field
const CHAR_MS = 22
const FIELD_GAP_MS = 70
const PICK_MS = 200 // dropdown / checkbox settle time

export function useFormFiller(engine: FillEngine) {
  const [state, dispatch] = useReducer(reducer, initial)
  const runRef = useRef(0)
  const followRef = useRef(true)

  const follow = (id: string) => {
    if (!followRef.current) return
    const el = document.getElementById(fieldDomId(id))
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top < 90 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const animateSection = useCallback(
    async (section: SectionDef, result: SectionResult, alive: () => boolean, instant: boolean) => {
      if (!alive()) return
      dispatch({ type: 'section', tool: section.tool, view: { status: 'typing' } })
      for (const field of section.fields) {
        const r = result.fields[field.id]
        if (!r) continue
        if (!alive()) return
        dispatch({ type: 'active', id: field.id })
        follow(field.id)
        if (instant) {
          dispatch({ type: 'value', id: field.id, value: r.display })
        } else if (field.type === 'select' || field.type === 'checks' || field.type === 'state') {
          dispatch({ type: 'value', id: field.id, value: r.display })
          await sleep(PICK_MS)
        } else {
          const per = Math.min(CHAR_MS, TYPE_BUDGET_MS / r.display.length)
          for (let k = 1; k <= r.display.length; k++) {
            if (!alive()) return
            dispatch({ type: 'value', id: field.id, value: r.display.slice(0, k) })
            await sleep(per)
          }
        }
        if (r.flagged && r.reason) dispatch({ type: 'flag', id: field.id, reason: r.reason })
        if (!instant) await sleep(FIELD_GAP_MS)
      }
      if (!alive()) return
      dispatch({ type: 'active', id: null })
      dispatch({
        type: 'section',
        tool: section.tool,
        view: {
          status: 'done',
          confidence: result.confidence,
          lowConfidence: result.lowConfidence,
          notes: result.notes,
          error: result.error,
        },
      })
    },
    [],
  )

  const fill = useCallback(
    async (text: string): Promise<FillStats | null> => {
      const run = ++runRef.current
      const alive = () => runRef.current === run
      dispatch({ type: 'start' })

      // Stop auto-following the typing as soon as the user scrolls on their own.
      followRef.current = true
      const stopFollow = () => (followRef.current = false)
      const opts = { passive: true } as const
      window.addEventListener('wheel', stopFollow, opts)
      window.addEventListener('touchmove', stopFollow, opts)

      // Measure, don't assert: count every network request made while filling.
      let requests = 0
      let observer: PerformanceObserver | null = null
      try {
        observer = new PerformanceObserver((list) => (requests += list.getEntries().length))
        observer.observe({ type: 'resource', buffered: false })
      } catch {
        observer = null
      }

      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const today = new Date()
      const sys = systemPrompt(today)
      const results: SectionResult[] = []
      let inferenceMs = 0
      let typing = Promise.resolve()

      // One-shot call per section (catalogue splitting). Each result starts typing
      // immediately while the model moves on to the next section.
      for (const [index, section] of FORM_SECTIONS.entries()) {
        if (!alive()) break
        dispatch({ type: 'reading', index })
        dispatch({ type: 'section', tool: section.tool, view: { status: 'reading' } })
        const t0 = performance.now()
        let result: SectionResult
        try {
          const env = await engine.complete({
            systemPrompt: sys,
            tools: [TOOL_SCHEMAS[section.tool]],
            input: text,
            maxNewTokens: 384,
          })
          if (!alive()) break
          dispatch({ type: 'envelope', tool: section.tool, env })
          result = interpretEnvelope(section, env, today)
        } catch (e) {
          if (!alive()) break
          result = {
            tool: section.tool,
            confidence: 0,
            lowConfidence: true,
            suppressed: false,
            notes: '',
            fields: {},
            error: e instanceof Error ? e.message : String(e),
          }
        }
        inferenceMs += performance.now() - t0
        results.push(result)
        dispatch({ type: 'section', tool: section.tool, view: { status: 'queued' } })
        typing = typing.then(() => animateSection(section, result, alive, instant))
      }
      if (alive()) dispatch({ type: 'reading', index: -1 })
      await typing

      observer?.disconnect()
      window.removeEventListener('wheel', stopFollow)
      window.removeEventListener('touchmove', stopFollow)
      if (!alive()) return null

      const all = results.flatMap((r) => Object.values(r.fields))
      const tps = results.map((r) => r.decodeTps).filter((n): n is number => typeof n === 'number')
      const ram = results.map((r) => r.peakRamMb).filter((n): n is number => typeof n === 'number')
      const stats: FillStats = {
        filled: all.length,
        flagged: all.filter((f) => f.flagged).length,
        inferenceMs,
        requests,
        decodeTps: tps.length ? Math.round(tps.reduce((a, b) => a + b, 0) / tps.length) : undefined,
        peakRamMb: ram.length ? Math.max(...ram) : undefined,
      }
      dispatch({ type: 'finish', stats })
      return stats
    },
    [engine, animateSection],
  )

  const reset = useCallback(() => {
    runRef.current++
    dispatch({ type: 'reset' })
  }, [])

  const setUserValue = useCallback((id: string, value: string) => dispatch({ type: 'userValue', id, value }), [])

  return { ...state, fill, reset, setUserValue }
}
