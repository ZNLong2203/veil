type Json = Record<string, unknown>

const str = (description?: string): Json => ({ type: 'string', ...(description ? { description } : {}) })
const list = (items: Json): Json => ({ type: 'array', items })
const obj = (properties: Json, required: string[]): Json => ({ type: 'object', properties, required })

/**
 * On-device only. Pattern rules already cover structured identifiers (emails, phone/ID/card numbers),
 * so Gemini Nano is asked only for what rules cannot know: people's names and addresses in free text.
 * Two flat lists are far easier for a small model than a typed list of nine categories.
 */
export const ENTITY_SCHEMA = obj({ people: list(str()), addresses: list(str()) }, ['people', 'addresses'])

export const DOC_TYPES = [
  'medical bill',
  'insurance letter',
  'lease or rental',
  'employment',
  'government notice',
  'bank or credit',
  'legal',
  'school',
  'other',
] as const

export const TRIAGE_SCHEMA = obj(
  {
    documentType: { type: 'string', enum: [...DOC_TYPES] },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    language: str('Language the document is written in, e.g. English'),
  },
  ['documentType', 'urgency', 'language'],
)

const severity = { type: 'string', enum: ['low', 'medium', 'high'] }

/** Cloud: the full explanation. */
export const EXPLAIN_SCHEMA = obj(
  {
    documentType: str(),
    plainSummary: str('3-5 sentences, plain language'),
    keyFacts: list(obj({ label: str(), value: str() }, ['label', 'value'])),
    deadlines: list(obj({ what: str(), date: str(), consequence: str() }, ['what', 'date'])),
    redFlags: list(obj({ issue: str(), whyItMatters: str(), severity }, ['issue', 'whyItMatters', 'severity'])),
    questionsToAsk: list(str()),
    nextSteps: list(str()),
  },
  ['documentType', 'plainSummary', 'keyFacts', 'deadlines', 'redFlags', 'questionsToAsk', 'nextSteps'],
)

/** Offline fallback on Gemini Nano: small enough for its context window. */
export const EXPLAIN_COMPACT_SCHEMA = obj(
  {
    plainSummary: str('2-3 sentences'),
    deadlines: list(obj({ what: str(), date: str() }, ['what', 'date'])),
    redFlags: list(obj({ issue: str(), whyItMatters: str(), severity }, ['issue', 'whyItMatters', 'severity'])),
  },
  ['plainSummary', 'deadlines', 'redFlags'],
)

export const FOLLOWUP_SCHEMA = obj({ answer: str('Direct answer, max 6 sentences') }, ['answer'])
