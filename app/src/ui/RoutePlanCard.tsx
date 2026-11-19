import { estimateTokens, NANO_LANGS, type PlanStep } from '../core/planner'
import { POLICY } from '../core/policy'
import type { Session } from '../state/useSession'
import { ChipIcon, CloudIcon, CodeIcon } from './icons'
import { SectionTitle } from './SectionTitle'

const RUNS_ON: Record<PlanStep['runsOn'], { label: string; cls: string; icon: React.ReactNode }> = {
  device: { label: 'On this device', cls: 'chip chip--device', icon: <ChipIcon size={14} /> },
  cloud: { label: 'Cloud · redacted text', cls: 'chip chip--cloud', icon: <CloudIcon size={14} /> },
  'cloud-or-device': { label: 'Cloud, device fallback', cls: 'chip chip--cloud', icon: <CloudIcon size={14} /> },
  skipped: { label: 'Skipped', cls: 'chip chip--local', icon: <CodeIcon size={14} /> },
}

/**
 * Custom routing made visible. The static policy says what each step MAY do; this card shows what it
 * WILL do for this document on this device right now, and the signal that decided it.
 */
export function RoutePlanCard({ s }: { s: Session }) {
  const { plan, signals } = s
  const tokens = estimateTokens(signals.docChars)
  const langSupported = NANO_LANGS.has(signals.language.code)

  const chips: Array<{ text: string; tone?: 'warn' | 'ok' }> = [
    { text: signals.online ? 'Online' : 'Offline', tone: signals.online ? undefined : 'warn' },
    { text: signals.nano === 'available' ? 'Gemini Nano ready' : 'Gemini Nano not ready', tone: signals.nano === 'available' ? 'ok' : 'warn' },
    { text: `${signals.language.label}${langSupported ? '' : ' · not an official Nano language'}`, tone: langSupported ? undefined : 'warn' },
    { text: `${signals.docChars.toLocaleString()} characters ≈ ${tokens.toLocaleString()} tokens` },
  ]
  if (signals.batteryLevel !== undefined) {
    chips.push({ text: `Battery ${Math.round(signals.batteryLevel * 100)}% ${signals.charging ? '· charging' : '· on battery'}` })
  }
  if (signals.saveData) chips.push({ text: 'Data saver on', tone: 'warn' })
  if (!signals.cloudEnabled) chips.push({ text: 'Cloud paused by Remote Config', tone: 'warn' })

  return (
    <section className="card" aria-labelledby="plan-h">
      <div className="card__head">
        <SectionTitle id="plan-h" tone="violet" icon={<ChipIcon size={18} />}>
          Route plan
        </SectionTitle>
        <p className="small muted">How Veil will run this document on this device right now, and why.</p>
      </div>

      <ul className="signals" aria-label="Signals used for routing">
        {chips.map((c) => (
          <li key={c.text} className={`signal ${c.tone ? `signal--${c.tone}` : ''}`}>
            {c.text}
          </li>
        ))}
      </ul>

      <ol className="plan">
        {plan.steps.map((step) => {
          const r = RUNS_ON[step.runsOn]
          return (
            <li key={step.task} className="plan__step">
              <div className="plan__head">
                <strong>{POLICY[step.task].label}</strong>
                <span className={r.cls}>
                  {r.icon}
                  {r.label}
                </span>
              </div>
              <p className="small muted">{step.reason}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
