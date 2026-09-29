import type { FillEngine, NeedleEnvelope } from './types'

// A stand-in for Needle 3 (use ?engine=mock) for working on the UI without the 35 MB model.
// It answers the same single-tool, clause-sized calls with crude regexes and returns Needle's
// envelope shape, so everything downstream behaves as it does with the real engine.

const MODEL_BYTES = 36_086_595 // needle.js + needle.wasm + needle3.cact
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
type Args = Record<string, unknown>

const after = (re: RegExp, s: string) => s.replace(re, '').trim()
const MOCK: Record<string, (c: string) => Args | null> = {
  set_name: (c) => {
    const m = /(?:i'?m|its|it'?s|this is|my name is)\s+([a-z]+)\s+([a-z]+(?:\s+[a-z]+)?)/i.exec(c)
    return m ? { first_name: m[1], last_name: m[2] } : null
  },
  set_birth_date: (c) => ({ date: after(/^.*?\b(born|dob|birthday|date of birth)\b\s*(on\s+)?/i, c) }),
  set_ssn: (c) => (/\d{3}[\s-]?\d{2}[\s-]?\d{4}/.exec(c) ? { ssn: /\d{3}[\s-]?\d{2}[\s-]?\d{4}/.exec(c)![0] } : null),
  set_phone: (c) => (/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.exec(c) ? { phone: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.exec(c)![0] } : null),
  set_email: (c) => (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.exec(c) ? { email: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.exec(c)![0] } : null),
  set_contact_method: (c) => ({ method: /text/i.test(c) ? 'text' : /email/i.test(c) ? 'email' : 'call' }),
  set_current_address: (c) => address(c),
  set_new_address: (c) => address(c),
  set_tenure: (c) => ({ tenure: /\bown/i.test(c) ? 'own' : 'rent' }),
  set_years_there: (c) => years(c),
  set_years_employed: (c) => years(c),
  set_move_reason: (c) => ({ reason: /lease/i.test(c) ? 'lease is up' : /family|daughter|son|mom|dad/i.test(c) ? 'family' : /job|work/i.test(c) ? 'new job' : 'other' }),
  set_move_in_date: (c) => ({ date: after(/^.*?\b(on|by|around|starting|move in|moving in)\b\s*/i, c) }),
  set_lease_term: (c) => (/(\d+)\s*mo/i.exec(c) ? { term: `${/(\d+)\s*mo/i.exec(c)![1]} months` } : null),
  set_job: (c) => {
    const employer = /(?:@\s?|at\s+)([a-z]+)/i.exec(c)?.[1]
    const title = /\bas an?\s+([a-z]+)/i.exec(c)?.[1]
    return employer || title ? { ...(employer ? { employer } : {}), ...(title ? { job_title: title } : {}) } : null
  },
  set_employment: (c) => {
    const m = /(full|part)[- ]?time|retired|student|unemployed|self[- ]?employed/i.exec(c)
    return m ? { status: m[0].toLowerCase().replace(/\s/, '-').replace('selfemployed', 'self-employed') } : null
  },
  set_income: (c) => (/(\d+)\s?k\b/i.exec(c) ? { amount: Number(/(\d+)\s?k\b/i.exec(c)![1]) * 1000 } : null),
  set_people: (c) => (/(\d+)\s*(ppl|people|persons?)/i.exec(c) ? { people: Number(/(\d+)/.exec(c)![1]) } : null),
  set_pet: (c) => ({ pet: /\bdog|pupp/i.test(c) ? 'dog' : /\bcat|kitten/i.test(c) ? 'cat' : 'other' }),
  set_smoking: (c) => ({ smoker: !/\b(no|non|don'?t|never)[- ]?smok/i.test(c) }),
  set_emergency_contact: (c) => {
    const name = /\b([A-Z][a-z]+)'s\b/.exec(c)?.[1]
    const phone = /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.exec(c)?.[0]
    return name ? { name, ...(phone ? { phone } : {}) } : null
  },
}

function address(c: string): Args | null {
  const m = /(\d+\s+[a-z0-9# ]+?)(?:,?\s+in\s+([a-z ]+))?$/i.exec(c.replace(/^.*?\b(at|from|to)\s+(?=\d)/i, ''))
  return m ? { street: m[1], ...(m[2] ? { city: m[2] } : {}) } : null
}
function years(c: string): Args | null {
  const m = /(\d+)\s*(years|yrs)/i.exec(c)
  return m ? { years: Number(m[1]) } : null
}

export function createMockEngine(): FillEngine {
  return {
    kind: 'mock',
    modelLabel: 'Needle 3 · 20 layers',
    runtimeLabel: 'CPU · WebAssembly',
    lanes: 1,

    async load(onProgress) {
      onProgress({ stage: 'runtime', loaded: 0, total: MODEL_BYTES })
      await sleep(200)
      const steps = 20
      for (let i = 1; i <= steps; i++) {
        await sleep(rand(30, 60))
        onProgress({ stage: 'weights', loaded: Math.round((MODEL_BYTES * i) / steps), total: MODEL_BYTES })
      }
      onProgress({ stage: 'init', loaded: MODEL_BYTES, total: MODEL_BYTES })
      await sleep(150)
    },

    async complete({ tools, input }) {
      await sleep(rand(120, 260))
      const name = tools[0]?.name ?? ''
      const args = MOCK[name]?.(input) ?? null
      const envelope: NeedleEnvelope = {
        type: 'call',
        success: true,
        error: null,
        function_calls: args ? [{ name, arguments: args }] : [],
        suppressed_calls: [],
        reasoning: args ? `(mock) '${input}' -> ${Object.keys(args).join(', ')}` : '(mock) nothing matched',
        confidence: args ? Number(rand(0.3, 0.9).toFixed(2)) : 0.05,
        validation: { ungrounded: [] },
        decode_tps: Math.round(rand(380, 460)),
        peak_ram_mb: 97,
      }
      return envelope
    },
  }
}
