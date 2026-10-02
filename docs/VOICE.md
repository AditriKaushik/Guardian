# नन्हा स्कूल — आवाज़ (Voice)

ऐप हर निर्देश बोलकर बताता है, क्योंकि 2–6 साल के बच्चे पढ़ नहीं सकते। यह दस्तावेज़ बताता है कि
ऐप की आवाज़ **इंसानी** कैसे बने — एक **महिला** और एक **पुरुष** आवाज़ के साथ — और फ़ोन/ब्राउज़र
की आवाज़ सिर्फ़ fallback रहे।

## 1. इंसानी आवाज़ ही क्यों?

- छोटे बच्चे (preschoolers) इंसानी, भावों से भरी (expressive) आवाज़ को synthetic आवाज़ से बेहतर
  समझते और याद रखते हैं। हमारी research में यही बात सामने आई: robotic या सपाट आवाज़ में बच्चे
  जल्दी ध्यान खो देते हैं, शब्द कम पकड़ते हैं, और निर्देश (जैसे "लाल वाला छुओ") कम मानते हैं।
- बच्चे आवाज़ के **उतार-चढ़ाव (prosody)**, मुस्कान और ठहराव से अर्थ समझते हैं — कविता की लय,
  कहानी का रोमांच, "शाबाश!" की ख़ुशी। फ़ोन की TTS आवाज़ यह ठीक से नहीं कर पाती, ख़ासकर हिंदी में।
- इसलिए क्रम यह है: **रिकॉर्ड की गई इंसानी आवाज़ > अच्छी neural आवाज़ > फ़ोन/ब्राउज़र की आवाज़।**

## 2. ऐप आवाज़ कैसे चुनता है (clip → phone voice → browser voice)

यह सब `web/js/core/voice.js` करता है; यहाँ सिर्फ़ समझने के लिए:

1. **Clip (MP3)** — अगर `web/audio/manifest.json` है और उसमें यह पंक्ति है, तो रिकॉर्ड की गई clip
   बजती है। पहले बच्चे की प्रोफ़ाइल वाली आवाज़ (female/male) देखी जाती है; वह न हो तो दूसरी
   इंसानी आवाज़ की clip (कोई भी इंसानी आवाज़ robot से बेहतर है)।
   - पहले **पूरी पंक्ति** की clip ढूँढी जाती है, फिर हर छोटे वाक्यांश (phrase) की।
   - Clip 30 सेकंड से लंबी न हो (ऐप 30 s पर रोक देता है) — `build-manifest` चेतावनी देता है।
   - Clips पहली बार बजने पर service worker cache में जाती हैं (पहले से download नहीं होतीं)।
2. **Android फ़ोन की आवाज़** — Android shell (`window.NanhaNative`) में फ़ोन की सबसे अच्छी
   on-device आवाज़, gender और भाषा के हिसाब से।
3. **Browser की आवाज़** — Web Speech API, on-device आवाज़ पहले।

जिन पंक्तियों में बच्चे का नाम या कोई बदलने वाली चीज़ है (`{name}` जैसे placeholder), वे
हमेशा फ़ोन/ब्राउज़र की आवाज़ से बोली जाती हैं — उनकी clip नहीं बनती।

### Manifest का format

```json
{"version":1,"clips":{
  "female":{"hi|अ से अनार":"audio/female/hi/hi-0007.mp3","en|A for Apple":"audio/female/en/en-0004.mp3"},
  "male":{"hi|अ से अनार":"audio/male/hi/hi-0007.mp3"}}}
```

Key = `<lang>|<normalized text>`:
- `lang` = बोलने की भाषा, `"hi"` या `"en"` (`NS.speechLang`; Hinglish हिंदी आवाज़ में बोली जाती है → `hi`)।
- normalized text = `NS.stripEmoji(text)`: emoji/pictographs (और उनके joiners/modifiers) हटाकर
  space, whitespace को एक space, आगे-पीछे trim। Punctuation, "·" और case जैसे हैं वैसे रहते हैं।
- `tools/voice/normalize.mjs` यही नियम दोहराता है, और `tools/voice/test` जाँचता है कि वह
  `web/js/core/ns.js` से हूबहू मेल खाता है। **`ns.js` का नियम बदले तो `normalize.mjs` भी बदलें।**

## 3. Recording script बनाना (`extract-lines.mjs`)

```bash
node tools/voice/extract-lines.mjs
```

यह ऐप की सारी classic scripts (`web/js/**`) को `node:vm` sandbox में चलाकर हर **स्थिर (fixed)**
बोली जाने वाली पंक्ति इकट्ठा करता है और लिखता है:

- `tools/voice/lines.csv` — `id,lang,text` (voice artist के लिए recording list; Excel/Sheets में खुलती है)
- `tools/voice/RECORDING_SCRIPT.md` — वही पंक्तियाँ, section के हिसाब से (careers › डॉक्टर, stories › …), print करने लायक

पंक्तियाँ कहाँ से आती हैं:
- `NS.content` (web/js/content/*.js) — हर `hi` / `en` / `hinglish` string, और `speak`, `say`,
  `text`, `lines`, `pages`, `question`, `options`, `title`, `name` … जैसी keys की strings।
  `get()` / `cards()` / `items()` जैसे बिना-argument वाले functions चलाकर उनका नतीजा भी।
- `NS.registerActivity` के tile titles।
- **`NS.voiceLines`** — UI के स्थिर वाक्य (शाबाश, "फिर से कोशिश करो", buddy की बातें) जो content
  data में नहीं हैं। **Convention:** कोई भी module/core file अपनी fixed lines ऐसे जोड़े:

  ```js
  NS.voiceLines = (NS.voiceLines || []).concat([
    { lang: "hi", text: "शाबाश! बहुत बढ़िया।", section: "praise" },
    { lang: "en", text: "Try again!" },
  ]);
  ```

  यह सिर्फ़ data है; ऐप इसे पढ़ता नहीं, सिर्फ़ यह tool। Text वही होना चाहिए जो `ctx.say()` को
  दिया जाता है (emoji चलेंगे, वे key में हट जाते हैं)।

IDs स्थिर रहते हैं: जो पंक्ति पहले से `lines.csv` में है उसका id नहीं बदलता; नई पंक्ति को
अगला नंबर मिलता है (`hi-0001`, `en-0001` …)। Content बदलने के बाद बस tool दोबारा चलाएँ —
सिर्फ़ नई पंक्तियाँ रिकॉर्ड करनी होंगी।

## 4. Recording कैसे करें (voice artist के लिए)

**दो कलाकार:** एक महिला, एक पुरुष। दोनों पूरी list रिकॉर्ड करें (हिंदी और English दोनों)।

कमरा और फ़ोन:
- **शांत कमरा** — पंखा/AC/कूलर बंद, खिड़की बंद। पर्दे, गद्दे, कपड़ों से भरी अलमारी गूँज (echo)
  कम करते हैं; ख़ाली, टाइल वाला कमरा या बाथरूम नहीं।
- फ़ोन का साधारण **Voice Recorder app** काफ़ी है। Setting में सबसे अच्छी quality / WAV या
  M4A चुनें (कम quality "voice memo" mode नहीं)। फ़ोन को **Airplane mode** पर रखें।
- फ़ोन मुँह से लगभग **20–30 cm (एक बित्ता)** दूर, मुँह के सामने थोड़ा तिरछा (सीधी साँस mic पर न जाए)।
  पूरी recording में दूरी एक जैसी रखें। फ़ोन को किसी किताब/stand पर रखें, हाथ में नहीं।

बोलना:
- **गर्मजोशी और भाव के साथ** — मुस्कुराकर, जैसे सामने कोई 3 साल का बच्चा बैठा हो।
  धीरे, साफ़, हर शब्द पूरा। सवाल सवाल जैसा, शाबाशी सच में ख़ुश होकर।
- कविताएँ लय में, कहानियाँ कहानी की तरह (आवाज़ बदलकर पात्र बोल सकते हैं, पर ज़्यादा नाटकीय नहीं)।
- हर पंक्ति के पहले और बाद में **आधा सेकंड चुप्पी**; शुरू/अंत की चुप्पी अपने-आप कट जाती है।
- ग़लती हो तो वही पंक्ति दोबारा बोलें और पुरानी फ़ाइल हटा दें — हर फ़ाइल में सिर्फ़ एक साफ़ take।
- 30–40 मिनट बाद आराम करें, पानी पिएँ; थकी आवाज़ बच्चों को सुनाई देती है।

फ़ाइलें:
- **एक पंक्ति = एक फ़ाइल**, नाम = id: `hi-0001.wav`, `en-0012.m4a` (wav, mp3, m4a, ogg, flac चलेंगे)।
- महिला: `tools/voice/recordings/female/`, पुरुष: `tools/voice/recordings/male/`।
- `RECORDING_SCRIPT.md` print करके हर पंक्ति के आगे ✓ लगाते जाएँ (F/M कॉलम)।
- Raw recordings git में नहीं जातीं (`tools/voice/.gitignore`) — उनका backup अलग से, निजी रखें।

**सहमति और अनुबंध (consent / contract) — ज़रूरी:**
- हर voice artist से **लिखित अनुबंध** करें: recordings का इस्तेमाल नन्हा स्कूल ऐप (web, Android,
  iPhone, आगे के versions और उसके प्रचार) में, सभी देशों में, बिना समय-सीमा; भुगतान की राशि;
  credit (नाम देना है या नहीं)।
- साफ़ लिखें कि उनकी आवाज़ से **AI voice clone / नया TTS model नहीं बनाया जाएगा**, जब तक वे अलग से
  लिखित अनुमति न दें।
- कलाकार 18+ हो। किसी बच्चे की आवाज़ रिकॉर्ड न करें।
- अनुबंध की copy और कलाकार की पहचान ऐप के बाहर सुरक्षित रखें (repo में नहीं)।

## 5. Clips बनाना (`build-manifest.mjs`)

```bash
node tools/voice/build-manifest.mjs            # ffmpeg चाहिए
node tools/voice/build-manifest.mjs --dry-run  # ffmpeg नहीं: सिर्फ़ मौजूद MP3s से manifest
```

- हर recording → `web/audio/<female|male>/<lang>/<id>.mp3`: **mono MP3, 48 kbps, 24 kHz**, आगे-पीछे
  की चुप्पी कटी, **loudness-normalised** (ffmpeg `loudnorm`, −16 LUFS) ताकि हर clip बराबर ज़ोर की हो।
  MP3 इसलिए कि Safari/iPhone, Android WebView और हर browser इसे चलाते हैं।
- सिर्फ़ नई/बदली recordings convert होती हैं (`--force` से सब)। ffmpeg न हो तो अपने-आप dry run।
- फिर `web/audio/manifest.json` लिखता है और बताता है कितनी पंक्तियाँ बाकी हैं, कुल MB, और कौन-सी
  पुरानी clips अब इस्तेमाल नहीं होतीं।
- ffmpeg: Windows पर `winget install ffmpeg`, Mac पर `brew install ffmpeg`, Ubuntu पर `sudo apt install ffmpeg`।
- फिर `web/audio/` commit करें। CI (`.github/workflows/web.yml`) जाँचता है कि manifest सही है और हर
  clip मौजूद है।

### Size budget

- 48 kbps ≈ **6 KB हर सेकंड**। औसत पंक्ति ~3 s ≈ 18 KB। ~750 पंक्तियाँ ≈ **13–14 MB एक आवाज़**, दोनों ≈ 27 MB।
- Clips पहली बार बजने पर ही download होती हैं, इसलिए बच्चे के फ़ोन पर उतना ही आता है जितना वह सुनता है।
- लक्ष्य: **एक आवाज़ ≤ 20 MB** (tool इससे ऊपर चेतावनी देता है)। ज़्यादा हो तो पहले लंबी कहानियों के
  पन्ने छोटे करें; `--bitrate 40k` भी बोलने के लिए ठीक है। 32k से नीचे न जाएँ।

## 6. Neural voice (वैकल्पिक) — `.github/workflows/voice.yml`

जब तक इंसानी recording नहीं है, अच्छी neural आवाज़ फ़ोन की आवाज़ से बेहतर हो सकती है। GitHub पर
**Actions → Neural voice clips → Run workflow** चुनें:

- `engine`: `indic-parler-tts` (default) या `kokoro`
- `voices`: both / female / male
- `limit`: पहले `5` रखकर सुनें; पसंद आए तो `0` (सब)

Workflow: `extract-lines` → हर आवाज़ के लिए 4 हिस्सों में `tools/voice/synth.py` (CPU) →
`build-manifest` → **`web-audio-<engine>` artifact**। यह कुछ भी commit नहीं करता: artifact download करें,
सुनें, अच्छा लगे तो `web/audio/` में रखकर ख़ुद commit करें। साथ में `web/audio/CREDITS.txt` बनता है।

इंसानी recording और neural एक साथ: `synth.py` पहले से मौजूद फ़ाइल को कभी overwrite नहीं करता,
इसलिए कलाकार की recordings `tools/voice/recordings/` में हों तो सिर्फ़ बाकी पंक्तियाँ neural बनेंगी
(यह local चलाने पर; workflow हमेशा ख़ाली folder से शुरू होता है)।

### Licences (commercial use)

हमने सिर्फ़ वही engines रखे जिनकी licence commercial use की इजाज़त देती है। ⚠ इस sandbox से
huggingface.co/github.com नहीं खुलते, इसलिए licence model card की search में दिखी जानकारी से
पुष्टि की गई — **release से पहले model card एक बार ख़ुद खोलकर देख लें।**

| Engine / voice | Licence | Commercial? | हमारा फ़ैसला |
|---|---|---|---|
| **AI4Bharat Indic Parler-TTS** (`ai4bharat/indic-parler-tts`) — हिंदी: Divya (F) / Rohit (M); Indian English: Mary (F) / Thoma (M) | Apache-2.0 | ✅ हाँ | **शामिल (default)** |
| **Kokoro-82M** (`hexgrad/Kokoro-82M`) — हिंदी: hf_alpha (F) / hm_omega (M); English: af_heart / am_michael (American accent) | Apache-2.0 | ✅ हाँ | **शामिल** (हिंदी quality grade C; Indian English आवाज़ नहीं) |
| Piper `hi_IN-pratham` / `hi_IN-priyamvada` | CC BY-NC-SA 4.0 (reports) | ❌ नहीं | बाहर |
| Piper `hi_IN-rohan` | IIT Madras Indic TTS database licence (अलग PDF) | ❓ पुष्टि नहीं हो सकी | बाहर |
| Coqui XTTS-v2 | Coqui Public Model License (CPML) | ❌ सिर्फ़ non-commercial (Coqui बंद, commercial licence नहीं मिलती) | बाहर |
| Meta MMS-TTS (`facebook/mms-tts-hin`) | CC-BY-NC 4.0 | ❌ नहीं | बाहर |
| AI4Bharat IndicF5 | MIT (reports) — पर यह voice cloning है, reference आवाज़ की स्पष्ट अनुमति चाहिए | ❓ | अभी बाहर; आगे सिर्फ़ अपने कलाकार की लिखित अनुमति से |

Attribution:
- Apache-2.0 बनी हुई audio पर attribution अनिवार्य नहीं करती, फिर भी हम `web/audio/CREDITS.txt`
  में model और licence लिखते हैं। अगर कभी model weights ख़ुद बाँटें (हम नहीं बाँटते), तो Apache-2.0
  का LICENSE/NOTICE साथ देना होगा।
- Kokoro की हिंदी pronunciation के लिए CI में `espeak-ng` (GPL-3.0) सिर्फ़ build tool की तरह चलता
  है; वह ऐप में नहीं जाता, इसलिए ऐप पर GPL लागू नहीं होती।
- Parler-TTS हर पंक्ति के लिए एक fixed seed इस्तेमाल करता है (वही पंक्ति = वही आवाज़)।

Sources:
- Indic Parler-TTS model card (Apache-2.0; speakers): https://huggingface.co/ai4bharat/indic-parler-tts
- Kokoro-82M (Apache-2.0) और VOICES.md: https://huggingface.co/hexgrad/Kokoro-82M , https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- Piper voices और MODEL_CARDs: https://huggingface.co/rhasspy/piper-voices , https://github.com/rhasspy/piper/discussions/271
- Piper rohan dataset licence: https://www.iitm.ac.in/donlab/indictts/downloads/license.pdf
- XTTS-v2 CPML: https://github.com/coqui-ai/TTS/discussions/4304
- MMS-TTS (CC-BY-NC-4.0): https://huggingface.co/facebook/mms-tts-hin
- IndicF5: https://github.com/AI4Bharat/IndicF5

## 7. Files

```
tools/voice/normalize.mjs        manifest key (mirrors NS.speechLang + NS.stripEmoji)
tools/voice/extract-lines.mjs    → lines.csv, RECORDING_SCRIPT.md
tools/voice/build-manifest.mjs   recordings → web/audio/**.mp3 + manifest.json
tools/voice/synth.py             neural voice (used by voice.yml)
tools/voice/test/                node --test "tools/voice/test/*.test.mjs"
tools/voice/recordings/          raw recordings (not in git)
web/audio/                       clips + manifest.json (+ CREDITS.txt for neural)
```
