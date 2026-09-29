import { US_STATES, type FieldDef } from './schema'

// Model output is canonical (ISO dates, integers, enum values). The form shows
// what a person would write on paper. Validators are the second half of the
// confidence gate: grammar guarantees shape, these catch implausible values.

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}

const digits = (v: unknown) => String(v).replace(/\D/g, '')

export function toDisplay(field: FieldDef, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  switch (field.type) {
    case 'date': {
      const d = parseIsoDate(String(raw))
      if (!d) return String(raw)
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    }
    case 'money': {
      const n = Number(raw)
      return Number.isFinite(n) ? money.format(n) : String(raw)
    }
    case 'int': {
      const n = Number(raw)
      return Number.isFinite(n) ? String(Math.round(n)) : String(raw)
    }
    case 'phone': {
      const d = digits(raw)
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(raw)
    }
    case 'ssn': {
      const d = digits(raw)
      return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : String(raw)
    }
    case 'initial':
      return String(raw).trim().charAt(0).toUpperCase()
    default:
      return String(raw).trim()
  }
}

/** Returns a human reason when a value is implausible, else null. */
export function validate(field: FieldDef, raw: unknown, today: Date): string | null {
  const s = String(raw).trim()
  switch (field.type) {
    case 'date': {
      const d = parseIsoDate(s)
      if (!d) return 'That isn’t a real calendar date.'
      const days = (d.getTime() - startOfDay(today).getTime()) / 86_400_000
      if (field.id === 'date_of_birth') {
        const age = -days / 365.25
        if (age < 0) return 'Birth date is in the future.'
        if (age < 18) return 'Applicant would be under 18.'
        if (age > 110) return 'Over 110 years old? Double-check the year.'
      }
      if (field.id === 'move_in_date') {
        if (days < 0) return 'Move-in date is in the past.'
        if (days > 365) return 'Move-in is more than a year away.'
      }
      return null
    }
    case 'phone':
      return digits(s).length === 10 ? null : 'Doesn’t look like a 10-digit US number.'
    case 'ssn':
      return /^\d{3}-\d{2}-\d{4}$/.test(s) ? null : 'SSN should be 9 digits.'
    case 'zip':
      return /^\d{5}$/.test(s) ? null : 'ZIP should be 5 digits.'
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : 'That email looks malformed.'
    case 'initial':
      return /^[A-Za-z]$/.test(s) ? null : 'Middle initial should be one letter.'
    case 'int':
    case 'money': {
      const n = Number(raw)
      if (!Number.isFinite(n)) return 'Expected a number.'
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max))
        return 'Outside the expected range.'
      return null
    }
    case 'state':
      return (US_STATES as readonly string[]).includes(s) ? null : 'Not a US state code.'
    case 'select':
    case 'checks':
      return field.options!.some((o) => o.value === s) ? null : 'Not one of the listed options.'
    default:
      return s.length > 0 ? null : 'Empty value.'
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
