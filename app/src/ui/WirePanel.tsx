import { Fragment, useState, useSyncExternalStore } from 'react'
import { ledger } from '../core/ledger'
import { buildReceipt, receiptToMarkdown } from '../core/receipt'
import type { Vault } from '../core/vault'
import { inspectWire, PLACEHOLDER_RE, wireLog, type WireEntry } from '../core/wire'
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

function Row({ e, vault }: { e: WireEntry; vault: Vault }) {
  const verdict = e.kind === 'ai' ? inspectWire(e, vault) : null
  return (
    <li className="wire__item">
      <div className="wire__row">
        <strong>{e.method}</strong>
        <span className="wire__host" title={`${e.host}${e.path}`}>
          {e.host}
        </span>
        <span className="chip chip--local">{e.kind === 'ai' ? 'AI request' : e.kind}</span>
      </div>
      <div className="small muted">
        {e.bytes.toLocaleString()} B · {e.status || 'failed'}
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
    <details className="wire" open={entries.length > 0}>
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
