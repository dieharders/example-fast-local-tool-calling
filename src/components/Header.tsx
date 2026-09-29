import { TOTAL_FIELDS } from '../form/schema'
import { PrivacyStamp } from './PrivacyStamp'

export function Header({ isMock }: { isMock: boolean }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-6 pb-8 text-paper sm:pt-10 sm:pb-12">
      <div className="flex items-center justify-between gap-3 text-[10px] tracking-[0.25em] text-paper/60 uppercase sm:text-[11px]">
        <span>Dept. of Paperwork · Window 1</span>
        {isMock && (
          <span
            title="The UI is running on a stand-in model. The real Needle engine is wired in Phase 2."
            className="rounded-sm border border-postit/70 px-2 py-0.5 tracking-widest text-postit"
          >
            Mock mode
          </span>
        )}
      </div>

      <div className="mt-4 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12">
        <div>
          <h1 className="font-title text-[clamp(2.75rem,10vw,6.25rem)] leading-[0.92] uppercase">
            The form that
            <br />
            <span className="relative mt-2 inline-block -rotate-2 bg-stamp px-3 pb-1 text-paper shadow-[4px_5px_0_rgb(0_0_0/0.3)] sm:px-4">
              fills itself
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-paper/85 sm:text-lg">
            Write one messy paragraph about yourself. Watch a {TOTAL_FIELDS}-field rental application fill itself:
            dates reformatted, phone numbers fixed, boxes ticked.
          </p>
        </div>
        <PrivacyStamp className="rotate-[0.8deg] lg:mb-1 lg:rotate-[2.5deg]" />
      </div>
    </header>
  )
}
