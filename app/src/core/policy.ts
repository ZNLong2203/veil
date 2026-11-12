/**
 * Veil's routing policy: which model may see which data.
 *
 * Hybrid inference is usually pitched as an availability fallback. Veil uses it as a
 * *data-sensitivity router*: every AI task declares what kind of input it receives, and
 * that decides the only routes it is allowed to take.
 *
 *   raw input      (original document, image pixels)  → ON_DEVICE_ONLY, can never fall back to cloud
 *   redacted input (placeholders instead of PII)      → any route; the egress guard still runs
 *
 * This file is SDK-free so the invariant can be unit-tested. `ai/models.ts` maps `Route`
 * onto Firebase AI Logic's `InferenceMode`.
 */

export type Route = 'ON_DEVICE_ONLY' | 'PREFER_ON_DEVICE' | 'PREFER_CLOUD' | 'CLOUD_ONLY'

export type TaskId = 'readImage' | 'findEntities' | 'triage' | 'explain' | 'followUp'

export type InputClass = 'raw' | 'redacted'

export interface TaskPolicy {
  id: TaskId
  label: string
  route: Route
  input: InputClass
  /** One sentence shown in the UI and the docs: why this route? */
  why: string
}

export const POLICY: Record<TaskId, TaskPolicy> = {
  readImage: {
    id: 'readImage',
    label: 'Read photo of document',
    route: 'ON_DEVICE_ONLY',
    input: 'raw',
    why: 'The photo contains everything about you, so it is read by Gemini Nano on this device and is never uploaded.',
  },
  findEntities: {
    id: 'findEntities',
    label: 'Find personal data',
    route: 'ON_DEVICE_ONLY',
    input: 'raw',
    why: 'Finding names and addresses requires reading the original text, so it may only run on this device.',
  },
  triage: {
    id: 'triage',
    label: 'Identify document type',
    route: 'PREFER_ON_DEVICE',
    input: 'redacted',
    why: 'A short classification: free and instant on-device. The text is already redacted, so the cloud fallback is safe.',
  },
  explain: {
    id: 'explain',
    label: 'Explain in plain language',
    route: 'PREFER_CLOUD',
    input: 'redacted',
    why: 'Long documents and translation need the larger cloud model. If you go offline, Gemini Nano takes over with a shorter English summary.',
  },
  followUp: {
    id: 'followUp',
    label: 'Answer follow-up question',
    route: 'PREFER_CLOUD',
    input: 'redacted',
    why: 'Follow-ups reuse the redacted document. Chat is not available on-device, so each question is sent as a single self-contained prompt.',
  },
}

/** Routes that can put a request on the network. */
export const CLOUD_CAPABLE: ReadonlySet<Route> = new Set(['PREFER_ON_DEVICE', 'PREFER_CLOUD', 'CLOUD_ONLY'])

export function canReachCloud(route: Route): boolean {
  return CLOUD_CAPABLE.has(route)
}

/**
 * The core privacy invariant. Returns the ids of tasks that would let raw data reach the cloud
 * (always empty for `POLICY`; a unit test and a startup assertion keep it that way).
 */
export function policyViolations(policy: Record<string, TaskPolicy> = POLICY): string[] {
  return Object.values(policy)
    .filter((t) => t.input === 'raw' && canReachCloud(t.route))
    .map((t) => t.id)
}

/**
 * Remote kill switch: when the cloud is switched off, any route that could reach it is
 * downgraded to ON_DEVICE_ONLY, so nothing falls back to the network.
 */
export function effectiveRoute(route: Route, cloudEnabled: boolean): Route {
  return cloudEnabled || !canReachCloud(route) ? route : 'ON_DEVICE_ONLY'
}
