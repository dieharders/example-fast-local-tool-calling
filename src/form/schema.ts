// Single source of truth for the rental application. The UI renders from this,
// and toolSchemas.ts derives one Needle tool per section from it.

export type FieldType =
  | 'text'
  | 'initial'
  | 'date'
  | 'ssn'
  | 'phone'
  | 'email'
  | 'zip'
  | 'state'
  | 'int'
  | 'money'
  | 'select'
  | 'checks'

export interface Option {
  value: string
  label: string
}

export interface FieldDef {
  /** Argument name in the tool schema; also the form state key. */
  id: string
  /** Printed field number, e.g. "1a". */
  num: string
  label: string
  type: FieldType
  /** Terse description for the model (schema trimming: keep these short). */
  desc: string
  options?: Option[]
  min?: number
  max?: number
  /** Grid columns out of 12: [mobile, desktop]. */
  span: [number, number]
  /** Shows the "stays on this device" lock badge. */
  sensitive?: boolean
}

export interface SectionDef {
  tool: string
  letter: string
  title: string
  toolDesc: string
  fields: FieldDef[]
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))

export const FORM_SECTIONS: SectionDef[] = [
  {
    tool: 'applicant',
    letter: 'A',
    title: 'Applicant',
    toolDesc: "Record the applicant's identity and contact details.",
    fields: [
      { id: 'first_name', num: '1a', label: 'First name', type: 'text', desc: 'Given name', span: [9, 5] },
      { id: 'middle_initial', num: '1b', label: 'M.I.', type: 'initial', desc: 'Middle initial, one capital letter', span: [3, 2] },
      { id: 'last_name', num: '1c', label: 'Last name', type: 'text', desc: 'Family name, correctly capitalized', span: [12, 5] },
      { id: 'date_of_birth', num: '2', label: 'Date of birth', type: 'date', desc: 'Birth date', span: [6, 4] },
      { id: 'ssn', num: '3', label: 'Social Security No.', type: 'ssn', desc: 'SSN', span: [6, 4], sensitive: true },
      { id: 'phone', num: '4', label: 'Phone', type: 'phone', desc: "Applicant's own phone", span: [12, 4] },
      { id: 'email', num: '5', label: 'Email', type: 'email', desc: 'Email address', span: [12, 7] },
      {
        id: 'preferred_contact',
        num: '6',
        label: 'Preferred contact',
        type: 'select',
        desc: 'How they want to be contacted',
        options: opts([['phone', 'Phone call'], ['text', 'Text message'], ['email', 'Email']]),
        span: [12, 5],
      },
    ],
  },
  {
    tool: 'current_home',
    letter: 'B',
    title: 'Present address',
    toolDesc: 'Record where the applicant lives now.',
    fields: [
      { id: 'cur_street', num: '7a', label: 'Street address', type: 'text', desc: 'Current street, abbreviated (St, Ave, Dr)', span: [8, 8] },
      { id: 'cur_unit', num: '7b', label: 'Apt / unit', type: 'text', desc: 'Current unit', span: [4, 4] },
      { id: 'cur_city', num: '7c', label: 'City', type: 'text', desc: 'Current city, full name', span: [12, 5] },
      { id: 'cur_state', num: '7d', label: 'State', type: 'state', desc: 'Current state', span: [5, 3] },
      { id: 'cur_zip', num: '7e', label: 'ZIP', type: 'zip', desc: 'Current ZIP', span: [7, 4] },
      {
        id: 'cur_tenure',
        num: '8',
        label: 'Do you rent or own?',
        type: 'checks',
        desc: 'Current housing',
        options: opts([['rent', 'Rent'], ['own', 'Own'], ['family', 'Live w/ family']]),
        span: [12, 8],
      },
      { id: 'cur_years', num: '9', label: 'Years at address', type: 'int', desc: 'Years at current address', min: 0, max: 99, span: [12, 4] },
      {
        id: 'move_reason',
        num: '10',
        label: 'Reason for moving',
        type: 'select',
        desc: 'Why they are moving',
        options: opts([
          ['work', 'Job / relocation'],
          ['space', 'Need more space'],
          ['downsize', 'Downsizing'],
          ['family', 'Closer to family'],
          ['lease_end', 'Lease ending'],
          ['other', 'Other'],
        ]),
        span: [12, 12],
      },
    ],
  },
  {
    tool: 'new_home',
    letter: 'C',
    title: 'Premises applied for',
    toolDesc: 'Record the home the applicant is moving into.',
    fields: [
      { id: 'new_street', num: '11a', label: 'Street address', type: 'text', desc: 'New street, abbreviated (St, Ave, Rd)', span: [8, 8] },
      { id: 'new_unit', num: '11b', label: 'Apt / unit', type: 'text', desc: 'New unit', span: [4, 4] },
      { id: 'new_city', num: '11c', label: 'City', type: 'text', desc: 'New city, full name', span: [12, 5] },
      { id: 'new_state', num: '11d', label: 'State', type: 'state', desc: 'New state', span: [5, 3] },
      { id: 'move_in_date', num: '12', label: 'Move-in date', type: 'date', desc: 'Move-in date; resolve relative dates from today', span: [7, 4] },
      {
        id: 'lease_term',
        num: '13',
        label: 'Lease term',
        type: 'checks',
        desc: 'Requested lease length',
        options: opts([['m2m', 'Month-to-month'], ['6', '6 mo'], ['12', '12 mo'], ['18', '18 mo'], ['24', '24 mo']]),
        span: [12, 12],
      },
    ],
  },
  {
    tool: 'employment',
    letter: 'D',
    title: 'Employment & income',
    toolDesc: "Record the applicant's job and income.",
    fields: [
      { id: 'employer', num: '14', label: 'Employer', type: 'text', desc: 'Employer name', span: [12, 6] },
      { id: 'job_title', num: '15', label: 'Position / title', type: 'text', desc: 'Job title, title case', span: [12, 6] },
      {
        id: 'employment_status',
        num: '16',
        label: 'Employment status',
        type: 'checks',
        desc: 'Employment status',
        options: opts([
          ['full_time', 'Full-time'],
          ['part_time', 'Part-time'],
          ['self_employed', 'Self-employed'],
          ['student', 'Student'],
          ['retired', 'Retired'],
          ['unemployed', 'Unemployed'],
        ]),
        span: [12, 12],
      },
      { id: 'monthly_income', num: '17', label: 'Gross monthly income', type: 'money', desc: 'USD per month; convert yearly', min: 0, max: 1000000, span: [6, 6] },
      { id: 'years_employed', num: '18', label: 'Years employed', type: 'int', desc: 'Years at this employer', min: 0, max: 70, span: [6, 6] },
    ],
  },
  {
    tool: 'household',
    letter: 'E',
    title: 'Household',
    toolDesc: 'Record who and what will live in the home.',
    fields: [
      { id: 'occupants', num: '19', label: 'Total occupants', type: 'int', desc: 'People living there, incl. applicant', min: 1, max: 20, span: [12, 3] },
      {
        id: 'pets',
        num: '20',
        label: 'Pets',
        type: 'checks',
        desc: 'Pet type',
        options: opts([['none', 'None'], ['dog', 'Dog'], ['cat', 'Cat'], ['other', 'Other']]),
        span: [12, 6],
      },
      {
        id: 'smoker',
        num: '21',
        label: 'Smoker?',
        type: 'checks',
        desc: 'Does anyone smoke',
        options: opts([['no', 'No'], ['yes', 'Yes']]),
        span: [12, 3],
      },
      { id: 'emergency_name', num: '22a', label: 'Emergency contact', type: 'text', desc: 'Emergency contact full name', span: [12, 5] },
      { id: 'emergency_relation', num: '22b', label: 'Relationship', type: 'text', desc: 'Relationship to applicant', span: [5, 3] },
      { id: 'emergency_phone', num: '22c', label: 'Their phone', type: 'phone', desc: "Emergency contact's phone", span: [7, 4] },
    ],
  },
]

export const ALL_FIELDS: FieldDef[] = FORM_SECTIONS.flatMap((s) => s.fields)
export const TOTAL_FIELDS = ALL_FIELDS.length

export const fieldDomId = (id: string) => `field-${id}`
