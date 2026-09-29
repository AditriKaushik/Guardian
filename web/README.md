# नन्हा स्कूल — Web App

The same learning app as the Android APK, as an installable web app (PWA).
Works in any modern browser on phone, tablet or computer, anywhere in the world.

- **Installable:** on a phone, open the site and tap "📲 ऐप इंस्टॉल करें"
  (or the browser's *Add to Home screen*). It then opens full-screen like an app.
- **Works offline:** after the first visit, a service worker (`sw.js`) caches the app.
- **Speaks:** uses the browser's built-in text-to-speech, in Hindi or English per item.
- **No tracking:** everything runs in the child's browser.
- **Optional subscription:** a 7-day free trial, then a Razorpay subscription checked by the
  small Worker in `server/`. It stays off (everything free) until `config.js` is filled in —
  see [docs/SUBSCRIPTION_SETUP.md](../docs/SUBSCRIPTION_SETUP.md).

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole app (lessons, rhymes, game, chat, trial and paywall) |
| `config.js` | Payment settings, price text, which lessons stay free |
| `manifest.webmanifest` | App name, colours and icons for installing |
| `sw.js` | Offline cache |
| `icon.svg`, `icon-maskable.svg` | App icons |

## Run locally

```bash
cd web
python3 -m http.server 8000   # then open http://localhost:8000
```

## Put it online (free, GitHub Pages)

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge to `main`. The `Deploy web app` workflow publishes `web/` to
   `https://aditrikaushik.github.io/Guardian/`.
