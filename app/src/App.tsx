import { useEffect } from 'react'
import { isFirebaseConfigured } from './ai/env'
import { useDevice } from './state/useDevice'
import { useSession, type Stage } from './state/useSession'
import { AddStep } from './ui/AddStep'
import { Header } from './ui/Header'
import { Hero } from './ui/Hero'
import { AlertIcon } from './ui/icons'
import { LedgerPanel } from './ui/LedgerPanel'
import { ResultStep } from './ui/ResultStep'
import { ReviewStep } from './ui/ReviewStep'

const STEPS: Array<{ id: Stage; label: string }> = [
  { id: 'add', label: 'Add' },
  { id: 'review', label: 'Review' },
  { id: 'result', label: 'Understand' },
]

export default function App() {
  const device = useDevice()
  const s = useSession(device.caps)
  const current = STEPS.findIndex((x) => x.id === s.stage)

  // Dev-only design preview: /?preview=result renders the result screen from a fixture. Not in production builds.
  const { loadPreview } = s
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'result') {
      void import('./dev/preview').then((m) => m.applyPreview(loadPreview))
    }
  }, [loadPreview])

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {!isFirebaseConfigured && (
        <p className="banner banner--warn banner--top" role="status">
          <AlertIcon size={16} />
          <span>Firebase is not configured, so AI steps are off. You can still add a document and see what Veil would protect (docs/setup.md).</span>
        </p>
      )}
      <Header device={device} />
      {device.error && (
        <p className="banner banner--warn wrap" role="alert">
          <AlertIcon size={16} />
          <span>{device.error}</span>
        </p>
      )}

      <div className="wrap">
        {s.stage === 'add' && <Hero />}

        <div className="layout">
          <main id="main">
            <ol className="steps" aria-label="Progress">
              {STEPS.map((step, i) => (
                <li key={step.id} aria-current={i === current ? 'step' : undefined} className={i < current ? 'done' : i === current ? 'now' : ''}>
                  <span className="steps__n">{i + 1}</span> {step.label}
                </li>
              ))}
            </ol>

            {s.error && (
              <p className="banner banner--error" role="alert" style={{ marginBottom: 20 }}>
                <AlertIcon size={16} />
                <span>{s.error}</span>
              </p>
            )}

            {s.busy && (
              <div className="busy" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" /> {s.busy.label}
                {s.busy.progress !== undefined && <progress value={s.busy.progress} max={1} />}
              </div>
            )}

            {s.stage === 'add' && <AddStep s={s} />}
            {s.stage === 'review' && <ReviewStep s={s} online={device.online} deviceReady={device.caps?.text === 'available'} />}
            {s.stage === 'result' && <ResultStep s={s} />}
          </main>
          <LedgerPanel vault={s.vault} version={s.version} />
        </div>
      </div>

      <footer className="foot wrap small muted">
        Open source (Apache-2.0). Built with Firebase AI Logic hybrid inference: Gemini Nano on-device, Gemini in the cloud.
      </footer>
    </div>
  )
}
