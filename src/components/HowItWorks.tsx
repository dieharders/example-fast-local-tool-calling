import type { CallResult } from '../extract/interpret'
import { TOOLS } from '../extract/tools'

const steps = [
  [
    'Your paragraph becomes short requests.',
    'It is cut into clauses like “phone 415 555 0192” or “moving from 12 Oak St SF”. Needle 3 is a 121M-parameter model trained on short commands, so one fact per request is what it reads best.',
  ],
  [
    'Each clause meets one tiny tool.',
    `The form is ${TOOLS.length} tiny tools (set_phone, set_birth_date, set_new_address…). A clause is sent only to the tools it mentions, one at a time, and Needle fills that tool's JSON under a grammar compiled from its schema. Every call is one-shot, on this device, in WebAssembly.`,
  ],
  [
    'Unsure? It says so.',
    'Anything the model held back, scored low, or that had to be assumed gets a yellow “check me”. Values that can’t be found in your words are dropped, not shown. Dates, phones and addresses are formatted by the form afterwards.',
  ],
]

export function HowItWorks({ calls }: { calls: CallResult[] }) {
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
          calls <span className="font-normal normal-case">(for nerds{calls.length ? `, ${calls.length} on file` : ''})</span>
        </summary>
        <div className="mt-3 grid gap-3 text-[#3b2a5c]">
          {calls.length === 0 && <p className="text-sm">Nothing on file yet. Fill the form first.</p>}
          {calls.map((c, i) => (
            <details key={i} className="bg-white/35 px-2 py-1.5">
              <summary className="cursor-pointer text-xs">
                <code className="font-bold">{c.tool}</code> ← “{c.clause}”{' '}
                <span className="opacity-70">
                  · {Math.round(c.confidence * 100)}%{c.held ? ' · held back' : ''} · {Math.round(c.ms)} ms
                </span>
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto text-[11px] leading-snug">
                {JSON.stringify(c.envelope ?? { error: c.error }, null, 2)}
              </pre>
            </details>
          ))}
          <details>
            <summary className="cursor-pointer text-xs font-bold uppercase">What the model sees: the {TOOLS.length} tool schemas</summary>
            <pre className="mt-1 max-h-96 overflow-auto bg-white/40 p-2 text-[11px] leading-snug">
              {JSON.stringify(TOOLS.map((t) => t.schema), null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </section>
  )
}
