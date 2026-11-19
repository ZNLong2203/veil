/*
 * Always read variables as `import.meta.env.VITE_X` (static access). Vite then inlines only the ones referenced
 * here. Reading the whole `import.meta.env` object would ship EVERY VITE_ variable in .env.local to the public bundle.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

export const appCheckSiteKey = (import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY as string | undefined) || undefined
/** Which App Check provider the site key belongs to: reCAPTCHA v3 (default) or reCAPTCHA Enterprise. */
export const appCheckProvider: 'v3' | 'enterprise' = import.meta.env.VITE_APPCHECK_PROVIDER === 'enterprise' ? 'enterprise' : 'v3'
export const appCheckDebugToken = (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) || undefined

export const CLOUD_MODEL = (import.meta.env.VITE_CLOUD_MODEL as string | undefined) || 'gemini-3.5-flash-lite'
export const CLOUD_MODEL_LITE = (import.meta.env.VITE_CLOUD_MODEL_LITE as string | undefined) || 'gemini-3.1-flash-lite'
