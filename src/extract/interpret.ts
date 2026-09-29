import type { NeedleEnvelope, ToolCall } from '../engine/types'
import {
  cleanCity,
  cleanStreet,
  digitsGrounded,
  displayDate,
  formatPhone,
  formatSsn,
  grounded,
  money,
  numberGrounded,
  parseDate,
  periodIn,
  splitName,
  stateFor,
  titleCase,
  toMonthly,
  zipIn,
  type Period,
} from './normalize'
import type { ExtractTool, Section } from './tools'

// Turns one single-tool Needle envelope into form-field updates.
// Policy (what earns a "check me"):
//   held back by the engine (suppressed_calls) · confidence below LOW · a value the parser had to
//   assume something for · a plausibility check failing. Values that can't be found in the
//   clause at all are dropped rather than shown: the form never displays invented text.

// Values here have already been checked against the clause, and in testing grounded values at
// 0.12-0.2 were nearly always right; below that (or held back) they get a flag.
export const LOW_CONFIDENCE = 0.12

export interface FieldUpdate {
  id: string
  /** What the form shows: formatted text, or the option value for dropdowns/checkboxes. */
  value: string
  flag: string | null
}

export interface CallResult {
  tool: string
  section: Section
  clause: string
  confidence: number
  held: boolean
  updates: FieldUpdate[]
  /** Needle's reasoning line, e.g. "'415 555 0192' -> phone". */
  reasoning: string
  envelope: NeedleEnvelope | null
  error: string | null
  ms: number
  decodeTps?: number
  peakRamMb?: number
}

const KIN = /\b(daughter|son|mom|mother|dad|father|wife|husband|partner|brother|sister|friend|aunt|uncle|cousin|grandma|grandpa)\b/i
const CONTACT = { call: 'phone', text: 'text', email: 'email' } as Record<string, string>
const REASON = { 'new job': 'work', 'more space': 'space', downsizing: 'downsize', family: 'family', 'lease is up': 'lease_end' } as Record<string, string>
const REASON_EVIDENCE: Record<string, RegExp> = {
  'new job': /\b(job|work|relocat\w*|transfer\w*)\b/i,
  'more space': /\b(space|room|bigger|larger)\b/i,
  downsizing: /\b(downsiz\w*|smaller)\b/i,
  family: /\b(family|daughter|son|kids?|mom|mother|dad|father|parents?|grand\w*)\b/i,
  'lease is up': /\blease\b/i,
}
const LEASE = { 'month-to-month': 'm2m', '6 months': '6', '12 months': '12', '18 months': '18', '24 months': '24' } as Record<string, string>
const STATUS = {
  'full-time': 'full_time', 'part-time': 'part_time', 'self-employed': 'self_employed', student: 'student', retired: 'retired', unemployed: 'unemployed',
} as Record<string, string>

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const pct = (c: number) => `${Math.round(c * 100)}%`

export function interpret(tool: ExtractTool, clause: string, env: NeedleEnvelope, today: Date): Omit<CallResult, 'ms'> {
  const name = tool.schema.name
  const base = {
    tool: name,
    section: tool.section,
    clause,
    confidence: Number(env.confidence ?? 0),
    reasoning: env.reasoning ?? '',
    envelope: env,
    decodeTps: env.decode_tps,
    peakRamMb: env.peak_ram_mb,
  }
  if (env.error && !env.function_calls?.length && !env.suppressed_calls?.length) {
    return { ...base, held: false, updates: [], error: env.error }
  }
  const held = !(env.function_calls?.length ?? 0) && (env.suppressed_calls?.length ?? 0) > 0
  const calls: ToolCall[] = (held ? env.suppressed_calls : env.function_calls) ?? []
  const args = calls.map((c) => c.arguments ?? {})
  const first = (key: string) => args.map((a) => a[key]).find((v) => v !== undefined && v !== null && v !== '')

  const doubt =
    held ? `The model held this back (${pct(base.confidence)} sure).` : base.confidence < LOW_CONFIDENCE ? `Low confidence: ${pct(base.confidence)}.` : null
  const updates: FieldUpdate[] = []
  const put = (id: string, value: string, extra: string | null = null) => {
    if (!value) return
    // One doubtful call flags its first field (the street, the first name), not every derived one.
    const reasons = [extra, updates.length === 0 ? doubt : null].filter(Boolean)
    const why = reasons.join(' ')
    const flag = why ? `${why.charAt(0).toUpperCase()}${why.slice(1)}${base.reasoning ? ` Model's note: ${base.reasoning}` : ''}` : null
    updates.push({ id, value, flag })
  }

  switch (name) {
    case 'set_name': {
      const n = splitName(str(first('first_name')), str(first('last_name')))
      if (n.first && grounded(`${n.first} ${n.last}`, clause, 1)) {
        put('first_name', n.first)
        put('middle_initial', n.middle)
        put('last_name', n.last)
      }
      break
    }
    case 'set_birth_date': {
      // The model sometimes splits a date into parts ("July 5th" + "1948"); read them together.
      const phrase = args.map((a) => str(a.date)).filter(Boolean).join(' ')
      const p = phrase ? parseDate(phrase, today, 'birth') : null
      if (p) {
        const age = (today.getTime() - p.date.getTime()) / (365.25 * 86_400_000)
        put('date_of_birth', displayDate(p.date), age < 18 || age > 110 ? `An age of ${Math.floor(age)} looks off.` : p.assumed)
      }
      break
    }
    case 'set_ssn': {
      const raw = str(first('ssn'))
      const v = formatSsn(raw)
      if (v && digitsGrounded(raw, clause)) put('ssn', v)
      break
    }
    case 'set_phone': {
      const raw = str(first('phone'))
      const v = formatPhone(raw)
      if (v && digitsGrounded(raw, clause)) put('phone', v)
      break
    }
    case 'set_email': {
      const v = str(first('email')).toLowerCase()
      if (v && clause.toLowerCase().includes(v)) put('email', v, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'That email looks malformed.')
      break
    }
    case 'set_contact_method': {
      const v = CONTACT[str(first('method'))]
      if (v && new RegExp(`\\b${str(first('method'))}`, 'i').test(clause)) put('preferred_contact', v)
      break
    }
    case 'set_current_address':
    case 'set_new_address': {
      const prefix = name === 'set_current_address' ? 'cur' : 'new'
      const rawStreet = str(first('street'))
      if (!rawStreet || !/\d/.test(rawStreet) || !grounded(rawStreet, clause)) break
      const { street, unit } = cleanStreet(rawStreet, clause)
      const city = cleanCity(str(first('city')) || undefined, clause)
      const state = stateFor(city, clause)
      put(`${prefix}_street`, street)
      put(`${prefix}_unit`, unit)
      put(`${prefix}_city`, city)
      put(`${prefix}_state`, state)
      if (prefix === 'cur') put('cur_zip', zipIn(clause))
      break
    }
    case 'set_tenure': {
      const v = { rent: 'rent', own: 'own', 'live with family': 'family' }[str(first('tenure'))]
      if (v) put('cur_tenure', v)
      break
    }
    case 'set_years_there':
    case 'set_years_employed': {
      const years = args.map((a) => Number(a.years)).find((n) => Number.isFinite(n) && numberGrounded(n, clause))
      if (years !== undefined) put(name === 'set_years_there' ? 'cur_years' : 'years_employed', String(years))
      break
    }
    case 'set_move_reason': {
      const reason = args.map((a) => str(a.reason)).find((r) => REASON_EVIDENCE[r]?.test(clause))
      if (reason) put('move_reason', REASON[reason])
      break
    }
    case 'set_move_in_date': {
      const phrase = args.map((a) => str(a.date)).filter(Boolean).join(' ')
      const p = phrase ? parseDate(phrase, today, 'future') : null
      if (p) {
        put('move_in_date', displayDate(p.date), p.assumed)
      } else {
        // The model leaves holidays blank ("around Thanksgiving"); a form rule reads the clause.
        const rule = parseDate(clause, today, 'future')
        if (rule) put('move_in_date', displayDate(rule.date), `The model left this blank, so a form rule read "${clause}" as ${rule.assumed ?? 'this date'}.`)
      }
      break
    }
    case 'set_lease_term': {
      const v = LEASE[str(first('term'))]
      if (v) put('lease_term', v)
      break
    }
    case 'set_job': {
      const employer = str(first('employer')).replace(/^@\s*/, '')
      const title = str(first('job_title'))
      if (employer && grounded(employer, clause, 1)) put('employer', titleCase(employer))
      if (title && grounded(title, clause, 1) && title.toLowerCase() !== employer.toLowerCase()) put('job_title', titleCase(title))
      break
    }
    case 'set_employment': {
      const v = STATUS[str(first('status'))]
      if (v) put('employment_status', v)
      break
    }
    case 'set_income': {
      const amount = args.map((a) => Number(a.amount)).find((n) => Number.isFinite(n) && n > 0 && numberGrounded(n, clause))
      if (amount === undefined) break
      const said = (str(first('period')) as Period) || periodIn(clause)
      const period: Period = said || (amount >= 12_000 ? 'year' : 'month')
      put('monthly_income', money.format(toMonthly(amount, period)), said ? null : `No period was given, so ${money.format(amount)} was read as per ${period}.`)
      break
    }
    case 'set_people': {
      const n = args.map((a) => Number(a.people)).find((x) => Number.isFinite(x) && numberGrounded(x, clause))
      if (n !== undefined) put('occupants', String(n))
      break
    }
    case 'set_pet': {
      const v = str(first('pet'))
      if (v && (v === 'other' || new RegExp(v === 'dog' ? '\\b(dogs?|pupp(y|ies))\\b' : '\\b(cats?|kittens?)\\b', 'i').test(clause))) put('pets', v)
      break
    }
    case 'set_smoking': {
      const v = first('smoker')
      if (typeof v === 'boolean') put('smoker', v ? 'yes' : 'no')
      break
    }
    case 'set_emergency_contact': {
      const nm = str(first('name'))
      if (nm && grounded(nm, clause, 1)) put('emergency_name', titleCase(nm))
      const rel = str(first('relationship')) || KIN.exec(clause)?.[1] || ''
      if (rel && grounded(rel, clause, 1) && rel.toLowerCase() !== nm.toLowerCase()) put('emergency_relation', titleCase(rel))
      const raw = str(first('phone'))
      const phone = formatPhone(raw)
      if (phone && digitsGrounded(raw, clause)) put('emergency_phone', phone)
      break
    }
  }
  return { ...base, held, updates, error: null }
}
