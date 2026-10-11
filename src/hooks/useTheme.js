/**
 * useTheme — light / dark mode.
 * ---------------------------------------------------------------------------
 * HOW CSS THEMING WORKS HERE
 * All the colours live as custom properties on `:root` (see index.css). The dark
 * palette is applied by putting `data-theme="dark"` on the <html> element. So
 * switching themes is literally one attribute change:
 *
 *   :root                 → light variables
 *   :root[data-theme=dark] → dark variables
 *
 * NOTHING else in the app needs to know which theme is active — components keep
 * using `var(--surface)`. That is the whole point of design tokens.
 *
 * Two extra touches:
 *  • The choice is saved in localStorage, so it survives a refresh.
 *  • We respect `prefers-color-scheme` the first time, so the app matches the
 *    operating system before the user has expressed a preference.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'otdb.theme'

/** Reads the saved theme, or asks the operating system. */
function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked — fall through to the OS preference */
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  // Applying the theme is a side effect on the real DOM, so it belongs in an
  // effect. `document.documentElement.dataset.theme = theme` is all it takes.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore: not being able to remember the theme is not fatal */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
