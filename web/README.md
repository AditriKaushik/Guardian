# नन्हा स्कूल — Web App

The same learning app as the Android APK, as an installable web app (PWA).
Works in any modern browser on phone, tablet or computer, anywhere in the world.

- **Installable:** on a phone, open the site and tap "📲 ऐप इंस्टॉल करें"
  (or the browser's *Add to Home screen*). It then opens full-screen like an app.
- **Works offline:** after the first visit, a service worker (`sw.js`) caches the app.
- **Speaks:** uses the browser's built-in text-to-speech, in Hindi or English per item.
- **No tracking, nothing personal:** everything runs in the child's browser; child profiles and progress stay on the device. The app never asks for
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

The app is plain HTML/CSS/JS with no build step. See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
for the module contract.

| Path | Purpose |
|------|---------|
| `index.html` | The page (no inline code); loads the scripts below in order |
| `app.css` | Design system and responsive layout (320px phones to 4K screens), self-hosted font |
| `config.js` | Payment settings, plans, which lessons stay free |
| `js/core/` | Framework: registry and events (`ns.js`), on-device storage and profiles (`store.js`), voice (`voice.js`), stickers (`rewards.js`), trial and subscription (`billing.js`), screens and grown-ups' area (`ui.js`) |
| `js/modules/` | Activities: learn (ABC, अक्षर, गिनती, दुनिया देखो, कविताएँ, खेल), routine (मेरा दिन), garden (मेरा बगीचा), stories (कहानी समय), dreams (बड़े होकर), focus (ध्यान), buddy (मिट्ठू से बात) |
| `js/content/` | Lesson, rhyme, story, career, routine and focus data |
| `js/brain/brain.js` | The talking buddy's brain (pure logic, tested in `tools/test/`) |
| `audio/manifest.json` | Recorded voice clips, if any (see [docs/VOICE.md](../docs/VOICE.md)) |
| `pay.html`, `pay.js` | Checkout page the Android app opens in the browser |
| `fonts/`, `legal/`, `manifest.webmanifest`, `sw.js`, `_headers`, icons | Font, legal pages, install info, offline cache, Cloudflare Pages headers |

## Run locally

```bash
cd web
python3 -m http.server 8000   # then open http://localhost:8000
```

## Put it online (free, GitHub Pages)

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge to `main`. The `Deploy web app` workflow publishes `web/` to
   `https://aditrikaushik.github.io/Guardian/`.
