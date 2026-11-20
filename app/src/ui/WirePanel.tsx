import { Fragment, useState, useSyncExternalStore } from 'react'
import { ledger } from '../core/ledger'
import { buildReceipt, receiptToMarkdown } from '../core/receipt'
import type { Vault } from '../core/vault'
import { inspectWire, PLACEHOLDER_RE, wireLog, type WireEntry, type WireKind } from '../core/wire'
import { AlertIcon, CheckIcon } from './icons'

/** Render redacted text with placeholders as chips. */
function Redacted({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${PLACEHOLDER_RE.source})`, 'g'))
  return (
    <>
      {parts.map((p, i) =>
        new RegExp(`^${PLACEHOLDER_RE.source}$`).test(p) ? (
          <span key={i} className="tok">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

const KIND_LABEL: Record<WireKind, string> = {
  ai: 'AI request',
  'app-check': 'App Check',
  recaptcha: 'reCAPTCHA',
  'remote-config': 'Remote Config',
  installations: 'Installations',
  other: 'Other',
}

const KIND_HELP: Record<WireKind, string> = {
  ai: 'A Gemini request through Firebase AI Logic',
  'app-check': 'proves this is the real app, no document text',
  recaptcha: 'App Check attestation, no document text',
  'remote-config': 'fetches settings, no document text',
  installations: 'Firebase app instance ID, no document text',
  other: 'not made by Veil',
}

function Row({ e, vault }: { e: WireEntry; vault: Vault }) {
  const verdict = e.kind === 'ai' ? inspectWire(e, vault) : null
  return (
    <li className="wire__item">
      <div className="wire__row">
        <strong>{e.method}</strong>
        <span className="wire__host" title={`${e.host}${e.path}`}>
          {e.host}
        </span>
        <span className="chip chip--local" title={KIND_HELP[e.kind]}>
          {KIND_LABEL[e.kind]}
        </span>
      </div>
      <div className="small muted">
        {e.bytes.toLocaleString()} B · {e.status ? e.status : e.opaque ? 'sent (no-cors)' : 'failed'}
        {e.kind !== 'ai' && <> · {KIND_HELP[e.kind]}</>}
      </div>
      {verdict && (
        <>
          <p className={`wire__verdict ${verdict.clean ? 'wire__verdict--ok' : 'wire__verdict--bad'}`}>
            {verdict.clean ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
            {verdict.clean
              ? `No personal data in these bytes. ${verdict.placeholders} placeholder${verdict.placeholders === 1 ? '' : 's'}.`
              : `Personal data found: ${verdict.findings.map((f) => `${f.count}× ${f.kind}`).join(', ')}.`}
          </p>
          {e.texts.length > 0 && (
            <details>
              <summary className="small">Show the exact text sent</summary>
              <pre className="wire__body">
                {e.texts.map((t, i) => (
                  <div key={i}>
                    <Redacted text={t} />
                  </div>
                ))}
              </pre>
            </details>
          )}
        </>
      )}
    </li>
  )
}

/**
 * The wire view. The ledger shows what the app says it did; this shows what the browser really
 * sent, recorded at the network layer, and re-checks those bytes independently.
 */
export function WirePanel({ vault, version }: { vault: Vault; version: number }) {
  const entries = useSyncExternalStore(wireLog.subscribe, wireLog.getSnapshot)
  const steps = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot)
  const [copied, setCopied] = useState(false)
  void version

  const makeReceipt = () => buildReceipt({ ledger: steps, wire: entries, vault })

  const download = async () => {
    const receipt = await makeReceipt()
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `veil-privacy-receipt-${receipt.generatedAt.slice(0, 16).replace(/[:T]/g, '')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptToMarkdown(await makeReceipt()))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <details className="wire" id="wire" open={entries.length > 0}>
      <summary>
        On the wire<span className="count">{entries.length}</span>
      </summary>
      <p className="small muted">
        Every request that left this tab, recorded at the network layer. Headers and keys are never stored. On-device steps make no
        request, so they never appear here.
      </p>
      {entries.length === 0 ? (
        <p className="small muted">Nothing has left this tab yet.</p>
      ) : (
        <ul className="wire__list">
          {[...entries].reverse().map((e) => (
            <Row key={e.id} e={e} vault={vault} />
          ))}
        </ul>
      )}
      <div className="wire__actions">
        <button className="btn btn--ghost btn--sm" onClick={() => void download()}>
          Download receipt
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy summary'}
        </button>
      </div>
      <p className="small muted">The receipt holds counts, categories and hashes, never your text.</p>
    </details>
  )
}

/** Opens the wire panel and brings it into view (it lives in the side panel). */
function showWire() {
  const el = document.getElementById('wire') as HTMLDetailsElement | null
  if (!el) return
  el.open = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * One-line proof under the answer: what the network layer actually saw for this session's AI requests,
 * re-checked independently of the app's own bookkeeping.
 */
export function WireProof({ vault }: { vault: Vault }) {
  const entries = useSyncExternalStore(wireLog.subscribe, wireLog.getSnapshot)
  const ai = entries.filter((e) => e.kind === 'ai')
  if (ai.length === 0) return null
  const verdicts = ai.map((e) => inspectWire(e, vault))
  const leaks = verdicts.reduce((n, v) => n + v.findings.reduce((a, f) => a + f.count, 0), 0)
  const placeholders = verdicts.reduce((n, v) => n + v.placeholders, 0)
  return (
    <p className={`proofbar ${leaks ? 'proofbar--bad' : ''}`} role="status">
      {leaks ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
      <span>
        <strong>
          {leaks ? `${leaks} personal value${leaks === 1 ? '' : 's'} found on the wire` : 'Checked on the wire: no personal data left this tab'}
        </strong>{' '}
        · {ai.length} request{ai.length === 1 ? '' : 's'} to Gemini, {placeholders} placeholder{placeholders === 1 ? '' : 's'}
      </span>
      <button className="link proofbar__link" onClick={showWire}>
        See the exact bytes
      </button>
    </p>
  )
}
