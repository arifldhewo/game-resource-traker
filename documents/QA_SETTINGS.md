# QA — Settings, Basket Eligibility, Tier Deltas

**Scope:** Settings page, shared catalog, starter/monthly-card stacking, Outlook tier deltas, PULLS badge, info sheets, responsive/zoom.
**Status:** manual checklist + automated unit tests.

---

## 0. Automated tests

Run the unit suite:

```sh
npm test
```

Covers:
- `tests/engine/basket.test.ts` — 12 pull-relevant catalog items, no non-pull items, starter defaults false, Monthly Card + Starter Monthly stacking for 180 days and 30 days, Starter HH decay against Monthly HH Pack for 180 days and 30 days.
- `tests/store/settings.test.ts` — `defaultSettings()` covers the catalog, disables every starter pack, and keeps catalog defaults for non-starter products.

The remaining tables in this document are manual UI checks and are not automated.

---

## 1. Settings page

Open `settings.html`.

| # | Check | Expected |
|---|---|---|
| 1.1 | Rows | 12 rows |
| 1.2 | Default ON | `monthly_card`, `hh_pack`, `op20`, `op6`, `op1` |
| 1.3 | Default OFF | `op40`, `op66`, `op130`, `starter_pack`, `starter_monthly`, `starter_sync`, `starter_hh` |
| 1.4 | Badges | Core items marked `CORE`; optional marked `OPTIONAL` |
| 1.5 | Values @100% OP | Monthly Card 11.8; Starter Monthly 14.8; Starter Sync 4; Starter Pack 1; Starter HH 20; OP20 6 |
| 1.6 | Toggle | Clicking a switch updates immediately and shows `SETTINGS SAVED · LOCAL` |
| 1.7 | Persistence | Reload page; toggle state must stay |
| 1.8 | Reset | `RESET TO DEFAULTS` returns 1.2/1.3 |
| 1.9 | Language | EN/ID switch translates headings, badges, limits, notes |
| 1.10 | Mobile | 390px: no horizontal scroll; toggle and stats remain visible |

Storage key: `fv3.settings`.

---

## 2. Stacking: Starter Monthly + Monthly Card

Rule: **Starter Monthly already contains 1 Monthly Card.** When both are selected, the starter replaces one card cycle; total card coverage must be capped at the forecast window.

Use the unit tests for exact math. Manual UI check:

| # | Steps | Expected |
|---|---|---|
| 2.1 | Enable `starter_monthly`; end date = today + 30 days; inspect DOLPHIN | Basket includes `STARTER MO`; **no** separate `MONTHLY CARD` line; one-time line 14.8 |
| 2.2 | Unit test `Monthly Card + Starter Monthly › 180d card + starter` | `cardCycles = 5`, `cardDays = 150`, `cardOP = 30`, total = 73.8 |
| 2.3 | Unit test `Monthly Card + Starter Monthly › 180d card only` | `cardCycles = 6`, total = 70.8 |
| 2.4 | Unit test `Monthly Card + Starter Monthly › 30d card + starter` | `cardCycles = 0`, total = 14.8 |
| 2.5 | Unit test `Starter HH vs Monthly HH Pack › 180d HH only` | Monthly HH only: 6 cycles, 135.6 pulls |
| 2.6 | Unit test `Starter HH vs Monthly HH Pack › 180d HH + Starter HH` | Starter HH replaces 2 cycles: 4 recurring cycles, 90.4 recurring pulls + 20 starter = 110.4 total |
| 2.7 | Unit test `Starter HH vs Monthly HH Pack › 30d HH + Starter HH` | Starter HH replaces the only cycle: 0 recurring cycles, 20 total pulls |

Acceptance: a 6-month window must never produce 7 card months (`7 × 11.8 = 82.6` pulls). With both selected, card contribution stays at 6 months (70.8), plus the 3 HH permits from the starter pack.

**HH trade-off note:** Monthly HH Pack also contains 42 OP. Starter HH only contains ten-rolls. Replacing 2 Monthly HH packs with 1 Starter HH saves money but removes 84 OP (25.2 pulls). The total therefore drops from 135.6 to 110.4. This is expected from the product-level substitution rule; it is not a regression.

Because of that trade-off, the optimizer may still skip Starter HH on a 180-day window even when the toggle is ON. The decay mechanic is verified when the item is in the basket; whether it wins is decided by total pulls under the cap. Starter HH is competitive on short windows (e.g. 30 days).

---

## 3. Forecast default regression

Use a fresh profile (no `fv3.state`, no `fv3.settings`) or reset both.

| # | Check | Expected |
|---|---|---|
| 3.1 | F2P total | 190 pulls |
| 3.2 | Benchmark | 212 |
| 3.3 | GOLDFISH basket | `HH PACK×1 · OP1×4` |
| 3.4 | WHALE basket | `CARD×1 · HH PACK×1 · OP20×31 · OP1×4` |

> Exact tier totals depend on today's date. Compare before/after on the same date.

---

## 4. PULLS mode badge

1. Step 01 → `TARGET PULLS` → set 600.
2. Open Step 03.

| Tier | Expected badge |
|---|---|
| F2P | DEFICIT |
| MINNOW | DEFICIT |
| GOLDFISH | DEFICIT |
| DOLPHIN | DEFICIT |
| WHALE | GUARANTEED |
| LEVIATHAN | GUARANTEED |

Matrix badge: `2 OF 6 REACH TARGET`.

Regression: a tier short of 600 must never show GUARANTEED.

---

## 5. Outlook tier delta

1. Step 04 → inspect `GOLDFISH`.
2. Compare with `MINNOW`.

| # | Check | Expected |
|---|---|---|
| 5.1 | Delta box | `Δ VS MINNOW` + total pulls + pulls/mo + $/mo |
| 5.2 | Changed rows | HH Pack and OP filler highlighted with positive badges |
| 5.3 | Removed row | Monthly Card shown struck-through with negative badge |
| 5.4 | F2P | `BASE TIER` box, no changed rows |

---

## 6. Bottom-sheet info

| Trigger | Expected title |
|---|---|
| Banner archetype info | `BANNER ARCHETYPE` |
| Inventory header info | `INCOME ASSUMPTIONS` |
| Leviathan panel info | `CUSTOM OP PACKS` |

No inline explanatory subtitles should remain under archetype, spark, potential, P(target), pity, income, or Leviathan.

---

## 7. Navigation & responsive

| # | Check | Expected |
|---|---|---|
| 7.1 | Nav links | `FORECAST`, `ROADMAP`, `SETTINGS` on all pages |
| 7.2 | Active nav | Current page highlighted |
| 7.3 | Desktop ≥1024px | 125% zoom, container ~920px, no horizontal scroll |
| 7.4 | Mobile 390px | Zoom 1, no horizontal scroll on forecast/settings |
| 7.5 | `docs/` | Mirrors `src/` (settings, catalog, store, i18n, forecast) |
| 7.6 | Mobile nav | At ≤760px the horizontal links collapse into `MENU ▾` |
| 7.7 | Nav dropdown | Tapping `MENU` opens FORECAST/ROADMAP/SETTINGS; current page highlighted; triangle flips |
| 7.8 | Nav close | Outside click, Escape, or link click closes it; no horizontal scroll at 320px |
| 7.9 | Desktop nav | At >760px the toggle is hidden and links stay inline |
