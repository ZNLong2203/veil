import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './icons'

type Theme = 'light' | 'dark'
const KEY = 'veil-theme'

/** Light by default, whatever the operating system prefers; dark only when the user picks it. */
function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else document.documentElement.removeAttribute('data-theme')
}

/** Only the colour-scheme preference is stored (never document content). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const dark = theme === 'dark'
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
    <button className="navbtn navbtn--icon" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}
