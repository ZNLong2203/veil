import type { DeviceState } from '../state/useDevice'
import { useEffect, useState } from 'react'
import { ChipIcon, CodeIcon, Logo } from './icons'
import { ThemeToggle } from './ThemeToggle'

function DeviceChip({ device }: { device: DeviceState }) {
  const { caps, progress } = device
  if (progress !== null) {
    const pct = Math.round(progress * 100)
    return (
      <span className="chip chip--device" role="status">
        <ChipIcon size={14} /> Downloading Gemini Nano… {pct}%
      </span>
    )
  }
  if (!caps) return <span className="navpill navpill--muted">Checking on-device AI…</span>
  switch (caps.text) {
    case 'available':
      return (
        <span
          className="navpill"
          role="status"
          title={caps.image ? 'Gemini Nano runs on this device and can read photos of documents.' : 'Gemini Nano runs on this device.'}
        >
          <span className="dot dot--ok dot--live" />
          <span>
            <span className="navpill__long">Gemini </span>Nano ready
          </span>
        </span>
      )
    case 'downloadable':
    case 'downloading':
      return (
        <button className="navbtn navbtn--accent" onClick={() => void device.download()}>
          <ChipIcon size={14} /> {caps.text === 'downloading' ? 'Finish Gemini Nano download' : 'Download Gemini Nano'}
        </button>
      )
    case 'unsupported':
      return (
        <span className="navpill navpill--muted" title="Gemini Nano needs Chrome 139+ on desktop. Veil still protects your data with pattern rules.">
          <span className="dot" /> No on-device AI in this browser
        </span>
      )
    default:
      return (
        <span className="navpill navpill--muted" title="This device cannot run Gemini Nano, or it is disabled in chrome://flags. Veil still protects your data with pattern rules.">
          <span className="dot" /> On-device AI unavailable
        </span>
      )
  }
}

export function Header({ device }: { device: DeviceState }) {
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
          <span className="brand__name">Veil</span>
          <span className="brand__tag">Private paperwork explainer</span>
        </a>
        <nav className="topbar__right" aria-label="Status and links">
          {!device.online && (
            <span className="navpill navpill--warn" role="status" title="Cloud steps are paused. Gemini Nano keeps working on this device.">
              <span className="dot" /> Offline · on-device only
            </span>
          )}
          <DeviceChip device={device} />
          <a className="navbtn navbtn--source" href="https://github.com/ZNLong2203/veil" target="_blank" rel="noreferrer" title="Source code on GitHub">
            <CodeIcon size={16} /> <span className="navbtn__label">Source</span>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
