import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './icons'

type Theme = 'auto' | 'light' | 'dark'
const KEY = 'veil-theme'

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function apply(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
}

const isDark = (theme: Theme) =>
  theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

/** Only the colour-scheme preference is stored (never document content). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const dark = isDark(theme)
  const toggle = () => {
    const next: Theme = dark ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage may be blocked; the choice still applies for this visit */
    }
  }

  return (
    <button className="icon-btn" style={{ width: 36, height: 36, border: '1px solid var(--line)' }} onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}
