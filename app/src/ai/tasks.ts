import { chunkText } from '../core/chunk'
import { EgressBlockedError } from '../core/egress'
import type { Route } from '../core/policy'
import { detectWithRules } from '../core/rules'
import type { PiiKind, Span } from '../core/types'
import type { EntityDetector } from '../core/redact'
import { Vault } from '../core/vault'
import { NotConfiguredError } from './firebase'
import { buildModel } from './models'
import { runTask, type RunResult } from './run'
import { getRuntimeConfig } from './runtimeConfig'
import {
  ENTITY_SCHEMA,
  EXPLAIN_COMPACT_SCHEMA,
  EXPLAIN_SCHEMA,
  DRAFT_SCHEMA,
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

/* ───────────────────────── 0. warm up Gemini Nano (on-device only) ───────────────────────── */

/** Loads the model into memory so the first real request is fast. Sends nothing anywhere. */
export async function warmUpDevice(): Promise<void> {
  const model = buildModel({ route: 'ON_DEVICE_ONLY', system: 'Reply with the single word OK.' })
  await runTask({ task: 'warmUp', model, parts: ['Ready?'], outbound: '', vault: new Vault(), note: 'Loads the model into memory. No document involved.' })
}

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

export async function triage(
  vault: Vault,
  redacted: string,
  route: Route = 'PREFER_ON_DEVICE',
): Promise<Triage & { executedOn: RunResult['executedOn'] }> {
  const model = buildModel({ route, system: SYSTEM_TRIAGE, schema: TRIAGE_SCHEMA, cloudModel: getRuntimeConfig().cloudModelLite })
  const excerpt = chunkText(redacted, 2400)[0] ?? ''
  const prompt = `Document excerpt:\n"""\n${excerpt}\n"""`
  const { text, executedOn } = await runTask({ task: 'triage', model, parts: [prompt], outbound: prompt, vault, route })
  return { ...parseJson<Triage>(text), executedOn }
}

/* ─────────────────────── 4. explain (prefer cloud, offline → Nano) ─────────────────────── */

export interface Explanation {
  documentType: string
  plainSummary: string
  keyFacts: Array<{ label: string; value: string }>
  deadlines: Array<{ what: string; date: string; isoDate?: string; consequence?: string }>
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

/** What the planner decided for the redacted-text generation steps (explain, follow-up, drafts). */
export interface GenChoice {
  route: Route
  /** Use the short on-device variant (smaller schema, truncated text). */
  compact: boolean
}

/** Fallback when no plan is supplied: prefer the cloud, go compact when offline or the cloud is off. */
export const defaultGenChoice = (): GenChoice => ({ route: 'PREFER_CLOUD', compact: isOffline() || !getRuntimeConfig().cloudEnabled })

/** One try at a generation step: which route, which cloud model, which variant. */
export interface Attempt {
  route: Route
  cloudModel: string
  compact: boolean
  timeoutMs?: number
}

export const CLOUD_TIMEOUT_MS = 20_000

/**
 * Model-level resilience in front of the SDK's own cloud-to-device fallback. For a cloud-preferred
 * step: try the main model, then the lighter one (each with a short timeout, because a busy model can
 * otherwise hold a request for minutes), and only then run the short variant on-device. If everything
 * fails, the first (cloud) error is reported, since that is the real cause. A blocked egress or a
 * missing configuration is never retried.
 */
export async function withCloudFallback<T>(
  choice: GenChoice,
  models: { main: string; lite: string },
  attempt: (a: Attempt) => Promise<T>,
): Promise<{ value: T; compact: boolean }> {
  if (choice.route !== 'PREFER_CLOUD') {
    return { value: await attempt({ route: choice.route, cloudModel: models.main, compact: choice.compact }), compact: choice.compact }
  }
  const tries: Attempt[] = [{ route: 'CLOUD_ONLY', cloudModel: models.main, compact: false, timeoutMs: CLOUD_TIMEOUT_MS }]
  if (models.lite && models.lite !== models.main) tries.push({ route: 'CLOUD_ONLY', cloudModel: models.lite, compact: false, timeoutMs: CLOUD_TIMEOUT_MS })
  tries.push({ route: 'ON_DEVICE_ONLY', cloudModel: models.main, compact: true })

  let first: unknown
  for (const t of tries) {
    try {
      return { value: await attempt(t), compact: t.compact }
    } catch (e) {
      if (e instanceof EgressBlockedError || e instanceof NotConfiguredError) throw e
      first ??= e
    }
  }
  throw first
}

/** Ledger note for a generation attempt: which cloud model ran, or that the short on-device variant did. */
const modelNote = (a: Attempt): string | undefined => (a.route === 'CLOUD_ONLY' ? a.cloudModel : a.compact ? 'short on-device variant' : undefined)

const cloudModels = () => ({ main: getRuntimeConfig().cloudModel, lite: getRuntimeConfig().cloudModelLite })

export async function explain(vault: Vault, redacted: string, language: string, choice: GenChoice = defaultGenChoice()): Promise<ExplainResult> {
  const { value, compact } = await withCloudFallback(choice, cloudModels(), async (a) => {
    const model = a.compact
      ? buildModel({ route: a.route, system: SYSTEM_COMPACT, schema: EXPLAIN_COMPACT_SCHEMA, cloudModel: a.cloudModel, timeoutMs: a.timeoutMs })
      : buildModel({ route: a.route, system: explainSystem(language), schema: EXPLAIN_SCHEMA, cloudModel: a.cloudModel, timeoutMs: a.timeoutMs })
    const body = a.compact ? redacted.slice(0, getRuntimeConfig().compactMaxChars) : redacted
    const prompt = `Document (personal data replaced by placeholders):\n"""\n${body}\n"""`
    return runTask({ task: 'explain', model, parts: [prompt], outbound: prompt, vault, route: a.route, note: modelNote(a) })
  })
  return { explanation: normalizeExplanation(parseJson<Partial<Explanation>>(value.text)), executedOn: value.executedOn, compact }
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
  choice: GenChoice = defaultGenChoice(),
): Promise<{ answer: string; executedOn: RunResult['executedOn'] }> {
  const safeQuestion = redactQuestion(question, vault)
  const earlier = history.map((h) => `Q: ${vault.apply(h.q)}\nA: ${vault.apply(h.a)}`).join('\n\n')
  const { value } = await withCloudFallback(choice, cloudModels(), async (a) => {
    const model = buildModel({ route: a.route, system: followUpSystem(language), schema: FOLLOWUP_SCHEMA, cloudModel: a.cloudModel, timeoutMs: a.timeoutMs })
    const doc = a.compact ? redactedDoc.slice(0, getRuntimeConfig().compactMaxChars) : redactedDoc
    const prompt = `Document:\n"""\n${doc}\n"""\n\n${earlier ? `Earlier questions and answers:\n${earlier}\n\n` : ''}Question: ${safeQuestion}`
    return runTask({ task: 'followUp', model, parts: [prompt], outbound: prompt, vault, route: a.route, note: modelNote(a) })
  })
  return { answer: parseJson<{ answer: string }>(value.text).answer, executedOn: value.executedOn }
}

/* ───────────────────────── 6. action kit: letter or call script ───────────────────────── */

export type DraftKind = 'letter' | 'call'

export interface Draft {
  kind: DraftKind
  topic: string
  subject: string
  /** Exactly as the model wrote it, with placeholders. Filled in only for display. */
  redactedBody: string
  executedOn: RunResult['executedOn']
}

const PLACEHOLDER_NOTE = `Use the placeholders exactly as they appear in the document (for example [PERSON_1], [ADDRESS_1], [IDNUM_2]) wherever a personal detail belongs. The real values are filled in later on the user's own device. Never invent a name, number or address.`

const draftSystem = (kind: DraftKind, writeIn: string) =>
  kind === 'letter'
    ? `You write formal letters for ordinary people dealing with paperwork. ${PLACEHOLDER_NOTE}
Write in ${writeIn}. The writer is the person the document is about or addressed to (the patient, tenant, insured or account holder), and the recipient is the organisation that sent it.
Be polite, firm and specific: quote the amounts, dates and reference numbers from the document, state the problem, make one clear request, and ask for a written reply within 14 days. Keep it under 250 words.
Put the line "[Date]" where the date goes and leave the rest to the document. Do not give legal advice and do not threaten legal action. Plain text only, no markdown.`
    : `You write short phone scripts for ordinary people who must call an organisation about their paperwork. ${PLACEHOLDER_NOTE}
Write in ${writeIn}. Give: an opening line that states who is calling and the reference number, the exact request, four questions to ask, what to write down during the call (name of the agent, date and time, call reference), and what to say if the agent pushes back. Short lines, plain text, no markdown.`

export async function draftAction(
  vault: Vault,
  redactedDoc: string,
  opts: { kind: DraftKind; topic: string; writeIn: string },
  choice: GenChoice = defaultGenChoice(),
): Promise<Draft> {
  const topic = vault.apply(opts.topic)
  const { value } = await withCloudFallback(choice, cloudModels(), async (a) => {
    const model = buildModel({ route: a.route, system: draftSystem(opts.kind, opts.writeIn), schema: DRAFT_SCHEMA, cloudModel: a.cloudModel, temperature: 0.4, timeoutMs: a.timeoutMs })
    const doc = a.compact ? redactedDoc.slice(0, getRuntimeConfig().compactMaxChars) : redactedDoc
    const prompt = `Document (personal data replaced by placeholders):\n"""\n${doc}\n"""\n\nTopic: ${topic}`
    return runTask({ task: 'draft', model, parts: [prompt], outbound: prompt, vault, route: a.route, note: modelNote(a) })
  })
  const parsed = parseJson<{ subject?: string; body?: string }>(value.text)
  return { kind: opts.kind, topic, subject: parsed.subject ?? '', redactedBody: parsed.body ?? '', executedOn: value.executedOn }
}
