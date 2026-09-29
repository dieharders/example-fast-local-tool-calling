import { FORM_SECTIONS, US_STATES, type FieldDef, type SectionDef } from './schema'

// Needle compiles a decoding grammar from these schemas, so the constraints below
// (format, pattern, enum, min/max) are what guarantee normalized output:
// dates come back as YYYY-MM-DD, phones as (415) 555-0192, dropdowns as valid options.

export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, Record<string, unknown>>
    required: string[]
  }
}

function fieldSchema(f: FieldDef): Record<string, unknown> {
  const description = f.desc
  switch (f.type) {
    case 'text':
      return { type: 'string', description }
    case 'initial':
      return { type: 'string', description, pattern: '^[A-Z]$' }
    case 'date':
      return { type: 'string', description, format: 'date' }
    case 'ssn':
      return { type: 'string', description, pattern: '^\\d{3}-\\d{2}-\\d{4}$' }
    case 'phone':
      return { type: 'string', description, pattern: '^\\(\\d{3}\\) \\d{3}-\\d{4}$' }
    case 'email':
      return { type: 'string', description, format: 'email' }
    case 'zip':
      return { type: 'string', description, pattern: '^\\d{5}$' }
    case 'state':
      return { type: 'string', description, enum: [...US_STATES] }
    case 'int':
    case 'money':
      return { type: 'integer', description, minimum: f.min ?? 0, maximum: f.max ?? 1000000 }
    case 'select':
    case 'checks':
      return { type: 'string', description, enum: f.options!.map((o) => o.value) }
  }
}

export function toToolSchema(section: SectionDef): ToolSchema {
  return {
    name: section.tool,
    description: section.toolDesc,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(section.fields.map((f) => [f.id, fieldSchema(f)])),
      // Everything optional: Needle omits arguments with no evidence instead of inventing them.
      required: [],
    },
  }
}

export const TOOL_SCHEMAS: Record<string, ToolSchema> = Object.fromEntries(
  FORM_SECTIONS.map((s) => [s.tool, toToolSchema(s)]),
)

/** Needle's system prompt is facts only; today's date lets it resolve "on the 1st". */
export function systemPrompt(today: Date): string {
  const iso = toIsoDate(today)
  const dow = today.toLocaleDateString('en-US', { weekday: 'short' })
  return `date: ${iso} ${dow}; locale: en-US`
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
