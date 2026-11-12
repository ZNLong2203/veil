import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai'
import { appCheckDebugToken, appCheckSiteKey, firebaseConfig, isFirebaseConfigured } from './env'

export class NotConfiguredError extends Error {
  constructor() {
    super('Firebase is not configured. Copy app/.env.example to app/.env.local and fill in your project values.')
    this.name = 'NotConfiguredError'
  }
}

let cached: AI | null = null

/**
 * The single entry point to Firebase AI Logic. Every model call in Veil, on-device or cloud,
 * goes through the `AI` instance created here. App Check is initialised first because
 * Firebase AI Logic enforces it.
 */
export function getAi(): AI {
  if (cached) return cached
  if (!isFirebaseConfigured) throw new NotConfiguredError()

  if (appCheckDebugToken) {
    // Must be set before initializeAppCheck(). `true` makes the SDK print a fresh token to the console.
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebugToken === 'true' ? true : appCheckDebugToken
  }

  const app = initializeApp(firebaseConfig)

  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } else {
    console.warn('[veil] VITE_APPCHECK_RECAPTCHA_SITE_KEY is not set; Firebase AI Logic will reject cloud calls.')
  }

  cached = getAI(app, { backend: new GoogleAIBackend() })
  return cached
}
