import { useSyncExternalStore } from 'react'
import { ledger, summarize } from '../core/ledger'
import { POLICY } from '../core/policy'
import type { Vault } from '../core/vault'
import { ExecChip } from './Chips'
import { PlaneIcon, ShieldIcon } from './icons'
import { WirePanel } from './WirePanel'

const ROUTE_LABEL = {
  ON_DEVICE_ONLY: 'only on-device',
  PREFER_ON_DEVICE: 'prefer on-device',
  PREFER_CLOUD: 'prefer cloud',
  CLOUD_ONLY: 'only cloud',
} as const

/**
 * The Privacy Ledger. Built from what the SDK reports it actually did (`inferenceSource`),
 * so it is evidence, not a promise. Holds sizes and counts only, never document text.
 */
export function LedgerPanel({ vault, version }: { vault: Vault; version: number }) {
  const entries = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot)
  const s = summarize(entries)
  void version

  return (
    <aside className="ledger" aria-label="Privacy ledger">
      <header className="ledger__head">
        <h2>
          <ShieldIcon size={18} /> Privacy ledger
        </h2>
        {entries.length > 0 && (
          <button className="link" onClick={() => ledger.clear()}>
            Clear
          </button>
        )}
      </header>
      <p className="ledger__sub">Where each AI step really ran.</p>

      <dl className="stats">
        <div>
          <dt>Values protected</dt>
          <dd>{vault.size}</dd>
        </div>
        <div className="stat--device">
          <dt>On device</dt>
          <dd>{s.onDevice}</dd>
        </div>
        <div className="stat--cloud">
          <dt>In cloud</dt>
          <dd>{s.inCloud}</dd>
        </div>
        <div className="stat--blocked">
          <dt>Blocked</dt>
          <dd>{s.blocked}</dd>
        </div>
      </dl>
      <p className="ledger__sent">
        Sent to the cloud: <strong>{s.charsSent.toLocaleString()} characters</strong>, all with personal data replaced by
        placeholders.
      </p>

      <ol className="timeline" aria-live="polite">
        {entries.length === 0 && <li className="muted small">AI steps will appear here as they happen.</li>}
        {[...entries].reverse().map((e) => (
          <li key={e.id} data-on={e.executedOn}>
            <div className="timeline__row">
              <strong>{POLICY[e.task].label}</strong>
              <ExecChip on={e.executedOn} />
            </div>
            <div className="muted small">
              {ROUTE_LABEL[e.route]} · {e.durationMs} ms
              {e.charsSent > 0 && ` · ${e.charsSent.toLocaleString()} chars sent`}
            </div>
            {e.note && <div className="note">{e.note}</div>}
          </li>
        ))}
      </ol>

      <WirePanel vault={vault} version={version} />

      <details className="policy">
        <summary>How routing works</summary>
        <p className="small muted">
          Hybrid inference is used as a data-sensitivity router. A step that reads raw data may only run on this device; steps
          that get redacted text may use the cloud.
        </p>
        <ul>
          {Object.values(POLICY).map((t) => (
            <li key={t.id}>
              <strong className="small">{t.label}</strong>
              <span className="chip chip--local">{ROUTE_LABEL[t.route]}</span>
              <p className="small muted">{t.why}</p>
            </li>
          ))}
        </ul>
      </details>

      <p className="ledger__tip">
        <PlaneIcon size={14} /> Try it: switch off Wi-Fi after the model is downloaded. Review and a short summary still work
        on-device.
      </p>
    </aside>
  )
}
