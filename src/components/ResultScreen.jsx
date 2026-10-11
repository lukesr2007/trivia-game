/**
 * ResultScreen — the summary after the last question.
 * ---------------------------------------------------------------------------
 * Two jobs:
 *   1. Make the player feel the result (big score ring, headline, streak).
 *   2. Teach them something (a full review list, filterable to what they missed).
 *
 * REVIEW LIST DETAIL
 * `answers` is indexed to match the questions (see the reducer), so we can zip
 * the two together. Note that a *missing* answer means the player never got
 * there (they quit mid-round) — we skip those instead of showing a blank row.
 */

import { useMemo, useState } from 'react'

import { Badge, CategoryBadge, DifficultyBadge, Stat } from './Primitives.jsx'
import { resultMessage } from '../utils/questions.js'
import { QUESTION_TIME_SECONDS } from '../hooks/useTriviaGame.js'

/** The circular score gauge. Same dash trick as the timer ring. */
function ScoreRing({ percent }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (percent / 100)

  return (
    <div className="score-ring" role="img" aria-label={`You scored ${percent} percent`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="score-ring__track" cx="64" cy="64" r={radius} />
        <circle
          className="score-ring__value"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>

      <div className="score-ring__center">
        <span className="score-ring__percent">{percent}%</span>
        <span className="score-ring__caption">{percent >= 60 ? 'passed' : 'keep going'}</span>
      </div>
    </div>
  )
}

/** One row in the review list. */
function ReviewItem({ answer, index }) {
  return (
    <li className={`review__item ${answer.isCorrect ? 'review__item--good' : 'review__item--bad'}`}>
      <span className="review__index" aria-hidden="true">
        {answer.isCorrect ? '✓' : '✕'}
      </span>

      <div className="review__body">
        <div className="review__badges">
          <Badge tone="neutral">Q{index + 1}</Badge>
          <CategoryBadge category={answer.category} />
          <DifficultyBadge difficulty={answer.difficulty} />
        </div>

        <p className="review__question">{answer.question}</p>

        <dl className="review__answers">
          {!answer.isCorrect && (
            <div className="review__row review__row--wrong">
              <dt>Your answer</dt>
              <dd>{answer.timedOut ? '⏱ No answer — time ran out' : answer.selectedAnswer}</dd>
            </div>
          )}

          <div className="review__row review__row--correct">
            <dt>Correct answer</dt>
            <dd>{answer.correctAnswer}</dd>
          </div>

          <div className="review__row review__row--meta">
            <dt>Time</dt>
            <dd>
              {(QUESTION_TIME_SECONDS * (1 - answer.timeLeftRatio)).toFixed(1)}s ·{' '}
              {answer.isCorrect ? `+${answer.points} pts` : 'no points'}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

export function ResultScreen({ summary, settingsLabel, onPlayAgain, onChangeSettings }) {
  const [showOnlyMissed, setShowOnlyMissed] = useState(false)

  const message = resultMessage(summary.percent)

  // Keep the ORIGINAL question number even while filtering, so "Q7" still means
  // question 7. `useMemo` is not required here (the filter is cheap) but it makes
  // the intent explicit: recompute only when the answers or the toggle change.
  const visibleAnswers = useMemo(
    () =>
      summary.answers
        .map((answer, index) => ({ answer, index }))
        .filter(({ answer }) => !showOnlyMissed || !answer.isCorrect),
    [summary.answers, showOnlyMissed],
  )

  return (
    <section className="results">
      <div className="card results__hero">
        <div className="results__ring">
          <ScoreRing percent={summary.percent} />
        </div>

        <div className="results__headline">
          <span className="results__emoji" aria-hidden="true">
            {message.emoji}
          </span>
          <h2 className="results__title">{message.title}</h2>
          <p className="results__subtitle">{settingsLabel}</p>

          <div className="results__badges">
            <Badge tone="brand">{summary.score} points</Badge>
            {summary.bestStreak >= 2 && <Badge tone="warm">🔥 {summary.bestStreak} in a row</Badge>}
            {summary.timedOut > 0 && <Badge tone="muted">⏱ {summary.timedOut} timed out</Badge>}
          </div>

          <div className="results__actions">
            <button type="button" className="btn btn--primary btn--large" onClick={onPlayAgain}>
              Play again
            </button>
            <button type="button" className="btn btn--ghost" onClick={onChangeSettings}>
              Change options
            </button>
          </div>
        </div>

        <div className="results__stats">
          <Stat label="Correct" value={summary.correct} tone="brand" />
          <Stat label="Wrong" value={summary.incorrect} />
          <Stat label="Accuracy" value={`${summary.percent}%`} />
          <Stat label="Avg. time" value={`${summary.averageSeconds.toFixed(1)}s`} />
        </div>
      </div>

      <div className="card results__review">
        <div className="results__review-head">
          <h3 className="results__review-title">Review your answers</h3>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={showOnlyMissed}
              onChange={(event) => setShowOnlyMissed(event.target.checked)}
            />
            <span>Show only missed ({summary.incorrect})</span>
          </label>
        </div>

        <ol className="review">
          {visibleAnswers.map(({ answer, index }) => (
            <ReviewItem key={answer.questionId} answer={answer} index={index} />
          ))}
        </ol>

        {visibleAnswers.length === 0 && (
          <p className="results__empty">Nothing to review — you got every single one right. 🎉</p>
        )}
      </div>
    </section>
  )
}
