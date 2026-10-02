# नन्हा स्कूल — Roadmap 2026–2041

> तारीख़: 2 अक्टूबर 2026 · हर तिमाही अपडेट करें। `[n]` = स्रोत (भाग 10)। **(unverified)** = पुष्टि बाकी है।
> बजट: अकेला founder, छोटा बजट। जो चीज़ पैसे या टीम माँगती है, वह साफ़ लिखी है।

## 1. Vision और सिद्धांत

**Vision:** 2026 में 3 साल का बच्चा 2041 में 18 का होगा। नन्हा स्कूल उसका पहला सीखने का साथी बने — मातृभाषा में, फ़ोन पर कम और असली ज़िंदगी में ज़्यादा — ताकि वह AI वाली दुनिया में **ख़ुद सोचने, ख़ुद को सँभालने और समय की कद्र करने वाला** इंसान बने।

**शोध क्या कहता है कि क्या सिखाएँ:**
- **बुनियाद:** NEP 2020 / NIPUN का लक्ष्य — Grade 3 तक हर बच्चे में साक्षरता-गणित (FLN), मातृभाषा पर ज़ोर [5]; NCF-FS 2022 (3–8 साल) — खेल-आधारित, पंचकोश के 5 विकास-क्षेत्र, digital साधन सिर्फ़ सहायक [4]।
- **Executive function (EF):** 3–5 साल EF और self-regulation के तेज़ विकास की "window" है; कहानी, matching/sorting, गीत-movement और कल्पना-खेल इसे बढ़ाते हैं [6]। बचपन का self-control 32 साल की उम्र में सेहत और धन से जुड़ा मिला [7] — पर marshmallow test की बड़ी replication में असर घर के माहौल को control करने पर बहुत घट गया [8]। **मतलब: सिर्फ़ बच्चे को नहीं, परिवार की दिनचर्या को मज़बूत करें।**
- **भविष्य के कौशल:** WEF 2025 — AI/big data, technological literacy, creative thinking, resilience, curiosity/lifelong learning सबसे तेज़ बढ़ रहे [3]; OECD Learning Compass — student agency और "नई value बनाना, दुविधाएँ सुलझाना, ज़िम्मेदारी लेना" [1][2]; UNESCO AI competency framework — पहले human-centred mindset और AI ethics, फिर techniques [13]।
- **ईमानदार नोट:** growth-mindset interventions का पढ़ाई पर असर बहुत छोटा/नगण्य मिला (d≈0.02–0.08) [9]। नारे नहीं, असली "कोशिश → सुधार" के मौके दें।

**"Covertly" का हमारा अर्थ:** बच्चे के लिए सीख खेल में घुली हुई (stealth learning) — पर **माता-पिता से कुछ भी छिपा नहीं।** हर activity का "यह क्या सिखाता है" बड़ों वाले हिस्से में लिखा रहे। UK Children's Code और EU AI Act बच्चों पर nudges/कमज़ोरियों के शोषण को रोकते हैं [43][45]।

**8 सिद्धांत**
1. **Screen के बाहर का काम ही नतीजा है।** हर session किसी off-screen काम पर ख़त्म हो। WHO: 2–4 साल ≤1 घंटा screen/दिन [15]; AAP 2026 "5 Cs" — कितना नहीं, *क्या* और *किसकी जगह* ("crowding out") [16]।
2. **मातृभाषा पहले**, English साथ में।
3. **Privacy by architecture:** डेटा फ़ोन पर; कोई analytics/ads SDK नहीं।
4. **कोई dark pattern नहीं** — 3–5 साल के बच्चों के सिर्फ़ 20% apps manipulative design से मुक्त थे; ग़रीब परिवारों के बच्चों के apps में ज़्यादा [18]। हर activity को Hirsh-Pasek के 4 स्तंभों (active, engaged, meaningful, socially interactive) पर जाँचें [19]।
5. **AI औज़ार है, दोस्त का विकल्प नहीं** — मिट्ठू हमेशा मानता है कि वह मशीन है [21][22][23]।
6. **₹7,000 वाला फ़ोन, बिना इंटरनेट** — entry-level बाज़ार 3–4 GB RAM वाले फ़ोन का है [79]।
7. **सबूत > hype** — UNESCO: edtech के added value के मज़बूत सबूत कम हैं [20]; हम ख़ुद मापेंगे।
8. **सबके लिए** — विकलांग बच्चे और कम पढ़े माता-पिता शुरू से।

**"दुनिया में सबसे ज़्यादा डाउनलोड" — ईमानदार रास्ता:** Khan Academy Kids और Duolingo ABC मुफ़्त और ad-free हैं [50][51]; Lingokids के पास $120M funding और 10 लाख DAU [52]। पैसे से मुक़ाबला नहीं होगा। अवसर: ग्रामीण भारत के 84% घरों में smartphone [57], 50 करोड़ से ज़्यादा WhatsApp users [58]। हमारा रास्ता: **हिंदी-पहले + आदतें + परिवार + भरोसा**, जो WhatsApp पर माता-पिता से माता-पिता तक फैले। downloads लक्ष्य नहीं, **सक्रिय और संतुष्ट परिवार** लक्ष्य हैं।

## 2. अब तक क्या बना है

- एक web app (PWA) हर screen के लिए + पतला Android shell (WebView, फ़ोन की आवाज़ें, on-device speech) — `docs/ARCHITECTURE.md`।
- सारा डेटा फ़ोन पर; कोई account, email या phone नहीं; strict CSP; stateless subscription server (₹99/माह, ₹599/साल, 7-दिन trial) — `docs/SECURITY_PRIVACY.md`।
- Activities: ABC, अक्षर, गिनती, दुनिया देखो, कविताएँ, खेल; मेरा दिन (picture clocks), मेरा बगीचा (असली आदतें), कहानी समय, बड़े होकर, ध्यान (EF games + साँस), मिट्ठू (rule-based, 1098 safety), रात का bedtime path।
- "समय की क़ीमत" design: 15 मिनट पर शांत wind-down, कोई countdown/streak/guilt नहीं, आसमान असली समय के साथ बदलता है।
- आवाज़ pipeline: ~1,465 बोली जाने वाली पंक्तियाँ; Indic Parler-TTS/Kokoro neural clips; इंसानी recording guide — अभी कोई clip नहीं (`docs/VOICE.md`)।
- **चल रहा है (v3):** "कल की दुनिया" — AI, robots, AR, draw, music, puzzle, trace।

## 3. अगले 12 महीने (Q4 2026 – Q3 2027)

| तिमाही | मुख्य काम | "पूरा" का मतलब |
|---|---|---|
| **Q4 2026** (अक्टू–दिसं) | v3 ship, हर AI/robot activity का §7 safety review। सबसे ज़्यादा बजने वाली ~300 पंक्तियाँ इंसानी आवाज़ में, बाकी neural। Release-signed APK, Play **Families policy** + **Teacher Approved** आवेदन [48]। Helpline text: 1098 के साथ 112 (1098 चरणों में ERSS-112 से जुड़ रहा है [84])। WhatsApp Channel (followers के नंबर admin को नहीं दिखते [59]) + YouTube पर हफ़्ते में 3 हिंदी कविता/कहानी shorts [60]। | Play पर live; 3 GB RAM फ़ोन पर offline चलता है; data-safety form = "no data collected" |
| **Q1 2027** | **सीखने का सबूत:** 2–3 preschool/आंगनवाड़ी में 40–60 बच्चे, 8 हफ़्ते, पहले-बाद **IDELA** (मुफ़्त, MOU पर [72]); लिखित parental consent (DPDP [40])। हर activity को NCF-FS curricular goals से जोड़ें [4]। On-device adaptive: हर item की mastery + spaced repetition। StoryWeaver (CC BY 4.0) से 30 हिंदी कहानियाँ, attribution के साथ [69]। Parent "हफ़्ते की एक बात" (offline card + 30 सेकंड voice tip) — READY4K: हफ़्तावार texts से +0.11 SD literacy [73]। | Pilot report; skills map; 30 कहानियाँ |
| **Q2 2027** | दूसरी भाषा (Marathi या Bengali, §6)। i18n refactor: `{hi,en}` → कई भाषाएँ + fallback। Accessibility pass (§9)। Pricing प्रयोग: ₹99/₹599 बनाम "मुफ़्त core + family plan"; आंगनवाड़ी/सरकारी स्कूल परिवारों के लिए मुफ़्त code। | दूसरी भाषा live; accessibility checklist पास |
| **Q3 2027** | तीसरी भाषा (Telugu या Tamil)। "बोलकर बताओ" प्रयोग सिर्फ़ on-device, बच्चों पर WER मापें; tap हमेशा विकल्प। Teacher/आंगनवाड़ी **class mode** prototype (TV/projector, कोई बच्चे का डेटा नहीं)। Pilot नतीजे प्रकाशित करें। 12 महीने का business review। | Year-2 का go/no-go फ़ैसला लिखित |

**Compliance तारीख़ें:** DPDP Rules 13 नवंबर 2025 को notified; मुख्य obligations 13 मई 2027 से [39]; MeitY ने इसे 12 महीने (13 नवंबर 2026) करने का प्रस्ताव रखा था — अंतिम स्थिति **(unverified)** [41]। हमारा design (कोई personal data नहीं) एक पन्ने में दर्ज करें और एक बार वकील से पुष्टि कराएँ।

## 4. 3 साल का plan (अक्टूबर 2026 – सितंबर 2029)

**Year 1** — ऊपर का 12 महीने का plan: Hindi + 2 भाषाएँ, पहला सबूत।

**Year 2 (2027–28)**
- 6 भाषाएँ; **6–8 साल का path** — पढ़कर समझना, NIPUN Grade 2–3 लक्ष्य [5]।
- Family companion v1 (§5), class mode v1।
- 100 मुख्य शब्दों के ISL videos — ISLRTC dictionary में 10,000 शब्द हैं [81]; licence की पुष्टि **(unverified)**।
- बड़ा independent evaluation (university/NGO के साथ)।
- **Distribution साझेदारी:** Rocket Learning WhatsApp से 40 लाख माता-पिता-बच्चों और 2.5 लाख आंगनवाड़ी workers तक पहुँचा [55]; Pratham/Rocket का Mission Aarambh पंजाब में 1.6 लाख माता-पिता तक [56]। ऐसे NGO/राज्य कार्यक्रमों में मुफ़्त/CSR-funded licence दें।

**Year 3 (2028–29)**
- 10–12 भाषाएँ; विदेश में बसे 3.54 करोड़ भारतीयों [85] के बच्चों के लिए heritage-Hindi (iOS/web)।
- Bangladesh/Nepal (Bengali/Nepali) test बाज़ार **(unverified)**।
- 6+ के लिए छोटे on-device models के प्रयोग (§7)।
- टिकाऊपन: 3–5 लोगों की टीम; nonprofit/hybrid ढाँचा विचार करें (Khan Academy Kids nonprofit मॉडल पर मुफ़्त है [50])।

## 5. 10–15 साल का क्षितिज: ऐप बच्चे के साथ बड़ा होता है

| उम्र | साल (2026 वाले 3-वर्षीय के लिए) | ऐप की भूमिका | फ़ोकस |
|---|---|---|---|
| 2–3 | 2025–27 | माता-पिता के साथ "सुनो-छुओ" | शब्द, आवाज़ें, दिनचर्या; साथ बैठकर — co-viewing और educational content का language पर छोटा सकारात्मक असर, ज़्यादा screen का नकारात्मक [17] |
| 3–5 | 2026–28 | खेल-स्कूल | EF games; दिन का क्रम → घड़ी (3–4 में समय-क्रम, 4–5 में घड़ी-कैलेंडर की नींव [10]); आदतें; मातृभाषा FLN; "मशीनें नियम से चलती हैं" — 4–6 साल के बच्चे rule-based AI और machine learning के मूल विचार समझ पाए [14] |
| 5–8 | 2028–31 | सीखने का साथी | पढ़कर समझना, गणित; **plan-do-review** से अपना दिन ख़ुद बनाना (Tools of the Mind ने कुछ RCTs में EF सुधारा, कुछ में नहीं [12]); AI literacy: "AI ग़लत हो सकता है, उदाहरणों से सीखता है" [13] |
| 8–12 | 2031–35 | Guardrails वाला AI tutor + बनाने का studio | AI के साथ बनाना, पर सोचना ख़ुद — बिना guardrail GPT से अभ्यास के बाद exam में 17% कम अंक [29]; शिक्षक-निर्देशित AI tutoring से Nigeria में +0.31 SD [30]; hardware सस्ता हो तो AR field trips |
| 12–18 | 2035–41 | बच्चे को सौंपना | portfolio export, डेटा बच्चे का; agency और ज़िम्मेदारी [1] |

**Adaptive learning path:** NCF-FS goals [4] से skill-graph; हर skill की mastery फ़ोन पर; माता-पिता देख/बदल सकें। कोई server profiling नहीं — DPDP धारा 9 बच्चों की tracking/behavioural monitoring और targeted ads रोकती है (सीमित छूट के साथ) [40]।

**Family companion:** रोज़ 1 मिनट का "आज क्या करें" off-screen idea; bedtime routine — हर अतिरिक्त रात का routine बेहतर नींद से जुड़ा (dose-dependent) [11]; दादा-दादी की आवाज़ में कहानी (सिर्फ़ फ़ोन पर); कई बच्चों के profile। आधार: WHO nurturing care — responsive caregiving और सीखने के मौके [86]।

## 6. भाषाएँ और क्षेत्र

**क्रम (Census 2011 मातृभाषा) [68]:** हिंदी 43.6% · बांग्ला 8.0% · मराठी 6.9% · तेलुगु 6.7% · तमिल 5.7% · गुजराती 4.6% · उर्दू 4.2% · कन्नड़ 3.6% · ओड़िया 3.1%। चुनाव का score = बोलने वाले × model quality × native reviewer मिलना × साझेदार (NGO/राज्य)।

**हर भाषा की pipeline (अनुमानित लागत ₹40–80 हज़ार/भाषा — reviewer + voice, (unverified) अपना अनुमान):**
1. **Native content lead** (शिक्षक/माता-पिता): कविताएँ और कहानियाँ मूल लिखी जाएँ, अनुवाद नहीं — Kuku FM की दक्षिण भारतीय भाषाओं में native content की growth हिंदी से दोगुनी थी [61]।
2. **IndicTrans2** से UI/निर्देशों का पहला draft — MIT licence, सभी 22 अनुसूचित भाषाएँ, distilled ~200M model [64]।
3. दो native speakers से review।
4. **Indic Parler-TTS** से clips — Apache-2.0 (`docs/VOICE.md` के अनुसार), 20 Indic भाषाएँ + English, ~0.9B parameters, इसलिए सिर्फ़ CI/GPU पर, फ़ोन पर नहीं [65] → native listener QA → सबसे ज़्यादा बजने वाली पंक्तियाँ इंसानी आवाज़ में।
5. **Bhashini** (MeitY): ULCA पर 22 भाषाओं के ASR/TTS/translation APIs; मुफ़्त उपयोग **सिर्फ़ PoC** के लिए, production/commercial के लिए paid plan हेतु Bhashini टीम से संपर्क [62][63]। Production दाम सार्वजनिक नहीं मिले **(unverified)**। उपयोग: prototyping और translation cross-check; बच्चे की आवाज़ कभी नहीं भेजेंगे।
6. **ASR (वैकल्पिक):** IndicConformer — MIT, 22 भाषाएँ [66]; IndicVoices डेटा CC BY 4.0, 23.7K घंटे [67] — ज़्यादातर बड़ों की आवाज़, बच्चों पर accuracy **(unverified)**।
7. विकल्प: Sarvam Bulbul TTS (11 भाषाएँ, paid API) [87]।

**Content licence चेतावनी:** StoryWeaver CC BY 4.0 है — commercial उपयोग attribution के साथ ठीक [69]। DIKSHA/NCERT सामग्री CC BY-NC-SA/NC-ND है [70] — Jaadui Pitara (22 भाषाएँ [71]) paid app में बिना अनुमति नहीं।

**क्षेत्र:** (A) हिंदी पट्टी + हिंदी diaspora → (B) महाराष्ट्र, पश्चिम बंगाल → (C) दक्षिण → (D) बाकी + पड़ोसी देश। Galli Galli Sim Sim का सबक: हर क्षेत्र की संस्कृति पात्रों और कहानियों में दिखे [88]।

## 7. AI और future-tech plan

**2–6 साल के लिए मिट्ठू scripted ही रहेगा (generative chat नहीं)।** कारण: Common Sense ने AI toys का जोखिम "unacceptable" आँका और ≤5 साल के लिए सिफ़ारिश नहीं की; 27% outputs अनुचित थे [24]; PIRG testing में एक AI teddy ने चाकू/माचिस की जगह बताई [25]; UNICEF 2026 — emotional dependence और निजी जानकारी उगलवाने का ख़तरा [22]; 3 साल के बच्चे "ज़िंदा है?" जैसे सवालों पर अंदाज़े से जवाब देते हैं [28]; बच्चे उम्र के साथ facts के लिए voice assistant पर ज़्यादा भरोसा करते हैं [26] — इसलिए हमारे facts सही होने चाहिए।

**Generative AI कहाँ:** (a) build-time content draft, हमेशा इंसानी review; (b) dialogic reading जैसे scripted सवाल — conversational agent से 3–6 साल के बच्चों की कहानी-समझ बढ़ी [27]; (c) माता-पिता के tools।

**On-device सीढ़ी**

| तकनीक | आज (2026) | हमारे लिए कब |
|---|---|---|
| Android on-device SpeechRecognizer (API 31+) [75] | हिंदी उपलब्धता फ़ोन पर निर्भर **(unverified)** | अभी (shell में) |
| Chrome Web Speech `processLocally` [74] | language pack download ज़रूरी | 2027 प्रयोग |
| sherpa-onnx offline ASR/TTS [76] | Android पर, Hindi models मौजूद | 2027–28 |
| Gemma 3 270M (~125 MB) / 1B (~529 MB) [77] | हिंदी quality जाँची नहीं | 2028+ (6+ उम्र, सीमित) |
| Gemini Nano / "Gemini Intelligence" [78] | flagship-only, ~12 GB RAM **(unverified)** | हमारे users तक शायद 2030 के आसपास (अपना अनुमान) |

बच्चों की बोली पर ASR कठिन है: छोटे बच्चों पर 15–35% WER [32] — उच्चारण पर कभी "ग़लत" न कहें। Buddy.ai (50M+ downloads) ने 25,000 घंटे बच्चों की आवाज़ पर अपना ASR tune किया [53]; Google Read Along (पहले Bolo, भारत में हिंदी से शुरू) on-device speech पर चलता है [54]। सबक: बच्चों के dataset के बिना बोलने वाले features को grading के लिए न इस्तेमाल करें।

**हर AI feature का safety checklist:** (1) "मैं मशीन हूँ" बताना (California SB 243 जैसा [46]); (2) emotion recognition नहीं (EU AI Act शिक्षा में मना [43]); (3) निजी जानकारी कभी न माँगना; (4) hi/en/Hinglish में 300 prompts का red-team set, CI में; (5) offline-first — company बंद हो तो भी मिट्ठू "मरे" नहीं (Moxie robots cloud बंद होते ही बंद हो गए [31]); (6) माता-पिता एक switch से बंद कर सकें; (7) session के बाद बातचीत की memory नहीं।

**AR:** शोध — engagement/motivation बढ़ता है, गहरे कौशल के सबूत कम, usability दिक़्क़तें [33][34]। WebXR AR सिर्फ़ ARCore-supported फ़ोन पर [36]; VR headset कंपनियाँ 10+/12+ उम्र रखती हैं [35]। आँखें: myopia से बचाव के लिए रोज़ ≥2 घंटे बाहर [37]; भारत में बच्चों में myopia बढ़ रहा है [38]। **Plan:** Year 1 — camera के बिना "जादुई खिड़की" (फ़ोन घुमाने से दृश्य) + छपने वाले paper cards; camera AR सिर्फ़ 5+ के लिए, ≤5 मिनट, बड़े शुरू करें, frames फ़ोन से बाहर नहीं; पूरा WebXR Year 3+ में जब mid-range फ़ोन support करें।

**Regulation watch:** COPPA संशोधन — पूरा compliance 22 अप्रैल 2026 से (US launch से पहले) [42]; EU AI Act Art. 5 (फ़रवरी 2025 से) + शिक्षा वाले high-risk नियम Digital Omnibus से 2 दिसंबर 2027 तक टले [43][44]; UK Children's Code 15 standards [45]; Texas/Utah App Store Accountability Acts — age signals [47]; Apple Kids category में third-party analytics/ads सामान्यतः मना [49]।

## 8. Metrics जो मायने रखते हैं

| क्षेत्र | Metric | लक्ष्य | कैसे (बिना tracking) |
|---|---|---|---|
| सीखना | IDELA पहले-बाद अंतर | Khan Kids RCT (ES 0.72, 10 हफ़्ते) [50] को benchmark मानें, वादा नहीं | pilot, लिखित consent |
| सीखना | महीने में mastered skills | माता-पिता को दिखे | सिर्फ़ फ़ोन पर |
| स्वस्थ उपयोग | औसत session | 10–15 मिनट, सेट सीमा से ज़्यादा नहीं | फ़ोन पर, माता-पिता को |
| स्वस्थ उपयोग | wind-down शांति से ख़त्म | ≥80% | parent rating (फ़ोन पर) |
| स्वस्थ उपयोग | bedtime के बाद उपयोग | ~0 | फ़ोन पर |
| स्वस्थ उपयोग | हफ़्ते में दिन | 3–5 (7 नहीं) | फ़ोन पर |
| परिवार | off-screen आदतें reported | बढ़ें | garden data, फ़ोन पर |
| व्यापार | सक्रिय devices, trial→paid, refunds, rating | बढ़ें | Play Console के aggregate आँकड़े, Razorpay |

**कभी optimise न करें:** minutes/दिन, DAU/MAU, streaks। अगर औसत 20 मिनट/दिन से ऊपर जाए तो यह **alarm** है, जीत नहीं।

## 9. जोखिम और सुरक्षा

| जोखिम | सुरक्षा |
|---|---|
| ज़्यादा screen, language पर असर [17] | session सीमा, off-screen अंत, co-play prompts, WHO सीमा [15] |
| मिट्ठू से लगाव [22][23] | scripted, "मैं मशीन हूँ", "मुझे तुम्हारी याद आएगी" जैसी बातें नहीं, असली दोस्त/परिवार की ओर मोड़ना |
| डेटा/privacy | डेटा फ़ोन पर, कोई SDK नहीं; pilot में ही लिखित consent [40] |
| व्यावसायिक दबाव | paywall सिर्फ़ बड़ों के हिस्से में; बच्चे को कभी upsell नहीं; ads कभी नहीं; मुफ़्त core |
| Manipulative design [18] | हर release से पहले Radesky की सूची से जाँच |
| विकलांगता (दुनिया में ~24 करोड़ बच्चे [80]) | 48dp+ बड़े targets [82], हर आवाज़ के साथ दृश्य संकेत, high contrast, switch access, बिना समय-दबाव; ISL (Year 2) |
| कम पढ़े माता-पिता (NFHS-5: 41% महिलाओं की ही ≥10 साल पढ़ाई [83]) | बड़ों वाला हिस्सा भी बोलकर; चित्र-आधारित settings |
| सस्ते फ़ोन/offline | 3 GB RAM पर test, clips lazy-load, कोई runtime cloud नहीं |
| AI content में ग़लती | हर generated पंक्ति इंसानी review |
| ग़लत helpline | 1098 + 112, हर 6 महीने जाँच [84] |
| Platform/policy बदलाव | PWA + APK दोनों रास्ते |
| Founder का अकेलापन (bus factor) | docs, tests, CI; Year 2 में दूसरा व्यक्ति |
| Myopia/आँखें [37] | छोटे sessions, "बाहर खेलो" सुझाव |
| "AI" का बढ़ा-चढ़ाकर प्रचार | marketing में सिर्फ़ मापे हुए दावे |

## 10. Sources

1. OECD Learning Compass 2030 — https://www.oecd.org/content/dam/oecd/en/about/projects/edu/education-2040/concept-notes/OECD_Learning_Compass_2030_concept_note.pdf
2. OECD Future of Education and Skills 2030/2040 — https://www.oecd.org/en/about/projects/future-of-education-and-skills-2030.html
3. WEF Future of Jobs 2025 — https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/
4. NCF for Foundational Stage 2022 — https://ncert.nic.in/pdf/NCF_for_Foundational_Stage_20_October_2022.pdf
5. FLN under NEP 2020 / NIPUN — https://www.idreameducation.org/blog/foundational-literacy-and-numeracy-under-nep-2020/
6. Harvard: EF activities 3–5 — https://developingchild.harvard.edu/wp-content/uploads/2024/10/Executive-Function-Activities-for-3-to-5-year-olds.pdf
7. Moffitt et al. 2011, PNAS — https://pubmed.ncbi.nlm.nih.gov/21262822/
8. Watts et al. 2018 marshmallow replication (commentary) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6335313/
9. Macnamara & Burgoyne 2023 — https://artscimedia.case.edu/wp-content/uploads/sites/141/2020/06/26110416/Macnamara-Burgoyne-2023.pdf
10. Development of temporal concepts — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6290033/
11. Mindell: bedtime routines — https://pmc.ncbi.nlm.nih.gov/articles/PMC6587181/
12. Tools of the Mind (Blueprints) — https://www.blueprintsprograms.org/programs/1008999999/tools-of-the-mind/ ; https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.624140/full
13. UNESCO AI competency framework for students — https://www.unesco.org/en/articles/ai-competency-framework-students
14. MIT PopBots — https://www.media.mit.edu/publications/pop-study-2018/
15. WHO guidelines, under-5 — https://iris.who.int/server/api/core/bitstreams/bfce7d1e-43d8-4e28-ba1b-8f6cf9da2661/content
16. AAP 2026 "5 Cs" (EdSurge) — https://www.edsurge.com/news/2026-02-05-new-aap-screen-time-recommendations-focus-less-on-screens-more-on-family-time
17. Madigan et al. 2020, JAMA Pediatrics — https://jamanetwork.com/journals/jamapediatrics/fullarticle/2762864
18. Radesky et al. 2022, JAMA Netw Open — https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2793493
19. Hirsh-Pasek et al. 2015, "Putting Education in Educational Apps" — https://journals.sagepub.com/doi/10.1177/1529100615569721
20. UNESCO GEM Report 2023 — https://www.unesco.org/gem-report/sites/default/files/medias/fichiers/2023/07/Summary_v5.pdf
21. UNICEF AI for children (guidance, 2025 update) — https://www.unicef.org/innocenti/projects/ai-for-children
22. UNICEF "When AI becomes a friend" 2026 — https://www.unicef.org/documents/when-ai-becomes-friend-child-rights-risks
23. AAP: AI chatbots — https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/counseling-patients-and-families-on-using-ai-chatbots/
24. Common Sense Media: AI toys — https://www.commonsensemedia.org/press-releases/common-sense-media-warns-against-ai-toy-companions-after-research-reveals-safety-risks
25. PIRG Trouble in Toyland 2025 — https://www.designboom.com/technology/trouble-in-toyland-how-non-profit-organization-pirg-tests-ai-toys-protect-children-11-18-2025/
26. Girouard-Hallam & Danovitch 2022 — https://www.researchgate.net/publication/359544774_Children's_trust_in_and_learning_from_voice-assistants
27. Xu et al. 2022, Child Development — https://onlinelibrary.wiley.com/doi/10.1111/cdev.13708
28. Goldman et al. 2023: anthropomorphism — https://www.researchgate.net/publication/372105147_Children's_anthropomorphism_of_inanimate_agents
29. Bastani et al. "Generative AI can harm learning" — https://nmdprojects.net/teaching_resources/bastani_generative_ai_can_harm_learning.pdf
30. World Bank Nigeria AI tutoring — https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria
31. Moxie shutdown (Axios) — https://www.axios.com/2024/12/10/moxie-kids-robot-shuts-down
32. Child speech ASR gap — https://the-learning-agency.com/guides-resources/closing-the-child-speech-recognition-gap-evidence-limitations-and-paths-forward/
33. AR in ECE review — https://www.eu-jer.com/augmented-reality-in-early-childhood-education-a-bibliometric-analysis-and-systematic-review
34. XR in early childhood (SoK) — https://arxiv.org/pdf/2602.12749
35. AAP: VR and children — https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/qa-portal/qa-portal-library/qa-portal-library-questions/virtual-reality-use-and-children/
36. Google WebXR requirements — https://developers.google.com/ar/develop/webxr/requirements
37. AAO outdoor time & myopia — https://www.aao.org/eye-health/news/prevent-childhood-myopia-sunshine-outdoors ; meta-analysis https://pubmed.ncbi.nlm.nih.gov/40066935
38. Myopia in Indian children (PLOS ONE) — https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0240750
39. DPDP Rules 2025 dates — https://dpdpa.dcomply.in/rules/
40. DPDP Act धारा 9 — https://www.dpdpindia.in/dpdp-children.html
41. MeitY 12-month proposal — https://www.mondaq.com/india/data-protection/1773554/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs
42. COPPA final amendments — https://www.hunton.com/privacy-and-information-security-law/ftc-publishes-final-coppa-rule-amendments
43. EU AI Act Article 5 — https://ai-act-service-desk.ec.europa.eu/en/ai-act/faq/what-systems-are-prohibited-under-article-5-ai-act-eg-social-scoring-emotion-recognition ; https://fpf.org/blog/red-lines-under-the-eu-ai-act-understanding-prohibited-ai-practices-and-their-interplay-with-the-gdpr-dsa/
44. EU AI Act timeline / Omnibus — https://www.kennedyslaw.com/en/thought-leadership/article/2026/the-eu-ai-act-implementation-timeline-understanding-the-next-deadline-for-compliance/
45. ICO Children's Code — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
46. California SB 243 — https://fpf.org/blog/understanding-the-new-wave-of-chatbot-legislation-california-sb-243-and-beyond/
47. App Store Accountability Acts — https://www.wiley.law/alert-State-App-Store-Accountability-Acts-Introduce-New-Obligations-for-App-Developers
48. Google Play Families policies — https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
49. Apple App Review Guidelines (Kids) — https://developer.apple.com/app-store/review/guidelines/
50. Khan Academy Kids RCT — https://blog.khanacademy.org/khan-academy-kids-improves-pre-literacy-skills-in-preschoolers-research-confirms/ ; https://learn.khanacademy.org/khan-academy-kids/
51. Duolingo ABC — https://play.google.com/store/apps/details?id=com.duolingo.literacy&hl=en_US
52. Lingokids — https://www.globenewswire.com/news-release/2025/09/18/3152590/0/en/Lingokids-raises-120M-in-funding-to-expand-its-position-as-the-1-interactive-app-for-kids.html ; https://www.prnewswire.com/news-releases/lingokids-launches-ai-powered-content-studio-with-live-feedback-from-its-1-million-daily-active-users-302699182.html
53. Buddy.ai — https://pressreleases.triplepointpr.com/2024/10/31/buddy-ai-worlds-first-ai-tutor-for-children-under-12-closes-11m-seed-round/
54. Google Read Along — https://en.wikipedia.org/wiki/Read_Along
55. Rocket Learning — https://solve.mit.edu/articles/how-rocket-learning-is-helping-india-universalise-early-childhood-education ; Appu: https://www.businesstoday.in/technology/news/story/rocket-learning-unveils-appu-ai-tutor-with-googleorg-support-aiming-to-reach-50-million-indian-families-by-2030-468765-2025-03-21
56. Mission Aarambh — https://brightpunjabexpress.com/mission-aarambh-connects-over-1-6-lakh-parents-through-digital-parent-engagement-to-strengthen-early-childhood-learning-dr-baljit-kaur/
57. ASER 2024 — https://www.idreameducation.org/blog/aser-report-2024/
58. WhatsApp India users — https://backlinko.com/whatsapp-users
59. WhatsApp Channels privacy — https://x.com/WhatsApp/status/1666860750600646676
60. ChuChu TV — https://en.wikipedia.org/wiki/ChuChu_TV
61. Kuku FM localisation — https://www.marketingmonk.so/p/kuku-fm-s-strategic-marketing-playbook
62. Bhashini API docs (PoC only) — https://dibd-bhashini.gitbook.io/bhashini-apis ; onboarding https://bhashini.gitbook.io/bhashini-apis/pre-requisites-and-onboarding
63. Bhashini — https://en.wikipedia.org/wiki/Bhashini
64. IndicTrans2 — https://github.com/ai4bharat/IndicTrans2 ; https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M
65. Indic Parler-TTS — https://huggingface.co/ai4bharat/indic-parler-tts ; https://huggingface.co/ai4bharat/indic-parler-tts-pretrained
66. IndicConformer — https://github.com/AI4Bharat/IndicConformerASR ; https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual
67. IndicVoices — https://huggingface.co/datasets/ai4bharat/IndicVoices
68. Census 2011 languages — https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers_in_India
69. StoryWeaver FAQ — https://storyweaver.org.in/faqs
70. NCERT/CIET: OER licences — https://ciet.ncert.gov.in/storage/app/public/files/13/srg/archive/OERs_&_Licensing.pdf
71. Jaadui Pitara — https://thebetterindia.com/311679/things-to-know-jaadui-pitara-play-based-learning-children-national-curriculum-framework/
72. IDELA — https://idela-network.org/
73. READY4K (York, Loeb, Doss) — https://cepa.stanford.edu/content/one-step-time-effects-early-literacy-text-messaging-program-parents-preschoolers
74. On-device Web Speech explainer — https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md
75. Android SpeechRecognizer — https://developer.android.com/reference/android/speech/SpeechRecognizer
76. sherpa-onnx — https://github.com/k2-fsa/sherpa-onnx
77. Gemma 3 270M on-device — https://developers.googleblog.com/own-your-ai-fine-tune-gemma-3-270m-for-on-device/ ; https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/android
78. Gemini Intelligence requirements — https://www.androidauthority.com/gemini-intelligence-requirements-3667703/
79. India smartphone market 2025 — https://m.gsmarena.com/indian_smartphone_market_remains_flat_in_2025_signals_structural_changes-news-71575.php ; https://www.smartprix.com/mobiles/price-below_10000
80. UNICEF: 240 million children with disabilities — https://www.unicef.org.uk/press-releases/nearly-240-million-children-with-disabilities-around-the-world-unicefs-most-comprehensive-statistical-analysis-finds/
81. ISL dictionary 10,000 words — https://www.outlookindia.com/national/from-just-3-000-to-10-000-words-now-indian-sign-language-dictionary-grows-to-help-hearing-impaired-news-322677
82. WCAG 2.2 mobile — https://www.w3.org/TR/wcag2mobile-22/ ; Google, designing for kids — https://developers.google.com/building-for-kids/designing-engaging-apps
83. NFHS-5 India report — https://dhsprogram.com/pubs/pdf/FR375/FR375.pdf ; https://factly.in/nfhs-5-gender-and-urban-rural-divide-observed-in-access-to-school-education/
84. Child Helpline 1098 + ERSS-112 — https://en.vikaspedia.in/viewcontent/education/childrens-corner/child-rights/child-helpline-service ; https://www.tribuneindia.com/news/india/1098-helpline-merger-hits-child-friendly-support-hard
85. Indian diaspora (MEA, Nov 2024) — https://en.wikipedia.org/wiki/Indian_diaspora
86. WHO: improving ECD / nurturing care — https://www.ncbi.nlm.nih.gov/books/NBK555076/
87. Sarvam Bulbul — https://docs.sarvam.ai/api-reference-docs/models/bulbul
88. Galli Galli Sim Sim — https://en.wikipedia.org/wiki/Galli_Galli_Sim_Sim
