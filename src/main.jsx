/**
 * Entry point — this is the file Vite loads in the browser (see index.html).
 * ---------------------------------------------------------------------------
 * `createRoot(...).render(...)` is React 18+ syntax. `createRoot` tells React to
 * take over the <div id="root"> element and manage its contents.
 *
 * WHY <StrictMode>?
 * In development only, it deliberately "double-renders" components and re-runs
 * effects, then logs anything that was not cleaned up properly. Think of it as a
 * spell-checker for common React mistakes — it makes bugs visible here instead of
 * in production. It costs nothing at runtime because React skips it in builds.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import './index.css' // global stylesheet: imported here so it applies app-wide

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
