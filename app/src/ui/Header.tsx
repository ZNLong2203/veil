import { useEffect, useState } from 'react'
import type { DeviceState } from '../state/useDevice'
import { ArrowIcon, ChipIcon, CloudIcon, CodeIcon, Logo } from './icons'
import { ThemeToggle } from './ThemeToggle'

type Tone = 'ok' | 'warn' | 'off' | 'busy'

/** The on-device half of the hybrid indicator. */
function deviceState(device: DeviceState): { tone: Tone; label: string; title: string; action?: () => void } {
  const { caps, progress } = device
  if (progress !== null) return { tone: 'busy', label: `Downloading ${Math.round(progress * 100)}%`, title: 'Gemini Nano is downloading to this device.' }
  if (!caps) return { tone: 'busy', label: 'Checking…', title: 'Checking whether Gemini Nano can run here.' }
  switch (caps.text) {
    case 'available':
      return {
        tone: 'ok',
        label: 'Ready',
        title: caps.image ? 'Gemini Nano runs on this device and can read photos of documents.' : 'Gemini Nano runs on this device.',
      }
    case 'downloadable':
    case 'downloading':
      return { tone: 'warn', label: caps.text === 'downloading' ? 'Finish download' : 'Download', title: 'Download Gemini Nano to this device.', action: () => void device.download() }
    case 'unsupported':
      return { tone: 'off', label: 'Rules only', title: 'Gemini Nano needs Chrome 139+ on desktop. Veil still protects your data with pattern rules.' }
    default:
      return { tone: 'off', label: 'Rules only', title: 'This device cannot run Gemini Nano, or it is disabled in chrome://flags. Veil still protects your data with pattern rules.' }
  }
}

/**
 * The hybrid indicator: the two engines Veil routes between, with the state of each.
 * Left, Gemini Nano on this device; right, Gemini in the cloud (which only ever gets redacted text).
 */
function HybridStatus({ device, cloudEnabled }: { device: DeviceState; cloudEnabled: boolean }) {
  const d = deviceState(device)
  const cloud: { tone: Tone; label: string; title: string } = !device.online
    ? { tone: 'warn', label: 'Offline', title: 'You are offline. Gemini Nano keeps working on this device.' }
    : !cloudEnabled
      ? { tone: 'warn', label: 'Paused', title: 'Cloud steps are paused by Remote Config. Gemini Nano keeps working on this device.' }
      : { tone: 'ok', label: 'Redacted only', title: 'Gemini in the cloud only ever receives text with your personal data replaced by placeholders.' }

  const deviceInner = (
    <>
      <ChipIcon size={15} />
      <span className="hybrid__name">
        Gemini Nano <span className="hybrid__where">on device</span>
      </span>
      <span className={`hybrid__state hybrid__state--${d.tone}`}>
        <span className="dot" /> {d.label}
      </span>
    </>
  )

  return (
    <div className="hybrid" role="group" aria-label="Hybrid AI status">
      {d.action ? (
        <button className="hybrid__half hybrid__half--device" onClick={d.action} title={d.title}>
          {deviceInner}
        </button>
      ) : (
        <span className="hybrid__half hybrid__half--device" role="status" title={d.title}>
          {deviceInner}
        </span>
      )}
      <span className="hybrid__link" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9h15l-4-4M20 15H5l4 4" />
        </svg>
      </span>
      <span className="hybrid__half hybrid__half--cloud" role="status" title={cloud.title}>
        <CloudIcon size={15} />
        <span className="hybrid__name">
          Gemini <span className="hybrid__where">cloud</span>
        </span>
        <span className={`hybrid__state hybrid__state--${cloud.tone}`}>
          <span className="dot" /> {cloud.label}
        </span>
      </span>
    </div>
  )
}

export function Header({
  device,
  cloudEnabled,
  stage,
  onTry,
  onReset,
  busy,
}: {
  device: DeviceState
  cloudEnabled: boolean
  stage: 'add' | 'review' | 'result'
  onTry: () => void
  onReset: () => void
  busy: boolean
}) {
  // A hairline and a frosted background appear once the page scrolls under the bar.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`topbar ${scrolled ? 'topbar--scrolled' : ''}`}>
      <div className="topbar__inner wrap">
        <a className="brand" href="/" aria-label="Veil, home">
          <Logo />
          <span className="brand__text">
            <span className="brand__name">Veil</span>
            <span className="brand__tag">Private paperwork explainer</span>
          </span>
        </a>

        <HybridStatus device={device} cloudEnabled={cloudEnabled} />

        <nav className="topbar__right" aria-label="Links and actions">
          <a className="navbtn navbtn--icon" href="https://github.com/ZNLong2203/veil" target="_blank" rel="noreferrer" title="Source code on GitHub" aria-label="Source code on GitHub">
            <CodeIcon size={17} />
          </a>
          <ThemeToggle />
          {stage === 'add' ? (
            <button className="navcta" onClick={onTry} disabled={busy}>
              Try a sample <ArrowIcon size={16} />
            </button>
          ) : (
            <button className="navcta navcta--quiet" onClick={onReset} disabled={busy}>
              New document
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
