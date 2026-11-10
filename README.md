# PRTS Forecast

Standalone Arknights gacha forecast. No backend, no build step.

## Structure

```
src/        # source of truth (landing, forecast, roadmap, i18n, CNAME)
docs/       # mirror of src/ for GitHub Pages (Pages only supports / or /docs)
proto/      # original prototypes & reference
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings → Pages → Source**: "Deploy from a branch".
3. Branch: `main`, folder: **`/docs`** (GitHub Pages does not support arbitrary folders like /src).
4. Save. Site live at `https://<user>.github.io/<repo>/` (or custom domain).

> Keep `docs/` in sync with `src/` before pushing (e.g. `cp -r src/* docs/`).

## Local preview

```bash
cd src && python3 -m http.server 8080
# open http://localhost:8080
```

> Open via HTTP server, not `file://`, so relative `forecast-i18n.js` loads and localStorage works.

## i18n

Top-bar toggle switches EN/ID UI; bottom-sheet explanations have their own EN/ID toggle. Choice persisted in `localStorage`.
