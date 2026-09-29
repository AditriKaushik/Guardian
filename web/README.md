# नन्हा स्कूल — Web App

The same learning app as the Android APK, as an installable web app (PWA).
Works in any modern browser on phone, tablet or computer, anywhere in the world.

- **Installable:** on a phone, open the site and tap "📲 ऐप इंस्टॉल करें"
  (or the browser's *Add to Home screen*). It then opens full-screen like an app.
- **Works offline:** after the first visit, a service worker (`sw.js`) caches the app.
- **Speaks:** uses the browser's built-in text-to-speech, in Hindi or English per item.
- **No tracking, nothing personal:** everything runs in the child's browser. The app never asks for
  or stores an email or phone number; fonts are self-hosted (no Google requests); speech prefers
  the phone's on-device voices.
- **Optional subscription:** a 7-day free trial, then a Razorpay subscription checked by the
  small Worker in `server/`. It stays off (everything free) until `config.js` is filled in —
  see [docs/SUBSCRIPTION_SETUP.md](../docs/SUBSCRIPTION_SETUP.md). After paying, the parent gets a
  restore code (no personal data in it) to bring premium back on another phone.
- **Locked down:** a strict Content-Security-Policy (no inline scripts or styles; only Razorpay
  and `*.workers.dev` allowed as outside hosts). If `API_BASE` is not on `*.workers.dev`, add its
  origin to `connect-src` in `index.html`, `pay.html` and `_headers`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app's page (no inline code) |
| `app.js` | The app: lessons, rhymes, game, chat, trial and paywall |
| `app.css` | Styles for `index.html` and `pay.html`, plus the self-hosted font |
| `config.js` | Payment settings, price text, which lessons stay free |
| `pay.html`, `pay.js` | Checkout page the Android app opens in the browser (`pay.html#s=<sub_id>&k=<key_id>`) |
| `fonts/` | Baloo 2 (devanagari + latin, woff2) and its licence, `OFL.txt` |
| `legal/` | Privacy policy, terms, refunds and contact pages |
| `manifest.webmanifest` | App name, colours and icons for installing |
| `sw.js` | Offline cache (never caches API calls or Razorpay) |
| `_headers` | Security headers for Cloudflare Pages (GitHub Pages ignores it) |
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
