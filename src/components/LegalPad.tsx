import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EXAMPLES, type Example, type ExampleId } from '../examples'

interface Props {
  value: string
  exampleId: ExampleId | null
  /** Character ranges the model is reading right now; drawn as highlighter marks. */
  reading: { start: number; end: number }[]
  locked: boolean
  onChange: (text: string) => void
  onExample: (ex: Example) => void
  onSubmit: () => void
}

// Both layers share these so the mirror wraps text exactly like the textarea.
const TEXT_BOX = 'pt-[0.35rem] pr-4 pb-2 pl-[3.25rem] font-hand text-[1.4rem] leading-8'

export function LegalPad({ value, exampleId, reading, locked, onChange, onExample, onSubmit }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()

  // Match the textarea's inner width (it may lose some to a scrollbar).
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the clause being read in view.
  useEffect(() => {
    const area = areaRef.current
    const mark = mirrorRef.current?.querySelector('mark')
    if (!area || !mark) return
    const top = mark.offsetTop
    if (top < area.scrollTop || top > area.scrollTop + area.clientHeight - 40) area.scrollTop = Math.max(0, top - 36)
    if (mirrorRef.current) mirrorRef.current.scrollTop = area.scrollTop
  }, [reading])

  const pieces: ReactNode[] = []
  let at = 0
  for (const r of [...reading].sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue
    pieces.push(value.slice(at, r.start))
    pieces.push(
      <mark key={r.start} className="animate-highlighter rounded-[3px] bg-highlight/90 text-transparent">
        {value.slice(r.start, r.end)}
      </mark>,
    )
    at = r.end
  }
  pieces.push(value.slice(at))

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
              disabled={locked}
              aria-pressed={on}
              className={`rounded-t-md border border-b-0 px-2.5 text-left leading-tight whitespace-nowrap transition-[padding,background-color] disabled:cursor-not-allowed sm:px-3 ${
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
        <div className="relative">
          <textarea
            ref={areaRef}
            id="messy-text"
            value={value}
            readOnly={locked}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onSubmit()
              }
            }}
            rows={7}
            spellCheck={false}
            placeholder="e.g. hi I'm Sam Rivera, born 2/3/95, moving from Austin to 12 Elm St in Denver next month, cell 512 555 0100…"
            className={`legal-pad block h-56 w-full resize-none bg-transparent text-[#2b2a33] outline-none placeholder:text-print/35 ${TEXT_BOX}`}
          />
          <div
            ref={mirrorRef}
            aria-hidden
            style={{ width }}
            className={`pointer-events-none absolute inset-y-0 left-0 overflow-hidden break-words whitespace-pre-wrap text-transparent mix-blend-multiply ${TEXT_BOX}`}
          >
            {pieces}
          </div>
        </div>
      </div>
    </div>
  )
}
