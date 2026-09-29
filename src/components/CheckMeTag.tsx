import { useId, useState } from 'react'

interface Props {
  reason: string
  label?: string
  className?: string
}

/** Tilted Post-it. Hover (desktop) or tap (mobile) shows why the model wasn't sure. */
export function CheckMeTag({ reason, label = 'check me', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  return (
    <span className={`group absolute z-10 ${className}`}>
      <button
        type="button"
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="animate-pop block cursor-help whitespace-nowrap bg-postit px-1.5 pt-0.5 pb-px font-hand text-[15px] leading-none font-bold text-print shadow-[1px_2px_0_rgb(0_0_0/0.22)] [--tilt:4deg]"
      >
        {label} ⚑
      </button>
      <span
        role="tooltip"
        id={tipId}
        className={`absolute top-full right-0 mt-1.5 w-60 max-w-[75vw] border border-print bg-paper px-2.5 py-2 text-left font-mono text-xs leading-snug font-normal tracking-normal text-print normal-case shadow-[3px_3px_0_rgb(0_0_0/0.2)] transition-opacity duration-150 ${
          open ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'
        }`}
      >
        <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-pencil uppercase">Why the flag?</span>
        {reason}
        <span className="mt-1.5 block text-pencil italic">Fix or retype it to clear the flag.</span>
      </span>
    </span>
  )
}
