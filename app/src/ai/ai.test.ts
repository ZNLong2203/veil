import type { GenerativeModel } from 'firebase/ai'
import { beforeEach, describe, expect, it } from 'vitest'
import { EgressBlockedError } from '../core/egress'
import { ledger, summarize } from '../core/ledger'
import { Vault } from '../core/vault'
import { runTask } from './run'
import { friendlyError } from '../state/useSession'
import { entitiesToSpans, normalizeExplanation, onGenerationProgress, redactQuestion, withCloudFallback, type Attempt } from './tasks'

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

  it('ignores a planned route for raw-data tasks, so the planner can never send them to the cloud', async () => {
    await runTask({ task: 'findEntities', model: fakeModel('on_device'), parts: ['x'], outbound: '', vault: new Vault(), route: 'PREFER_CLOUD' })
    expect(ledger.getSnapshot()[0].route).toBe('ON_DEVICE_ONLY')
  })

  it('records the planned route for redacted-text tasks', async () => {
    await runTask({ task: 'explain', model: fakeModel('on_device'), parts: ['x'], outbound: 'ok', vault: new Vault(), route: 'ON_DEVICE_ONLY' })
    expect(ledger.getSnapshot()[0]).toMatchObject({ route: 'ON_DEVICE_ONLY', executedOn: 'ON_DEVICE' })
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
  it('keeps only names and addresses that literally occur in the chunk', () => {
    const chunk = 'Please call Priya Natarajan about the lease at 77 Harbor View Road. Sincerely, Marcus Finch'
    const spans = entitiesToSpans(
      { people: ['Priya  Natarajan', 'Marcus Finch', 'Elon Musk', 'x'], addresses: ['77 Harbor View Road', '1 Nowhere Lane'] },
      chunk,
    )
    expect(spans.map((s) => [s.kind, s.text])).toEqual([
      ['PERSON', 'Priya  Natarajan'],
      ['PERSON', 'Marcus Finch'],
      ['ADDRESS', '77 Harbor View Road'],
    ])
    expect(spans.every((s) => s.source === 'on-device')).toBe(true)
  })

  it('tolerates malformed model output instead of throwing', () => {
    expect(entitiesToSpans({ people: 'Priya', addresses: [42, null] }, 'Priya')).toEqual([])
    expect(entitiesToSpans({}, 'anything')).toEqual([])
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

describe('withCloudFallback', () => {
  const models = { main: 'big', lite: 'small' }
  const prefer = { route: 'PREFER_CLOUD' as const, compact: false }

  /** An attempt runner that records what it was asked to do and fails the first `failures` times. */
  function runner(failures: number) {
    const seen: Attempt[] = []
    return {
      seen,
      attempt: async (a: Attempt) => {
        seen.push(a)
        if (seen.length <= failures) throw new Error(`cloud failure ${seen.length}`)
        return `ok from ${a.route}/${a.cloudModel}`
      },
    }
  }

  it('uses the main model first and stops at the first success', async () => {
    const r = runner(0)
    const out = await withCloudFallback(prefer, models, r.attempt)
    expect(out).toEqual({ value: 'ok from CLOUD_ONLY/big', compact: false })
    expect(r.seen).toHaveLength(1)
    expect(r.seen[0].timeoutMs).toBeGreaterThan(0)
  })

  it('falls back to the lighter cloud model, then to the compact on-device variant', async () => {
    const lite = runner(1)
    expect((await withCloudFallback(prefer, models, lite.attempt)).value).toBe('ok from CLOUD_ONLY/small')

    const device = runner(2)
    const out = await withCloudFallback(prefer, models, device.attempt)
    expect(out).toEqual({ value: 'ok from ON_DEVICE_ONLY/big', compact: true })
    expect(device.seen.map((a) => a.route)).toEqual(['CLOUD_ONLY', 'CLOUD_ONLY', 'ON_DEVICE_ONLY'])
  })

  it('skips the lighter attempt when it is the same model', async () => {
    const r = runner(1)
    await withCloudFallback(prefer, { main: 'same', lite: 'same' }, r.attempt)
    expect(r.seen.map((a) => a.route)).toEqual(['CLOUD_ONLY', 'ON_DEVICE_ONLY'])
  })

  it('reports the first (cloud) error when everything fails, not the last device error', async () => {
    const r = runner(99)
    await expect(withCloudFallback(prefer, models, r.attempt)).rejects.toThrow('cloud failure 1')
  })

  it('tells the UI why it is taking longer when it retries or falls back', async () => {
    const messages: string[] = []
    onGenerationProgress((m) => messages.push(m))
    await withCloudFallback(prefer, models, runner(2).attempt)
    onGenerationProgress(null)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatch(/slow/i)
    expect(messages[1]).toMatch(/Gemini Nano/)
  })

  it('never retries a blocked egress', async () => {
    const seen: Attempt[] = []
    const blocked = async (a: Attempt) => {
      seen.push(a)
      throw new EgressBlockedError([{ kind: 'EMAIL', via: 'rules', count: 1 }])
    }
    await expect(withCloudFallback(prefer, models, blocked)).rejects.toBeInstanceOf(EgressBlockedError)
    expect(seen).toHaveLength(1)
  })

  it('runs a single attempt, unchanged, for routes that are not cloud-preferred', async () => {
    const r = runner(0)
    const out = await withCloudFallback({ route: 'ON_DEVICE_ONLY', compact: true }, models, r.attempt)
    expect(out.compact).toBe(true)
    expect(r.seen).toEqual([{ route: 'ON_DEVICE_ONLY', cloudModel: 'big', compact: true }])
  })
})

describe('friendlyError', () => {
  const msg = (m: string) => friendlyError(new Error(m))
  it('explains a rate limit without exposing the raw SDK message', () => {
    expect(msg('AI: Error fetching from https://x/y:generateContent: [429 ] Resource exhausted')).toMatch(/free usage limit/)
    expect(msg('AI: Error fetching from https://x/y: [429 ] Resource exhausted')).not.toMatch(/https:/)
  })
  it('explains a busy model and a timeout', () => {
    expect(msg('[500 ] This model is currently experiencing high demand.')).toMatch(/busy/)
    expect(msg('Timeout has expired.')).toMatch(/busy/)
  })
  it('explains a network failure', () => {
    expect(msg('TypeError: Failed to fetch')).toMatch(/could not reach the cloud/)
  })
  it('keeps the on-device and App Check explanations', () => {
    expect(msg('Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.')).toMatch(/Gemini Nano/)
    expect(msg('Firebase App Check token is invalid')).toMatch(/App Check/)
  })
})

describe('todayIn', () => {
  it('formats the date locally in the letter language', async () => {
    const { todayIn } = await import('./tasks')
    const d = new Date(2026, 10, 20)
    expect(todayIn('English', d)).toBe('November 20, 2026')
    expect(todayIn('Unknown', d)).toBe('November 20, 2026')
  })
})
