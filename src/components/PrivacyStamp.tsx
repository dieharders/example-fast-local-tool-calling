import { Plane, ShieldCheck } from 'lucide-react'

export function PrivacyStamp({ className = '' }: { className?: string }) {
  return (
    <div
      className={`border-[3px] border-double border-stamp bg-paper px-4 py-3 text-print shadow-[0_12px_24px_-10px_rgb(0_0_0/0.65)] sm:px-5 sm:py-4 ${className}`}
    >
      <div className="stamp-ink flex items-center gap-2 font-title text-[1.7rem] leading-none tracking-[0.12em] text-stamp uppercase">
        <ShieldCheck className="size-7" strokeWidth={2.5} /> Confidential
      </div>
      <p className="mt-2 text-[15px] leading-snug">
        Your SSN and address never leave your device. <strong>The AI runs in your browser.</strong>
      </p>
      <p className="mt-2 flex items-center gap-1.5 font-hand text-lg leading-tight text-pencil">
        <Plane className="size-4 shrink-0" /> Try it in airplane mode once the model loads.
      </p>
    </div>
  )
}
