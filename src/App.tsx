import { useEffect, useMemo, useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { FillControls } from './components/FillControls'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { HowItWorks } from './components/HowItWorks'
import { LegalPad } from './components/LegalPad'
import { ModelTicket } from './components/ModelTicket'
import { PaperForm } from './components/PaperForm'
import { ReviewChip } from './components/ReviewChip'
import type { Example, ExampleId } from './examples'
import { ALL_FIELDS } from './form/schema'
import { useEngine } from './hooks/useEngine'
import { useFormFiller } from './hooks/useFormFiller'

// Load every font up front so no font request lands mid-fill and spoils the "0 bytes sent" count.
const FONTS = [
  '1em "Special Elite"',
  '1em Caveat',
  'bold 1em Caveat',
  '1em Anton',
  '1em "Courier Prime"',
  'bold 1em "Courier Prime"',
  'italic 1em "Courier Prime"',
]

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function App() {
  const { engine, status, progress, error, load } = useEngine()
  const filler = useFormFiller(engine)
  const [text, setText] = useState('')
  const [exampleId, setExampleId] = useState<ExampleId | null>(null)
  const [nudgeKey, setNudgeKey] = useState(0)
  const [shredding, setShredding] = useState(false)
  const formRef = useRef<HTMLElement>(null)
  const desktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    FONTS.forEach((f) => document.fonts?.load(f).catch(() => {}))
  }, [])

  useEffect(() => {
    if (status === 'error' && error) toast.error(`Couldn't load the model: ${error}`)
  }, [status, error])

  const running = filler.phase === 'running'
  const flaggedIds = useMemo(() => ALL_FIELDS.filter((f) => filler.flags[f.id]).map((f) => f.id), [filler.flags])

  // Cheer when the last "check me" is cleared after a fill.
  const openFlags = useRef(0)
  useEffect(() => {
    const cleared = filler.phase === 'done' && openFlags.current > 0 && flaggedIds.length === 0
    openFlags.current = flaggedIds.length
    if (!cleared) return
    const cheer = () => void toast.success('All checked. Only the signature is left ✍️')
    // Typing clears a flag on the first keystroke, so wait until the user leaves the text field they're correcting.
    const el = document.activeElement
    if (!(el instanceof HTMLInputElement) || el.type === 'radio' || !formRef.current?.contains(el)) return cheer()
    el.addEventListener('blur', cheer, { once: true })
    return () => el.removeEventListener('blur', cheer)
  }, [flaggedIds.length, filler.phase])

  const onExample = (ex: Example) => {
    setText(ex.text)
    setExampleId(ex.id)
    setNudgeKey((k) => k + 1)
    if (filler.phase !== 'idle') filler.reset()
  }

  const onFill = async () => {
    if (running || status === 'loading') return
    if (!text.trim()) {
      toast('The clerk needs something to read. Try one of the example tabs.', { icon: '🗒️' })
      return
    }
    // Data-saver visitors fetch the model on their first Fill instead of on page load.
    if (status !== 'ready' && !(await load())) return
    if (!desktop) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const stats = await filler.fill(text)
    if (!stats) return
    const tail = stats.flagged ? ` · ${stats.flagged} need a look` : ''
    toast.success(`Filled ${stats.filled} fields in ${(stats.inferenceMs / 1000).toFixed(1)} s${tail}`)
  }

  const onShred = () => {
    if (filler.phase === 'idle') return
    setShredding(true)
    window.setTimeout(() => {
      filler.reset()
      setShredding(false)
    }, 350)
  }

  return (
    <div className="desk min-h-dvh overflow-x-clip">
      {/* Desktop: bottom-left sits under the sticky input column, clear of the form. */}
      <Toaster
        position={desktop ? 'bottom-left' : 'top-center'}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#fffdf4',
            color: '#26241f',
            border: '1.5px solid #26241f',
            borderRadius: '2px',
            fontFamily: '"Courier Prime", monospace',
            fontSize: '14px',
            boxShadow: '3px 4px 0 rgb(0 0 0 / 0.25)',
          },
        }}
      />
      <Header isMock={engine.kind === 'mock'} />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <aside className="flex min-w-0 flex-col gap-6 tall:sticky tall:top-6 tall:self-start">
          <LegalPad
            value={text}
            exampleId={exampleId}
            reading={filler.reading}
            locked={running}
            onChange={(t) => {
              setText(t)
              setExampleId(null)
            }}
            onExample={onExample}
            onSubmit={onFill}
          />
          <FillControls
            canFill={(status === 'ready' || status === 'idle') && !running}
            running={running}
            engineReady={status === 'ready' || status === 'idle'}
            nudgeKey={nudgeKey}
            onFill={onFill}
            onShred={onShred}
          />
          <ModelTicket
            ticket={filler.ticket}
            modelLabel={engine.modelLabel}
            runtimeLabel={engine.runtimeLabel}
            lanes={engine.lanes}
            status={status}
            progress={progress}
            error={error}
            phase={filler.phase}
            calls={filler.progress}
            stats={filler.stats}
            onRetry={() => void load()}
          />
        </aside>

        <div className="min-w-0">
          <PaperForm
            ref={formRef}
            phase={filler.phase}
            values={filler.values}
            flags={filler.flags}
            verified={filler.verified}
            sections={filler.sections}
            active={filler.active}
            stats={filler.stats}
            shredding={shredding}
            onChange={filler.setUserValue}
            onConfirm={filler.confirm}
            onConfirmSection={filler.confirmSection}
          />
          <HowItWorks calls={filler.calls} />
        </div>
      </main>

      <Footer />
      {filler.phase === 'done' && !shredding && <ReviewChip flagged={flaggedIds} />}
    </div>
  )
}
