import { Check, PenLine } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'

interface Props {
  reason: string
  label?: string
  className?: string
  /** "Looks right": clear the flag without editing. Adds the tear-off ✓ stub and a button in the note. */
  onConfirm?: () => void
  /** "Fix it": put the cursor in the field. */
  onEdit?: () => void
}

/** Focus the first element after `el` that Tab would reach, so removing `el` doesn't drop focus to <body>. */
function focusNextAfter(el: HTMLElement) {
  for (const c of document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')) {
    if (el.contains(c) || !(el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
    if (c.tabIndex < 0 || c.matches(':disabled') || !c.getClientRects().length || getComputedStyle(c).visibility === 'hidden') continue
    if (c instanceof HTMLInputElement && c.type === 'radio') {
      // Tab stops once per radio group: on the checked option, or the first one if none is checked.
      const group = [...document.getElementsByName(c.name)] as HTMLInputElement[]
      if (c !== (group.find((r) => r.checked) ?? group[0])) continue
    }
    c.focus()
    return
  }
}

/**
 * Tilted Post-it with a perforated ✓ stub. Hover (mouse) or tap (touch) opens the note that
 * explains the flag. The note closes on an outside press, focus moving elsewhere, or Escape —
 * not on blur, since a tap on its buttons doesn't always focus them on touch browsers.
 */
export function CheckMeTag({ reason, label = 'check me', className = '', onConfirm, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const tipId = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('focusin', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('focusin', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const shown = open || hover

  // Keep the note on screen: right-align it under the tag, then nudge it inside the viewport.
  const [place, setPlace] = useState<{ left: number; width: number }>()
  useLayoutEffect(() => {
    if (!shown) return
    const measure = () => {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      const width = Math.min(256, window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - 8 - width))
      setPlace({ left: left - r.left, width })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [shown])

  const confirm = (e: MouseEvent) => {
    // Keyboard activation (detail 0): this tag is about to unmount, so hand focus on to the next field.
    if (e.detail === 0 && ref.current) focusNextAfter(ref.current)
    onConfirm?.()
  }

  const action = 'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold tracking-wide uppercase'

  return (
    <span
      ref={ref}
      className={`absolute z-10 ${className}`}
      // Mouse only: touch browsers emulate mouseenter on tap but never the matching leave.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
    >
      <span className="animate-pop flex items-stretch shadow-[1px_2px_0_rgb(0_0_0/0.22)] [--tilt:4deg]">
        <button
          type="button"
          data-checkme
          aria-describedby={tipId}
          aria-expanded={shown}
          onClick={() => setOpen((o) => !o)}
          className="cursor-help bg-postit px-1.5 pt-0.5 pb-px font-hand text-[15px] leading-none font-bold whitespace-nowrap text-print"
        >
          {label} ⚑
        </button>
        {onConfirm && (
          <button
            type="button"
            onClick={confirm}
            title="Looks right"
            aria-label="Looks right: clear this flag"
            className="flex items-center border-l-2 border-dotted border-print/35 bg-[#f2c94c] px-1 text-print transition-colors hover:bg-[#9ad29a] focus-visible:bg-[#9ad29a]"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </button>
        )}
      </span>
      {/* pt-1.5 (not mt) keeps a hover bridge between the tag and the note */}
      <span
        role="tooltip"
        id={tipId}
        style={place}
        className={`absolute top-full right-0 w-64 pt-1.5 transition-opacity duration-150 ${
          shown ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <span className="block border border-print bg-paper px-2.5 py-2 text-left font-mono text-xs leading-snug font-normal tracking-normal text-print normal-case shadow-[3px_3px_0_rgb(0_0_0/0.2)]">
          <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-pencil uppercase">Why the flag?</span>
          {reason}
          {(onConfirm || onEdit) && (
            <span className="mt-2 flex flex-wrap gap-2">
              {onConfirm && (
                <button type="button" onClick={confirm} className={`${action} bg-[#2e7d32] text-paper hover:brightness-110`}>
                  <Check className="size-3.5" strokeWidth={3} /> Looks right
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setHover(false)
                    onEdit()
                  }}
                  className={`${action} border border-print hover:bg-print/5`}
                >
                  <PenLine className="size-3.5" /> Fix it
                </button>
              )}
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
