import { Fragment, useMemo, useState } from 'react'
import { buildIcs, isValidIsoDate, type IcsEvent } from '../core/ics'
import type { LangCode } from '../core/planner'
import { LANGUAGES, type Session } from '../state/useSession'
import { ExecChip } from './Chips'
import { SectionTitle } from './SectionTitle'
import { ArrowIcon, CalendarIcon, CopyIcon, DocIcon, ShieldIcon } from './icons'

const GENERIC_TOPICS = [
  'Request an itemized bill and a written explanation of every charge',
  'Ask for a payment plan or an extension of the deadline',
  'Ask for a review or appeal of this decision',
]

const LABEL_FOR_CODE: Partial<Record<LangCode, (typeof LANGUAGES)[number]>> = {
  en: 'English', es: 'Español', vi: 'Tiếng Việt', zh: '中文', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', pt: 'Português', hi: 'हिन्दी', ar: 'العربية',
}

function download(name: string, mime: string, content: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Split text on leftover fields such as "[Date]" that the user still has to fill in. */
function withTodos(text: string) {
  return text.split(/(\[[A-Za-z][^\]\n]{0,40}\])/g).map((part, i) =>
    /^\[[A-Za-z][^\]\n]{0,40}\]$/.test(part) ? (
      <span key={i} className="todo" title="Fill this in yourself">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/**
 * Action kit: turn the explanation into something you can send. The cloud writes with placeholders;
 * your real name, address and reference numbers are filled in here, on this device.
 */
export function ActionKit({ s }: { s: Session }) {
  const result = s.result
  const [kind, setKind] = useState<'letter' | 'call'>('letter')
  const [topic, setTopic] = useState(0)
  const [writeIn, setWriteIn] = useState<string>(LABEL_FOR_CODE[s.signals.language.code] ?? 'English')

  const topics = useMemo(() => {
    const flags = (result?.explanation.redFlags ?? []).map((f) => f.issue)
    return [...flags, ...GENERIC_TOPICS]
  }, [result])

  const events: IcsEvent[] = useMemo(() => {
    const full = s.vault.rehydrateDeep(result?.explanation.deadlines ?? [])
    return full
      .filter((d) => isValidIsoDate(d.isoDate))
      .map((d, i) => ({
        uid: `${Date.now()}-${i}@veil.local`,
        date: d.isoDate as string,
        summary: d.what,
        description: [d.consequence, 'Added by Veil.'].filter(Boolean).join('\n'),
      }))
  }, [result, s.vault, s.version])

  if (!result) return null

  const draft = s.draft
  const segments = draft ? s.vault.fillSegments(draft.redactedBody) : []
  const filledCount = segments.filter((x) => x.filled).length
  const plain = draft ? `${s.vault.rehydrate(draft.subject)}\n\n${s.vault.rehydrate(draft.redactedBody)}` : ''
  const busy = s.busy !== null

  return (
    <section className="card card--lift kit" aria-labelledby="kit-h">
      <div className="card__head">
        <p className="eyebrow">
          <ShieldIcon size={14} /> Do the next thing
        </p>
        <SectionTitle id="kit-h" tone="blue" icon={<DocIcon size={18} />}>
          Action kit
        </SectionTitle>
        <p className="muted">
          Draft the letter or the phone call, or put the deadlines in your calendar. The cloud writes with placeholders; your real
          details are filled in on this device.
        </p>
      </div>

      <div className="seg" role="tablist" aria-label="Choose an action">
        <button role="tab" aria-selected={kind === 'letter'} className={kind === 'letter' ? 'on' : ''} onClick={() => setKind('letter')}>
          <DocIcon size={16} /> Letter
        </button>
        <button role="tab" aria-selected={kind === 'call'} className={kind === 'call' ? 'on' : ''} onClick={() => setKind('call')}>
          Call script
        </button>
      </div>

      <div className="kit__form">
        <div>
          <label htmlFor="kit-topic" className="small muted">
            What is it about?
          </label>
          <select id="kit-topic" value={topic} onChange={(e) => setTopic(Number(e.target.value))} className="kit__topic">
            {topics.map((t, i) => (
              <option key={i} value={i}>
                {s.show(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kit-lang" className="small muted">
            Write in
          </label>
          <select id="kit-lang" value={writeIn} onChange={(e) => setWriteIn(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <button className="btn btn--primary" disabled={busy} onClick={() => void s.makeDraft(kind, topics[topic], writeIn)}>
          {kind === 'letter' ? 'Draft the letter' : 'Write the script'} <ArrowIcon size={16} />
        </button>
      </div>

      {draft && (
        <div className="kit__out">
          <div className="kit__meta">
            <ExecChip on={draft.executedOn} />
            <span className="small muted">
              {filledCount} detail{filledCount === 1 ? '' : 's'} filled in on this device, never sent
            </span>
          </div>
          <article className="letter printable" aria-label="Draft">
            <h3>{s.show(draft.subject)}</h3>
            <div className="letter__body">
              {segments.map((seg, i) =>
                seg.filled ? (
                  <span key={i} className="filled">
                    {seg.text}
                  </span>
                ) : (
                  <Fragment key={i}>{withTodos(seg.text)}</Fragment>
                ),
              )}
            </div>
          </article>
          <p className="small muted">
            <span className="filled">Highlighted</span> text was filled in on this device. <span className="todo">[Brackets]</span> are
            for you to complete. Read it before you send it.
          </p>
          <div className="kit__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => void navigator.clipboard.writeText(plain)}>
              <CopyIcon size={14} /> Copy
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => download(`${draft.kind === 'letter' ? 'letter' : 'call-script'}.txt`, 'text/plain', plain)}>
              Download .txt
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      )}

      <div className="kit__cal">
        <div>
          <strong>
            <CalendarIcon size={16} /> Deadlines to your calendar
          </strong>
          <p className="small muted">
            {events.length > 0
              ? `${events.length} exact date${events.length === 1 ? '' : 's'} found. Each gets reminders 7 days and 1 day before. The file is built here and never uploaded.`
              : 'No exact dates were found in this document, so there is nothing to add.'}
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" disabled={events.length === 0} onClick={() => download('veil-deadlines.ics', 'text/calendar', buildIcs(events))}>
          Download .ics
        </button>
      </div>
    </section>
  )
}
