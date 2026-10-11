/**
 * QUESTION HELPERS
 * ---------------------------------------------------------------------------
 * The API gives us `correct_answer` and `incorrect_answers` as two separate
 * lists. The UI wants ONE list of buttons, in random order, where we can still
 * tell which one is right. That transformation happens here, once per game, so
 * the answer order never changes while the player is looking at it.
 */

import { shuffle } from './helpers.js'

/**
 * Adds the fields the UI needs to each API question:
 *  - `id`         a stable key for React lists (two questions could be identical)
 *  - `answers`    [correct, ...incorrect] shuffled, each tagged with `isCorrect`
 *
 * The shuffle is random *once*, at the moment the questions arrive, and the
 * result is stored. If we shuffled during render instead, React would re-roll the
 * dice on every re-render and the correct answer would jump around the screen.
 */
export function prepareQuestions(questions = []) {
  return questions.map((question, index) => {
    const answers = shuffle(
      [question.correctAnswer, ...question.incorrectAnswers].map((text) => ({
        text,
        isCorrect: text === question.correctAnswer,
      })),
    ).map((answer, answerIndex) => ({ ...answer, id: `${index}-${answerIndex}` }))

    return { ...question, id: `q${index}`, answers }
  })
}

/** 0–100, rounded. Used for the accuracy number and the result ring. */
export function percentage(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

/**
 * Points for one correct answer: a flat 100 plus a speed bonus of up to 50.
 *
 * Why a bonus? It rewards knowledge AND recall speed, which makes the timer
 * meaningful. `ratioLeft` is the fraction of the clock still remaining (1 = full
 * time, 0 = out of time). The result is scaled by 10 so it stays a whole number.
 */
export function pointsForAnswer(isCorrect, ratioLeft = 0) {
  if (!isCorrect) return 0
  const speedBonus = Math.round(Math.max(0, Math.min(1, ratioLeft)) * 50)
  return 100 + speedBonus
}

/** A friendly headline for the results screen, based on the percentage. */
export function resultMessage(percent) {
  if (percent === 100) return { title: 'Flawless!', emoji: '🏆', tone: 'gold' }
  if (percent >= 80) return { title: 'Excellent knowledge!', emoji: '🎉', tone: 'good' }
  if (percent >= 60) return { title: 'Solid run!', emoji: '👏', tone: 'good' }
  if (percent >= 40) return { title: 'Not bad — keep going!', emoji: '💪', tone: 'ok' }
  return { title: 'Tricky round!', emoji: '🧠', tone: 'low' }
}
