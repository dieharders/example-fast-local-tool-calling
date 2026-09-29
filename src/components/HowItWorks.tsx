import type { NeedleEnvelope } from '../engine'
import { FORM_SECTIONS } from '../form/schema'
import { TOOL_SCHEMAS } from '../form/toolSchemas'

const steps = [
  [
    'Every section is a tool.',
    'Each part of this form is a JSON schema: enums for the boxes and dropdowns, patterns for phone, SSN and ZIP, a date format for dates.',
  ],
  [
    'One tool call per section.',
    'Needle 3, a 20-layer model running in WebAssembly, reads your paragraph and writes one JSON call per section. Its decoder follows a grammar compiled from the schema, so the output always parses and every dropdown value is legal.',
  ],
  [
    'Unsure? It says so.',
    "Anything the model couldn't ground in your words, or that fails a sanity check, gets a yellow “check me”. Nothing ever leaves this tab.",
  ],
]

export function HowItWorks({ envelopes }: { envelopes: Record<string, NeedleEnvelope> }) {
  const calls = FORM_SECTIONS.filter((s) => envelopes[s.tool])
  return (
    <section className="mt-10 grid gap-5">
      <div className="paper -rotate-[0.3deg] px-5 py-5 sm:px-7">
        <h2 className="font-title text-xl tracking-wide uppercase">Instructions for Form RA-27B</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="text-sm leading-snug">
              <div className="font-bold uppercase">
                {i + 1}. {title}
              </div>
              <p className="mt-1 text-print/85">{body}</p>
            </li>
          ))}
        </ol>
      </div>

      <details className="group rotate-[0.25deg] bg-[#f1d6dc] px-5 py-3 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)] sm:px-7">
        <summary className="cursor-pointer list-none text-sm font-bold tracking-wider text-[#4a2d6b] uppercase">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span> Carbon copy: the raw tool
          calls <span className="font-normal normal-case">(for nerds)</span>
        </summary>
        <div className="mt-3 grid gap-4 text-[#3b2a5c]">
          {calls.length === 0 && <p className="text-sm">Nothing on file yet. Fill the form first.</p>}
          {calls.map((s) => (
            <div key={s.tool}>
              <div className="text-xs font-bold uppercase">
                Section {s.letter} → <code>{s.tool}</code>
              </div>
              <pre className="mt-1 max-h-72 overflow-auto bg-white/40 p-2 text-[11px] leading-snug">
                {JSON.stringify(envelopes[s.tool], null, 2)}
              </pre>
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-xs font-bold uppercase">What the model sees: the tool schemas</summary>
            <pre className="mt-1 max-h-96 overflow-auto bg-white/40 p-2 text-[11px] leading-snug">
              {JSON.stringify(Object.values(TOOL_SCHEMAS), null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </section>
  )
}
