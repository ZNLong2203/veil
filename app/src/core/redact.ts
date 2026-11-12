import { chunkText } from './chunk'
import { detectWithRules } from './rules'
import type { Span } from './types'
import type { Vault } from './vault'

/**
 * Builds the redaction for a document: deterministic rules first, then (optionally) a model
 * that runs ON-DEVICE ONLY to catch names and addresses the rules cannot know about.
 * The model is injected so this module stays testable and SDK-free.
 */

export type EntityDetector = (chunk: string) => Promise<Span[]>

export interface RedactionReport {
  /** Spans found by plain code. */
  rulesFound: number
  /** Distinct values added by the on-device model beyond what the rules found. */
  modelAdded: number
  /** True when the on-device model ran over the whole document without error. */
  modelCovered: boolean
  /** Why the model pass did not complete, if it did not. */
  modelError?: string
}

export interface BuildOptions {
  detect?: EntityDetector
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export async function buildRedaction(text: string, vault: Vault, opts: BuildOptions = {}): Promise<RedactionReport> {
  const before = vault.size
  vault.addSpans(detectWithRules(text))
  const rulesFound = vault.size - before

  const report: RedactionReport = { rulesFound, modelAdded: 0, modelCovered: false }
  if (!opts.detect) return report

  const chunks = chunkText(text)
  const sizeAfterRules = vault.size
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      opts.onProgress?.(i, chunks.length)
      vault.addSpans(await opts.detect(chunks[i]))
    }
    opts.onProgress?.(chunks.length, chunks.length)
    report.modelCovered = true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    report.modelError = err instanceof Error ? err.message : String(err)
  }
  report.modelAdded = vault.size - sizeAfterRules
  return report
}
