import type { ExecutedOn } from './types'
import type { Route, TaskId } from './policy'

/**
 * The Privacy Ledger: an append-only record of every AI step in this session, built from what
 * the Firebase AI Logic SDK reports (`inferenceSource`), not from what we hoped would happen.
 * It never stores document text or personal values, only sizes and counts.
 */

export interface LedgerEntry {
  id: number
  at: number
  task: TaskId
  route: Route
  executedOn: ExecutedOn
  /** Characters of text that were sent over the network (0 when it ran locally or was blocked). */
  charsSent: number
  /** How many personal values were swapped for placeholders in what was sent. */
  redactions: number
  durationMs: number
  note?: string
}

export interface LedgerSummary {
  calls: number
  onDevice: number
  inCloud: number
  blocked: number
  charsSent: number
}

type Listener = () => void

export class Ledger {
  private entries: readonly LedgerEntry[] = []
  private listeners = new Set<Listener>()
  private seq = 0

  /** Stable snapshot for `useSyncExternalStore`. */
  getSnapshot = (): readonly LedgerEntry[] => this.entries

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  add(entry: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
    const full: LedgerEntry = { ...entry, id: ++this.seq, at: Date.now() }
    this.entries = [...this.entries, full]
    for (const l of this.listeners) l()
    return full
  }

  clear() {
    this.entries = []
    for (const l of this.listeners) l()
  }
}

export function summarize(entries: readonly LedgerEntry[]): LedgerSummary {
  const s: LedgerSummary = { calls: 0, onDevice: 0, inCloud: 0, blocked: 0, charsSent: 0 }
  for (const e of entries) {
    if (e.executedOn === 'ON_DEVICE') s.onDevice++
    else if (e.executedOn === 'IN_CLOUD') s.inCloud++
    else if (e.executedOn === 'BLOCKED') s.blocked++
    if (e.executedOn !== 'LOCAL') s.calls++
    s.charsSent += e.charsSent
  }
  return s
}

export const ledger = new Ledger()
