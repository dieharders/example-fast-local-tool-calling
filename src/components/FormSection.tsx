import type { SectionView } from '../hooks/useFormFiller'
import type { SectionDef } from '../form/schema'
import { CheckMeTag } from './CheckMeTag'
import { Field } from './Field'

interface Props {
  section: SectionDef
  view: SectionView
  values: Record<string, string>
  flags: Record<string, string>
  active: string | null
  onChange: (id: string, value: string) => void
}

function Status({ view }: { view: SectionView }) {
  if (view.status === 'reading')
    return <span className="animate-pulse text-[10px] tracking-widest text-paper/80 uppercase">clerk is reading…</span>
  if (view.status === 'queued' || view.status === 'typing')
    return <span className="text-[10px] tracking-widest text-paper/80 uppercase">filling in…</span>
  if (view.status === 'done' && view.error)
    return <span className="text-[10px] tracking-widest text-postit uppercase">clerk got confused</span>
  if (view.status === 'done' && view.confidence !== undefined) {
    const pct = Math.round(view.confidence * 100)
    return (
      <span
        title="Needle's calibrated confidence for this section's tool call"
        className={`animate-pop shrink-0 border-2 bg-paper px-1.5 py-px text-[11px] font-bold tracking-wider whitespace-nowrap uppercase [--tilt:-3deg] ${
          view.lowConfidence ? 'border-[#b27a00] text-[#9a6700]' : 'border-[#2e7d32] text-[#2e7d32]'
        }`}
      >
        {pct}% sure
      </span>
    )
  }
  return null
}

export function FormSection({ section, view, values, flags, active, onChange }: Props) {
  const done = view.status === 'done'
  return (
    <section className="mt-8 first:mt-6">
      <div className="relative flex min-h-7 items-center justify-between gap-2 bg-print px-2.5 py-1 text-paper sm:px-3">
        <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase sm:text-[13px]">
          Section {section.letter} — {section.title}
        </h2>
        <Status view={view} />
        {done && view.lowConfidence && !view.error && (
          <CheckMeTag
            label="check this section"
            reason={`The model was only ${Math.round((view.confidence ?? 0) * 100)}% confident about this section overall. Give every field here a glance.`}
            className="-top-3.5 right-24 sm:right-28"
          />
        )}
      </div>
      {done && (view.notes || view.error) && (
        <p className="animate-pencil mt-1.5 font-hand text-[1.05rem] leading-snug text-pencil">
          <span className="font-bold">✎ Clerk’s notes:</span> {view.error ?? view.notes}
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
