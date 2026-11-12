import type { DeviceState } from '../state/useDevice'
import { ChipIcon, Logo } from './icons'

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
  if (!caps) return <span className="chip chip--local">Checking on-device AI…</span>
  switch (caps.text) {
    case 'available':
      return (
        <span className="chip chip--device" role="status">
          <ChipIcon size={14} /> Gemini Nano ready{caps.image ? ' · photos on' : ''}
        </span>
      )
    case 'downloadable':
    case 'downloading':
      return (
        <button className="chip chip--action" onClick={() => void device.download()}>
          <ChipIcon size={14} /> {caps.text === 'downloading' ? 'Finish Gemini Nano download' : 'Download Gemini Nano'}
        </button>
      )
    case 'unsupported':
      return (
        <span className="chip chip--local" title="Gemini Nano needs Chrome 139+ on desktop.">
          On-device AI not supported in this browser
        </span>
      )
    default:
      return (
        <span className="chip chip--local" title="This device cannot run Gemini Nano, or it is disabled in chrome://flags.">
          On-device AI unavailable on this device
        </span>
      )
  }
}

export function Header({ device }: { device: DeviceState }) {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <h1>Veil</h1>
          <p className="muted small">Understand sensitive paperwork. Your personal data stays on your device.</p>
        </div>
      </div>
      <div className="topbar__status">
        <DeviceChip device={device} />
        <span className={device.online ? 'chip chip--local' : 'chip chip--failed'} role="status">
          {device.online ? 'Online' : 'Offline'}
        </span>
      </div>
    </header>
  )
}
