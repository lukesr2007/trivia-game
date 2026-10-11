/**
 * useCountdown — a countdown clock you can pause and reset.
 * ---------------------------------------------------------------------------
 * Two classic React mistakes are avoided here, and both are worth understanding:
 *
 * 1. THE FROZEN COUNTER
 *      const [left, setLeft] = useState(20)
 *      setInterval(() => setLeft(left - 1), 1000)   // ← always subtracts from 20!
 *    `left` inside the closure is frozen at the value from the render where the
 *    interval was created. The fix is a REFRESH FUNCTION, which React re-creates
 *    on every render:
 *      setLeft((previous) => previous - 1)
 *
 * 2. STACKED INTERVALS
 *    `useEffect` runs again whenever its dependencies change, and every run adds
 *    another interval. Without the returned cleanup, ten renders = ten clocks.
 *    Returning `() => clearInterval(...)` tells React "before doing this again,
 *    undo the last time".
 *
 * HOW THE CLOCK IS RESET TO 20
 * Not with an effect — by giving the component that calls this hook a `key` that
 * changes with the question (see QuizScreen). React then throws the old instance
 * away and builds a fresh one with `useState(20)` again. Resetting state is what
 * `key` is for.
 */

import { useEffect, useState } from 'react'

/**
 * @param {number} seconds    the starting value
 * @param {boolean} isRunning false freezes the clock (e.g. once answered)
 * @param {Function} onExpire called when the clock reaches zero
 * @param {Function} onTick   called with 0–1 (how much time is left) on every change
 * @returns {number} secondsLeft
 */
export function useCountdown(seconds, isRunning, onExpire, onTick) {
  const [secondsLeft, setSecondsLeft] = useState(seconds)

  // The ticking clock. Stops (and is cleaned up) as soon as `isRunning` is false.
  useEffect(() => {
    if (!isRunning) return undefined

    const intervalId = setInterval(() => {
      // Refresh function: always works from the LATEST value, never a stale copy.
      setSecondsLeft((previous) => (previous > 1 ? previous - 1 : 0))
    }, 1000)

    return () => clearInterval(intervalId)
  }, [isRunning, seconds])

  // Announce the time-up moment. Keeping it in its own effect guarantees the
  // callback runs exactly once per transition to 0, outside the state updater
  // (updaters must stay pure, and StrictMode calls them twice on purpose).
  useEffect(() => {
    if (isRunning && secondsLeft === 0) onExpire()
  }, [secondsLeft, isRunning, onExpire])

  // Report the remaining fraction. The caller stores it in a ref so the answer
  // buttons can read it later without this hook re-rendering the whole screen.
  useEffect(() => {
    onTick(secondsLeft / seconds)
  }, [secondsLeft, seconds, onTick])

  return secondsLeft
}
