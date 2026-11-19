const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

export const appCheckSiteKey = (env.VITE_APPCHECK_RECAPTCHA_SITE_KEY as string | undefined) || undefined
/** Which App Check provider the site key belongs to: reCAPTCHA v3 (default) or reCAPTCHA Enterprise. */
export const appCheckProvider: 'v3' | 'enterprise' = env.VITE_APPCHECK_PROVIDER === 'enterprise' ? 'enterprise' : 'v3'
export const appCheckDebugToken = (env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) || undefined

export const CLOUD_MODEL = (env.VITE_CLOUD_MODEL as string | undefined) || 'gemini-3.5-flash'
export const CLOUD_MODEL_LITE = (env.VITE_CLOUD_MODEL_LITE as string | undefined) || 'gemini-3.5-flash-lite'
