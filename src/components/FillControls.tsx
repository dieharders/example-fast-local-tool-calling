import { LoaderCircle, Scissors, Stamp } from 'lucide-react'

interface Props {
  canFill: boolean
  running: boolean
  engineReady: boolean
  nudgeKey: number
  onFill: () => void
  onShred: () => void
}

export function FillControls({ canFill, running, engineReady, nudgeKey, onFill, onShred }: Props) {
  const label = running ? 'Filling…' : engineReady ? 'Fill it for me' : 'Loading model…'
  return (
    <div>
      <div className="flex items-stretch gap-3">
        <button
          key={nudgeKey}
          type="button"
          onClick={onFill}
          disabled={!canFill}
          className={`flex flex-1 items-center justify-center gap-2.5 rounded-sm bg-stamp px-4 py-3 font-title text-[1.6rem] leading-none tracking-wide text-paper uppercase shadow-[0_5px_0_var(--color-stamp-deep),0_10px_18px_-6px_rgb(0_0_0/0.5)] transition-[transform,box-shadow] hover:brightness-110 active:translate-y-[5px] active:shadow-[0_0_0_var(--color-stamp-deep)] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0 ${
            nudgeKey > 0 && canFill ? 'animate-nudge' : ''
          }`}
        >
          {running || !engineReady ? <LoaderCircle className="size-6 animate-spin" /> : <Stamp className="size-6" />}
          {label}
        </button>
        <button
          type="button"
          onClick={onShred}
          className="flex items-center gap-1.5 rounded-sm border-2 border-paper/50 px-3 text-xs font-bold tracking-wider text-paper uppercase transition-colors hover:bg-paper/10"
        >
          <Scissors className="size-4" />
          Shred
        </button>
      </div>
      <p className="mt-2 hidden text-[11px] text-paper/55 sm:block">
        Tip: <kbd className="font-bold">⌘/Ctrl + Enter</kbd> works too.
      </p>
    </div>
  )
}
