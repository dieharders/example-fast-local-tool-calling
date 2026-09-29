import { Code } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pt-4 pb-24 text-xs text-paper/60">
      <div className="flex flex-col gap-2 border-t border-paper/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Powered by{' '}
          <a href="https://cactuscompute.com" target="_blank" rel="noreferrer" className="underline hover:text-paper">
            Cactus Needle 3
          </a>{' '}
          (Apache-2.0) · runs 100% on-device. Besides this page, the only download is the model itself (36 MB, from
          Hugging Face, cached after the first visit); nothing you type is ever sent anywhere, not even to us.
        </p>
        <a
          href="https://github.com/cactus-compute/needle"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 underline hover:text-paper"
        >
          <Code className="size-3.5" /> Needle on GitHub
        </a>
      </div>
    </footer>
  )
}
