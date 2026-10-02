# नन्हा स्कूल — Handover (हैंडओवर)

*अपडेट: 2 अक्टूबर 2026 · आख़िरी merge: PR #12 (`main` @ 3caa7f7)*

यह फ़ाइल प्रोजेक्ट सँभालने वाले किसी भी व्यक्ति (या AI सहायक) के लिए शुरुआत की जगह है:
क्या बना है, कहाँ है, कैसे चलता है, क्या बाकी है।

---

## 1. एक नज़र में

**नन्हा स्कूल** 2–6 साल के बच्चों के लिए हिंदी-पहले (Hindi-first), तस्वीर और आवाज़ से सीखने वाला ऐप है।
बच्चे पढ़ना नहीं जानते, इसलिए हर चीज़ बोलकर बताई जाती है। मक़सद: खेल-खेल में पढ़ाई, अच्छी आदतें
और समय की कीमत, और आने वाली दुनिया (AI, robots, AR) की तैयारी, बिना भाषण दिए।

| चीज़ | पता |
|------|-----|
| Repo | https://github.com/AditriKaushik/Guardian (branch `main`) |
| वेबसाइट (PWA) | https://aditrikaushik.github.io/Guardian/ |
| Android APK | https://github.com/AditriKaushik/Guardian/releases/download/baat-buddy-latest/BaatBuddy.apk |

**मूल सिद्धांत (इन्हें मत तोड़िए):**
1. **सारा निजी डेटा सिर्फ़ डिवाइस पर।** बच्चे की प्रोफ़ाइल, प्रगति और सेटिंग्स कभी सर्वर पर नहीं जातीं।
   हमारा सर्वर ईमेल या फ़ोन नंबर नहीं लेता। भुगतान की जानकारी सिर्फ़ Razorpay के पेज पर भरी जाती है।
2. **एक ही कोड, हर प्लेटफ़ॉर्म।** `web/` ही असली ऐप है। Android उसे WebView में चलाता है।
   iPhone, Windows और कंप्यूटर पर यही वेब ऐप PWA की तरह install होता है।
3. **बच्चों पर दबाव नहीं।** न streak, न उल्टी गिनती, न डाँट, न विज्ञापन, न tracking।
   15 मिनट बाद प्यार से आराम का सुझाव। रात को सोने का रास्ता।
4. **बिना इंटरनेट चलता है।** सिर्फ़ भुगतान और (वैकल्पिक) AI बातचीत को इंटरनेट चाहिए।

---

## 2. क्या-क्या बना है

**होम:** असली समय के साथ बदलता आसमान, मिट्ठू तोता (साँस, पलक, भाव), चार सेक्शन:

| सेक्शन | गतिविधियाँ |
|--------|-------------|
| सीखो | ABC, अक्षर (वर्णमाला), गिनती, लिखना सीखो (76 अक्षर/अंक, stroke order), दुनिया देखो (रंग, आकार, जानवर, फल, वाहन, शरीर, अच्छी बातें) |
| अच्छी आदतें | मेरा दिन (घड़ी वाली दिनचर्या), मेरा बगीचा (आदतों से पौधे बढ़ते हैं), कहानी समय (11 मौलिक कहानियाँ), बड़े होकर (16 सपने), ध्यान (याददाश्त, साँस वाला गुब्बारा) |
| खेलो | मिट्ठू से बात, कविताएँ (मौलिक/सार्वजनिक), पहचानो (quiz), रंग भरो और चित्र बनाओ, संगीत (ज़ाइलोफ़ोन, ढोलक), पहेली जोड़ो |
| कल की दुनिया | रोबो दोस्त (AI कैसे सीखता है, coding, साफ़ सवाल), जादुई खिड़की (AR जैसा; कैमरा सिर्फ़ 4+ और माता-पिता की अनुमति से), भविष्य की सैर (9 यात्राएँ) |

**साथ में:** हर बच्चे की अलग प्रोफ़ाइल (डिवाइस पर), स्टिकर किताब, दीदी/भैया आवाज़,
हिंदी/English/Hinglish, बड़ों का हिस्सा (गुणा वाले सवाल के पीछे: सारांश, सेटिंग्स, डेटा मिटाना, सब्सक्रिप्शन),
281 असली जैसी 3D तस्वीरें, हल्की आवाज़ें और vibration।

**मिट्ठू (बात करने वाला दोस्त):**
- बिना इंटरनेट: नियम वाला दिमाग (`web/js/brain/brain.js`) + 643 सवालों का ज्ञान (`knowledge.js`)।
  समय देखकर खाना/सोना/खेलना/पढ़ाई की याद, बोलकर भाषा बदलना, सुरक्षा जवाब (1098 या 112)।
- वैकल्पिक AI (`/api/chat`): Workers AI या Claude Haiku। माता-पिता की सहमति से, 2–3 साल के लिए कभी नहीं,
  नाम या निजी जानकारी कभी नहीं भेजी जाती, रोज़ की सीमा, ईमानदार कि वह कंप्यूटर है।

**सब्सक्रिप्शन:** 7 दिन मुफ़्त ट्रायल (बिना कार्ड), फिर ₹99/महीना (वैकल्पिक ₹599/साल)।
ABC, अक्षर, गिनती, 2 कविताएँ, मेरा दिन और मिट्ठू हमेशा मुफ़्त। **अभी बंद है** जब तक keys नहीं डालीं।

---

## 3. कोड कहाँ है

```
web/                     असली ऐप (HTML/CSS/JS, कोई build step नहीं)
  index.html             scripts का क्रम (बदलें तो सोचकर)
  config.js              मालिक की सेटिंग्स: API_BASE, PUBLIC_KEY_JWK, कीमतें, मुफ़्त पाठ, AI
  app.css                पूरा डिज़ाइन
  js/core/               ढाँचा: ns, store, voice, sfx, rewards, billing, ai, ui
  js/modules/            हर गतिविधि एक फ़ाइल (NS.registerActivity)
  js/content/            पाठ, कविताएँ, कहानियाँ, तस्वीरों की सूची (images.js)
  js/brain/              मिट्ठू: brain.js, knowledge.js
  img/real/              3D तस्वीरें (+ CREDITS.txt, MIT licence)
  pay.html, pay.js       Android वाला भुगतान पेज
  legal/                 गोपनीयता, नियम, रिफ़ंड, संपर्क (placeholders भरने हैं)
android/                 WebView shell + NanhaNative bridge (आवाज़, mic, कैमरा, vibration)
server/                  Cloudflare Worker: भुगतान जाँच, restore code, /api/chat
tools/e2e/e2e.mjs        पूरे ऐप की browser जाँच (187 checks)
tools/test/              unit tests
tools/voice/             रिकॉर्डिंग स्क्रिप्ट (2,476 लाइनें) और clips का manifest
tools/images/            तस्वीरें लाने/बदलने के scripts
docs/                    सारे दस्तावेज़ (नीचे)
guardian/, tests/        पुराना Python "Guardian" toolkit (ऐप से अलग; CI में उसके tests चलते हैं)
```

**दस्तावेज़:**

| फ़ाइल | किस बारे में |
|-------|---------------|
| `docs/ARCHITECTURE.md` | ढाँचा, module contract (`ctx`), events, native bridge |
| `docs/SUBSCRIPTION_SETUP.md` | Razorpay + Cloudflare + keys + release signing, क़दम-दर-क़दम |
| `docs/SECURITY_PRIVACY.md` | data map, सुरक्षा, keys बदलना, incident, launch checklist |
| `docs/AI_BUDDY.md` | AI बातचीत: provider, ख़र्च, सुरक्षा, क़ानून |
| `docs/VOICE.md` | इंसानी आवाज़ रिकॉर्ड करवाना, neural voices |
| `docs/IMAGES.md` | तस्वीरें, licence, असली फ़ोटो का तरीका |
| `docs/ROADMAP.md` | 12 महीने / 3 साल / 10–15 साल की योजना (88 स्रोत) |

---

## 4. चलाना और जाँचना

```bash
# वेब ऐप लोकल चलाएँ
cd web && python3 -m http.server 8000        # http://localhost:8000

# unit tests (Node 22 पर glob ज़रूरी)
node --test "tools/test/**/*.test.mjs" "tools/voice/test/*.test.mjs"

# सर्वर tests
cd server && node --test

# पूरा browser e2e (Playwright + Chromium चाहिए)
PW_PATH=$(npm root -g)/playwright node tools/e2e/e2e.mjs
```

Android: Android Studio में `android/` खोलें या `cd android && ./gradlew assembleDebug`।
`web/` फ़ोल्डर अपने-आप APK के अंदर assets में जाता है।

**CI (GitHub Actions)** — हर push पर:
- `ci.yml`: Python tests
- `web.yml`: unit + e2e
- `server.yml`: सर्वर tests
- `android.yml`: Android tests + APK बनाकर `baat-buddy-latest` रिलीज़ में डालना। ध्यान दें: **किसी भी ब्रांच** पर push से
  रिलीज़ वाला APK बदल जाता है, इसलिए अधूरा काम push न करें।
- `pages.yml`: `main` पर `web/` बदलने पर वेबसाइट deploy
- `voice.yml`: (हाथ से चलाएँ) neural आवाज़ clips बनाना

**आख़िरी स्थिति:** e2e 187/187, unit 174 (+2 browser-only), server 72, Android 26 — सब हरे।

---

## 5. मालिक को क्या करना है (अभी बाकी)

**भुगतान चालू करने के लिए** (`docs/SUBSCRIPTION_SETUP.md`):
1. Razorpay खाता + KYC, ₹99/महीना plan (और चाहें तो ₹599/साल)।
2. Cloudflare खाता, `server/` से `npm run genkeys`, secrets डालें
   (`RAZORPAY_KEY_SECRET`, `SIGNING_KEY_JWK`, `RESTORE_SECRET`), `npx wrangler deploy`।
3. `web/config.js` में `API_BASE` और `PUBLIC_KEY_JWK`; `android/.../Config.java` में `PUBLIC_KEY_SPKI`।
4. `web/legal/` के सारे `[ ]` placeholders भरें, वकील से जँचवाएँ, Razorpay को links दें।

**AI बातचीत** (`docs/AI_BUDDY.md`): `server/wrangler.toml` में `[ai]` / `binding = "AI"` चालू करके deploy।
पहले असली बच्चों जैसे सवालों से Hindi की गुणवत्ता परखें।

**Android release signing:** keystore बनाएँ, 4 GitHub secrets डालें
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)।
**Keystore का backup रखें** — खो गया तो update नहीं दे पाएँगे। तब तक APK debug-signed है (कम सुरक्षित)।

**इंसानी आवाज़:** `tools/voice/RECORDING_SCRIPT.md` की लाइनें एक महिला और एक पुरुष कलाकार से
रिकॉर्ड करवाएँ (लिखित सहमति/contract के साथ), फिर `tools/voice/build-manifest.mjs`।

---

## 6. जाँचना बाकी (असली फ़ोन/खाते पर)

यह सब कोड और browser में जाँचा गया है, **असली फ़ोन पर नहीं:**
- Android पर आवाज़ें (दीदी/भैया का पहचानना नाम के अंदाज़े पर है), mic, कैमरा, vibration, edge-to-edge।
- भुगतान का पूरा चक्कर: ब्राउज़र में Razorpay → `nanhaschool://open` से वापसी → प्रीमियम चालू।
  पहले **Test Mode** keys से करें। Razorpay के असली checkout के साथ CSP भी देखें।
- AI provider (Workers AI / Claude) असली keys के साथ।
- Neural voice workflow (`voice.yml`) GitHub पर कभी नहीं चला।
- कुछ हिंदी अक्षरों का stroke order (च, ज, घ, थ, ध, य, ल, श, ह, ऋ, ए) स्कूल-दर-स्कूल अलग होता है —
  किसी शिक्षक से जँचवाएँ।

---

## 7. ज्ञात सीमाएँ और जोखिम

- **ट्रायल हर डिवाइस पर गिना जाता है;** डेटा मिटाने से फिर शुरू हो सकता है (बच्चों को track न करने के लिए जान-बूझकर)।
- **Client code बदला जा सकता है** (हर वेब ऐप की तरह); नकली pass नहीं बन सकता।
- **Google Play पर** डिजिटल सब्सक्रिप्शन के लिए Play Billing ज़रूरी है — Razorpay वाला flow सिर्फ़ वेब, सीधा APK और Indus Appstore के लिए।
- **AI साथी 6 साल से छोटे बच्चों के लिए जोखिम भरा** माना गया है (Common Sense, UNICEF 2026) — इसलिए सख़्त सीमाएँ हैं; ढील न दें।
- **क़ानून:** DPDP (भारत, मुख्य नियम 13 मई 2027 से), COPPA (अमेरिका), GDPR — लॉन्च से पहले वकील।
- **तस्वीरें** 3D ड्रॉइंग हैं, फ़ोटो नहीं। कमज़ोर मिलान (ठेला, ओस, ढोल, थाली, तोता…) `docs/IMAGES.md` में।
- **कविताएँ:** फ़िल्मी गाने ("चंदा मामा", "नानी तेरी मोरनी") जान-बूझकर हटाए गए — दोबारा न डालें।

---

## 8. अगले कदम (सुझाव, `docs/ROADMAP.md` से)

1. असली फ़ोन पर जाँच + Test Mode भुगतान → release-signed APK → Play Store (Families + Teacher Approved के लिए आवेदन)।
2. सबसे ज़्यादा बजने वाली ~300 लाइनें इंसानी आवाज़ में रिकॉर्ड करवाएँ।
3. 40–60 बच्चों के साथ 8 हफ़्ते का pilot (माता-पिता की लिखित सहमति), सीखने का असर नापें।
4. माता-पिता के लिए हफ़्ते की टिप; WhatsApp Channel और YouTube Shorts से बिना ख़र्च के प्रचार।
5. नई भाषाएँ: मराठी/बांग्ला → तेलुगु/तमिल (मूल लेखक + AI4Bharat tools + दो native reviewers)।

---

## 9. डेवलपर के लिए नियम (नया काम जोड़ते समय)

- नई गतिविधि = `web/js/modules/<id>.js` में `NS.registerActivity({...})`, और `index.html` + `sw.js` में फ़ाइल जोड़ें।
  `ctx` contract `docs/ARCHITECTURE.md` में है।
- DOM में सिर्फ़ `textContent` (कभी `innerHTML` नहीं)। हर निर्देश बोलकर भी (`ctx.say`)। डेटा सिर्फ़ `ctx.data` से।
- कोई network call, analytics या third-party SDK नहीं (भुगतान और `/api/chat` को छोड़कर)।
- `web/index.html` की CSP बदलें तो `android/.../Config.java` का `CONTENT_SECURITY_POLICY` भी वही करें (test जाँचता है)।
- बटन ≥ 56px, बीच में ≥ 8px; e2e layout probe 6 साइज़ पर जाँचता है।
- सामग्री बदलें तो `node tools/voice/extract-lines.mjs` चलाएँ (रिकॉर्डिंग स्क्रिप्ट अपडेट)।
- push से पहले: unit + server + e2e हरे होने चाहिए।
