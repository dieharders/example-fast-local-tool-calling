import { forwardRef } from 'react'
import { FORM_SECTIONS } from '../form/schema'
import type { FillStats, Phase, SectionView } from '../hooks/useFormFiller'
import { ApprovedStamp } from './ApprovedStamp'
import { FormSection } from './FormSection'

interface Props {
  phase: Phase
  values: Record<string, string>
  flags: Record<string, string>
  verified: Record<string, true>
  sections: Record<string, SectionView>
  active: string | null
  stats: FillStats | null
  shredding: boolean
  onChange: (id: string, value: string) => void
  onConfirm: (id: string) => void
  onConfirmSection: (section: string) => void
}

export const PaperForm = forwardRef<HTMLElement, Props>(function PaperForm(
  { phase, values, flags, verified, sections, active, stats, shredding, onChange, onConfirm, onConfirmSection },
  ref,
) {
  const done = phase === 'done' && stats
  return (
    <article
      ref={ref}
      aria-label="Residential lease application form"
      className={`paper relative scroll-mt-4 rounded-[2px] px-4 pt-7 pb-8 sm:px-10 sm:pt-9 sm:pb-10 lg:rotate-[-0.35deg] ${
        done ? 'animate-shake' : ''
      }`}
    >
      {/* staple + punch holes */}
      <span aria-hidden className="absolute -top-0.5 left-7 h-1.5 w-14 -rotate-6 rounded-full bg-linear-to-b from-zinc-200 to-zinc-500 shadow-[0_1px_1px_rgb(0_0_0/0.4)]" />
      {['top-[14%]', 'top-1/2', 'top-[86%]'].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`absolute left-1.5 hidden size-3.5 -translate-y-1/2 rounded-full bg-desk shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)] sm:left-3 sm:block ${pos}`}
        />
      ))}

      <div className={shredding ? 'animate-shred' : ''}>
        {/* letterhead */}
        <header className="border-2 border-print">
          <div className="flex items-start justify-between gap-3 border-b-2 border-print px-3 py-2">
            <div>
              <div className="text-[10px] tracking-[0.25em] uppercase">Dept. of Paperwork · Housing Div.</div>
              <div className="font-title text-2xl leading-tight uppercase sm:text-3xl">Residential lease application</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold sm:text-base">FORM RA-27B</div>
              <div className="text-[10px]">(REV. 03/87)</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto]">
            <p className="px-3 py-2 text-[10px] leading-snug uppercase sm:text-[10.5px]">
              Please print clearly in block capitals. Use blue or black ink. Incomplete applications will be returned
              without processing. Do not fold, spindle, or mutilate.
            </p>
            <div className="border-t-2 border-print px-3 py-1.5 text-[10px] uppercase sm:min-w-44 sm:border-t-0 sm:border-l-2">
              <div className="font-bold tracking-wider">For office use only</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                Clerk: <span className="font-type text-sm text-ink normal-case">{done ? `Needle-3 · ${stats.calls} calls` : ''}</span>
              </div>
              <div className="flex items-baseline gap-1">
                Processed: <span className="font-type text-sm text-ink normal-case">{done ? `${(stats.inferenceMs / 1000).toFixed(1)} s` : ''}</span>
              </div>
            </div>
          </div>
        </header>

        {FORM_SECTIONS.map((s) => (
          <FormSection
            key={s.tool}
            section={s}
            view={sections[s.tool]}
            phase={phase}
            values={values}
            flags={flags}
            verified={verified}
            active={active}
            onChange={onChange}
            onConfirm={onConfirm}
            onConfirmSection={onConfirmSection}
          />
        ))}

        {/* certification */}
        <div className="mt-9 grid grid-cols-12 gap-x-5 gap-y-4">
          <p className="col-span-12 text-[10.5px] leading-snug uppercase">
            I certify that the information above is true and complete to the best of my knowledge, and I authorize
            verification of same.
          </p>
          <div className="col-span-12 sm:col-span-8">
            <div className="field-line relative h-10">
              <span className="absolute bottom-0.5 left-1 font-hand text-xl text-pencil">(this part’s on you ✍️)</span>
            </div>
            <div className="mt-1 text-[10px] tracking-wide uppercase">
              <b>23.</b> Applicant signature
            </div>
          </div>
          <div className="col-span-12 sm:col-span-4">
            <div className="field-line h-10" />
            <div className="mt-1 text-[10px] tracking-wide uppercase">
              <b>24.</b> Date
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-2 border-t border-rule pt-2 text-[9.5px] tracking-wider text-print/70 uppercase">
          <span>RA-27B (03/87) · Page 1 of 1</span>
          <span>Previous editions are obsolete</span>
        </div>
      </div>

      {done && !shredding && <ApprovedStamp stats={stats} />}
    </article>
  )
})
