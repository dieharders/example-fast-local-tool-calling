import { Cpu } from 'lucide-react'
import type { LoadProgress } from '../engine'
import type { EngineStatus } from '../hooks/useEngine'
import type { FillStats, Phase } from '../hooks/useFormFiller'
import { FORM_SECTIONS } from '../form/schema'

interface Props {
  ticket: number
  modelLabel: string
  runtimeLabel: string
  status: EngineStatus
  progress: LoadProgress | null
  error: string | null
  phase: Phase
  reading: number
  stats: FillStats | null
  onRetry: () => void
}

const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1)

/** DMV-style "take a number" ticket that doubles as the model status readout. */
export function ModelTicket(p: Props) {
  let headline: string
  let detail: string
  let pct: number | null = null

  if (p.status === 'error') {
    headline = 'Window closed'
    detail = p.error ?? 'The model failed to load.'
  } else if (p.status !== 'ready') {
    headline = 'Please take a number'
    const pr = p.progress
    if (!pr || pr.stage === 'runtime') detail = 'Starting the WebAssembly runtime…'
    else if (pr.stage === 'init') detail = 'Warming up the clerk…'
    else detail = `Fetching ${p.modelLabel} · ${mb(pr.loaded)} / ${mb(pr.total)} MB`
    pct = pr && pr.total ? Math.round((pr.loaded / pr.total) * 100) : 0
  } else if (p.phase === 'running') {
    headline = 'Processing…'
    detail =
      p.reading >= 0
        ? `Reading section ${p.reading + 1}/${FORM_SECTIONS.length} · ${FORM_SECTIONS[p.reading].title}`
        : 'Filing it neatly…'
  } else if (p.phase === 'done' && p.stats) {
    headline = `Served in ${(p.stats.inferenceMs / 1000).toFixed(1)} s`
    detail = [
      p.stats.decodeTps && `${p.stats.decodeTps} tok/s`,
      p.stats.peakRamMb && `${Math.round(p.stats.peakRamMb)} MB RAM`,
      `${FORM_SECTIONS.length} tool calls`,
    ]
      .filter(Boolean)
      .join(' · ')
  } else {
    headline = 'Window 1 open'
    detail = `${p.modelLabel} · ready`
  }

  return (
    <div className="ticket relative -rotate-1 px-6 py-3 text-print shadow-[0_8px_18px_-8px_rgb(0_0_0/0.6)]" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[10px] tracking-[0.22em] uppercase">
        <span>Now serving</span>
        <span className="flex items-center gap-1 tracking-wider">
          <Cpu className="size-3" /> {p.runtimeLabel} · on this device
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="font-title text-[2.6rem] leading-none text-stamp-deep">#{String(p.ticket).padStart(3, '0')}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-wide uppercase">{headline}</div>
          <div className="truncate text-xs">{detail}</div>
        </div>
      </div>
      {pct !== null && (
        <div className="mt-2 h-2.5 border border-print bg-paper/60">
          <div
            className="animate-ticket-bar h-full bg-[repeating-linear-gradient(45deg,var(--color-print)_0_6px,transparent_6px_12px)] transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {p.status === 'error' && (
        <button type="button" onClick={p.onRetry} className="mt-2 text-xs font-bold underline">
          Take another number (retry)
        </button>
      )}
    </div>
  )
}
