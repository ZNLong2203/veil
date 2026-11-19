import { describe, expect, it } from 'vitest'
import { Ledger } from './ledger'
import { buildReceipt, receiptToMarkdown, sha256Hex } from './receipt'
import { Vault } from './vault'
import { classifyHost, extractTextParts, inspectWire, WireLog } from './wire'

const body = (texts: string[], system = 'You are Veil.') =>
  JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: texts.map((text) => ({ text })) }], generationConfig: { temperature: 0.2 } })

describe('extractTextParts', () => {
  it('collects the system instruction and every content text part', () => {
    expect(extractTextParts(body(['Doc: [PERSON_1]', 'Question']))).toEqual(['You are Veil.', 'Doc: [PERSON_1]', 'Question'])
  })
  it('ignores inline data and tolerates bad input', () => {
    const withImage = JSON.stringify({ contents: [{ parts: [{ inlineData: { data: 'AAAA' } }, { text: 'hi' }] }] })
    expect(extractTextParts(withImage)).toEqual(['hi'])
    expect(extractTextParts('not json')).toEqual([])
    expect(extractTextParts(undefined)).toEqual([])
  })
})

describe('classifyHost', () => {
  it('recognises AI Logic, Remote Config and App Check traffic', () => {
    expect(classifyHost('firebasevertexai.googleapis.com', '/v1beta/projects/p/models/m:generateContent')).toBe('ai')
    expect(classifyHost('firebasevertexai.googleapis.com', '/v1beta/projects/p/models/m:streamGenerateContent')).toBe('ai')
    expect(classifyHost('firebaseremoteconfig.googleapis.com', '/v1/projects/p/namespaces/firebase:fetch')).toBe('remote-config')
    expect(classifyHost('content-firebaseappcheck.googleapis.com', '/v1/projects/p/apps/a:exchangeDebugToken')).toBe('app-check')
    expect(classifyHost('fonts.example.com', '/x.woff2')).toBe('other')
  })
})

describe('inspectWire', () => {
  const vault = new Vault()
  vault.add('PERSON', 'Jordan Rivera', 'rules')

  it('passes a redacted request and counts the placeholders', () => {
    const v = inspectWire({ texts: extractTextParts(body(['Patient [PERSON_1], balance due $3,755. Call [PHONE_1].'])) }, vault)
    expect(v).toMatchObject({ clean: true, placeholders: 2, findings: [] })
  })
  it('flags a request that still carries a personal value, by kind only', () => {
    const v = inspectWire({ texts: extractTextParts(body(['Patient Jordan Rivera, jordan@example.com'])) }, vault)
    expect(v.clean).toBe(false)
    expect(JSON.stringify(v)).not.toMatch(/Jordan|jordan@/)
  })
})

describe('WireLog', () => {
  it('stores entries and notifies subscribers', () => {
    const log = new WireLog()
    let n = 0
    log.subscribe(() => n++)
    log.add({ method: 'POST', host: 'h', path: '/p', bytes: 10, status: 200, kind: 'ai', texts: ['x'] })
    expect(log.getSnapshot()).toHaveLength(1)
    expect(n).toBe(1)
  })
})

describe('privacy receipt', () => {
  const vault = new Vault()
  vault.add('PERSON', 'Jordan Rivera', 'rules')
  vault.add('EMAIL', 'jordan.rivera@example.com', 'rules')

  const ledger = new Ledger()
  ledger.add({ task: 'findEntities', route: 'ON_DEVICE_ONLY', executedOn: 'ON_DEVICE', charsSent: 0, redactions: 2, durationMs: 40 })
  ledger.add({ task: 'explain', route: 'PREFER_CLOUD', executedOn: 'IN_CLOUD', charsSent: 700, redactions: 2, durationMs: 900 })

  const wire = new WireLog()
  wire.add({ method: 'POST', host: 'firebasevertexai.googleapis.com', path: '/v1beta/projects/p/models/m:generateContent', bytes: 1400, status: 200, kind: 'ai', texts: ['Patient [PERSON_1], email [EMAIL_1].'] })
  wire.add({ method: 'POST', host: 'firebaseremoteconfig.googleapis.com', path: '/v1/projects/p/namespaces/firebase:fetch', bytes: 300, status: 200, kind: 'remote-config', texts: [] })

  it('summarises steps and requests and verifies the AI request is clean', async () => {
    const r = await buildReceipt({ ledger: ledger.getSnapshot(), wire: wire.getSnapshot(), vault, now: new Date('2026-11-20T10:00:00Z') })
    expect(r.summary).toMatchObject({ protectedValues: 2, steps: 2, ranOnDevice: 1, ranInCloud: 1, charsSentToCloud: 700, requestsLeavingTheBrowser: 2, aiRequests: 1, aiRequestsWithPersonalData: 0 })
    expect(r.requests[0].placeholders).toBe(2)
    expect(r.requests[0].textSha256).toBe(await sha256Hex('Patient [PERSON_1], email [EMAIL_1].'))
    expect(r.requests[1].textSha256).toBeUndefined()
  })

  it('never contains document text or personal values, even in Markdown', async () => {
    const r = await buildReceipt({ ledger: ledger.getSnapshot(), wire: wire.getSnapshot(), vault })
    const all = JSON.stringify(r) + receiptToMarkdown(r)
    expect(all).not.toMatch(/Jordan|Rivera|jordan\.rivera@example\.com/)
    expect(all).not.toContain('Patient [PERSON_1]')
  })

  it('records a leak by kind and count only, never the value, and still hides the text', async () => {
    const leaky = new WireLog()
    leaky.add({ method: 'POST', host: 'firebasevertexai.googleapis.com', path: '/v1beta/x:generateContent', bytes: 900, status: 200, kind: 'ai', texts: ['Patient Jordan Rivera'] })
    const r = await buildReceipt({ ledger: [], wire: leaky.getSnapshot(), vault })
    expect(r.summary.aiRequestsWithPersonalData).toBe(1)
    expect(r.requests[0].findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(r) + receiptToMarkdown(r)).not.toMatch(/Jordan|Rivera/)
    expect(receiptToMarkdown(r)).toMatch(/PERSONAL DATA FOUND/)
  })
})
