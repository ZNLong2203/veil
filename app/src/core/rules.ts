import type { PiiKind, Span } from './types'

/**
 * Deterministic personal-data detectors. They run entirely in plain code, so they work on
 * every browser, offline, with or without Gemini Nano. They are the floor of Veil's privacy
 * guarantee; the on-device model adds names and addresses on top.
 */

const PRIORITY: Record<PiiKind, number> = {
  CARD: 90,
  IDNUM: 85,
  EMAIL: 80,
  BANK: 75,
  DOB: 70,
  PHONE: 60,
  PERSON: 50,
  ADDRESS: 45,
  OTHER: 10,
}

/** Build a case-insensitive character class version of a keyword (keeps \p{Lu} case-sensitive elsewhere). */
function ci(word: string): string {
  return [...word]
    .map((ch) => {
      const lo = ch.toLowerCase()
      const up = ch.toUpperCase()
      return lo === up ? ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') : `[${lo}${up}]`
    })
    .join('')
}

const alt = (words: string[]) => `(?:${words.map(ci).join('|')})`

function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}

export function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

export function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s/g, '')
  if (iban.length < 15 || iban.length > 34) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)
    for (const digit of v) rem = (rem * 10 + (digit.charCodeAt(0) - 48)) % 97
  }
  return rem === 1
}

type Found = Omit<Span, 'source'>

function* matchAll(re: RegExp, text: string) {
  re.lastIndex = 0
  for (const m of text.matchAll(re)) yield m
}

/** Value of a capture group with its absolute offsets (needs the `d` flag). */
function group(m: RegExpMatchArray, n: number): { start: number; end: number; text: string } | null {
  const idx = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> }).indices?.[n]
  if (!idx || m[n] === undefined) return null
  return { start: idx[0], end: idx[1], text: m[n] }
}

function detectEmails(text: string): Found[] {
  const out: Found[] = []
  for (const m of matchAll(/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, kind: 'EMAIL', text: m[0] })
  }
  return out
}

function detectCards(text: string): Found[] {
  const out: Found[] = []
  for (const m of matchAll(/(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g, text)) {
    if (luhnValid(digitsOnly(m[0]))) {
      out.push({ start: m.index, end: m.index + m[0].length, kind: 'CARD', text: m[0] })
    }
  }
  return out
}

function detectIban(text: string): Found[] {
  const out: Found[] = []
  for (const m of matchAll(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g, text)) {
    if (ibanValid(m[0])) {
      out.push({ start: m.index, end: m.index + m[0].length, kind: 'BANK', text: m[0] })
    }
  }
  return out
}

const ID_KEYWORDS = alt([
  'ssn',
  'social security number',
  'social security no',
  'passport number',
  'passport no',
  'passport',
  'national id',
  'id number',
  'id no',
  'driver license',
  "driver's license",
  'cccd',
  'cmnd',
  'căn cước',
  'tax id',
  'nhs number',
  'medicare number',
  'member id',
  'policy number',
  'policy no',
  'claim number',
  'claim no',
  'case number',
  'case no',
  'a-number',
  'receipt number',
  'patient id',
  'mã số thuế',
  'số hộ chiếu',
])

function detectIds(text: string): Found[] {
  const out: Found[] = []
  for (const m of matchAll(/\b\d{3}-\d{2}-\d{4}\b/g, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, kind: 'IDNUM', text: m[0] })
  }
  const keyed = new RegExp(`(?<![\\p{L}\\p{N}])${ID_KEYWORDS}[\\s:#.\\-]*([A-Z0-9][A-Z0-9-]{4,19})(?![A-Za-z0-9])`, 'dgiu')
  for (const m of matchAll(keyed, text)) {
    const g = group(m, 1)
    if (g && /\d/.test(g.text)) out.push({ ...g, kind: 'IDNUM' })
  }
  return out
}

const BANK_KEYWORDS = alt([
  'account number',
  'account no',
  'account',
  'acct',
  'a/c',
  'routing number',
  'routing',
  'sort code',
  'số tài khoản',
  'tài khoản',
  'stk',
])

function detectBank(text: string): Found[] {
  const out: Found[] = []
  const keyed = new RegExp(`(?<![\\p{L}\\p{N}])${BANK_KEYWORDS}[\\s:#.\\-]*(\\d[\\d -]{4,20}\\d)(?![\\d])`, 'dgiu')
  for (const m of matchAll(keyed, text)) {
    const g = group(m, 1)
    if (g) out.push({ ...g, kind: 'BANK' })
  }
  out.push(...detectIban(text))
  return out
}

const DOB_KEYWORDS = alt(['date of birth', 'dob', 'd.o.b', 'born on', 'born', 'ngày sinh'])

function detectDob(text: string): Found[] {
  const out: Found[] = []
  const date =
    '(\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|[A-Za-z]{3,9}\\.? \\d{1,2},? \\d{4}|\\d{1,2} [A-Za-z]{3,9}\\.? \\d{4})'
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${DOB_KEYWORDS}[\\s:.\\-]*${date}`, 'dgiu')
  for (const m of matchAll(re, text)) {
    const g = group(m, 1)
    if (g) out.push({ ...g, kind: 'DOB' })
  }
  return out
}

function detectPhones(text: string): Found[] {
  const out: Found[] = []
  const patterns = [
    /(?<![\w.])\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{1,4}(?:[\s.-]?\d{2,5}){2,4}(?!\w)/g, // +84 912 345 678, +1 415-555-0132
    /(?<![\w.])\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?!\w)/g, // (415) 555-0132
    /(?<![\w.,])\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,5}(?![\w-])/g, // 0912 345 678, 415-555-0132
    /(?<![\w.,])0\d{9,10}(?!\w)/g, // 0912345678
  ]
  for (const re of patterns) {
    for (const m of matchAll(re, text)) {
      const n = digitsOnly(m[0]).length
      if (n < 9 || n > 15) continue
      // Skip ISO dates and plain money amounts that happen to have enough digits.
      if (/^\d{4}-\d{2}-\d{2}$/.test(m[0])) continue
      out.push({ start: m.index, end: m.index + m[0].length, kind: 'PHONE', text: m[0] })
    }
  }
  return out
}

const NAME_LABELS = alt([
  'patient name',
  'patient',
  'full name',
  'name',
  'tenant',
  'landlord',
  'lessee',
  'lessor',
  'applicant',
  'beneficiary',
  'insured',
  'policyholder',
  'employee',
  'claimant',
  'client',
  'họ và tên',
  'họ tên',
  'bệnh nhân',
])

const NAME_BODY = "\\p{Lu}[\\p{L}'’-]+(?:[ \\t]+\\p{Lu}[\\p{L}'’-]+){0,3}"

const ORG_WORDS = /\b(?:LLC|Inc|Ltd|Corp|Company|Management|Group|Bank|Hospital|Medical|Center|Centre|Services|Properties|Realty|Health|Insurance|Plan|Department|Dept)\b/i

/** "Landlord: Gable & Finch Property Management" is a company, not a person. */
function looksLikeOrganisation(text: string, g: { end: number; text: string }): boolean {
  return ORG_WORDS.test(g.text) || /^[ \t]*(?:&|and\b)/i.test(text.slice(g.end, g.end + 6))
}

const TITLES = '(?:Mr|Mrs|Ms|Miss|Dr|Prof)'
/** A name may not start with a title ("Dear Ms. [PERSON_1]" must not yield "Ms"). */
const NAME_NOT_TITLE = `(?!${TITLES}\\b)${NAME_BODY}`

function detectLabeledNames(text: string): Found[] {
  const out: Found[] = []
  // "Patient: Jordan Rivera" — a label needs a colon or dash, so headings like "PATIENT STATEMENT" are ignored.
  const labeled = new RegExp(
    `(?<![\\p{L}\\p{N}])${NAME_LABELS}[ \\t]*[:\\-–][ \\t]*(?:${TITLES}\\.?[ \\t]+)?(${NAME_NOT_TITLE})`,
    'dgu',
  )
  // "Dear Ms. Natarajan" — salutations need no colon.
  const dear = new RegExp(
    `(?<![\\p{L}\\p{N}])${ci('dear')}[ \\t]+(?:${TITLES}\\.?[ \\t]+)?(${NAME_NOT_TITLE})`,
    'dgu',
  )
  for (const re of [labeled, dear]) {
    for (const m of matchAll(re, text)) {
      const g = group(m, 1)
      if (g && !looksLikeOrganisation(text, g)) out.push({ ...g, kind: 'PERSON' })
    }
  }
  // "Dr. Chen", "Mrs. Okafor"
  const titled = new RegExp(`(?<![\\p{L}\\p{N}])${TITLES}\\.?[ \\t]+(${NAME_NOT_TITLE})`, 'dgu')
  for (const m of matchAll(titled, text)) {
    const g = group(m, 1)
    if (g) out.push({ ...g, kind: 'PERSON' })
  }
  return out
}

function detectAddresses(text: string): Found[] {
  const out: Found[] = []
  const street =
    '(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Highway|Hwy)'
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])\\d{1,6}[A-Za-z]?[ \\t]+(?:\\p{Lu}[\\p{L}.'’-]*[ \\t]+){1,4}${street}\\b\\.?(?:,?\\s*(?:Apt|Unit|Suite|Ste|#)\\.?\\s*[\\w-]+)?(?:,[ \\t]*\\p{Lu}[\\p{L} .'’-]+,[ \\t]*[A-Z]{2}[ \\t]+\\d{5}(?:-\\d{4})?)?`,
    'gu',
  )
  for (const m of matchAll(re, text)) {
    out.push({ start: m.index, end: m.index + m[0].length, kind: 'ADDRESS', text: m[0].replace(/[.,\s]+$/, '') })
  }
  return out
}

/** Pick non-overlapping spans, preferring higher priority, then longer. Returns them in text order. */
function resolveOverlaps(found: Found[]): Found[] {
  const ranked = [...found].sort(
    (a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || b.end - b.start - (a.end - a.start) || a.start - b.start,
  )
  const accepted: Found[] = []
  for (const f of ranked) {
    if (f.end <= f.start) continue
    if (accepted.every((a) => f.end <= a.start || f.start >= a.end)) accepted.push(f)
  }
  return accepted.sort((a, b) => a.start - b.start)
}

/** Run every deterministic detector over `text`. */
export function detectWithRules(text: string): Span[] {
  const found: Found[] = [
    ...detectCards(text),
    ...detectIds(text),
    ...detectEmails(text),
    ...detectBank(text),
    ...detectDob(text),
    ...detectPhones(text),
    ...detectLabeledNames(text),
    ...detectAddresses(text),
  ]
  return resolveOverlaps(found).map((f) => ({ ...f, source: 'rules' as const }))
}
