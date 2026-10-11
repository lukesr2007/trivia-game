/**
 * SetupScreen — choose the quiz, then start it.
 * ---------------------------------------------------------------------------
 * Every control here maps 1:1 to a parameter of the Open Trivia DB endpoint, so
 * this file doubles as documentation for the API. The comments say which query
 * parameter each option becomes.
 *
 *   amount      → &amount=10          (1–50)
 *   category    → &category=11        (9–32, blank = any)
 *   difficulty  → &difficulty=hard    (easy | medium | hard, blank = any)
 *   type        → &type=multiple      (multiple | boolean, blank = any)
 *   encoding    → &encode=base64      (default | url3986 | base64)
 *   noRepeats   → &token=…            (a session token, not a plain value)
 *
 * CONTROL PATTERNS USED
 *   • Radio-style "segmented" buttons for 2–4 choices (better than a <select>
 *     because the whole option set is visible at a glance).
 *   • A real <select> for the 25-item category list.
 *   • A <details> element for the advanced stuff, so the default view stays calm.
 */

import { AMOUNT_MAX, AMOUNT_MIN } from '../api/opentdb.js'
import { ErrorNotice } from './ErrorNotice.jsx'

/** The amount buttons. 5/10/15/20 keeps rounds quick but not trivial. */
const AMOUNT_OPTIONS = [5, 10, 15, 20]

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Any', icon: '🎲' },
  { value: 'easy', label: 'Easy', icon: '🟢' },
  { value: 'medium', label: 'Medium', icon: '🟠' },
  { value: 'hard', label: 'Hard', icon: '🔴' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Mixed', icon: '🔀' },
  { value: 'multiple', label: 'Multiple choice', icon: '🔤' },
  { value: 'boolean', label: 'True / False', icon: '✅' },
]

const ENCODING_OPTIONS = [
  { value: 'default', label: 'HTML entities (&quot;) — decoded with a <textarea>' },
  { value: 'url3986', label: 'Percent-encoded (%22) — decoded with decodeURIComponent' },
  { value: 'base64', label: 'Base64 (SWdub3JlZCk=) — decoded with atob + TextDecoder' },
]

/**
 * A row of choices that behave like radio buttons.
 *
 * We use real <input type="radio"> elements, hidden with CSS, instead of buttons:
 * that keeps keyboard support, screen-reader support and form semantics for free.
 * The visible pill is the <label>.
 */
function SegmentedControl({ name, options, value, onChange, legend, hint }) {
  return (
    <fieldset className="field">
      <legend className="field__label">{legend}</legend>

      <div className="segmented">
        {options.map((option) => {
          const id = `${name}-${option.value || 'any'}`
          const isChecked = value === option.value

          return (
            <div className="segmented__item" key={option.value || 'any'}>
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={() => onChange(option.value)}
                className="visually-hidden"
              />
              <label htmlFor={id} className="segmented__label">
                {option.icon ? (
                  <span className="segmented__icon" aria-hidden="true">
                    {option.icon}
                  </span>
                ) : null}
                {option.label}
              </label>
            </div>
          )
        })}
      </div>

      {hint ? <p className="field__hint">{hint}</p> : null}
    </fieldset>
  )
}

export function SetupScreen({
  settings,
  categories,
  categoriesState, // 'loading' | 'ready' | 'fallback'
  stats,
  error,
  onChange,
  onStart,
  onReset,
  onDismissError,
}) {
  const update = (patch) => onChange(patch)

  return (
    <section className="setup">
      <div className="setup__intro">
        <h2 className="setup__title">
          Trivia<span className="setup__title-accent">Quest</span>
        </h2>
        <p className="setup__subtitle">
          Pick your battle. Questions come live from the{' '}
          <a href="https://opentdb.com" target="_blank" rel="noreferrer">
            Open Trivia DB
          </a>{' '}
          — <strong>over 1.5 million questions</strong> in 24 categories.
        </p>
      </div>

      {stats.gamesPlayed > 0 && (
        <div className="setup__stats">
          <div>
            <strong>{stats.gamesPlayed}</strong> <span>rounds played</span>
          </div>
          <div>
            <strong>
              {stats.questionsAnswered
                ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100)
                : 0}
              %
            </strong>{' '}
            <span>all-time accuracy</span>
          </div>
          <div>
            <strong>{stats.bestScore}</strong> <span>best score</span>
          </div>
          <div>
            <strong>🔥 {stats.bestStreak}</strong> <span>best streak</span>
          </div>
        </div>
      )}

      <div className="card setup__form">
        <SegmentedControl
          name="amount"
          legend="How many questions?"
          options={AMOUNT_OPTIONS.map((amount) => ({
            value: String(amount),
            label: String(amount),
          }))}
          value={String(settings.amount)}
          onChange={(value) => update({ amount: Number(value) })}
          hint={`The API allows between ${AMOUNT_MIN} and ${AMOUNT_MAX} questions per request.`}
        />

        <div className="field">
          <label className="field__label" htmlFor="category">
            Category
            {categoriesState === 'loading' && (
              <span className="field__spinner" aria-label="Loading categories" />
            )}
            {categoriesState === 'fallback' && (
              <span className="field__tag" title="Could not reach the API, using the built-in list">
                offline list
              </span>
            )}
          </label>

          <select
            id="category"
            className="select"
            value={settings.category}
            onChange={(event) => update({ category: event.target.value })}
          >
            {/* `value=""` means "no category filter" — we must send no parameter
                at all for that, which the API layer handles by skipping empties. */}
            <option value="">Any category</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <SegmentedControl
          name="difficulty"
          legend="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={settings.difficulty}
          onChange={(value) => update({ difficulty: value })}
        />

        <SegmentedControl
          name="type"
          legend="Question style"
          options={TYPE_OPTIONS}
          value={settings.type}
          onChange={(value) => update({ type: value })}
          hint="True / False questions are answered with two buttons instead of four."
        />

        {/* A checkbox styled as a switch — still a real checkbox underneath. */}
        <label className="switch" htmlFor="no-repeats">
          <input
            id="no-repeats"
            type="checkbox"
            checked={settings.noRepeats}
            onChange={(event) => update({ noRepeats: event.target.checked })}
          />
          <span className="switch__track" aria-hidden="true">
            <span className="switch__thumb" />
          </span>
          <span className="switch__text">
            <strong>No repeats</strong>
            <span>
              Uses an API <em>session token</em>, so you will never see the same question twice in
              this browser.
            </span>
          </span>
        </label>

        {/* <details> is a native disclosure widget: no state needed, keyboard
            accessible for free, and collapsed by default. */}
        <details className="advanced">
          <summary className="advanced__summary">
            <span>Advanced</span>
            <span className="advanced__chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>

          <div className="advanced__body">
            <div className="field">
              <label className="field__label" htmlFor="encoding">
                Response encoding
              </label>
              <select
                id="encoding"
                className="select"
                value={settings.encoding}
                onChange={(event) => update({ encoding: event.target.value })}
              >
                {ENCODING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="field__hint">
                The same questions can arrive escaped three different ways. Try one, then another —
                the text on screen is always identical because we decode it before rendering.
              </p>
            </div>
          </div>
        </details>

        <div className="setup__actions">
          <button type="button" className="btn btn--primary btn--large" onClick={() => onStart()}>
            Start quiz
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button type="button" className="btn btn--ghost" onClick={onReset}>
            Reset options
          </button>
        </div>
      </div>

      {/* A failure from the previous attempt (e.g. "not enough questions for
          that combination") appears exactly where the player is about to press
          Start again — with a retry and a way to dismiss it. */}
      {error ? (
        <ErrorNotice
          error={error}
          onRetry={() => onStart()}
          onDismiss={onDismissError}
          // For a rejected filter combination, the most helpful single action is
          // "put the options back to the defaults and let me try again".
          onChangeOptions={onReset}
        />
      ) : null}
    </section>
  )
}
