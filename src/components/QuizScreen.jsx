/**
 * QuizScreen — everything that happens while a game is in progress.
 * ---------------------------------------------------------------------------
 * Responsibilities kept here (and not in App):
 *   • host the countdown for the current question
 *   • map keyboard presses to answers / "next"
 *   • show the progress, score and streak
 *
 * REFS USED AS "SHARED MEMORY" (not as state)
 * We have three values that the keyboard listener needs but that change every
 * second: the remaining time, whether the question is answered, and the callbacks.
 * Storing them in state would re-render everything on every tick, so we keep
 * them in refs — refs are for values that do NOT need to trigger a render.
 *
 * A ref may be read/written from event handlers and effects, but never while
 * rendering. That is why the "latest values" box below is refreshed in an effect.
 */

import { useCallback, useEffect, useRef } from 'react'

import { QuestionCard } from './QuestionCard.jsx'
import { ProgressBar, Stat } from './Primitives.jsx'
import { TimerBar } from './TimerBar.jsx'
import { QUESTION_TIME_SECONDS } from '../hooks/useTriviaGame.js'

export function QuizScreen({
  question,
  answer,
  currentIndex,
  total,
  score,
  streak,
  correctCount,
  settingsLabel,
  onAnswer,
  onNext,
  onQuit,
}) {
  const answered = Boolean(answer)

  // How much of the clock was left (0–1). The timer writes it; the answer
  // handlers read it. No re-render needed either way.
  const timeLeftRef = useRef(1)

  const handleTick = useCallback((ratio) => {
    timeLeftRef.current = ratio
  }, [])

  // Time ran out → answer `null`, which the reducer reads as "no answer given".
  const handleExpire = useCallback(() => onAnswer(null, 0), [onAnswer])

  /** Every answer path (click, keyboard) goes through this one function. */
  const handleAnswer = useCallback(
    (text) => {
      if (answered) return
      onAnswer(text, timeLeftRef.current)
    },
    [answered, onAnswer],
  )

  const handleNext = useCallback(() => {
    // Reset the stored time fraction for the next question.
    timeLeftRef.current = 1
    onNext()
  }, [onNext])

  /** Pick an answer by position: keys 1–6 or the letters A–F. */
  const chooseByIndex = useCallback(
    (index) => {
      const option = question?.answers[index]
      if (option) handleAnswer(option.text)
    },
    [question, handleAnswer],
  )

  // Keep the newest callbacks reachable from the (attached once) key listener.
  // Written in an effect, because refs must not be touched while rendering.
  const latestRef = useRef({ chooseByIndex, answered, onNext: handleNext })
  useEffect(() => {
    latestRef.current = { chooseByIndex, answered, onNext: handleNext }
  })

  useEffect(() => {
    function onKeyDown(event) {
      const current = latestRef.current

      // Digits pick an answer.
      if (/^[1-9]$/.test(event.key) && !current.answered) {
        current.chooseByIndex(Number(event.key) - 1)
        return
      }

      // Letters do too (layout-independent, unlike digits).
      if (/^[a-zA-Z]$/.test(event.key) && !current.answered) {
        current.chooseByIndex(event.key.toUpperCase().charCodeAt(0) - 65)
        return
      }

      // Enter / Space confirms the answer we just gave and moves on.
      if ((event.key === 'Enter' || event.key === ' ') && current.answered) {
        event.preventDefault() // stop Space from "clicking" a focused button twice
        current.onNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    // Cleanup: React calls this before unmounting, so we never leak listeners.
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <section className="quiz">
      <div className="quiz__bar card card--flat">
        <div className="quiz__bar-top">
          <div className="quiz__counter">
            <span className="quiz__counter-label">Question</span>
            <span className="quiz__counter-value">
              {currentIndex + 1}
              <span className="quiz__counter-total">/{total}</span>
            </span>
          </div>

          <div className="quiz__stats">
            {/* `key={currentIndex}` is the whole trick: a different key means React
                unmounts the old timer and mounts a new one, so the clock restarts
                at 20 without any reset code. */}
            <TimerBar
              key={currentIndex}
              running={!answered}
              onExpire={handleExpire}
              onTick={handleTick}
            />
            <Stat label="Score" value={score} tone="brand" />
            <Stat label="Correct" value={`${correctCount}/${currentIndex + (answered ? 1 : 0)}`} />
            <Stat
              label="Streak"
              value={
                streak > 0 ? (
                  <>
                    <span aria-hidden="true">🔥</span> {streak}
                  </>
                ) : (
                  '—'
                )
              }
              tone={streak >= 3 ? 'warm' : ''}
            />
          </div>
        </div>

        <ProgressBar
          value={currentIndex + (answered ? 1 : 0)}
          max={total}
          label={`Question ${currentIndex + 1} of ${total}`}
        />

        <div className="quiz__meta">
          <span>{settingsLabel}</span>
          <button type="button" className="link-button" onClick={onQuit}>
            Quit round
          </button>
        </div>
      </div>

      {/* `key={currentIndex}` remounts the card for each question, so its internal
          roving-focus state starts fresh instead of lingering across questions. */}
      <QuestionCard
        key={currentIndex}
        question={question}
        answer={answer}
        onSelect={handleAnswer}
        onNext={handleNext}
        isLastQuestion={currentIndex >= total - 1}
      />

      <p className="hint">
        <kbd>1</kbd>–<kbd>4</kbd> or <kbd>A</kbd>–<kbd>D</kbd> to answer · <kbd>Enter</kbd> for the
        next question · {QUESTION_TIME_SECONDS}s per question
      </p>
    </section>
  )
}
