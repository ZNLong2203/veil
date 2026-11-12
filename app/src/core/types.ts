/** Categories of personal data Veil removes before anything can leave the device. */
export const PII_KINDS = [
  'PERSON',
  'ADDRESS',
  'EMAIL',
  'PHONE',
  'IDNUM',
  'CARD',
  'BANK',
  'DOB',
  'OTHER',
] as const

export type PiiKind = (typeof PII_KINDS)[number]

export const PII_LABELS: Record<PiiKind, string> = {
  PERSON: 'Name',
  ADDRESS: 'Address',
  EMAIL: 'Email',
  PHONE: 'Phone',
  IDNUM: 'ID number',
  CARD: 'Card number',
  BANK: 'Bank account',
  DOB: 'Date of birth',
  OTHER: 'Other',
}

/** Who found a piece of personal data. Shown in the review step. */
export type SpanSource = 'rules' | 'on-device' | 'user'

export interface Span {
  start: number
  end: number
  kind: PiiKind
  text: string
  source: SpanSource
}

/**
 * Where a step really ran. LOCAL = plain code, no model involved. BLOCKED = the egress guard
 * refused to send it. FAILED = the call threw before a result came back.
 */
export type ExecutedOn = 'ON_DEVICE' | 'IN_CLOUD' | 'LOCAL' | 'BLOCKED' | 'FAILED'
