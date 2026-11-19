import type { Route, TaskId } from './policy'

/**
 * Custom routing. The static policy says what a task MAY do; the planner decides, for this
 * document and this device right now, what it WILL do and why. It is pure so it can be tested
 * and so the UI can show the plan before anything runs.
 */

export type LangCode = 'en' | 'es' | 'ja' | 'vi' | 'zh' | 'ko' | 'fr' | 'de' | 'pt' | 'it' | 'ru' | 'ar' | 'hi' | 'other'

export interface Language {
  code: LangCode
  label: string
}

const LABELS: Record<LangCode, string> = {
  en: 'English', es: 'Spanish', ja: 'Japanese', vi: 'Vietnamese', zh: 'Chinese', ko: 'Korean', fr: 'French',
  de: 'German', pt: 'Portuguese', it: 'Italian', ru: 'Russian', ar: 'Arabic', hi: 'Hindi', other: 'Unknown language',
}

/** Input languages Gemini Nano officially supports in Chrome. */
export const NANO_LANGS: ReadonlySet<LangCode> = new Set<LangCode>(['en', 'es', 'ja'])

const STOPWORDS: Partial<Record<LangCode, string[]>> = {
  en: ['the', 'and', 'of', 'to', 'is', 'in', 'for', 'that', 'with', 'your', 'you', 'this', 'by', 'are', 'on'],
  es: ['el', 'la', 'de', 'que', 'y', 'en', 'los', 'del', 'las', 'por', 'un', 'para', 'con', 'una', 'su', 'se'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'en', 'un', 'une', 'du', 'pour', 'que', 'vous', 'est', 'dans'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'für', 'den', 'ein', 'eine', 'sie', 'zu', 'von', 'auf'],
  pt: ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'os', 'uma', 'não', 'por'],
  it: ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'con', 'del', 'una', 'non', 'le', 'sono', 'della'],
}

const VI_DIACRITICS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/g

function ratio(text: string, re: RegExp, letters: number): number {
  return (text.match(re)?.length ?? 0) / letters
}

/** A small, dependency-free language guess: scripts first, then Vietnamese diacritics, then stopwords. */
export function guessLanguage(text: string): Language {
  const s = text.slice(0, 4000)
  const letters = s.match(/\p{L}/gu)?.length ?? 0
  if (letters < 12) return { code: 'other', label: LABELS.other }

  if (ratio(s, /[\p{Script=Hiragana}\p{Script=Katakana}]/gu, letters) > 0.05) return { code: 'ja', label: LABELS.ja }
  if (ratio(s, /\p{Script=Han}/gu, letters) > 0.3) return { code: 'zh', label: LABELS.zh }
  if (ratio(s, /\p{Script=Hangul}/gu, letters) > 0.3) return { code: 'ko', label: LABELS.ko }
  if (ratio(s, /\p{Script=Arabic}/gu, letters) > 0.3) return { code: 'ar', label: LABELS.ar }
  if (ratio(s, /\p{Script=Devanagari}/gu, letters) > 0.3) return { code: 'hi', label: LABELS.hi }
  if (ratio(s, /\p{Script=Cyrillic}/gu, letters) > 0.3) return { code: 'ru', label: LABELS.ru }
  if (ratio(s.toLowerCase(), VI_DIACRITICS, letters) > 0.06) return { code: 'vi', label: LABELS.vi }

  const words = s.toLowerCase().match(/\p{L}+/gu) ?? []
  let best: LangCode = 'other'
  let bestScore = 0
  for (const [code, list] of Object.entries(STOPWORDS) as Array<[LangCode, string[]]>) {
    const set = new Set(list)
    const hits = words.filter((w) => set.has(w)).length
    if (hits > bestScore) {
      best = code
      bestScore = hits
    }
  }
  return bestScore >= 3 && bestScore / words.length > 0.05 ? { code: best, label: LABELS[best] } : { code: 'other', label: LABELS.other }
}

/** Rough token estimate (about 4 characters per token for Latin scripts). */
export const estimateTokens = (chars: number) => Math.ceil(chars / 4)

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' | 'unknown'

export interface Signals {
  docChars: number
  language: Language
  /** Language the user wants the explanation in. */
  targetLanguage: string
  online: boolean
  saveData: boolean
  effectiveType?: string
  batteryLevel?: number
  charging?: boolean
  nano: NanoStatus
  cloudEnabled: boolean
  firebaseConfigured: boolean
}

export type RunsOn = 'device' | 'cloud' | 'cloud-or-device' | 'skipped'

export interface PlanStep {
  task: TaskId
  route: Route
  runsOn: RunsOn
  reason: string
}

export interface RoutePlan {
  steps: PlanStep[]
  /** Run the Gemini Nano entity pass? */
  useModelForEntities: boolean
  /** True when the entity pass is best-effort (unsupported language) or skipped: the user must confirm. */
  entitiesNeedReview: boolean
  triageRoute: Route
  /** Route for explain, follow-ups and drafts, and whether to use the short on-device variant. */
  generateRoute: Route
  generateCompact: boolean
}

const LOW_BATTERY = 0.2
const SHORT_DOC_TOKENS = 2500

export function planRoutes(sig: Signals): RoutePlan {
  const nanoReady = sig.nano === 'available'
  const nanoSupportsLang = NANO_LANGS.has(sig.language.code)
  const cloudOk = sig.online && sig.cloudEnabled && sig.firebaseConfigured
  const lowBattery = sig.batteryLevel !== undefined && sig.batteryLevel < LOW_BATTERY && sig.charging === false
  const tokens = estimateTokens(sig.docChars)
  const steps: PlanStep[] = []

  // 1. Find personal data: raw text, so it can only ever be on-device.
  let useModelForEntities = false
  let entitiesNeedReview = false
  if (!nanoReady) {
    entitiesNeedReview = true
    steps.push({
      task: 'findEntities',
      route: 'ON_DEVICE_ONLY',
      runsOn: 'skipped',
      reason:
        sig.nano === 'downloadable' || sig.nano === 'downloading'
          ? 'Gemini Nano is not downloaded yet, so only pattern rules run. Download it from the header, or review the highlights yourself.'
          : 'Gemini Nano is not available on this device, so only pattern rules run and you review the highlights. The raw text never goes to the cloud as a substitute.',
    })
  } else if (!nanoSupportsLang) {
    useModelForEntities = true
    entitiesNeedReview = true
    steps.push({
      task: 'findEntities',
      route: 'ON_DEVICE_ONLY',
      runsOn: 'device',
      reason: `${sig.language.label} is not an officially supported Gemini Nano language, so this pass is best-effort and you must confirm the result.`,
    })
  } else {
    useModelForEntities = true
    steps.push({
      task: 'findEntities',
      route: 'ON_DEVICE_ONLY',
      runsOn: 'device',
      reason: `Reads your raw ${sig.language.label} text, so only Gemini Nano may do it. It can never fall back to the cloud.`,
    })
  }

  // 2. Classify the (already redacted) document.
  let triageRoute: Route
  if (!cloudOk) {
    triageRoute = 'ON_DEVICE_ONLY'
    steps.push({
      task: 'triage',
      route: triageRoute,
      runsOn: nanoReady ? 'device' : 'skipped',
      reason: !sig.online ? 'You are offline, so it runs on-device.' : 'The cloud is not available, so it runs on-device.',
    })
  } else if (lowBattery) {
    triageRoute = 'PREFER_CLOUD'
    steps.push({
      task: 'triage',
      route: triageRoute,
      runsOn: 'cloud',
      reason: `Battery is at ${Math.round((sig.batteryLevel ?? 0) * 100)}% and not charging, so the short classification goes to the cloud (redacted text only) to save power.`,
    })
  } else if (nanoReady) {
    triageRoute = 'PREFER_ON_DEVICE'
    steps.push({
      task: 'triage',
      route: triageRoute,
      runsOn: 'device',
      reason: 'A short classification: instant and free on-device. The cloud is only a fallback, and its input is already redacted.',
    })
  } else {
    triageRoute = 'PREFER_ON_DEVICE'
    steps.push({
      task: 'triage',
      route: triageRoute,
      runsOn: 'cloud',
      reason: 'Gemini Nano is not ready, so the SDK falls back to the cloud with the redacted excerpt.',
    })
  }

  // 3. Explain / follow-up / draft, all on redacted text.
  let generateRoute: Route
  let generateCompact = false
  let why: string
  let runsOn: RunsOn
  if (!sig.online || !sig.cloudEnabled || !sig.firebaseConfigured) {
    generateRoute = 'ON_DEVICE_ONLY'
    generateCompact = true
    runsOn = nanoReady ? 'device' : 'skipped'
    why = !sig.online
      ? 'You are offline: Gemini Nano writes a shorter English summary on this device.'
      : !sig.cloudEnabled
        ? 'The cloud is switched off (Remote Config kill switch): everything runs on-device with a shorter summary.'
        : 'Firebase is not configured, so cloud steps are off.'
  } else if (sig.saveData && nanoReady && tokens < SHORT_DOC_TOKENS && sig.targetLanguage === 'English') {
    generateRoute = 'PREFER_ON_DEVICE'
    generateCompact = true
    runsOn = 'device'
    why = 'Data saver is on and the document is short, so Gemini Nano writes it on-device to save bytes.'
  } else {
    generateRoute = 'PREFER_CLOUD'
    runsOn = nanoReady ? 'cloud-or-device' : 'cloud'
    why =
      sig.targetLanguage !== 'English'
        ? `Translating into ${sig.targetLanguage} and long documents need the larger cloud model (redacted text only). If the connection drops, Gemini Nano takes over.`
        : `About ${tokens.toLocaleString()} tokens of redacted text go to the larger cloud model for quality. If the connection drops, Gemini Nano takes over.`
  }
  steps.push({ task: 'explain', route: generateRoute, runsOn, reason: why })

  return { steps, useModelForEntities, entitiesNeedReview, triageRoute, generateRoute, generateCompact }
}
