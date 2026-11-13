# Checkup Report — PRTS Forecast

**Mode:** `/design checkup`
**Date:** 2026-11-13
**Scope:** `src/index.html`, `src/forecast.html`, `src/roadmap.html`, `src/settings.html`, `src/nav.css`, `src/nav.js`
**Score:** 40 / 60
**Verdict:** **Block**

---

## TL;DR

The visual system is authored and coherent: PRTS terminal type, color, tier matrix, mobile nav, and settings all belong to the same product. Mouse and touch users can complete the core forecast and settings flows.

It is not shippable for keyboard and screen-reader users yet. The info modal opens without moving or trapping focus, the OP conversion slider has no accessible name, several focus indicators are suppressed, and multiple mobile controls are below the 44×44 touch minimum.

**Primary recommendation:** run `/design a11y` first, then `/design responsive`, then `/design typeset` for the settings metadata.

---

## Heuristic Scores

| # | Vital | Score | Status | Key finding |
|---|---|---|---:|---|
| 1 | Intentionality | 10/10 | Healthy | Authored PRTS military-terminal system; consistent tokens across four pages. |
| 2 | Readability | 5/10 | Watch | Desktop 125% zoom and contrast are good; settings metadata is 8px on mobile. |
| 3 | Usability | 10/10 | Healthy | Forecast flow, settings toggles, reset, and mobile nav work. |
| 4 | Responsiveness | 5/10 | Watch | 320px reflows without overflow; inputs are below 16px and safe areas are not handled. |
| 5 | Speed | 10/10 | Healthy | Static pages, no images/framework; forecast compute is debounced 300ms. |
| 6 | Accessibility | 0/10 | Critical | Modal focus is unmanaged, slider is unnamed, touch targets are undersized. |

**Total: 40 / 60**

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | **HIGH** | Accessibility | `src/forecast.html:2041` (`openModal`), `:2048` (`closeModal`) | `openModal` only adds `.show`. Focus stays on the trigger; Tab moves to a background button; overlay is neither `inert` nor `aria-hidden`. | On open, move focus to the modal heading/close button; set the page shell, topbar, and footer `inert`; trap Tab; on close restore focus to the trigger. | Keyboard and screen-reader users can miss the dialog or operate background controls. |
| 2 | **HIGH** | Accessibility | `src/forecast.html:746` (label), `:748` (`#fOPPct`) | The label has no `for`; the range has no `aria-label` or `title`; `labels.length === 0`. | Add `for="fOPPct"` to the label, or `aria-label="OP conversion percentage"` to the slider. | The control is announced as an unnamed slider. |
| 3 | MEDIUM | Accessibility | `src/forecast.html:372` | `.info-trigger:focus-visible { outline: none }`; focus only changes the icon color from `#7D858C` to `#E4A93C`. Computed outline is `none 3px`. | Add a 2px accent outline with 2px offset, or a `box-shadow: 0 0 0 2px` ring. Keep the color change as secondary. | The 15px icon's focus state is too subtle for keyboard users. |
| 4 | MEDIUM | Responsiveness | `src/forecast.html:510–511` (overrides), `:180`, `:183` | At 390px, `input` is 14.5px and `select` is 13px. | At ≤640px, set `font-size: 16px` on `.control input` and `select.control` (and any other form control). | iOS Safari auto-zooms focused controls below 16px, breaking the viewport. |
| 5 | MEDIUM | Accessibility | `src/forecast.html:371`, `:357`, `:73`; `src/settings.html:89`, `:57`; `src/nav.css:2` | Info trigger 15×15, modal close 26×26, settings switch 38×20, language buttons 30–32×24–26, nav toggle 67×26. | Expand hit areas to at least 44×44 with padding or a pseudo-element; keep the visual size. | Mobile mis-taps; 15px info icons are effectively unhittable. |
| 6 | MEDIUM | Accessibility | `src/settings.html:184`, `src/settings.js:87` | `#toast` has no `role` or `aria-live`; save/reset feedback is visual only. | Add `role="status"` and `aria-live="polite"`; update the text after save/reset. | Screen-reader users do not hear confirmation. |
| 7 | MEDIUM | Readability | `src/settings.html:80`, `:86` | `.pcat`, `.ptag`, and `.pstat span` are 8px at 390px. | Raise to 9.5–10px with a mobile override; keep desktop scaling unchanged. | Category, limit, and pulls/$ metadata are hard to read on a phone. |
| 8 | LOW | Accessibility | `src/forecast.html:605` | The page has zero `<h1>`; the step title is `<h2>` (6 h2 total). | Add a visually hidden `<h1>PRTS Forecast</h1>`, or make the active step title the page h1. | Heading navigation lacks a page-level anchor. |
| 9 | LOW | Responsiveness | `src/forecast.html:5` (and all pages) | Viewport meta lacks `viewport-fit=cover`; CSS has no `env(safe-area-inset-*)`. | Add `viewport-fit=cover` and safe-area padding on topbar, flowbar, and sheet. | Notched devices in landscape can clip sticky UI. |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `src/forecast.html:547–549` | Desktop `body { zoom: 1.25 }` as a scaling problem | Intentional 125% desktop scale. Tested at 1024/1440 with no horizontal overflow. |
| `src/*.html` head | Google Fonts as a speed risk | Preconnect + preload are present; fallback stacks exist; no visible block observed locally. |
| `src/forecast.html` tier delta | Yellow delta reading as color-only | Every changed row also carries a numeric delta badge and text; removed rows are struck through. |
| `src/settings.js` toggles | Auto-save without a confirm step | Toggles are reversible; reset is available; no destructive action. |
| `src/settings.html` motion | No `prefers-reduced-motion` rule | Only 160–200ms functional toggle/toast transitions; no decorative or vestibular motion. |

---

## Verification

### Checks run

- Served `src/` on `http://127.0.0.1:8099` and inspected with headless Chrome.
- Width gauntlet at 320, 390, 640, 768, 1024, 1440: `scrollWidth === innerWidth` at every step; nav toggle visible ≤760; desktop nav inline at 768+; `body` zoom 1.25 at 1024/1440.
- Measured form controls at 390: text/number inputs 14.5px, selects 13px.
- `#fOPPct` accessibility query: `labels.length = 0`, `aria-label = null`, `title = null`.
- Opened the info modal from a keyboard-focused trigger: active element remained the trigger (`inModal: false`); after Tab, focus landed on a background button (`inModal: false`); overlay was not inert.
- Computed focus styles: info trigger `outline: none 3px`; step and nav toggle `outline: auto 1px`.
- Settings at 390: 0 inputs; metadata 8px; toast has no role/live attributes; switch 38×20.
- Mobile nav at 320/390: toggle opens a 180px menu fully inside the viewport; `aria-expanded` flips correctly; outside click closes.
- Contrast: `muted-2` 5.29, `muted` 5.91, accent 9.11, F2P 5.03, GOLDFISH 5.42, DOLPHIN 6.98, LEVIATHAN 5.80, success 7.63, danger 5.12, amber 7.41. All pass AA for normal text.
- `qa/forecast-qa.js`: 25/25 PASS.

### Not verified

- Real iOS Safari auto-zoom behavior; the finding is based on computed font sizes, not a device run.
- A real screen-reader pass (NVDA/VoiceOver) was not performed.
- 200% text zoom was not simulated separately; 320px and 640px reflow passed.
- Performance under throttled network conditions was not profiled.

---

## What's Working

- **Authored visual system.** PRTS terminal vocabulary, token set, typography, and tier colors are consistent across landing, forecast, roadmap, and settings.
- **Forecast composition.** The stepper, tier matrix, and outlook fit the configure/compare job; the core default regression is stable (F2P 190, benchmark 212).
- **Mobile nav.** The `MENU ▾` dropdown removes horizontal crowding at 320px and keeps the current page highlighted.
- **Contrast.** Every tested token pair passes AA; the yellow delta treatment is backed by numbers and text, not hue alone.

---

## Next

1. `/design a11y` — modal focus, slider name, focus rings, touch targets, toast live region, h1.
2. `/design responsive` — 16px mobile form controls, safe-area insets.
3. `/design typeset` — settings metadata scale on mobile.

Report-only mode: no interface changes were applied in this pass.
