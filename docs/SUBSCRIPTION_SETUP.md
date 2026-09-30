# नन्हा स्कूल — सब्सक्रिप्शन चालू करने की गाइड

जब तक आप ये कदम पूरे नहीं करते, वेब ऐप और Android ऐप **पूरी तरह मुफ़्त** चलते हैं — कुछ बंद नहीं होता।
इन्हें पूरा करते ही 7 दिन का मुफ़्त ट्रायल और सब्सक्रिप्शन अपने-आप चालू हो जाता है।

## यह कैसे काम करता है

| हिस्सा | कहाँ चलता है | ख़र्च |
|--------|--------------|-------|
| वेब ऐप (`web/`) और क़ानूनी पेज (`web/legal/`) | GitHub Pages या Cloudflare Pages | मुफ़्त |
| Android ऐप (`android/`) | GitHub Releases से सीधा APK | मुफ़्त |
| पेमेंट की जाँच (`server/`) | Cloudflare Worker | मुफ़्त (1 लाख requests/दिन तक) |
| पेमेंट | Razorpay का सुरक्षित पेज (UPI, कार्ड, नेटबैंकिंग) | हर पेमेंट पर लगभग 2% (विदेशी कार्ड पर लगभग 3%) + उस फ़ीस पर GST; कोई मासिक फ़ीस नहीं |

ताज़ा दरें Razorpay की वेबसाइट पर देख लें। कोई डेटाबेस नहीं है; Razorpay ही बताता है कि किसका
सब्सक्रिप्शन चालू है। **ऐप और Worker कभी कोई ईमेल या फ़ोन नंबर नहीं माँगते, न रखते** — माता-पिता ये सिर्फ़
Razorpay के पेज पर भरते हैं। बाकी सब (ट्रायल, पास, रिस्टोर कोड) सिर्फ़ फ़ोन/ब्राउज़र में रहता है।

**बच्चे और माता-पिता के लिए:**

1. ऐप पहली बार खोलते ही **7 दिन का मुफ़्त ट्रायल** — न साइनअप, न कार्ड।
2. ट्रायल के बाद **ABC, गिनती और 2 कविताएँ हमेशा मुफ़्त** रहती हैं, बाकी पर 🔒 लग जाता है।
3. 🔒 दबाने पर बच्चे से कहा जाता है "मम्मी या पापा को बुलाओ", और एक गुणा का सवाल आता है
   जो सिर्फ़ बड़े हल कर सकते हैं। **बच्चा कभी पेमेंट स्क्रीन नहीं देखता।**
4. माता-पिता ट्रायल के बीच में सब्सक्राइब करें तो **पहला पैसा ट्रायल ख़त्म होने के बाद ही कटता है।**
5. भुगतान के बाद ऐप एक **रिस्टोर कोड** दिखाता है (कॉपी बटन के साथ)। नए फ़ोन पर "वापस पाएँ" में यही कोड डालकर
   प्रीमियम फिर खुल जाता है। इसमें कोई निजी जानकारी नहीं होती, पर इसे पासवर्ड की तरह सँभालना है।
6. रद्द करना एक बटन से; जितने दिनों के पैसे दिए, उतने दिन ऐप चलता रहता है।

## कदम 1 — Razorpay खाता

1. <https://razorpay.com> पर साइन अप करें। PAN और बैंक खाते से KYC पूरा करें
   (बिना रजिस्टर्ड कंपनी के, व्यक्ति के तौर पर भी खाता बनता है)।
2. Razorpay खाता चालू करने के लिए आपकी वेबसाइट पर ये पेज होने चाहिए:
   **Terms & Conditions, Privacy Policy, Refund/Cancellation Policy, Contact Us, और कीमत।**
   ये पेज `web/legal/` में तैयार हैं — **कदम 4** में उन्हें भरें और **कदम 5** में ऑनलाइन करके उनके लिंक Razorpay को दें।
3. Dashboard में **Subscriptions → Plans → Create Plan**: जैसे ₹99, हर 1 महीने।
   बनने के बाद **Plan ID** (`plan_…`) कॉपी करें।
4. **Account & Settings → API Keys** से **Key ID** (`rzp_…`) और **Key Secret** बनाएँ।
   पहले **Test Mode** की keys से सब आज़माएँ, फिर Live keys लगाएँ।

## कदम 2 — Cloudflare Worker (पेमेंट जाँचने वाला छोटा सर्वर)

कंप्यूटर में [Node.js](https://nodejs.org) (20 या नया) होना चाहिए। फिर:

```bash
cd server

# 1. Cloudflare में लॉगिन (मुफ़्त खाता बन जाएगा)
npx wrangler login

# 2. पास पर हस्ताक्षर करने वाली keys बनाएँ
npm run genkeys
```

`genkeys` तीन चीज़ें छापेगा — तीनों सँभाल लें, ये एक ही जोड़ी की keys हैं:

1. **PRIVATE key** (JWK) — किसी को न दिखाएँ, सिर्फ़ Worker में जाएगी (`SIGNING_KEY_JWK`)
2. **PUBLIC key** (JWK, `{"kty":"EC",…}`) — वेब ऐप के `web/config.js` में जाएगी (कदम 3)
3. **PUBLIC key** (SPKI base64, `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…`) — Android ऐप के `Config.java` में जाएगी (कदम 6)

PUBLIC keys को कोई देख भी ले तो कोई ख़तरा नहीं।

`server/wrangler.toml` खोलकर ये दो लाइनें भरें:

```toml
RAZORPAY_KEY_ID = "rzp_live_…"
RAZORPAY_PLAN_ID = "plan_…"
```

फिर secrets डालें और Worker चालू करें:

```bash
npx wrangler secret put RAZORPAY_KEY_SECRET   # Razorpay का Key Secret चिपकाएँ
npx wrangler secret put SIGNING_KEY_JWK       # genkeys वाली PRIVATE key (पहली चीज़) चिपकाएँ
npx wrangler secret put RESTORE_SECRET        # नीचे वाले command से बना लंबा random text चिपकाएँ
npx wrangler deploy
```

आख़िर में एक पता मिलेगा, जैसे `https://nanha-school-api.आपका-नाम.workers.dev` — इसे सँभाल लें।

> अगर वेब ऐप GitHub Pages के अलावा कहीं और (जैसे अपना डोमेन) पर है, तो `wrangler.toml` में
> `ALLOWED_ORIGINS` में वही पता लिखें, वरना ऐप Worker से बात नहीं कर पाएगा। (Android ऐप को इसकी ज़रूरत नहीं।)

> **`RESTORE_SECRET`:** माता-पिता के रिस्टोर कोड इसी से बनते हैं। इसके लिए एक लंबा random text बनाएँ:
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` — इसे password manager में
> सँभालें, **एक बार डालें और कभी न बदलें** (बदलते ही सारे रिस्टोर कोड बंद हो जाते हैं)। अलग रखने का फ़ायदा:
> Razorpay की key कभी लीक होकर बदलनी पड़े, तो भी माता-पिता के कोड चलते रहेंगे। अगर यह नहीं डाला, तो Worker
> `RAZORPAY_KEY_SECRET` से कोड बनाता है — [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) का भाग 5 देखें।

**बहुत ज़्यादा requests रोकना (सुझाया गया):** `wrangler.toml` के आख़िर में rate limiting की छह लाइनें हैं।
उनके आगे से `# ` हटाकर `npx wrangler deploy` करें (Wrangler 4.36.0 या नया चाहिए)।

## कदम 3 — वेब ऐप में पता और public key डालें

`web/config.js` खोलें:

```js
API_BASE: "https://nanha-school-api.आपका-नाम.workers.dev",
PUBLIC_KEY_JWK: { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },   // genkeys की दूसरी चीज़
PRICE_TEXT: "₹99 / महीना",                                              // Razorpay plan जैसा ही
```

> **CSP:** वेब ऐप सिर्फ़ `*.workers.dev` और Razorpay से बात करने देता है। अगर आपका `API_BASE` `*.workers.dev`
> पर नहीं है (जैसे `https://api.आपका-डोमेन.in`), तो उसका origin `web/index.html` और `web/pay.html` की
> `Content-Security-Policy` में `connect-src` में जोड़ें — और `web/_headers` में भी, ताकि तीनों एक जैसे रहें।
> वरना ब्राउज़र Worker तक request जाने ही नहीं देगा।

## कदम 4 — क़ानूनी पेज भरें

`web/legal/` में चार पेज हैं (हिंदी, नीचे छोटा English हिस्सा):

| पेज | क्या है |
|-----|---------|
| `privacy.html` | गोपनीयता नीति (Privacy Policy) |
| `terms.html` | नियम और शर्तें (Terms) |
| `refund.html` | रद्द करने और रिफ़ंड की नीति |
| `contact.html` | संपर्क (Contact Us) |

1. हर पेज में पीली `[ ]` जगहें भरें: `[मालिक का नाम / Owner name]`, `[ईमेल / Email]`, `[फ़ोन / Phone]`,
   `[पता / Address]`, `[शहर / City]`, `[तारीख़ / Effective date]` और `[कीमत / Price — …]`।
2. `refund.html` की रिफ़ंड नीति एक निष्पक्ष शुरुआती नीति है (7 दिन के अंदर गलती वाले चार्ज पर संपर्क) — अपनी पसंद से बदलें।
3. **लॉन्च से पहले किसी वकील से जँचवाएँ**, फिर हर पेज के ऊपर वाली "मालिक के लिए" सूचना हटा दें।
4. ऐप बदले (जैसे कोई नई सेवा जुड़े) तो पेज भी बदलें — पेजों में सिर्फ़ वही लिखा है जो ऐप सच में करता है।

## कदम 5 — वेब ऐप ऑनलाइन करें

**विकल्प A — GitHub Pages (रिपॉज़िटरी public हो तो मुफ़्त):**
repo की **Settings → Pages → Build and deployment → Source: GitHub Actions** चुनें, फिर
**Actions → Deploy web app → Run workflow** दबाएँ। ऐप यहाँ मिलेगा:
`https://aditrikaushik.github.io/Guardian/`

**विकल्प B — Cloudflare Pages (private repo के लिए भी मुफ़्त):**
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → यही repo चुनें,
build command ख़ाली, output directory `web`। फिर `wrangler.toml` के `ALLOWED_ORIGINS` में
नया `https://….pages.dev` पता जोड़कर `npx wrangler deploy` दोबारा चलाएँ।
Cloudflare Pages `web/_headers` वाले security headers भी लगाता है (GitHub Pages नहीं लगाता), इसलिए यह ज़्यादा सुरक्षित विकल्प है।

क़ानूनी पेज ऐप के साथ ही ऑनलाइन हो जाते हैं, जैसे `https://aditrikaushik.github.io/Guardian/legal/privacy.html` —
ये चारों लिंक Razorpay को दें।

## कदम 6 — Android ऐप

`android/app/src/main/java/org/guardian/buddy/Config.java` खोलें:

```java
API_BASE = "https://nanha-school-api.आपका-नाम.workers.dev";       // कदम 2 वाला पता (https:// ज़रूरी)
PUBLIC_KEY_SPKI = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…";      // genkeys की तीसरी चीज़
PAY_PAGE_URL = "https://aditrikaushik.github.io/Guardian/pay.html";
PRICE_TEXT = "₹99 / महीना";                                     // Razorpay plan जैसा ही
TRIAL_DAYS = 7;                                                 // wrangler.toml के TRIAL_DAYS जैसा ही
FREE_TILES = {"ABC", "गिनती"};                                  // ट्रायल के बाद हमेशा मुफ़्त
FREE_RHYMES = 2;
```

- `API_BASE`, `PAY_PAGE_URL` (दोनों `https://`) और `PUBLIC_KEY_SPKI` भरे बिना Android ऐप में payments बंद रहते हैं — सब मुफ़्त।
- **`PAY_PAGE_URL`** आपके वेब ऐप का `pay.html` है (कदम 5 में वह साथ ही ऑनलाइन हो जाता है)। वेब ऐप Cloudflare Pages या अपने डोमेन पर
  है तो यह पता भी वही करें, जैसे `https://nanha-school.pages.dev/pay.html`।
- **भुगतान कैसे होता है:** ऐप Worker से सब्सक्रिप्शन बनवाता है और फ़ोन का ब्राउज़र `pay.html#s=<subscription_id>&k=<key_id>` पर खोलता है।
  माता-पिता वहाँ Razorpay के पेज पर भुगतान करते हैं — कार्ड, UPI, फ़ोन, ईमेल ऐप तक कभी नहीं आते।
- **Deep link:** भुगतान के बाद `pay.html` "ऐप पर वापस जाएँ" दिखाता है, जो `nanhaschool://open` (package `org.guardian.buddy`) से ऐप खोलता है।
  ऐप फिर रिस्टोर कोड से Worker पर भुगतान पक्का करता है और प्रीमियम खोल देता है। अगर कभी `applicationId` बदलें, तो `web/pay.js` का
  `APP_LINK` और `AndroidManifest.xml` का deep link भी बदलें।
- Android ऐप Worker को कोई `Origin` नहीं भेजता, इसलिए `ALLOWED_ORIGINS` में कुछ जोड़ने की ज़रूरत नहीं।

फिर push करें — **Actions → Baat Buddy APK** नया APK बनाकर Releases में डाल देगा।

## कदम 7 — Android APK पर अपना हस्ताक्षर (release signing)

अभी Actions वाला APK एक **debug key** से साइन होता है (Actions में `Debug-signed APK` warning दिखती है)। Debug build में कोई भी USB से
ऐप का डेटा पढ़ सकता है, और हर build की key अलग हो सकती है — बेचने से पहले अपनी key बनाएँ (कारण: [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) भाग 4)।

**1. Keystore बनाएँ** (Java/JDK के साथ आने वाला `keytool`; यह passwords और नाम पूछेगा):

```bash
keytool -genkeypair -v -keystore nanha-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nanha
```

नए Java में keystore PKCS12 होता है, जिसमें key password वही होता है जो keystore password — दोनों secrets में वही डालें।

**2. उसे base64 में बदलें:**

```bash
base64 -w0 nanha-release.jks > keystore.b64              # Linux
base64 -i nanha-release.jks -o keystore.b64              # macOS
```

Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("nanha-release.jks")) | Set-Content keystore.b64`

**3. GitHub में 4 secrets डालें:** repo की **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | क्या डालें |
|--------|-----------|
| `ANDROID_KEYSTORE_BASE64` | `keystore.b64` फ़ाइल का पूरा text |
| `ANDROID_KEYSTORE_PASSWORD` | keystore का password |
| `ANDROID_KEY_ALIAS` | `nanha` (ऊपर `-alias` वाला नाम) |
| `ANDROID_KEY_PASSWORD` | key का password (PKCS12 में keystore वाला ही) |

फिर `keystore.b64` मिटा दें। अगले push पर Actions **signed release APK** (minified, non-debuggable) बनाएगा और उसे पहले की तरह
`BaatBuddy.apk` नाम से Releases में डालेगा। Secrets न हों (जैसे किसी fork के pull request में) तो वह पहले जैसा debug APK बनाता है।

अपने कंप्यूटर पर release बनाना हो तो वही चार नाम environment variables में दें (`ANDROID_KEYSTORE_FILE` = `.jks` फ़ाइल का पता) और
`./gradlew assembleRelease` चलाएँ।

> ⚠️ **Keystore और उसके passwords का backup ज़रूर रखें** (जैसे password manager + एक offline copy)। Keystore खो गई तो उसी ऐप का
> update कभी नहीं बन पाएगा — सबको ऐप हटाकर नया install करना होगा। Keystore को कभी git में commit न करें।

> **एक बार uninstall ज़रूरी:** पहले से debug APK चला रहे फ़ोन पर नया signed APK सीधे install नहीं होगा (key अलग है)। पुराना ऐप
> एक बार uninstall करें, फिर नया install करें। Uninstall से ऐप का डेटा मिटता है — सब्सक्राइब किया हो तो पहले रिस्टोर कोड कॉपी कर लें
> और नए ऐप में "वापस पाएँ" में डालें।

## कदम 8 — जाँचें

1. Test Mode keys के साथ ऐप खोलें। नीचे "🎁 मुफ़्त ट्रायल: 7 दिन बाकी" दिखना चाहिए।
2. ट्रायल ख़त्म होने की जाँच के लिए: ब्राउज़र के DevTools → Console में चलाएँ
   `localStorage.setItem('ns_trial', Date.now() - 8*86400000)` और पेज रीलोड करें — 🔒 दिखने चाहिए।
3. 🔒 दबाएँ → सवाल का जवाब → Razorpay के test UPI/कार्ड से भुगतान → सब खुल जाना चाहिए, और रिस्टोर कोड दिखना चाहिए।
4. दूसरे ब्राउज़र/फ़ोन में "वापस पाएँ" में वह कोड डालें → प्रीमियम खुलना चाहिए। फिर "सब्सक्रिप्शन रद्द करें" भी आज़माएँ।
5. Android पर भी यही करें: भुगतान ब्राउज़र में होगा, फिर "ऐप पर वापस जाएँ" से ऐप खुलकर प्रीमियम चालू होना चाहिए।
6. सब ठीक हो तो `wrangler.toml` और secrets में **Live** keys डालें और `npx wrangler deploy` करें। Test Mode के सब्सक्रिप्शन Live
   में नहीं होते, इसलिए Test में बने रिस्टोर कोड Live में काम नहीं करेंगे — यह सामान्य है।

## रिस्टोर कोड — अगर किसी माता-पिता का कोड खो जाए

माता-पिता अपनी Razorpay रसीद की जानकारी (भुगतान ID `pay_…` या सब्सक्रिप्शन ID `sub_…`, तारीख़, राशि) के साथ आपसे संपर्क करेंगे
(`contact.html` यही बताता है)। Razorpay dashboard में उनका सब्सक्रिप्शन ढूँढें और पक्का करें कि भुगतान उन्हीं का है, फिर:

```bash
cd server
read -rs RESTORE_SECRET && export RESTORE_SECRET   # Worker वाला RESTORE_SECRET चिपकाएँ (दिखेगा नहीं, history में नहीं जाएगा)
npm run restore-code -- sub_XXXXXXXXXXXX
```

यह उसी सब्सक्रिप्शन का रिस्टोर कोड छापता है (`sub_….` + 16 अक्षर)। इसे सिर्फ़ उसी माता-पिता को भेजें — यह पासवर्ड जैसा है।
Secret कभी command में सीधे न लिखें।

## सुरक्षा — क्या सुरक्षित है और क्या नहीं

- Razorpay का **Key Secret सिर्फ़ Worker में** रहता है; ऐप के कोड में कोई secret नहीं।
- कार्ड, UPI, फ़ोन और ईमेल **Razorpay के पेज पर** भरे जाते हैं, ऐप या Worker तक कभी नहीं आते। Worker में कोई डेटाबेस या निजी डेटा का log नहीं।
- हर पेमेंट Razorpay के हस्ताक्षर से जाँचा जाता है, फिर Razorpay से पूछकर पक्का किया जाता है।
- ऐप को मिला "पास" हस्ताक्षर वाला होता है — ब्राउज़र या फ़ोन में छेड़छाड़ करके नकली पास नहीं बन सकता।
- रिस्टोर कोड में कोई निजी जानकारी नहीं; पर जिसके पास कोड है वह प्रीमियम खोल सकता है (और आगे का नवीनीकरण रद्द कर सकता है) — पासवर्ड की तरह रखें।
- बच्चे का कोई निजी डेटा नहीं लिया जाता।
- Android: सिर्फ़ HTTPS, ऐप का डेटा backup में नहीं जाता, "बड़ों के लिए" screens का screenshot नहीं बनता।

**सीमाएँ (ईमानदारी से):**
- ट्रायल फ़ोन/ब्राउज़र पर गिना जाता है। कोई ब्राउज़र का डेटा मिटा दे तो ट्रायल फिर से शुरू हो सकता है।
  बच्चों को ट्रैक न करने के लिए यह जान-बूझकर ऐसा रखा है।
- ऐप का कोड माता-पिता के फ़ोन पर चलता है; बहुत तकनीकी व्यक्ति कोड बदलकर ताला हटा सकता है।
  यह हर ऐप के साथ होता है — इस कीमत के प्रोडक्ट के लिए यह सामान्य और स्वीकार्य है।
- कदम 7 से पहले का debug APK कमज़ोर है (USB से ऐप का डेटा पढ़ा जा सकता है)।

पूरी जानकारी — डेटा का नक्शा, network flow, keys बदलना, कुछ लीक हो तो क्या करें, और लॉन्च से पहले की checklist:
**[SECURITY_PRIVACY.md](SECURITY_PRIVACY.md)**

## बेचने से पहले ज़रूरी

- **कविताओं के अधिकार:** "चंदा मामा दूर के" और "नानी तेरी मोरनी" पुरानी फ़िल्मों के गाने माने जाते
  हैं। बेचने से पहले सभी कविताओं के अधिकार जाँचें, या उन्हें अपनी/लाइसेंस वाली कविताओं से बदलें।
- **बच्चों की privacy के क़ानून:** भारत (DPDP Act), अमेरिका (COPPA), यूरोप (GDPR) — `web/legal/privacy.html` में यह पहले से
  साफ़ लिखा है कि बच्चे का डेटा नहीं लिया जाता। Placeholders भरें और वकील से जँचवाएँ (कदम 4)।
- **Android APK:** GitHub Releases वाला APK अब Razorpay से सब्सक्रिप्शन लेता है। बेचने से पहले release signing (कदम 7) ज़रूर करें।
  Play Store पर डालना हो तो पहले देखें कि डिजिटल सब्सक्रिप्शन के लिए Google Play Billing के कौन-से नियम लागू होते हैं।
- **लॉन्च checklist:** [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) का भाग 6 पूरा करें।
