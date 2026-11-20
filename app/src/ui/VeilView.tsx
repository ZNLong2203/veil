import { useEffect, useRef, useState, type RefObject } from 'react'
import { PII_LABELS } from '../core/types'
import type { VaultEntry } from '../core/vault'
import { ChipIcon, CloudIcon } from './icons'

type Segment = { text: string; entry: VaultEntry | null }

const VIEWS = [
  { label: 'Yours', at: 100 },
  { label: 'Split', at: -1 },
  { label: 'Cloud', at: 0 },
] as const

/** Where the middle of the text is, as a percentage of the stage width (kept between 22% and 75%). */
function textMiddle(stageEl: HTMLElement | null, layerEl: HTMLElement | null): number {
  const stage = stageEl?.getBoundingClientRect()
  if (!stage || !layerEl || stage.width === 0) return 50
  const range = document.createRange()
  range.selectNodeContents(layerEl)
  const text = range.getBoundingClientRect()
  if (text.width === 0) return 50
  return Math.min(75, Math.max(22, ((text.left + text.width / 2 - stage.left) / stage.width) * 100))
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The veil. One document, two layers with identical layout: underneath, your text with the personal
 * data highlighted; on top, the redacted copy the cloud would get. Dragging the handle moves the
 * edge between them, so you can see every value turn into its placeholder in place.
 *
 * Each value is drawn as a one-cell grid holding both the real text and its placeholder (one of them
 * invisible), so both layers wrap exactly the same way and the two views line up.
 */
export function VeilView({
  segments,
  docRef,
  onSelectionChange,
}: {
  segments: Segment[]
  docRef: RefObject<HTMLDivElement | null>
  onSelectionChange: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(100)
  const [dragging, setDragging] = useState(false)

  // The reveal: once on arrival, the veil glides in from the right and stops halfway (CSS transition on --at).
  const [gliding, setGliding] = useState(true)
  // "Split" means the middle of the text, not of the frame: short lines would otherwise sit wholly on one side.
  const [mid, setMid] = useState(50)
  const measureMid = () => textMiddle(stageRef.current, docRef.current)
  useEffect(() => {
    const t1 = setTimeout(
      () => {
        const m = textMiddle(stageRef.current, docRef.current)
        setMid(m)
        setAt(m)
      },
      reducedMotion() ? 0 : 500,
    )
    const t2 = setTimeout(() => setGliding(false), reducedMotion() ? 0 : 2000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [docRef])

  const moveTo = (clientX: number) => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    setAt(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5
    const next = { ArrowLeft: at - step, ArrowRight: at + step, Home: 0, End: 100 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    setAt(Math.min(100, Math.max(0, next)))
  }

  const layer = (cloud: boolean) =>
    segments.map((seg, i) =>
      seg.entry ? (
        <span key={i} className="ent" title={cloud ? `${PII_LABELS[seg.entry.kind]} hidden` : `${seg.entry.token} · ${PII_LABELS[seg.entry.kind]}`}>
          <mark className="ent__real">{seg.text}</mark>
          <span className="ent__tok">{seg.entry.token}</span>
        </span>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    )

  const hidden = segments.filter((s) => s.entry).length

  return (
    <section className="veil" aria-label="Your document, and what the cloud will see">
      <header className="veil__head">
        <span className="veil__side veil__side--you">
          <ChipIcon size={14} /> Your document <span className="veil__sub">stays here</span>
        </span>
        <div className="seg" role="group" aria-label="Choose a view">
          {VIEWS.map((v) => (
            <button key={v.label} type="button" aria-pressed={Math.round(at) === Math.round(v.at < 0 ? mid : v.at)} onClick={() => {
                setGliding(true)
                setAt(v.at < 0 ? measureMid() : v.at)
                setTimeout(() => setGliding(false), 700)
              }}>
              {v.label}
            </button>
          ))}
        </div>
        <span className="veil__side veil__side--cloud">
          <span className="veil__sub">only this leaves</span> What the cloud sees <CloudIcon size={14} />
        </span>
      </header>

      <div
        ref={stageRef}
        className={`veil__stage ${dragging ? 'veil__stage--drag' : ''} ${gliding ? 'veil__stage--glide' : ''}`}
        style={{ '--at': `${at}%` } as React.CSSProperties}
        onPointerMove={(e) => dragging && moveTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div className="veil__scroll">
          <div className="veil__content">
            <div
              ref={docRef}
              className="veil__layer veil__layer--you"
              onMouseUp={onSelectionChange}
              onKeyUp={onSelectionChange}
              tabIndex={0}
              aria-label="Your document with protected values highlighted. Select text to protect it."
            >
              {layer(false)}
            </div>
            <div className="veil__layer veil__layer--cloud" aria-hidden="true">
              {layer(true)}
            </div>
          </div>
        </div>
        <span className="veil__line" aria-hidden="true" />
        <div
          className="veil__handle"
          role="slider"
          tabIndex={0}
          aria-label="Veil: drag to compare your document with the cloud's copy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(at)}
          aria-valuetext={at >= 99 ? 'Your document' : at <= 1 ? "The cloud's copy" : `${Math.round(100 - at)}% veiled`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragging(true)
          }}
          onPointerMove={(e) => dragging && moveTo(e.clientX)}
          onPointerUp={() => setDragging(false)}
        >
          <span className="veil__grip" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>

      <footer className="veil__foot">
        <span>
          <strong>{hidden}</strong> place{hidden === 1 ? '' : 's'} veiled · drag the handle to compare
        </span>
        <span className="veil__hint">Missed something? Select it in your document to protect it.</span>
      </footer>
    </section>
  )
}
