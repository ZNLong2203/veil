import { ArrowIcon, ChipIcon, CloudIcon, EyeIcon, ShieldIcon } from './icons'

/** A tiny, static picture of what Veil does with one sentence of a document. */
function FlowDiagram() {
  return (
    <figure className="flow" aria-label="How Veil handles a document">
      <div className="flow__node flow__node--device">
        <div className="flow__label">
          <span>Your document</span>
          <span className="chip chip--device">
            <ChipIcon size={12} /> Stays here
          </span>
        </div>
        <p className="flow__text">
          Patient <mark>Jordan Rivera</mark>, SSN <mark>912-34-5678</mark>. Balance due <strong>$3,755</strong> by Dec 15.
        </p>
      </div>

      <div className="flow__link">
        <ShieldIcon size={14} /> Gemini Nano finds your personal data on-device
      </div>

      <div className="flow__node flow__node--cloud">
        <div className="flow__label">
          <span>What the cloud sees</span>
          <span className="chip chip--cloud">
            <CloudIcon size={12} /> Only this leaves
          </span>
        </div>
        <p className="flow__text">
          Patient <span className="tok">[PERSON_1]</span>, SSN <span className="tok">[IDNUM_1]</span>. Balance due <strong>$3,755</strong> by Dec 15.
        </p>
      </div>

      <div className="flow__link">
        <CloudIcon size={14} /> Gemini explains it, in your language
      </div>

      <div className="flow__node flow__node--device">
        <div className="flow__label">
          <span>On your screen</span>
          <span className="chip chip--device">
            <ChipIcon size={12} /> Filled back in locally
          </span>
        </div>
        <p className="flow__text">
          <strong>Jordan</strong>, you owe $3,755. Pay, or ask for an itemized bill and financial aid, before Dec 15.
        </p>
      </div>
    </figure>
  )
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-h">
      <div>
        <p className="eyebrow">
          <ShieldIcon size={14} /> Private by design
        </p>
        <h1 id="hero-h" className="hero__title">
          Understand the paperwork. <em>Keep your personal data.</em>
        </h1>
        <p className="hero__lead">
          Veil explains bills, leases and official letters in plain language, in your language. Your personal details are found
          and removed on this device, so only a redacted copy ever reaches the cloud.
        </p>
        <ul className="proofs">
          <li>
            <span className="proofs__icon">
              <ChipIcon size={20} />
            </span>
            <div>
              <strong>Detected on your device</strong>
              <span>Names, addresses and IDs are found by Gemini Nano and pattern rules, never uploaded.</span>
            </div>
          </li>
          <li>
            <span className="proofs__icon">
              <ArrowIcon size={20} />
            </span>
            <div>
              <strong>Only a redacted copy leaves</strong>
              <span>A guard re-checks every request and blocks it if anything personal remains.</span>
            </div>
          </li>
          <li>
            <span className="proofs__icon">
              <EyeIcon size={20} />
            </span>
            <div>
              <strong>You see exactly what is sent</strong>
              <span>Side by side, with a live ledger of where each step ran.</span>
            </div>
          </li>
        </ul>
      </div>
      <FlowDiagram />
    </section>
  )
}
