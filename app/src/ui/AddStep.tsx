import { useRef, useState } from 'react'
import { SAMPLES } from '../samples'
import type { Session } from '../state/useSession'
import { ArrowIcon, CameraIcon, DocIcon, FileIcon, HeartIcon, HomeIcon, ShieldIcon } from './icons'

const SAMPLE_ICON: Record<string, React.ReactNode> = {
  bill: <HeartIcon size={18} />,
  lease: <HomeIcon size={18} />,
  denial: <DocIcon size={18} />,
}

export function AddStep({ s }: { s: Session }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const empty = s.text.trim().length === 0

  return (
    <section className="card card--lift" aria-labelledby="add-h">
      <div className="card__head">
        <h2 id="add-h">Add your document</h2>
        <p className="muted">Paste the text, open a file, or take a photo. Nothing is uploaded in this step.</p>
      </div>

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
          placeholder="Paste the text of your bill, lease or letter here, or drop a .txt file…"
          rows={10}
          spellCheck={false}
        />
        <div className="drop__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            <FileIcon size={16} /> Open text file
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => photoRef.current?.click()}>
            <CameraIcon size={16} /> Photo of a document
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => e.target.files?.[0] && void s.loadFile(e.target.files[0])} />
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void s.loadFile(e.target.files[0])} />
        </div>
      </div>

      <p className="samples__label" id="samples-l">
        No document handy? Try a fictional one
      </p>
      <div className="samples" role="group" aria-labelledby="samples-l">
        {SAMPLES.map((sample) => (
          <button key={sample.id} className="sample" onClick={() => s.setText(sample.text)}>
            <span className="sample__icon">{SAMPLE_ICON[sample.id] ?? <DocIcon size={18} />}</span>
            <span>
              <strong>{sample.title}</strong>
              <span>{sample.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="cta">
        <p className="small muted">
          <ShieldIcon size={16} /> Photos are read by Gemini Nano on this device only. Text is checked for personal data
          before anything else happens.
        </p>
        <button className="btn btn--primary btn--lg" disabled={empty || s.busy !== null} onClick={() => void s.analyze(s.text)}>
          Find personal data on this device <ArrowIcon size={18} />
        </button>
      </div>
    </section>
  )
}
