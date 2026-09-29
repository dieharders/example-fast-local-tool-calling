import { EXAMPLES, type ExampleId } from '../examples'
import { toIsoDate } from '../form/toolSchemas'
import type { FillEngine, NeedleEnvelope } from './types'

// A stand-in for Needle 3 so the UI can be designed before the WASM engine is wired.
// It returns the exact envelope shape Needle produces. The three examples get
// hand-written answers; anything else gets a crude regex pass.

const MODEL_BYTES = 35_335_380 // needle3.cact, 20 layers

interface Canned {
  args: Record<string, unknown>
  reasoning: string
  confidence: number
  ungrounded?: string[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

// ---- date helpers: the mock resolves relative dates from the system prompt's date, like the model must ----
function nextFirstOfMonth(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth() + 1, 1)
}
function nextOccurrence(month: number, day: number, today: Date): Date {
  const d = new Date(today.getFullYear(), month - 1, day)
  return d < today ? new Date(today.getFullYear() + 1, month - 1, day) : d
}
function thanksgiving(year: number): Date {
  const nov1 = new Date(year, 10, 1)
  const firstThu = 1 + ((4 - nov1.getDay() + 7) % 7)
  return new Date(year, 10, firstThu + 21)
}
function nextThanksgiving(today: Date): Date {
  const t = thanksgiving(today.getFullYear())
  return t < today ? thanksgiving(today.getFullYear() + 1) : t
}

const CANNED: Record<ExampleId, (today: Date) => Record<string, Canned>> = {
  maria: (today) => {
    const moveIn = toIsoDate(nextFirstOfMonth(today))
    return {
      applicant: {
        args: { first_name: 'Maria', last_name: 'Lopez', date_of_birth: '1991-03-04', ssn: '123-45-6789', phone: '(415) 555-0192' },
        reasoning:
          "'Maria Lopez' -> first_name, last_name; 'March 4th 91' -> date_of_birth 1991-03-04; " +
          "'415 555 0192' -> phone (415) 555-0192; 'SSN 123 45 6789' -> ssn 123-45-6789",
        confidence: 0.93,
      },
      current_home: {
        args: { cur_street: '12 Oak St', cur_city: 'San Francisco', cur_state: 'CA', cur_tenure: 'rent', cur_years: 6 },
        reasoning:
          "'12 Oak St' -> cur_street; 'SF' -> cur_city San Francisco, cur_state CA; " +
          "'renting my place 6 yrs' -> cur_tenure rent, cur_years 6",
        confidence: 0.88,
      },
      new_home: {
        args: { new_street: '440 Pine St', new_city: 'Oakland', new_state: 'CA', move_in_date: moveIn },
        reasoning:
          "'440 Pine' -> new_street 440 Pine St (suffix 'St' assumed); 'Oakland' -> new_city, new_state CA; " +
          `'on the 1st' -> move_in_date ${moveIn} (next 1st of the month)`,
        confidence: 0.71,
        ungrounded: ['new_street', 'move_in_date'],
      },
      employment: {
        args: { employer: 'Kaiser Permanente', job_title: 'Nurse', employment_status: 'full_time', monthly_income: 8000 },
        reasoning:
          "'Kaiser' -> employer Kaiser Permanente; 'a nurse' -> job_title Nurse; " +
          "'about 96k' -> monthly_income 8000 (96000 / 12); hours not stated -> employment_status full_time (guess)",
        confidence: 0.64,
        ungrounded: ['employment_status'],
      },
      household: {
        args: { occupants: 1, pets: 'dog' },
        reasoning: "'just me + my dog Pepper' -> occupants 1, pets dog",
        confidence: 0.9,
      },
    }
  },

  dev: (today) => {
    const moveIn = toIsoDate(nextOccurrence(11, 15, today))
    return {
      applicant: {
        args: {
          first_name: 'Dev',
          last_name: 'Patel',
          date_of_birth: '1998-11-22',
          phone: '(628) 555-0147',
          email: 'devp@example.com',
          preferred_contact: 'text',
        },
        reasoning:
          "'dev' -> first_name Dev (may be a nickname); 'patel' -> last_name Patel; 'dob 11/22/98' -> date_of_birth 1998-11-22; " +
          "'cell (628) 555-0147' -> phone; 'text me pls' -> preferred_contact text",
        confidence: 0.9,
        ungrounded: ['first_name'],
      },
      current_home: {
        args: {
          cur_street: '88 Mission St',
          cur_unit: 'Apt 4',
          cur_city: 'San Francisco',
          cur_state: 'CA',
          cur_zip: '94105',
          cur_tenure: 'rent',
          cur_years: 2,
          move_reason: 'lease_end',
        },
        reasoning:
          "'88 mission st apt 4' -> cur_street 88 Mission St, cur_unit Apt 4; 'sf 94105' -> cur_city San Francisco, cur_state CA, cur_zip 94105; " +
          "'been here 2 yrs' -> cur_years 2; 'the lease is up' -> cur_tenure rent, move_reason lease_end",
        confidence: 0.91,
      },
      new_home: {
        args: {
          new_street: '2100 Shattuck Ave',
          new_unit: '#3B',
          new_city: 'Berkeley',
          new_state: 'CA',
          move_in_date: moveIn,
          lease_term: '12',
        },
        reasoning:
          "'2100 Shattuck' -> new_street 2100 Shattuck Ave (suffix 'Ave' assumed); '#3B' -> new_unit; 'berkeley' -> new_city Berkeley, new_state CA; " +
          `'by nov 15th' -> move_in_date ${moveIn}; '12 mo lease' -> lease_term 12`,
        confidence: 0.86,
        ungrounded: ['new_street'],
      },
      employment: {
        args: {
          employer: 'Stripe',
          job_title: 'Software Engineer',
          employment_status: 'full_time',
          monthly_income: 11667,
          years_employed: 3,
        },
        reasoning:
          "'@ stripe' -> employer Stripe; 'software guy' -> job_title Software Engineer (inferred); " +
          "'~140k/yr' -> monthly_income 11667 (140000 / 12); '3 yrs, full time' -> years_employed 3, employment_status full_time",
        confidence: 0.83,
        ungrounded: ['job_title'],
      },
      household: {
        args: { occupants: 2, pets: 'cat', smoker: 'no' },
        reasoning: "'2 ppl' -> occupants 2; 'my cat mochi' -> pets cat; 'no smoking' -> smoker no",
        confidence: 0.92,
      },
    }
  },

  dorothy: (today) => {
    const moveIn = toIsoDate(nextThanksgiving(today))
    return {
      applicant: {
        args: {
          first_name: 'Dorothy',
          middle_initial: 'A',
          last_name: 'Whitfield',
          date_of_birth: '1948-07-05',
          phone: '(916) 555-0133',
        },
        reasoning:
          "'Dorothy Anne Whitfield' -> first_name, middle_initial A, last_name (spelled W-H-I-T-F-I-E-L-D); " +
          "'the fifth of July, nineteen forty-eight' -> date_of_birth 1948-07-05; " +
          "'nine one six, five five five, zero one three three' -> phone (916) 555-0133",
        confidence: 0.9,
      },
      current_home: {
        args: {
          cur_street: '1600 Maple Dr',
          cur_city: 'Sacramento',
          cur_state: 'CA',
          cur_tenure: 'own',
          cur_years: 31,
          move_reason: 'family',
        },
        reasoning:
          "'1600 Maple Drive' -> cur_street 1600 Maple Dr; 'Sacramento' -> cur_city, cur_state CA; " +
          "'thirty-one years' -> cur_years 31; 'we owned the house' -> cur_tenure own; 'closer to my daughter' -> move_reason family",
        confidence: 0.89,
      },
      new_home: {
        args: { new_street: '22 Harbor View Rd', new_unit: 'B', new_city: 'Santa Cruz', new_state: 'CA', move_in_date: moveIn },
        reasoning:
          "'22 Harbor View Road, unit B' -> new_street 22 Harbor View Rd, new_unit B; 'Santa Cruz' -> new_city, new_state CA; " +
          `'sometime around Thanksgiving' -> move_in_date ${moveIn} (approximate)`,
        confidence: 0.68,
        ungrounded: ['move_in_date'],
      },
      employment: {
        args: { job_title: 'Teacher', employment_status: 'retired' },
        reasoning: "'I'm retired' -> employment_status retired; 'I taught third grade' -> job_title Teacher (former job)",
        confidence: 0.77,
        ungrounded: ['job_title'],
      },
      household: {
        args: {
          occupants: 1,
          pets: 'dog',
          emergency_name: 'Susan Whitfield',
          emergency_relation: 'Daughter',
          emergency_phone: '(831) 555-0178',
        },
        reasoning:
          "'Just the two of us' -> occupants 1 (her + Biscuit the dog); 'Biscuit, my little dog' -> pets dog; " +
          "'my daughter Susan' -> emergency_name Susan Whitfield (surname assumed), emergency_relation Daughter; " +
          "'831-555-0178' -> emergency_phone (831) 555-0178",
        confidence: 0.74,
        ungrounded: ['occupants', 'emergency_name'],
      },
    }
  },
}

// ---- free-text fallback: deliberately crude, so it's obvious this isn't the model ----
function regexPass(tool: string, text: string): Canned {
  const args: Record<string, unknown> = {}
  const notes: string[] = []
  const hit = (field: string, value: unknown, src: string) => {
    args[field] = value
    notes.push(`'${src}' -> ${field}`)
  }
  const phoneRe = /\(?\b(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/
  if (tool === 'applicant') {
    const name = /\b(?:i'?m|i am|my name is|this is|name:?)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i.exec(text)
    if (name) {
      hit('first_name', cap(name[1]), name[1])
      hit('last_name', cap(name[2]), name[2])
    }
    const phone = phoneRe.exec(text)
    if (phone) hit('phone', `(${phone[1]}) ${phone[2]}-${phone[3]}`, phone[0])
    const email = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.exec(text)
    if (email) hit('email', email[0], email[0])
    const ssn = /\b(\d{3})[\s-](\d{2})[\s-](\d{4})\b/.exec(text)
    if (ssn) hit('ssn', `${ssn[1]}-${ssn[2]}-${ssn[3]}`, ssn[0])
    const dob = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/.exec(text)
    if (dob) {
      const y = dob[3].length === 2 ? (Number(dob[3]) > 30 ? 1900 : 2000) + Number(dob[3]) : Number(dob[3])
      hit('date_of_birth', `${y}-${dob[1].padStart(2, '0')}-${dob[2].padStart(2, '0')}`, dob[0])
    }
  }
  if (tool === 'current_home') {
    const zip = /\b\d{5}\b/.exec(text)
    if (zip) hit('cur_zip', zip[0], zip[0])
  }
  if (tool === 'employment') {
    const k = /\$?(\d{2,3})k\b/i.exec(text)
    if (k) hit('monthly_income', Math.round((Number(k[1]) * 1000) / 12), k[0])
    if (/\bretired\b/i.test(text)) hit('employment_status', 'retired', 'retired')
    else if (/\bstudent\b/i.test(text)) hit('employment_status', 'student', 'student')
  }
  if (tool === 'household') {
    if (/\b(dog|puppy)\b/i.test(text)) hit('pets', 'dog', 'dog')
    else if (/\b(cat|kitten)\b/i.test(text)) hit('pets', 'cat', 'cat')
    if (/\b(non[- ]?smok|no smok|don'?t smoke)/i.test(text)) hit('smoker', 'no', 'no smoking')
  }
  return {
    args,
    reasoning: notes.length ? `(mock regex) ${notes.join('; ')}` : '(mock regex) nothing matched',
    confidence: 0.5,
    ungrounded: Object.keys(args),
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

function todayFrom(systemPrompt: string): Date {
  const m = /date:\s*(\d{4})-(\d{2})-(\d{2})/.exec(systemPrompt)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date()
}

export function createMockEngine(): FillEngine {
  return {
    kind: 'mock',
    modelLabel: 'Needle 3 · 20 layers',
    runtimeLabel: 'CPU · WebAssembly',

    async load(onProgress) {
      onProgress({ stage: 'runtime', loaded: 0, total: MODEL_BYTES })
      await sleep(250)
      const steps = 24
      for (let i = 1; i <= steps; i++) {
        await sleep(rand(35, 75))
        onProgress({ stage: 'weights', loaded: Math.round((MODEL_BYTES * i) / steps), total: MODEL_BYTES })
      }
      onProgress({ stage: 'init', loaded: MODEL_BYTES, total: MODEL_BYTES })
      await sleep(200)
    },

    async complete({ systemPrompt, tools, input }) {
      const tool = tools[0]?.name ?? ''
      await sleep(rand(450, 850))
      const example = EXAMPLES.find((e) => norm(e.text) === norm(input))
      const canned = example ? CANNED[example.id](todayFrom(systemPrompt))[tool] : regexPass(tool, input)
      const envelope: NeedleEnvelope = {
        type: 'call',
        success: true,
        error: null,
        error_code: null,
        function_calls: [{ name: tool, arguments: canned.args }],
        suppressed_calls: [],
        reasoning: canned.reasoning,
        confidence: canned.confidence,
        validation: { ungrounded: (canned.ungrounded ?? []).map((f) => `${tool}.${f}`) },
        prefill_tps: Math.round(rand(2800, 3600)),
        decode_tps: Math.round(rand(380, 460)),
        peak_ram_mb: 88.5,
      }
      return envelope
    },
  }
}
