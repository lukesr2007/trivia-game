# TriviaQuest

A quiz app built with **React + Vite** that fetches live questions from the free
[Open Trivia DB](https://opentdb.com) API — over 1.5 million questions in 24
categories.

It is written as a learning project: almost every non-obvious decision is
commented in the place it happens, with the _why_ next to the _what_.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
npm run lint     # eslint
```

---

## 1. What the app does

| Screen      | What happens                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**   | Pick how many questions, the category, difficulty, question style, "no repeats" and the response encoding. Lifetime stats from previous rounds are shown here. |
| **Loading** | Skeleton cards while the request is in flight, with a cancel button.                                                                                           |
| **Quiz**    | One question at a time, 20-second countdown ring, shuffled answers, immediate feedback with the correct answer revealed, score + streak, keyboard shortcuts.   |
| **Results** | Score ring, headline, stats (correct / wrong / accuracy / average time) and a full answer review that can be filtered to the questions you missed.             |

Other things worth knowing about:

- **Progress is saved.** Quiz options, lifetime stats and the no-repeat session
  token live in `localStorage`, so they survive a refresh.
- **Light and dark themes**, following the OS preference until you choose.
- **Works without a network** for the category list (a copy is bundled) and
  shows a friendly, _actionable_ error when a request really does fail.

---

## 2. The API, endpoint by endpoint

All network code lives in **`src/api/opentdb.js`**. Nothing else in the app calls
`fetch`. That rule keeps one place to fix a bug or add a parameter.

### 2.1 Questions — `api.php`

```
https://opentdb.com/api.php?amount=10&category=11&difficulty=hard&type=multiple
```

| Parameter    | Values                          | Notes                                              |
| ------------ | ------------------------------- | -------------------------------------------------- |
| `amount`     | `1`–`50`                        | More than 50 is rejected.                          |
| `category`   | `9`–`32`                        | Omit for "any category".                           |
| `difficulty` | `easy` / `medium` / `hard`      | Omit for "any".                                    |
| `type`       | `multiple` / `boolean`          | `boolean` = True/False (always exactly 2 options). |
| `encode`     | _(omit)_ / `url3986` / `base64` | See §2.3 — **`default` is not a valid value**.     |
| `token`      | a session token                 | See §2.2.                                          |

Response:

```jsonc
{
  "response_code": 0,
  "results": [
    {
      "category": "Entertainment: Film",
      "type": "multiple",
      "difficulty": "hard",
      "question": "Who directed the film &quot;Alien&quot;?",
      "correct_answer": "Ridley Scott",
      "incorrect_answers": ["George Lucas", "James Cameron", "Stanley Kubrick"],
    },
  ],
}
```

**`response_code` is the real status of the request.** A failing request still
returns HTTP 200, so checking `response.ok` is not enough:

| Code | Meaning                         | How the app reacts                                                 |
| ---- | ------------------------------- | ------------------------------------------------------------------ |
| `0`  | Success                         | Questions are shown.                                               |
| `1`  | No results for that combination | Explains it and offers **Change options** (retrying is pointless). |
| `2`  | Invalid parameter               | Same treatment.                                                    |
| `3`  | Token not found (expired)       | Resets the session and retries once, automatically.                |
| `4`  | Token empty                     | See §2.2 — the interesting one.                                    |

### 2.2 Session tokens — the "no repeats" feature

```
GET api_token.php?command=request        → { "token": "5aaca4…" }
GET api_token.php?command=reset&token=…  → puts those questions back
GET api.php?amount=10&token=5aaca4…     → never repeats what that token has seen
```

A token is a bucket that remembers which questions have already been handed out.
This is what makes "no repeats" possible at all.

**The subtlety worth internalising:** code `4` ("token empty") has **two**
completely different causes, and the app distinguishes them:

- The session has genuinely been used up → reset it and carry on (the app does
  this automatically, once).
- The filters are simply too narrow. Verified against the live API: asking for
  `category=30&difficulty=hard&type=boolean` returns **`response_code: 1`
  without a token, but `response_code: 4` with one**, because from the token's
  point of view it can no longer produce enough unseen questions.

Without that distinction the app would reset, retry, get `4` again and loop
forever. It now explains the real problem and suggests widening the filters.

**Why the token is stored in `localStorage`:** the free API allows roughly one
request every 5 seconds per IP. Requesting a new token at the start of every
round means two back-to-back requests (token + questions), which trips that
limit. Reusing one token keeps a round down to a single request.

### 2.3 Encodings — `encode`

The same question can arrive three different ways, and the _decoded text is
always identical_:

| `encode`    | Wire format                                   | Decoded with                                   |
| ----------- | --------------------------------------------- | ---------------------------------------------- |
| _(omitted)_ | `In &quot;Friends&quot;, Monica&#039;s job?`  | a detached `<textarea>` (`decodeHtmlEntities`) |
| `url3986`   | `In%20%22Friends%22%2C%20Monica%27s%20job%3F` | `decodeURIComponent`                           |
| `base64`    | `SW4gIkZyZW5kcyIsIE1vbmljYVxDKXM=`            | `atob` + `TextDecoder`                         |

Two details that matter:

- `decodeURIComponent` is what handles percent-encoding. `atob` alone mangles
  non-English characters (é, ñ …) because it returns _bytes_, not text —
  `TextDecoder` converts those bytes back into UTF-8 characters.
- **Sending `encode=default` fails** with `response_code: 2`. You get the default
  encoding by leaving the parameter out, so `fetchQuestions` sends `''` and the
  query builder drops empty values. This was a real bug, found by end-to-end
  testing against the live API.

### 2.4 Categories — `api_category.php`

Returns the 24 categories with their ids. The app sorts them alphabetically and
falls back to the copy in `src/data/categories.js` if the request fails (so the
dropdown is never empty, even offline).

### 2.5 Rate limits and reliability

`requestJson` in `src/api/opentdb.js` adds everything a real app needs around a
`fetch`:

- a 12-second timeout via `AbortController`;
- cancellation support, so quitting mid-request cannot update a dead screen;
- one automatic retry after ~5.5 s if the body comes back empty (how a
  rate-limited server usually replies);
- a single error type, `TriviaApiError`, carrying `code`, `recoverable` and the
  original `cause` — so the UI can choose the right button.

---

## 3. Project structure

```
src/
├─ api/
│  └─ opentdb.js            # every network call + TriviaApiError
├─ components/
│  ├─ SetupScreen.jsx       # options form — mirrors the API parameters
│  ├─ QuizScreen.jsx        # timer host + keyboard shortcuts
│  ├─ QuestionCard.jsx      # question + answers + feedback panel
│  ├─ AnswerOption.jsx      # one answer button and its states
│  ├─ TimerBar.jsx          # SVG countdown ring
│  ├─ ResultScreen.jsx      # score ring + review list
│  ├─ LoadingScreen.jsx     # skeleton placeholders
│  ├─ ErrorNotice.jsx       # turns error codes into advice
│  └─ Primitives.jsx        # Badge / Stat / ProgressBar
├─ data/
│  └─ categories.js         # fallback list + short category names
├─ hooks/
│  ├─ useTriviaGame.js      # the state machine (useReducer)
│  ├─ useCountdown.js       # the 1-second clock
│  ├─ useLocalStorage.js    # state that survives a refresh
│  └─ useTheme.js           # light / dark
├─ utils/
│  ├─ text.js               # entity/base64 decoding, shuffle, query strings
│  └─ questions.js          # shuffling answers, scoring, result headlines
├─ App.jsx                  # decides which screen to render
├─ main.jsx                 # entry point
└─ index.css                # the whole design system
```

### 3.1 Why a reducer for the game state

The quiz has several values that change **together** — phase, questions, current
index, answers, score, streak. `useReducer` keeps them in one object and
describes every change as an action, so:

- all the rules live in one readable function;
- one `dispatch` updates several values atomically (React batches them into a
  single re-render — no half-updated screen);
- adding behaviour means adding a `case`, not another setter.

The reducer is **pure**: no `fetch`, no `localStorage`, no `Date.now()`. Side
effects (saving stats, calling the API) live in the event handlers that dispatch
the actions. That is why finishing a round records the stats in `nextQuestion`
rather than in an effect watching for the results screen.

```text
setup ──start──▶ loading ──loaded──▶ playing ──next (last)──▶ results
  ▲                  │                   │                       │
  └──── quit ────────┴──── error ────────┴──── play again ────────┘
```

### 3.2 Three React lessons the code takes seriously

**1. Reset state with `key`, not with an effect.** The countdown must restart at
20 s on every question. Instead of an effect that calls `setState` (which the
React team's own lint rules now flag as a bug), `TimerBar` is given
`key={currentIndex}`:

```jsx
<TimerBar key={currentIndex} … />
```

A different key means React throws the old instance away and mounts a fresh one,
whose `useState(20)` starts over. Resetting state is what `key` is for.

**2. Interval callbacks need a refresh function.**

```js
setSecondsLeft((previous) => previous - 1) // ✅ always the latest value
setSecondsLeft(secondsLeft - 1) // ❌ frozen at the value from when
//    the interval was created
```

Every `setInterval` in the app also returns a cleanup function
(`clearInterval`), otherwise each re-render would stack another clock.

**3. Refs are for values that must not trigger a render.** The keyboard listener
needs the current answer list, but re-subscribing on every tick would be waste.
So the handler lives in a ref, refreshed inside an effect — never during render,
and never as state.

### 3.3 Styling: one stylesheet, built from tokens

`src/index.css` is organised in layers (tokens → reset → layout → utilities →
primitives → screens → motion → responsive).

Every colour is a variable (`--surface`, `--brand-500`, `--danger`…), so the
light and dark themes are two small blocks of overrides and no component ever
mentions a hex code. Switching themes is one attribute:
`document.documentElement.dataset.theme = 'dark'`.

Small details that cost little and show up as quality: focus-visible outlines
for keyboard users, `aria-live` for the answer feedback, `role="progressbar"` /
`role="timer"` on the two meters, `prefers-reduced-motion` support, and a fluid
layout down to 380 px.

---

## 4. Accessibility & keyboard

| Key               | Action                  |
| ----------------- | ----------------------- |
| `1`–`9`, `A`–`F`  | pick that answer        |
| `Enter` / `Space` | go to the next question |

- Answers are real `<button>`s inside a `role="radiogroup"`, so tab order and
  screen readers behave correctly.
- Feedback appears in an `aria-live="polite"` region.
- The option pills on the setup screen are real radio inputs, hidden with CSS but
  still keyboard-operable.
- Motion is reduced when the OS asks for it.

---

## 5. Things that would come next

- An **error boundary**, so a render crash shows a friendly message instead of a
  blank page.
- **Question of the day** (same seed for everyone) — the API has no date-based
  endpoint, so it would need a deterministic shuffle on the client.
- **TypeScript**, and unit tests for the reducer and the decoders — both are
  already set up for it, since all the tricky logic is isolated in pure
  functions.
- Caching questions in `localStorage` so a round can start offline.
#   t r i v i a - g a m e  
 #   t r i v i a - g a m e  
 