/* global createNeedle, importScripts */
// One Needle 3 instance per worker. needle_complete blocks, so it runs off the main thread.
// The page downloads the files once (with progress + Cache Storage) and hands the bytes over;
// this worker never touches the network. Protocol mirrors the official Cactus sandbox:
//   load     { js: string, wasm: ArrayBuffer, cact: ArrayBuffer }        → { ok }
//   complete { system, tools, input, maxNewTokens }                      → { ok, json }
// Unlike the sandbox, every per-call string is freed; init strings live until the next init.

let mod = null
let outPtr = 0
const OUT_CAP = 65536
let initKey = null
let initPtrs = []

function cstr(s) {
  const bytes = new TextEncoder().encode(s)
  const p = mod._malloc(bytes.length + 1)
  mod.HEAPU8.set(bytes, p)
  mod.HEAPU8[p + bytes.length] = 0
  return p
}

async function load(m) {
  importScripts(URL.createObjectURL(new Blob([m.js], { type: 'text/javascript' })))
  mod = await createNeedle({ wasmBinary: new Uint8Array(m.wasm) })
  const blob = new Uint8Array(m.cact)
  const p = mod._malloc(blob.length) // kept for the life of the worker: the engine reads weights in place
  mod.HEAPU8.set(blob, p)
  if (mod._needle_load(p, BigInt(blob.length)) !== 0) throw new Error('The model file could not be loaded.')
  outPtr = mod._malloc(OUT_CAP)
  return true
}

function complete(m) {
  const key = `${m.system}\u0000${m.tools}`
  if (key !== initKey) {
    const next = [cstr(m.system), cstr(m.tools)]
    const prefix = mod._needle_init(next[0], next[1], 0)
    if (prefix < 0) {
      next.forEach((p) => mod._free(p))
      initKey = null
      throw new Error(`needle_init failed (${prefix}): the tool schema may not fit the context window.`)
    }
    initPtrs.forEach((p) => mod._free(p))
    initPtrs = next
    initKey = key
  }
  mod._needle_reset() // one-shot: every call starts a fresh conversation
  const input = cstr(m.input)
  try {
    mod.HEAPU8[outPtr] = 0
    mod._needle_complete(input, m.maxNewTokens || 128, outPtr, OUT_CAP)
    return mod.UTF8ToString(outPtr)
  } finally {
    mod._free(input)
  }
}

self.onmessage = async (e) => {
  const m = e.data
  try {
    const result = m.type === 'load' ? await load(m) : complete(m)
    self.postMessage({ id: m.id, ok: true, result })
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) })
  }
}
