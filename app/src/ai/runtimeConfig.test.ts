import { describe, expect, it } from 'vitest'
import { canReachCloud, effectiveRoute, type Route } from '../core/policy'
import { DEFAULT_RUNTIME_CONFIG, parseRuntimeConfig, RC_KEYS, type RcValue } from './runtimeConfig'

type Source = 'static' | 'default' | 'remote'

/** Build a fake Remote Config store: key → [raw value, source]. */
function store(entries: Record<string, [string, Source]>) {
  return (key: string): RcValue => {
    const [raw, source] = entries[key] ?? ['', 'static']
    return {
      asString: () => raw,
      asBoolean: () => ['1', 'true', 't', 'yes', 'y', 'on'].includes(raw.toLowerCase()),
      asNumber: () => (raw === '' ? 0 : Number(raw)),
      getSource: () => source,
    }
  }
}

describe('parseRuntimeConfig', () => {
  it('applies values that came from the server', () => {
    const cfg = parseRuntimeConfig(
      store({
        [RC_KEYS.cloudModel]: ['gemini-3.5-pro', 'remote'],
        [RC_KEYS.cloudModelLite]: ['gemini-3.5-flash-lite', 'remote'],
        [RC_KEYS.cloudEnabled]: ['false', 'remote'],
        [RC_KEYS.compactMaxChars]: ['6000', 'remote'],
      }),
    )
    expect(cfg).toEqual({ cloudModel: 'gemini-3.5-pro', cloudModelLite: 'gemini-3.5-flash-lite', cloudEnabled: false, compactMaxChars: 6000 })
  })

  it('ignores in-app defaults and static values, keeping the base config', () => {
    const cfg = parseRuntimeConfig(
      store({
        [RC_KEYS.cloudModel]: ['something-else', 'default'],
        [RC_KEYS.cloudEnabled]: ['false', 'default'],
      }),
    )
    expect(cfg).toEqual(DEFAULT_RUNTIME_CONFIG)
  })

  it('ignores malformed model names so a bad remote value cannot break requests', () => {
    const cfg = parseRuntimeConfig(
      store({
        [RC_KEYS.cloudModel]: ['models/../../etc passwd', 'remote'],
        [RC_KEYS.cloudModelLite]: ['', 'remote'],
      }),
    )
    expect(cfg.cloudModel).toBe(DEFAULT_RUNTIME_CONFIG.cloudModel)
    expect(cfg.cloudModelLite).toBe(DEFAULT_RUNTIME_CONFIG.cloudModelLite)
  })

  it('clamps the on-device text budget to something Gemini Nano can take', () => {
    const big = parseRuntimeConfig(store({ [RC_KEYS.compactMaxChars]: ['999999', 'remote'] }))
    const small = parseRuntimeConfig(store({ [RC_KEYS.compactMaxChars]: ['10', 'remote'] }))
    const junk = parseRuntimeConfig(store({ [RC_KEYS.compactMaxChars]: ['abc', 'remote'] }))
    expect(big.compactMaxChars).toBe(12000)
    expect(small.compactMaxChars).toBe(1000)
    expect(junk.compactMaxChars).toBe(DEFAULT_RUNTIME_CONFIG.compactMaxChars)
  })
})

describe('kill switch routing', () => {
  const routes: Route[] = ['ON_DEVICE_ONLY', 'PREFER_ON_DEVICE', 'PREFER_CLOUD', 'CLOUD_ONLY']

  it('leaves every route unchanged while the cloud is enabled', () => {
    for (const r of routes) expect(effectiveRoute(r, true)).toBe(r)
  })

  it('downgrades every cloud-capable route to on-device only when the cloud is disabled', () => {
    for (const r of routes) {
      expect(effectiveRoute(r, false)).toBe('ON_DEVICE_ONLY')
      expect(canReachCloud(effectiveRoute(r, false))).toBe(false)
    }
  })
})
