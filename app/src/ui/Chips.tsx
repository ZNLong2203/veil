import type { ExecutedOn } from '../core/types'
import { AlertIcon, BlockIcon, ChipIcon, CloudIcon, CodeIcon } from './icons'

const META: Record<ExecutedOn, { label: string; cls: string; icon: React.ReactNode }> = {
  ON_DEVICE: { label: 'On this device', cls: 'chip chip--device', icon: <ChipIcon size={14} /> },
  IN_CLOUD: { label: 'Cloud', cls: 'chip chip--cloud', icon: <CloudIcon size={14} /> },
  LOCAL: { label: 'Local code', cls: 'chip chip--local', icon: <CodeIcon size={14} /> },
  BLOCKED: { label: 'Blocked', cls: 'chip chip--blocked', icon: <BlockIcon size={14} /> },
  FAILED: { label: 'Failed', cls: 'chip chip--failed', icon: <AlertIcon size={14} /> },
}

/** Where a step ran. Always icon + text, never color alone. */
export function ExecChip({ on }: { on: ExecutedOn }) {
  const m = META[on]
  return (
    <span className={m.cls}>
      {m.icon}
      {m.label}
    </span>
  )
}
