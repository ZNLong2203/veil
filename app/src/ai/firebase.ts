import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai'
import { appCheckDebugToken, appCheckProvider, appCheckSiteKey, firebaseConfig, isFirebaseConfigured } from './env'

export class NotConfiguredError extends Error {
  constructor() {
    super('Firebase is not configured. Copy app/.env.example to app/.env.local and fill in your project values.')
    this.name = 'NotConfiguredError'
  }
}

let cachedApp: FirebaseApp | null = null
let cachedAi: AI | null = null

/** The single Firebase app (with App Check) shared by AI Logic and Remote Config. */
export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp
  if (!isFirebaseConfigured) throw new NotConfiguredError()

  const isLocalHost = import.meta.env.DEV || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  if (appCheckDebugToken && isLocalHost) {
    // Must be set before initializeAppCheck(). `true` makes the SDK print a fresh token to the console.
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebugToken === 'true' ? true : appCheckDebugToken
  }

  const app = initializeApp(firebaseConfig)

  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: appCheckProvider === 'enterprise' ? new ReCaptchaEnterpriseProvider(appCheckSiteKey) : new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } else {
    console.warn('[veil] VITE_APPCHECK_RECAPTCHA_SITE_KEY is not set; Firebase AI Logic will reject cloud calls.')
  }

  cachedApp = app
  return app
}

/**
 * The single entry point to Firebase AI Logic. Every model call in Veil, on-device or cloud,
 * goes through the `AI` instance created here. App Check is initialised first because
 * Firebase AI Logic enforces it.
 */
export function getAi(): AI {
  if (cachedAi) return cachedAi
  cachedAi = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() })
  return cachedAi
}
