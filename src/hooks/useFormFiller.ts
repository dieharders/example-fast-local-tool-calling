import { useCallback, useReducer, useRef } from 'react'
import type { FillEngine } from '../engine'
import type { Clause } from '../extract/clauses'
import type { CallResult, FieldUpdate } from '../extract/interpret'
import { plan, runPlan, type PlannedCall } from '../extract/pipeline'
import type { Section } from '../extract/tools'
import { ALL_FIELDS, FORM_SECTIONS, fieldDomId } from '../form/schema'

export type Phase = 'idle' | 'running' | 'done'
export type SectionStatus = 'idle' | 'reading' | 'typing' | 'done'

export interface SectionView {
  status: SectionStatus
  planned: number
  finished: number
  /** Average calibrated confidence of this section's finished calls. */
  confidence?: number
  notes: string[]
  errors: number
}

export interface FillStats {
  filled: number
  flagged: number
  /** Wall time from the first model call to the last result. */
  inferenceMs: number
  calls: number
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
  /** Clauses the model is reading right now (one per lane), for highlighting the pad. */
  reading: Clause[]
  progress: { done: number; total: number; tool: string | null }
  stats: FillStats | null
  calls: CallResult[]
  ticket: number
}

type Action =
  | { type: 'reset' }
  | { type: 'start'; planned: Record<string, number>; total: number }
  | { type: 'callStart'; call: PlannedCall }
  | { type: 'callDone'; result: CallResult; call: PlannedCall }
  | { type: 'section'; section: string; status: SectionStatus }
  | { type: 'value'; id: string; value: string }
  | { type: 'userValue'; id: string; value: string }
  | { type: 'flag'; id: string; reason: string }
  | { type: 'active'; id: string | null }
  | { type: 'finish'; stats: FillStats }

const emptySections = (planned: Record<string, number> = {}) =>
  Object.fromEntries(
    FORM_SECTIONS.map((s) => [s.tool, { status: 'idle', planned: planned[s.tool] ?? 0, finished: 0, notes: [], errors: 0 } as SectionView]),
  )

const initial: State = {
  phase: 'idle',
  values: {},
  flags: {},
  sections: emptySections(),
  active: null,
  reading: [],
  progress: { done: 0, total: 0, tool: null },
  stats: null,
  calls: [],
  ticket: 42,
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'reset':
      return { ...initial, ticket: state.ticket }
    case 'start':
      return {
        ...initial,
        phase: 'running',
        ticket: state.ticket + 1,
        sections: emptySections(a.planned),
        progress: { done: 0, total: a.total, tool: null },
      }
    case 'callStart': {
      const s = state.sections[a.call.tool.section]
      return {
        ...state,
        reading: [...state.reading, a.call.clause],
        progress: { ...state.progress, tool: a.call.tool.schema.name },
        sections: { ...state.sections, [a.call.tool.section]: { ...s, status: s.status === 'idle' ? 'reading' : s.status } },
      }
    }
    case 'callDone': {
      const s = state.sections[a.result.section]
      const finished = s.finished + 1
      const confidence = ((s.confidence ?? 0) * s.finished + a.result.confidence) / finished
      const note = a.result.reasoning.trim()
      return {
        ...state,
        reading: state.reading.filter((c) => c !== a.call.clause),
        progress: { ...state.progress, done: state.progress.done + 1 },
        calls: [...state.calls, a.result],
        sections: {
          ...state.sections,
          [a.result.section]: {
            ...s,
            finished,
            confidence,
            notes: note && !s.notes.includes(note) ? [...s.notes, note] : s.notes,
            errors: s.errors + (a.result.error ? 1 : 0),
          },
        },
      }
    }
    case 'section':
      return { ...state, sections: { ...state.sections, [a.section]: { ...state.sections[a.section], status: a.status } } }
    case 'value':
      return { ...state, values: { ...state.values, [a.id]: a.value } }
    case 'userValue': {
      const flags = { ...state.flags }
      delete flags[a.id]
      return { ...state, values: { ...state.values, [a.id]: a.value }, flags }
    }
    case 'flag':
      return { ...state, flags: { ...state.flags, [a.id]: a.reason } }
    case 'active':
      return { ...state, active: a.id }
    case 'finish':
      return { ...state, phase: 'done', active: null, reading: [], stats: a.stats }
  }
}

const FIELD_TYPE = new Map(ALL_FIELDS.map((f) => [f.id, f.type]))
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

  const typeUpdate = useCallback(async (u: FieldUpdate, alive: () => boolean, instant: boolean) => {
    dispatch({ type: 'active', id: u.id })
    follow(u.id)
    const kind = FIELD_TYPE.get(u.id)
    if (instant) {
      dispatch({ type: 'value', id: u.id, value: u.value })
    } else if (kind === 'select' || kind === 'checks' || kind === 'state') {
      dispatch({ type: 'value', id: u.id, value: u.value })
      await sleep(PICK_MS)
    } else {
      const per = Math.min(CHAR_MS, TYPE_BUDGET_MS / u.value.length)
      for (let k = 1; k <= u.value.length; k++) {
        if (!alive()) return
        dispatch({ type: 'value', id: u.id, value: u.value.slice(0, k) })
        await sleep(per)
      }
    }
    if (u.flag) dispatch({ type: 'flag', id: u.id, reason: u.flag })
    if (!instant) await sleep(FIELD_GAP_MS)
  }, [])

  const fill = useCallback(
    async (text: string): Promise<FillStats | null> => {
      const run = ++runRef.current
      const alive = () => runRef.current === run
      const p = plan(text)
      const planned: Record<string, number> = {}
      for (const b of p.batches) for (const c of b) planned[c.tool.section] = (planned[c.tool.section] ?? 0) + 1
      dispatch({ type: 'start', planned, total: p.total })

      // Stop auto-following the typing as soon as the user scrolls on their own.
      followRef.current = true
      const stopFollow = () => (followRef.current = false)
      window.addEventListener('wheel', stopFollow, { passive: true })
      window.addEventListener('touchmove', stopFollow, { passive: true })

      // Measure, don't assert: count every network request made while filling.
      const fillStart = performance.now()
      let requests = 0
      let observer: PerformanceObserver | null = null
      try {
        observer = new PerformanceObserver((list) => (requests += list.getEntries().length))
        observer.observe({ type: 'resource', buffered: false })
      } catch {
        observer = null
      }

      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const filled = new Set<string>()
      const flagged = new Set<string>()
      const typedBySection: Record<string, number> = {}
      let typing = Promise.resolve()
      let firstStart = 0
      let lastEnd = 0

      const results = await runPlan(engine, p, new Date(), {
        alive,
        onStart: (call) => {
          if (!firstStart) firstStart = performance.now()
          dispatch({ type: 'callStart', call })
        },
        onResult: (result, call) => {
          lastEnd = performance.now()
          dispatch({ type: 'callDone', result, call })
          // First value wins: a later clause doesn't overwrite a field that's already filled.
          const fresh = result.updates.filter((u) => !filled.has(u.id))
          fresh.forEach((u) => {
            filled.add(u.id)
            if (u.flag) flagged.add(u.id)
          })
          const section: Section = result.section
          typing = typing.then(async () => {
            if (!alive()) return
            if (fresh.length) dispatch({ type: 'section', section, status: 'typing' })
            for (const u of fresh) {
              if (!alive()) return
              await typeUpdate(u, alive, instant)
            }
            typedBySection[section] = (typedBySection[section] ?? 0) + 1
            if (alive() && typedBySection[section] === planned[section]) {
              dispatch({ type: 'active', id: null })
              dispatch({ type: 'section', section, status: 'done' })
            }
          })
        },
      })
      await typing

      observer?.disconnect()
      // Belt and braces: anything in the resource timeline that started during the fill counts too.
      requests = Math.max(requests, performance.getEntriesByType('resource').filter((e) => e.startTime >= fillStart).length)
      window.removeEventListener('wheel', stopFollow)
      window.removeEventListener('touchmove', stopFollow)
      if (!alive()) return null

      const tps = results.map((r) => r.decodeTps).filter((n): n is number => typeof n === 'number' && n > 0)
      const ram = results.map((r) => r.peakRamMb).filter((n): n is number => typeof n === 'number' && n > 0)
      const stats: FillStats = {
        filled: filled.size,
        flagged: flagged.size,
        inferenceMs: firstStart ? lastEnd - firstStart : 0,
        calls: results.length,
        requests,
        decodeTps: tps.length ? Math.round(tps.reduce((a, b) => a + b, 0) / tps.length) : undefined,
        peakRamMb: ram.length ? Math.max(...ram) : undefined,
      }
      dispatch({ type: 'finish', stats })
      return stats
    },
    [engine, typeUpdate],
  )

  const reset = useCallback(() => {
    runRef.current++
    dispatch({ type: 'reset' })
  }, [])

  const setUserValue = useCallback((id: string, value: string) => dispatch({ type: 'userValue', id, value }), [])

  return { ...state, fill, reset, setUserValue }
}
