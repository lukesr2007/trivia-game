/**
 * SMALL DISPLAY-ONLY PIECES
 * ---------------------------------------------------------------------------
 * Notice how small these components are: each one renders a piece of markup and
 * nothing else. That is the point of splitting things up — you can read one file
 * at a time, and you can reuse `<Badge />` in twenty places without repeating
 * markup twenty times.
 */

import { shortCategoryName } from '../data/categories.js'

/**
 * A tiny coloured label, e.g. "Film" or "Hard".
 *
 * `tone` picks the colour. We pass the class name through `className` so the
 * component stays reusable, and the parent can add its own classes.
 */
export function Badge({ children, tone = 'neutral', icon = null, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {icon ? (
        <span className="badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )
}

/** Colour-codes the difficulty using OpenTDB's own three values. */
export function DifficultyBadge({ difficulty }) {
  const icons = { easy: '🟢', medium: '🟠', hard: '🔴' }
  return (
    <Badge tone={difficulty} icon={icons[difficulty]}>
      {difficulty}
    </Badge>
  )
}

/** Uses the API's category string, trimmed down to something that fits a chip. */
export function CategoryBadge({ category }) {
  return (
    <Badge tone="brand" icon="📚">
      {shortCategoryName(category)}
    </Badge>
  )
}

/**
 * A labelled number, used for score / streak / progress in the quiz header.
 * `value` is a string already formatted by the caller.
 */
export function Stat({ label, value, tone = '' }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`.trim()}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

/**
 * The thin progress bar under the quiz header.
 *
 * `role="progressbar"` + aria-* is how a screen reader announces "step 3 of 10".
 * Purely decorative bars would just be noise, so we describe it properly.
 */
export function ProgressBar({ value, max, label }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
