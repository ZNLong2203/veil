import { chunkText } from '../core/chunk'
import { detectWithRules } from '../core/rules'
import type { PiiKind, Span } from '../core/types'
import type { EntityDetector } from '../core/redact'
import type { Vault } from '../core/vault'
import { buildModel } from './models'
import { runTask, type RunResult } from './run'
import { getRuntimeConfig } from './runtimeConfig'
import {
  ENTITY_SCHEMA,
  EXPLAIN_COMPACT_SCHEMA,
  EXPLAIN_SCHEMA,
  FOLLOWUP_SCHEMA,
  TRIAGE_SCHEMA,
} from './schemas'

/* ────────────────────────────── prompts ────────────────────────────── */

const PLACEHOLDER_RULES = `The document has had personal data replaced by placeholders such as [PERSON_1], [ADDRESS_2] or [IDNUM_3].
Keep placeholders exactly as written. Never guess, reconstruct or ask for the real value behind a placeholder.`

const SYSTEM_ENTITIES = `You are a privacy filter running on the user's own device. Read the document excerpt and extract only:
- "people": the full name of every private individual, wherever it appears: headers, body text, signatures such as "Sincerely, Marcus Finch", titles such as "Dr. Elena Park". Copy each name exactly as written.
- "addresses": every home or mailing address, exactly as written.
Never include companies, organisations, hospitals, banks or job titles. Never return phone numbers, emails, ID or account numbers, dates, or labels such as "Tel:" or "Patient:". Return only the values. If there are none, return empty lists.

Example excerpt: "Tenant: Li Wei, 5 Oak Lane, Reno NV 89501. Managed by Acme Realty. Signed, Dana Cole (Manager). Call 555-0100."
Example output: {"people":["Li Wei","Dana Cole"],"addresses":["5 Oak Lane, Reno NV 89501"]}`

const SYSTEM_TRIAGE = `You classify documents. ${PLACEHOLDER_RULES}
Return the document type, how urgent it looks (high if there is a near deadline, penalty, or threat of loss), and its language.`

const explainSystem = (language: string) => `You are Veil, a calm and precise assistant that helps non-experts understand sensitive paperwork
(medical bills, leases, insurance letters, government notices, employment and bank documents).
${PLACEHOLDER_RULES}
Write in ${language}, at a 7th-grade reading level, and be concrete: quote the actual amounts, dates and clauses.
Only use facts that are in the document. Mark something as a red flag only if the text supports it, and say why it matters.
You are not a lawyer or a doctor: when a professional should look at something, say so in the next steps.
If the text is not a readable document, say so in plainSummary and leave the other lists empty.`

const SYSTEM_COMPACT = `You are Veil, working offline on the user's device. ${PLACEHOLDER_RULES}
Summarise the document in 2-3 plain English sentences, list any deadlines, and list clear red flags (surprising fees, short deadlines, penalties).
Only use facts from the text.`

const followUpSystem = (language: string) => `You are Veil. Answer the user's question using only the document and the earlier answers below.
${PLACEHOLDER_RULES}
Answer in ${language}. If the document does not say, say that plainly instead of guessing.`

/* ─────────────────────────────── helpers ─────────────────────────────── */

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  return JSON.parse(trimmed) as T
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

/* ───────────────────────── 1. read a photo (on-device only) ───────────────────────── */

export async function readImage(vault: Vault, base64: string, mimeType: 'image/jpeg' | 'image/png'): Promise<RunResult> {
  const model = buildModel({
    route: 'ON_DEVICE_ONLY',
    image: true,
    system: 'You transcribe text from photos of documents. Output only the text, preserving line breaks. Do not summarise.',
  })
  return runTask({
    task: 'readImage',
    model,
    parts: ['Transcribe every word in this image.', { type: 'inlineData', inlineData: { mimeType, data: base64 } }],
    outbound: '',
    vault,
  })
}

/* ───────────────── 2. find personal data (on-device only) ───────────────── */

interface RawEntities {
  people?: unknown
  addresses?: unknown
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Validates model output: every entity must literally occur in the chunk it was found in. */
export function entitiesToSpans(raw: RawEntities, chunk: string): Span[] {
  const hay = squash(chunk)
  const spans: Span[] = []
  const take = (values: string[], kind: PiiKind) => {
    for (const value of values) {
      const text = value.trim()
      if (text.length < 2 || text.length > 120) continue
      const at = hay.indexOf(squash(text))
      if (at < 0) continue // hallucinated value: ignore
      spans.push({ start: at, end: at + text.length, kind, text, source: 'on-device' })
    }
  }
  take(asStrings(raw.people), 'PERSON')
  take(asStrings(raw.addresses), 'ADDRESS')
  return spans
}

/** Builds the detector injected into `buildRedaction`. Throws if Gemini Nano is not available. */
export function makeEntityDetector(vault: Vault, onRaw?: (rawModelText: string) => void): EntityDetector {
  const model = buildModel({ route: 'ON_DEVICE_ONLY', system: SYSTEM_ENTITIES, schema: ENTITY_SCHEMA })
  return async (chunk) => {
    const { text } = await runTask({
      task: 'findEntities',
      model,
      parts: [`Document excerpt:\n"""\n${chunk}\n"""`],
      outbound: '',
      vault,
    })
    onRaw?.(text)
    return entitiesToSpans(parseJson<RawEntities>(text), chunk)
  }
}

/* ───────────────────────── 3. triage (prefer on-device) ───────────────────────── */

export interface Triage {
  documentType: string
  urgency: 'low' | 'medium' | 'high'
  language: string
}

export async function triage(vault: Vault, redacted: string): Promise<Triage & { executedOn: RunResult['executedOn'] }> {
  const model = buildModel({ route: 'PREFER_ON_DEVICE', system: SYSTEM_TRIAGE, schema: TRIAGE_SCHEMA, cloudModel: getRuntimeConfig().cloudModelLite })
  const excerpt = chunkText(redacted, 2400)[0] ?? ''
  const prompt = `Document excerpt:\n"""\n${excerpt}\n"""`
  const { text, executedOn } = await runTask({ task: 'triage', model, parts: [prompt], outbound: prompt, vault })
  return { ...parseJson<Triage>(text), executedOn }
}

/* ─────────────────────── 4. explain (prefer cloud, offline → Nano) ─────────────────────── */

export interface Explanation {
  documentType: string
  plainSummary: string
  keyFacts: Array<{ label: string; value: string }>
  deadlines: Array<{ what: string; date: string; consequence?: string }>
  redFlags: Array<{ issue: string; whyItMatters: string; severity: 'low' | 'medium' | 'high' }>
  questionsToAsk: string[]
  nextSteps: string[]
}

export interface ExplainResult {
  explanation: Explanation
  executedOn: RunResult['executedOn']
  /** True when the short offline path was used. */
  compact: boolean
}

export async function explain(vault: Vault, redacted: string, language: string): Promise<ExplainResult> {
  const compact = isOffline() || !getRuntimeConfig().cloudEnabled
  const model = compact
    ? buildModel({ route: 'PREFER_CLOUD', system: SYSTEM_COMPACT, schema: EXPLAIN_COMPACT_SCHEMA, cloudModel: getRuntimeConfig().cloudModel })
    : buildModel({ route: 'PREFER_CLOUD', system: explainSystem(language), schema: EXPLAIN_SCHEMA, cloudModel: getRuntimeConfig().cloudModel })
  const body = compact ? redacted.slice(0, getRuntimeConfig().compactMaxChars) : redacted
  const prompt = `Document (personal data replaced by placeholders):\n"""\n${body}\n"""`
  const { text, executedOn } = await runTask({ task: 'explain', model, parts: [prompt], outbound: prompt, vault })
  return { explanation: normalizeExplanation(parseJson<Partial<Explanation>>(text)), executedOn, compact }
}

export function normalizeExplanation(raw: Partial<Explanation>): Explanation {
  return {
    documentType: raw.documentType ?? 'Document',
    plainSummary: raw.plainSummary ?? '',
    keyFacts: raw.keyFacts ?? [],
    deadlines: raw.deadlines ?? [],
    redFlags: raw.redFlags ?? [],
    questionsToAsk: raw.questionsToAsk ?? [],
    nextSteps: raw.nextSteps ?? [],
  }
}

/* ───────────────────────── 5. follow-up question ───────────────────────── */

export interface QA {
  q: string
  a: string
}

/**
 * The user's question can itself contain personal data, so it goes through the same
 * detectors and vault as the document before it is sent anywhere.
 */
export function redactQuestion(question: string, vault: Vault): string {
  vault.addSpans(detectWithRules(question))
  return vault.apply(question)
}

export async function followUp(
  vault: Vault,
  redactedDoc: string,
  history: QA[],
  question: string,
  language: string,
): Promise<{ answer: string; executedOn: RunResult['executedOn'] }> {
  const model = buildModel({ route: 'PREFER_CLOUD', system: followUpSystem(language), schema: FOLLOWUP_SCHEMA, cloudModel: getRuntimeConfig().cloudModel })
  const safeQuestion = redactQuestion(question, vault)
  const earlier = history.map((h) => `Q: ${vault.apply(h.q)}\nA: ${vault.apply(h.a)}`).join('\n\n')
  const doc = isOffline() || !getRuntimeConfig().cloudEnabled ? redactedDoc.slice(0, getRuntimeConfig().compactMaxChars) : redactedDoc
  const prompt = `Document:\n"""\n${doc}\n"""\n\n${earlier ? `Earlier questions and answers:\n${earlier}\n\n` : ''}Question: ${safeQuestion}`
  const { text, executedOn } = await runTask({ task: 'followUp', model, parts: [prompt], outbound: prompt, vault })
  return { answer: parseJson<{ answer: string }>(text).answer, executedOn }
}
