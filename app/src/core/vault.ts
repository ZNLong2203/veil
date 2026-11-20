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
    let clean = value.trim().replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
    // "Dr. Chen" and "Chen" are one person: keep the title in the text, protect only the name.
    if (kind === 'PERSON') clean = clean.replace(/^(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+/i, '')
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

  /** One regex matching every known value, longest first, on word boundaries (null when empty). */
  private pattern(): RegExp | null {
    if (this.byToken.size === 0) return null
    const values = this.entries()
      .map((e) => e.value)
      .sort((a, b) => b.length - a.length)
    const body = values.map((v) => escapeRe(v).replace(/\s+/g, '\\s+')).join('|')
    return new RegExp(`${BOUND_BEFORE}(?:${body})${BOUND_AFTER}`, 'giu')
  }

  /** Replace every occurrence of every known value with its placeholder. */
  apply(text: string): string {
    const re = this.pattern()
    if (!re) return text
    return text.replace(re, (m) => this.byKey.get(normalize(m))?.token ?? m)
  }

  /** Split `text` into plain and protected runs, for highlighting in the review step. */
  segments(text: string): Array<{ text: string; entry: VaultEntry | null }> {
    const re = this.pattern()
    if (!re) return [{ text, entry: null }]
    const out: Array<{ text: string; entry: VaultEntry | null }> = []
    let last = 0
    for (const m of text.matchAll(re)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), entry: null })
      out.push({ text: m[0], entry: this.byKey.get(normalize(m[0])) ?? null })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last), entry: null })
    return out
  }

  /** Put the real values back into text that came back from the cloud. */
  rehydrate(text: string): string {
    const swap = (full: string, kind: string, n: string) => {
      const entry = this.byToken.get(`[${kind.toUpperCase()}_${n}]`)
      return entry ? entry.value : full
    }
    return text.replace(TOKEN_RE, swap).replace(LENIENT_TOKEN_RE, swap)
  }

  /**
   * Like `rehydrate`, but returns runs so the UI can highlight exactly which parts were filled in
   * on this device. Unknown placeholders stay as they are, marked as not filled.
   */
  fillSegments(text: string): Array<{ text: string; filled: boolean }> {
    const out: Array<{ text: string; filled: boolean }> = []
    let last = 0
    for (const m of text.matchAll(new RegExp(LENIENT_TOKEN_RE.source, 'gi'))) {
      const entry = this.byToken.get(`[${m[1].toUpperCase()}_${m[2]}]`)
      if (!entry) continue
      if (m.index > last) out.push({ text: text.slice(last, m.index), filled: false })
      out.push({ text: entry.value, filled: true })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last), filled: false })
    return out
  }

  /** Rehydrate every string inside a JSON-like value (model output) without re-serialising it. */
  rehydrateDeep<T>(value: T): T {
    if (typeof value === 'string') return this.rehydrate(value) as T
    if (Array.isArray(value)) return value.map((v) => this.rehydrateDeep(v)) as T
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.rehydrateDeep(v)])) as T
    }
    return value
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
