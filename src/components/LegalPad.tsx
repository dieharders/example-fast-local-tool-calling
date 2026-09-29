import { EXAMPLES, type Example, type ExampleId } from '../examples'

interface Props {
  value: string
  exampleId: ExampleId | null
  onChange: (text: string) => void
  onExample: (ex: Example) => void
  onSubmit: () => void
}

export function LegalPad({ value, exampleId, onChange, onExample, onSubmit }: Props) {
  return (
    <div>
      <div className="flex items-end gap-1 pl-2" role="group" aria-label="Example paragraphs">
        {EXAMPLES.map((ex) => {
          const on = ex.id === exampleId
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onExample(ex)}
              aria-pressed={on}
              className={`rounded-t-md border border-b-0 px-2.5 text-left leading-tight whitespace-nowrap transition-[padding,background-color] sm:px-3 ${
                on
                  ? 'border-pad bg-pad pt-2.5 pb-1.5 text-print'
                  : 'border-manila-deep bg-manila pt-1.5 pb-1 text-print/85 hover:bg-[#f0d49c]'
              }`}
            >
              <span className="block text-[13px] font-bold">
                <span aria-hidden>{ex.emoji}</span> {ex.name}
              </span>
              <span className="block text-[10px] tracking-wider uppercase opacity-75">{ex.blurb}</span>
            </button>
          )
        })}
      </div>

      <div className="relative overflow-hidden rounded-sm bg-pad shadow-[0_14px_30px_-10px_rgb(0_0_0/0.55),0_3px_8px_rgb(0_0_0/0.25)]">
        <div aria-hidden className="h-4 bg-[#8a3b2f] shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)]" />
        <label htmlFor="messy-text" className="block pt-3 pr-4 pb-1 pl-[3.25rem] font-hand text-2xl leading-tight font-bold text-print">
          Tell us about yourself. However you want.
        </label>
        <textarea
          id="messy-text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSubmit()
            }
          }}
          rows={7}
          spellCheck={false}
          placeholder="e.g. hi I'm Sam Rivera, born 2/3/95, moving from Austin to 12 Elm St in Denver next month, cell 512 555 0100…"
          className="legal-pad block h-56 w-full resize-none bg-transparent pt-[0.35rem] pr-4 pb-2 pl-[3.25rem] font-hand text-[1.4rem] leading-8 text-[#2b2a33] outline-none placeholder:text-print/35"
        />
      </div>
    </div>
  )
}
