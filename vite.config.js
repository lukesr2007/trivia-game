import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The inline script in index.html applies the saved theme before first paint
// (to avoid a flash). A strict CSP has to name it explicitly, so we whitelist it
// by SHA-256 hash. If that inline script is ever edited, recompute this value:
//   node -e "const c=require('crypto'),f=require('fs');const h=f.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1]).digest('base64'))"
const THEME_SCRIPT_HASH = 'sha256-DOVuIz6SieDcZfDohGcvvpY4yOnqjHFas5wt59XU7z0='

// Headers that are not specific to the dev server or the preview server.
const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}

/**
 * Content Security Policy. Two flavours:
 *  - dev   → Vite injects inline scripts and talks to its HMR websocket, so it
 *            needs 'unsafe-inline' and `ws:`.
 *  - prod  → only same-origin scripts plus the hashed theme script may run, and
 *            network access is limited to Open Trivia DB.
 * Note: real hosting should send these same headers (see README) — a static
 * server would not use this config.
 */
function contentSecurityPolicy({ dev }) {
  return [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline'" : `script-src 'self' '${THEME_SCRIPT_HASH}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    dev
      ? "connect-src 'self' ws: http: https://opentdb.com"
      : "connect-src 'self' https://opentdb.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: { ...baseHeaders, 'Content-Security-Policy': contentSecurityPolicy({ dev: true }) },
  },
  preview: {
    headers: { ...baseHeaders, 'Content-Security-Policy': contentSecurityPolicy({ dev: false }) },
  },
})
