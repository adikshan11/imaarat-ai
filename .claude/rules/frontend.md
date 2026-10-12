---
description: Rules for the React frontend and the public site
paths:
  - "frontend/**"
applyTo: "frontend/**"
---

# Frontend

- React 19 function components with TypeScript. Plain CSS in `frontend/src/App.css`, `frontend/src/index.css` and `frontend/src/landing/landing.css`; no component kit, CSS-in-JS or animation library.
- Every visible string goes through i18n. Add the key to `frontend/src/i18n/locales/en.json` and to all other locale files with the same `{placeholders}`; `npm run check:locales` must pass.
- Layouts must work in right-to-left locales; prefer logical properties (`inset-inline-start`, `margin-inline`) over left and right.
- Keep the existing `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` and `forced-colors` fallbacks working for anything new.
- New visual behaviour gets a check in `frontend/scripts/navigation_browser.mjs` (run by `npm run test:browser`) or a node test, measured across the viewports and locales the script already covers.
- No new dependency without a clear need; check its size and that it is maintained. `npm run check:deprecated` must pass.
- Effects must not cost the page: animate only `transform` and `opacity`, stop work when the element is off screen or the tab is hidden, and keep Lighthouse scores where they are.
