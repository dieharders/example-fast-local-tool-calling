import type { SectionDef } from '../form/schema'
import type { Phase, SectionView } from '../hooks/useFormFiller'
import { CheckMeTag } from './CheckMeTag'
import { Field } from './Field'

/** Below this average confidence the whole section gets a "check this section" note. */
const SECTION_REVIEW = 0.15

interface Props {
  section: SectionDef
  view: SectionView
  phase: Phase
  values: Record<string, string>
  flags: Record<string, string>
  active: string | null
  onChange: (id: string, value: string) => void
}

function Status({ view, phase }: { view: SectionView; phase: Phase }) {
  const tag = 'text-[10px] tracking-widest text-paper/80 uppercase'
  if (view.status === 'reading') return <span className={`animate-pulse ${tag}`}>clerk is reading…</span>
  if (view.status === 'typing') return <span className={tag}>filling in…</span>
  if (view.status === 'idle' && phase === 'done') return <span className={`${tag} text-paper/50`}>not mentioned</span>
  if (view.status === 'done' && view.confidence !== undefined) {
    const pct = Math.round(view.confidence * 100)
    const tone =
      view.confidence >= 0.5
        ? 'border-[#2e7d32] text-[#2e7d32]'
        : view.confidence < SECTION_REVIEW
          ? 'border-[#b27a00] text-[#9a6700]'
          : 'border-ink text-ink'
    return (
      <span
        title={`Average calibrated confidence of this section's ${view.finished} tool call${view.finished === 1 ? '' : 's'}`}
        className={`animate-pop shrink-0 border-2 bg-paper px-1.5 py-px text-[11px] font-bold tracking-wider whitespace-nowrap uppercase [--tilt:-3deg] ${tone}`}
      >
        {pct}% sure
      </span>
    )
  }
  return null
}

export function FormSection({ section, view, phase, values, flags, active, onChange }: Props) {
  const done = view.status === 'done'
  const low = done && view.confidence !== undefined && view.confidence < SECTION_REVIEW
  return (
    <section className="mt-8 first:mt-6">
      <div className="relative flex min-h-7 items-center justify-between gap-2 bg-print px-2.5 py-1 text-paper sm:px-3">
        <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase sm:text-[13px]">
          Section {section.letter} — {section.title}
        </h2>
        <Status view={view} phase={phase} />
        {low && (
          <CheckMeTag
            label="check this section"
            reason={`Across its ${view.finished} tool call${view.finished === 1 ? '' : 's'}, the model averaged only ${Math.round((view.confidence ?? 0) * 100)}% confidence here. Give every field a glance.`}
            className="-top-3.5 right-24 sm:right-28"
          />
        )}
      </div>
      {done && view.notes.length > 0 && (
        <p className="animate-pencil mt-1.5 font-hand text-[1.05rem] leading-snug text-pencil">
          <span className="font-bold">✎ Clerk’s notes:</span> {view.notes.map((n) => n.replace(/\s*->\s*/g, ' → ')).join(' · ')}
        </p>
      )}
      <div className="mt-3 grid grid-cols-12 gap-x-3 gap-y-4 sm:gap-x-5">
        {section.fields.map((f) => (
          <Field
            key={f.id}
            field={f}
            value={values[f.id] ?? ''}
            flag={flags[f.id]}
            active={active === f.id}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  )
}
