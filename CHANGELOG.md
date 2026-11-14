# Changelog

All notable changes to PRTS Forecast are documented here.
Versions follow semver and every push to `master` gets a version bump and a tag.

## [Unreleased]

## [0.4.3] - 2026-11-14

### Changed

- Use package.json version as the single source of truth; remove version.json.

## [0.4.2] - 2026-11-14

### Changed

- Add `version.json` as the single source of truth for the app version.
- Inject the footer version through `src/version.js` and `[data-app-version]`; remove hardcoded version labels.
- Add `scripts/bump-version.mjs`, `scripts/sync-docs.mjs`, and `scripts/check-version.mjs`.
- Add `package.json` scripts for `bump`, `sync`, and `check`.

## [0.4.1] - 2026-11-14

### Changed

- Rename Yellow Cert shop terminology from `TIER 0-5` to `PHASE 0-5` in EN and ID.
- Update breakdown metadata, certs tooltip, and spec docs to phase terminology.
- Show `v0.4.1` in the footer of all pages.

## [0.4.0] - 2026-11-14

### Added

- Mobile navigation dropdown with `MENU` toggle and 44px touch targets.
- Shared responsive input sizing for touch devices.

### Fixed

- Modal focus trap, background inert state, focus restore, and skip links.
- Missing accessible names, focus rings, live regions, and small hit areas.
- iOS Safari input zoom on narrow screens and safe-area handling.

### Changed

- Responsive pass verified from 320px through 2560px and landscape.
- Shared type layer with balanced headings, pretty paragraphs, and tabular numerals.
- Unify body type at 15px/1.55 and raise small labels to 10px.

## [0.3.0] - 2026-11-14

### Added

- Product-level decay for recurring HH packs when Starter HH is selected.
- Starter Monthly replaces a Monthly Card cycle instead of stacking an extra month.

## [0.2.1] - 2026-11-14

### Fixed

- Cap Monthly Card coverage to the forecast window when Starter Monthly is selected.

## [0.2.0] - 2026-11-14

### Added

- Settings page for pull-relevant pack toggles with localStorage persistence.
- Outlook tier delta highlights.

### Fixed

- PULLS badge now requires a cleared target before reporting guaranteed.

## [0.1.1] - 2026-11-14

### Changed

- 125% desktop scale and wider shell.
- Remove redundant OP conversion notes.

## [0.1.0] - 2026-11-14

### Added

- Inter, Rajdhani, and JetBrains Mono type system.
- Readability scale and 300ms render debounce.
- Crossover 10-pull ticket.
- Pity calculation formula in the info sheet.

### Changed

- Rename shop headhunt terms and hide Current Pity for isolated banners.
- Remove the Outlook `TIERS CLEARING` stat.
