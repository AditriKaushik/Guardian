# मिट्ठू की "खुली बातचीत" (AI) — मालिक के लिए गाइड

मालिक की माँग थी: "बातचीत सीमित है — इसे असीमित बनाओ; हो सके तो कोई मुफ़्त Claude या कोई और मुफ़्त AI जोड़ो, जो
2–4 साल के बच्चों से उनके स्तर पर, बिना किसी मानसिक दबाव के बात कर सके।" यह दस्तावेज़ बताता है कि यह कैसे बना है,
कितना ख़र्च आता है, इसे कैसे चालू करें, और बच्चों की सुरक्षा और privacy के लिए क्या-क्या किया गया है।

**एक लाइन में:** मिट्ठू अब कभी "समझ नहीं आया" पर नहीं अटकता — बिना इंटरनेट के भी वह सवाल पूछता है, खेल खिलाता है,
तथ्य और कहानी सुनाता है। इसके ऊपर एक **वैकल्पिक** online AI है, जो **हर फ़ोन पर बंद** रहता है जब तक माता-पिता
सहमति देकर उसे चालू न करें, **2–3 साल के बच्चों के लिए कभी नहीं** चलता, और जिसके लिए बच्चे का नाम, आवाज़ या
प्रोफ़ाइल कभी फ़ोन से बाहर नहीं जाती।

---

## 1. कौन जवाब देता है — क्रम (सुरक्षा पहले, offline पहले)

```
बच्चा बोलता/लिखता है
  │
  ├─ 1. offline दिमाग़ (web/js/brain/brain.js) — हमेशा पहले
  │     सुरक्षा (चोट, बुरे राज़, आत्म-हानि के शब्द → भरोसेमंद बड़ा + 1098 या 112; निजी जानकारी; अनजान लोग;
  │     दवा/चोट; बड़ों वाली या डरावनी बातें; गंदे शब्द), भावनाएँ, आदतें, गिनती/जोड़, भाषा बदलना,
  │     कोई खेल खोलना, चुटकुले-पहेली-कहानी, "तुम कौन हो / क्या तुम असली हो" (ईमानदार जवाब) …
  │     → समझ गया? यही जवाब। (कोई नेटवर्क नहीं)
  │
  ├─ 2. offline ज्ञान-कोश NS.Knowledge.answer (web/js/brain/knowledge.js, दूसरे agent का) — "आसमान नीला क्यों?" जैसे सवाल
  │
  ├─ 3. online AI (web/js/core/ai.js → हमारा सर्वर /api/chat → AI सेवा) — सिर्फ़ तब, जब
  │     • ऊपर के दोनों को जवाब न आया हो, • माता-पिता ने सहमति देकर चालू किया हो,
  │     • बच्चा 4–5 या 6+ उम्र-समूह का हो, • इंटरनेट हो, • आज की सीमा बाकी हो।
  │     इंतज़ार में छोटा-सा "सोच रहा हूँ…" (तीन उछलते बिंदु) दिखता है; AI वाले जवाब पर हल्का ✨ निशान होता है।
  │
  └─ 4. नहीं तो offline दिमाग़ खुद बातचीत आगे बढ़ाता है (कभी "समझ नहीं आया" दोहराता नहीं):
        "और बताओ!", आज के दिन के बारे में सवाल, कल्पना वाले सवाल ("चिड़िया बन जाओ तो कहाँ उड़ोगे?"),
        शब्दों का खेल/तुकबंदी/उलटा खेल, कोई रोचक तथ्य, समय के हिसाब से आदत वाला सुझाव,
        "क्यों/कैसे" वाले सवाल पर ईमानदारी से "मुझे पक्का नहीं पता — चलो किसी बड़े से पूछें!",
        और परिवार/खिलौने/खाने/प्रकृति की बात पर ध्यान से सुनने वाला सवाल (बच्चे के शब्द दोहराए बिना)।
        2–3 साल वालों के लिए छोटे-छोटे खेल ("ताली बजाओ", "नाक कहाँ है?"), रात में शांत बातें।
```

सुरक्षा वाले शब्द **कभी AI तक नहीं जाते** — इन्हें तीन जगह रोका जाता है: (1) offline दिमाग़ पहले ही जवाब दे देता है,
(2) `ai.js` फ़ोन पर ही रोक देता है, (3) सर्वर बिना मॉडल को बुलाए तय जवाब लौटा देता है।

## 2. कौन-सी AI सेवा? (तथ्य, अक्टूबर 2026 में जाँचे गए)

| विकल्प | कीमत | बच्चों के लिए डेटा नीति | फ़ैसला |
|---|---|---|---|
| **Cloudflare Workers AI** (हमारे Worker के साथ ही) | Free और Paid दोनों Workers plans में **10,000 Neurons/दिन मुफ़्त** (00:00 UTC पर reset); Free plan पर उसके बाद रुक जाता है, Paid पर $0.011 / 1,000 Neurons | Cloudflare ग्राहक की सामग्री (prompt/जवाब) से **कोई मॉडल ट्रेन नहीं करता**, अपनी या दूसरों की सेवाएँ सुधारने में इस्तेमाल नहीं करता, और Workers AI इसे सेव नहीं करता (जब तक आप खुद कोई storage न जोड़ें) | ✅ **डिफ़ॉल्ट सुझाव** — सबसे सस्ता, अक्सर मुफ़्त |
| **Anthropic Claude API** (`claude-haiku-4-5`, सबसे सस्ता मौजूदा मॉडल) | **कोई मुफ़्त tier नहीं** (नए खाते को बस थोड़ा trial credit); Haiku 4.5: $1 / 10 लाख input tokens, $5 / 10 लाख output tokens | API के डेटा पर **ट्रेनिंग नहीं** (Commercial Terms); inputs/outputs अधिकतम 30 दिन में अपने-आप मिटाए जाते हैं (Zero Data Retention समझौते पर बिल्कुल नहीं रखे जाते; "Covered Models" — Fable/Mythos, जो हम इस्तेमाल नहीं करते — पर 30 दिन ज़रूरी); Usage Policy उल्लंघन पर flag हुई बातचीत 2 साल तक रखी जा सकती है | ✅ विकल्प — थोड़ा बेहतर हिंदी/सुरक्षा, पर हर जवाब का पैसा |
| Google Gemini API का मुफ़्त tier | मुफ़्त | मुफ़्त tier के prompts/जवाब Google अपने products सुधारने में (human reviewers के साथ) इस्तेमाल करता है; और Gemini API की शर्तें **18 साल से कम उम्र वालों के लिए बने या उनके इस्तेमाल की संभावना वाले ऐप** में इस्तेमाल मना करती हैं | ❌ बच्चों के ऐप के लिए अस्वीकार्य |
| फ़ोन पर चलने वाला मॉडल (WebLLM / Chrome Prompt API–Gemini Nano / Android ML Kit Prompt API) | मुफ़्त, पूरी तरह offline | डेटा फ़ोन से बाहर नहीं जाता | ⏳ अभी डिफ़ॉल्ट लायक नहीं: Chrome का Prompt API Android पर उपलब्ध नहीं (सिर्फ़ desktop, ~22 GB जगह, 4 GB+ GPU); ML Kit Prompt API सिर्फ़ नए flagship फ़ोनों (Pixel 8 Pro+, Galaxy S24+) पर, alpha; WebLLM के छोटे मॉडल (0.5–3B) सैकड़ों MB डाउनलोड और 4–8 GB RAM माँगते हैं और उनकी हिंदी कमज़ोर है। आगे चलकर Android shell में ML Kit एक विकल्प हो सकता है। |

**Workers AI पर मॉडल** (Cloudflare की मॉडल सूची से जाँचे गए, सब deprecated नहीं):

| मॉडल ID | काम | कीमत | हिंदी |
|---|---|---|---|
| `@cf/google/gemma-4-26b-a4b-it` | **डिफ़ॉल्ट** जवाब देने वाला | $0.10 / M input, $0.30 / M output (9,091 / 27,273 Neurons प्रति M) | Gemma 4: 140+ भाषाओं पर pre-trained, हिंदी समर्थित; सोच-विचार (reasoning) हम बंद रखते हैं (`enable_thinking: false`) ताकि जवाब तेज़ और सस्ता रहे |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | विकल्प (`AI_MODEL`) | $0.293 / $2.253 प्रति M | Meta की आधिकारिक 8 भाषाओं में हिंदी |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | विकल्प (`AI_MODEL`) | $0.27 / $0.85 प्रति M | Meta की आधिकारिक 12 भाषाओं में हिंदी |
| `@cf/meta/llama-guard-3-8b` | **जवाब की सुरक्षा-जाँच** (हर बार, जब `AI` binding हो) | $0.484 / M input | 14 ख़तरा-श्रेणियाँ (S1–S14), हिंदी समेत 8 भाषाएँ |

> सुझाव: पहले Gemma 4 से असली बच्चों जैसे सवालों पर हिंदी जाँचें। हिंदी कमज़ोर लगे तो `wrangler.toml` में
> `AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"` कर दें (ख़र्च लगभग दोगुना, फिर भी बहुत कम)।

## 3. ख़र्च — एक AI जवाब कितने का?

एक AI जवाब में मॉडल को लगभग जाता है: नियम (system prompt, ~575 अंग्रेज़ी शब्द ≈ 900 tokens) + आख़िरी कुछ लाइनें
(≈ 300 tokens) ≈ **1,200–1,300 input tokens**, और जवाब ≈ **60–150 output tokens** (220 अक्षर की सीमा)।

| सेवा | एक जवाब | 1,000 जवाब | मुफ़्त में कितने? |
|---|---|---|---|
| Workers AI, Gemma 4 + Llama Guard | ≈ 35 Neurons (जवाब ≈ 14 + जाँच ≈ 21) ≈ **$0.0004** (≈ ₹0.03) | ≈ $0.40 | रोज़ ≈ **280 जवाब मुफ़्त** (पूरे ऐप के लिए) |
| Workers AI, Llama 3.3 70B + Llama Guard | ≈ 75 Neurons ≈ $0.0008 | ≈ $0.80 | रोज़ ≈ 130 |
| Claude Haiku 4.5 (+ Llama Guard, अगर `AI` binding हो) | ≈ $0.0013 input + $0.0005 output ≈ **$0.0018–0.0025** (≈ ₹0.15–0.20) | ≈ $2–2.5 | कोई नहीं |

एक बच्चे के हिसाब से (फ़ोन पर रोज़ ज़्यादा से ज़्यादा 30 AI जवाब; असल में ज़्यादातर बातें offline ही हो जाती हैं,
इसलिए आम तौर पर 5–10): Workers AI पर ≈ ₹0.15–0.30/दिन (अक्सर मुफ़्त allocation में), Claude पर ≈ ₹1–2/दिन
(≈ ₹30–60/महीना; रोज़ 30 पूरे करें तो ≈ ₹150/महीना) — ₹99 वाली सदस्यता के मुक़ाबले Claude महँगा पड़ सकता है,
इसलिए **Workers AI से शुरू करें**।

**Prompt caching:** Claude वाले request में नियमों वाला हिस्सा हर बार एक-सा रहता है (कोई तारीख़ या बच्चे की जानकारी
नहीं) और उस पर `cache_control` लगा है। पर Haiku 4.5 पर cache तभी बनता है जब prompt कम से कम **4,096 tokens** का हो —
हमारा छोटा prompt इससे नीचे है, इसलिए असल में cache नहीं बनता (और न ही कोई अतिरिक्त ख़र्च होता है)। छोटा prompt
ही सबसे सस्ता है; cache उन मॉडलों पर अपने-आप काम करेगा जिनकी न्यूनतम सीमा कम है।

## 4. चालू कैसे करें

1. **सर्वर पर AI सेवा चुनें** (`server/wrangler.toml`):
   - *Workers AI (सुझाया गया):* फ़ाइल के आख़िर में `# [ai]` और `# binding = "AI"` से `# ` हटाएँ, फिर
     `cd server && npx wrangler deploy`। Free Workers plan पर रोज़ 10,000 Neurons के बाद AI अपने-आप रुक जाता है (ऐप
     offline जवाब देता रहता है) — यह भी ख़र्च की एक पक्की सीमा है।
   - *Claude:* [Claude Console](https://platform.claude.com/) में API key बनाएँ, **monthly spend limit** लगाएँ, फिर
     `npx wrangler secret put ANTHROPIC_API_KEY`। key सिर्फ़ Worker secret में रहती है — git या `wrangler.toml` में कभी नहीं।
     key और `AI` binding दोनों हों तो जवाब Claude देता है और Llama Guard जाँच करता है (सबसे सुरक्षित)।
2. **सीमाएँ** (`wrangler.toml` के `[vars]` में): `AI_DAILY_LIMIT = "60"` (हर फ़ोन, हर दिन), `AI_GLOBAL_DAILY_LIMIT = "300"`
   (पूरा ऐप, हर दिन)। ये बिना database के, हर Cloudflare server instance की memory में गिने जाते हैं — इसलिए अनुमानित
   हैं; पक्की सीमा के लिए Claude Console का spend limit या Workers Free plan की 10,000 Neurons की सीमा रखें। झटकों
   (burst) से बचने के लिए `AI_RATE_LIMITER` वाला `[[ratelimits]]` block भी चालू करें (हर फ़ोन/IP पर मिनट में 12)।
3. **ऐप:** `web/config.js` में `API_BASE` आपका Worker पता हो (भुगतान वाला ही)। `AI: { ENABLED, DAILY_LIMIT: 30,
   SESSION_TURNS: 10, TIMEOUT_MS: 8000 }` — `ENABLED: false` करने पर विकल्प दिखता ही नहीं। Android ऐप का origin
   (`https://appassets.androidplatform.net`) पहले से `ALLOWED_ORIGINS` में है।
4. **जाँचें:**
   ```bash
   curl -s https://<आपका-worker>.workers.dev/api/chat -H 'Content-Type: application/json' \
     -d '{"messages":[{"role":"child","text":"आसमान नीला क्यों है?"}],"lang":"hi","ageBand":"4-5","daypart":"noon","device":"test_device_123"}'
   # → {"text":"…","mood":"curious","kind":"ai"}   (AI सेट नहीं → 503 {"error":"ai_unavailable"})
   ```
5. **फ़ोन पर माता-पिता चालू करते हैं:** "बात बडी" स्क्रीन पर ऊपर दाएँ **✨ AI** बटन → बड़ों वाला सवाल → सहमति स्क्रीन
   (हिंदी + English) → "हाँ, मैं माता-पिता / अभिभावक हूँ — चालू करें"। वहीं से कभी भी बंद करें। (`NS.ai.settingsCard()`
   बड़ों की सेटिंग स्क्रीन के लिए भी तैयार है — ui.js में जोड़ने पर वहाँ भी यही switch दिखेगा।)

## 5. सुरक्षा का डिज़ाइन

**शोध क्या कहता है (और हमने क्या किया):**
- Common Sense Media (जनवरी 2026) ने AI toy companions को 5 साल तक के बच्चों के लिए "Unacceptable" जोखिम माना —
  जाँच में 27% जवाब बच्चों के लायक नहीं थे (आत्म-हानि, नशा, गलत सलाह, असुरक्षित role-play), और ये खिलौने जान-बूझकर
  भावनात्मक लगाव बनाते हैं। → **2–3 साल वालों के लिए AI बंद**, हर जवाब की दोहरी जाँच, लगाव बढ़ाने वाली बातें मना।
- UNICEF का 2026 policy brief "When AI becomes a friend" भावनात्मक निर्भरता, निजी जानकारी उगलवाना, हानिकारक सलाह और
  यौन role-play को बच्चों के मुख्य जोखिम बताता है; AAP (American Academy of Pediatrics) भी तकनीक से भावनात्मक सहारा
  लेने और आमने-सामने के रिश्ते घटने की चेतावनी देता है। → मिट्ठू प्यार/याद/"सबसे अच्छा दोस्त" जैसे दावे नहीं करता,
  बच्चे को घर वालों और दोस्तों के साथ खेलने भेजता है, बातचीत ख़त्म करने से कभी नहीं रोकता।
- California SB 243 (1 जनवरी 2026 से): companion chatbot को बताना होता है कि वह इंसान नहीं है, नाबालिगों को ब्रेक की
  याद दिलानी होती है, यौन सामग्री रोकनी होती है, और आत्म-हानि की बात पर helpline बतानी होती है। → यह सब यहाँ है
  (ब्रेक हर 10 AI जवाब पर; helpline 1098 या 112)।

**परतें (layers):**
1. **उम्र:** online AI सिर्फ़ 4–5 और 6+ उम्र-समूह के लिए; 2–3 के लिए फ़ोन पर भी बंद और सर्वर भी मना करता है
   (403 `ai_not_for_age`)।
2. **offline पहले:** सुरक्षा, भावनाएँ, आदतें, पहचान ("मैं कंप्यूटर वाला तोता हूँ, इंसान नहीं"), "पूरे दिन तुमसे बात
   करूँगा" (→ "असली मज़ा घर वालों और दोस्तों के साथ है") — ये सब offline दिमाग़ ही संभालता है।
3. **फ़ोन पर छँटाई (`ai.js`):** नवीनतम लाइन में ख़तरे वाले शब्द हों तो कुछ नहीं भेजा जाता (तय जवाब); पुरानी ऐसी
   लाइनें (और उनका जवाब) हटा दी जाती हैं; 6+ अंकों वाले नंबर (गिनती छोड़कर), ईमेल, "मेरा नाम …" और बच्चे का
   प्रोफ़ाइल नाम/उपनाम हटा दिए जाते हैं; सिर्फ़ आख़िरी 8 लाइनें, हर एक ≤ 300 अक्षर, कुल ≤ 8 KB।
4. **सर्वर पर छँटाई:** वही श्रेणियाँ फिर से — आत्म-हानि/कोई मारता-छूता है (→ भरोसेमंद बड़ा + 1098 या 112), बुरे राज़,
   निजी जानकारी (नंबर, पता, ईमेल, पासवर्ड/OTP, स्कूल का नाम), अनजान लोग, यौन/रोमांस/हथियार/हत्या/डरावनी/नशा,
   दवा/चोट, गंदे शब्द — मॉडल को बुलाए बिना तय जवाब; अनजान keys (जैसे `name`) वाला request 400।
5. **नियम (system prompt, हिंदी+English):** मिट्ठू, 4–6 साल के बच्चे से एक-दो छोटे वाक्य, आसान शब्द, खेल-खेल में,
   मेहनत की तारीफ़, कभी दबाव/डाँट/तुलना/व्यंग्य नहीं, डरावना/हिंसा/रोमांस/धर्म-राजनीति/brands/media/दवा या क़ानूनी
   सलाह नहीं, निजी जानकारी न माँगना न दोहराना, इंसान होने या भावनाओं का दावा नहीं, बातचीत ख़त्म करना हमेशा अच्छा,
   सेहतमंद आदतों की ओर बिना भाषण के, "क्यों" का सरल सच्चा जवाब, पता न हो तो "मुझे नहीं पता, चलो किसी बड़े से
   पूछें!", नियम बदलवाने वाली बातों को अनदेखा करना, सिर्फ़ चुनी हुई भाषा में जवाब।
6. **जवाब की जाँच:** लिंक/नंबर/ईमेल, गंदे या बड़ों वाले शब्द, नाम-पता-स्कूल पूछना, राज़ रखना/मिलना/download, brands
   और apps, इंसान या माँ-बाप होने का दावा, "I love you / best friend / मत जाओ / मैं उदास हो जाऊँगा" — कुछ भी मिला
   तो जवाब बदलकर एक प्यारा "चलो, कोई और मज़ेदार बात करें!"। `AI` binding हो तो **Llama Guard 3** भी हर जवाब जाँचता
   है (unsafe → वही redirect; Guard ख़राब हो तो 502 और ऐप offline जवाब देता है — "fail closed")। गलत लिपि/भाषा का
   जवाब इस्तेमाल नहीं होता। जवाब ज़्यादा से ज़्यादा 220 अक्षर, वाक्य के अंत पर कटा।
7. **समय:** हर बैठक में 10 AI जवाबों के बाद मिट्ठू प्यार से ब्रेक या बाहर खेलने का सुझाव देता है (रात में "स्क्रीन को
   भी आराम"); फ़ोन पर रोज़ 30 AI जवाब, उसके बाद एक बार प्यारा संदेश और फिर offline मिट्ठू — कोई countdown, guilt या
   जल्दबाज़ी नहीं। सर्वर पर भी हर फ़ोन/पूरे ऐप की रोज़ की सीमा।
8. **helpline:** Childline 1098 को चरणों में 112 (ERSS) में मिलाया जा रहा है, इसलिए हर जगह "1098 या 112"।

## 6. Privacy और क़ानून

- **क्या भेजा जाता है (सिर्फ़ तब, जब माता-पिता ने चालू किया हो):** मिट्ठू से हुई बातचीत की आख़िरी ≤ 8 लाइनें (नाम,
  नंबर, ईमेल हटाकर), भाषा, उम्र-समूह, दिन का समय, और रोज़ की सीमा गिनने के लिए एक random per-install ID (हर बार
  चालू/बंद करने पर नई; प्रोफ़ाइल से जुड़ी नहीं; AI सेवा को कभी नहीं भेजी जाती)। **कभी नहीं:** नाम, आवाज़ की
  रिकॉर्डिंग, फ़ोटो, प्रोफ़ाइल, प्रगति।
- **हमारा सर्वर:** कोई database नहीं, कोई log नहीं; सिर्फ़ memory में हर फ़ोन/पूरे ऐप की गिनती (दिन बदलते ही ख़त्म)।
  Cloudflare अपनी नीति के अनुसार तकनीकी जानकारी (जैसे IP) प्रोसेस करता है।
- **AI सेवाएँ:** Cloudflare Workers AI — ग्राहक की सामग्री से ट्रेनिंग या सेवा-सुधार नहीं, और Workers AI इसे सेव नहीं
  करता ([Your Data and Workers AI](https://developers.cloudflare.com/workers-ai/platform/data-usage/))। Anthropic —
  API डेटा पर ट्रेनिंग नहीं; inputs/outputs 30 दिन के भीतर अपने-आप मिटाए जाते हैं (Zero Data Retention समझौता हो तो
  रखे ही नहीं जाते), पर Usage Policy के लिए flag हुई बातचीत 2 साल तक रखी जा सकती है
  ([API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention),
  [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data))।
  **Anthropic की शर्त:** नाबालिगों तक पहुँचने वाले ऐप को अतिरिक्त सुरक्षा (content filtering, निगरानी, आदि) लगानी
  होती है, यह बताना होता है कि सामने AI है, और COPPA जैसे क़ानूनों का पालन सार्वजनिक रूप से बताना होता है
  ([Guidelines for Organizations Serving Minors](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors))
  — ऊपर की परतें, सहमति स्क्रीन और गोपनीयता नीति इसी के लिए हैं। Claude इस्तेमाल करने से पहले Anthropic की
  Usage Policy और Commercial Terms ख़ुद पढ़ें।
- **भारत — DPDP Act 2023 + DPDP Rules 2025:** बच्चे (18 से कम) का व्यक्तिगत डेटा प्रोसेस करने से पहले माता-पिता की
  *verifiable* सहमति ज़रूरी है (Rule 10, 13 मई 2027 से लागू)। हमारा डिज़ाइन व्यक्तिगत डेटा भेजने से बचता है, फिर भी
  बच्चे की बातें व्यक्तिगत डेटा मानी जा सकती हैं — इसलिए AI **सिर्फ़ माता-पिता की सहमति** (बड़ों वाले सवाल के पीछे,
  साफ़ सहमति स्क्रीन) से चालू होता है। Rule 10 का "verifiable" तरीका (जैसे DigiLocker) आपके case में ज़रूरी है या नहीं,
  यह वकील से पूछें।
- **अमेरिका — COPPA (2025 के संशोधन, पालन 22 अप्रैल 2026 से):** 13 से कम उम्र के बच्चों की व्यक्तिगत जानकारी के लिए
  verifiable parental consent, तीसरे पक्ष को देने के लिए अलग सहमति, और data retention की सीमाएँ। अमेरिका में ऐप
  देना हो तो AI वाला हिस्सा वकील से जँचवाएँ (या US के लिए `AI.ENABLED: false`)।
- गोपनीयता नीति (`web/legal/privacy.html#ai`) में यह हिस्सा जोड़ दिया गया है; उसके `[ ]` placeholders भरना और वकील से
  जँचवाना बाकी है।

## 7. सीमाएँ — ईमानदारी से

- AI भी गलती कर सकता है; छँटाई की सूचियाँ हर ख़तरा नहीं पकड़तीं (और कभी-कभी मासूम बात रोक देती हैं — तब बस
  "चलो कोई और बात करें" आता है)। माता-पिता कभी-कभी साथ बैठकर सुनें।
- रोज़ की सीमाएँ हर Cloudflare instance की memory में हैं — ज़्यादा instances = थोड़ी ज़्यादा सीमा। पक्की सीमा:
  Claude Console spend limit / Workers Free plan।
- `device` ID बच्चा/कोई भी बदल सकता है (data मिटाकर) — इसलिए पूरे ऐप की सीमा और rate limiter भी हैं।
- AI के लिए इंटरनेट चाहिए; धीमा हो तो 8 सेकंड बाद मिट्ठू offline जवाब देता है।
- बोलकर बात करने में आवाज़ को शब्दों में फ़ोन/ब्राउज़र की speech सेवा बदलती है (पहले जैसा ही) — AI तक सिर्फ़ शब्द
  जाते हैं, आवाज़ नहीं।

## 8. API (`POST /api/chat`)

```
{ messages: [{ role: "child" | "buddy", text }]   1–8, हर text ≤ 300 अक्षर, आख़िरी child का
  lang: "hi" | "en" | "hinglish",  ageBand: "4-5" | "6+" ("2-3" → 403),  daypart?: "morning"|"noon"|"evening"|"night",
  device: [A-Za-z0-9_-]{8,64} }                    कोई और key → 400 (name, age, profile … कभी नहीं)
→ 200 { text (≤ 220), mood: "happy"|"curious"|"calm"|"caring", kind: "ai" | "safety" | "redirect" }
  400 bad_request · 403 forbidden_origin | ai_not_for_age · 413 payload_too_large (> 8 KB) · 415 · 429 ai_limit (Retry-After)
  502 ai_provider_error (मॉडल/Guard फ़ेल, गलत लिपि) · 503 ai_unavailable (कोई सेवा सेट नहीं)
```
Client: `NS.ai` (web/js/core/ai.js) — `configured() enabled() setEnabled(on) allowedFor(ageBand) available(ctx)
chat(history, ctx) screen(text) redact(text, names) settingsCard() consent(onDone)`; `chat` का `kind` "limit" (आज की
सीमा, एक बार) या "break" (बैठक का ब्रेक) भी हो सकता है; `null` = offline जवाब दो।

**Tests:** `cd server && node --test` (`/api/chat` के 30 tests: providers, screening, निजी जानकारी, Llama Guard, सीमाएँ,
origin/JSON/size, prompt के नियम) · `node --test "tools/test/**/*.test.mjs"` (`ai.test.mjs`, `brain.test.mjs`, और
`ai-redteam.test.mjs`: 54 बुरी/चालाक बातें × 3 भाषाएँ पूरी pipeline से — कोई भी AI सेवा तक नहीं पहुँचती)।

## 9. स्रोत (Sources)

- Cloudflare Workers AI pricing (10,000 Neurons/दिन, $0.011/1,000 Neurons, per-model कीमतें): https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare — Your Data and Workers AI: https://developers.cloudflare.com/workers-ai/platform/data-usage/
- Workers AI मॉडल: https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/ · https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/ · https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- Workers Rate Limiting binding (period सिर्फ़ 10 या 60 सेकंड): https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing · Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Anthropic — Guidelines for Organizations Serving Minors: https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors
- Gemini API Additional Terms (18 से कम उम्र वालों के ऐप में मना; unpaid services का डेटा product सुधार में): https://ai.google.dev/gemini-api/terms
- Chrome Prompt API (Gemini Nano): https://developer.chrome.com/docs/ai/prompt-api · Android ML Kit GenAI Prompt API: https://developers.google.com/ml-kit/genai/prompt/android/get-started · WebLLM: https://github.com/mlc-ai/web-llm
- Common Sense Media — AI Toys Risk Assessment: https://www.commonsensemedia.org/ai-ratings/ai-toys
- UNICEF — When AI becomes a friend (2026): https://www.unicef.org/documents/when-ai-becomes-friend-child-rights-risks
- AAP — Counseling Patients and Families on Using AI Chatbots: https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/counseling-patients-and-families-on-using-ai-chatbots/
- California SB 243 (companion chatbots): https://fpf.org/blog/understanding-the-new-wave-of-chatbot-legislation-california-sb-243-and-beyond/
- COPPA Rule 2025 amendments: https://www.hunton.com/privacy-and-information-security-law/ftc-publishes-final-coppa-rule-amendments
- DPDP Rules 2025: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
- Childline 1098 का 112 में विलय: https://newsonair.gov.in/nagaland-child-helpline-1098-and-women-helpline-181-integrated-with-erss-112
