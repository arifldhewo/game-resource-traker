# PRTS Forecast

Arknights gacha forecast: project, per spending tier, whether you reach your target potential before the banner deadline. Static Next.js app, no backend, no database.

## Stack

- **Next.js 15** App Router with static export (`output: "export"`)
- **TypeScript** + **Tailwind CSS v4**
- **zustand** for client state (localStorage keys preserved from the legacy site)
- **Radix UI** primitives for the dialog/bottom sheet, switches, and slider
- **Vitest** for engine parity tests

## Structure

```
src/
  app/            # routes: /, /forecast, /roadmap, /settings
  components/     # layout, UI primitives, forecast wizard
  lib/engine/     # pure TS: pity DP, basket optimizer, calendar, certs
  lib/store/      # forecast, settings, and language stores
  types/          # domain types
data/             # hardcoded JSON: products, archetypes, tiers, i18n
public/           # CNAME, robots.txt, sitemap.xml, assets
tests/engine/     # Vitest parity checks
scripts/          # version bump/check helpers
legacy/           # previous static site (reference until cutover)
proto/            # original design prototypes
```

## Scripts

```bash
npm run dev        # local development
npm run build      # static export to out/
npm run lint       # ESLint
npm test           # Vitest engine tests
npm run bump -- patch --note "Change"
npm run check      # version + changelog check
```

## Data

There is no database. Product catalog, banner archetypes, spending tiers, and the EN/ID dictionaries live in `data/*.json` and are typed through `src/types`. Engine constants (pull cost, OP rate, cert ladder, pity curve) stay in code because they are logic, not content.

## Deploy

GitHub Pages via Actions (`.github/workflows/deploy.yml`): pushing a `v*` tag (or publishing a GitHub Release with a new tag) installs dependencies, verifies the tag matches `package.json`, runs tests, builds the static export, and publishes `out/`. Pushes to `master` do not deploy. `public/CNAME` keeps the custom domain.

### Release

Run `npm run bump -- <patch|minor|major> --note "What changed"`. It updates `package.json` and `CHANGELOG.md` and prints the exact commit, tag, and push commands. Only the final tag push triggers the deploy; a tag that does not match the `package.json` version fails before the build.

The previous site is kept in `legacy/` on the migration branch for visual/reference parity and is removed at cutover.

## i18n

Two independent channels: UI language and explanation language (EN/ID, including mixed profiles). Choices persist in `localStorage` as `fv3.uiLang` and `fv3.explainLang`; forecast state uses `fv3.state` and pack toggles use `fv3.settings`.
