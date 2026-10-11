/**
 * LoadingScreen — what the player sees while the API is thinking.
 * ---------------------------------------------------------------------------
 * A blank screen (or the word "Loading") feels broken when a request takes a
 * couple of seconds, so we show:
 *   • an animated bar of "skeleton" cards in the shape of the real content
 *   • a status line that names the request being made
 *   • a cancel button, because waiting should never be a trap
 *
 * Skeletons are pure CSS (see .skeleton in index.css) — no library needed.
 */

export function LoadingScreen({ amount, onCancel }) {
  // Show 3 placeholder cards regardless of the real amount: enough to look like a
  // page, not so many that the layout jumps when they are replaced.
  const placeholders = Array.from({ length: 3 }, (_, index) => index)

  return (
    <section className="loading" aria-busy="true" aria-live="polite">
      <div className="loading__status">
        <span className="loading__spinner" aria-hidden="true" />
        <div>
          <strong>Fetching {amount} questions…</strong>
          <span>Asking the Open Trivia DB…</span>
        </div>
      </div>

      <div className="loading__cards" aria-hidden="true">
        {placeholders.map((key) => (
          <div className="card skeleton" key={key}>
            <div className="skeleton__line skeleton__line--short" />
            <div className="skeleton__line skeleton__line--long" />
            <div className="skeleton__line skeleton__line--long" />
            <div className="skeleton__answers">
              <div className="skeleton__answer" />
              <div className="skeleton__answer" />
              <div className="skeleton__answer" />
              <div className="skeleton__answer" />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </section>
  )
}
