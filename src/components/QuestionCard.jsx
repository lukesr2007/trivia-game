/**
 * QuestionCard — the actual quiz question.
 * ---------------------------------------------------------------------------
 * It is "dumb" on purpose: everything it needs arrives as props and every change
 * goes back out through a callback. All the rules live in useTriviaGame, so this
 * file is really just markup — which makes it easy to read and easy to reuse.
 */

import { useEffect, useRef, useState } from 'react'

import { AnswerOption } from './AnswerOption.jsx'
import { CategoryBadge, DifficultyBadge } from './Primitives.jsx'
import { shortCategoryName } from '../data/categories.js'

/** The coloured panel that appears under the answers once you have answered. */
function Feedback({ answer, isLastQuestion, onNext }) {
  // Move focus to the "Next question" button as soon as the panel appears, so a
  // keyboard user can carry straight on. We do this with a ref + effect instead
  // of the `autoFocus` prop: `autoFocus` is discouraged because it can fire on a
  // plain page load, whereas an effect only runs when this panel really mounts.
  const nextButtonRef = useRef(null)

  useEffect(() => {
    nextButtonRef.current?.focus()
  }, [])

  const heading = answer.timedOut
    ? "⏱️ Time's up!"
    : answer.isCorrect
      ? '✅ Correct!'
      : '❌ Not quite'

  return (
    <div className={`feedback ${answer.isCorrect ? 'feedback--good' : 'feedback--bad'}`}>
      {/* aria-live="polite" means a screen reader announces this the moment it
          appears, without interrupting whatever the user is doing. */}
      <div className="feedback__body" aria-live="polite">
        <strong className="feedback__heading">{heading}</strong>

        {!answer.isCorrect && (
          <p className="feedback__line">
            The correct answer is <em className="feedback__answer">{answer.correctAnswer}</em>.
          </p>
        )}

        <p className="feedback__meta">
          {answer.isCorrect ? `+${answer.points} points` : 'No points this time'} ·{' '}
          {shortCategoryName(answer.category)}
        </p>
      </div>

      <button type="button" className="btn btn--primary" onClick={onNext} ref={nextButtonRef}>
        {isLastQuestion ? 'See results' : 'Next question'}
        <span className="btn__hint" aria-hidden="true">
          ↵
        </span>
      </button>
    </div>
  )
}

export function QuestionCard({ question, answer, onSelect, onNext, isLastQuestion }) {
  const answered = Boolean(answer)

  // The group behaves like a radio set: it is a single tab stop, and the arrow
  // keys move focus between options. `focusIndex` tracks which option holds the
  // group's one `tabIndex="0"`.
  const [focusIndex, setFocusIndex] = useState(0)
  const optionRefs = useRef([])

  const handleGroupKeyDown = (event) => {
    const last = question.answers.length - 1
    let next

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = focusIndex >= last ? 0 : focusIndex + 1
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        next = focusIndex <= 0 ? last : focusIndex - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }

    event.preventDefault()
    setFocusIndex(next)
    optionRefs.current[next]?.focus()
  }

  /** Work out the visual state of every option from the current answer. */
  const stateFor = (option) => {
    if (!answered) return 'idle'
    if (option.isCorrect) return 'correct'
    if (option.text === answer.selectedAnswer) return 'wrong'
    return 'missed'
  }

  return (
    <article className={`card question-card ${answered ? 'question-card--answered' : ''}`}>
      <header className="question-card__head">
        <div className="question-card__badges">
          <CategoryBadge category={question.category} />
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
      </header>

      {/* The API's text is already decoded to plain characters, and React escapes
          any text it renders, so we are safe from HTML injection here. */}
      <h2 className="question-card__question">{question.question}</h2>

      {/* A single-choice group. `aria-label` gives the group a name; the options
          inside are role="radio" (see AnswerOption). */}
      <div
        className="answers"
        role="radiogroup"
        aria-label="Answer options"
        tabIndex={-1}
        onKeyDown={handleGroupKeyDown}
      >
        {question.answers.map((option, index) => (
          <AnswerOption
            key={option.id}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            text={option.text}
            index={index}
            state={stateFor(option)}
            selected={option.text === answer?.selectedAnswer}
            disabled={answered}
            onSelect={onSelect}
            tabIndex={index === focusIndex ? 0 : -1}
          />
        ))}
      </div>

      {answered && <Feedback answer={answer} isLastQuestion={isLastQuestion} onNext={onNext} />}
    </article>
  )
}
