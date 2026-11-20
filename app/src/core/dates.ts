/** Dates for people: models write ISO dates; Veil shows them the way the reader's language does. */

const LOCALE_FOR_LANGUAGE: Record<string, string> = {
  English: 'en-US',
  Español: 'es',
  'Tiếng Việt': 'vi',
  中文: 'zh',
  日本語: 'ja',
  한국어: 'ko',
  Français: 'fr',
  Deutsch: 'de',
  Português: 'pt',
  हिन्दी: 'hi',
  العربية: 'ar',
}

export function localeFor(language: string): string {
  return LOCALE_FOR_LANGUAGE[language] ?? 'en-US'
}

function format(d: Date, locale: string, month: 'long' | 'short'): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month, day: 'numeric' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** Today's date, written for a letter in `language`. */
export function todayIn(language: string, now = new Date()): string {
  return format(now, localeFor(language), 'long')
}

function fromIso(y: string, m: string, d: string): Date | null {
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) ? date : null
}

/** Rewrites every valid ISO date (2026-12-15) inside running text as a readable one ("Dec 15, 2026"). */
export function prettyDates(text: string, language = 'English'): string {
  const locale = localeFor(language)
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y: string, m: string, d: string) => {
    const date = fromIso(y, m, d)
    return date ? format(date, locale, 'short') : all
  })
}
