import { ArrowDown } from 'lucide-react'
import { useRef } from 'react'
import { fieldDomId } from '../form/schema'

/** Floating Post-it that cycles through fields flagged "check me". */
export function ReviewChip({ flagged }: { flagged: string[] }) {
  const next = useRef(0)
  if (flagged.length === 0) return null

  const jump = () => {
    const id = flagged[next.current % flagged.length]
    next.current++
    const wrap = document.getElementById(fieldDomId(id))
    wrap?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    wrap?.querySelector<HTMLElement>('input:not([type=radio]), select, input[type=radio]')?.focus({ preventScroll: true })
  }

  return (
    <button
      type="button"
      onClick={jump}
      className="animate-pop fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-2 bg-postit px-4 py-2 font-hand text-xl leading-none font-bold text-print shadow-[2px_4px_0_rgb(0_0_0/0.3)] [--tilt:-2deg] hover:brightness-105"
    >
      ⚑ {flagged.length} {flagged.length === 1 ? 'field needs' : 'fields need'} a look
      <span className="flex items-center gap-0.5 text-base underline">
        next <ArrowDown className="size-4" />
      </span>
    </button>
  )
}
