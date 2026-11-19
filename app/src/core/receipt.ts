import type { LedgerEntry } from './ledger'
import { summarize } from './ledger'
import { PII_LABELS, type PiiKind } from './types'
import type { Vault } from './vault'
import { inspectWire, type WireEntry } from './wire'

/**
 * A privacy receipt: evidence of what a session did, that you can keep or share. It contains sizes,
 * counts, categories and SHA-256 hashes, and never any document text or personal value.
 */

export interface Receipt {
  veilReceipt: 1
  generatedAt: string
  summary: {
    protectedValues: number
    protectedByKind: Partial<Record<PiiKind, number>>
    steps: number
    ranOnDevice: number
    ranInCloud: number
    blockedByGuard: number
    charsSentToCloud: number
    requestsLeavingTheBrowser: number
    aiRequests: number
    aiRequestsWithPersonalData: number
  }
  steps: Array<{ task: string; route: string; executedOn: string; charsSent: number; ms: number }>
  requests: Array<{
    method: string
    host: string
    path: string
    kind: string
    bytes: number
    status: number
    placeholders: number
    findings: Array<{ kind: string; via: string; count: number }>
    textSha256?: string
  }>
  statement: string
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function buildReceipt(input: {
  ledger: readonly LedgerEntry[]
  wire: readonly WireEntry[]
  vault: Vault
  now?: Date
}): Promise<Receipt> {
  const { ledger, wire, vault } = input
  const s = summarize(ledger)

  const byKind: Partial<Record<PiiKind, number>> = {}
  for (const e of vault.entries()) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1

  const requests: Receipt['requests'] = []
  for (const w of wire) {
    const verdict = w.kind === 'ai' ? inspectWire(w, vault) : null
    requests.push({
      method: w.method,
      host: w.host,
      path: w.path,
      kind: w.kind,
      bytes: w.bytes,
      status: w.status,
      placeholders: verdict?.placeholders ?? 0,
      // kinds and counts only: findings never carry the matched value
      findings: verdict?.findings.map((f) => ({ kind: f.kind, via: f.via, count: f.count })) ?? [],
      textSha256: w.texts.length > 0 ? await sha256Hex(w.texts.join('\n')) : undefined,
    })
  }
  const ai = requests.filter((r) => r.kind === 'ai')

  return {
    veilReceipt: 1,
    generatedAt: (input.now ?? new Date()).toISOString(),
    summary: {
      protectedValues: vault.size,
      protectedByKind: byKind,
      steps: s.calls,
      ranOnDevice: s.onDevice,
      ranInCloud: s.inCloud,
      blockedByGuard: s.blocked,
      charsSentToCloud: s.charsSent,
      requestsLeavingTheBrowser: requests.length,
      aiRequests: ai.length,
      aiRequestsWithPersonalData: ai.filter((r) => r.findings.length > 0).length,
    },
    steps: ledger
      .filter((e) => e.executedOn !== 'LOCAL')
      .map((e) => ({ task: e.task, route: e.route, executedOn: e.executedOn, charsSent: e.charsSent, ms: e.durationMs })),
    requests,
    statement:
      'This receipt was generated in the browser by Veil. It lists what ran where and what left the tab. It contains no document text and no personal values: only counts, categories and hashes. The hash lets you verify a saved request body without revealing it.',
  }
}

export function receiptToMarkdown(r: Receipt): string {
  const kinds = Object.entries(r.summary.protectedByKind)
    .map(([k, n]) => `${PII_LABELS[k as PiiKind]} ×${n}`)
    .join(', ')
  const lines = [
    '# Veil privacy receipt',
    '',
    `Generated: ${r.generatedAt}`,
    '',
    `- Personal values protected: **${r.summary.protectedValues}**${kinds ? ` (${kinds})` : ''}`,
    `- AI steps: ${r.summary.steps} (${r.summary.ranOnDevice} on this device, ${r.summary.ranInCloud} in the cloud, ${r.summary.blockedByGuard} blocked by the guard)`,
    `- Text sent to the cloud: ${r.summary.charsSentToCloud.toLocaleString('en-US')} characters, redacted`,
    `- Requests that left the browser: ${r.summary.requestsLeavingTheBrowser}, of which AI requests: ${r.summary.aiRequests}`,
    `- AI requests containing personal data: **${r.summary.aiRequestsWithPersonalData}**`,
    '',
    '## Steps',
    ...r.steps.map((s) => `- ${s.task}: ${s.executedOn} (${s.route}), ${s.ms} ms, ${s.charsSent} chars sent`),
    '',
    '## Requests',
    ...r.requests.map(
      (q) => `- ${q.method} ${q.host}${q.path} (${q.kind}) ${q.bytes} B, status ${q.status}${q.kind === 'ai' ? `, ${q.placeholders} placeholders, ${q.findings.length === 0 ? 'no personal data' : 'PERSONAL DATA FOUND'}` : ''}${q.textSha256 ? `, sha256 ${q.textSha256.slice(0, 16)}…` : ''}`,
    ),
    '',
    `> ${r.statement}`,
  ]
  return lines.join('\n')
}
