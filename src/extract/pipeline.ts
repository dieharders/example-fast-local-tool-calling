import type { FillEngine } from '../engine/types'
import { clauses, type Clause } from './clauses'
import { interpret, type CallResult } from './interpret'
import { systemPrompt } from './normalize'
import { TOOLS, TRIGGERS, type ExtractTool } from './tools'

// paragraph → clauses → (clause, tool) pairs → one-shot Needle calls → form-field updates.
// Calls are grouped by tool so an engine lane initializes each tool's prompt once and then
// only runs completions; lanes pull tool batches in form order, so fields arrive top-down.

export interface PlannedCall {
  tool: ExtractTool
  clause: Clause
}

export interface Plan {
  clauses: Clause[]
  batches: PlannedCall[][]
  total: number
}

export function plan(text: string): Plan {
  const cls = clauses(text, TRIGGERS)
  const batches = TOOLS.map((tool) =>
    cls.filter((c, i) => tool.when(c.text, cls[i - 1]?.text)).map((clause) => ({ tool, clause })),
  ).filter((b) => b.length > 0)
  return { clauses: cls, batches, total: batches.reduce((n, b) => n + b.length, 0) }
}

interface Hooks {
  alive: () => boolean
  onStart: (call: PlannedCall) => void
  onResult: (result: CallResult, call: PlannedCall) => void
}

export async function runPlan(engine: FillEngine, p: Plan, today: Date, hooks: Hooks): Promise<CallResult[]> {
  const queue = [...p.batches]
  const results: CallResult[] = []
  const sys = systemPrompt(today)

  const lane = async (index: number) => {
    for (let batch = queue.shift(); batch; batch = queue.shift()) {
      for (const call of batch) {
        if (!hooks.alive()) return
        hooks.onStart(call)
        const t0 = performance.now()
        let result: CallResult
        try {
          const env = await engine.complete(
            { systemPrompt: call.tool.sys === 'today' ? sys : '', tools: [call.tool.schema], input: call.clause.text, maxNewTokens: 128 },
            { lane: index },
          )
          result = { ...interpret(call.tool, call.clause.text, env, today), ms: performance.now() - t0 }
        } catch (e) {
          result = {
            tool: call.tool.schema.name,
            section: call.tool.section,
            clause: call.clause.text,
            confidence: 0,
            held: false,
            updates: [],
            reasoning: '',
            envelope: null,
            error: e instanceof Error ? e.message : String(e),
            ms: performance.now() - t0,
          }
        }
        if (!hooks.alive()) return
        results.push(result)
        hooks.onResult(result, call)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, engine.lanes) }, (_, i) => lane(i)))
  return results
}
