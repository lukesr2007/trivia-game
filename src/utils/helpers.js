/**
 * SMALL, PURE HELPER FUNCTIONS
 * ---------------------------------------------------------------------------
 * "Pure" means: give them input, get output, change nothing outside the function.
 * That makes them easy to test and reason about, and React components love them
 * because they can be called *while rendering* (see `prepareQuestions` in
 * src/utils/questions.js).
 */

import { decode } from 'he'

/**
 * Open Trivia DB escapes special characters so the text is safe to use in HTML.
 * By default the API returns text like:
 *
 *   In &quot;Friends&quot;, Monica&#039;s job?
 *
 * If we rendered that raw, the user would literally READ `&quot;`. We have to
 * turn those entities back into real characters ("), which is what this does.
 *
 * HOW: we use the `he` library, which decodes named and numeric entities as
 * *text* and never touches the DOM. An earlier version assigned the string to a
 * detached `textarea.innerHTML`, which works but hands untrusted API text to an
 * HTML parser (a known DOM-sink footgun). Decoding to a plain string here means
 * the API response can only ever become text — React escapes it on render — so
 * there is no HTML-injection surface.
 */
export function decodeHtmlEntities(text = '') {
  return decode(text)
}

/**
 * Decodes Base64 that contains UTF-8 text.
 *
 * `atob()` returns a "binary string": one character per *byte*, which mangles
 * non-English letters (é, ñ, …) because those need 2 bytes in UTF-8. To get real
 * text back we turn the bytes into a Uint8Array and let TextDecoder do the
 * UTF-8 decoding properly.
 */
export function decodeBase64(text = '') {
  try {
    const binary = atob(text)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    // Malformed Base64 should never crash the quiz — show nothing instead.
    return ''
  }
}

/**
 * The API offers three "encodings" for its text. We decode whichever one was asked
 * for. Keeping this in one place means the rest of the app never has to think
 * about encoding at all — it always receives normal, readable text.
 *
 *  - 'default'  → HTML entities (&quot;)  → decodeHtmlEntities
 *  - 'url3986'  → percent-encoded (%22)     → decodeURIComponent
 *  - 'base64'   → Base64 ("SW4gIkZy...")  → decodeBase64
 */
export function decodeByEncoding(text, encoding = 'default') {
  switch (encoding) {
    case 'base64':
      return decodeBase64(text)
    case 'url3986':
      try {
        return decodeURIComponent(text)
      } catch {
        return text
      }
    default:
      return decodeHtmlEntities(text)
  }
}

/**
 * Fisher–Yates shuffle: returns a NEW array in random order, leaving the original
 * alone.
 *
 * WHY THIS MATTERS FOR A QUIZ: the API always sends `correct_answer` separately
 * from `incorrect_answers`. If we render `[correct, ...incorrect]` the player
 * learns "always pick A". Shuffling makes the quiz fair.
 *
 * The loop walks backwards, swapping each element with a random earlier one.
 */
export function shuffle(items = []) {
  const result = [...items] // copy, so we never mutate the caller's array
  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[randomIndex]] = [result[randomIndex], result[i]]
  }
  return result
}

/**
 * Builds the URL query string for the API from a plain settings object.
 * Only non-empty values are added, because OpenTDB rejects unknown parameters
 * with response code 2. `null` / `''` / 0 are treated as "no filter".
 */
export function toQueryString(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}
