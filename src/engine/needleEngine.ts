import type { CompleteRequest, FillEngine, LoadProgress, NeedleEnvelope } from './types'

// Needle 3 (20 layers, the largest build) running as Emscripten WebAssembly in Web Workers.
// All three files come from Hugging Face at a pinned revision so the runtime and the weights
// always match; they're kept in Cache Storage so repeat visits (and airplane mode) skip the
// download. After that, nothing touches the network: inference is local.

const REVISION = '27c0a9a5b3ca835e0b7dbeaccf555df03dac493d'
const BASE = `https://huggingface.co/Cactus-Compute/needle3/resolve/${REVISION}`
const FILES = [
  { key: 'js', url: `${BASE}/wasm/needle.js`, size: 62_502 },
  { key: 'wasm', url: `${BASE}/wasm/needle.wasm`, size: 688_713 },
  { key: 'cact', url: `${BASE}/needle3.cact`, size: 35_335_380 },
] as const
const CACHE = `needle3-${REVISION.slice(0, 12)}`

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

/** One model instance per lane: two when the device has the cores and memory (~100 MB each). */
function pickLanes(): number {
  const forced = Number(new URLSearchParams(window.location.search).get('lanes'))
  if (forced >= 1 && forced <= 4) return forced
  const cores = navigator.hardwareConcurrency ?? 2
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  return cores >= 4 && memory >= 4 ? 2 : 1
}

async function download(
  file: (typeof FILES)[number],
  onBytes: (got: number, total: number) => void,
): Promise<{ bytes: Uint8Array; cached: boolean }> {
  let cache: Cache | null = null
  try {
    cache = await caches.open(CACHE)
    const hit = await cache.match(file.url)
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer())
      onBytes(bytes.length, bytes.length)
      return { bytes, cached: true }
    }
  } catch {
    cache = null // private mode, blocked storage: just download
  }
  const res = await fetch(file.url)
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${file.url.split('/').pop()}`)
  const total = Number(res.headers.get('content-length')) || file.size
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    onBytes(got, total)
  }
  const bytes = new Uint8Array(got)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.length
  }
  try {
    await cache?.put(file.url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }))
  } catch {
    // quota exceeded etc.: fine, it just downloads again next time
  }
  return { bytes, cached: false }
}

async function dropOldCaches() {
  try {
    for (const name of await caches.keys()) if (name.startsWith('needle3-') && name !== CACHE) await caches.delete(name)
  } catch {
    // ignore
  }
}

export function createNeedleEngine(): FillEngine {
  const lanes = pickLanes()
  const workers: Worker[] = []
  const pending = new Map<number, Pending>()
  let seq = 0

  const rpc = (worker: Worker, msg: Record<string, unknown>, transfer: Transferable[] = []) =>
    new Promise<unknown>((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...msg, id }, transfer)
    })

  const spawn = () => {
    const w = new Worker(`${import.meta.env.BASE_URL}needle-worker.js`)
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.ok) p.resolve(e.data.result)
      else p.reject(new Error(e.data.error ?? 'Engine error'))
    }
    w.onerror = (e) => {
      e.preventDefault()
      for (const [id, p] of pending) {
        p.reject(new Error(e.message || 'The engine worker crashed.'))
        pending.delete(id)
      }
    }
    return w
  }

  return {
    kind: 'needle',
    modelLabel: 'Needle 3 · 20 layers',
    runtimeLabel: 'CPU · WebAssembly',
    lanes,

    async load(onProgress: (p: LoadProgress) => void) {
      void dropOldCaches()
      const totals: number[] = FILES.map((f) => f.size)
      const got = FILES.map(() => 0)
      let allCached = true
      const report = () =>
        onProgress({ stage: 'weights', loaded: got.reduce((a, b) => a + b, 0), total: totals.reduce((a, b) => a + b, 0) })
      onProgress({ stage: 'runtime', loaded: 0, total: totals.reduce((a, b) => a + b, 0) })
      const [js, wasm, cact] = await Promise.all(
        FILES.map((f, i) =>
          download(f, (g, t) => {
            got[i] = g
            totals[i] = t
            report()
          }).then((r) => {
            allCached &&= r.cached
            return r.bytes
          }),
        ),
      )
      const total = totals.reduce((a, b) => a + b, 0)
      onProgress({ stage: 'init', loaded: total, total, cached: allCached })
      const jsText = new TextDecoder().decode(js)
      for (let i = 0; i < lanes; i++) workers.push(spawn())
      // Each worker needs its own copy of the bytes; the last one takes ownership (no copy).
      await Promise.all(
        workers.map((w, i) => {
          const last = i === workers.length - 1
          const wasmBuf = last ? wasm.buffer : wasm.slice().buffer
          const cactBuf = last ? cact.buffer : cact.slice().buffer
          return rpc(w, { type: 'load', js: jsText, wasm: wasmBuf, cact: cactBuf }, [wasmBuf, cactBuf])
        }),
      )
    },

    async complete(req: CompleteRequest, opts?: { lane?: number }): Promise<NeedleEnvelope> {
      if (!workers.length) throw new Error('The model is not loaded yet.')
      const w = workers[(opts?.lane ?? 0) % workers.length]
      const json = (await rpc(w, {
        type: 'complete',
        system: req.systemPrompt,
        tools: JSON.stringify(req.tools),
        input: req.input,
        maxNewTokens: req.maxNewTokens ?? 128,
      })) as string
      try {
        return JSON.parse(json) as NeedleEnvelope
      } catch {
        throw new Error('The engine returned malformed output.')
      }
    },
  }
}
