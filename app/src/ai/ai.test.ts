import type { GenerativeModel } from 'firebase/ai'
import { beforeEach, describe, expect, it } from 'vitest'
import { EgressBlockedError } from '../core/egress'
import { ledger, summarize } from '../core/ledger'
import { Vault } from '../core/vault'
import { runTask } from './run'
import { entitiesToSpans, normalizeExplanation, redactQuestion } from './tasks'

/** A stand-in for a Firebase AI Logic hybrid model. Only the parts `runTask` touches. */
function fakeModel(source: 'on_device' | 'in_cloud' | undefined, text = '{}', onCall?: () => void) {
  return {
    generateContent: async () => {
      onCall?.()
      return { response: { inferenceSource: source, text: () => text } }
    },
  } as unknown as GenerativeModel
}

beforeEach(() => ledger.clear())

describe('runTask — privacy contract', () => {
  it('blocks a cloud-capable task whose payload still holds personal data, and never calls the model', async () => {
    const vault = new Vault()
    vault.add('PERSON', 'Jordan Rivera', 'on-device')
    let called = false
    const model = fakeModel('in_cloud', '{}', () => (called = true))

    await expect(
      runTask({ task: 'explain', model, parts: ['x'], outbound: 'Why does Jordan Rivera owe this?', vault }),
    ).rejects.toBeInstanceOf(EgressBlockedError)

    expect(called).toBe(false)
    expect(summarize(ledger.getSnapshot())).toMatchObject({ blocked: 1, inCloud: 0, charsSent: 0 })
  })

  it('records the source the SDK reports, and counts characters only for cloud calls', async () => {
    const vault = new Vault()
    await runTask({ task: 'explain', model: fakeModel('in_cloud'), parts: ['x'], outbound: 'Pay [PERSON_1] 100', vault })
    await runTask({ task: 'triage', model: fakeModel('on_device'), parts: ['x'], outbound: 'short', vault })
    expect(summarize(ledger.getSnapshot())).toMatchObject({ inCloud: 1, onDevice: 1, charsSent: 'Pay [PERSON_1] 100'.length })
  })

  it('records an offline fallback as ON_DEVICE even though the route preferred the cloud', async () => {
    const result = await runTask({ task: 'explain', model: fakeModel('on_device'), parts: ['x'], outbound: 'ok', vault: new Vault() })
    expect(result.executedOn).toBe('ON_DEVICE')
    expect(ledger.getSnapshot()[0]).toMatchObject({ route: 'PREFER_CLOUD', executedOn: 'ON_DEVICE', charsSent: 0 })
  })

  it('discards the result of a raw-data task that somehow ran in the cloud', async () => {
    await expect(
      runTask({ task: 'findEntities', model: fakeModel('in_cloud'), parts: ['raw'], outbound: '', vault: new Vault() }),
    ).rejects.toThrow(/Privacy contract violated/)
  })

  it('does not run the egress guard for on-device-only tasks (raw text is allowed to stay local)', async () => {
    const vault = new Vault()
    vault.add('PERSON', 'Jordan Rivera', 'rules')
    const r = await runTask({ task: 'findEntities', model: fakeModel('on_device'), parts: ['x'], outbound: 'Jordan Rivera', vault })
    expect(r.executedOn).toBe('ON_DEVICE')
  })

  it('logs failures without leaking the payload', async () => {
    const model = { generateContent: async () => { throw new Error('boom') } } as unknown as GenerativeModel
    await expect(runTask({ task: 'triage', model, parts: ['x'], outbound: 'ok', vault: new Vault() })).rejects.toThrow('boom')
    expect(summarize(ledger.getSnapshot())).toMatchObject({ failed: 1, charsSent: 0 })
  })
})

describe('model output handling', () => {
  it('keeps only entities that literally occur in the chunk', () => {
    const chunk = 'Please call Priya Natarajan about the lease.'
    const spans = entitiesToSpans(
      { entities: [{ text: 'Priya  Natarajan', kind: 'PERSON' }, { text: 'Elon Musk', kind: 'PERSON' }, { text: 'x', kind: 'PERSON' }] },
      chunk,
    )
    expect(spans.map((s) => s.text)).toEqual(['Priya  Natarajan'])
    expect(spans[0]).toMatchObject({ kind: 'PERSON', source: 'on-device' })
  })

  it('maps unknown kinds to OTHER', () => {
    const [s] = entitiesToSpans({ entities: [{ text: 'Blue Fox', kind: 'NICKNAME' }] }, 'They call him Blue Fox.')
    expect(s.kind).toBe('OTHER')
  })

  it('fills missing explanation fields instead of crashing the UI', () => {
    expect(normalizeExplanation({ plainSummary: 'hi' })).toMatchObject({ plainSummary: 'hi', deadlines: [], redFlags: [] })
  })

  it('redacts personal data typed into a follow-up question', () => {
    const vault = new Vault()
    vault.add('PERSON', 'Jordan Rivera', 'on-device')
    expect(redactQuestion('Can Jordan Rivera appeal? Email me at jr@example.com', vault)).toBe(
      'Can [PERSON_1] appeal? Email me at [EMAIL_1]',
    )
  })
})
