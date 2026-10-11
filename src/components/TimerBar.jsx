/**
 * TimerBar — the countdown dial, drawn as a progress ring.
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN COMPONENT
 * It owns one piece of state (`secondsLeft`). Because QuizScreen gives it a
 * `key` that changes with the question index, React builds a brand new instance
 * for every question — which restarts the clock without any reset logic. That is
 * the idiomatic way to "reset state when something changes" in React.
 *
 * HOW THE RING IS DRAWN
 * An SVG <circle> has no "72% filled" attribute, so we fake it with a dash:
 *   • circumference = 2 × π × radius  — the total length of the outline
 *   • strokeDasharray  = how much is visible, then the gap
 *   • strokeDashoffset = shifts the dash to hide part of it
 *   • rotate(-90°)      = start at 12 o'clock instead of 3 o'clock
 */

import { QUESTION_TIME_SECONDS } from '../hooks/useTriviaGame.js'
import { useCountdown } from '../hooks/useCountdown.js'

export function TimerBar({ running, onExpire, onTick }) {
  const secondsLeft = useCountdown(QUESTION_TIME_SECONDS, running, onExpire, onTick)

  const radius = 22
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, secondsLeft / QUESTION_TIME_SECONDS)
  const offset = circumference * (1 - ratio)
  const urgent = secondsLeft <= 5

  return (
    <div
      className={`timer ${urgent && running ? 'timer--urgent' : ''} ${running ? '' : 'timer--paused'}`}
      // role="timer" makes the value announce itself instead of being ignored.
      role="timer"
      aria-label={`${secondsLeft} seconds left`}
    >
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="timer__track" cx="26" cy="26" r={radius} />
        <circle
          className="timer__value"
          cx="26"
          cy="26"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <span className="timer__number">{secondsLeft}</span>
    </div>
  )
}
