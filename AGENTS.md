# HouseOps

Shared household chore calendar PWA (Slovenian language) built with Vite + React + TypeScript.

## Cursor Cloud specific instructions

- **Package manager:** npm (`package-lock.json`). Run `npm install` to install dependencies.
- **Dev server:** `npm run dev` starts Vite on port 5173.
- **Lint:** `npm run lint` (ESLint with `eslint.config.js`).
- **Typecheck + Build:** `npm run build` runs `tsc -b && vite build`.
- **Firebase:** The app uses Firebase Realtime Database for sync but falls back to `localStorage` when Firebase env vars are absent. For local development without Firebase, the app works out of the box — no `.env.local` needed.
- **Env vars:** Copy `.env.example` to `.env.local` and fill in Firebase config only when testing Firebase sync features. Without it, the app uses localStorage fallback mode.
- **Playwright** is listed as a dev dependency but there are no test scripts configured.
