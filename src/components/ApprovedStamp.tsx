import type { FillStats } from '../hooks/useFormFiller'

export function ApprovedStamp({ stats }: { stats: FillStats }) {
  const secs = (stats.inferenceMs / 1000).toFixed(1)
  const network = stats.requests === 0 ? '0 bytes sent' : `${stats.requests} network req.`
  return (
    <div className="animate-stamp pointer-events-none absolute right-2 bottom-14 z-20 mix-blend-multiply [--tilt:-9deg] sm:right-8 sm:bottom-16">
      <div className="relative px-3 py-1.5 text-center text-stamp sm:px-5 sm:py-2">
        {/* Heavy grain on the frame and headline; the stats line stays readable. */}
        <div aria-hidden className="stamp-ink absolute inset-0 rounded-lg border-[5px] border-stamp outline-2 outline-offset-2 outline-stamp" />
        <div className="stamp-ink font-title text-5xl leading-none tracking-[0.08em] uppercase sm:text-6xl">Approved</div>
        <div className="stamp-ink-soft mt-1 text-[10px] font-bold tracking-[0.14em] uppercase sm:text-xs">
          {stats.filled} fields · {secs} s · {network}
        </div>
      </div>
    </div>
  )
}
