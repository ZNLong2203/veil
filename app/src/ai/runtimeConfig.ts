import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config'
import { CLOUD_MODEL, CLOUD_MODEL_LITE, isFirebaseConfigured } from './env'
import { getFirebaseApp } from './firebase'

/**
 * Settings that can change without a new deploy, served by Firebase Remote Config.
 * Every parameter is optional: if Remote Config is not set up, or the fetch fails, the
 * built-in defaults (from env) apply and the app behaves exactly as before.
 */
export interface RuntimeConfig {
  /** Cloud model for the explanation and follow-ups. */
  cloudModel: string
  /** Cloud fallback for light, on-device-first tasks. */
  cloudModelLite: string
  /** Kill switch. When false, every step runs on-device only and nothing reaches the cloud. */
  cloudEnabled: boolean
  /** Characters of redacted text passed to Gemini Nano for the offline summary. */
  compactMaxChars: number
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  cloudModel: CLOUD_MODEL,
  cloudModelLite: CLOUD_MODEL_LITE,
  cloudEnabled: true,
  compactMaxChars: 9000,
}

/** Remote Config parameter keys. */
export const RC_KEYS = {
  cloudModel: 'cloud_model',
  cloudModelLite: 'cloud_model_lite',
  cloudEnabled: 'cloud_enabled',
  compactMaxChars: 'compact_max_chars',
} as const

/** The slice of Remote Config's `Value` we read. */
export interface RcValue {
  asString(): string
  asBoolean(): boolean
  asNumber(): number
  getSource(): 'static' | 'default' | 'remote'
}

const MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,63}$/i
const MIN_CHARS = 1000
const MAX_CHARS = 12000

/**
 * Pure and defensive: a malformed remote value never breaks the app, it is ignored in favour
 * of the base value. Only values that actually came from the server (`remote`) are applied.
 */
export function parseRuntimeConfig(get: (key: string) => RcValue, base: RuntimeConfig = DEFAULT_RUNTIME_CONFIG): RuntimeConfig {
  const remote = (key: string): RcValue | null => {
    const v = get(key)
    return v.getSource() === 'remote' ? v : null
  }
  const model = (key: string, fallback: string) => {
    const v = remote(key)?.asString().trim()
    return v && MODEL_NAME.test(v) ? v : fallback
  }
  const enabled = remote(RC_KEYS.cloudEnabled)
  const chars = remote(RC_KEYS.compactMaxChars)?.asNumber()
  return {
    cloudModel: model(RC_KEYS.cloudModel, base.cloudModel),
    cloudModelLite: model(RC_KEYS.cloudModelLite, base.cloudModelLite),
    cloudEnabled: enabled ? enabled.asBoolean() : base.cloudEnabled,
    compactMaxChars:
      chars && Number.isFinite(chars) ? Math.min(MAX_CHARS, Math.max(MIN_CHARS, Math.round(chars))) : base.compactMaxChars,
  }
}

let current: RuntimeConfig = DEFAULT_RUNTIME_CONFIG

/** Read at call time, so a config activated after startup applies to the next request. */
export const getRuntimeConfig = (): RuntimeConfig => current

/** Fetches and activates Remote Config. Never throws; resolves to the config now in effect. */
export async function initRuntimeConfig(): Promise<RuntimeConfig> {
  if (!isFirebaseConfigured) return current
  try {
    const rc = getRemoteConfig(getFirebaseApp())
    rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 60 * 60 * 1000
    rc.settings.fetchTimeoutMillis = 8000
    rc.defaultConfig = {
      [RC_KEYS.cloudModel]: DEFAULT_RUNTIME_CONFIG.cloudModel,
      [RC_KEYS.cloudModelLite]: DEFAULT_RUNTIME_CONFIG.cloudModelLite,
      [RC_KEYS.cloudEnabled]: DEFAULT_RUNTIME_CONFIG.cloudEnabled,
      [RC_KEYS.compactMaxChars]: DEFAULT_RUNTIME_CONFIG.compactMaxChars,
    }
    await fetchAndActivate(rc)
    current = parseRuntimeConfig((k) => getValue(rc, k))
  } catch (err) {
    console.info('[veil] Remote Config unavailable, using defaults.', err instanceof Error ? err.message : err)
  }
  return current
}
