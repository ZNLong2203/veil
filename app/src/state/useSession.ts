import { useCallback, useMemo, useState } from 'react'
import { isFirebaseConfigured } from '../ai/env'
import { NotConfiguredError } from '../ai/firebase'
import {
  explain,
  followUp,
  makeEntityDetector,
  readImage,
  triage,
  type ExplainResult,
  type Explanation,
  type Triage,
} from '../ai/tasks'
import type { GenerativeModel } from 'firebase/ai'
import { EgressBlockedError } from '../core/egress'
import { detectWithRules } from '../core/rules'
import { runTask } from '../ai/run'
import { ledger } from '../core/ledger'
import { buildRedaction, type RedactionReport } from '../core/redact'
import { PII_KINDS, type PiiKind } from '../core/types'
import { Vault } from '../core/vault'
import { imageToJpegBase64 } from '../ui/image'
import type { DeviceCapabilities } from '../ai/device'

export type Stage = 'add' | 'review' | 'result'

export interface AnswerEntry {
  q: string
  /** The answer exactly as the cloud returned it (placeholders intact). Rehydrated only for display. */
  redactedAnswer: string
  executedOn: 'ON_DEVICE' | 'IN_CLOUD'
}

export const LANGUAGES = [
  'English',
  'Español',
  'Tiếng Việt',
  '中文',
  '日本語',
  '한국어',
  'Français',
  'Deutsch',
  'Português',
  'हिन्दी',
  'العربية',
] as const

export function friendlyError(e: unknown): string {
  if (e instanceof NotConfiguredError) return e.message
  if (e instanceof EgressBlockedError) {
    return 'Veil stopped this request because it still contained personal data. Nothing was sent. Review the highlighted items and try again.'
  }
  const msg = e instanceof Error ? e.message : String(e)
  if (/app.?check/i.test(msg)) return `Firebase App Check rejected the request. Check the App Check setup in docs/setup.md. (${msg})`
  if (/api-not-enabled|not been used|PERMISSION_DENIED/i.test(msg)) return `Firebase AI Logic is not enabled for this project yet. See docs/setup.md. (${msg})`
  return msg
}

export function useSession(device: DeviceCapabilities | null) {
  const [vault] = useState(() => new Vault())
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const [stage, setStage] = useState<Stage>('add')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<{ label: string; progress?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RedactionReport | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [language, setLanguage] = useState<string>('English')
  const [classified, setClassified] = useState<(Triage & { executedOn: 'ON_DEVICE' | 'IN_CLOUD' }) | null>(null)
  const [result, setResult] = useState<ExplainResult | null>(null)
  const [answers, setAnswers] = useState<AnswerEntry[]>([])
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  const redacted = useMemo(() => vault.apply(text), [vault, text, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setError(null)
    setBusy({ label })
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }, [])

  const modelReady = device?.text === 'available' && isFirebaseConfigured

  /** Step 1 → 2. Everything here is local or ON_DEVICE_ONLY. */
  const analyze = useCallback(
    (doc: string) =>
      run('Finding personal data on this device…', async () => {
        vault.clear()
        setText(doc)
        setResult(null)
        setClassified(null)
        setAnswers([])
        setConfirmed(false)
        const started = performance.now()
        const rep = await buildRedaction(doc, vault, {
          detect: modelReady ? makeEntityDetector(vault) : undefined,
          onProgress: (done, total) => setBusy({ label: `Gemini Nano is reading your document (${done}/${total})…`, progress: total ? done / total : 0 }),
        })
        ledger.add({
          task: 'findEntities',
          route: 'ON_DEVICE_ONLY',
          executedOn: 'LOCAL',
          charsSent: 0,
          redactions: vault.size,
          durationMs: Math.round(performance.now() - started),
          note: `Pattern rules found ${rep.rulesFound} value${rep.rulesFound === 1 ? '' : 's'}`,
        })
        setReport(rep)
        setStage('review')
        bump()
      }),
    [run, vault, modelReady],
  )

  const loadFile = useCallback(
    async (file: File) => {
      if (file.type.startsWith('image/')) {
        await run('Reading the photo on this device…', async () => {
          if (!isFirebaseConfigured) throw new NotConfiguredError()
          if (!device?.image) {
            throw new Error(
              'Reading photos needs Gemini Nano with image input. Enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input, restart Chrome, download the model, or paste the text instead. The photo was not uploaded.',
            )
          }
          const { data, mimeType } = await imageToJpegBase64(file)
          const { text: transcript } = await readImage(vault, data, mimeType)
          setText(transcript)
        })
        return
      }
      if (file.size > 2_000_000) {
        setError('That file is larger than 2 MB. Paste the relevant part instead.')
        return
      }
      setError(null)
      setText(await file.text())
    },
    [run, vault, device],
  )

  const protect = useCallback(
    (value: string, kind: PiiKind) => {
      if (vault.add(kind, value, 'user')) {
        setConfirmed(false)
        bump()
      }
    },
    [vault],
  )

  const unprotect = useCallback(
    (token: string) => {
      vault.remove(token)
      bump()
    },
    [vault],
  )

  /** Step 2 → 3. Redacted text only; the egress guard runs inside runTask. */
  const understand = useCallback(
    () =>
      run('Explaining your document…', async () => {
        const clean = vault.apply(text)
        try {
          setClassified(await triage(vault, clean))
        } catch (e) {
          if (e instanceof EgressBlockedError || e instanceof NotConfiguredError) throw e
          setClassified(null) // classification is a nicety; keep going
        }
        setResult(await explain(vault, clean, language))
        setAnswers([])
        setStage('result')
      }),
    [run, vault, text, language],
  )

  const ask = useCallback(
    (question: string) =>
      run('Thinking…', async () => {
        const history = answers.map((a) => ({ q: a.q, a: a.redactedAnswer }))
        const { answer, executedOn } = await followUp(vault, vault.apply(text), history, question, language)
        setAnswers((prev) => [...prev, { q: question, redactedAnswer: answer, executedOn }])
      }),
    [run, answers, vault, text, language],
  )

  /**
   * Safety self-test: push the ORIGINAL document through the real cloud-bound path. The egress guard
   * must refuse it. The model here is a stub that must never be reached, so nothing is ever sent.
   */
  const testGuard = useCallback(async () => {
    setNotice(null)
    if (vault.size === 0 && detectWithRules(text).length === 0) {
      setNotice({ kind: 'warn', text: 'Veil recognises no personal data in this document, so there was nothing for the guard to block.' })
      return
    }
    const stub = {
      generateContent: async () => {
        throw new Error('SELF_TEST_REACHED_MODEL')
      },
    } as unknown as GenerativeModel
    try {
      await runTask({ task: 'explain', model: stub, parts: [text], outbound: text, vault })
      setNotice({ kind: 'warn', text: 'Self-test did not run as expected.' })
    } catch (e) {
      if (e instanceof EgressBlockedError) {
        const n = e.findings.reduce((a, f) => a + f.count, 0)
        setNotice({ kind: 'ok', text: `Self-test passed: the egress guard blocked the original document (${n} finding${n === 1 ? '' : 's'} across the vault and the detectors). Nothing was sent.` })
      } else {
        setNotice({ kind: 'warn', text: 'Self-test FAILED: the original text was allowed through the guard. Do not send documents until this is fixed.' })
      }
    }
  }, [vault, text])

  const reset = useCallback(() => {
    vault.clear()
    setText('')
    setReport(null)
    setResult(null)
    setClassified(null)
    setAnswers([])
    setConfirmed(false)
    setError(null)
    setNotice(null)
    setStage('add')
    bump()
  }, [vault])

  /** Put real values back into any model output, for display only. */
  const show = useCallback((s: string) => vault.rehydrate(s), [vault, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const showExplanation = useCallback(
    (e: Explanation): Explanation => vault.rehydrateDeep(e),
    [vault, version], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return {
    vault, version, stage, setStage, text, setText, busy, error, setError, report, confirmed, setConfirmed,
    language, setLanguage, classified, result, answers, redacted, modelReady,
    analyze, loadFile, protect, unprotect, understand, ask, reset, testGuard, notice, show, showExplanation, kinds: PII_KINDS,
  }
}

export type Session = ReturnType<typeof useSession>
