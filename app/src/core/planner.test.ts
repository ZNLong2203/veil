import { describe, expect, it } from 'vitest'
import { canReachCloud } from './policy'
import { estimateTokens, guessLanguage, planRoutes, type Signals } from './planner'
import { SAMPLES } from '../samples'

const base: Signals = {
  docChars: 1200,
  language: { code: 'en', label: 'English' },
  targetLanguage: 'English',
  online: true,
  saveData: false,
  nano: 'available',
  cloudEnabled: true,
  firebaseConfigured: true,
}
const step = (sig: Signals, task: string) => planRoutes(sig).steps.find((s) => s.task === task)!

describe('guessLanguage', () => {
  it('recognises the sample documents as English', () => {
    for (const s of SAMPLES) expect(guessLanguage(s.text).code).toBe('en')
  })
  it('recognises Spanish, Vietnamese, Japanese and Cyrillic text', () => {
    expect(guessLanguage('Estimada señora Villalobos: le escribimos desde la clínica respecto a la factura de su hijo y los pagos pendientes.').code).toBe('es')
    expect(guessLanguage('Kính gửi ông Nguyễn Văn An, Bệnh viện Chợ Rẫy xin thông báo hóa đơn của bà Trần Thị Mai tại số 12 đường Lê Lợi.').code).toBe('vi')
    expect(guessLanguage('山田太郎様、請求書のお知らせです。支払い期限は来月の十五日までです。ご確認ください。').code).toBe('ja')
    expect(guessLanguage('Уважаемый господин Иванов, сообщаем вам о задолженности по счёту за услуги.').code).toBe('ru')
  })
  it('returns other for very short or ambiguous text', () => {
    expect(guessLanguage('ok').code).toBe('other')
    expect(guessLanguage('xqz wvu rtp lkj hgf dsa').code).toBe('other')
  })
})

describe('planRoutes: personal-data step', () => {
  it('runs on Gemini Nano only, for a supported language', () => {
    const s = step(base, 'findEntities')
    expect(s.runsOn).toBe('device')
    expect(planRoutes(base).entitiesNeedReview).toBe(false)
  })
  it('runs best-effort and demands review for a language Nano does not officially support', () => {
    const p = planRoutes({ ...base, language: { code: 'vi', label: 'Vietnamese' } })
    expect(p.useModelForEntities).toBe(true)
    expect(p.entitiesNeedReview).toBe(true)
    expect(p.steps[0].reason).toMatch(/best-effort/)
  })
  it('is skipped, with review required, when Nano is not ready, and never substituted by the cloud', () => {
    for (const nano of ['downloadable', 'unavailable', 'unsupported'] as const) {
      const p = planRoutes({ ...base, nano })
      expect(p.useModelForEntities).toBe(false)
      expect(p.entitiesNeedReview).toBe(true)
      expect(p.steps[0].route).toBe('ON_DEVICE_ONLY')
      expect(p.steps[0].runsOn).toBe('skipped')
    }
  })
})

describe('planRoutes: custom routing signals', () => {
  it('prefers on-device for triage, and the cloud for the explanation, in the normal case', () => {
    const p = planRoutes(base)
    expect(p.triageRoute).toBe('PREFER_ON_DEVICE')
    expect(p.generateRoute).toBe('PREFER_CLOUD')
    expect(p.generateCompact).toBe(false)
  })
  it('sends triage to the cloud (redacted) when the battery is low and not charging', () => {
    const p = planRoutes({ ...base, batteryLevel: 0.12, charging: false })
    expect(p.triageRoute).toBe('PREFER_CLOUD')
    expect(step({ ...base, batteryLevel: 0.12, charging: false }, 'triage').reason).toMatch(/12%/)
  })
  it('ignores a low battery while charging', () => {
    expect(planRoutes({ ...base, batteryLevel: 0.1, charging: true }).triageRoute).toBe('PREFER_ON_DEVICE')
  })
  it('goes fully on-device with the compact variant when offline', () => {
    const p = planRoutes({ ...base, online: false })
    expect(p.generateRoute).toBe('ON_DEVICE_ONLY')
    expect(p.generateCompact).toBe(true)
    expect(p.triageRoute).toBe('ON_DEVICE_ONLY')
    expect(canReachCloud(p.generateRoute)).toBe(false)
  })
  it('goes fully on-device when the Remote Config kill switch is off', () => {
    const p = planRoutes({ ...base, cloudEnabled: false })
    expect(p.generateRoute).toBe('ON_DEVICE_ONLY')
    expect(p.steps.at(-1)!.reason).toMatch(/kill switch/)
  })
  it('uses Nano for a short English document when data saver is on', () => {
    const p = planRoutes({ ...base, saveData: true, docChars: 800 })
    expect(p.generateRoute).toBe('PREFER_ON_DEVICE')
    expect(p.generateCompact).toBe(true)
  })
  it('still uses the cloud on data saver when the output is another language or the document is long', () => {
    expect(planRoutes({ ...base, saveData: true, targetLanguage: 'Tiếng Việt' }).generateRoute).toBe('PREFER_CLOUD')
    expect(planRoutes({ ...base, saveData: true, docChars: 40000 }).generateRoute).toBe('PREFER_CLOUD')
  })
  it('mentions the target language when translating', () => {
    expect(step({ ...base, targetLanguage: 'Español' }, 'explain').reason).toMatch(/Español/)
  })
})

describe('invariant', () => {
  it('never plans a cloud-capable route for the raw-data step, whatever the signals', () => {
    const variants: Array<Partial<Signals>> = [{}, { online: false }, { nano: 'unavailable' }, { cloudEnabled: false }, { saveData: true }, { batteryLevel: 0.05, charging: false }]
    for (const v of variants) {
      expect(canReachCloud(step({ ...base, ...v }, 'findEntities').route)).toBe(false)
    }
  })
  it('estimates tokens', () => expect(estimateTokens(4000)).toBe(1000))
})
