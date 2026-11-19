import type { ReactNode } from 'react'

export type Tone = 'blue' | 'violet' | 'green' | 'red' | 'amber'

/** A heading with a coloured icon tile. The colour says what kind of information the section holds. */
export function SectionTitle({ id, tone, icon, children, level = 2 }: { id?: string; tone: Tone; icon: ReactNode; children: ReactNode; level?: 2 | 3 }) {
  const Tag = level === 2 ? 'h2' : 'h3'
  return (
    <Tag id={id} className="h-tile">
      <span className={`tile tile--${tone}`} aria-hidden="true">
        {icon}
      </span>
      {children}
    </Tag>
  )
}
