import { useState } from 'react'
import type { Session } from '../state/useSession'
import { ActionKit } from './ActionKit'
import { ExecChip } from './Chips'
import { AlertIcon, ArrowIcon, CalendarIcon, CheckIcon, EyeIcon, ListIcon, QuestionIcon, ShieldIcon } from './icons'
import { SectionTitle } from './SectionTitle'
import { WireProof } from './WirePanel'

/** "2026-12-15" reads as "Dec 15, 2026"; anything else (e.g. "within 30 days") is shown as written. */
function friendlyDate(text: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) return text
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : text
}

const SEVERITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const

export function ResultStep({ s }: { s: Session }) {
  const [question, setQuestion] = useState('')
  const [reveal, setReveal] = useState(true)
  const [done, setDone] = useState<Record<number, boolean>>({})
  if (!s.result) return null

  const { executedOn, compact } = s.result
  const e = reveal ? s.showExplanation(s.result.explanation) : s.result.explanation
  const show = (t: string) => (reveal ? s.show(t) : t)

  return (
    <div className="stack">
      <header className="page-head">
        <div className="result-top">
          <div>
            <p className="eyebrow">{s.classified?.documentType ?? e.documentType}</p>
            <h1>In plain language</h1>
          </div>
          <div className="result-chips">
            {s.classified && (
              <span className={`chip chip--urgency chip--${s.classified.urgency}`}>
                {s.classified.urgency === 'high' && <AlertIcon size={14} />} Urgency: {s.classified.urgency}
              </span>
            )}
            <ExecChip on={executedOn} />
          </div>
        </div>
      </header>

      {compact && (
        <p className="banner banner--info" role="status">
          <AlertIcon size={16} />
          <span>The cloud was not available (or you are offline), so Gemini Nano wrote this shorter summary on your device. Try again for the full analysis.</span>
        </p>
      )}

      <WireProof vault={s.vault} />

      <section className="card card--lift summary-card" aria-label="Summary">
        <p className="summary">{e.plainSummary}</p>
        <label className="check">
          <input type="checkbox" checked={reveal} onChange={(ev) => setReveal(ev.target.checked)} />
          <span>
            <EyeIcon size={14} /> Show my real names and numbers (filled in on this device, never sent)
          </span>
        </label>
      </section>

      {(e.deadlines.length > 0 || e.redFlags.length > 0) && (
        <div className="grid2">
          {e.deadlines.length > 0 && (
            <section className="card" aria-labelledby="dl-h">
              <SectionTitle id="dl-h" tone="red" icon={<CalendarIcon size={18} />}>
                Deadlines
              </SectionTitle>
              <ul className="deadlines">
                {e.deadlines.map((d, i) => (
                  <li key={i}>
                    <time>
                      <CalendarIcon size={14} /> {friendlyDate(show(d.date))}
                    </time>
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
              <SectionTitle id="rf-h" tone="amber" icon={<AlertIcon size={18} />}>
                Look at these closely
              </SectionTitle>
              <ul className="flags">
                {e.redFlags.map((f, i) => (
                  <li key={i} className={`flag flag--${f.severity}`}>
                    <span className="flag__sev">
                      <AlertIcon size={12} /> {SEVERITY_LABEL[f.severity] ?? f.severity}
                    </span>
                    <div>
                      <strong>{show(f.issue)}</strong>
                      <p>{show(f.whyItMatters)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {e.keyFacts.length > 0 && (
        <section className="card" aria-labelledby="kf-h">
          <SectionTitle id="kf-h" tone="blue" icon={<ListIcon size={18} />}>
            Key facts
          </SectionTitle>
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

      {(e.nextSteps.length > 0 || e.questionsToAsk.length > 0) && (
        <div className="grid2">
          {e.nextSteps.length > 0 && (
            <section className="card" aria-labelledby="ns-h">
              <SectionTitle id="ns-h" tone="green" icon={<CheckIcon size={18} />}>
                Next steps
              </SectionTitle>
              <ul className="steps-list">
                {e.nextSteps.map((t, i) => (
                  <li key={i}>
                    <input id={`ns-${i}`} type="checkbox" checked={!!done[i]} onChange={(ev) => setDone((d) => ({ ...d, [i]: ev.target.checked }))} />
                    <label htmlFor={`ns-${i}`}>{show(t)}</label>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {e.questionsToAsk.length > 0 && (
            <section className="card" aria-labelledby="qa-h">
              <SectionTitle id="qa-h" tone="violet" icon={<QuestionIcon size={18} />}>
                Questions to ask
              </SectionTitle>
              <ul className="questions">
                {e.questionsToAsk.map((t, i) => (
                  <li key={i}>{show(t)}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ActionKit s={s} />

      <section className="card" aria-labelledby="fu-h">
        <SectionTitle id="fu-h" tone="blue" icon={<ArrowIcon size={18} />}>
          Ask a follow-up
        </SectionTitle>
        {s.answers.length > 0 && (
          <div className="chat">
            {s.answers.map((a, i) => (
              <div key={i} style={{ display: 'grid', gap: 8 }}>
                <div className="bubble bubble--q">
                  <p>{a.q}</p>
                </div>
                <div className="bubble bubble--a">
                  <p>{show(a.redactedAnswer)}</p>
                  <ExecChip on={a.executedOn} />
                </div>
              </div>
            ))}
          </div>
        )}
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
        <p className="small muted" style={{ margin: 0 }}>
          <ShieldIcon size={14} /> Your question goes through the same protection first.
        </p>
      </section>

      <p className="disclaimer small muted">
        Veil explains documents; it is not legal, medical or financial advice. Check important decisions with a qualified
        professional. AI can make mistakes.
      </p>
      <div className="result-actions">
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
