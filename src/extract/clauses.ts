// Cut a messy paragraph into short, request-sized clauses. Needle 3 is trained on short
// requests ("set a timer for 10 minutes"), so one fact per clause is what it reads best.
// Offsets point back into the original text so the UI can highlight the clause being read.

export interface Clause {
  text: string
  start: number
  end: number
}

type Trigger = (clause: string, prev: string | undefined) => boolean

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu
const SENTENCE_END = /[.!?]+(?=\s|$)|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu
const FRAGMENT_CUT =
  /,\s*|\s+\+\s+|;\s*|\s+but\s+|\s+or\s+|\s+(?=to \d)|\s+(?=on the \d)|\s+(?=by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/gi
const EDGE = /[\s.,!?~;:()]/
const INTERJECTION = /^(yo|hey|hi|hello|ok(ay)?|so|um+|uh+|well|oh)\b[\s,!.]*/i
// "that's W-H-I-T-F-I-E-L-D" spells out a name that was already given.
const SPELLED = /^that'?s\s+([a-z]-){2,}[a-z]\b/i
// Fragments that grammatically continue the previous one: "is 831…", "unit B", "in Santa Cruz".
const CONTINUES = /^(is|are|was|were|and|or|which|who|in case|unit|apt|apartment|suite|ste|#|in [A-Z])\b/

function trim(text: string, start: number, end: number): Clause | null {
  while (start < end && EDGE.test(text[start])) start++
  while (end > start && EDGE.test(text[end - 1])) end--
  const lead = INTERJECTION.exec(text.slice(start, end))
  if (lead && lead[0].length < end - start) start += lead[0].length
  return end > start ? { text: text.slice(start, end), start, end } : null
}

function split(text: string, re: RegExp, from: number, to: number): Clause[] {
  const out: Clause[] = []
  const slice = text.slice(from, to)
  let last = 0
  for (const m of slice.matchAll(re)) {
    const at = m.index ?? 0
    const piece = trim(text, from + last, from + at)
    if (piece) out.push(piece)
    last = at + m[0].length
  }
  const tail = trim(text, from + last, to)
  if (tail) out.push(tail)
  return out
}

export function clauses(text: string, triggers: Trigger[]): Clause[] {
  const out: Clause[] = []
  for (const sentence of split(text, SENTENCE_END, 0, text.length)) {
    const local: Clause[] = []
    for (const frag of split(text, FRAGMENT_CUT, sentence.start, sentence.end)) {
      if (SPELLED.test(frag.text)) continue
      const prev = local[local.length - 1]
      const own = triggers.some((t) => t(frag.text, prev?.text))
      if (prev && (CONTINUES.test(frag.text) || !own)) {
        const merged = { text: text.slice(prev.start, frag.end), start: prev.start, end: frag.end }
        local[local.length - 1] = merged
      } else {
        local.push(frag)
      }
    }
    out.push(...local)
  }
  return out.map((c) => ({ ...c, text: c.text.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim() }))
}
