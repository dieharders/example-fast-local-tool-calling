import { ArrowDown } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ALL_FIELDS, fieldDomId } from '../form/schema'

const ORDER = new Map(ALL_FIELDS.map((f, i) => [f.id, i]))

/** Floating Post-it that walks through the fields flagged "check me", opening each one's note. */
export function ReviewChip({ flagged }: { flagged: string[] }) {
  const last = useRef<string | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (flagged.length === 0) return null

  const jump = () => {
    // Next flag in form order after the last one visited (even if that one was since cleared), wrapping around.
    const at = last.current ? ORDER.get(last.current)! : -1
    const id = flagged.find((f) => ORDER.get(f)! > at) ?? flagged[0]
    last.current = id
    const wrap = document.getElementById(fieldDomId(id))
    wrap?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // Once it's in view, open the field's note so "Looks right" / "Fix it" are one click away.
    // Focusing the tag closes any other open note; a quicker second click supersedes this one.
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const tag = wrap?.querySelector<HTMLButtonElement>('[data-checkme]')
      tag?.focus({ preventScroll: true })
      if (tag && tag.getAttribute('aria-expanded') !== 'true') tag.click()
    }, 380)
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
