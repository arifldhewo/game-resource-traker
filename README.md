# PRTS Forecast

Standalone Arknights gacha forecast. No backend, no build step.

## Structure

```
src/
  index.html          # landing page
  forecast.html       # the calculator (pahe build)
  roadmap.html        # product roadmap
  forecast-i18n.js    # i18n dictionary (EN/ID) + applyI18n()
  CNAME               # custom domain for GitHub Pages
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings → Pages → Source**: "Deploy from a branch".
3. Branch: `main`, folder: `/src`.
4. Save. Site live at `https://<user>.github.io/<repo>/` (or custom domain).

## Local preview

```bash
cd src && python3 -m http.server 8080
# open http://localhost:8080
```

> Open via HTTP server, not `file://`, so relative `forecast-i18n.js` loads and localStorage works.

## i18n

Top-bar toggle switches EN/ID UI; bottom-sheet explanations have their own EN/ID toggle. Choice persisted in `localStorage`.
