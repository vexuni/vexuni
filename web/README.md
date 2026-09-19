# vexuni web

The vexuni web interface — a React + TypeScript + Vite single-page app.

## Layout

```
src/
  main.tsx            entry: providers (theme, i18n, auth) + router
  App.tsx             route table
  styles.css          design tokens + all component styles
  lib/
    api.ts            typed fetch wrapper over /api
    types.ts          API response contracts
    hooks.ts          useApi() data fetching
    auth.tsx          session state (/api/bootstrap, /api/me)
    i18n.tsx          zh-CN / en dictionaries + useT()
    theme.tsx         light / dark / auto theme
    format.ts         dates, bytes, shas
  components/
    layout.tsx        sidebar shell, topbar, tabs, wordmark
    ui.tsx            Spinner, Empty, ErrorBox, Pill, Modal, Field…
    icons.tsx         stroke SVG icon set (no emoji, no icon fonts)
    markdown.tsx      markdown-it render (html: false, safe protocols)
    code.tsx          highlight.js source view + diff view
  pages/              one file per surface; repo/ holds the project tabs
```

## Develop

```sh
npm install
npm run dev        # http://localhost:5173, /api proxied to :8787
```

Start the backend with `npm run dev:worker` in the repository root
(wrangler dev on port 8787).

## Build

```sh
npm run build      # emits ../public/app.js, ../public/style.css, index.html
```

The Worker serves a fixed allowlist of asset paths and falls back to
`/index.html` for every other GET, so the build intentionally emits stable
filenames instead of content-hashed bundles. `npm run source` at the root
stamps `?v=` content hashes onto the entry HTML.

## Constraints

- The deployment CSP is `script-src 'self'; style-src 'self'` — no inline
  styles or scripts; all styling lives in `styles.css`.
- `connect-src 'self'` — the app talks only to same-origin `/api`.
- `img-src 'self' data:` — avatars are initials, not remote images.
- No emoji; icons are the local stroke set in `components/icons.tsx`.
