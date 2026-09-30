# नन्हा स्कूल — सुरक्षा और privacy (Security & Privacy)

यह दस्तावेज़ मालिक और डेवलपर के लिए है: कौन-सा डेटा कहाँ रहता है, नेटवर्क पर क्या जाता है, हर हिस्से में
कौन-से सुरक्षा उपाय हैं, क्या सीमाएँ हैं, और कोई key लीक हो जाए तो क्या करें।
चालू करने के कदम [SUBSCRIPTION_SETUP.md](SUBSCRIPTION_SETUP.md) में हैं; लोगों के लिए क़ानूनी पेज `web/legal/` में हैं।

## 0. मूल सिद्धांत — सारा डेटा डिवाइस पर (all data on device)

- **बच्चे का कोई खाता नहीं।** बच्चे का नाम, आवाज़ या बातचीत कहीं जमा या भेजी नहीं जाती। "बात करो" में बच्चा नाम बताए
  तो वह सिर्फ़ उसी सेशन में memory में रहता है।
- **ऐप और backend कभी ईमेल, फ़ोन नंबर या कोई निजी जानकारी नहीं माँगते, भेजते या रखते।** माता-पिता संपर्क और भुगतान
  की जानकारी सिर्फ़ Razorpay के hosted checkout पेज पर भरते हैं; वह Razorpay (payment processor) के पास रहती है।
  हम Razorpay subscription के `notes` में भी कुछ निजी नहीं डालते (सिर्फ़ `{ "app": "nanha-school" }`)।
- सब्सक्रिप्शन चलाने के लिए जो चाहिए — ट्रायल शुरू होने का समय, last-seen time, सब्सक्रिप्शन ID, **रिस्टोर कोड**
  और signed pass — वह **सिर्फ़ डिवाइस पर** रहता है।
- **Backend stateless है:** कोई database नहीं, निजी डेटा का कोई log नहीं। यह सिर्फ़ subscription IDs, restore codes और
  signed passes से काम करता है; Razorpay ही बताता है कि कौन-सा सब्सक्रिप्शन चालू है।
- पूरे सिस्टम में व्यक्तिगत डेटा सिर्फ़ यहाँ है: (1) जो माता-पिता सीधे Razorpay को देते हैं, और (2) मालिक के अपने
  support ईमेल/कॉल, अगर कोई माता-पिता लिखें। इसके अलावा hosting कंपनियाँ (GitHub/Cloudflare) अपने सामान्य तकनीकी
  logs (जैसे IP address) रखती हैं।
- नतीजा: हमारे पास लीक होने लायक कोई ग्राहक database नहीं है। सबसे क़ीमती चीज़ें **keys** हैं (भाग 5)।

## 1. डेटा का नक्शा (Data map)

| डेटा | कहाँ रहता है | कौन देख सकता है | कितने समय तक | क्यों |
|------|--------------|------------------|---------------|-------|
| बच्चे का नाम ("बात करो" में बताया) | सिर्फ़ ऐप की memory (RAM) | कोई नहीं (सिर्फ़ उसी फ़ोन पर ऐप) | उसी सेशन तक; ऐप/टैब बंद होते ही ख़त्म | बडी नाम लेकर जवाब दे सके |
| बातचीत के शब्द | सिर्फ़ memory; जवाब फ़ोन पर ही बनते हैं | कोई नहीं | उसी सेशन तक | जवाब देना |
| बच्चे की आवाज़ (Android, बोलकर बात) | ऐप नहीं रखता; फ़ोन की speech-recognition सेवा प्रोसेस करती है (on-device को प्राथमिकता) | फ़ोन की speech सेवा (जैसे Google), अपनी नीति के अनुसार | ऐप में कभी सेव नहीं | बोलकर बात करना |
| बोलकर सुनाया जाने वाला टेक्स्ट | फ़ोन/ब्राउज़र की text-to-speech; वेब ऐप पहले on-device आवाज़ चुनता है | online आवाज़ हो तो वह speech सेवा | — | पढ़कर सुनाना |
| ट्रायल शुरू होने का समय | web: `localStorage` `ns_trial`; Android: private `SharedPreferences` (`nanha_school` → `trial_start`) | सिर्फ़ उसी डिवाइस पर ऐप | डेटा मिटाने/अनइंस्टॉल तक | 7 दिन का ट्रायल गिनना |
| last-seen time | web: `ns_seen`; Android: `last_seen` | वही | वही | घड़ी पीछे करके ट्रायल बढ़ाना रोकना |
| सब्सक्रिप्शन ID (`sub_…`) | डिवाइस (web: `ns_sub`; Android: रिस्टोर कोड के अंदर, और भुगतान चलते समय `pending_sub`) + Razorpay | माता-पिता; मालिक (Razorpay dashboard); Razorpay | डिवाइस: मिटाने तक; Razorpay: उनकी नीति | रद्द करना, support |
| रिस्टोर कोड (`sub_….` + 16 अक्षर) | सिर्फ़ डिवाइस (web: `ns_restore`; Android: `restore`, भुगतान चलते समय `pending_code`) | माता-पिता (कॉपी बटन के साथ दिखता है); मालिक इसे `restore-code` टूल से दोबारा बना सकता है | मिटाने तक | नए फ़ोन पर "वापस पाएँ"; Android पर भुगतान की पुष्टि |
| Signed pass `{sid, exp}` + हस्ताक्षर | सिर्फ़ डिवाइस (web: `ns_pass`; Android: `pass`) | इसमें कोई निजी डेटा नहीं | `exp` तक (चालू अवधि का अंत + 2 दिन), फिर refresh | बिना इंटरनेट के प्रीमियम जाँचना |
| माता-पिता का संपर्क (फ़ोन/ईमेल), कार्ड/UPI | सिर्फ़ Razorpay (hosted checkout) | Razorpay, बैंक; मालिक Razorpay dashboard में payment records (संपर्क, masked card) देख सकता है | Razorpay की नीति + क़ानूनी retention | भुगतान, रसीद, ऑटो-पे सूचनाएँ |
| Support ईमेल/कॉल | मालिक का mailbox/फ़ोन | मालिक | मदद पूरी होने तक (+ क़ानूनी ज़रूरत) | खोया रिस्टोर कोड, रिफ़ंड, सवाल |
| IP address, user-agent (तकनीकी) | GitHub Pages / Cloudflare Pages के server logs; Cloudflare (Worker); optional rate limiter में per-IP गिनती | वे कंपनियाँ | उनकी नीति; rate limiter: 60 सेकंड की खिड़की | वेबसाइट चलाना, abuse रोकना |
| `RAZORPAY_KEY_SECRET`, `SIGNING_KEY_JWK`, `RESTORE_SECRET` | Cloudflare Worker secrets (+ मालिक का password manager) | सिर्फ़ मालिक | rotate करने तक | Razorpay API, pass पर हस्ताक्षर, restore-code MAC |
| Android release keystore + passwords | मालिक का backup + GitHub Actions secrets | सिर्फ़ मालिक | हमेशा (खोना नहीं है) | APK पर हस्ताक्षर |

वेब ऐप cookies इस्तेमाल नहीं करता। Android में `allowBackup="false"` और data-extraction rules की वजह से ऐप का डेटा
cloud backup और नए फ़ोन पर device transfer में नहीं जाता।

## 2. नेटवर्क फ़्लो (Network flows)

सब कुछ HTTPS पर। Backend सिर्फ़ `api.razorpay.com` से बात करता है (15 सेकंड timeout)।

**वेब ऐप**

1. Browser → GitHub Pages / Cloudflare Pages: HTML, JS, CSS, fonts (self-hosted)। Service worker offline के लिए cache करता है।
2. पाठ, खेल, बातचीत, बोलकर सुनाना: कोई network call नहीं (सिवाय browser की online TTS आवाज़ के, अगर on-device आवाज़ न हो)।
3. सब्सक्राइब: browser → Worker `POST /api/subscribe {trial_days_left}` → Worker → Razorpay `POST /v1/subscriptions`
   (`plan_id`, `total_count`, ट्रायल बाकी हो तो `start_at`, `notes: {app}`) → browser को `{subscription_id, key_id, restore_code}`।
4. Browser → `checkout.razorpay.com/v1/checkout.js` → Razorpay checkout (iframe)। माता-पिता संपर्क और भुगतान की जानकारी
   **वहीं** भरते हैं। Razorpay → browser: `razorpay_payment_id`, `razorpay_subscription_id`, `razorpay_signature`।
5. Browser → Worker `POST /api/verify` → Worker HMAC-SHA256 signature जाँचता है → `GET /v1/subscriptions/{id}` →
   `{token, exp}`। ऐप pass और रिस्टोर कोड सेव करता है और कोड दिखाता है।
6. बाद में: pass ख़त्म होने के क़रीब (वेब में 3 दिन पहले) `/api/refresh {token}`; नए डिवाइस पर `/api/restore {restore_code}`;
   रद्द करने पर `/api/cancel {token}` → Razorpay `cancel_at_cycle_end`।

**Android ऐप**

1. पाठ, बातचीत, बोलकर सुनाना: offline। बोलकर बात: फ़ोन की speech सेवा, on-device को प्राथमिकता।
   `INTERNET` permission सिर्फ़ भुगतान के लिए।
2. सब्सक्राइब: app → Worker `POST /api/subscribe {trial_days_left}` (कोई `Origin` header नहीं) →
   `{subscription_id, key_id, restore_code}`; ऐप pending subscription ID और रिस्टोर कोड सेव करता है।
3. App फ़ोन का browser खोलता है: `PAY_PAGE_URL#s=<subscription_id>&k=<key_id>`। `#` के बाद वाला हिस्सा कभी server
   पर नहीं जाता; `pay.html` उसे address bar से मिटा देता है, Razorpay checkout खोलता है, backend को call नहीं करता
   और कुछ सेव नहीं करता।
4. भुगतान के बाद "ऐप पर वापस जाएँ" → deep link `intent://open#Intent;scheme=nanhaschool;package=org.guardian.buddy;end`
   (यानी `nanhaschool://open`) → ऐप।
5. App → Worker `POST /api/restore {restore_code}` → Worker MAC और Razorpay status जाँचता है → pass। ऐप pass और
   रिस्टोर कोड सेव करता है और pending वाली चीज़ें मिटा देता है।
6. Refresh और cancel वेब जैसे ही।

## 3. हर हिस्से में सुरक्षा (Security measures)

### वेब (PWA)

- **Strict CSP** (`index.html` और `pay.html` में `<meta>`; Cloudflare Pages पर `_headers` से असली header भी): `default-src 'self'`;
  scripts सिर्फ़ अपनी साइट + `checkout.razorpay.com` / `cdn.razorpay.com`; कोई inline script/style नहीं;
  `connect-src 'self' https://*.workers.dev https://*.razorpay.com`; frames सिर्फ़ Razorpay; `object-src 'none'`; `base-uri 'none'`।
- **`web/_headers`** (सिर्फ़ Cloudflare Pages): HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` +
  `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` (camera, microphone, geolocation बंद)।
- Fonts self-hosted — Google को कोई request नहीं।
- UI सिर्फ़ `textContent` से बनता है (डेटा कभी HTML की तरह parse नहीं होता)।
- Code में कोई secret नहीं; pass की जाँच `PUBLIC_KEY_JWK` से WebCrypto (ECDSA P-256) में।
- `pay.html`: subscription ID/key ID URL के `#hash` में (server logs में नहीं जाते), पढ़कर मिटा दिए जाते हैं; `noindex`;
  Razorpay में कोई prefill नहीं।
- क़ानूनी पेज (`web/legal/`): कोई script नहीं, अपना CSP।

### Android

- `INTERNET` सिर्फ़ भुगतान के लिए; **सिर्फ़ HTTPS** — network security config में cleartext बंद और user-installed CAs पर
  भरोसा नहीं; `API_BASE`/`PAY_PAGE_URL` `https://` न हों तो payments चालू ही नहीं होते।
- `allowBackup="false"` + data-extraction rules: ऐप का डेटा backup और device transfer से बाहर।
- "बड़ों के लिए" वाली screens पर `FLAG_SECURE` (screenshot, screen recording और recent-apps thumbnail बंद)।
- भुगतान की screens से पहले parent gate (ऐसा सवाल जो छोटे बच्चे हल नहीं कर पाते)।
- भुगतान फ़ोन के browser में होता है, WebView में नहीं — ऐप कार्ड/UPI/संपर्क कभी नहीं देखता।
- Pass की जाँच `PUBLIC_KEY_SPKI` (SHA256withECDSA) से, offline।
- Speech recognition on-device को प्राथमिकता देता है।
- Release build: R8 से minify + resource shrink, **debuggable नहीं**, आपकी keystore से signed (GitHub secrets से)।

### Backend (Cloudflare Worker, `server/`)

- कोई database नहीं; निजी डेटा, request bodies या tokens का कोई log नहीं; errors सिर्फ़ तय codes (`{"error": "..."}`), request कभी echo नहीं।
- सिर्फ़ `POST`; **`Content-Type: application/json` ज़रूरी** (नहीं तो 415) — इससे browser को CORS preflight करना ही पड़ता है।
- **Origin allowlist:** browser की request किसी अनजान origin से आए तो 403 (preflight भी)। Android ऐप कोई `Origin` नहीं भेजता।
- **Body ≤ 4 KB** (नहीं तो 413); strict UTF-8 JSON object।
- हर input का सख़्त format (`sub_…`, `pay_…`, 64-hex signature, restore code, pass)।
- Razorpay signature HMAC-SHA256 से, constant-time तुलना; फिर secret key से Razorpay से status पूछा जाता है
  (सिर्फ़ `active`/`authenticated` पर pass)।
- **Restore code** = `sub_id + "." + base64url(HMAC-SHA256(RESTORE_SECRET, "nanha-restore|" + sub_id))` के पहले 16 अक्षर
  (`RESTORE_SECRET` न हो तो उसकी जगह `RAZORPAY_KEY_SECRET`)
  (96 bits)। ग़लत कोड पर वही 404 जो अनजान सब्सक्रिप्शन पर — अंदाज़ा लगाना बेकार।
- **Passes:** ECDSA P-256 से signed `{sid, exp}`; `exp` = चालू अवधि का अंत + 2 दिन की मोहलत।
- `trial_days_left` server पर `TRIAL_DAYS` से ऊपर नहीं जा सकता।
- Security headers: `Cache-Control: no-store`, `nosniff`, `Referrer-Policy: no-referrer`, `CSP: default-src 'none'; frame-ancestors 'none'`।
- Optional **rate limiting** (`wrangler.toml` में commented `[[ratelimits]]` binding) — हर IP + route पर; limiter में दिक़्क़त हो तो
  भुगतान न रुके, इसलिए fail-open।
- Secrets सिर्फ़ `wrangler secret put` से — `wrangler.toml` या git में कभी नहीं।

### भुगतान (Razorpay)

- कार्ड/UPI/संपर्क सिर्फ़ Razorpay के पेज पर। Key Secret सिर्फ़ Worker में। Key ID public है और Worker से आता है
  (ऐप में hard-coded नहीं)।
- हर भुगतान: signature + server-side status check।
- रद्द करना `cancel_at_cycle_end` से — जितने दिनों का पैसा दिया, उतने दिन चलता है।
- Razorpay में हमारी तरफ़ से कोई निजी डेटा नहीं जाता।

## 4. सीमाएँ — ईमानदारी से (Known limits)

- **ट्रायल हर डिवाइस/browser पर गिना जाता है।** डेटा मिटाने पर फिर से शुरू हो सकता है। बच्चों को ट्रैक न करने के लिए यह जान-बूझकर है।
- **Client code बदला जा सकता है।** कोई विशेषज्ञ browser DevTools या APK को decompile/patch करके अपने डिवाइस पर ताला हटा सकता है।
  वह नकली pass नहीं बना सकता (private key नहीं है), पर जाँच ही हटा सकता है। इस कीमत के product के लिए यह स्वीकार्य है।
- **रिस्टोर कोड पासवर्ड जैसा है।** जिसके पास कोड है, वह `/api/restore` से pass लेकर कितने भी डिवाइस पर प्रीमियम खोल सकता है, और उस
  pass से `/api/cancel` करके आगे का नवीनीकरण भी रद्द कर सकता है। वह कोई निजी डेटा नहीं देख सकता, पैसे नहीं ले सकता, भुगतान का
  तरीका नहीं देख या बदल सकता। किसी एक कोड को अलग से बंद करने का तरीका नहीं है (भाग 5.3 देखें)।
- **Pass bearer token है:** डिवाइस की storage से कॉपी करने वाला `exp` तक प्रीमियम पा सकता है (और उससे cancel कर सकता है)।
- **Origin check authentication नहीं है:** browser के बाहर के clients (curl, scripts) कोई Origin नहीं भेजते और Android की तरह allowed हैं।
  Rate limiting के बिना कोई `/api/subscribe` को spam कर सकता है (Razorpay में बेकार "created" subscriptions बनेंगी) — rate limiting चालू करें।
- **GitHub Pages custom headers नहीं भेजता:** `_headers` सिर्फ़ Cloudflare Pages पर चलता है। GitHub Pages पर सिर्फ़ `<meta>` CSP लागू
  होता है — `frame-ancestors` (clickjacking से बचाव) meta में काम नहीं करता।
- **Speech/TTS सेवाएँ तीसरे पक्ष की हैं** — on-device को प्राथमिकता है, पर फ़ोन में न हो तो ये online प्रोसेस कर सकती हैं।
- **Root किया हुआ या malware वाला फ़ोन** कुछ भी पढ़ सकता है। `FLAG_SECURE` सिर्फ़ "बड़ों के लिए" वाली screens पर है।
- **`RESTORE_SECRET` बदलने पर सारे रिस्टोर कोड बदल जाते हैं** (भाग 5.4)। इसे डाला ही न हो, तो कोड `RAZORPAY_KEY_SECRET` पर
  टिके होते हैं और वह बदलने पर बदल जाते हैं (भाग 5.2) — इसलिए `RESTORE_SECRET` ज़रूर डालें।
- **Debug-signed APK कमज़ोर है — जब तक release signing चालू न हो:**
  - Debug build में `android:debuggable="true"` होता है। फ़ोन unlocked हो और USB debugging चालू हो, तो कोई भी कंप्यूटर से
    `adb shell run-as org.guardian.buddy` चलाकर ऐप की private files (pass, रिस्टोर कोड, ट्रायल के समय वाली `SharedPreferences`)
    पढ़ या बदल सकता है — `allowBackup="false"` इसे नहीं रोकता, क्योंकि `run-as` सिर्फ़ debuggable ऐप पर चलता है और backup से अलग
    रास्ता है। वह debugger (JDWP) जोड़कर चलते ऐप का व्यवहार भी बदल सकता है।
  - Debug key आपकी पहचान नहीं है: कोई भी debug key से APK sign कर सकता है, और GitHub के runner पर हर बार नई debug key बन सकती है —
    तब एक debug APK के ऊपर अगला update install नहीं होता।
  - Debug build minify नहीं होता।
  - Release build debuggable नहीं होता (`run-as` मना कर देता है: "package not debuggable"), R8 से minify होता है, और आपकी key से signed
    होता है — Android उसके ऊपर सिर्फ़ उसी key वाला update install करता है।

## 5. Keys बदलना (rotation) और incident

| Key | कहाँ है | लीक हो तो असर |
|-----|---------|----------------|
| `SIGNING_KEY_JWK` (private) | Worker secret | कोई भी नकली pass बना सकता है → मुफ़्त प्रीमियम। पैसा या निजी डेटा नहीं जाता। |
| `PUBLIC_KEY_JWK` / `PUBLIC_KEY_SPKI` | ऐप का code (public) | कोई ख़तरा नहीं। |
| `RAZORPAY_KEY_SECRET` | Worker secret | **गंभीर:** Razorpay API का पूरा access (payments/subscriptions/customer records पढ़ना, subscriptions रद्द करना, refunds)। `RESTORE_SECRET` न डाला हो तो कोई भी रिस्टोर कोड बनाना भी। |
| `RESTORE_SECRET` | Worker secret | कोई भी रिस्टोर कोड बना सकता है → किसी भी चालू सब्सक्रिप्शन का प्रीमियम मुफ़्त खोलना (और उसका नवीनीकरण रद्द करना)। पैसा या निजी डेटा नहीं जाता। |
| `RAZORPAY_KEY_ID`, `RAZORPAY_PLAN_ID` | `wrangler.toml` (public) | अकेले कोई ख़तरा नहीं। |
| Android keystore + passwords | मालिक का backup + GitHub secrets | कोई आपकी पहचान से APK update sign कर सकता है। |
| GitHub / Cloudflare / Razorpay accounts | — | सब कुछ। 2FA ज़रूरी। |

### 5.1 Signing key बदलना (`SIGNING_KEY_JWK`)

1. `cd server && npm run genkeys` — तीन चीज़ें छपेंगी (PRIVATE JWK, PUBLIC JWK, PUBLIC SPKI)।
2. `npx wrangler secret put SIGNING_KEY_JWK` → नई PRIVATE key। (यह तुरंत deploy हो जाता है: अब से नए pass नई key से बनेंगे, और
   पुराने pass Worker में भी fail होंगे — `/api/refresh` और `/api/cancel` पर `bad_token`।)
3. `web/config.js` में `PUBLIC_KEY_JWK` बदलें और push करें (browser cache की वजह से नया config आने में एक-दो बार ऐप खोलना पड़ सकता है)।
4. `Config.java` में `PUBLIC_KEY_SPKI` बदलें, नया APK बनाएँ और publish करें — माता-पिता को update install करना होगा। पुराना APK नए pass
   स्वीकार नहीं करेगा।
5. **असर:** हर पुराना pass अमान्य — प्रीमियम वाले माता-पिता को ताले दिखेंगे। वे **"वापस पाएँ"** में अपना रिस्टोर कोड डालें; नया pass मिल
   जाएगा। रिस्टोर कोड **नहीं** बदलते (वे `RESTORE_SECRET` पर टिके हैं, signing key पर नहीं)।

कदम 2–4 एक साथ, जल्दी और कम भीड़ वाले समय में करें, और माता-पिता को पहले बता दें।

### 5.2 Razorpay Key Secret बदलना (`RAZORPAY_KEY_SECRET`)

1. Razorpay Dashboard → **Account & Settings → API Keys → Regenerate** (Live mode)। पुरानी key बंद हो जाती है; Key ID भी बदल
   सकता है (Razorpay के मौजूदा नियम dashboard में देखें)।
2. `npx wrangler secret put RAZORPAY_KEY_SECRET` → नया secret। Key ID बदला हो तो `wrangler.toml` में `RAZORPAY_KEY_ID` बदलकर
   `npx wrangler deploy`। ऐप में कुछ नहीं बदलना — Key ID Worker से आता है।
3. **अगर `RESTORE_SECRET` डाला है (सुझाया गया):** रिस्टोर कोड नहीं बदलते; माता-पिता को कुछ नहीं करना। नीचे का असर सिर्फ़ तब है
   जब `RESTORE_SECRET` नहीं डाला था। **असर — सारे रिस्टोर कोड बदल जाते हैं** (MAC इसी secret से बनता है):
   - चालू pass चलते रहते हैं और refresh भी होते हैं (वे signing key पर टिके हैं)।
   - पर डिवाइस पर सेव या लिखकर रखे पुराने कोड अब "वापस पाएँ" में काम नहीं करेंगे। जिसे ज़रूरत हो (जैसे नया फ़ोन), वह आपसे संपर्क
     करे; आप नया कोड बनाएँ: `RAZORPAY_KEY_SECRET=<नया secret> npm run restore-code -- sub_XXXX`।
   - बदलाव के ठीक समय पर चल रहे भुगतान (पुरानी key से खुला checkout, या Android पर पुराने कोड से पुष्टि) fail हो सकते हैं — उन्हें
     भी नया कोड दें। इसलिए यह कम भीड़ वाले समय में करें।
4. पहले से चल रहे सब्सक्रिप्शन Razorpay खाते से जुड़े हैं, key से नहीं — वे चलते रहते हैं।

### 5.3 अगर कुछ लीक हो जाए

- **`SIGNING_KEY_JWK` लीक:** भाग 5.1 करें। पैसा या डेटा ख़तरे में नहीं, सिर्फ़ मुफ़्त प्रीमियम।
- **`RAZORPAY_KEY_SECRET` लीक (सबसे गंभीर):**
  1. तुरंत भाग 5.2 करें।
  2. Razorpay dashboard में अनजान refunds, cancellations, subscription बदलाव, और settlement/bank account के बदलाव जाँचें;
     Razorpay support को बताएँ।
  3. Razorpay के customer records (संपर्क जानकारी) उस दौरान पढ़े जा सकते थे। **क़ानूनी सलाह लें:** DPDP Act के तहत Data Protection
     Board और प्रभावित लोगों को सूचना देना ज़रूरी हो सकता है, और CERT-In के नियमों में कुछ cyber incidents 6 घंटे के अंदर रिपोर्ट
     करने होते हैं।
- **Android keystore या उसके passwords लीक (या keystore खो गई):** GitHub secrets हटाएँ, नई keystore बनाएँ, नई key से APK publish करें,
  और माता-पिता से कहें कि पुराना ऐप uninstall करके नया install करें, फिर "वापस पाएँ" में रिस्टोर कोड डालें।
- **`RESTORE_SECRET` लीक:** भाग 5.4 करें। पैसा या निजी डेटा ख़तरे में नहीं, सिर्फ़ मुफ़्त प्रीमियम।
- **किसी माता-पिता का रिस्टोर कोड लीक:** एक कोड अलग से बंद नहीं होता (सारे कोड बदलना = भाग 5.2)। आसान रास्ता: Razorpay dashboard में
  वह सब्सक्रिप्शन रद्द करें और माता-पिता नया सब्सक्रिप्शन लें — नया `sub_…` = नया कोड। बचे दिनों का हिसाब अपनी रिफ़ंड नीति के अनुसार करें।
- **GitHub account/repo:** password और 2FA बदलें, secrets बदलें, अनजान commits/workflows और Releases के APK जाँचें।
- **Cloudflare account:** password और 2FA बदलें, Worker का code और secrets जाँचें, दोनों secrets rotate करें।

**हर incident में:** 1) रोकें (access बंद करें) → 2) keys बदलें → 3) logs/dashboards जाँचें (Razorpay, Cloudflare, GitHub audit log) →
4) ज़रूरत हो तो माता-पिता, Razorpay और अधिकारियों को बताएँ → 5) लिखकर रखें: क्या हुआ, कब, क्या ठीक किया।

### 5.4 `RESTORE_SECRET` बदलना (सिर्फ़ लीक होने पर)

1. नया random text बनाएँ (`SUBSCRIPTION_SETUP.md` का कदम 2) और `npx wrangler secret put RESTORE_SECRET`।
2. **असर:** सारे पुराने रिस्टोर कोड बंद। चालू pass चलते रहते हैं। जिसे नए फ़ोन पर कोड चाहिए, वह संपर्क करे; आप
   `RESTORE_SECRET=<नया> npm run restore-code -- sub_XXXX` से नया कोड बनाकर दें।

## 6. लॉन्च से पहले security checklist

- [ ] Razorpay KYC पूरा; **Test Mode** में पूरा flow (वेब और Android) जाँचा: ट्रायल में सब्सक्राइब, भुगतान, दूसरे डिवाइस पर "वापस पाएँ", रद्द करना।
- [ ] Live keys: `RAZORPAY_KEY_ID` और `RAZORPAY_PLAN_ID` `wrangler.toml` में; `RAZORPAY_KEY_SECRET`, `SIGNING_KEY_JWK` और `RESTORE_SECRET` सिर्फ़
      `wrangler secret put` से। Repo में कोई secret commit नहीं हुआ (`git log -p | grep -n '"d":'` कुछ न दिखाए)।
- [ ] `ALLOWED_ORIGINS` में सिर्फ़ आपके वेब ऐप के असली पते।
- [ ] `PUBLIC_KEY_JWK` (`web/config.js`) और `PUBLIC_KEY_SPKI` (`Config.java`) एक ही `genkeys` run से।
- [ ] `API_BASE` `https://` है; `*.workers.dev` नहीं है तो उसका origin `web/index.html`, `web/pay.html` और `web/_headers` के `connect-src` में जोड़ा।
- [ ] Rate limiting binding चालू (`wrangler.toml`, Wrangler 4.36.0 या नया)।
- [ ] वेब ऐप Cloudflare Pages पर (ताकि `_headers` लागू हों), या GitHub Pages की सीमाएँ समझकर स्वीकार कीं।
- [ ] Release signing: चारों GitHub secrets डाले; Actions run में "Build signed release APK" चला और debug वाली warning नहीं आई;
      `apksigner verify --print-certs BaatBuddy.apk` में आपका certificate दिखता है; `adb shell run-as org.guardian.buddy` "not debuggable" कहता है।
- [ ] Keystore और उसके passwords दो सुरक्षित जगह backup (जैसे password manager + offline copy); keystore कभी git में नहीं।
- [ ] GitHub, Cloudflare और Razorpay पर 2FA; team में सिर्फ़ ज़रूरी लोग।
- [ ] क़ानूनी पेज (`web/legal/`): सारे `[ ]` placeholders भरे, ऊपर की सूचना हटाई, वकील से जँचवाया, Razorpay को links दिए; पेज मौजूदा build से मेल खाते हैं।
- [ ] खोए रिस्टोर कोड के लिए support तरीका तय: कोड भेजने से पहले भुगतान की जानकारी से पक्का करें; secret shell history में न जाए
      (`read -rs RESTORE_SECRET && export RESTORE_SECRET`)।
- [ ] असली फ़ोन पर: पाठ offline चलते हैं; parent gate; "बड़ों के लिए" screens का screenshot नहीं बनता; भुगतान के बाद "ऐप पर वापस जाएँ" ऐप खोलता है।
- [ ] कविताओं/सामग्री के अधिकार जाँचे। Play Store पर डालना हो तो Google Play के billing और Families नियम पहले देखें।
