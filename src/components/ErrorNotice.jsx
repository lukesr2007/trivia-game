/**
 * ErrorNotice — a friendly explanation of what went wrong.
 * ---------------------------------------------------------------------------
 * RAW API ERRORS ARE NOT FOR HUMANS. `response_code: 2` means nothing to a
 * player. This component turns our `TriviaApiError` into a title, a sentence and
 * the right buttons:
 *
 *   • "not enough questions" (code 1, not recoverable) → change the options
 *   • anything else (recoverable)                     → try again
 *
 * The raw code is still printed, small and grey, because when you are debugging
 * it is the single most useful piece of information on screen.
 */

import { AMOUNT_MAX } from '../api/opentdb.js'

export function ErrorNotice({ error, onRetry, onDismiss, onChangeOptions }) {
  if (!error) return null

  // Code 1 = "not enough questions for that combination", code 2 = "we sent a
  // parameter you rejected". Anything marked non-recoverable in the API layer is
  // also caused by the filters, not by a broken connection.
  const needsDifferentOptions = error.code === 1 || error.code === 2 || !error.recoverable
  const title =
    error.code === 1 ? 'No questions match those options' : 'Those options were rejected'

  return (
    <div
      className={`notice ${needsDifferentOptions ? 'notice--warn' : 'notice--error'}`}
      role="alert"
    >
      <span className="notice__icon" aria-hidden="true">
        {needsDifferentOptions ? '🗂️' : '⚠️'}
      </span>

      <div className="notice__body">
        <strong className="notice__title">{title}</strong>
        <p className="notice__message">{error.message}</p>

        {needsDifferentOptions && (
          <p className="notice__message notice__message--muted">
            Try “Any category”, a lower amount (max {AMOUNT_MAX}), or a different difficulty.
          </p>
        )}

        {error.code ? <code className="notice__code">response_code {error.code}</code> : null}
      </div>

      <div className="notice__actions">
        {needsDifferentOptions && onChangeOptions ? (
          <button type="button" className="btn btn--small" onClick={onChangeOptions}>
            Change options
          </button>
        ) : null}

        {error.recoverable && onRetry ? (
          <button type="button" className="btn btn--small btn--primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}

        {onDismiss ? (
          <button type="button" className="link-button" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  )
}
