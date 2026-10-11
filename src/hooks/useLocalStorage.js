/**
 * useLocalStorage — a `useState` that survives a page refresh.
 * ---------------------------------------------------------------------------
 * `localStorage` is a tiny key/value store built into the browser. Anything we
 * put there stays until the user clears their browser data.
 *
 * We use it for the player's lifetime stats (games played, best score …) so the
 * numbers on the home screen are still there tomorrow.
 *
 * TWO THINGS TO KNOW
 *  1. It only stores STRINGS. Objects must be converted with JSON.stringify /
 *     JSON.parse — that is why we parse on the way in.
 *  2. Reading it can throw (Safari private mode, disabled cookies, corrupted
 *     value), so every access is wrapped in try/catch. A storage problem must
 *     never break the quiz.
 */

import { useCallback, useEffect, useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      // `item` is null on the very first visit — then we use the default.
      return item === null ? initialValue : JSON.parse(item)
    } catch {
      return initialValue
    }
  })

  // Saving is a side effect on an EXTERNAL system, so it belongs in an effect
  // rather than inside the state updater. (State updaters must stay pure — React
  // calls them twice in StrictMode on purpose.)
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch {
      // Storage full or blocked — keep playing, just don't remember it.
    }
  }, [key, storedValue])

  // Supports both forms, just like useState:
  //   setValue(newValue)
  //   setValue((previous) => previous + 1)
  const setValue = useCallback((value) => {
    setStoredValue((current) => (value instanceof Function ? value(current) : value))
  }, [])

  return [storedValue, setValue]
}

/** The shape of the object we keep under one single key. */
export const EMPTY_STATS = {
  gamesPlayed: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  bestScore: 0,
  bestStreak: 0,
}
