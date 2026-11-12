import { useRef, useState } from 'react'
import { SAMPLES } from '../samples'
import type { Session } from '../state/useSession'
import { ArrowIcon, CameraIcon, FileIcon, ShieldIcon } from './icons'

export function AddStep({ s }: { s: Session }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const empty = s.text.trim().length === 0

  return (
    <section className="card" aria-labelledby="add-h">
      <h2 id="add-h">What do you need to understand?</h2>
      <p className="muted">
        A medical bill, a lease, an insurance letter, a government notice. Veil finds your personal details{' '}
        <strong>on this device</strong> and removes them before anything is sent for explanation.
      </p>

      <div
        className={`drop ${over ? 'drop--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) void s.loadFile(f)
        }}
      >
        <label htmlFor="doc" className="sr-only">
          Document text
        </label>
        <textarea
          id="doc"
          value={s.text}
          onChange={(e) => s.setText(e.target.value)}
          placeholder="Paste the text of your document here, drop a .txt file, or use a photo…"
          rows={11}
          spellCheck={false}
        />
        <div className="drop__actions">
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
            <FileIcon size={16} /> Open text file
          </button>
          <button className="btn btn--ghost" onClick={() => photoRef.current?.click()}>
            <CameraIcon size={16} /> Photo of a document
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => e.target.files?.[0] && void s.loadFile(e.target.files[0])} />
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void s.loadFile(e.target.files[0])} />
        </div>
      </div>

      <div className="samples" role="group" aria-label="Sample documents">
        <span className="muted small">No document handy? Try a fictional one:</span>
        {SAMPLES.map((sample) => (
          <button key={sample.id} className="sample" onClick={() => s.setText(sample.text)}>
            <strong>{sample.title}</strong>
            <span className="muted small">{sample.blurb}</span>
          </button>
        ))}
      </div>

      <div className="actions">
        <p className="small muted">
          <ShieldIcon size={14} /> Nothing is uploaded in this step. Photos are read by Gemini Nano on this device only.
        </p>
        <button className="btn btn--primary" disabled={empty || s.busy !== null} onClick={() => void s.analyze(s.text)}>
          Find personal data on this device <ArrowIcon size={16} />
        </button>
      </div>
    </section>
  )
}
