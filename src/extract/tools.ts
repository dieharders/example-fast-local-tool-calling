import type { ToolSchema } from '../engine/types'

// The tool catalog Needle sees. Every tool is tiny (1-3 arguments) and is declared ALONE in its
// own one-shot call: the model is excellent at filling one small tool from a short clause and
// weak at choosing among many, so routing happens here with regex triggers (the same idea as
// Needle's own `triggers` field) and the model only ever fills values.
//
// Lessons from testing the 20-layer model (see the Phase 2 notes in the plan):
// - no `pattern`/`format` on free-text fields: forcing "(415) 555-0192" while the model wants to
//   copy "415 555 0192" stalls the decoder until the token budget runs out; format in app code
// - dates are requested "as written": with a date fact the engine re-anchors "11/22/98" to this
//   year, so birth dates get no date fact and the app parses the phrase
// - enum values are words people say ("lease is up", "full-time"), matched against the clause

export type Section = 'applicant' | 'current_home' | 'new_home' | 'employment' | 'household'

export interface ExtractTool {
  schema: ToolSchema
  section: Section
  /** Give the model today's date (to resolve "by nov 15th") or no facts at all. */
  sys: 'today' | 'none'
  /** Regex routing: does this clause mention what the tool records? */
  when: (clause: string, prev: string | undefined) => boolean
}

const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })
const int = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum })
const oneOf = (values: string[]) => ({ type: 'string', enum: values })

function tool(
  section: Section,
  name: string,
  description: string,
  properties: Record<string, Record<string, unknown>>,
  required: string[],
  when: ExtractTool['when'],
  sys: ExtractTool['sys'] = 'today',
): ExtractTool {
  return { section, sys, when, schema: { name, description, parameters: { type: 'object', properties, required } } }
}

const KIN = /\b(daughter|son|mom|mother|dad|father|wife|husband|partner|brother|sister|friend|emergency)\b/i
const STREET = /\b\d+\s+[a-z]+(\s+[a-z]+)?\s+(road|rd|street|st|avenue|ave|drive|dr|lane|ln|way|blvd|boulevard|court|ct|place|pl)\b/i
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*'
const ADDRESS = { street: str("Street address, e.g. '12 Oak St'"), city: str("City, e.g. 'Oakland'") }

export const TOOLS: ExtractTool[] = [
  // --- A. Applicant
  tool('applicant', 'set_name', "Record the applicant's name.", { first_name: str(), last_name: str() }, ['first_name'], (c) =>
    !KIN.test(c) &&
    /\b(my name is|name'?s|this is|i'?m|i am|its|it'?s)\s+(?!(moving|retired|a|an|the|just|looking|currently|renting|here|so|not|going|working|from|in|at|me)\b)[a-z]+\s+[a-z]+/i.test(c),
  ),
  tool('applicant', 'set_birth_date', "Record the applicant's date of birth.", { date: str("As written, e.g. 'March 4th 91'") }, ['date'],
    (c) => /\b(born|dob|d\.o\.b|birthday|date of birth)\b/i.test(c), 'none'),
  tool('applicant', 'set_ssn', "Record the applicant's Social Security number.", { ssn: str() }, ['ssn'], (c) => /\b(ssn|social security|social)\b/i.test(c)),
  tool('applicant', 'set_phone', "Record the applicant's phone number.", { phone: str() }, ['phone'],
    (c) => !KIN.test(c) && /(\b(phone|cell|mobile|number)\b|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i.test(c)),
  tool('applicant', 'set_email', "Record the applicant's email address.", { email: str() }, ['email'], (c) => /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}/i.test(c)),
  tool('applicant', 'set_contact_method', 'Record how the applicant wants to be contacted.', { method: oneOf(['call', 'text', 'email']) }, ['method'],
    (c) => /\b(text me|call me|email me|prefer (texts?|calls?|emails?))\b/i.test(c)),

  // --- B. Present address
  tool('current_home', 'set_current_address', 'Record the address the applicant lives at now.', ADDRESS, ['street'],
    (c) => /\b(currently at|currently in|i live at|living at|lived at|live in|moving from)\b/i.test(c)),
  tool('current_home', 'set_tenure', 'Record whether the applicant rents or owns now.', { tenure: oneOf(['rent', 'own', 'live with family']) }, ['tenure'],
    (c) => /\b(rent|renting|rented|own|owned|owner|mortgage)\b/i.test(c)),
  tool('current_home', 'set_years_there', 'Record how many years the applicant has lived at the current address.', { years: int(0, 99) }, ['years'],
    (c, prev) => /\b[\w-]+ (years|yrs)\b/i.test(c) && /\b(been here|lived|living|renting|rented|owned|live)\b/i.test(`${prev ?? ''} ${c}`) && !/(@|\bwork|\bjob|employ)/i.test(c)),
  tool('current_home', 'set_move_reason', 'Record why the applicant is moving.', { reason: oneOf(['new job', 'more space', 'downsizing', 'family', 'lease is up', 'other']) }, ['reason'],
    (c) => /\b(because|closer to|lease is up|lease ends|lease ending|new job|relocat\w*|more space|downsiz\w*)\b/i.test(c)),

  // --- C. Premises applied for
  tool('new_home', 'set_new_address', 'Record the address the applicant is moving to.', ADDRESS, ['street'],
    (c, prev) => /\b(to \d+|looking at|applying for|new place|moving into|move into)\b/i.test(c) || (STREET.test(c) && /\b(moving|move) to\b/i.test(prev ?? ''))),
  tool('new_home', 'set_move_in_date', 'Record when the applicant will move in.', { date: str("As written, e.g. 'on the 1st'") }, ['date'],
    (c) => new RegExp(`\\b(on the \\d+(st|nd|rd|th)?|by ${MONTH}|move in|moving in|around (thanksgiving|christmas|new year)|next month|starting)\\b`, 'i').test(c)),
  tool('new_home', 'set_lease_term', 'Record the lease length the applicant wants.', { term: oneOf(['month-to-month', '6 months', '12 months', '18 months', '24 months']) }, ['term'],
    (c) => /\blease\b/i.test(c) && /\b(month[- ]to[- ]month|\d+ ?(mo|months?)|\d+[- ]?years?)\b/i.test(c)),

  // --- D. Employment & income
  tool('employment', 'set_job', "Record the applicant's employer and job title.", { employer: str(), job_title: str() }, [],
    (c) => /\b(work at|work for|working at|job at|employer|nurse|engineer|teacher|developer|designer|manager)\b|(^|\s)@\s?[a-z]+/i.test(c)),
  tool('employment', 'set_employment', "Record the applicant's employment status.", { status: oneOf(['full-time', 'part-time', 'self-employed', 'student', 'retired', 'unemployed']) }, ['status'],
    (c) => /\b(full[- ]?time|part[- ]?time|self[- ]?employed|freelanc\w*|student|retired|unemployed)\b/i.test(c)),
  tool('employment', 'set_years_employed', 'Record how many years the applicant has worked at the job.', { years: int(0, 70) }, ['years'],
    (c, prev) => /\b\d+ (years|yrs)\b/i.test(c) && /(@|\bwork|\bjob|employ)/i.test(`${prev ?? ''} ${c}`) && !/\b(been here|lived|living|renting)\b/i.test(c)),
  tool('employment', 'set_income', "Record the applicant's income as stated.", { amount: { type: 'number', minimum: 0, maximum: 10000000 }, period: oneOf(['year', 'month', 'week', 'hour']) }, ['amount'],
    (c) => /\b(make|making|earn|earning|salary|income)\b|\d+k\b|\$\d/i.test(c)),

  // --- E. Household
  tool('household', 'set_people', 'Record how many people will live in the home, including the applicant.', { people: int(1, 20) }, ['people'],
    (c) => /\b(ppl|people|persons?|roommates?|of us|kids?)\b/i.test(c)),
  tool('household', 'set_pet', 'Record the pet moving in.', { pet: oneOf(['dog', 'cat', 'other']) }, ['pet'], (c) => /\b(dogs?|cats?|pets?|puppy|kitten|bird|fish)\b/i.test(c)),
  tool('household', 'set_smoking', 'Record whether anyone will smoke.', { smoker: { type: 'boolean' } }, ['smoker'], (c) => /\b(smok\w*|vape|vaping)\b/i.test(c)),
  tool('household', 'set_emergency_contact', "Record the applicant's emergency contact.", { name: str(), relationship: str("e.g. 'daughter'"), phone: str() }, ['name'],
    (c) => /\b(emergency|in case)\b/i.test(c)),
]

export const TRIGGERS = TOOLS.map((t) => t.when)
export const toolByName = (name: string) => TOOLS.find((t) => t.schema.name === name)
