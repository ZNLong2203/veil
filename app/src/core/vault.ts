import { PII_KINDS, type PiiKind, type Span, type SpanSource } from './types'

/**
 * The vault maps personal values to stable placeholders ("[PERSON_1]") and back.
 * It lives only in memory in the user's tab. It is never serialised, logged or sent anywhere.
 *
 * The redacted text is always *derived* from the original text plus the vault, which makes
 * the review step trivial: removing or adding a vault entry and re-deriving is all it takes.
 */

export interface VaultEntry {
  token: string
  kind: PiiKind
  value: string
  source: SpanSource
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** Case/whitespace-insensitive identity of a value. */
export function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
}

const BOUND_BEFORE = '(?<![\\p{L}\\p{N}])'
const BOUND_AFTER = '(?![\\p{L}\\p{N}])'

const KIND_ALT = PII_KINDS.join('|')
const TOKEN_RE = new RegExp(`\\[(${KIND_ALT})_(\\d+)\\]`, 'g')
/** Lenient: the model may drop the brackets or change the case. */
const LENIENT_TOKEN_RE = new RegExp(`\\[?\\b(${KIND_ALT})_(\\d+)\\b\\]?`, 'gi')

export class Vault {
  private byKey = new Map<string, VaultEntry>()
  private byToken = new Map<string, VaultEntry>()
  private counters = new Map<PiiKind, number>()

  get size() {
    return this.byToken.size
  }

  entries(): VaultEntry[] {
    return [...this.byToken.values()]
  }

  /** Register a value (idempotent) and return its entry. */
  add(kind: PiiKind, value: string, source: SpanSource): VaultEntry | null {
    const clean = value.trim().replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
    if (clean.length < 2) return null
    const key = normalize(clean)
    const existing = this.byKey.get(key)
    if (existing) return existing
    const n = (this.counters.get(kind) ?? 0) + 1
    this.counters.set(kind, n)
    const entry: VaultEntry = { token: `[${kind}_${n}]`, kind, value: clean, source }
    this.byKey.set(key, entry)
    this.byToken.set(entry.token, entry)
    return entry
  }

  addSpans(spans: Span[]) {
    for (const s of spans) this.add(s.kind, s.text, s.source)
  }

  /** Remove a placeholder, i.e. the user decided that value is not sensitive. */
  remove(token: string) {
    const entry = this.byToken.get(token)
    if (!entry) return
    this.byToken.delete(token)
    this.byKey.delete(normalize(entry.value))
  }

  clear() {
    this.byKey.clear()
    this.byToken.clear()
    this.counters.clear()
  }

  /** Replace every occurrence of every known value, longest first, on word boundaries. */
  apply(text: string): string {
    if (this.byToken.size === 0) return text
    const values = this.entries()
      .map((e) => e.value)
      .sort((a, b) => b.length - a.length)
    const re = new RegExp(`${BOUND_BEFORE}(?:${values.map((v) => escapeRe(v).replace(/\s+/g, '\\s+')).join('|')})${BOUND_AFTER}`, 'giu')
    return text.replace(re, (m) => this.byKey.get(normalize(m))?.token ?? m)
  }

  /** Put the real values back into text that came back from the cloud. */
  rehydrate(text: string): string {
    const swap = (full: string, kind: string, n: string) => {
      const entry = this.byToken.get(`[${kind.toUpperCase()}_${n}]`)
      return entry ? entry.value : full
    }
    return text.replace(TOKEN_RE, swap).replace(LENIENT_TOKEN_RE, swap)
  }

  /** Every original value that appears in `text`, as `{token, kind}` (never the value itself). */
  findLeaks(text: string): Array<{ token: string; kind: PiiKind }> {
    const leaks: Array<{ token: string; kind: PiiKind }> = []
    for (const e of this.byToken.values()) {
      const re = new RegExp(`${BOUND_BEFORE}${escapeRe(e.value).replace(/\s+/g, '\\s+')}${BOUND_AFTER}`, 'iu')
      if (re.test(text)) leaks.push({ token: e.token, kind: e.kind })
    }
    return leaks
  }
}
