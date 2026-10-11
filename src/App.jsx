/**
 * App — the top of the component tree.
 * ===========================================================================
 * ITS ONLY REAL JOB is deciding WHICH SCREEN TO SHOW. All the quiz rules live in
 * useTriviaGame, all the networking in api/opentdb.js, all the styling in
 * index.css. This file is the wiring diagram.
 *
 * THE FOUR PHASES (see PHASES in useTriviaGame.js)
 *   setup   → the options screen
 *   loading → waiting for the API (a request is genuinely in flight)
 *   playing → one question at a time
 *   results → the summary + review
 *
 * WHY NOT `if (loading) return <Spinner/>` EVERYWHERE?
 * Because one switch in one place is easier to reason about than four scattered
 * conditionals, and it makes the "happy path" obvious: setup → loading → playing
 * → results → setup…
 */

import { useEffect, useState } from 'react'

import { LoadingScreen } from './components/LoadingScreen.jsx'
import { ResultScreen } from './components/ResultScreen.jsx'
import { QuizScreen } from './components/QuizScreen.jsx'
import { SetupScreen } from './components/SetupScreen.jsx'
import { fetchCategories } from './api/opentdb.js'
import { FALLBACK_CATEGORIES } from './data/categories.js'
import { PHASES, useTriviaGame } from './hooks/useTriviaGame.js'
import { useTheme } from './hooks/useTheme.js'

/**
 * Describes the current options in one human-readable line, e.g.
 * "10 questions · Film · Hard · no repeats".
 *
 * We pass this string around instead of the raw settings object so components
 * that only want to *display* information do not need to understand the API's
 * parameter names.
 */
function describeSettings(settings) {
  const parts = [`${settings.amount} questions`]

  if (settings.type === 'boolean') parts.push('True / False')
  else if (settings.type === 'multiple') parts.push('Multiple choice')

  if (settings.difficulty) parts.push(settings.difficulty)
  if (settings.noRepeats) parts.push('no repeats')

  return parts.join(' · ')
}

function App() {
  const game = useTriviaGame()
  const { theme, toggleTheme } = useTheme()

  // Categories come from the API (/api_category.php) but we keep a bundled copy
  // for offline use. 'loading' is the initial value, so we never need to set it.
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [categoriesState, setCategoriesState] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    fetchCategories({ signal: controller.signal })
      .then((list) => {
        // Sort alphabetically by name: "Science: …" entries end up together and the
        // dropdown is much easier to scan.
        setCategories([...list].sort((a, b) => a.name.localeCompare(b.name)))
        setCategoriesState('ready')
      })
      .catch(() => {
        // The game still works without the live list — the bundled copy is used.
        setCategoriesState('fallback')
      })

    // Abort on unmount so we never set state on a component that is gone.
    return () => controller.abort()
  }, [])

  const settingsLabel = describeSettings(game.settings)

  return (
    <div className="app">
      {/* First thing in the tab order: lets keyboard users bypass the header.
          It becomes visible only while focused (see .skip-link). */}
      <a className="skip-link" href="#top">
        Skip to content
      </a>

      {/* Decorative background blobs. Purely CSS, hidden from screen readers. */}
      <div className="app__backdrop" aria-hidden="true">
        <span className="blob blob--one" />
        <span className="blob blob--two" />
        <span className="blob blob--three" />
      </div>

      <header className="app__header">
        {/* The single page-level heading; visual "TriviaQuest" titles on the
            screens below are h2s so the document outline stays correct. */}
        <h1 className="visually-hidden">TriviaQuest</h1>

        <a className="brand" href="#top">
          <span className="brand__mark" aria-hidden="true">
            🧠
          </span>
          <span className="brand__text">
            Trivia<span>Quest</span>
          </span>
        </a>

        <div className="app__header-actions">
          {game.phase === PHASES.RESULTS && (
            <span
              className="header-chip"
              aria-label={`Best score in this browser: ${game.stats.bestScore}`}
            >
              <span aria-hidden="true">🏅</span> Best {game.stats.bestScore}
            </span>
          )}

          <button
            type="button"
            className="icon-button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* tabIndex -1 makes the skip link land here instead of the top of the page. */}
      <main className="app__main" id="top" tabIndex={-1}>
        {/* ---------------- SETUP ---------------- */}
        {game.phase === PHASES.SETUP && (
          <SetupScreen
            settings={game.settings}
            categories={categories}
            categoriesState={categoriesState}
            stats={game.stats}
            error={game.error}
            onChange={game.updateSettings}
            onStart={() => game.startGame()}
            onReset={game.resetSettings}
            onDismissError={game.clearError}
          />
        )}

        {/* ---------------- LOADING ---------------- */}
        {game.phase === PHASES.LOADING && (
          <LoadingScreen amount={game.settings.amount} onCancel={game.goToSetup} />
        )}

        {/* ---------------- PLAYING ---------------- */}
        {game.phase === PHASES.PLAYING && game.question && (
          <QuizScreen
            question={game.question}
            answer={game.currentAnswer}
            currentIndex={game.currentIndex}
            total={game.total}
            score={game.score}
            streak={game.streak}
            correctCount={game.correctCount}
            settingsLabel={settingsLabel}
            onAnswer={game.submitAnswer}
            onNext={game.nextQuestion}
            onQuit={game.goToSetup}
          />
        )}

        {/* ---------------- RESULTS ---------------- */}
        {game.phase === PHASES.RESULTS && (
          <ResultScreen
            summary={game.summary}
            settingsLabel={settingsLabel}
            onPlayAgain={() => game.startGame({ reuseToken: true })}
            onChangeSettings={game.goToSetup}
          />
        )}
      </main>

      <footer className="app__footer">
        <span>
          Questions from{' '}
          <a href="https://opentdb.com" target="_blank" rel="noreferrer">
            Open Trivia DB
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <span>Built with React + Vite</span>
      </footer>
    </div>
  )
}

export default App
