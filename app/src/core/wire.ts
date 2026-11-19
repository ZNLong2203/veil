import { inspectEgress, type EgressFinding } from './egress'
import type { Vault } from './vault'

/**
 * The wire log: what actually left this browser tab, recorded at the network layer, independent of
 * the app's own bookkeeping. Headers and query strings are never stored (they carry API keys and
 * App Check tokens); only the host, the path, the size and, for AI requests, the text parts.
 */

export type WireKind = 'ai' | 'remote-config' | 'app-check' | 'installations' | 'other'

export interface WireEntry {
  id: number
  at: number
  method: string
  host: string
  /** Path only: no query string. */
  path: string
  bytes: number
  status: number
  kind: WireKind
  /** For AI requests: every text part (system instruction and contents) found in the request body. */
  texts: string[]
}

export function classifyHost(host: string, path: string): WireKind {
  if (/:(stream)?generateContent$/i.test(path) || /firebasevertexai|firebaseml/i.test(host)) return 'ai'
  if (/firebaseremoteconfig/i.test(host)) return 'remote-config'
  if (/appcheck/i.test(host)) return 'app-check'
  if (/firebaseinstallations/i.test(host)) return 'installations'
  return 'other'
}

interface Part {
  text?: unknown
}
interface Content {
  parts?: Part[]
}

/** Pulls the prompt text out of a Gemini request body. Returns [] for anything that is not one. */
export function extractTextParts(body: string | undefined): string[] {
  if (!body) return []
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return []
  }
  const obj = json as { contents?: Content[]; systemInstruction?: Content; system_instruction?: Content }
  const texts: string[] = []
  const take = (c?: Content) => {
    for (const p of c?.parts ?? []) if (typeof p.text === 'string') texts.push(p.text)
  }
  take(obj.systemInstruction ?? obj.system_instruction)
  for (const c of obj.contents ?? []) take(c)
  return texts
}

export const PLACEHOLDER_RE = /\[(?:PERSON|ADDRESS|EMAIL|PHONE|IDNUM|CARD|BANK|DOB|OTHER)_\d+\]/g

export interface WireVerdict {
  placeholders: number
  findings: EgressFinding[]
  /** True when no known personal value and no recognisable identifier is in the request. */
  clean: boolean
}

/** Re-checks the real request body with the vault and the detectors, independent of the app's own guard. */
export function inspectWire(entry: Pick<WireEntry, 'texts'>, vault: Vault): WireVerdict {
  const joined = entry.texts.join('\n')
  const findings = inspectEgress(joined, vault)
  return { placeholders: joined.match(PLACEHOLDER_RE)?.length ?? 0, findings, clean: findings.length === 0 }
}

type Listener = () => void

export class WireLog {
  private entries: readonly WireEntry[] = []
  private listeners = new Set<Listener>()
  private seq = 0

  getSnapshot = (): readonly WireEntry[] => this.entries

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  add(entry: Omit<WireEntry, 'id' | 'at'>): WireEntry {
    const full: WireEntry = { ...entry, id: ++this.seq, at: Date.now() }
    this.entries = [...this.entries, full]
    for (const l of this.listeners) l()
    return full
  }

  clear() {
    this.entries = []
    for (const l of this.listeners) l()
  }
}

export const wireLog = new WireLog()
