/**
 * useTriviaGame — the brain of the app.
 * ===========================================================================
 * Everything about "a quiz in progress" lives here: the settings, the questions,
 * which answer was picked, the score, the phase of the game (choosing → loading
 * → playing → finished) and the network calls that fill it.
 *
 * WHY A useReducer INSTEAD OF FIVE useState CALLS?
 * ---------------------------------------------------------------------------
 * A reducer groups all the state into ONE object and describes every change as
 * an "action". That buys three things a beginner immediately benefits from:
 *
 *  1. Impossible states become visible. All the rules live in one `reducer`
 *     function you can read top to bottom.
 *  2. One `dispatch` updates several values at once, atomically. React batches
 *     them into a single re-render — no "half-updated screen" flicker.
 *  3. It is easy to extend: new behaviour = a new `case`, not a new setter.
 *
 * The rule of thumb: useState for things that change independently (an input's
 * value), useReducer for a machine with several interdependent values.
 */

import { useMemo, useReducer, useRef } from 'react'

import {
  TriviaApiError,
  fetchQuestions,
  requestSessionToken,
  resetSessionToken,
} from '../api/opentdb.js'
import { percentage, pointsForAnswer, prepareQuestions } from '../utils/questions.js'
import { EMPTY_STATS, useLocalStorage } from './useLocalStorage.js'

/** The four screens the app can be in. Strings are used so they show up in devtools. */
export const PHASES = {
  SETUP: 'setup', // choosing category / difficulty / length
  LOADING: 'loading', // asking the API for questions
  PLAYING: 'playing', // answering questions one by one
  RESULTS: 'results', // the summary + review screen
}

/** Seconds allowed per question. */
export const QUESTION_TIME_SECONDS = 20

/** The quiz options, and the values sent to the API. Empty string = "any". */
export const DEFAULT_SETTINGS = {
  amount: 10, // API accepts 1–50
  category: '', // category id as a string, '' = any category
  difficulty: '', // '' | 'easy' | 'medium' | 'hard'
  type: '', // '' | 'multiple' | 'boolean'
  encoding: 'default', // 'default' | 'url3986' | 'base64'
  noRepeats: true, // use a session token so questions are never repeated
}

const initialState = {
  phase: PHASES.SETUP,
  questions: [], // prepared questions, each with a shuffled `answers` list
  currentIndex: 0, // which question we are on
  answers: [], // one entry per answered question, indexed like `questions`
  score: 0,
  streak: 0, // correct answers in a row (reset by a mistake)
  bestStreak: 0, // longest streak this game
  error: null, // a TriviaApiError, or null
}

/** Anything thrown that is not already a TriviaApiError still has to reach the UI as one. */
const toTriviaError = (error) =>
  error instanceof TriviaApiError
    ? error
    : new TriviaApiError('Something went wrong.', { cause: error })

/**
 * THE REDUCER — a pure function: (state, action) => newState.
 *
 * "Pure" means it must not touch the network, timers or localStorage, and it must
 * always return a fresh state object instead of mutating the old one. That is what
 * lets React compare old vs new and know what to redraw.
 */
function reducer(state, action) {
  switch (action.type) {
    case 'game/loading':
      return { ...state, phase: PHASES.LOADING, error: null }

    case 'game/loaded':
      return {
        ...state,
        phase: PHASES.PLAYING,
        questions: action.questions,
        currentIndex: 0,
        answers: [],
        score: 0,
        streak: 0,
        bestStreak: 0,
        error: null,
      }

    case 'game/failed':
      return { ...state, phase: PHASES.SETUP, error: action.error }

    /** The player answered (or ran out of time) on the current question. */
    case 'game/answered': {
      // Guard: ignore a second click on an already-answered question.
      if (state.answers[state.currentIndex]) return state

      const question = state.questions[state.currentIndex]
      const isCorrect = action.answer !== null && action.answer === question.correctAnswer
      const earned = pointsForAnswer(isCorrect, action.timeLeftRatio)

      // Copy-then-write. We never mutate `state.answers` directly, because React
      // compares references to decide what changed.
      const answers = [...state.answers]
      answers[state.currentIndex] = {
        questionId: question.id,
        question: question.question,
        category: question.category,
        difficulty: question.difficulty,
        selectedAnswer: action.answer, // null = ran out of time
        correctAnswer: question.correctAnswer,
        isCorrect,
        timedOut: action.answer === null,
        timeLeftRatio: action.timeLeftRatio,
        points: earned,
      }

      const streak = isCorrect ? state.streak + 1 : 0

      return {
        ...state,
        answers,
        score: state.score + earned,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      }
    }

    /** Move on — or finish the game if this was the last question. */
    case 'game/next': {
      const isLast = state.currentIndex >= state.questions.length - 1
      if (isLast) return { ...state, phase: PHASES.RESULTS }
      return { ...state, currentIndex: state.currentIndex + 1 }
    }

    /** Back to the settings screen, throwing away the current game. */
    case 'game/setup':
      return { ...initialState, error: action.error ?? null }

    default:
      return state
  }
}

export function useTriviaGame() {
  // Quiz choices, lifetime stats and the no-repeat session token all survive a
  // refresh, via localStorage.
  const [settings, setStoredSettings] = useLocalStorage('otdb.settings', DEFAULT_SETTINGS)
  const [stats, setStats] = useLocalStorage('otdb.stats', EMPTY_STATS)
  const [sessionToken, setSessionToken] = useLocalStorage('otdb.token', null)
  const [state, dispatch] = useReducer(reducer, initialState)

  // ---------------------------------------------------------------------
  // WHY THE HANDLERS BELOW ARE PLAIN FUNCTIONS (no useCallback, no refs)
  // ---------------------------------------------------------------------
  // They need today's `settings` and `state`. Both are simply closed over, and
  // because the component re-renders whenever they change, the functions always
  // see the newest values. Refs would work too, but they cannot be read while
  // rendering — and "get the current value from an event handler" is exactly the
  // job refs are *not* needed for here.
  //
  // A function whose identity changes every render is fine as long as it is only
  // used as an event handler, which is the case for all of them.

  // Only ONE ref survives: it cancels an in-flight request when the player quits
  // or starts a new round. It is written and read inside event handlers only.
  const abortRef = useRef(null)

  /** Merge a patch into the settings (and save them for next time). */
  const updateSettings = (patch) => setStoredSettings((current) => ({ ...current, ...patch }))

  const resetSettings = () => setStoredSettings(DEFAULT_SETTINGS)

  /**
   * Asks the API for a round of questions and switches to the PLAYING phase.
   *
   * @param {object}  [options]
   * @param {boolean} [options.reuseToken] keep the current no-repeat token, so
   *        pressing "Play again" keeps avoiding questions already seen.
   */
  const startGame = async ({ reuseToken = false } = {}) => {
    // Cancel anything still loading — a stale answer must never overwrite a new game.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    dispatch({ type: 'game/loading' })

    // Remembered so the catch block below knows WHICH token failed and whether
    // it was one we had already used. That is the difference between "you have
    // seen them all" (worth retrying) and "these filters are too narrow" (not).
    let usedToken = null
    let tokenWasJustCreated = false

    // Everything network-related lives in this inner function, so the automatic
    // token reset below can simply call it again.
    const loadRound = async (useExistingToken) => {
      const { noRepeats, encoding, ...filters } = settings
      const existingToken = useExistingToken ? sessionToken : null
      const useNoRepeats = noRepeats || Boolean(existingToken)

      let token = null

      if (useNoRepeats) {
        // A session token records which questions we have already been shown.
        //
        // WHY IT IS STORED IN localStorage: the API allows roughly one request
        // every 5 seconds, and asking for a fresh token on every round would mean
        // two back-to-back requests (token + questions) — which trips that limit.
        // Reusing one token across rounds (and across page reloads) keeps a round
        // down to a single request.
        token =
          existingToken ??
          sessionToken ??
          (await requestSessionToken({ signal: controller.signal }))
        setSessionToken(token) // remember it for the next round
      } else if (sessionToken) {
        // The player switched "no repeats" off — give the session back politely
        // so the API can hand those questions out again. Fire-and-forget: if it
        // fails, nothing in the UI breaks.
        resetSessionToken(sessionToken).catch(() => {})
      }

      usedToken = token
      tokenWasJustCreated = Boolean(token) && !existingToken && !sessionToken

      const rawQuestions = await fetchQuestions(
        { ...filters, encode: encoding, token },
        { signal: controller.signal },
      )

      return prepareQuestions(rawQuestions)
    }

    try {
      dispatch({ type: 'game/loaded', questions: await loadRound(reuseToken) })
    } catch (error) {
      // The user navigated away mid-request: not an error worth showing.
      if (controller.signal.aborted) return

      const isSessionSpent =
        error instanceof TriviaApiError && (error.code === 3 || error.code === 4)

      // ⚠️ SUBTLE API BEHAVIOUR, LEARNED THE HARD WAY
      // With no token, a filter combination that has no questions answers
      // `response_code: 1`. WITH a token the very same request answers
      // `response_code: 4` ("token empty"), because from the token's point of
      // view it can no longer produce enough unseen questions.
      //
      // So code 4 has two completely different meanings:
      //   • a long-lived session really is exhausted  → reset it and retry
      //   • the filters are simply too narrow         → retrying cannot help
      // Telling those apart needs to know whether the token we just used was new.
      if (isSessionSpent && tokenWasJustCreated) {
        dispatch({
          type: 'game/failed',
          error: new TriviaApiError(
            'There are not enough questions for these filters once repeats are excluded. ' +
              'Try “Any category”, a different difficulty, or a shorter quiz.',
            { code: error.code, recoverable: false, cause: error },
          ),
        })
        return
      }

      if (isSessionSpent && usedToken) {
        try {
          await resetSessionToken(usedToken, { signal: controller.signal })
          // A fresh session is empty, so it is never "used up" → no second retry
          // is possible. This is what keeps the automatic retry from looping.
          dispatch({ type: 'game/loaded', questions: await loadRound(false) })
          return
        } catch (retryError) {
          if (controller.signal.aborted) return
          dispatch({ type: 'game/failed', error: toTriviaError(retryError) })
          return
        }
      }

      dispatch({ type: 'game/failed', error: toTriviaError(error) })
    }
  }

  /** Record an answer for the current question. `answer === null` means time ran out. */
  const submitAnswer = (answer, timeLeftRatio = 0) => {
    dispatch({ type: 'game/answered', answer, timeLeftRatio })
  }

  /**
   * Advances to the next question — or ends the game.
   *
   * Saving the lifetime stats happens HERE, in the click handler, rather than in
   * an effect that watches for the RESULTS phase. Side effects belong in event
   * handlers, which keeps the reducer pure.
   */
  const nextQuestion = () => {
    const { currentIndex, questions, answers, score, bestStreak } = state
    const isLast = currentIndex >= questions.length - 1

    if (!isLast) {
      dispatch({ type: 'game/next' })
      return
    }

    dispatch({ type: 'game/next' }) // → phase becomes RESULTS

    const total = questions.length
    const answeredSoFar = answers.filter(Boolean)
    const correct = answeredSoFar.filter((answer) => answer.isCorrect).length

    setStats((current) => ({
      gamesPlayed: current.gamesPlayed + 1,
      questionsAnswered: current.questionsAnswered + total,
      correctAnswers: current.correctAnswers + correct,
      bestScore: Math.max(current.bestScore, score),
      bestStreak: Math.max(current.bestStreak, bestStreak),
    }))
  }

  /** Leave the game and return to the settings screen (also cancels a pending request). */
  const goToSetup = () => {
    abortRef.current?.abort()
    dispatch({ type: 'game/setup' })
  }

  /** Clear the current error without leaving the screen. */
  const clearError = () => dispatch({ type: 'game/setup', error: null })

  // ---------------------------------------------------------------------
  // DERIVED VALUES — computed from state while rendering, never stored twice.
  // ---------------------------------------------------------------------
  const question = state.questions[state.currentIndex] ?? null
  const currentAnswer = state.answers[state.currentIndex] ?? null
  const total = state.questions.length
  const correctCount = state.answers.filter((answer) => answer?.isCorrect).length

  const summary = useMemo(() => {
    // `filter(Boolean)` drops the holes for questions the player never reached,
    // so the review list only contains rows we can actually render.
    const answered = state.answers.filter(Boolean)
    const correct = answered.filter((answer) => answer.isCorrect).length
    const timedOut = answered.filter((answer) => answer.timedOut).length
    const timeSpent = answered.reduce((totalMs, answer) => {
      const secondsUsed = QUESTION_TIME_SECONDS * (1 - answer.timeLeftRatio)
      return totalMs + secondsUsed
    }, 0)

    return {
      answers: answered,
      correct,
      incorrect: answered.length - correct,
      timedOut,
      total: state.questions.length,
      score: state.score,
      bestStreak: state.bestStreak,
      percent: percentage(correct, state.questions.length),
      averageSeconds: answered.length ? timeSpent / answered.length : 0,
    }
  }, [state.answers, state.questions.length, state.score, state.bestStreak])

  return {
    // phase machine + the current question
    phase: state.phase,
    error: state.error,
    question,
    currentAnswer,
    currentIndex: state.currentIndex,
    total,
    correctCount,
    score: state.score,
    streak: state.streak,
    // the end-of-round summary (also used for the results screen)
    summary,
    // persisted values
    settings,
    stats,
    // actions
    startGame,
    submitAnswer,
    nextQuestion,
    goToSetup,
    clearError,
    updateSettings,
    resetSettings,
  }
}
