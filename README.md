# PRTS Forecast — Pahe (Paket Hemat)

Standalone, single-page Arknights gacha forecast. No backend, no build step.

## Files

- `docs/index.html` — the app (pahe build)
- `docs/forecast-i18n.js` — i18n dictionary (EN/ID) + `applyI18n()`

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings → Pages → Source**: "Deploy from a branch".
3. Branch: `main`, folder: `/docs`.
4. Save. Site will be live at `https://<user>.github.io/<repo>/`.

## Local preview

```bash
cd docs && python3 -m http.server 8080
# open http://localhost:8080
```

> Note: open via HTTP server, not `file://`, so the relative `forecast-i18n.js` loads correctly.

## i18n

Language toggle in the top bar switches EN/ID. Choice is persisted in `localStorage` (`fv3.lang`).
