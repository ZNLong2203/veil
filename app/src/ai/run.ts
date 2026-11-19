import { InferenceSource, type GenerativeModel, type Part } from 'firebase/ai'
import { assertSafeForCloud, EgressBlockedError } from '../core/egress'
import { ledger } from '../core/ledger'
import { canReachCloud, POLICY, type Route, type TaskId } from '../core/policy'
import type { ExecutedOn } from '../core/types'
import type { Vault } from '../core/vault'

export interface RunResult {
  text: string
  executedOn: 'ON_DEVICE' | 'IN_CLOUD'
}

export interface RunInput {
  task: TaskId
  model: GenerativeModel
  parts: Array<string | Part>
  /** Exactly the text that may leave the device (checked by the egress guard). */
  outbound: string
  vault: Vault
  /** The route the planner chose for this run. Defaults to the task's policy route. */
  route?: Route
  /** Shown in the ledger next to a successful step. */
  note?: string
}

/**
 * The only function in the app that calls `generateContent`. It enforces the privacy contract:
 *   1. before any request that *could* reach the cloud, the egress guard re-checks the payload;
 *   2. after the request, the SDK-reported `inferenceSource` is written to the ledger;
 *   3. a task that handled raw data must have run on-device, otherwise the result is discarded.
 */
export async function runTask({ task, model, parts, outbound, vault, route: plannedRoute, note }: RunInput): Promise<RunResult> {
  const policy = POLICY[task]
  // Raw-data tasks can never be re-routed: the policy route is the only one they may use.
  const route: Route = policy.input === 'raw' ? policy.route : (plannedRoute ?? policy.route)
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const log = (executedOn: ExecutedOn, extra: { charsSent?: number; note?: string } = {}) =>
    ledger.add({
      task,
      route,
      executedOn,
      charsSent: extra.charsSent ?? 0,
      redactions: vault.size,
      durationMs: elapsed(),
      note: extra.note,
    })

  if (canReachCloud(route)) {
    try {
      assertSafeForCloud(outbound, vault)
    } catch (err) {
      if (err instanceof EgressBlockedError) log('BLOCKED', { note: err.message })
      throw err
    }
  }

  let result
  try {
    result = await model.generateContent(parts)
  } catch (err) {
    log('FAILED', { note: err instanceof Error ? err.message : String(err) })
    throw err
  }

  // `inferenceSource` is reported by the SDK for hybrid models. If it is somehow missing, assume
  // the more conservative answer: a route that can reach the cloud is treated as having done so.
  const source = result.response.inferenceSource
  const executedOn: 'ON_DEVICE' | 'IN_CLOUD' =
    source === InferenceSource.ON_DEVICE ? 'ON_DEVICE' : source === InferenceSource.IN_CLOUD ? 'IN_CLOUD' : canReachCloud(route) ? 'IN_CLOUD' : 'ON_DEVICE'

  if (policy.input === 'raw' && executedOn !== 'ON_DEVICE') {
    log(executedOn, { charsSent: outbound.length, note: 'Raw-data task ran off-device; result discarded.' })
    throw new Error(`Privacy contract violated: "${task}" handles raw data but ran in the cloud.`)
  }

  log(executedOn, { charsSent: executedOn === 'IN_CLOUD' ? outbound.length : 0, note })
  return { text: result.response.text(), executedOn }
}
