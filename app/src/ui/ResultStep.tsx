import { useState } from 'react'
import type { Session } from '../state/useSession'
import { ExecChip } from './Chips'
import { AlertIcon, ArrowIcon, ShieldIcon } from './icons'

const SEVERITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const

export function ResultStep({ s }: { s: Session }) {
  const [question, setQuestion] = useState('')
  const [reveal, setReveal] = useState(true)
  if (!s.result) return null

  const { executedOn, compact } = s.result
  const e = reveal ? s.showExplanation(s.result.explanation) : s.result.explanation
  const show = (t: string) => (reveal ? s.show(t) : t)

  return (
    <div className="stack">
      <section className="card" aria-labelledby="res-h">
        <div className="result__head">
          <div>
            <p className="eyebrow">{s.classified?.documentType ?? e.documentType}</p>
            <h2 id="res-h">In plain language</h2>
          </div>
          <div className="result__chips">
            {s.classified && (
              <span className={`chip chip--urgency chip--${s.classified.urgency}`}>
                {s.classified.urgency === 'high' && <AlertIcon size={14} />} Urgency: {s.classified.urgency}
              </span>
            )}
            <ExecChip on={executedOn} />
          </div>
        </div>

        {compact && (
          <p className="banner banner--info" role="status">
            You were offline, so Gemini Nano wrote this shorter summary on your device. Reconnect for the full analysis.
          </p>
        )}

        <p className="summary">{e.plainSummary}</p>

        <label className="check small">
          <input type="checkbox" checked={reveal} onChange={(ev) => setReveal(ev.target.checked)} />
          Show my real names and numbers (filled in on this device, never sent)
        </label>
      </section>

      {e.deadlines.length > 0 && (
        <section className="card" aria-labelledby="dl-h">
          <h3 id="dl-h">Deadlines</h3>
          <ul className="deadlines">
            {e.deadlines.map((d, i) => (
              <li key={i}>
                <time>{show(d.date)}</time>
                <div>
                  <strong>{show(d.what)}</strong>
                  {d.consequence && <p className="muted small">{show(d.consequence)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.redFlags.length > 0 && (
        <section className="card" aria-labelledby="rf-h">
          <h3 id="rf-h">Things to look at closely</h3>
          <ul className="flags">
            {e.redFlags.map((f, i) => (
              <li key={i} className={`flag flag--${f.severity}`}>
                <span className="flag__sev">
                  <AlertIcon size={14} /> {SEVERITY_LABEL[f.severity] ?? f.severity}
                </span>
                <div>
                  <strong>{show(f.issue)}</strong>
                  <p className="muted">{show(f.whyItMatters)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.keyFacts.length > 0 && (
        <section className="card" aria-labelledby="kf-h">
          <h3 id="kf-h">Key facts</h3>
          <dl className="facts">
            {e.keyFacts.map((f, i) => (
              <div key={i}>
                <dt>{show(f.label)}</dt>
                <dd>{show(f.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(e.questionsToAsk.length > 0 || e.nextSteps.length > 0) && (
        <section className="card two" aria-label="What to do next">
          {e.nextSteps.length > 0 && (
            <div>
              <h3>Next steps</h3>
              <ol>
                {e.nextSteps.map((t, i) => (
                  <li key={i}>{show(t)}</li>
                ))}
              </ol>
            </div>
          )}
          {e.questionsToAsk.length > 0 && (
            <div>
              <h3>Questions to ask</h3>
              <ul>
                {e.questionsToAsk.map((t, i) => (
                  <li key={i}>{show(t)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="fu-h">
        <h3 id="fu-h">Ask a follow-up</h3>
        {s.answers.map((a, i) => (
          <div key={i} className="qa">
            <p className="qa__q">{a.q}</p>
            <p>{show(a.redactedAnswer)}</p>
            <ExecChip on={a.executedOn} />
          </div>
        ))}
        <form
          className="ask"
          onSubmit={(ev) => {
            ev.preventDefault()
            const q = question.trim()
            if (!q) return
            setQuestion('')
            void s.ask(q)
          }}
        >
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <input id="q" value={question} onChange={(ev) => setQuestion(ev.target.value)} placeholder="e.g. Can I dispute the out-of-network charge?" disabled={s.busy !== null} />
          <button className="btn btn--primary" disabled={!question.trim() || s.busy !== null}>
            Ask <ArrowIcon size={16} />
          </button>
        </form>
        <p className="small muted">
          <ShieldIcon size={14} /> Your question goes through the same protection first.
        </p>
      </section>

      <p className="disclaimer small muted">
        Veil explains documents; it is not legal, medical or financial advice. Check important decisions with a qualified
        professional. AI can make mistakes.
      </p>
      <div className="actions">
        <button className="btn btn--ghost" onClick={() => s.setStage('review')}>
          Back to review
        </button>
        <button className="btn btn--ghost" onClick={s.reset}>
          Clear everything and start over
        </button>
      </div>
    </div>
  )
}
