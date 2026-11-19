import { useRef, useState } from 'react'
import { isFirebaseConfigured } from '../ai/env'
import { PII_KINDS, PII_LABELS, type PiiKind } from '../core/types'
import { LANGUAGES, type Session } from '../state/useSession'
import { AlertIcon, ArrowIcon, ChipIcon, CheckIcon, CloudIcon, LockIcon, ShieldIcon, XIcon } from './icons'
import { RoutePlanCard } from './RoutePlanCard'

export function ReviewStep({ s, online, deviceReady }: { s: Session; online: boolean; deviceReady: boolean }) {
  const docRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState('')
  const [kind, setKind] = useState<PiiKind>('PERSON')
  const [copied, setCopied] = useState(false)
  const entries = s.vault.entries()
  const segments = s.vault.segments(s.text)
  const rep = s.report

  const captureSelection = () => {
    const sel = window.getSelection()
    const inside = sel && docRef.current && sel.anchorNode && docRef.current.contains(sel.anchorNode)
    setSelection(inside ? sel.toString().trim().replace(/\s+/g, ' ') : '')
  }

  const copyRedacted = async () => {
    try {
      await navigator.clipboard.writeText(s.redacted)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be unavailable; the text is visible on screen */
    }
  }

  const needsConfirm = !rep?.modelCovered || s.needsReview
  const canContinue = (!needsConfirm || s.confirmed) && s.busy === null && isFirebaseConfigured

  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">Step 2 of 3</p>
        <h1>Check what stays on your device</h1>
        <p className="lead">
          On the left is your document with personal data highlighted. On the right is the copy that would be sent. Nothing
          leaves until you press Explain.
        </p>
      </header>

      {rep?.modelCovered && s.needsReview ? (
        <p className="banner banner--warn" role="status">
          <AlertIcon size={16} />
          <span>
            Gemini Nano read the document on this device, but {s.signals.language.label} is not an officially supported language, so
            treat what it found as best-effort. Read the highlighted document and protect anything it missed before continuing.
          </span>
        </p>
      ) : rep?.modelCovered ? (
        <p className="banner banner--ok" role="status">
          <CheckIcon size={16} />
          <span>
            Gemini Nano read the whole document on this device. Pattern rules found {rep.rulesFound} value
            {rep.rulesFound === 1 ? '' : 's'}; the model added {rep.modelAdded} more.
          </span>
        </p>
      ) : (
        <p className="banner banner--warn" role="status">
          <AlertIcon size={16} />
          <span>
            {rep?.modelError
              ? `Gemini Nano could not finish (${rep.modelError}). Only pattern rules ran.`
              : 'Gemini Nano is not available here, so only pattern rules ran (emails, phone, ID and card numbers, labelled names, street addresses).'}{' '}
            Names in running text can be missed. Read the highlighted document and protect anything else before continuing.
          </span>
        </p>
      )}

      <div className="compare">
        <section className="pane pane--local" aria-label="Your document">
          <header className="pane__head">
            <span className="chip chip--device">
              <ChipIcon size={14} /> Your document · stays here
            </span>
            <span className="small muted">Select text to protect it</span>
          </header>
          <div ref={docRef} className="doc" onMouseUp={captureSelection} onKeyUp={captureSelection} tabIndex={0} aria-label="Your document with protected values highlighted">
            {segments.map((seg, i) =>
              seg.entry ? (
                <mark key={i} title={`${seg.entry.token} · ${PII_LABELS[seg.entry.kind]}`}>
                  {seg.text}
                  <small>{PII_LABELS[seg.entry.kind]}</small>
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
          {selection && (
            <div className="protectbar" role="group" aria-label="Protect selected text">
              <span className="protectbar__text">“{selection}”</span>
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
        </section>

        <section className="pane pane--cloud" aria-label="What the cloud will see">
          <header className="pane__head">
            <span className="chip chip--cloud">
              <CloudIcon size={14} /> What the cloud will see
            </span>
            <button className="link" onClick={() => void copyRedacted()}>
              {copied ? 'Copied' : 'Copy redacted text'}
            </button>
          </header>
          <div className="doc" tabIndex={0} aria-label="The redacted copy that would be sent">
            {segments.map((seg, i) =>
              seg.entry ? (
                <span key={i} className="tok" title={`${PII_LABELS[seg.entry.kind]} hidden`}>
                  {seg.entry.token}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
          <footer className="pane__foot">
            {entries.length} value{entries.length === 1 ? '' : 's'} hidden. Safe to paste into any AI tool.
          </footer>
        </section>
      </div>

      <section className="card" aria-labelledby="pv-h">
        <div className="card__head">
          <h2 id="pv-h">
            Protected values<span className="count">{entries.length}</span>
          </h2>
          <p className="small muted">
            <LockIcon size={12} /> locked values were found by Veil&apos;s rules and are always protected. You can un-protect values found by
            Gemini Nano or added by you.
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="muted small">Nothing was found. Check the document, or protect text by selecting it.</p>
        ) : (
          <ul className="vchips">
            {entries.map((e) => (
              <li key={e.token} className="vchip">
                <span className="token">{e.token}</span>
                <span className="vchip__v" title={e.value}>
                  {e.value}
                </span>
                <span className="vchip__src">{e.source === 'on-device' ? 'Nano' : e.source === 'user' ? 'you' : 'rules'}</span>
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
        )}
      </section>

      <RoutePlanCard s={s} />

      <div className="selftest">
        <button className="btn btn--ghost btn--sm" onClick={() => void s.testGuard()}>
          <ShieldIcon size={14} /> Prove it: try to send the original
        </button>
        <span className="small muted">Runs the real cloud path with your original text. The egress guard must block it. Nothing is sent.</span>
      </div>
      {s.notice && (
        <p className={`banner ${s.notice.kind === 'ok' ? 'banner--ok' : 'banner--warn'}`} role="status">
          {s.notice.kind === 'ok' ? <CheckIcon size={16} /> : <AlertIcon size={16} />}
          <span>{s.notice.text}</span>
        </p>
      )}

      {needsConfirm && (
        <label className="check banner banner--warn">
          <input type="checkbox" checked={s.confirmed} onChange={(e) => s.setConfirmed(e.target.checked)} />
          <span>I read the document and protected every personal detail I could see.</span>
        </label>
      )}
      {!isFirebaseConfigured && (
        <p className="banner banner--warn">
          <AlertIcon size={16} />
          <span>Firebase is not configured, so explanations are disabled. Review and protection work without it. See docs/setup.md.</span>
        </p>
      )}

      <div className="actionbar">
        <button className="btn btn--ghost" onClick={s.reset}>
          Start over
        </button>
        <div className="actionbar__right">
          <label htmlFor="lang" className="small">
            Explain in
          </label>
          <select id="lang" value={s.language} onChange={(e) => s.setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button className="btn btn--primary btn--lg" disabled={!canContinue} onClick={() => void s.understand()}>
            Explain this document <ArrowIcon size={18} />
          </button>
        </div>
      </div>
      <p className="small muted" style={{ textAlign: 'right', marginTop: -8 }}>
        {online
          ? 'Only the redacted text is sent to Gemini in the cloud. Your real values are put back on this device.'
          : deviceReady
            ? 'You are offline: Gemini Nano on this device will write a shorter English summary.'
            : 'You are offline and Gemini Nano is not ready, so the explanation cannot run yet.'}
      </p>
    </div>
  )
}
