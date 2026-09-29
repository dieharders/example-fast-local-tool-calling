import { ChevronDown, Lock } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { US_STATES, fieldDomId, type FieldDef } from '../form/schema'
import { CheckMeTag } from './CheckMeTag'

// Tailwind needs literal class names, so spans map through lookup tables.
const MOBILE_SPAN: Record<number, string> = {
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  12: 'col-span-12',
}
const DESKTOP_SPAN: Record<number, string> = {
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  12: 'sm:col-span-12',
}

const INPUT_MODE: Partial<Record<FieldDef['type'], 'tel' | 'numeric' | 'email' | 'text'>> = {
  phone: 'tel',
  ssn: 'numeric',
  zip: 'numeric',
  int: 'numeric',
  email: 'email',
}

interface Props {
  field: FieldDef
  value: string
  flag?: string
  /** The user confirmed or corrected a flagged value. */
  verified: boolean
  active: boolean
  onChange: (id: string, value: string) => void
  onConfirm: (id: string) => void
}

function Highlighter() {
  return (
    <span
      aria-hidden
      className="animate-highlighter pointer-events-none absolute inset-x-[-3px] top-[5px] bottom-[2px] rounded-[3px] bg-highlight/85 mix-blend-multiply"
    />
  )
}

const inkText = 'font-type text-[1.05rem] text-ink'

export const Field = memo(function Field({ field, value, flag, verified, active, onChange, onConfirm }: Props) {
  const inputId = `input-${field.id}`
  const labelId = `label-${field.id}`
  const span = `${MOBILE_SPAN[field.span[0]]} ${DESKTOP_SPAN[field.span[1]]}`
  const labelClass = 'block text-[10px] leading-tight tracking-wide text-print/85 uppercase sm:text-[11px]'
  const labelBody = (
    <>
      <span className="font-bold">{field.num}.</span> {field.label}
    </>
  )

  let control: ReactNode
  if (field.type === 'checks') {
    control = (
      <div role="radiogroup" aria-labelledby={labelId} className="relative flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1.5 py-1">
        {flag && <Highlighter />}
        {field.options!.map((o) => {
          const checked = value === o.value
          return (
            <label key={o.value} className="relative flex cursor-pointer items-center gap-1.5 text-[12px] uppercase sm:text-[13px]">
              <input
                type="radio"
                name={field.id}
                value={o.value}
                checked={checked}
                onChange={() => onChange(field.id, o.value)}
                className="peer sr-only"
              />
              <span className="relative inline-block size-4 shrink-0 border-[1.5px] border-print bg-paper/50 peer-focus-visible:ring-2 peer-focus-visible:ring-ink/50">
                {checked && (
                  <svg viewBox="0 0 16 16" className="absolute -inset-1 size-6 text-ink" aria-hidden>
                    <path d="M3.5 3 L12.5 13" pathLength={1} className="animate-draw" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" fill="none" />
                    <path d="M12.8 3.2 L3.2 12.6" pathLength={1} className="animate-draw-2" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" fill="none" />
                  </svg>
                )}
              </span>
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
    )
  } else if (field.type === 'select' || field.type === 'state') {
    const options = field.type === 'state' ? US_STATES.map((s) => ({ value: s, label: s })) : field.options!
    control = (
      <div className="relative">
        {flag && <Highlighter />}
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={`field-line relative h-9 w-full cursor-pointer appearance-none rounded-none bg-transparent px-1 pr-7 outline-none focus:bg-ink/5 ${inkText} ${active ? 'animate-flip' : ''}`}
        >
          <option value=""></option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-2.5 right-1 size-4 text-print/50" />
      </div>
    )
  } else {
    control = (
      <div className="relative">
        {flag && <Highlighter />}
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          inputMode={INPUT_MODE[field.type] ?? 'text'}
          autoComplete="off"
          spellCheck={false}
          className={`field-line relative h-9 w-full rounded-none bg-transparent px-1 leading-9 outline-none focus:bg-ink/5 ${inkText} ${
            active ? 'text-transparent' : ''
          }`}
        />
        {active && (
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-9 overflow-hidden px-1 leading-9 whitespace-pre ${inkText}`}>
            {value}
            <span className="animate-caret -ml-px">▍</span>
          </div>
        )}
      </div>
    )
  }

  return (
    // Column flex + mt-auto on the control keeps inputs in a row aligned even when one label wraps.
    <div id={fieldDomId(field.id)} className={`relative flex scroll-mt-24 flex-col ${span}`}>
      {field.type === 'checks' ? (
        <span id={labelId} className={labelClass}>
          {labelBody}
        </span>
      ) : (
        <label htmlFor={inputId} id={labelId} className={labelClass}>
          {labelBody}
        </label>
      )}
      <div className="mt-auto">{control}</div>
      {field.sensitive && (
        <span className="absolute top-full left-0 mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-stamp">
          <Lock className="size-2.5" strokeWidth={3} /> Never leaves this device
        </span>
      )}
      {flag ? (
        <CheckMeTag
          reason={flag}
          className="-top-4 -right-2"
          onConfirm={() => onConfirm(field.id)}
          onEdit={() => {
            if (field.type !== 'checks') return document.getElementById(inputId)?.focus()
            // Radios have no id: land on the model's choice, or the first option if none is checked.
            const radios = [...document.getElementsByName(field.id)] as HTMLInputElement[]
            const pick = radios.find((r) => r.checked) ?? radios[0]
            pick?.focus()
          }}
        />
      ) : (
        verified && (
          <span
            aria-label="Checked by you"
            className="animate-pop pointer-events-none absolute -top-3 right-0 font-hand text-[15px] leading-none font-bold text-[#2e7d32] [--tilt:-4deg]"
          >
            ✓ checked
          </span>
        )
      )}
    </div>
  )
})
