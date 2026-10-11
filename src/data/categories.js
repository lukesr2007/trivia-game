/**
 * FALLBACK CATEGORY LIST
 * ---------------------------------------------------------------------------
 * The Open Trivia DB has its own endpoint for categories:
 *   https://opentdb.com/api_category.php
 *
 * We *do* call it (see `fetchCategories` in src/api/opentdb.js) so the app always
 * shows the live list. But if the user is offline, the request fails, or the API
 * is down, we still want the dropdown to be usable. So we keep a copy of the
 * list here as a backup and fall back to it.
 *
 * WHY HARD-CODE IT INSTEAD OF ONLY CALLING THE API?
 *  - The UI never renders an empty <select>, which looks broken.
 *  - Offline / rate-limited users can still play.
 *  - The category IDs are stable: 9 = General Knowledge ... 32 = Cartoon & Animations.
 */

export const FALLBACK_CATEGORIES = [
  { id: 9, name: 'General Knowledge' },
  { id: 10, name: 'Entertainment: Books' },
  { id: 11, name: 'Entertainment: Film' },
  { id: 12, name: 'Entertainment: Music' },
  { id: 13, name: 'Entertainment: Musicals & Theatres' },
  { id: 14, name: 'Entertainment: Television' },
  { id: 15, name: 'Entertainment: Video Games' },
  { id: 16, name: 'Entertainment: Board Games' },
  { id: 17, name: 'Science & Nature' },
  { id: 18, name: 'Science: Computers' },
  { id: 19, name: 'Science: Mathematics' },
  { id: 20, name: 'Mythology' },
  { id: 21, name: 'Sports' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 24, name: 'Politics' },
  { id: 25, name: 'Art' },
  { id: 26, name: 'Celebrities' },
  { id: 27, name: 'Animals' },
  { id: 28, name: 'Vehicles' },
  { id: 29, name: 'Entertainment: Comics' },
  { id: 30, name: 'Science: Gadgets' },
  { id: 31, name: 'Entertainment: Japanese Anime & Manga' },
  { id: 32, name: 'Entertainment: Cartoon & Animations' },
]

/**
 * Turns the OpenTDB category *string* (e.g. "Entertainment: Film") into a short
 * label we can print on a badge ("Film"). The API sends the category as text with
 * each question, and that text is long — this keeps our UI tidy.
 */
export function shortCategoryName(fullName = '') {
  const [head, tail] = fullName.split(':')
  // If there is no colon the whole string is the label. If there is one, the text
  // after the colon is more specific, so prefer it.
  return (tail ?? head).trim()
}
