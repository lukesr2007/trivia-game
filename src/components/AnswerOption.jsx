/**
 * AnswerOption — one clickable answer button.
 * ---------------------------------------------------------------------------
 * This component is a good example of a component with three jobs:
 *   1. Show text.
 *   2. Look right before AND after answering.
 *   3. Stay accessible (a real <button>, correct aria-checked state, visible
 *      keyboard focus).
 *
 * PROPS EXPLAINED
 *   text           what the button says
 *   index          position in the list (used for the A/B/C/D letter)
 *   state          'idle' | 'correct' | 'wrong' | 'missed'
 *   selected       did the player pick this one?
 *   disabled       no more clicks allowed (already answered)
 *   onSelect       called with the answer text
 *
 * WHY `aria-checked` INSTEAD OF `aria-pressed`? Because the options behave like a
 * single-choice group: exactly one is chosen. We mark the group up as a
 * radiogroup in QuestionCard and the buttons as radio-ish options.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function AnswerOption({ text, index, state, selected, disabled, onSelect, tabIndex, ref }) {
  // Merge the "was it picked" and "is it right" concerns into one visual state:
  //   - the option the player chose and got wrong → red
  //   - the right answer → green, always revealed once answered
  //   - everything else → dimmed
  const classes = ['answer', `answer--${state}`]
  if (selected) classes.push('answer--selected')

  return (
    <button
      ref={ref}
      type="button"
      className={classes.join(' ')}
      onClick={() => onSelect(text)}
      disabled={disabled}
      // Roving tabindex: the whole group is one tab stop; arrow keys move within
      // it (see the radiogroup handler in QuestionCard).
      tabIndex={tabIndex}
      // `data-state` lets CSS do the styling; `state` is also useful in tests.
      data-state={state}
      aria-checked={selected}
      role="radio"
    >
      <span className="answer__letter" aria-hidden="true">
        {LETTERS[index] ?? index + 1}
      </span>

      <span className="answer__text">{text}</span>

      {/* The tick / cross is decorative: the feedback text below the question
          already says what happened, so screen readers should skip this. */}
      <span className="answer__icon" aria-hidden="true">
        {state === 'correct' ? '✓' : ''}
        {state === 'wrong' ? '✕' : ''}
        {state === 'missed' ? '→' : ''}
      </span>
    </button>
  )
}
