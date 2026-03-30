# Cartox

Cartox is a React + Vite geography arcade app with a retro map-inspired UI. It currently includes one playable game (`World Countries Sprint`) and a landing page scaffold for future games.

## What Changed

- Migrated from static HTML + Leaflet script to organized React feature modules.
- Added a landing page with game tiles and locked placeholders for future game modes.
- Implemented dynamic projection behavior in `maplibre-gl`:
  - the default home view starts at the minimum zoom as a globe,
  - low zoom stays on the globe,
  - higher zoom switches to rectangular Web Mercator,
  - desktop and mobile use slightly different transition thresholds.
- Replaced hard-coded label coordinates with generated label points using `@turf/point-on-feature`.
- Added guessed-only labels with zoom-aware scaling (`text-size` interpolated by zoom and country area bucket).
- Added animated country focus after a correct guess so the map slowly rotates / zooms toward the revealed country.
- Replaced static continent summaries with expandable continent cards that show guessed countries in alphabetical order.
- Added mobile-first responsive layouts for both the landing page and game page.

## Project Structure

```text
src/
  App.jsx
  main.jsx
  features/
    games/
      gameCatalog.js
    landing/
      LandingPage.jsx
    worldGame/
      gameUtils.js
      useWorldCountryGame.js
      WorldGamePage.jsx
      WorldMapView.jsx
  styles/
    global.css
```

## Core Architecture

- `src/App.jsx`
  - Selects between landing and active game view.
- `src/features/games/gameCatalog.js`
  - Single source for game tile metadata.
- `src/features/landing/LandingPage.jsx`
  - Retro-style landing experience and start buttons.
- `src/features/worldGame/useWorldCountryGame.js`
  - Main game state machine (load data, timer, guess flow, guessed-country grouping, map focus state).
- `src/features/worldGame/gameUtils.js`
  - Data normalization, alias matching, smart label point generation, and status projection.
- `src/features/worldGame/WorldMapView.jsx`
  - MapLibre map lifecycle, globe-first home view, guessed-label rendering, focus animation, responsive resize handling, and smoother projection switching.

## Data Notes

- Country data is loaded from `countries_final.geojson` at runtime.
- Labels are computed from geometry, not from `label_x` / `label_y` properties.
- Labels stay hidden until a country has been guessed.
- Country fill color is driven by status:
  - default,
  - guessed,
  - missed (after give-up).

## Run Locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Deploy on Render (Free Static Site)

This repo includes a Render Blueprint file at `render.yaml` configured for a static deploy.

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- SPA fallback rewrite: `/* -> /index.html`

The build also runs `scripts/copy-static.mjs` to copy `countries_final.geojson` into `dist` so the game data is available in production.

### Render setup

1. Push this repo to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Connect the repo and deploy.
4. On future pushes, Render auto-deploys using the same config.

## Next Extension Points

1. Add new game pages under `src/features/<gameName>/` and register them in `gameCatalog.js`.
2. Replace static game routing in `App.jsx` with `react-router-dom` when multiple playable games exist.
3. Add tests for `gameUtils.js` and `useWorldCountryGame.js` (normalization, alias matching, end-state behavior).




