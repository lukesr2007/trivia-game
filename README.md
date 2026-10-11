<div align="center">

# TriviaQuest

A small, polished quiz app built with **React + Vite**, powered by live questions from the free [Open Trivia DB](https://opentdb.com) — 1.5M+ questions across 24 categories.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![ESLint](https://img.shields.io/badge/ESLint-jsx--a11y-4B32C3?logo=eslint&logoColor=white)](https://eslint.org)
[![Prettier](https://img.shields.io/badge/Prettier-formatted-F7B93E?logo=prettier&logoColor=white)](https://prettier.io)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#license)

</div>

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Build and serve the production bundle:

```bash
npm run build
npm run preview
```

> The Open Trivia DB free tier allows roughly **one request every 5 seconds per IP**. The app reuses a saved session token so a round needs only a single request.

---

## Features

- **Setup screen** — question count, category, difficulty, True/False or multiple choice, "no repeats", and response encoding.
- **Timed quiz** — 20 s countdown ring, shuffled answers, instant feedback and score/streak.
- **Results** — score ring, accuracy and average time, plus a review list you can filter to misses.
- **Persisted across refreshes** — settings, lifetime stats and the no-repeat token live in `localStorage`.
- **Light & dark themes** — follows the OS until you pick.
- **Works offline for categories** — a bundled list is used if the API is unreachable, with actionable error messages when a request really fails.
- **Keyboard-first** — `1–9` / `A–F` to answer, `Enter` / `Space` for the next question, arrow keys to move the answer group.

---

## Scripts

| Command                | What it does                                 |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                    |
| `npm run build`        | Production build into `dist/`                |
| `npm run preview`      | Serve the built app locally                  |
| `npm run lint`         | ESLint (includes `eslint-plugin-jsx-a11y`)   |
| `npm run format`       | Format everything with Prettier              |
| `npm run format:check` | Verify formatting without writing            |
| `npm run audit`        | Check dependencies for known vulnerabilities |

---

## Project structure

```
src/
├─ api/opentdb.js         # every network call + TriviaApiError
├─ components/            # Setup, Quiz, QuestionCard, AnswerOption, Timer, Results, …
├─ data/categories.js     # offline fallback list + short names
├─ hooks/                 # useTriviaGame (reducer), useCountdown, useLocalStorage, useTheme
├─ utils/                 # helpers (decoding, shuffle, query strings) + questions (scoring)
├─ App.jsx                # picks the screen to render
├─ main.jsx               # entry point
└─ index.css              # the whole design system (CSS variables)
```

### How it fits together

- **One API layer.** All networking lives in `src/api/opentdb.js`; nothing else calls `fetch`.
- **A reducer for the game.** Phase, questions, answers, score and streak change together, so they live in one `useReducer` with a pure reducer and side effects in event handlers.
- **Design tokens.** Every colour in `index.css` is a variable, so the two themes are just small blocks of overrides.

---

## Accessibility & security

- Real `<button>`s in a `role="radiogroup"` (roving tabindex + arrow keys), an `aria-live` feedback region, a skip link, a single `<h1>`, and `prefers-reduced-motion` support.
- Colour tokens are checked to meet **WCAG AA** contrast on their backgrounds.
- `decodeHtmlEntities` uses the [`he`](https://github.com/mathiasbynens/he) library, so untrusted API text is decoded to a plain string and never handed to an HTML parser.
- `vite.config.js` sets a **Content-Security-Policy** and hardening headers (dev and preview). Deployments should send the same headers at the host/CDN.

---

## Tech stack

React 19 · Vite 8 · plain CSS (design tokens) · ESLint + Prettier · `he`

---

## License

MIT
