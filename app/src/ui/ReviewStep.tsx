import { useRef, useState } from 'react'
import { isFirebaseConfigured } from '../ai/env'
import { PII_KINDS, PII_LABELS, type PiiKind } from '../core/types'
import { LANGUAGES, type Session } from '../state/useSession'
import { ArrowIcon, LockIcon, ShieldIcon, XIcon } from './icons'

export function ReviewStep({ s, online, deviceReady }: { s: Session; online: boolean; deviceReady: boolean }) {
  const docRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState('')
  const [kind, setKind] = useState<PiiKind>('PERSON')
  const entries = s.vault.entries()
  const segments = s.vault.segments(s.text)
  const rep = s.report

  const captureSelection = () => {
    const sel = window.getSelection()
    const inside = sel && docRef.current && sel.anchorNode && docRef.current.contains(sel.anchorNode)
    setSelection(inside ? sel.toString().trim().replace(/\s+/g, ' ') : '')
  }

  const needsConfirm = !rep?.modelCovered
  const canContinue = (!needsConfirm || s.confirmed) && s.busy === null && isFirebaseConfigured

  return (
    <section className="card" aria-labelledby="review-h">
      <h2 id="review-h">Review what stays on your device</h2>

      {rep?.modelCovered ? (
        <p className="banner banner--ok" role="status">
          <ShieldIcon size={16} /> Gemini Nano read the whole document on this device. Pattern rules found {rep.rulesFound}{' '}
          value{rep.rulesFound === 1 ? '' : 's'}; the model added {rep.modelAdded} more.
        </p>
      ) : (
        <p className="banner banner--warn" role="status">
          {rep?.modelError
            ? `Gemini Nano could not finish (${rep.modelError}). Only pattern rules ran.`
            : 'Gemini Nano is not available here, so only pattern rules ran (emails, phone, ID and card numbers, labelled names, street addresses).'}{' '}
          Names in running text can be missed. Read the highlighted document and protect anything else before continuing.
        </p>
      )}

      <div className="review">
        <div>
          <h3 className="sr-only">Your document</h3>
          <div ref={docRef} className="doc" onMouseUp={captureSelection} onKeyUp={captureSelection} tabIndex={0} aria-label="Your document with protected values highlighted">
            {segments.map((seg, i) =>
              seg.entry ? (
                <mark key={i} data-label={PII_LABELS[seg.entry.kind]} title={`${seg.entry.token} — ${PII_LABELS[seg.entry.kind]}`}>
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>

          {selection && (
            <div className="protectbar" role="group" aria-label="Protect selected text">
              <span className="protectbar__text">“{selection.length > 48 ? selection.slice(0, 48) + '…' : selection}”</span>
              <label className="sr-only" htmlFor="kind">
                Type
              </label>
              <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as PiiKind)}>
                {PII_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PII_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  s.protect(selection, kind)
                  setSelection('')
                  window.getSelection()?.removeAllRanges()
                }}
              >
                Protect
              </button>
            </div>
          )}
          <p className="small muted">Select any text in the document to protect it too.</p>
        </div>

        <div>
          <h3>
            Protected values <span className="count">{entries.length}</span>
          </h3>
          {entries.length === 0 && <p className="muted small">Nothing was found. Check the document, or protect text by selecting it.</p>}
          <ul className="values">
            {entries.map((e) => (
              <li key={e.token}>
                <span className="token">{e.token}</span>
                <span className="values__v">{e.value}</span>
                <span className="muted small">{e.source === 'on-device' ? 'Gemini Nano' : e.source === 'user' ? 'you' : 'rules'}</span>
                {e.source === 'rules' ? (
                  <span className="icon-btn icon-btn--static" title="Always protected: Veil never sends values its rules recognise. They are filled back in on this device." role="img" aria-label={`Always protected: ${e.value}`}>
                    <LockIcon size={14} />
                  </span>
                ) : (
                  <button className="icon-btn" onClick={() => s.unprotect(e.token)} aria-label={`Not sensitive: ${e.value}`} title="Not sensitive">
                    <XIcon size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="preview">
        <summary>Exactly what would be sent</summary>
        <pre>{s.redacted}</pre>
      </details>

      <div className="selftest">
        <button className="btn btn--ghost btn--sm" onClick={() => void s.testGuard()}>
          <ShieldIcon size={14} /> Prove it: try to send the original
        </button>
        <span className="small muted">Runs the real cloud path with your original text. The egress guard must block it. Nothing is sent.</span>
      </div>
      {s.notice && (
        <p className={`banner ${s.notice.kind === 'ok' ? 'banner--ok' : 'banner--warn'}`} role="status">
          {s.notice.text}
        </p>
      )}

      <div className="actions actions--col">
        {needsConfirm && (
          <label className="check">
            <input type="checkbox" checked={s.confirmed} onChange={(e) => s.setConfirmed(e.target.checked)} />
            I read the document and protected every personal detail I could see.
          </label>
        )}
        {!isFirebaseConfigured && (
          <p className="banner banner--warn small">
            Firebase is not configured, so explanations are disabled. Review and protection work without it. See docs/setup.md.
          </p>
        )}
        <div className="actions__row">
          <button className="btn btn--ghost" onClick={s.reset}>
            Start over
          </button>
          <div className="actions__right">
            <label htmlFor="lang" className="small muted">
              Explain in
            </label>
            <select id="lang" value={s.language} onChange={(e) => s.setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <button className="btn btn--primary" disabled={!canContinue} onClick={() => void s.understand()}>
              Explain this document <ArrowIcon size={16} />
            </button>
          </div>
        </div>
        <p className="small muted">
          {online
            ? 'Only the redacted text is sent to Gemini in the cloud. Your real values are put back on this device.'
            : deviceReady
              ? 'You are offline: Gemini Nano on this device will write a shorter English summary.'
              : 'You are offline and Gemini Nano is not ready, so the explanation cannot run yet.'}
        </p>
      </div>
    </section>
  )
}
