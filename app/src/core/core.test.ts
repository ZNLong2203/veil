import { describe, expect, it } from 'vitest'
import { chunkText } from './chunk'
import { assertSafeForCloud, EgressBlockedError, inspectEgress } from './egress'
import { Ledger, summarize } from './ledger'
import { POLICY, policyViolations, type TaskPolicy } from './policy'
import { buildRedaction } from './redact'
import { detectWithRules, ibanValid, luhnValid } from './rules'
import { buildIcs, isValidIsoDate } from './ics'
import { Vault } from './vault'
import { SAMPLES } from '../samples'

// All data below is fictional. 555-01xx numbers, 9xx SSNs and the 4111… card are reserved test values.
const BILL = `Riverside Medical Center — Statement
Patient: Jordan Rivera
Date of birth: 04/12/1988
Address: 1420 Maple Street, Apt 4B
Phone: (415) 555-0132   Email: jordan.rivera@example.com
SSN: 912-34-5678
Claim number: CLM-88231-77
Card on file: 4111 1111 1111 1111
Account number: 00123456789
Total due: $1,248.50 by 2026-12-15.
Dr. Chen billed an out-of-network anesthesiologist.`

describe('detectors', () => {
  const spans = detectWithRules(BILL)
  const found = (kind: string) => spans.filter((s) => s.kind === kind).map((s) => s.text)

  it('finds the structured identifiers', () => {
    expect(found('EMAIL')).toEqual(['jordan.rivera@example.com'])
    expect(found('PHONE')).toContain('(415) 555-0132')
    expect(found('IDNUM')).toEqual(expect.arrayContaining(['912-34-5678', 'CLM-88231-77']))
    expect(found('CARD')).toEqual(['4111 1111 1111 1111'])
    expect(found('BANK')).toEqual(['00123456789'])
    expect(found('DOB')).toEqual(['04/12/1988'])
  })

  it('finds labelled names and street addresses without a model', () => {
    expect(found('PERSON')).toEqual(expect.arrayContaining(['Jordan Rivera', 'Chen']))
    expect(found('ADDRESS')[0]).toMatch(/^1420 Maple Street/)
  })

  it('does not treat amounts or deadlines as personal data', () => {
    const all = spans.map((s) => s.text).join('|')
    expect(all).not.toContain('1,248.50')
    expect(all).not.toContain('2026-12-15')
  })

  it('validates card numbers with Luhn and IBANs with mod-97', () => {
    expect(luhnValid('4111111111111111')).toBe(true)
    expect(luhnValid('4111111111111112')).toBe(false)
    expect(ibanValid('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(ibanValid('GB82 WEST 1234 5698 7654 33')).toBe(false)
  })

  it('catches Vietnamese phone numbers and labels', () => {
    const vn = detectWithRules('Họ và tên: Nguyễn Văn An\nĐiện thoại: 0912 345 678\nCCCD: 079088001234')
    expect(vn.map((s) => s.text)).toEqual(expect.arrayContaining(['Nguyễn Văn An', '0912 345 678', '079088001234']))
  })
})

describe('sign-off names', () => {
  const found = (t: string) => detectWithRules(t).filter((x) => x.kind === 'PERSON').map((x) => x.text)
  it('catches the writer after a closing', () => {
    expect(found('Please pay by Friday.\n\nSincerely,\nMarcus Finch, Property Manager')).toContain('Marcus Finch')
    expect(found('Gracias.\nAtentamente,\nDr. Javier Ortega')).toContain('Javier Ortega')
    expect(found('Thanks\nJordan')).toContain('Jordan')
  })
  it('does not treat an organisation after a closing as a person', () => {
    expect(found('Thank you,\nRiverside Medical Center')).toEqual([])
    expect(found('Regards\nGable & Finch Property Management')).toEqual([])
  })
  it('does not fire on a closing word in the middle of a sentence', () => {
    expect(found('We thank you for your patience.\nAccounts are reviewed weekly.')).toEqual([])
  })
})

describe('vault', () => {
  it('gives the same placeholder to the same value in any casing', () => {
    const v = new Vault()
    const a = v.add('PERSON', 'Jordan Rivera', 'rules')
    const b = v.add('PERSON', 'JORDAN  rivera', 'on-device')
    expect(a?.token).toBe('[PERSON_1]')
    expect(b?.token).toBe('[PERSON_1]')
    expect(v.size).toBe(1)
  })

  it('redacts every occurrence, longest value first, on word boundaries', () => {
    const v = new Vault()
    v.add('PERSON', 'Jordan Rivera', 'rules')
    v.add('PERSON', 'Rivera', 'on-device')
    const out = v.apply('Jordan Rivera met Dr. Rivera. Riverside is unrelated.')
    expect(out).toBe('[PERSON_1] met Dr. [PERSON_2]. Riverside is unrelated.')
  })

  it('round-trips through rehydrate, even when the model drops the brackets', () => {
    const v = new Vault()
    v.addSpans(detectWithRules(BILL))
    const redacted = v.apply(BILL)
    expect(v.rehydrate(redacted)).toBe(BILL)
    expect(v.rehydrate('Call PERSON_1 or [person_1].')).toBe('Call Jordan Rivera or Jordan Rivera.')
  })

  it('segments text into plain and protected runs that reassemble to the original', () => {
    const v = new Vault()
    v.addSpans(detectWithRules(BILL))
    const segs = v.segments(BILL)
    expect(segs.map((s) => s.text).join('')).toBe(BILL)
    expect(segs.filter((s) => s.entry).map((s) => s.entry!.kind)).toContain('EMAIL')
    expect(new Vault().segments('abc')).toEqual([{ text: 'abc', entry: null }])
  })

  it('rehydrates nested model output, including values with quotes', () => {
    const v = new Vault()
    v.add('PERSON', 'Sean "Bud" O\'Brien', 'user')
    const out = v.rehydrateDeep({ a: ['Hello [PERSON_1]'], b: { c: '[PERSON_1]' }, n: 3 })
    expect(out).toEqual({ a: ['Hello Sean "Bud" O\'Brien'], b: { c: 'Sean "Bud" O\'Brien' }, n: 3 })
  })

  it('leaves unknown placeholders alone and supports un-protecting a value', () => {
    const v = new Vault()
    v.add('PERSON', 'Jordan Rivera', 'rules')
    expect(v.rehydrate('[PERSON_9]')).toBe('[PERSON_9]')
    v.remove('[PERSON_1]')
    expect(v.apply('Jordan Rivera')).toBe('Jordan Rivera')
  })
})

describe('egress guard', () => {
  it('passes a properly redacted document', () => {
    const v = new Vault()
    v.addSpans(detectWithRules(BILL))
    const redacted = v.apply(BILL)
    expect(inspectEgress(redacted, v)).toEqual([])
    expect(() => assertSafeForCloud(redacted, v)).not.toThrow()
    expect(redacted).not.toMatch(/Jordan|Rivera|555-0132|912-34|4111/)
  })

  it('blocks a payload that still contains a vault value', () => {
    const v = new Vault()
    v.add('PERSON', 'Jordan Rivera', 'on-device')
    expect(() => assertSafeForCloud('Please explain why Jordan Rivera owes this.', v)).toThrow(EgressBlockedError)
  })

  it('blocks structured identifiers the vault has never seen', () => {
    const v = new Vault()
    const findings = inspectEgress('Contact me at someone@example.org', v)
    expect(findings).toEqual([{ kind: 'EMAIL', via: 'rules', count: 1 }])
  })

  it('never puts the leaked value into its error message', () => {
    const v = new Vault()
    v.add('PERSON', 'Jordan Rivera', 'on-device')
    try {
      assertSafeForCloud('Jordan Rivera, 912-34-5678', v)
      expect.unreachable()
    } catch (e) {
      expect((e as Error).message).not.toMatch(/Jordan|Rivera|912-34-5678/)
    }
  })
})

describe('policy', () => {
  it('never lets a task that reads raw data reach the cloud', () => {
    expect(policyViolations()).toEqual([])
  })

  it('detects a violation when one is introduced', () => {
    const bad: Record<string, TaskPolicy> = {
      ...POLICY,
      findEntities: { ...POLICY.findEntities, route: 'PREFER_ON_DEVICE' },
    }
    expect(policyViolations(bad)).toEqual(['findEntities'])
  })
})

describe('redaction pipeline', () => {
  it('merges rules and an injected on-device detector', async () => {
    const v = new Vault()
    const report = await buildRedaction('Please contact Priya Natarajan at priya@example.com.', v, {
      detect: async () => [{ start: 0, end: 0, kind: 'PERSON', text: 'Priya Natarajan', source: 'on-device' }],
    })
    expect(report).toMatchObject({ rulesFound: 1, modelAdded: 1, modelCovered: true })
    expect(v.apply('Please contact Priya Natarajan at priya@example.com.')).toBe(
      'Please contact [PERSON_1] at [EMAIL_1].',
    )
  })

  it('degrades to rules-only and reports it when the model is unavailable', async () => {
    const v = new Vault()
    const report = await buildRedaction('Email: a@b.co', v, {
      detect: async () => {
        throw new Error('Local LanguageModel API not available in this environment.')
      },
    })
    expect(report.modelCovered).toBe(false)
    expect(report.modelError).toMatch(/not available/)
    expect(report.rulesFound).toBe(1)
  })
})

describe('chunking', () => {
  it('keeps short text whole and splits long text under the limit', () => {
    expect(chunkText('hello')).toEqual(['hello'])
    const long = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} is here.`).join(' ')
    const chunks = chunkText(long, 500)
    expect(chunks.length).toBeGreaterThan(5)
    expect(chunks.every((c) => c.length <= 500)).toBe(true)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('Sentence number 199 is here.')
  })
})

describe('ledger', () => {
  it('summarises where work ran and how much text left the device', () => {
    const l = new Ledger()
    l.add({ task: 'findEntities', route: 'ON_DEVICE_ONLY', executedOn: 'ON_DEVICE', charsSent: 0, redactions: 0, durationMs: 40 })
    l.add({ task: 'explain', route: 'PREFER_CLOUD', executedOn: 'IN_CLOUD', charsSent: 900, redactions: 7, durationMs: 800 })
    l.add({ task: 'explain', route: 'PREFER_CLOUD', executedOn: 'BLOCKED', charsSent: 0, redactions: 0, durationMs: 0 })
    expect(summarize(l.getSnapshot())).toEqual({ calls: 3, onDevice: 1, inCloud: 1, blocked: 1, failed: 0, charsSent: 900 })
  })
})

describe('sample documents', () => {
  for (const sample of SAMPLES) {
    it(`"${sample.title}" is fully clean for the cloud after the rules pass`, () => {
      const v = new Vault()
      v.addSpans(detectWithRules(sample.text))
      const redacted = v.apply(sample.text)
      expect(inspectEgress(redacted, v)).toEqual([])
      expect(redacted).not.toMatch(/@example\.com|555[ -]?01\d\d|\b912-3\d-\d{4}\b|4111 1111/)
      expect(v.rehydrate(redacted)).toBe(sample.text)
    })
  }

  it('treats a company after "Landlord:" as an organisation, and keeps the full street address', () => {
    const lease = SAMPLES.find((s) => s.id === 'lease')!.text
    const spans = detectWithRules(lease)
    expect(spans.map((s) => s.text)).not.toContain('Gable')
    expect(spans.find((s) => s.kind === 'ADDRESS')?.text).toBe('77 Harbor View Road, Unit 12, Oakland, CA 94607')
  })
})

describe('fillSegments', () => {
  it('marks exactly the parts that were filled in from the vault, and leaves unknown placeholders alone', () => {
    const v = new Vault()
    v.add('PERSON', 'Jordan Rivera', 'rules')
    v.add('IDNUM', 'CLM-88231-77', 'rules')
    const segs = v.fillSegments('Dear Sir, I am [PERSON_1] (claim [IDNUM_1], also [PERSON_9]).')
    expect(segs.map((s) => s.text).join('')).toBe('Dear Sir, I am Jordan Rivera (claim CLM-88231-77, also [PERSON_9]).')
    expect(segs.filter((s) => s.filled).map((s) => s.text)).toEqual(['Jordan Rivera', 'CLM-88231-77'])
  })
  it('matches rehydrate for the same input', () => {
    const v = new Vault()
    v.addSpans(detectWithRules(BILL))
    const redacted = v.apply(BILL)
    expect(v.fillSegments(redacted).map((s) => s.text).join('')).toBe(v.rehydrate(redacted))
  })
})

describe('ics', () => {
  it('validates ISO dates strictly', () => {
    expect(isValidIsoDate('2026-12-15')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('15 Dec 2026')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate(undefined)).toBe(false)
  })
  it('writes all-day events with reminders, CRLF line endings and escaped text', () => {
    const ics = buildIcs(
      [{ uid: 'a@veil', date: '2026-12-31', summary: 'Pay balance; claim CLM-1, urgent', description: 'Line one\nLine two' }],
      new Date('2026-11-20T10:00:00Z'),
    )
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
    expect(ics).toContain('SUMMARY:Pay balance\\; claim CLM-1\\, urgent')
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two')
    expect(ics).toContain('TRIGGER:-P7D')
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('DTSTAMP:20261120T100000Z')
  })
  it('folds long lines at 73 characters', () => {
    const ics = buildIcs([{ uid: 'b@veil', date: '2026-12-15', summary: 'x'.repeat(200) }])
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(73)
  })
})

describe('vault — titles', () => {
  it('treats "Dr. Chen" and "Chen" as one person and keeps the title visible', async () => {
    const { Vault } = await import('./vault')
    const v = new Vault()
    const a = v.add('PERSON', 'Chen', 'rules')
    const b = v.add('PERSON', 'Dr. Chen', 'on-device')
    expect(b?.token).toBe(a?.token)
    expect(v.size).toBe(1)
    expect(v.apply('Anesthesia: Dr. Chen')).toBe(`Anesthesia: Dr. ${a?.token}`)
  })
})
