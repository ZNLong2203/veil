import { detectWithRules } from './rules'
import type { PiiKind } from './types'
import type { Vault } from './vault'

/**
 * Egress guard: the last line of defence before any payload may reach a cloud model.
 *
 * It re-checks the *final* string two independent ways:
 *   1. no value registered in the vault may appear in it, and
 *   2. the deterministic detectors must find nothing new in it.
 *
 * Findings only ever report the *kind* and a count, never the matched value, so the error
 * message itself cannot become a leak.
 */

export interface EgressFinding {
  kind: PiiKind
  via: 'vault' | 'rules'
  count: number
}

export class EgressBlockedError extends Error {
  readonly findings: EgressFinding[]
  constructor(findings: EgressFinding[]) {
    const summary = findings.map((f) => `${f.count}× ${f.kind} (${f.via})`).join(', ')
    super(`Blocked: payload still contains personal data — ${summary}`)
    this.name = 'EgressBlockedError'
    this.findings = findings
  }
}

export function inspectEgress(payload: string, vault: Vault): EgressFinding[] {
  const tally = new Map<string, EgressFinding>()
  const bump = (kind: PiiKind, via: 'vault' | 'rules') => {
    const key = `${via}:${kind}`
    const cur = tally.get(key)
    if (cur) cur.count++
    else tally.set(key, { kind, via, count: 1 })
  }
  for (const leak of vault.findLeaks(payload)) bump(leak.kind, 'vault')
  for (const span of detectWithRules(payload)) bump(span.kind, 'rules')
  return [...tally.values()]
}

/** Throws `EgressBlockedError` unless `payload` is clean. Call this right before every cloud request. */
export function assertSafeForCloud(payload: string, vault: Vault): void {
  const findings = inspectEgress(payload, vault)
  if (findings.length > 0) throw new EgressBlockedError(findings)
}
