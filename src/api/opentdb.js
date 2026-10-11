/**
 * OPEN TRIVIA DB — API LAYER
 * ===========================================================================
 * Every network call this app makes lives in this file, and nothing else in the
 * app is allowed to call `fetch`. That single rule buys us:
 *
 *   1. One place to fix a bug or add a parameter.
 *   2. One consistent error type (`TriviaApiError`) for the UI to display.
 *   3. Testability — swap this file for a fake and the UI still works.
 *
 * THE ENDPOINTS WE USE
 * ---------------------------------------------------------------------------
 *  1. api.php?amount=…&category=…&difficulty=…&type=…&encode=…&token=…
 *        → the questions themselves.
 *  2. api_token.php?command=request
 *        → asks for a "session token".
 *  3. api_token.php?command=reset&token=…
 *        → empties that session so its questions become available again.
 *  4. api_category.php
 *        → the list of 24 categories.
 *
 * WHAT IS A SESSION TOKEN (the most interesting feature here)?
 * ---------------------------------------------------------------------------
 * By default the API is stateless: every call can return the same questions.
 * If you pass `token=…`, the API remembers every question it has already given
 * you with that token and will never repeat one — perfect for "no repeats" mode.
 * When the session runs dry the API answers `response_code: 4`, and a `reset`
 * puts all those questions back into the pool.
 *
 * RESPONSE CODES (the API's own status language — always check this!)
 *   0 = Success
 *   1 = No results for that amount/category/difficulty combination
 *   2 = Invalid parameter (e.g. amount=99 — the max is 50)
 *   3 = Token not found (expired server-side)
 *   4 = Token empty — you have seen every question it had for you
 *
 * RATE LIMIT: the free tier allows roughly one request every 5 seconds per IP.
 * We only fetch when the player presses Start, but `requestJson` also retries
 * once after a pause if we get an empty body — which is how a rate-limited
 * server usually responds.
 */

import { decodeByEncoding, toQueryString } from '../utils/helpers.js'

const API_URL = 'https://opentdb.com/api.php'
const TOKEN_URL = 'https://opentdb.com/api_token.php'
const CATEGORY_URL = 'https://opentdb.com/api_category.php'

/** API limits — mirrored in the UI so the user cannot even ask for 500. */
export const AMOUNT_MIN = 1
export const AMOUNT_MAX = 50

/** How long a single request may take before we give up (ms). */
const REQUEST_TIMEOUT_MS = 12000
/** Pause before the one retry, to respect the ~5s rate limit. */
const RETRY_DELAY_MS = 5500

/**
 * A custom error class so the UI can tell "the API said no results" apart from
 * "the network is down" and show the right message + the right button.
 *
 * `code` mirrors OpenTDB's `response_code` (null for transport errors).
 * `recoverable` tells the UI whether offering a "Try again" button makes sense.
 */
export class TriviaApiError extends Error {
  constructor(message, { code = null, recoverable = true, cause } = {}) {
    super(message, { cause })
    this.name = 'TriviaApiError'
    this.code = code
    this.recoverable = recoverable
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Combines several AbortSignals into one that aborts as soon as any of them does.
 *
 * `AbortSignal.any([a, b])` does this natively, but only in fairly new browsers
 * (Chrome 116+, Safari 17.4+, Firefox 124+). This tiny version works everywhere
 * and also hands back a `dispose()` so we can remove our event listeners instead
 * of leaking them.
 */
function anySignal(signals) {
  const controller = new AbortController()
  const listeners = []

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    const onAbort = () => controller.abort(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    listeners.push([signal, onAbort])
  }

  return {
    signal: controller.signal,
    dispose() {
      for (const [signal, onAbort] of listeners) signal.removeEventListener('abort', onAbort)
    },
  }
}

/**
 * Low-level `fetch` wrapper: timeout, HTTP check, JSON check, one retry.
 *
 * `signal` lets the caller abort a request that is no longer needed (e.g. the
 * player hit "Change settings" while loading) — without it React would warn
 * about updating state on an unmounted component.
 */
async function requestJson(url, { signal, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // A deadline we can enforce ourselves, plus the caller's signal (if any).
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    const combined = anySignal([timeoutController.signal, signal].filter(Boolean))

    try {
      const response = await fetch(url, { signal: combined.signal })

      // `ok` is false for 4xx/5xx. The API can also answer 200 with an empty body
      // when it thinks we are going too fast, which `response.json()` would throw on.
      if (!response.ok) {
        throw new TriviaApiError(`The trivia server responded with ${response.status}.`, {
          recoverable: response.status >= 500,
        })
      }

      const body = await response.text()
      if (!body.trim()) {
        throw new TriviaApiError('The trivia server returned an empty response.', {
          cause: new Error('empty body (usually the 5-second rate limit)'),
        })
      }

      try {
        return JSON.parse(body)
      } catch (cause) {
        throw new TriviaApiError('The trivia server sent something we could not read.', { cause })
      }
    } catch (error) {
      // The caller cancelled deliberately — do not retry, do not shout about it.
      if (signal?.aborted) throw error

      const isLastAttempt = attempt === retries
      if (!isLastAttempt) {
        await wait(RETRY_DELAY_MS)
        continue
      }

      if (error instanceof TriviaApiError) throw error

      if (error.name === 'AbortError') {
        throw new TriviaApiError('The trivia server took too long to answer.', { cause: error })
      }
      throw new TriviaApiError('We could not reach the trivia server. Check your connection.', {
        cause: error,
      })
    } finally {
      clearTimeout(timeoutId)
      combined.dispose()
    }
  }

  // Unreachable: the loop either returns or throws. Kept so the function is total.
  throw new TriviaApiError('Request failed for an unknown reason.')
}

/**
 * GET https://opentdb.com/api_category.php
 * Returns `[{ id, name }, …]`. Throws `TriviaApiError` on failure — the caller
 * decides whether to fall back to the bundled list.
 */
export async function fetchCategories({ signal } = {}) {
  const data = await requestJson(CATEGORY_URL, { signal })

  if (!Array.isArray(data.trivia_categories)) {
    throw new TriviaApiError('The category list came back in an unexpected shape.')
  }

  return data.trivia_categories.map(({ id, name }) => ({ id, name }))
}

/** GET api_token.php?command=request → a brand new empty "seen questions" bucket. */
export async function requestSessionToken({ signal } = {}) {
  const data = await requestJson(`${TOKEN_URL}?command=request`, { signal })

  // response_code 0 = token generated, 1 = no token available right now.
  if (data.response_code !== 0 || !data.token) {
    throw new TriviaApiError('Could not start a no-repeat session right now.', {
      code: data.response_code,
    })
  }
  return data.token
}

/** GET api_token.php?command=reset&token=… → forget which questions that token used. */
export async function resetSessionToken(token, { signal } = {}) {
  if (!token) return false

  const data = await requestJson(`${TOKEN_URL}?command=reset&token=${encodeURIComponent(token)}`, {
    signal,
  })
  const ok = data.response_code === 0
  if (!ok) {
    throw new TriviaApiError('Could not reset the no-repeat session.', { code: data.response_code })
  }
  return ok
}

/** Turns OpenTDB's `response_code` into a message a human actually wants to read. */
const CODE_MESSAGES = {
  1: 'We could not find enough questions for that combination. Try a different category or difficulty.',
  2: 'The trivia server did not like our request. Try resetting the options.',
  3: 'Your no-repeat session expired, so we started a fresh one.',
  4: 'You have already seen every question in this no-repeat session, so it was reset for you.',
}

/**
 * Converts one raw question from the API into the shape our components want:
 * text already decoded, all possible answers merged into a single list.
 *
 * Note `allAnswers` is built by the CALLER (src/utils/questions.js) because
 * shuffling is a display concern, not an API concern.
 */
function normalizeQuestion(raw, encoding) {
  return {
    category: decodeByEncoding(raw.category, encoding),
    type: raw.type, // 'multiple' | 'boolean'
    difficulty: raw.difficulty, // 'easy' | 'medium' | 'hard'
    question: decodeByEncoding(raw.question, encoding),
    correctAnswer: decodeByEncoding(raw.correct_answer, encoding),
    incorrectAnswers: raw.incorrect_answers.map((answer) => decodeByEncoding(answer, encoding)),
  }
}

/**
 * GET https://opentdb.com/api.php?…
 *
 * @param {object} settings
 * @param {number} settings.amount    how many questions (1–50)
 * @param {number|null} settings.category   category id, or null for "any"
 * @param {string|null} settings.difficulty 'easy' | 'medium' | 'hard' | null
 * @param {string|null} settings.type       'multiple' | 'boolean' | null
 * @param {string} settings.encode     'default' | 'url3986' | 'base64'
 * @param {string|null} settings.token   session token for "no repeats"
 * @returns {Promise<object[]>} decoded, ready-to-render questions
 */
export async function fetchQuestions(settings, { signal } = {}) {
  const {
    amount = 10,
    category = null,
    difficulty = null,
    type = null,
    encode = 'default',
    token = null,
  } = settings

  const query = toQueryString({
    amount,
    category,
    difficulty,
    type,
    // ⚠️ GOTCHA WORTH KNOWING: the parameter is called `encode`, but the value
    // "default" is NOT valid — the API answers `response_code: 2` (invalid
    // parameter). You get the default (HTML entity) encoding by leaving the
    // parameter out entirely, and `toQueryString` skips empty values, so we
    // send '' here on purpose. Verified against the live API.
    encode: encode === 'default' ? '' : encode,
    token,
  })
  const data = await requestJson(`${API_URL}?${query}`, { signal })

  // ---- Handle the API's own status language ---------------------------------
  if (data.response_code !== 0) {
    const message =
      CODE_MESSAGES[data.response_code] ?? 'The trivia server could not build that quiz.'
    // Codes 1 and 2 are caused by the user's own choice of filters, so pressing
    // "Try again" would fail identically — retrying is pointless, so we mark them
    // non-recoverable and offer "change the options" instead.
    throw new TriviaApiError(message, {
      code: data.response_code,
      recoverable: data.response_code !== 1 && data.response_code !== 2,
    })
  }

  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new TriviaApiError('The trivia server returned no questions.', {
      code: 1,
      recoverable: false,
    })
  }

  return data.results.map((raw) => normalizeQuestion(raw, encode))
}
