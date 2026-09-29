// Deterministic clean-up of what the model copied out of the text. The model finds the value
// ("415 555 0192", "March 4th 91", "88 marigold st apt 4"); this file formats it for the form.

// ---------- system prompt ----------
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Needle's system prompt is facts only; today's date lets it resolve "by nov 15th". */
export function systemPrompt(today: Date): string {
  return `date: ${toIsoDate(today)} ${today.toLocaleDateString('en-US', { weekday: 'short' })}; locale: en-US`
}

// ---------- text ----------
const SMALL = new Set(['of', 'and', 'the', 'de', 'la', 'van', 'von'])
export function titleCase(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t
  return t
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? []

/** Is a copied string actually in the clause? (the model must not invent text) */
export function grounded(value: string, clause: string, share = 0.6): boolean {
  const have = new Set(tokens(clause))
  const want = tokens(value).filter((t) => t.length > 1 || /\d/.test(t))
  if (want.length === 0) return false
  const hits = want.filter((t) => have.has(t)).length
  return hits / want.length >= share
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
}

/** Only a whole number or a number word counts as evidence (Needle's own rule). */
export function numberGrounded(n: number, clause: string): boolean {
  const c = clause.toLowerCase().replace(/,/g, '')
  if (new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(c)) return true
  if (n % 1000 === 0 && new RegExp(`(^|[^\\d])${n / 1000}\\s?k\\b`).test(c)) return true
  return Object.entries(NUMBER_WORDS).some(([w, v]) => v === n && new RegExp(`\\b${w}\\b`).test(c))
}

// ---------- phone / SSN / email ----------
export function formatPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null
}

export function formatSsn(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : null
}

/** Digits of a phone/SSN must appear in the clause's digits. */
export function digitsGrounded(raw: string, clause: string): boolean {
  const d = raw.replace(/\D/g, '')
  return d.length >= 7 && clause.replace(/\D/g, '').includes(d.slice(-7))
}

// ---------- names ----------
const INTRO = /^(it'?s|its|i'?m|im|i am|this is|my name is|name'?s)\s+/i
export function splitName(first: string, last: string): { first: string; middle: string; last: string } {
  const words = `${first.replace(INTRO, '')} ${last}`.trim().split(/\s+/).filter(Boolean).map(titleCase)
  if (words.length >= 3) return { first: words[0], middle: words[1].charAt(0).toUpperCase(), last: words.slice(2).join(' ') }
  return { first: words[0] ?? '', middle: '', last: words[1] ?? '' }
}

// ---------- addresses ----------
const UNIT_TAIL = /(?:,\s*|\s+)((?:apt|apartment|unit|suite|ste)\.?\s*#?\s*[a-z0-9-]+|#\s*[a-z0-9-]+)\s*$/i
const UNIT_ANY = /\b(?:apt|apartment|unit|suite|ste)\.?\s*#?\s*([a-z0-9-]+)\b|#\s*([a-z0-9-]+)/i

function prettyUnit(u: string): string {
  const m = /^(apt|apartment|unit|suite|ste)\.?\s*#?\s*(.+)$/i.exec(u.trim())
  if (m) return `${m[1].toLowerCase().startsWith('apt') || m[1].toLowerCase() === 'apartment' ? 'Apt' : titleCase(m[1])} ${m[2].toUpperCase()}`
  return u.trim().replace(/^#\s*/, '#').toUpperCase()
}

/** "88 marigold st apt 4" → { street: "88 Marigold St", unit: "Apt 4" }; "440 Pine in Oakland" → "440 Pine". */
export function cleanStreet(street: string, clause: string): { street: string; unit: string } {
  let s = street.replace(/\s+in\s+[a-z].*$/i, '').replace(/,\s*[a-z\s]+$/i, '').trim()
  let unit = ''
  const tail = UNIT_TAIL.exec(s)
  if (tail) {
    unit = prettyUnit(tail[1])
    s = s.slice(0, tail.index).trim()
  } else {
    const any = UNIT_ANY.exec(clause)
    if (any) unit = prettyUnit(any[0])
  }
  return { street: titleCase(s), unit }
}

const CITY_ALIAS: Record<string, string> = {
  sf: 'San Francisco', 'san fran': 'San Francisco', frisco: 'San Francisco', la: 'Los Angeles', nyc: 'New York',
  philly: 'Philadelphia', vegas: 'Las Vegas', dc: 'Washington', atl: 'Atlanta', chi: 'Chicago', nola: 'New Orleans',
}

const CITY_STATE: Record<string, string> = {
  'san francisco': 'CA', oakland: 'CA', berkeley: 'CA', sacramento: 'CA', 'santa cruz': 'CA', 'san jose': 'CA',
  'los angeles': 'CA', 'san diego': 'CA', 'palo alto': 'CA', fremont: 'CA', 'long beach': 'CA', irvine: 'CA',
  seattle: 'WA', portland: 'OR', denver: 'CO', austin: 'TX', houston: 'TX', dallas: 'TX', 'san antonio': 'TX',
  chicago: 'IL', boston: 'MA', 'new york': 'NY', brooklyn: 'NY', miami: 'FL', orlando: 'FL', atlanta: 'GA',
  phoenix: 'AZ', philadelphia: 'PA', pittsburgh: 'PA', washington: 'DC', 'las vegas': 'NV', nashville: 'TN',
  minneapolis: 'MN', detroit: 'MI', 'salt lake city': 'UT', 'new orleans': 'LA', baltimore: 'MD', charlotte: 'NC',
}

const STATE_CODE =
  /\b(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY])\b/

/** City from the model (or a known alias in the clause), expanded and title-cased. */
export function cleanCity(city: string | undefined, clause: string): string {
  // The model sometimes copies the ZIP along with the city ("sf 94105"); zipIn() reads it separately.
  const raw = (city ?? '').replace(/\s*\d{5}(-\d{4})?$/, '').trim()
  const alias = CITY_ALIAS[raw.toLowerCase()]
  if (alias) return alias
  if (raw) return titleCase(raw)
  for (const [k, v] of Object.entries(CITY_ALIAS)) if (new RegExp(`\\b${k}\\b`, 'i').test(clause)) return v
  const named = /\bin ([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/.exec(clause)
  return named ? named[1] : ''
}

/** Two-letter state: written in the clause (uppercase), else looked up from a well-known city. */
export function stateFor(city: string, clause: string): string {
  const written = STATE_CODE.exec(clause)
  if (written) return written[1]
  return CITY_STATE[city.toLowerCase()] ?? ''
}

export function zipIn(clause: string): string {
  return /(?<![\d-])\d{5}(?![\d-])/.exec(clause)?.[0] ?? ''
}

// ---------- money ----------
export type Period = 'year' | 'month' | 'week' | 'hour'
export function periodIn(clause: string): Period | null {
  const c = clause.toLowerCase()
  if (/(\/\s?y(ea)?r|a year|per year|annual|yearly|salary)/.test(c)) return 'year'
  if (/(\/\s?mo|a month|per month|monthly)/.test(c)) return 'month'
  if (/(\/\s?hr|an hour|per hour|hourly)/.test(c)) return 'hour'
  if (/(\/\s?wk|a week|per week|weekly)/.test(c)) return 'week'
  return null
}
export function toMonthly(amount: number, period: Period): number {
  const perYear = { year: 1, month: 12, week: 52, hour: 2080 }[period]
  return Math.round((amount * perYear) / 12)
}
export const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// ---------- dates ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const monthIndex = (m: string) => MONTHS.indexOf(m.slice(0, 3).toLowerCase())

function thanksgiving(year: number): Date {
  const nov1 = new Date(year, 10, 1)
  return new Date(year, 10, 1 + ((4 - nov1.getDay() + 7) % 7) + 21)
}

export interface ParsedDate {
  date: Date
  /** Set when the parser had to assume something the text didn't say. */
  assumed: string | null
}

export const displayDate = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`

/**
 * Parse a date phrase as written. `kind` decides missing/short years: birth dates reach back
 * ("91" → 1991), move-in dates look forward ("the 1st" → the next 1st).
 */
export function parseDate(raw: string, today: Date, kind: 'birth' | 'future'): ParsedDate | null {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const s = raw.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim()
  let assumed: string | null = null

  const year = (y: string | undefined, m: number, d: number): number | null => {
    if (y && y.length === 4) return Number(y)
    if (y && y.length === 2) {
      const n = Number(y)
      const full = kind === 'birth' ? (2000 + n <= t0.getFullYear() - 16 ? 2000 + n : 1900 + n) : 2000 + n
      assumed = `'${y}' read as ${full}`
      return full
    }
    if (kind === 'birth') return null
    const thisYear = new Date(t0.getFullYear(), m, d)
    return thisYear < t0 ? t0.getFullYear() + 1 : t0.getFullYear()
  }
  const make = (y: number | null, m: number, d: number): ParsedDate | null => {
    if (y === null || m < 0 || m > 11 || d < 1 || d > 31) return null
    const date = new Date(y, m, d)
    return date.getMonth() === m ? { date, assumed } : null
  }

  let m: RegExpExecArray | null
  if ((m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s))) {
    const iso = make(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    // The engine resolves a bare day ("the 1st") into the current month even if that's past.
    if (iso && kind === 'future' && iso.date < t0) {
      const next = new Date(iso.date.getFullYear(), iso.date.getMonth() + 1, iso.date.getDate())
      return { date: next, assumed: 'that date had already passed, so the next month was assumed' }
    }
    return iso
  }
  if ((m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(s))) return make(year(m[3], Number(m[1]) - 1, Number(m[2])), Number(m[1]) - 1, Number(m[2]))
  if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:\s+(\d{4}|\d{2}))?\b/.exec(s)))
    return make(year(m[3], monthIndex(m[1]), Number(m[2])), monthIndex(m[1]), Number(m[2]))
  if ((m = /\b(\d{1,2})\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}|\d{2}))?\b/.exec(s)))
    return make(year(m[3], monthIndex(m[2]), Number(m[1])), monthIndex(m[2]), Number(m[1]))
  if (kind === 'future') {
    if (/thanksgiving/.test(s)) {
      const tg = thanksgiving(t0.getFullYear())
      return { date: tg < t0 ? thanksgiving(t0.getFullYear() + 1) : tg, assumed: 'Thanksgiving, taken as the holiday itself' }
    }
    if (/christmas/.test(s)) return { date: new Date(t0.getFullYear() + (t0.getMonth() === 11 && t0.getDate() > 25 ? 1 : 0), 11, 25), assumed: 'Christmas Day' }
    if (/new year/.test(s)) return { date: new Date(t0.getFullYear() + 1, 0, 1), assumed: "New Year's Day" }
    if (/next month/.test(s)) return { date: new Date(t0.getFullYear(), t0.getMonth() + 1, 1), assumed: 'the 1st of next month' }
    if ((m = /\b(?:the\s+)?(\d{1,2})\b/.exec(s))) {
      const d = Number(m[1])
      let date = new Date(t0.getFullYear(), t0.getMonth(), d)
      if (date <= t0) date = new Date(t0.getFullYear(), t0.getMonth() + 1, d)
      return d >= 1 && d <= 31 ? { date, assumed: `the next ${m[1]}${ordinal(d)} of the month` } : null
    }
  }
  return null
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}
