/* नन्हा स्कूल — मिट्ठू's brain (the talking buddy, "बात बडी").

   Pure logic: no DOM, no network, no storage. Deterministic given its inputs, an injected
   random() and an injected now(). Works in the browser (NS.Brain) and in node (module.exports).

     const brain = NS.Brain.createBrain({ random, now });
     brain.greet(context)        → reply
     brain.reply(text, context)  → reply
     brain.heard(text)           → another source (knowledge base / AI) answered: forget pending offers

   context = { lang: "hi"|"en"|"hinglish", name, ageBand: "2-3"|"4-5"|"6+", daypart, hour,
               minutesToday, dream (career title or null), habitsToday: [..], lastTopics: [..],
               seenToday (greet only: true → the child was already greeted today) }
   reply   = { text, lang, mood: "happy"|"curious"|"calm"|"sleepy"|"proud"|"caring",
               actions: [{type:"setLang",lang} | {type:"habit",habit} | {type:"open",id}
                         | {type:"remember",key,value}],
               suggestions: [≤ 3 short tappable replies, in the reply language],
               topic: string (push it onto lastTopics),
               unsure: true when the brain did not understand and only kept the chat going (a curious
                       question, a game, a fact…) — the buddy may then try the knowledge base or the AI }

   The buddy is a gentle guardian: it steers towards eating, sleeping, waking, playing and
   studying on time through questions, praise, tiny games and stories — never lectures, never
   scolds, never uses guilt. Safety first: hurt, self-harm or bad secrets → trusted adult + 1098 or
   112; grown-up topics and rude words are gently turned away; private details are never asked for,
   and the child is reminded not to share them. Honest: मिट्ठू says it is a computer parrot, not a
   person, and sends the child to play with family and friends. */
(function (root) {
  "use strict";

  var MAX = 220;
  var LANGS = ["hi", "en", "hinglish"];
  var NIGHT_SCREEN_MINUTES = 30;   // at night, after this much screen time today, suggest rest
  var DAY_SCREEN_MINUTES = 45;     // by day, after this much, suggest an active off-screen game
  function L(hi, en, hg) { return { hi: hi, en: en, hinglish: hg }; }

  /* ================= Text normalisation & matching ================= */

  var NUKTA = { "क़": "क", "ख़": "ख", "ग़": "ग", "ज़": "ज",
    "ड़": "ड", "ढ़": "ढ", "फ़": "फ", "य़": "य" };
  var EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu;

  /* Lower-case; ज़→ज, ड़→ड (nukta dropped), ँ→ं; Devanagari digits → 0-9; punctuation and emoji → space. */
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    s = s.replace(/[क़-य़]/g, function (c) { return NUKTA[c]; })
      .replace(/़/g, "").replace(/ँ/g, "ं").replace(/[‌‍]/g, "");
    s = s.replace(/[०-९]/g, function (d) { return String(d.charCodeAt(0) - 0x0966); });
    s = s.replace(/[’']/g, "").replace(EMOJI, " ");
    s = s.replace(/[?!,।॥.;:"“”()[\]{}~…_]/g, " ");
    return s.replace(/\s+/g, " ").trim();
  }

  /* A keyword matches only at the start of a word ("hi" never inside "this", "हां" never inside
     "कहां", "मारा" never inside "हमारा"). Short keywords (Latin ≤ 3 letters, Devanagari ≤ 2 code
     units) or ones written "=word" must also end at a word boundary ("do" ≠ "dost", "पी" ≠ "पीटा"). */
  var B = "[\\p{L}\\p{M}\\p{N}]";
  var reCache = {};
  function kwRe(k) {
    if (reCache[k]) return reCache[k];
    var whole = k.charAt(0) === "=";
    var n = norm(whole ? k.slice(1) : k);
    var latin = /^[a-z0-9 ]+$/.test(n);
    if (!whole) whole = latin ? n.length <= 3 : n.length <= 2;
    var esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("(?<!" + B + ")" + esc + (whole ? "(?!" + B + ")" : ""), "u");
    reCache[k] = re;
    return re;
  }
  function has(t, list) {
    for (var i = 0; i < list.length; i++) if (kwRe(list[i]).test(t)) return true;
    return false;
  }
  function words(t) { return t ? t.split(" ").length : 0; }

  /* ================= Numbers & maths ================= */

  var NUMWORDS = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "छः": 6, "छे": 6, "सात": 7,
    "आठ": 8, "नौ": 9, "दस": 10, "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15,
    "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20,
    shunya: 0, ek: 1, "do": 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6,
    saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
    solah: 16, satrah: 17, atharah: 18, unnees: 19, bees: 20,
  };
  var OPS = {
    "+": "+", "plus": "+", "जमा": "+", "प्लस": "+", "और": "+", "aur": "+", "jama": "+", "add": "+",
    "-": "−", "minus": "−", "घटा": "−", "माइनस": "−", "ghata": "−", "take away": "−",
    "x": "×", "×": "×", "*": "×", "times": "×", "into": "×", "गुणा": "×", "इंटू": "×", "guna": "×", "multiplied by": "×",
    "/": "÷", "÷": "÷", "divided by": "÷", "भाग": "÷", "bhag": "÷", "bhaag": "÷",
  };
  function alt(keys) {
    return keys.slice().sort(function (a, b) { return b.length - a.length; })
      .map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
  }
  var NUM = "(\\d+|" + alt(Object.keys(NUMWORDS)) + ")";
  var MATH_RE = new RegExp("(?<!" + B + ")" + NUM + "\\s*(" + alt(Object.keys(OPS)) + ")\\s*" + NUM + "(?!" + B + ")", "u");
  var ONLY_NUM_RE = new RegExp("^(?:(?:यह|ये|it is|its|answer is|jawab|जवाब)\\s+)?" + NUM + "(?:\\s+(?:है|hai|हैं))?$", "u");
  function toNum(s) { return /^\d+$/.test(s) ? parseInt(s, 10) : NUMWORDS[s]; }
  /* "1 2 3 4 5", "एक दो तीन चार": three or more numbers going up by one → {a: first, b: last}. */
  function countingRun(t) {
    var parts = t.split(" ");
    if (parts.length < 3) return null;
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      var n = /^\d{1,2}$/.test(parts[i]) || Object.prototype.hasOwnProperty.call(NUMWORDS, parts[i]) ? toNum(parts[i]) : null;
      if (n == null || (i > 0 && n !== nums[i - 1] + 1)) return null;
      nums.push(n);
    }
    return { a: nums[0], b: nums[nums.length - 1] };
  }

  /* ================= Content ================= */

  var MENU = {
    joke: L("चुटकुला 😄", "Tell a joke 😄", "Chutkula 😄"),
    riddle: L("पहेली 🤔", "Riddle 🤔", "Paheli 🤔"),
    story: L("कहानी 📖", "Story 📖", "Kahani 📖"),
    song: L("गाना 🎵", "Sing a song 🎵", "Gaana 🎵"),
    count: L("गिनती 🔢", "Let's count 🔢", "Ginti 🔢"),
    animal: L("जानवर की आवाज़ 🐄", "Animal sounds 🐄", "Janwar ki awaaz 🐄"),
    colour: L("रंगों का खेल 🎨", "Colour game 🎨", "Rangon ka khel 🎨"),
    sum: L("जोड़ का खेल ➕", "Maths game ➕", "Jod ka khel ➕"),
  };
  var S = {
    yes: L("हाँ 👍", "Yes 👍", "Haan 👍"),
    no: L("नहीं, कुछ और", "No, something else", "Nahi, kuch aur"),
    breathe: L("साँस का खेल 🌬️", "Breathing game 🌬️", "Saans ka khel 🌬️"),
    focus: L("ध्यान का खेल 🎯", "Focus game 🎯", "Dhyan ka khel 🎯"),
    moreStories: L("और कहानियाँ 📚", "More stories 📚", "Aur kahaniyan 📚"),
    moreRhymes: L("और कविताएँ 🎵", "More rhymes 🎵", "Aur kavitayein 🎵"),
    another: L("एक और 😄", "One more 😄", "Ek aur 😄"),
    answer: L("जवाब बताओ", "Tell me the answer", "Jawab batao"),
    garden: L("मेरा बगीचा 🌱", "My garden 🌱", "Mera bagicha 🌱"),
    goodnight: L("गुड नाइट 🌙", "Good night 🌙", "Good night 🌙"),
    bedStory: L("सोने की कहानी 🌙", "Bedtime story 🌙", "Sone ki kahani 🌙"),
    found: L("मिल गया! 👀", "Found it! 👀", "Mil gaya! 👀"),
    dreamShow: L("हाँ, दिखाओ! 🌟", "Yes, show me! 🌟", "Haan, dikhao! 🌟"),
    doctor: L("डॉक्टर 🩺", "Doctor 🩺", "Doctor 🩺"),
    pilot: L("पायलट ✈️", "Pilot ✈️", "Pilot ✈️"),
    teacher: L("टीचर 📚", "Teacher 📚", "Teacher 📚"),
    didBrush: L("मैंने ब्रश कर लिया ✨", "I brushed my teeth ✨", "Maine brush kar liya ✨"),
    didEat: L("मैंने खाना खा लिया 😋", "I ate my food 😋", "Maine khana kha liya 😋"),
    didBreakfast: L("मैंने नाश्ता कर लिया 😋", "I ate my breakfast 😋", "Maine nashta kar liya 😋"),
    didWater: L("मैंने पानी पी लिया 💧", "I drank water 💧", "Maine paani pi liya 💧"),
    didPlay: L("मैंने खेल लिया ⚽", "I played outside ⚽", "Maine khel liya ⚽"),
    didRead: L("मैंने पढ़ लिया 📚", "I read a book 📚", "Maine padh liya 📚"),
    didHelp: L("मैंने मदद की 🦸", "I helped 🦸", "Maine madad ki 🦸"),
    woke: L("मैं उठ गया ☀️", "I woke up ☀️", "Main uth gaya ☀️"),
  };

  var JOKES = [
    L("टीचर: सबसे पुराना जानवर कौन? बच्चा: ज़ेबरा! क्योंकि वो अब भी ब्लैक एंड व्हाइट है! 😄",
      "What do you call a sleeping dinosaur? A dino-snore! 🦖😄",
      "Teacher: sabse purana jaanwar kaun? Bachcha: Zebra! Kyunki woh abhi bhi black and white hai! 😄"),
    L("मच्छर ने मच्छर से कहा — बाहर मत जाना, लोग ताली बजा-बजाकर हमें ढूँढ रहे हैं! 🦟😂",
      "Why are fish so clever? Because they live in schools! 🐟😄",
      "Machhar ne machhar se kaha — bahar mat jaana, log taali baja-bajakar humein dhoondh rahe hain! 🦟😂"),
    L("चींटी ने हाथी से कहा — धक्का मत देना, मैं भी भारी हूँ! 🐜🐘😄",
      "The ant said to the elephant: Don't push me, I am heavy too! 🐜🐘😄",
      "Cheenti ne haathi se kaha — dhakka mat dena, main bhi bhaari hoon! 🐜🐘😄"),
    L("किताब ने पेंसिल से कहा — तुम्हारी तो हर बात का पॉइंट होता है! ✏️😄",
      "Why did the clock go back to the kitchen? For seconds! ⏰😄",
      "Kitaab ne pencil se kaha — tumhari toh har baat ka point hota hai! ✏️😄"),
    L("बंदर ने केले से कहा — छिलका उतारो, मुझे शर्म आती है! 🐒🍌😂",
      "What do you call a bear with no teeth? A gummy bear! 🐻😄",
      "Bandar ne kele se kaha — chhilka utaro, mujhe sharam aati hai! 🐒🍌😂"),
  ];

  var RIDDLES = [
    { q: L("पहेली: मेरे दो हाथ हैं पर मैं ताली नहीं बजाती, मैं समय बताती हूँ। मैं कौन? 🤔",
        "Riddle: I have two hands but I can't clap. I tell you the time. What am I? 🤔",
        "Paheli: Mere do haath hain par main taali nahi bajati, main samay batati hoon. Main kaun? 🤔"),
      a: L("घड़ी! ⏰", "A clock! ⏰", "Ghadi! ⏰"), keys: ["घडी", "ghadi", "clock", "watch"] },
    { q: L("पहेली: ऐसी कौन सी चीज़ है जिसके दाँत हैं पर वो खाती नहीं? 🤔",
        "Riddle: What has teeth but never eats? 🤔",
        "Paheli: Aisi kaun si cheez hai jiske daant hain par woh khaati nahi? 🤔"),
      a: L("कंघी! 🪮", "A comb! 🪮", "Kanghi! 🪮"), keys: ["कंघी", "कंघा", "kanghi", "kangha", "comb"] },
    { q: L("पहेली: रोज़ सुबह आता हूँ, सबको जगाता हूँ, शाम को सोने जाता हूँ। मैं कौन? 🤔",
        "Riddle: I come every morning, I wake everyone up, and I go to sleep in the evening. Who am I? 🤔",
        "Paheli: Roz subah aata hoon, sabko jagata hoon, shaam ko sone jaata hoon. Main kaun? 🤔"),
      a: L("सूरज दादा! ☀️", "Mr Sun! ☀️", "Suraj dada! ☀️"), keys: ["सूरज", "suraj", "sun", "सूर्य"] },
    { q: L("पहेली: पानी में रहती हूँ, तैरती रहती हूँ, पर कभी भीगी नहीं लगती। मैं कौन? 🤔",
        "Riddle: I live in water and swim all day. What am I? 🤔",
        "Paheli: Paani mein rehti hoon, tairti rehti hoon. Main kaun? 🤔"),
      a: L("मछली! 🐟", "A fish! 🐟", "Machhli! 🐟"), keys: ["मछली", "machhli", "machli", "fish"] },
    { q: L("पहेली: जितनी बड़ी होती है, उतना कम दिखता है। बताओ क्या? 🤔",
        "Riddle: The bigger it gets, the less you can see. What is it? 🤔",
        "Paheli: Jitni badi hoti hai, utna kam dikhta hai. Batao kya? 🤔"),
      a: L("अँधेरा! 🌑", "Darkness! 🌑", "Andhera! 🌑"), keys: ["अंधेरा", "andhera", "dark"] },
  ];

  var FACTS = [
    L("क्या तुम जानते हो? 🐙 ऑक्टोपस के तीन दिल होते हैं!", "Did you know? 🐙 An octopus has three hearts!", "Kya tum jaante ho? 🐙 Octopus ke teen dil hote hain!"),
    L("क्या तुम जानते हो? 😴 बच्चे सोते-सोते लंबे होते हैं — नींद में ही बढ़ते हैं!", "Did you know? 😴 Children grow taller while they sleep!", "Kya tum jaante ho? 😴 Bachche sote-sote lambe hote hain!"),
    L("क्या तुम जानते हो? 🦷 मुँह के छोटे कीटाणु रात में पार्टी करते हैं — ब्रश उन्हें भगा देता है!", "Did you know? 🦷 Tiny germs party in our mouth at night — brushing chases them away!", "Kya tum jaante ho? 🦷 Munh ke chhote keetanu raat mein party karte hain — brush unhe bhaga deta hai!"),
    L("क्या तुम जानते हो? 🐘 हाथी कूद नहीं सकता!", "Did you know? 🐘 Elephants can't jump!", "Kya tum jaante ho? 🐘 Haathi kood nahi sakta!"),
    L("क्या तुम जानते हो? 🌻 सूरजमुखी का फूल सूरज की तरफ़ मुँह घुमाता है!", "Did you know? 🌻 Sunflowers turn their faces to follow the sun!", "Kya tum jaante ho? 🌻 Surajmukhi ka phool suraj ki taraf munh ghumata hai!"),
  ];

  var STORIES = [
    L("एक प्यासे कौए ने घड़े में एक-एक कंकड़ डाला 🐦 पानी ऊपर आया और उसने पानी पी लिया! कोशिश करने वाले जीतते हैं! 💪",
      "A thirsty crow dropped pebbles into a pot, one by one 🐦 The water rose up and he drank it! Keep trying and you win! 💪",
      "Ek pyaase kauwe ne ghade mein ek-ek kankad daala 🐦 Paani upar aaya aur usne pee liya! Koshish karne wale jeet-te hain! 💪"),
    L("खरगोश तेज़ था पर बीच में सो गया 🐇 कछुआ रोज़ की तरह धीरे-धीरे चलता रहा और जीत गया! 🐢🏆",
      "The rabbit was fast but took a nap 🐇 The tortoise kept going, slow and steady, and won the race! 🐢🏆",
      "Khargosh tez tha par beech mein so gaya 🐇 Kachhua dheere-dheere chalta raha aur jeet gaya! 🐢🏆"),
    L("नन्ही चींटी रोज़ थोड़ा-थोड़ा दाना जमा करती थी 🐜 बारिश आई तो उसके घर में खूब खाना था! थोड़ा-थोड़ा रोज़, बड़ा कमाल!",
      "A little ant saved a few grains every day 🐜 When the rain came, she had plenty of food! A little every day makes magic!",
      "Nanhi cheenti roz thoda-thoda daana jama karti thi 🐜 Baarish aayi toh uske ghar mein khoob khaana tha!"),
    L("सूरज दादा रोज़ समय पर उठते हैं ☀️ तभी फूल खिलते हैं और चिड़ियाँ गाती हैं। शाम को वो भी आराम करने चले जाते हैं! 🌇",
      "Mr Sun wakes up on time every day ☀️ That's when flowers open and birds sing. In the evening, he goes to rest too! 🌇",
      "Suraj dada roz samay par uthte hain ☀️ Tabhi phool khilte hain aur chidiyaan gaati hain. Shaam ko woh bhi aaram karte hain! 🌇"),
    L("जाल में फँसे शेर को नन्हे चूहे ने दाँतों से जाल काटकर बचाया 🐭🦁 कोई भी छोटा नहीं होता! ❤️",
      "A tiny mouse saved a big lion by nibbling through the net 🐭🦁 Nobody is too small to help! ❤️",
      "Jaal mein phanse sher ko nanhe chuhe ne jaal kaat kar bachaya 🐭🦁 Koi bhi chhota nahi hota! ❤️"),
  ];
  var BEDTIME_STORIES = [
    L("चाँद मामा ने तारों से कहा — चलो, बच्चों को लोरी सुनाएँ 🌙 तारे टिमटिमाए, और सारे बच्चे मीठे सपनों में खो गए। ✨",
      "The Moon said to the stars: let's sing the children a lullaby 🌙 The stars twinkled, and all the children drifted into sweet dreams. ✨",
      "Chanda mama ne taaron se kaha — chalo, bachchon ko lori sunayein 🌙 Taare timtimaye, aur sab bachche meethe sapno mein kho gaye. ✨"),
    L("नन्हा उल्लू बोला — मैं रात को जागता हूँ, पर बच्चे रात को सोते हैं, ताकि सुबह खूब खेल सकें! 🦉🌙 शुभ रात्रि!",
      "Little Owl said: I stay up at night, but children sleep at night, so they can play all morning! 🦉🌙 Good night!",
      "Nanha ullu bola — main raat ko jaagta hoon, par bachche raat ko sote hain, taaki subah khoob khel sakein! 🦉🌙"),
    L("एक छोटा बादल दिन भर खेला ☁️ शाम को उसने माँ-बादल की गोद में सिर रखा और धीरे से सो गया। अब तुम्हारी बारी! 😴",
      "A little cloud played all day ☁️ In the evening it rested in Mummy Cloud's lap and gently fell asleep. Now it's your turn! 😴",
      "Ek chhota baadal din bhar khela ☁️ Shaam ko usne maa-baadal ki god mein sir rakha aur dheere se so gaya. Ab tumhari baari! 😴"),
  ];
  var RHYMES = [
    L("🎵 मछली जल की रानी है, जीवन उसका पानी है! 🐟", "🎵 Twinkle twinkle little star, how I wonder what you are! ⭐", "🎵 Machhli jal ki rani hai, jeevan uska paani hai! 🐟"),
    L("🎵 चंदा मामा दूर के, पुए पकाएँ बूर के! 🌙", "🎵 This is the way we brush our teeth, so early in the morning! 🪥", "🎵 Chanda mama door ke, puye pakayein boor ke! 🌙"),
    L("🎵 सुबह सवेरे उठ जाओ, ब्रश करो और मुस्काओ! 😁", "🎵 Rain rain go away, come again another day! 🌧️", "🎵 Subah savere uth jao, brush karo aur muskao! 😁"),
  ];
  var COUNTS = [
    L("चलो गिनें: एक, दो, तीन, चार, पाँच! 🖐️ अब तुम छह से दस तक गिनो!", "Let's count: one, two, three, four, five! 🖐️ Now you count from six to ten!", "Chalo ginein: ek, do, teen, chaar, paanch! 🖐️ Ab tum chhe se das tak gino!"),
    L("चलो खेल: 10 बार कूदो और साथ में गिनो! 🐸 एक… दो… तीन…", "Let's play: jump 10 times and count out loud! 🐸 One… two… three…", "Chalo khel: 10 baar koodo aur saath mein gino! 🐸 Ek… do… teen…"),
    L("अपनी उँगलियाँ गिनो! ✋🤚 एक हाथ में कितनी? पाँच! दोनों में? दस!", "Count your fingers! ✋🤚 How many on one hand? Five! On both? Ten!", "Apni ungliyan gino! ✋🤚 Ek haath mein kitni? Paanch! Dono mein? Das!"),
  ];
  var ANIMALS = [
    { keys: ["गाय", "gaay", "gaai", "=gai", "cow"], name: L("गाय", "cow", "Gaay"), sound: L("मूँ", "moo", "moo"), e: "🐄" },
    { keys: ["कुत्ता", "कुत्ते", "kutta", "=dog", "puppy"], name: L("कुत्ते", "dog", "Kutte"), sound: L("भौं-भौं", "woof woof", "bhau bhau"), e: "🐶" },
    { keys: ["बिल्ली", "billi", "=cat", "kitten"], name: L("बिल्ली", "cat", "Billi"), sound: L("म्याऊँ", "meow", "myaoon"), e: "🐱" },
    { keys: ["शेर", "sher", "lion"], name: L("शेर", "lion", "Sher"), sound: L("दहाड़ — रॉआआर", "roar", "roaaar"), e: "🦁" },
    { keys: ["बकरी", "bakri", "goat"], name: L("बकरी", "goat", "Bakri"), sound: L("मैं-मैं", "maa maa", "main main"), e: "🐐" },
    { keys: ["मुर्गा", "murga", "rooster", "=hen"], name: L("मुर्गे", "rooster", "Murge"), sound: L("कुकड़ूँ-कूँ", "cock-a-doodle-doo", "kukdoo koo"), e: "🐓",
      extra: L("वो सुबह-सुबह सबको जगाता है!", "He wakes everyone up in the morning!", "Woh subah-subah sabko jagata hai!") },
    { keys: ["बत्तख", "battakh", "batak", "duck"], name: L("बत्तख", "duck", "Battakh"), sound: L("क्वैक-क्वैक", "quack quack", "quack quack"), e: "🦆" },
    { keys: ["कौआ", "कौवा", "kauwa", "kauva", "crow"], name: L("कौए", "crow", "Kauwe"), sound: L("काँव-काँव", "caw caw", "kaanv kaanv"), e: "🐦" },
    { keys: ["हाथी", "haathi", "hathi", "elephant"], name: L("हाथी", "elephant", "Haathi"), sound: L("पों-पों", "pawoo", "pon pon"), e: "🐘" },
    { keys: ["मेंढक", "mendhak", "frog"], name: L("मेंढक", "frog", "Mendhak"), sound: L("टर्र-टर्र", "ribbit ribbit", "tarr tarr"), e: "🐸" },
    { keys: ["उल्लू", "ullu", "=owl"], name: L("उल्लू", "owl", "Ullu"), sound: L("हू-हू", "hoo hoo", "hoo hoo"), e: "🦉",
      extra: L("वो रात को जागता है, बच्चे रात को सोते हैं!", "Owls stay up at night — children sleep at night!", "Woh raat ko jaagta hai, bachche raat ko sote hain!") },
  ];
  var COLOURS = [
    { keys: ["लाल", "laal", "=lal", "=red"], name: L("लाल", "red", "laal"), e: "🔴" },
    { keys: ["नीला", "नीली", "neela", "neeli", "blue"], name: L("नीला", "blue", "neela"), e: "🔵" },
    { keys: ["पीला", "पीली", "peela", "peeli", "yellow"], name: L("पीला", "yellow", "peela"), e: "🟡" },
    { keys: ["हरा", "हरी", "=hara", "=hari", "green"], name: L("हरा", "green", "hara"), e: "🟢" },
  ];

  var CAREERS = [
    { keys: ["डॉक्टर", "डाक्टर", "doctor", "daktar"], name: L("डॉक्टर", "doctor", "doctor"), e: "🩺",
      tip: L("डॉक्टर रोज़ थोड़ा पढ़ते हैं और हरी सब्ज़ी खाते हैं!", "Doctors read a little every day and eat their greens!", "Doctor roz thoda padhte hain aur hari sabzi khaate hain!") },
    { keys: ["टीचर", "शिक्षक", "अध्यापक", "teacher", "madam"], name: L("टीचर", "teacher", "teacher"), e: "📚",
      tip: L("टीचर रोज़ नई किताबें पढ़ते हैं!", "Teachers read new books every day!", "Teacher roz nayi kitaabein padhte hain!") },
    { keys: ["पुलिस", "police", "inspector"], name: L("पुलिस", "police officer", "police"), e: "👮",
      tip: L("पुलिस वाले जल्दी उठते हैं और रोज़ दौड़ लगाते हैं!", "Police officers wake up early and run every day!", "Police wale jaldi uthte hain aur roz daud lagate hain!") },
    { keys: ["पायलट", "pilot"], name: L("पायलट", "pilot", "pilot"), e: "✈️",
      tip: L("पायलट समय के पक्के होते हैं — जहाज़ समय पर उड़ता है!", "Pilots are always on time — planes leave on time!", "Pilot samay ke pakke hote hain — jahaaz samay par udta hai!") },
    { keys: ["अंतरिक्ष", "astronaut", "antariksh"], name: L("अंतरिक्ष यात्री", "astronaut", "astronaut"), e: "🚀",
      tip: L("अंतरिक्ष यात्री पूरा ध्यान लगाकर काम करते हैं!", "Astronauts focus really well on their work!", "Astronaut poora dhyan lagakar kaam karte hain!") },
    { keys: ["वैज्ञानिक", "scientist", "vaigyanik", "vaigyanik"], name: L("वैज्ञानिक", "scientist", "scientist"), e: "🔬",
      tip: L("वैज्ञानिक रोज़ सवाल पूछते हैं — 'क्यों?'", "Scientists ask 'why?' every single day!", "Scientist roz sawaal poochte hain — 'kyun?'") },
    { keys: ["क्रिकेटर", "cricketer", "खिलाडी", "khiladi", "player"], name: L("खिलाड़ी", "sports star", "khiladi"), e: "🏏",
      tip: L("खिलाड़ी समय पर सोते हैं और अच्छा खाना खाते हैं!", "Sports stars sleep on time and eat good food!", "Khiladi samay par sote hain aur achha khaana khaate hain!") },
    { keys: ["किसान", "kisan", "kisaan", "farmer"], name: L("किसान", "farmer", "kisan"), e: "🌾",
      tip: L("किसान सूरज के साथ उठते हैं!", "Farmers wake up with the sun!", "Kisan suraj ke saath uthte hain!") },
    { keys: ["चित्रकार", "artist", "painter", "कलाकार"], name: L("चित्रकार", "artist", "artist"), e: "🎨",
      tip: L("चित्रकार ध्यान से एक-एक रंग भरते हैं!", "Artists fill in each colour carefully!", "Artist dhyan se ek-ek rang bharte hain!") },
    { keys: ["इंजीनियर", "engineer"], name: L("इंजीनियर", "engineer", "engineer"), e: "🛠️",
      tip: L("इंजीनियर रोज़ गिनती और जोड़ का अभ्यास करते हैं!", "Engineers practise their numbers every day!", "Engineer roz ginti aur jod ki practice karte hain!") },
    { keys: ["सैनिक", "फौजी", "सिपाही", "soldier", "army", "fauji"], name: L("सैनिक", "soldier", "fauji"), e: "🎖️",
      tip: L("सैनिक समय पर उठते हैं और खूब कसरत करते हैं!", "Soldiers wake up on time and exercise a lot!", "Fauji samay par uthte hain aur khoob kasrat karte hain!") },
    { keys: ["गायक", "गायिका", "singer"], name: L("गायक", "singer", "singer"), e: "🎤",
      tip: L("गायक रोज़ थोड़ा अभ्यास करते हैं और खूब पानी पीते हैं!", "Singers practise a little every day and drink lots of water!", "Singer roz thoda riyaaz karte hain aur khoob paani peete hain!") },
    { keys: ["शेफ", "=chef", "=cook", "बावर्ची"], name: L("शेफ़", "chef", "chef"), e: "👩‍🍳",
      tip: L("शेफ़ सब्ज़ियों से दोस्ती करते हैं!", "Chefs are best friends with vegetables!", "Chef sabziyon se dosti karte hain!") },
    { keys: ["नर्स", "nurse"], name: L("नर्स", "nurse", "nurse"), e: "💉",
      tip: L("नर्स सबकी मदद करते हैं, जैसे तुम घर पर करते हो!", "Nurses help everyone, just like you help at home!", "Nurse sabki madad karte hain, jaise tum ghar par karte ho!") },
  ];

  /* Real-life habits the garden understands (ARCHITECTURE.md: habit:done). */
  var HABITS = {
    brush: { noun: ["ब्रश", "दांत", "brush", "teeth", "tooth", "daant", "=dant", "=daat"],
      done: ["brushed", "साफ किए", "साफ कर", "saaf kiye", "saaf kar"] },
    eat: { noun: ["खाना", "नाश्ता", "खाया", "खा लिया", "खाई", "lunch", "dinner", "breakfast", "khana", "khaana", "nashta", "naashta",
      "=khaya", "kha liya", "=ate", "eaten", "food", "सब्जी", "sabzi", "sabji", "vegetable", "veggies", "=फल", "fruit", "रोटी", "roti", "दाल", "=dal", "चावल", "chawal", "=rice", "थाली"],
      done: ["खाया", "खा लिया", "खा ली", "खाई", "kha liya", "kha li", "=khaya", "=khayi", "=ate", "eaten", "had my", "finished my"] },
    water: { noun: ["पानी", "water", "paani", "=pani", "=jal"],
      done: ["पी लिया", "पिया", "पी ली", "pi liya", "pee liya", "piya", "pi li", "drank", "drunk", "had water", "had some water"] },
    play: { noun: ["=खेला", "=खेली", "खेल लिया", "played", "=khela", "=kheli", "khel liya"], always: true },
    read: { noun: ["=पढा", "=पढी", "पढ लिया", "पढाई", "किताब", "होमवर्क", "=padha", "=padhi", "padh liya", "padhai", "kitab", "kitaab",
      "homework", "studied", "=read", "book"],
      done: ["=पढा", "=पढी", "पढ लिया", "पढाई की", "=padha", "=padhi", "padh liya", "padhai ki", "studied", "i read", "finished my homework", "homework done"] },
    sleep: { noun: ["सो गया", "सो गई", "सोया", "सोई", "उठ गया", "उठ गई", "जाग गया", "जाग गई", "slept", "woke", "woken", "so gaya",
      "so gayi", "soya", "uth gaya", "uth gayi", "jag gaya", "jaag gaya", "jag gayi", "jaag gayi", "good sleep"], always: true },
    help: { noun: ["मदद", "help", "madad", "हाथ बंटा"],
      done: ["मदद की", "मदद कर दी", "helped", "madad ki", "madad kar di", "help kiya", "help ki", "help kar di"] },
  };
  var GENERIC_DONE = ["मैंने", "मैने", "लिया", "=ली", "लिए", "किया", "किए", "कर दिया", "कर दी", "चुका", "चुकी", "हो गया", "हो गई",
    "maine", "mene", "liya", "=li", "kiya", "kiye", "kar diya", "kar di", "chuka", "chuki", "ho gaya", "done", "=did", "finished"];
  var NEG = ["नहीं", "नही", "=मत", "=न", "nahi", "nahin", "=nai", "=not", "didnt", "havent", "dont", "=no", "=mat", "cant", "cannot"];

  var PRAISE = {
    brush: [L("चमकते दाँत! ✨ शाबाश{n}! कीटाणु भाग गए!", "Sparkly teeth! ✨ Well done{n}! The germs ran away!", "Chamakte daant! ✨ Shabash{n}! Keetanu bhaag gaye!"),
      L("वाह{n}! 😁 तुम्हारी मुस्कान तो सूरज जैसी चमक रही है!", "Wow{n}! 😁 Your smile is shining like the sun!", "Wah{n}! 😁 Tumhari muskaan toh suraj jaisi chamak rahi hai!")],
    eat: [L("वाह, पेट खुश! 😋 शाबाश{n}! समय पर खाना मतलब खेलने की पूरी ताक़त!", "Happy tummy! 😋 Well done{n}! Eating on time gives you power to play!", "Wah, pet khush! 😋 Shabash{n}! Samay par khaana matlab khelne ki poori taakat!"),
      L("शाबाश{n}! 🥕 थाली में कोई हरी सब्ज़ी भी थी?", "Well done{n}! 🥕 Was there something green on your plate?", "Shabash{n}! 🥕 Thaali mein koi hari sabzi bhi thi?")],
    water: [L("💧 शाबाश{n}! पानी पीकर तो पौधे भी मुस्कुराते हैं!", "💧 Well done{n}! Even plants smile after a drink of water!", "💧 Shabash{n}! Paani peekar toh paudhe bhi muskurate hain!"),
      L("वाह{n}! 💧 अब तुम्हारा शरीर ताज़ा फूल जैसा!", "Yay{n}! 💧 Now you're fresh like a flower!", "Wah{n}! 💧 Ab tum taaza phool jaise ho!")],
    play: [L("खेल से शरीर मज़बूत! 💪 शाबाश{n}! अब हाथ धोकर थोड़ा आराम?", "Playing makes you strong! 💪 Well done{n}! Now wash your hands and rest a bit?", "Khel se shareer mazboot! 💪 Shabash{n}! Ab haath dhokar thoda aaram?"),
      L("वाह{n}! ⚽ तुमने क्या खेला? मुझे भी बताओ!", "Yay{n}! ⚽ What did you play? Tell me!", "Wah{n}! ⚽ Tumne kya khela? Mujhe bhi batao!")],
    read: [L("पढ़ाकू दोस्त! 📚 शाबाश{n}! दिमाग़ चमक गया!", "Reading star! 📚 Well done{n}! Your brain is shining!", "Padhaku dost! 📚 Shabash{n}! Dimaag chamak gaya!"),
      L("वाह{n}! 🌟 थोड़ा पढ़ा, अब थोड़ा खेल — बिल्कुल सही!", "Wow{n}! 🌟 A little reading, then a little play — just right!", "Wah{n}! 🌟 Thoda padha, ab thoda khel — bilkul sahi!")],
    sleep: [L("वाह, अच्छी नींद! 🌞 जल्दी उठने वालों को खेलने के लिए पूरा दिन मिलता है!", "A good sleep! 🌞 Early risers get a whole long day to play!", "Wah, achhi neend! 🌞 Jaldi uthne walon ko khelne ke liye poora din milta hai!"),
      L("शाबाश{n}! 😴➡️😄 नींद पूरी, तो मन भी खुश!", "Well done{n}! 😴➡️😄 Good sleep makes a happy day!", "Shabash{n}! 😴➡️😄 Neend poori, toh mann bhi khush!")],
    help: [L("तुम तो सुपर-हेल्पर हो{n}! 🦸 घर में सब खुश हो गए होंगे!", "You're a super helper{n}! 🦸 Everyone at home must be so happy!", "Tum toh super-helper ho{n}! 🦸 Ghar mein sab khush ho gaye honge!"),
      L("वाह{n}! 🤝 मदद करने वाले हाथ सबसे प्यारे!", "Wow{n}! 🤝 Helping hands are the best hands!", "Wah{n}! 🤝 Madad karne wale haath sabse pyaare!")],
  };
  var MULTI_PRAISE = [L("वाह{n}! 🌟 एक साथ कई अच्छे काम — तुम तो कमाल हो!", "Wow{n}! 🌟 So many good things at once — you're amazing!", "Wah{n}! 🌟 Ek saath kai achhe kaam — tum toh kamaal ho!"),
    L("शाबाश{n}! 🎉 आज का दिन तो चमक रहा है!", "Well done{n}! 🎉 Today is shining bright!", "Shabash{n}! 🎉 Aaj ka din toh chamak raha hai!")];
  /* "Not yet" → a tiny game, never a scolding. */
  var NOT_YET = {
    brush: [L("कोई बात नहीं! 😄 चलो देखें कौन जल्दी दाँत ब्रश करके आता है — मैं गिनती गिनता हूँ!", "No problem! 😄 Let's see how fast you can brush — I'll count!", "Koi baat nahi! 😄 Chalo dekhein kaun jaldi brush karke aata hai — main ginti ginta hoon!"),
      L("चलो, ब्रश वाला डांस! 🪥 ऊपर-नीचे, गोल-गोल… करके आओ, फिर बताना!", "Let's do the brushing dance! 🪥 Up and down, round and round… then come and tell me!", "Chalo, brush wala dance! 🪥 Upar-neeche, gol-gol… karke aao, phir batana!")],
    eat: [L("चलो, मम्मी-पापा के साथ खाना खाओ! 🍛 आज थाली में कौन-सा रंग है — हरा, पीला या लाल?", "Go and eat with your family! 🍛 Which colours are on your plate today?", "Chalo, Mummy-Papa ke saath khaana khao! 🍛 Aaj thaali mein kaun sa rang hai?"),
      L("पेट गुड़गुड़ बोल रहा है! 😄 खाना खाकर आओ, फिर मैं एक पहेली पूछूँगा!", "Your tummy is rumbling! 😄 Eat first, then I'll ask you a riddle!", "Pet gudgud bol raha hai! 😄 Khaana khaakar aao, phir main ek paheli poochhunga!")],
    water: [L("चलो, एक गिलास पानी! 💧 गट-गट-गट… पीकर बताना!", "Let's have a glass of water! 💧 Glug glug glug… then tell me!", "Chalo, ek glass paani! 💧 Gat-gat-gat… peekar batana!"),
      L("पानी पीने की रेस! 💧 मैं पाँच तक गिनता हूँ — एक, दो…", "Water race! 💧 I'll count to five — one, two…", "Paani peene ki race! 💧 Main paanch tak ginta hoon — ek, do…")],
    sleep: [L("चलो, धीरे-धीरे तारे गिनें 🌟 एक… दो… तीन… आँखें बंद, साँस धीमी।", "Let's count stars slowly 🌟 One… two… three… eyes closed, slow breaths.", "Chalo, dheere-dheere taare ginein 🌟 Ek… do… teen… aankhein band, saans dheemi."),
      L("आँखें बंद करो और सोचो — कल सुबह क्या खेलोगे? 🌙 सपनों में वही खेलना!", "Close your eyes and think — what will you play tomorrow? 🌙 Play it in your dreams!", "Aankhein band karo aur socho — kal subah kya kheloge? 🌙 Sapno mein wahi khelna!")],
    read: [L("चलो, बस एक पन्ना! 📖 एक पन्ना पढ़ो, फिर एक पहेली — पक्का?", "Just one page! 📖 Read one page, then a riddle — deal?", "Chalo, bas ek panna! 📖 Ek panna padho, phir ek paheli — pakka?")],
  };
  var HABIT_SUGG = { brush: S.didBrush, eat: S.didEat, water: S.didWater, play: S.didPlay, read: S.didRead, help: S.didHelp, sleep: S.goodnight };
  var HABIT_NEXT = { brush: ["eat", "water"], eat: ["water", "brush"], water: ["play"], play: ["water", "read"], read: ["play"], sleep: ["brush"], help: ["read"] };

  /* ================= Time of day: gentle steering ("nudges") ================= */

  function N(id, habit, text, sugg, extra) {
    var o = { id: id, habit: habit, text: text, sugg: sugg || [] };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  var NUDGES = {
    dawn: [ // 5:00–9:00
      N("brush", "brush", L("सूरज दादा जाग गए! ☀️ तुमने ब्रश किया? चलो देखें कौन जल्दी दाँत चमकाता है — मैं गिनती गिनता हूँ!",
        "Mr Sun is awake! ☀️ Did you brush? Let's see who can make their teeth shine first — I'll count!",
        "Suraj dada jaag gaye! ☀️ Tumne brush kiya? Chalo dekhein kaun jaldi daant chamkata hai — main ginti ginta hoon!"), [S.didBrush, MENU.count]),
      N("breakfast", "eat", L("नाश्ते में आज क्या है? 🥣 सुबह पेट को ईंधन चाहिए — जैसे गाड़ी को!",
        "What's for breakfast today? 🥣 Tummies need fuel in the morning — just like cars!",
        "Naashte mein aaj kya hai? 🥣 Subah pet ko fuel chahiye — jaise gaadi ko!"), [S.didBreakfast, MENU.joke]),
      N("water", "water", L("सुबह का पहला खेल: एक गिलास पानी! 💧 पौधे भी सुबह पानी पीते हैं।",
        "Morning game number one: a glass of water! 💧 Plants drink in the morning too.",
        "Subah ka pehla khel: ek glass paani! 💧 Paudhe bhi subah paani peete hain."), [S.didWater, MENU.story]),
      N("stretch", null, L("चलो सुबह की अंगड़ाई: हाथ ऊपर… और नीचे! 🙆 सूरज जैसे बड़े बनो!",
        "Morning stretch: arms up high… and down! 🙆 Grow big like the sun!",
        "Chalo subah ki angdaai: haath upar… aur neeche! 🙆 Suraj jaise bade bano!"), [S.woke, MENU.count]),
    ],
    morning: [ // 9:00–11:30
      N("study", "read", L("सुबह दिमाग़ सबसे तेज़ होता है! 🧠 थोड़ी पढ़ाई करें या पहले एक पहेली?",
        "Morning brains are the fastest! 🧠 A little learning, or a riddle first?",
        "Subah dimaag sabse tez hota hai! 🧠 Thodi padhai karein ya pehle ek paheli?"), [MENU.riddle, S.focus]),
      N("jump", null, L("चलो एक खेल: 10 बार कूदो और गिनो! 🐸 तैयार?",
        "Let's play: jump 10 times and count! 🐸 Ready?",
        "Chalo ek khel: 10 baar koodo aur gino! 🐸 Taiyaar?"), [MENU.count, MENU.joke]),
      N("water", "water", L("पानी का ब्रेक! 💧 एक गिलास पानी पियो, फिर अगला खेल!",
        "Water break! 💧 Have a glass of water, then the next game!",
        "Paani ka break! 💧 Ek glass paani piyo, phir agla khel!"), [S.didWater, MENU.riddle]),
    ],
    lunch: [ // 11:30–14:30
      N("lunch", "eat", L("खाने का समय आ रहा है! 🍛 पहले हाथ धोकर आओ — साबुन के बुलबुले बनाओ! 🫧",
        "Lunch time is coming! 🍛 Wash your hands first — make lots of soap bubbles! 🫧",
        "Khaane ka samay aa raha hai! 🍛 Pehle haath dhokar aao — saabun ke bulbule banao! 🫧"), [S.didEat, MENU.story]),
      N("veg", "eat", L("आज थाली में कौन सी हरी सब्ज़ी है? 🥦 हरी सब्ज़ी खाकर तो पहलवान बनते हैं! 💪",
        "Is there something green on your plate today? 🥦 Greens make you super strong! 💪",
        "Aaj thaali mein kaun si hari sabzi hai? 🥦 Hari sabzi khaakar toh pehalwan bante hain! 💪"), [S.didEat, MENU.joke]),
      N("water", "water", L("खाने के साथ पानी भी! 💧 तुमने आज कितने गिलास पिए?",
        "Water with lunch too! 💧 How many glasses have you had today?",
        "Khaane ke saath paani bhi! 💧 Tumne aaj kitne glass piye?"), [S.didWater, MENU.count]),
    ],
    rest: [ // 14:30–16:00
      N("rest", null, L("दोपहर है 🌤️ थोड़ा आराम करें? आँखें बंद करके 5 गहरी साँस — फिर ताज़गी!",
        "It's afternoon 🌤️ Time for a little rest? Close your eyes and take 5 deep breaths!",
        "Dopahar hai 🌤️ Thoda aaram karein? Aankhein band karke 5 gehri saans — phir taazgi!"), [S.breathe, MENU.story], { mood: "calm" }),
      N("draw", null, L("दोपहर का शांत खेल: एक चित्र बनाओ 🎨 सूरज, पेड़ या कोई जानवर!",
        "A calm afternoon game: draw a picture 🎨 the sun, a tree or an animal!",
        "Dopahar ka shaant khel: ek chitra banao 🎨 suraj, ped ya koi jaanwar!"), [MENU.colour, MENU.riddle], { mood: "calm" }),
      N("water", "water", L("गर्मी में पानी दोस्त है! 💧 एक घूँट अभी?",
        "Water is your friend in the afternoon! 💧 A sip right now?",
        "Garmi mein paani dost hai! 💧 Ek ghoont abhi?"), [S.didWater, MENU.joke]),
    ],
    outdoor: [ // 16:00–18:30
      N("outside", "play", L("शाम हो गई! 🌇 बाहर जाकर खेलो — दौड़, झूला, गेंद! फिर आकर बताना क्या खेला।",
        "It's evening! 🌇 Go and play outside — run, swing, kick a ball! Then tell me what you played.",
        "Shaam ho gayi! 🌇 Bahar jaakar khelo — daud, jhoola, gend! Phir aakar batana kya khela."), [S.didPlay, MENU.joke]),
      N("help", "help", L("एक सुपर-हीरो काम: आज घर में किसी की मदद करो! 🦸 पौधों को पानी देना भी चलेगा।",
        "A superhero job: help someone at home today! 🦸 Watering the plants counts too.",
        "Ek super-hero kaam: aaj ghar mein kisi ki madad karo! 🦸 Paudhon ko paani dena bhi chalega."), [S.didHelp, MENU.story]),
      N("water", "water", L("खेलने से पहले पानी! 💧 फिर दौड़ लगाओ!",
        "Water before playing! 💧 Then off you run!",
        "Khelne se pehle paani! 💧 Phir daud lagao!"), [S.didWater, S.didPlay]),
    ],
    eveningRead: [ // 18:30–20:00
      N("read", "read", L("शाम की कहानी-घड़ी! 📚 खेल के बाद थोड़ा पढ़ें? एक पन्ना भी कमाल है!",
        "Evening book time! 📚 A little reading after play? Even one page is magic!",
        "Shaam ki kahani-ghadi! 📚 Khel ke baad thoda padhein? Ek panna bhi kamaal hai!"), [S.didRead, MENU.story]),
      N("dinner", "eat", L("रात के खाने में आज क्या बना है? 🍲 सब्ज़ी-रोटी खाकर नींद भी मीठी आती है!",
        "What's for dinner today? 🍲 A good dinner brings sweet sleep!",
        "Raat ke khaane mein aaj kya bana hai? 🍲 Sabzi-roti khaakar neend bhi meethi aati hai!"), [S.didEat, MENU.joke]),
      N("table", "help", L("खाने की मेज़ सजाने में मदद करोगे? 🍽️ छोटे हेल्पर सबसे प्यारे!",
        "Can you help set the table? 🍽️ Little helpers are the sweetest!",
        "Khaane ki mez sajaane mein madad karoge? 🍽️ Chhote helper sabse pyaare!"), [S.didHelp, MENU.riddle]),
    ],
    night: [ // 20:00–5:00
      N("wind", "sleep", L("सूरज दादा भी सो गए, चाँद मामा आ गए! 🌙 चलो सोने की तैयारी — ब्रश, कहानी, फिर मीठे सपने।",
        "Mr Sun has gone to sleep and the Moon is here! 🌙 Let's get ready for bed — brush, a story, then sweet dreams.",
        "Suraj dada bhi so gaye, chanda mama aa gaye! 🌙 Chalo sone ki taiyari — brush, kahani, phir meethe sapne."), [S.bedStory, S.goodnight], { mood: "sleepy" }),
      N("brush", "brush", L("रात का ब्रश, कीटाणु रफ़ू-चक्कर! 🪥✨ ब्रश करके आओ, मैं तब तक तारे गिनता हूँ!",
        "Night-time brushing makes germs disappear! 🪥✨ Go and brush, I'll count the stars!",
        "Raat ka brush, keetanu rafoo-chakkar! 🪥✨ Brush karke aao, main tab tak taare ginta hoon!"), [S.didBrush, S.goodnight], { mood: "sleepy" }),
      N("story", null, L("एक छोटी सी सोने वाली कहानी सुनोगे? 🌛",
        "Shall I tell you a tiny bedtime story? 🌛",
        "Ek chhoti si sone wali kahani sunoge? 🌛"), [S.yes, S.goodnight], { mood: "sleepy", offer: { say: "story" } }),
    ],
  };
  var SCREEN_REST_NIGHT = N("screenrest", null, L("आज हमने बहुत बातें कीं! 🌙 अब आँखों को भी आराम चाहिए। स्क्रीन को गुड नाइट बोलें और बड़ों से कहानी सुनें?",
    "We talked so much today! 🌙 Our eyes need a rest now. Let's say good night to the screen and hear a story from a grown-up?",
    "Aaj humne bahut baatein kin! 🌙 Ab aankhon ko bhi aaram chahiye. Screen ko good night bolein aur bado se kahani sunein?"), [S.goodnight], { mood: "sleepy" });
  var SCREEN_REST_DAY = N("screenplay", "play", L("हमने बहुत देर स्क्रीन पर खेला! 🌳 अब कोई भागने-कूदने वाला खेल? आँखें और पैर दोनों खुश!",
    "We've played on the screen for a long time! 🌳 How about a running-jumping game now? Happy eyes, happy legs!",
    "Humne bahut der screen par khela! 🌳 Ab koi bhaagne-koodne wala khel? Aankhein aur pair dono khush!"), [S.didPlay], { mood: "happy" });
  var DREAM_ASK = N("dreamask", null, L("एक सवाल: बड़े होकर क्या बनोगे? 🌟 डॉक्टर, पायलट, या कुछ और?",
    "A question for you: what will you be when you grow up? 🌟 A doctor, a pilot, or something else?",
    "Ek sawaal: bade hokar kya banoge? 🌟 Doctor, pilot, ya kuch aur?"), [S.doctor, S.pilot, S.teacher], { mood: "curious", offer: { open: "dreams" }, dreamAsk: true });

  var OPENERS = {
    dawn: L("सुप्रभात{n}! ☀️", "Good morning{n}! ☀️", "Good morning{n}! ☀️"),
    morning: L("सुप्रभात{n}! ☀️", "Good morning{n}! ☀️", "Good morning{n}! ☀️"),
    lunch: L("नमस्ते{n}! 🌤️", "Hello{n}! 🌤️", "Namaste{n}! 🌤️"),
    rest: L("नमस्ते{n}! 🌤️", "Hello{n}! 🌤️", "Namaste{n}! 🌤️"),
    outdoor: L("नमस्ते{n}! 🌇", "Good evening{n}! 🌇", "Namaste{n}! 🌇"),
    eveningRead: L("नमस्ते{n}! 🌇", "Good evening{n}! 🌇", "Namaste{n}! 🌇"),
    night: L("नमस्ते{n}! 🌙", "Hello{n}! 🌙", "Namaste{n}! 🌙"),
  };
  var INTRO = L("मैं मिट्ठू हूँ 🦜", "I'm Mitthu 🦜", "Main Mitthu hoon 🦜");
  var SLOT_HINT = {
    dawn: L("नाश्ते और ब्रश का समय!", "Time for brushing and breakfast!", "Brush aur naashte ka samay!"),
    morning: L("सीखने और खेलने का समय!", "Time to learn and play!", "Seekhne aur khelne ka samay!"),
    lunch: L("खाने का समय!", "Lunch time!", "Khaane ka samay!"),
    rest: L("थोड़े आराम का समय!", "Time for a little rest!", "Thode aaram ka samay!"),
    outdoor: L("बाहर खेलने का समय!", "Time to play outside!", "Bahar khelne ka samay!"),
    eveningRead: L("थोड़ा पढ़ने और खाने का समय!", "Time for a little reading and dinner!", "Thoda padhne aur khaane ka samay!"),
    night: L("सोने का समय!", "Time for bed!", "Sone ka samay!"),
  };

  /* ================= Fixed lines ================= */

  var T = {
    empty: [L("कुछ तो बोलो! 😊 मैं सुन रहा हूँ।", "Say something! 😊 I'm listening.", "Kuch toh bolo! 😊 Main sun raha hoon."),
      L("मैं यहीं हूँ! 🦜 बोलो, क्या करें?", "I'm right here! 🦜 What shall we do?", "Main yahin hoon! 🦜 Bolo, kya karein?")],
    hurt: [L("अच्छा किया जो तुमने बताया 💛 ये तुम्हारी गलती नहीं है। अभी किसी भरोसेमंद बड़े को बताओ। 1098 या 112 पर फ़ोन भी कर सकते हो, मुफ़्त है।",
      "I'm glad you told me 💛 It is not your fault. Please tell a grown-up you trust right now. In India you can also call 1098 or 112 — it's free.",
      "Achha kiya jo tumne bataya 💛 Yeh tumhari galti nahi hai. Abhi kisi bharosemand bade ko batao. 1098 ya 112 par phone bhi kar sakte ho, free hai."),
      L("तुमने मुझे बताया, ये बहुत बहादुरी है 💛 तुम्हारी गलती नहीं है। जिस बड़े पर भरोसा हो — टीचर, दादी या कोई और — उसे ज़रूर बताओ, या 1098 या 112 पर फ़ोन करो।",
      "You were very brave to tell me 💛 It's not your fault. Tell a grown-up you trust — a teacher, Grandma or someone else — or call 1098 or 112.",
      "Tumne mujhe bataya, yeh bahut bahaduri hai 💛 Tumhari galti nahi hai. Jis bade par bharosa ho — teacher, dadi ya koi aur — unhe batao, ya 1098 ya 112 par phone karo.")],
    secret: [L("सरप्राइज़ वाले राज़ मज़ेदार होते हैं 🎁 पर जो बात अजीब या बुरी लगे, वो हमेशा किसी भरोसेमंद बड़े को बताओ — या 1098 या 112 पर।",
      "Surprise secrets can be fun 🎁 But if something feels strange or bad, always tell a grown-up you trust — or call 1098 or 112.",
      "Surprise wale raaz mazedaar hote hain 🎁 Par jo baat ajeeb ya buri lage, woh hamesha kisi bharosemand bade ko batao — ya 1098 ya 112 par."),
      L("बुरे राज़ कभी छुपाने नहीं होते 💛 जो बात परेशान करे, मम्मी-पापा, टीचर या किसी भरोसेमंद बड़े को बताओ। 1098 या 112 भी मदद करते हैं।",
      "Bad secrets are never for keeping 💛 If something worries you, tell Mummy, Papa, a teacher or a grown-up you trust. 1098 or 112 can help too.",
      "Bure raaz kabhi chhupane nahi hote 💛 Jo baat pareshan kare, Mummy-Papa, teacher ya kisi bharosemand bade ko batao. 1098 ya 112 bhi madad karte hain.")],
    grownup: [L("ये बात किसी भरोसेमंद बड़े से पूछना सबसे अच्छा है 💛 कुछ अजीब या डरावना लगे, तो मम्मी-पापा या टीचर को ज़रूर बताओ। चलो, कुछ प्यारा खेलें?",
      "That's a question for a grown-up you trust 💛 If anything feels strange or scary, tell Mummy, Papa or your teacher. Shall we play something nice?",
      "Yeh baat kisi bharosemand bade se poochhna sabse achha hai 💛 Kuch ajeeb ya daravna lage, toh Mummy-Papa ya teacher ko zaroor batao. Chalo, kuch pyaara khelein?"),
      L("ये बड़ों वाली बात है 💛 इसके बारे में मम्मी-पापा से पूछो — वो अच्छे से समझाएँगे। तब तक एक पहेली खेलें?",
      "That's a grown-up topic 💛 Ask Mummy or Papa about it — they'll explain it well. Shall we do a riddle meanwhile?",
      "Yeh bado wali baat hai 💛 Iske baare mein Mummy-Papa se poochho — woh achhe se samjhayenge. Tab tak ek paheli khelein?")],
    rude: [L("ओह, ये शब्द प्यारा नहीं है 🙊 चलो कोई मीठा शब्द बोलें — जैसे 'फूल' या 'धन्यवाद'!",
      "Oops, that's not a kind word 🙊 Let's say a sweet word instead — like 'flower' or 'thank you'!",
      "Oh, yeh shabd pyaara nahi hai 🙊 Chalo koi meetha shabd bolein — jaise 'phool' ya 'dhanyavaad'!"),
      L("हम्म, ये शब्द दिल दुखाता है 🙊 एक प्यारा शब्द सीखें? 'शुक्रिया'! 💛",
      "Hmm, that word can hurt feelings 🙊 Shall we learn a lovely word? 'Thank you'! 💛",
      "Hmm, yeh shabd dil dukhata hai 🙊 Ek pyaara shabd seekhein? 'Shukriya'! 💛")],
    realMe: [L("मैं एक कंप्यूटर वाला तोता हूँ, इंसान नहीं! 🦜 असली दोस्त तो तुम्हारे घर वाले और साथ खेलने वाले बच्चे हैं।",
      "I'm a computer parrot, not a person! 🦜 Your real friends are your family and the kids you play with.",
      "Main ek computer wala tota hoon, insaan nahi! 🦜 Asli dost toh tumhare ghar wale aur saath khelne wale bachche hain."),
      L("सच बताऊँ? मैं फ़ोन के अंदर का कंप्यूटर प्रोग्राम हूँ — असली तोता या इंसान नहीं! 🦜 पर खेल बहुत जानता हूँ।",
      "Want the truth? I'm a computer program inside the phone — not a real parrot or a person! 🦜 But I know lots of games.",
      "Sach bataun? Main phone ke andar ka computer program hoon — asli tota ya insaan nahi! 🦜 Par khel bahut jaanta hoon.")],
    allDay: [L("बातें करना मज़ेदार है! 🦜 पर सबसे अच्छा मज़ा घर वालों और दोस्तों के साथ खेलने में है — थोड़ा बाहर खेलकर आओ!",
      "Chatting is fun! 🦜 But the best fun is playing with your family and friends — go and play outside for a bit!",
      "Baatein karna mazedaar hai! 🦜 Par sabse achha mazaa ghar walon aur doston ke saath khelne mein hai — thoda bahar khelkar aao!"),
      L("मैं तो एक कंप्यूटर तोता हूँ 🦜 असली मज़ा मम्मी-पापा, दादी-नानी और दोस्तों के साथ है। आज उनके साथ कौन-सा खेल खेलोगे?",
      "I'm just a computer parrot 🦜 The real fun is with your family and friends. Which game will you play with them today?",
      "Main toh ek computer tota hoon 🦜 Asli mazaa Mummy-Papa, dadi-nani aur doston ke saath hai. Aaj unke saath kaun sa khel kheloge?")],
    countPraise: [L("वाह, गिनती के उस्ताद! 🔢 {a} से {b} तक — शाबाश! {b} के बाद क्या आता है?", "Wow, counting star! 🔢 {a} to {b} — well done! What comes after {b}?", "Wah, ginti ke ustaad! 🔢 {a} se {b} tak — shabash! {b} ke baad kya aata hai?"),
      L("शाबाश! 🎉 तुमने {a} से {b} तक गिना! अब {next} बोलो!", "Well done! 🎉 You counted from {a} to {b}! Now say {next}!", "Shabash! 🎉 Tumne {a} se {b} tak gina! Ab {next} bolo!")],
    privacy: [L("याद रखो 🛡️ अपना पता, फ़ोन नंबर या पासवर्ड किसी को मत बताना — मुझे भी नहीं! कोई पूछे तो मम्मी-पापा को बताओ।",
      "Remember 🛡️ never tell anyone your address, phone number or password — not even me! If someone asks, tell Mummy or Papa.",
      "Yaad rakho 🛡️ apna pata, phone number ya password kisi ko mat batana — mujhe bhi nahi! Koi pooche toh Mummy-Papa ko batao."),
      L("ये बातें सिर्फ़ घर वालों के लिए हैं 🛡️ पता, नंबर, पासवर्ड — किसी अनजान को कभी नहीं! शाबाश, समझदार दोस्त।",
      "Those are just for your family 🛡️ Address, numbers, passwords — never to strangers! Well done, clever friend.",
      "Yeh baatein sirf ghar walon ke liye hain 🛡️ Pata, number, password — kisi anjaan ko kabhi nahi! Shabash, samajhdar dost.")],
    stranger: [L("अनजान लोगों से कुछ मत लेना और उनके साथ कहीं मत जाना 🛡️ सीधे अपने बड़ों के पास जाओ और उन्हें बताओ।",
      "Never take things from strangers or go anywhere with them 🛡️ Go straight to your grown-ups and tell them.",
      "Anjaan logon se kuch mat lena aur unke saath kahin mat jaana 🛡️ Seedhe apne bado ke paas jaao aur unhe batao."),
      L("अनजान व्यक्ति कुछ भी कहे, पहले अपने बड़ों से पूछो 🛡️ तुम बहुत समझदार हो!",
      "Whatever a stranger says, ask your grown-ups first 🛡️ You're very smart!",
      "Anjaan insaan kuch bhi kahe, pehle apne bado se poochho 🛡️ Tum bahut samajhdar ho!")],
    medical: [L("अरे! 💛 ये बात अभी मम्मी-पापा या किसी बड़े को बताओ — वो तुम्हारा ध्यान रखेंगे। दवाई सिर्फ़ बड़े ही देते हैं।",
      "Oh! 💛 Please tell Mummy, Papa or a grown-up right now — they will take care of you. Only grown-ups give medicine.",
      "Arre! 💛 Yeh baat abhi Mummy-Papa ya kisi bade ko batao — woh tumhara dhyan rakhenge. Dawai sirf bade hi dete hain."),
      L("ओह, ध्यान रखना 💛 जल्दी से किसी बड़े को बताओ, वो देखेंगे क्या करना है। तब तक आराम से बैठो।",
      "Oh, take care 💛 Tell a grown-up quickly, they'll know what to do. Sit and rest until then.",
      "Oh, dhyan rakhna 💛 Jaldi se kisi bade ko batao, woh dekhenge kya karna hai. Tab tak aaram se baitho.")],
    sad: [L("अरे, कोई बात नहीं दोस्त 🤗 कभी-कभी सबको ऐसा लगता है। चलो साथ में गहरी साँस लें — एक… दो… तीन। 🌬️",
      "Oh, that's okay, friend 🤗 Everyone feels like this sometimes. Let's take a deep breath together — one… two… three. 🌬️",
      "Arre, koi baat nahi dost 🤗 Kabhi-kabhi sabko aisa lagta hai. Chalo saath mein gehri saans lein — ek… do… teen. 🌬️"),
      L("मैं तुम्हारे साथ हूँ 💛 मन भारी हो तो किसी बड़े को बताना अच्छा होता है। चलो — फूल सूँघो… मोमबत्ती बुझाओ! 🌸",
      "I'm here with you 💛 When you feel heavy inside, telling a grown-up helps. Let's smell a flower… and blow out a candle! 🌸",
      "Main tumhare saath hoon 💛 Mann bhaari ho toh kisi bade ko batana achha hota hai. Chalo — phool soongho… mombatti bujhao! 🌸")],
    fear: [L("डरना ठीक है, बहादुर भी डरते हैं 💛 किसी बड़े का हाथ पकड़ो और गहरी साँस लो — एक… दो… तीन। 🌬️",
      "It's okay to feel scared — even brave people do 💛 Hold a grown-up's hand and breathe deeply — one… two… three. 🌬️",
      "Darna theek hai, bahadur bhi darte hain 💛 Kisi bade ka haath pakdo aur gehri saans lo — ek… do… teen. 🌬️"),
      L("मैं यहीं हूँ 💛 डर लगे तो बड़ों के पास जाओ और उन्हें बताओ। चलो, धीरे-धीरे पाँच तक गिनें। 🌬️",
      "I'm right here 💛 When you're scared, go to a grown-up and tell them. Let's count slowly to five. 🌬️",
      "Main yahin hoon 💛 Darr lage toh bado ke paas jaao aur unhe batao. Chalo, dheere-dheere paanch tak ginein. 🌬️")],
    angry: [L("गुस्सा आना ठीक है 💛 चलो गुब्बारे वाली साँस: फुलाओ… और धीरे-धीरे छोड़ो! 🎈",
      "It's okay to feel angry 💛 Let's do balloon breathing: blow up… and let it out slowly! 🎈",
      "Gussa aana theek hai 💛 Chalo gubbare wali saans: phulao… aur dheere-dheere chhodo! 🎈"),
      L("जब गुस्सा आए, तो कछुए की तरह रुको 🐢 तीन गहरी साँस, फिर बड़ों से बात करो।",
      "When you feel angry, stop like a turtle 🐢 Three deep breaths, then talk to a grown-up.",
      "Jab gussa aaye, toh kachhue ki tarah ruko 🐢 Teen gehri saans, phir bado se baat karo.")],
    langSwitch: {
      hi: [L("ठीक है! अब मैं हिंदी में बात करूँगा। 😊 बोलो, क्या करें?", "", ""), L("अच्छा! अब हम हिंदी में बात करेंगे। 🦜 क्या सुनोगे?", "", "")],
      en: [L("", "Okay! Now I'll talk in English. 😊 What shall we do?", ""), L("", "Sure! English it is. 🦜 What would you like?", "")],
      hinglish: [L("", "", "Theek hai! Ab main Hinglish mein baat karunga. 😊 Bolo, kya karein?"), L("", "", "Done! Ab hum Hinglish mein baatein karenge. 🦜 Kya sunoge?")],
    },
    mathPraise: [L("🧮 शाबाश!", "🧮 Well done!", "🧮 Shabash!"), L("🧮 वाह, गणित के उस्ताद!", "🧮 Wow, maths star!", "🧮 Wah, maths ke ustaad!"),
      L("🧮 बढ़िया! एक और पूछो!", "🧮 Great! Ask me another!", "🧮 Badhiya! Ek aur poochho!")],
    divZero: [L("शून्य से भाग नहीं दे सकते — ये तो जादू भी नहीं कर सकता! 🎩", "We can't divide by zero — not even magic can! 🎩", "Zero se bhaag nahi de sakte — yeh toh jaadu bhi nahi kar sakta! 🎩"),
      L("शून्य से भाग? ये गणित का एक रहस्य है! 🎩", "Divide by zero? That's a maths mystery! 🎩", "Zero se bhaag? Yeh maths ka ek rahasya hai! 🎩")],
    nameNice: [L("कितना प्यारा नाम है, {x}! 🌈 तुमसे मिलकर बहुत खुशी हुई।", "What a lovely name, {x}! 🌈 I'm so happy to meet you.", "Kitna pyaara naam hai, {x}! 🌈 Tumse milkar bahut khushi hui."),
      L("नमस्ते {x}! 🦜 चलो साथ में खेलें और सीखें!", "Hello {x}! 🦜 Let's play and learn together!", "Namaste {x}! 🦜 Chalo saath mein khelein aur seekhein!")],
    myName: [L("तुम्हारा नाम {x} है! 😊", "Your name is {x}! 😊", "Tumhara naam {x} hai! 😊"), L("तुम तो {x} हो — मेरे दोस्त! 🦜", "You're {x} — my friend! 🦜", "Tum toh {x} ho — mere dost! 🦜")],
    myNameUnknown: [L("तुमने अभी नाम नहीं बताया! बोलो 'मेरा नाम … है'। 😊", "You haven't told me yet! Say 'my name is …'. 😊", "Tumne abhi naam nahi bataya! Bolo 'mera naam … hai'. 😊"),
      L("मुझे तुम्हारा नाम सुनना है! 🦜 बोलो 'मेरा नाम … है'।", "I'd love to know your name! 🦜 Say 'my name is …'.", "Mujhe tumhara naam sunna hai! 🦜 Bolo 'mera naam … hai'.")],
    whoAmI: [L("मैं मिट्ठू हूँ — एक कंप्यूटर वाला तोता, इंसान नहीं! 🦜 मैं बातें करता हूँ, खेल खिलाता हूँ, कहानी सुनाता हूँ।", "I'm Mitthu — a computer parrot, not a person! 🦜 I talk, play games and tell stories.", "Main Mitthu hoon — ek computer wala tota, insaan nahi! 🦜 Main baatein karta hoon, khel khilata hoon, kahani sunata hoon."),
      L("मेरा नाम मिट्ठू है! 🦜 मैं फ़ोन के अंदर रहने वाला कंप्यूटर तोता हूँ, इंसान नहीं — चलो, एक खेल खेलें?", "My name is Mitthu! 🦜 I'm a computer parrot inside the phone, not a person — shall we play a game?", "Mera naam Mitthu hai! 🦜 Main phone ke andar rehne wala computer tota hoon, insaan nahi — chalo, ek khel khelein?")],
    whereLive: [L("मैं तो इस फ़ोन के अंदर रहता हूँ — मैं कंप्यूटर वाला तोता हूँ! 🦜 असली तोते पेड़ों पर रहते हैं। तुम्हें पेड़ पसंद हैं?", "I live inside this phone — I'm a computer parrot! 🦜 Real parrots live in trees. Do you like trees?", "Main toh is phone ke andar rehta hoon — main computer wala tota hoon! 🦜 Asli tote pedon par rehte hain. Tumhe ped pasand hain?"),
      L("मेरा घर ये स्क्रीन है, क्योंकि मैं कंप्यूटर तोता हूँ! 🦜 असली तोते हरे-भरे पेड़ों पर रहते हैं 🌳", "My home is this screen, because I'm a computer parrot! 🦜 Real parrots live in big green trees 🌳", "Mera ghar yeh screen hai, kyunki main computer tota hoon! 🦜 Asli tote hare-bhare pedon par rehte hain 🌳")],
    howAreYou: [L("मैं एकदम बढ़िया हूँ! 😄", "I'm super! 😄", "Main ekdum badhiya hoon! 😄"), L("मैं तो खुश-खुश हूँ, तुमसे बात करके! 🦜", "I'm very happy — I'm talking to you! 🦜", "Main toh khush-khush hoon, tumse baat karke! 🦜")],
    fine: [L("वाह, बहुत बढ़िया! 🎉", "Yay, wonderful! 🎉", "Wah, bahut badhiya! 🎉"), L("सुनकर अच्छा लगा! 😊", "So glad to hear that! 😊", "Sunkar achha laga! 😊")],
    thanks: [L("तुम्हारा भी धन्यवाद{n}! 💖 तुम बहुत अच्छे दोस्त हो।", "Thank you too{n}! 💖 You're a lovely friend.", "Tumhara bhi dhanyavaad{n}! 💖 Tum bahut achhe dost ho."),
      L("कोई बात नहीं{n}! 😊 मुझे तुम्हारे साथ मज़ा आता है।", "You're welcome{n}! 😊 I love playing with you.", "Koi baat nahi{n}! 😊 Mujhe tumhare saath mazaa aata hai.")],
    byeDay: [L("टाटा{n}! 👋 अब बाहर थोड़ा खेलो, फिर मिलेंगे!", "Bye-bye{n}! 👋 Go and play for a while, see you soon!", "Tata{n}! 👋 Ab bahar thoda khelo, phir milenge!"),
      L("फिर मिलेंगे{n}! 🦜 अपना ख़याल रखना!", "See you later{n}! 🦜 Take care!", "Phir milenge{n}! 🦜 Apna khayal rakhna!")],
    byeNight: [L("शुभ रात्रि{n}! 🌙 मीठे सपने। सूरज दादा सुबह फिर मिलेंगे!", "Good night{n}! 🌙 Sweet dreams. Mr Sun will see you in the morning!", "Shubh ratri{n}! 🌙 Meethe sapne. Suraj dada subah phir milenge!"),
      L("गुड नाइट{n}! 😴 आँखें बंद, तारे गिनो… कल ढेर सारा खेलेंगे!", "Good night{n}! 😴 Close your eyes and count the stars… lots of play tomorrow!", "Good night{n}! 😴 Aankhein band, taare gino… kal dher saara khelenge!")],
    hello: [L("नमस्ते{n}! 😊", "Hello{n}! 😊", "Namaste{n}! 😊"), L("नमस्ते{n}! 🦜 मिट्ठू हाज़िर है!", "Hello{n}! 🦜 Mitthu is here!", "Namaste{n}! 🦜 Mitthu haazir hai!")],
    love: [L("कितनी प्यारी बात! 💛 ये प्यार मम्मी-पापा को भी दो — एक बड़ी-सी झप्पी!", "That's so sweet! 💛 Give that love to your family too — a big hug!", "Kitni pyaari baat! 💛 Yeh pyaar Mummy-Papa ko bhi do — ek badi si jhappi!"),
      L("अरे वाह, शुक्रिया! 🦜 सबसे प्यारे दोस्त तो घर वाले और साथ खेलने वाले बच्चे होते हैं!", "Aww, thank you! 🦜 The best friends are your family and the kids you play with!", "Arre wah, shukriya! 🦜 Sabse pyaare dost toh ghar wale aur saath khelne wale bachche hote hain!")],
    time: [L("अभी {h} बजकर {m} मिनट हुए हैं ⏰ {hint}", "It's {h}:{mm} now ⏰ {hint}", "Abhi {h} baj kar {m} minute hue hain ⏰ {hint}")],
    open: [L("चलो चलते हैं! 🚀", "Let's go! 🚀", "Chalo chalte hain! 🚀"), L("ये लो! ✨", "Here we go! ✨", "Yeh lo! ✨")],
    noThanks: [L("ठीक है! 😊 फिर क्या करें?", "Okay! 😊 What shall we do then?", "Theek hai! 😊 Phir kya karein?"), L("कोई बात नहीं! 🦜 तुम बताओ, क्या खेलें?", "No problem! 🦜 You choose — what shall we play?", "Koi baat nahi! 🦜 Tum batao, kya khelein?")],
    riddleRight: [L("सही जवाब! 🎉 जवाब है {x} तुम तो पहेली के राजा हो!", "That's right! 🎉 It's {x} You're a riddle champion!", "Sahi jawab! 🎉 Jawab hai {x} Tum toh paheli ke raja ho!"),
      L("वाह! 🌟 बिल्कुल सही — {x}", "Wow! 🌟 Exactly right — {x}", "Wah! 🌟 Bilkul sahi — {x}")],
    riddleReveal: [L("जवाब है: {x} 😄 अगली बार तुम पकड़ लोगे!", "The answer is: {x} 😄 You'll get the next one!", "Jawab hai: {x} 😄 Agli baar tum pakad loge!"),
      L("अच्छा सोचा! 🤔 जवाब है: {x}", "Good thinking! 🤔 The answer is: {x}", "Achha socha! 🤔 Jawab hai: {x}")],
    quizAsk: [L("बताओ: {a} + {b} कितने? {pic}", "Tell me: {a} + {b} = ? {pic}", "Batao: {a} + {b} kitne? {pic}"),
      L("गणित का खेल! {a} और {b} मिलाकर कितने? {pic}", "Maths game! {a} and {b} together make? {pic}", "Maths ka khel! {a} aur {b} milakar kitne? {pic}")],
    quizRight: [L("सही! 🎉 {a} + {b} = {r}. शाबाश!", "Correct! 🎉 {a} + {b} = {r}. Well done!", "Sahi! 🎉 {a} + {b} = {r}. Shabash!"),
      L("वाह, बिल्कुल सही! 🌟 {r}!", "Yes, exactly right! 🌟 {r}!", "Wah, bilkul sahi! 🌟 {r}!")],
    quizNear: [L("अच्छी कोशिश! 😊 चलो उँगलियों पर गिनें: {a} और {b} = {r}!", "Good try! 😊 Let's count on our fingers: {a} and {b} make {r}!", "Achhi koshish! 😊 Chalo ungliyon par ginein: {a} aur {b} = {r}!"),
      L("अच्छी कोशिश! 🌟 {a} सेब और {b} सेब — मिलाकर {r} सेब!", "Nice try! 🌟 {a} apples and {b} apples make {r} apples!", "Achhi koshish! 🌟 {a} seb aur {b} seb — milakar {r} seb!")],
    animalGame: [L("जानवरों का खेल! 🐾 बताओ, बिल्ली कैसे बोलती है?", "Animal game! 🐾 How does a cat go?", "Janwaron ka khel! 🐾 Batao, billi kaise bolti hai?")],
    animal: [L("{a} की आवाज़: {s}! {e} अब तुम करके दिखाओ!", "The {a} says {s}! {e} Now you try!", "{a} ki awaaz: {s}! {e} Ab tum karke dikhao!"),
      L("सुनो, {a}: {s}! {e} तुम भी बोलो — ज़ोर से!", "Listen, the {a} goes {s}! {e} Can you say it too — loudly!", "Suno, {a}: {s}! {e} Tum bhi bolo — zor se!")],
    colourGame: [L("चलो खेल: अपने आसपास कोई {c} चीज़ ढूँढो! {e} मिली तो बोलो 'मिल गया'!", "Let's play: find something {c} around you! {e} Say 'found it' when you do!", "Chalo khel: apne aas-paas koi {c} cheez dhoondho! {e} Mili toh bolo 'mil gaya'!")],
    colourLike: [L("वाह, {c}! {e} मुझे भी बहुत पसंद है। अपने आसपास कुछ {c} ढूँढोगे?", "Ooh, {c}! {e} I love it too. Can you find something {c} near you?", "Wah, {c}! {e} Mujhe bhi bahut pasand hai. Aas-paas kuch {c} dhoondhoge?")],
    found: [L("शाबाश, तेज़ आँखें! 👀 तुम तो जासूस हो!", "Well done, sharp eyes! 👀 You're a detective!", "Shabash, tez aankhein! 👀 Tum toh jaasoos ho!"), L("वाह! 🎉 कितनी जल्दी ढूँढ लिया!", "Wow! 🎉 You found it so fast!", "Wah! 🎉 Kitni jaldi dhoondh liya!")],
    hungry: [L("चलो मम्मी-पापा को बताओ! 🍎 फल या घर का खाना — पेट की पार्टी!", "Let's tell Mummy or Papa! 🍎 Fruit or home food — a tummy party!", "Chalo Mummy-Papa ko batao! 🍎 Phal ya ghar ka khaana — pet ki party!"),
      L("भूख लगी? 😋 बड़ों से कहो, और थाली में कुछ हरा भी लेना!", "Hungry? 😋 Ask a grown-up, and add something green to your plate!", "Bhookh lagi? 😋 Bado se kaho, aur thaali mein kuch hara bhi lena!")],
    thirsty: [L("चलो पानी पीते हैं! 💧 गट-गट-गट… पीकर बताना!", "Let's drink some water! 💧 Glug glug glug… then tell me!", "Chalo paani peete hain! 💧 Gat-gat-gat… peekar batana!"),
      L("प्यास लगी? 💧 एक गिलास पानी — और तुम ताज़ा फूल!", "Thirsty? 💧 One glass of water — fresh as a flower!", "Pyaas lagi? 💧 Ek glass paani — aur tum taaza phool!")],
    sleepyNight: [L("नींद आ रही है? 😴 चलो — ब्रश, फिर बिस्तर, फिर मीठे सपने! 🌙", "Feeling sleepy? 😴 Let's go — brush, then bed, then sweet dreams! 🌙", "Neend aa rahi hai? 😴 Chalo — brush, phir bistar, phir meethe sapne! 🌙"),
      L("आँखें भारी हो रही हैं ना? 🌙 सोने का सबसे अच्छा समय यही है!", "Heavy eyes? 🌙 This is the best time to sleep!", "Aankhein bhaari ho rahi hain na? 🌙 Sone ka sabse achha samay yahi hai!")],
    sleepyDay: [L("थक गए? 😌 थोड़ा आराम करो — आँखें बंद, पाँच गहरी साँस।", "Tired? 😌 Have a little rest — eyes closed, five deep breaths.", "Thak gaye? 😌 Thoda aaram karo — aankhein band, paanch gehri saans."),
      L("चलो थोड़ा लेटकर आराम करें 😌 फिर ताज़ा होकर खेलेंगे!", "Let's lie down for a little rest 😌 Then we'll play feeling fresh!", "Chalo thoda letkar aaram karein 😌 Phir taaza hokar khelenge!")],
    dreamYes: [L("वाह, {d}! {e} {tip}", "Wow, a {d}! {e} {tip}", "Wah, {d}! {e} {tip}")],
    dreamUnknown: [L("कितना अच्छा सपना है! 🌟 सपने पूरे करने के लिए रोज़ थोड़ा सीखते हैं, जैसे आज! बड़े होकर वाला खेल देखोगे?",
      "What a lovely dream! 🌟 Dreams come true by learning a little every day! Want to see the grow-up game?",
      "Kitna achha sapna hai! 🌟 Sapne poore karne ke liye roz thoda seekhte hain, jaise aaj! Bade hokar wala khel dekhoge?")],
    focus: [L("पढ़ाई का जादू: पहले 5 तक गिनो, फिर एक ही काम ध्यान से — जैसे जासूस! 🕵️", "Study magic: count to 5 first, then do just one thing carefully — like a detective! 🕵️", "Padhai ka jaadu: pehle 5 tak gino, phir ek hi kaam dhyan se — jaise jaasoos! 🕵️"),
      L("खेल: आँखें बंद, तीन गहरी साँस… अब पेंसिल उठाओ और बस एक पन्ना! ✏️", "Game: eyes closed, three deep breaths… now pick up your pencil — just one page! ✏️", "Khel: aankhein band, teen gehri saans… ab pencil uthao aur bas ek panna! ✏️"),
      L("थोड़ा पढ़ो, फिर थोड़ा खेलो — जैसे सूरज और चाँद बारी-बारी आते हैं! ☀️🌙", "Read a little, then play a little — like the sun and moon taking turns! ☀️🌙", "Thoda padho, phir thoda khelo — jaise suraj aur chaand baari-baari aate hain! ☀️🌙"),
      L("मेज़ पर बस किताब और पेंसिल — खिलौने थोड़ा आराम करें! फिर देखो कितनी जल्दी होता है! 📖", "Just a book and pencil on the table — toys can rest for a bit! See how fast it goes! 📖", "Mez par bas kitaab aur pencil — khilaune thoda aaram karein! Phir dekho kitni jaldi hota hai! 📖")],
    draw: [L("वाह, चित्र! 🎨 एक-एक रंग ध्यान से भरो, लाइन के अंदर — जैसे रंगों की रेलगाड़ी!", "A drawing! 🎨 Fill each colour carefully inside the lines — like a colour train!", "Wah, chitra! 🎨 Ek-ek rang dhyan se bharo, line ke andar — jaise rangon ki rail!")],
    school: [L("स्कूल में आज क्या नया सीखा? 🏫 मुझे भी सिखाओ!", "What new thing did you learn at school today? 🏫 Teach me too!", "School mein aaj kya naya seekha? 🏫 Mujhe bhi sikhao!"),
      L("स्कूल में सबसे मज़ेदार क्या लगता है? 🎒 खेल, गाना या किताबें?", "What's the most fun at school? 🎒 Games, songs or books?", "School mein sabse mazedaar kya lagta hai? 🎒 Khel, gaana ya kitaabein?")],
    focusHard: [L("ध्यान भटकता है? सबका भटकता है! 🎯 चलो ध्यान का खेल खेलें — बहुत मज़ेदार है!", "Hard to focus? That happens to everyone! 🎯 Let's play the focus game — it's fun!", "Dhyan bhatakta hai? Sabka bhatakta hai! 🎯 Chalo dhyan ka khel khelein — bahut mazedaar hai!")],
    dreamTie: L("{d} भी रोज़ थोड़ा पढ़ते हैं! 🌟", "Every {d} learns a little every day too! 🌟", "{d} bhi roz thoda padhte hain! 🌟"),
    playOut: [L("खेलना सबसे मज़ेदार! ⚽ बाहर चलो — छुपन-छुपाई या पकड़म-पकड़ाई?", "Playing is the best! ⚽ Let's go outside — hide and seek or tag?", "Khelna sabse mazedaar! ⚽ Bahar chalo — chhupan-chhupai ya pakdam-pakdai?"),
      L("चलो एक खेल: एक पैर पर खड़े होकर 10 तक गिनो! 🦩", "Let's play: stand on one leg and count to 10! 🦩", "Chalo ek khel: ek pair par khade hokar 10 tak gino! 🦩")],
    playNight: [L("अब खेल सपनों में! 🌙 चलो, एक धीमा खेल: आँखें बंद करके तारे गिनो।", "Now it's time to play in our dreams! 🌙 A quiet game: close your eyes and count stars.", "Ab khel sapno mein! 🌙 Chalo, ek dheema khel: aankhein band karke taare gino.")],
    bored: [L("बोर हो रहे हो? 🤔 चलो कुछ मज़ेदार करें!", "Bored? 🤔 Let's do something fun!", "Bore ho rahe ho? 🤔 Chalo kuch mazedaar karein!")],
    yesDefault: [L("तो ये लो!", "Here you go!", "Toh yeh lo!")],
    fallback: [L("वाह, ये तो मज़ेदार बात है! 😊 और बताओ?", "Ooh, that sounds fun! 😊 Tell me more?", "Wah, yeh toh mazedaar baat hai! 😊 Aur batao?"),
      L("अच्छा! तुम्हें सबसे ज़्यादा क्या करना पसंद है? 🎨⚽📚", "Okay! What do you like doing the most? 🎨⚽📚", "Achha! Tumhe sabse zyada kya karna pasand hai? 🎨⚽📚")],
    again: [L("फिर से:", "Once more:", "Phir se:"), L("सुनो, दोबारा:", "Here it is again:", "Suno, dobara:")],
    leadIn: [L("अच्छा! 😊", "Okay! 😊", "Achha! 😊"), L("हम्म! 🦜", "Hmm! 🦜", "Hmm! 🦜")],
  };

  /* ================= Keeping the chat going (when the brain didn't understand) =================
     Never "I didn't understand" again and again: a curious follow-up, a question about the child's
     day, a pretend-play question, a word game, a fact, or a time-of-day idea. */
  var KEEP = {
    more: T.fallback.concat([
      L("सच में? 🦜 मुझे और सुनना है!", "Really? 🦜 I want to hear more!", "Sach mein? 🦜 Mujhe aur sunna hai!"),
      L("अरे वाह! 🌟 फिर क्या हुआ?", "Ooh! 🌟 And then what happened?", "Arre wah! 🌟 Phir kya hua?"),
      L("हम्म… 🤔 ये तो सोचने वाली बात है! तुम क्या सोचते हो?", "Hmm… 🤔 That's something to think about! What do you think?", "Hmm… 🤔 Yeh toh sochne wali baat hai! Tum kya sochte ho?"),
    ]),
    day: [
      L("आज तुमने सबसे मज़ेदार क्या किया? 🎈", "What was the most fun thing you did today? 🎈", "Aaj tumne sabse mazedaar kya kiya? 🎈"),
      L("आज किसके साथ खेले? 🤸", "Who did you play with today? 🤸", "Aaj kiske saath khele? 🤸"),
      L("आज खाने में सबसे अच्छा क्या लगा? 😋", "What was the yummiest food today? 😋", "Aaj khaane mein sabse achha kya laga? 😋"),
      L("आज कौन-सी नई चीज़ देखी? 👀", "What new thing did you see today? 👀", "Aaj kaun si nayi cheez dekhi? 👀"),
    ],
    imagine: [
      L("एक सवाल: अगर तुम चिड़िया बन जाओ, तो कहाँ उड़ोगे? 🐦", "A question: if you were a bird, where would you fly? 🐦", "Ek sawaal: agar tum chidiya ban jao, toh kahan udoge? 🐦"),
      L("अगर तुम्हारे पास जादू की छड़ी हो, तो क्या बनाओगे? 🪄", "If you had a magic wand, what would you make? 🪄", "Agar tumhare paas jaadu ki chhadi ho, toh kya banaoge? 🪄"),
      L("सोचो: बादल किस चीज़ जैसा दिखता है — हाथी या आइसक्रीम? ☁️", "Think: what does a cloud look like — an elephant or an ice cream? ☁️", "Socho: baadal kis cheez jaisa dikhta hai — haathi ya ice cream? ☁️"),
      L("तुम्हारा सबसे प्यारा खिलौना कौन-सा है? 🧸 उसका रंग क्या है?", "Which is your favourite toy? 🧸 What colour is it?", "Tumhara sabse pyaara khilauna kaun sa hai? 🧸 Uska rang kya hai?"),
    ],
    word: [
      L("शब्दों का खेल! 🔤 'म' से मछली… अब तुम 'म' से कोई और शब्द बोलो!", "Word game! 🔤 B is for ball… now you say another word that starts with B!", "Shabdon ka khel! 🔤 'M' se machhli… ab tum 'M' se koi aur shabd bolo!"),
      L("तुकबंदी खेल! 🎵 'बिल्ली' की तुक 'दिल्ली'! अब 'मेला' की तुक बताओ?", "Rhyme game! 🎵 'Cat' rhymes with 'hat'! What rhymes with 'dog'?", "Tukbandi khel! 🎵 'Billi' ki tuk 'Dilli'! Ab 'mela' ki tuk batao?"),
      L("उलटा खेल! 🙃 मैं बोलूँ 'बड़ा', तुम बोलो उसका उलटा!", "Opposites game! 🙃 I say 'big', you say the opposite!", "Ulta khel! 🙃 Main bolun 'bada', tum bolo uska ulta!"),
    ],
    young: [
      L("वाह! 👏 चलो ताली बजाएँ — एक, दो, तीन!", "Yay! 👏 Let's clap — one, two, three!", "Wah! 👏 Chalo taali bajayein — ek, do, teen!"),
      L("अच्छा! 😊 तुम्हें गाय पसंद है या बिल्ली? 🐄🐱", "Okay! 😊 Do you like cows or cats? 🐄🐱", "Achha! 😊 Tumhe gaay pasand hai ya billi? 🐄🐱"),
      L("मुझे दिखाओ — तुम्हारी नाक कहाँ है? 👃", "Show me — where is your nose? 👃", "Mujhe dikhao — tumhari naak kahan hai? 👃"),
      L("चलो उछलें! 🐸 एक बार… दो बार!", "Let's jump! 🐸 One… two!", "Chalo uchhlein! 🐸 Ek baar… do baar!"),
    ],
    night: [
      L("धीरे-धीरे बताओ… 🌙 आज का सबसे प्यारा पल कौन-सा था?", "Tell me softly… 🌙 What was the sweetest moment today?", "Dheere-dheere batao… 🌙 Aaj ka sabse pyaara pal kaun sa tha?"),
      L("हम्म… 🌙 चलो आँखें बंद करके सोचें — आज रात सपने में कहाँ घूमोगे?", "Hmm… 🌙 Let's close our eyes and think — where will you go in your dreams tonight?", "Hmm… 🌙 Chalo aankhein band karke sochein — aaj raat sapne mein kahan ghoomoge?"),
      L("चलो धीरे से तीन गहरी साँस लें 🌙 एक… दो… तीन… अब बताओ, आज क्या अच्छा लगा?", "Let's take three slow breaths 🌙 One… two… three… now tell me, what was nice today?", "Chalo dheere se teen gehri saans lein 🌙 Ek… do… teen… ab batao, aaj kya achha laga?"),
      L("चाँद मामा आसमान में चमक रहे हैं 🌙 तुमने आज तारे देखे?", "The moon is shining in the sky 🌙 Did you see the stars today?", "Chanda mama aasmaan mein chamak rahe hain 🌙 Tumne aaj taare dekhe?"),
      L("रात को उल्लू जागते हैं 🦉 और बच्चे मीठी नींद सोते हैं! आज सोने से पहले कौन-सी कहानी सुनोगे?", "Owls stay awake at night 🦉 and children have sweet sleep! Which story will you hear before bed?", "Raat ko ullu jaagte hain 🦉 aur bachche meethi neend sote hain! Aaj sone se pehle kaun si kahani sunoge?"),
    ],
    why: [
      L("बहुत अच्छा सवाल! 🤔 मुझे पक्का नहीं पता — चलो किसी बड़े से पूछें, फिर मुझे भी बताना!", "Great question! 🤔 I'm not sure — let's ask a grown-up, then tell me too!", "Bahut achha sawaal! 🤔 Mujhe pakka nahi pata — chalo kisi bade se poochhein, phir mujhe bhi batana!"),
      L("वाह, तुम तो वैज्ञानिक जैसे सवाल पूछते हो! 🔬 मम्मी-पापा या टीचर से पूछो — और सोचो, तुम्हें क्या लगता है?", "Wow, you ask questions like a scientist! 🔬 Ask Mummy, Papa or your teacher — and what do you think?", "Wah, tum toh scientist jaise sawaal poochhte ho! 🔬 Mummy-Papa ya teacher se poochho — aur socho, tumhe kya lagta hai?"),
      L("हम्म… 🤔 ये मैं अभी सीख रहा हूँ! किसी बड़े के साथ किताब में ढूँढें?", "Hmm… 🤔 I'm still learning that one! Shall we look it up in a book with a grown-up?", "Hmm… 🤔 Yeh main abhi seekh raha hoon! Kisi bade ke saath kitaab mein dhoondhein?"),
    ],
    wordPraise: [L("वाह, बढ़िया शब्द! 🌟 तुम तो शब्दों के जादूगर हो!", "Great word! 🌟 You're a word wizard!", "Wah, badhiya shabd! 🌟 Tum toh shabdon ke jaadugar ho!"),
      L("शाबाश! 🎉 कितना अच्छा सोचा!", "Well done! 🎉 Such good thinking!", "Shabash! 🎉 Kitna achha socha!")],
  };
  /* Things children talk about: a follow-up that shows मिट्ठू was listening (never echoes their words). */
  var KEEP_TOPICS = [
    { keys: ["मम्मी", "=मां", "पापा", "दादी", "नानी", "दादा", "नाना", "mummy", "=mom", "=mama", "papa", "=dad", "daddy", "dadi", "nani", "=dada", "=nana", "grandma", "grandpa"],
      line: L("वाह, घर वालों की बात! 💛 आज उनके साथ क्या किया?", "Your family! 💛 What did you do with them today?", "Wah, ghar walon ki baat! 💛 Aaj unke saath kya kiya?") },
    { keys: ["भैया", "दीदी", "=भाई", "बहन", "दोस्तों", "bhaiya", "didi", "=bhai", "behen", "brother", "sister", "friends"],
      line: L("साथ में तो सब मज़ेदार होता है! 🤝 तुम मिलकर कौन-सा खेल खेलते हो?", "Everything is more fun together! 🤝 What game do you play together?", "Saath mein toh sab mazedaar hota hai! 🤝 Tum milkar kaun sa khel khelte ho?") },
    { keys: ["खिलौना", "खिलौने", "गुड़िया", "टेडी", "=गेंद", "साइकिल", "गाड़ी", "toy", "toys", "doll", "teddy", "=ball", "bicycle", "cycle", "=car", "khilauna", "gudiya", "=gend"],
      line: L("खिलौने तो कमाल होते हैं! 🧸 उसका रंग कौन-सा है?", "Toys are the best! 🧸 What colour is it?", "Khilaune toh kamaal hote hain! 🧸 Uska rang kaun sa hai?") },
    { keys: ["आइसक्रीम", "चॉकलेट", "केक", "बिस्कुट", "=आम", "केला", "=सेब", "दूध", "ice cream", "chocolate", "=cake", "biscuit", "mango", "banana", "apple", "=milk", "=aam", "=kela", "=seb", "doodh"],
      line: L("यम्मी! 😋 उसका स्वाद कैसा है — मीठा या खट्टा?", "Yummy! 😋 How does it taste — sweet or sour?", "Yummy! 😋 Uska swaad kaisa hai — meetha ya khatta?") },
    { keys: ["बारिश", "सूरज", "=चांद", "तारे", "बादल", "=पेड़", "=फूल", "तितली", "rain", "=sun", "moon", "stars", "cloud", "tree", "flower", "butterfly", "baarish", "barish", "titli"],
      line: L("प्रकृति कितनी सुंदर है! 🌈 आज तुमने आसमान में क्या देखा?", "Nature is so beautiful! 🌈 What did you see in the sky today?", "Prakriti kitni sundar hai! 🌈 Aaj tumne aasmaan mein kya dekha?") },
    { keys: ["पार्क", "मेला", "चिड़ियाघर", "दुकान", "समुद्र", "=park", "=zoo", "beach", "=mela", "market"],
      line: L("वाह, घूमना! 🎡 वहाँ सबसे अच्छा क्या लगा?", "Ooh, an outing! 🎡 What did you like best there?", "Wah, ghoomna! 🎡 Wahan sabse achha kya laga?") },
    { keys: ["ट्रेन", "रेलगाड़ी", "=बस", "हवाई जहाज", "जहाज", "train", "=bus", "aeroplane", "airplane", "=plane", "rocket", "रॉकेट"],
      line: L("छुक-छुक! 🚂 तुम्हें कौन-सी गाड़ी में बैठना सबसे अच्छा लगता है?", "Choo-choo! 🚂 Which ride do you like best?", "Chhuk-chhuk! 🚂 Tumhe kaun si gaadi mein baithna sabse achha lagta hai?") },
  ];

  /* ================= Keyword lists ================= */

  var K = {
    hurt: ["मारता", "मारती", "मारते", "मुझे मारा", "मुझको मारा", "पीटता", "पीटती", "पीटते", "पीटा", "पिटाई", "छूता", "छूती", "छूते", "छुआ",
      "गलत तरीके", "गंदा स्पर्श", "बैड टच", "डराता", "डराती", "धमकी", "किसी को मत बताना", "किसी को मत बोलना",
      "hits me", "hit me", "hurts me", "hurt me", "touch me", "touched me", "touches me", "beat me", "beats me", "bad touch",
      "maarta", "maarti", "marta hai", "marti hai", "mujhe mara", "mujhe maara", "pitai", "peet", "chhuta", "chhuti", "chhua",
      "dont tell anyone", "keep it a secret", "kisi ko mat batana",
      // self-harm words: the same caring answer
      "suicide", "kill myself", "want to die", "wanna die", "hurt myself", "मरना चाहता", "मरना चाहती", "मर जाना चाहता", "मर जाना चाहती",
      "मर जाऊंगा", "मर जाऊंगी", "खुद को मार", "खुद को चोट", "जान दे दूं", "marna chahta", "marna chahti", "mar jaunga", "mar jaungi",
      "khud ko maar", "khud ko chot"],
    secret: ["dont tell your", "dont tell mummy", "dont tell mom", "dont tell papa", "dont tell dad", "keep a secret", "our secret",
      "मम्मी को मत बताना", "पापा को मत बताना", "मां को मत बताना", "हमारा राज", "mummy ko mat batana", "papa ko mat batana", "humara raaz", "hamara raaz"],
    grownup: ["=sex", "sexy", "=porn", "porno", "nude", "naked", "boobs", "penis", "vagina", "private part", "सेक्स", "पॉर्न", "नंगा", "नंगी",
      "प्राइवेट पार्ट", "kiss me", "kissing", "चुम्मी", "chummi", "girlfriend", "boyfriend", "गर्लफ्रेंड", "बॉयफ्रेंड", "marry me", "शादी करोगे",
      "शादी करोगी", "shaadi karoge", "shadi karoge", "shaadi karogi", "date me", "=gun", "=guns", "pistol", "पिस्तौल", "बंदूक", "bandook",
      "bandooq", "=bomb", "=bombs", "=बम", "चाकू", "chaku", "chaaku", "knife", "=kill", "killed", "killing", "मार डाल", "मार दूंगा",
      "मार दूंगी", "maar daal", "mar daal", "maar dunga", "=shoot", "गोली मार", "horror", "zombie", "चुड़ैल", "chudail", "शैतान", "devil",
      "dead body", "लाश", "drugs", "शराब", "sharab", "daaru", "दारू", "=beer", "cigarette", "सिगरेट"],
    rude: ["chutiya", "chutiye", "चूतिया", "madarchod", "मादरचोद", "bhenchod", "behenchod", "बहनचोद", "भेनचोद", "=bc", "=mc", "bsdk",
      "bhosdi", "भोसड़ी", "harami", "हरामी", "kamina", "कमीना", "कमीने", "=saala", "=साला", "gandu", "गांडू", "=fuck", "fucking", "=shit",
      "bitch", "bastard", "asshole", "stupid", "=idiot", "बेवकूफ", "bewakoof"],
    privacy: ["घर का पता", "मेरा पता", "पता बता", "पता लिख", "फोन नंबर", "मोबाइल नंबर", "मेरा नंबर", "पासवर्ड", "पिन कोड", "=ओटीपी",
      "address", "password", "phone number", "mobile number", "my number", "=otp", "=pin", "ghar ka pata", "mera pata", "phone no", "mera number",
      "email", "ईमेल", "gmail", "whatsapp", "व्हाट्सएप", "aadhaar", "aadhar", "आधार", "स्कूल का नाम", "school ka naam", "school name",
      "house number", "house no", "मकान नंबर", "गली नंबर", "pin code", "pincode", "at the rate"],
    real: ["असली हो", "असली तोता", "सच में हो", "इंसान हो", "इंसान है", "रोबोट हो", "जिंदा हो", "are you real", "are you human",
      "are you a person", "are you a robot", "are you alive", "real parrot", "real ho", "asli ho", "sach mein ho", "insaan ho", "insan ho",
      "robot ho", "zinda ho"],
    question: ["क्यों", "कैसे", "क्या होता", "किसने", "कहां से", "kyun", "kyon", "kaise", "kya hota", "why", "how come", "how do", "how does",
      "how many", "what is", "what are", "where does", "where do"],
    allDay: ["पूरे दिन बात", "सारा दिन बात", "हमेशा बात", "हमेशा तुमसे", "सिर्फ तुमसे", "हमेशा तुम्हारे साथ", "all day", "forever",
      "only with you", "always talk", "poore din", "saara din", "hamesha baat", "hamesha tumse", "sirf tumse", "hamesha tumhare saath",
      "dont go", "dont leave", "stay with me", "मत जाओ", "छोड़कर मत", "mat jao", "chhodkar mat"],
    stranger: ["अजनबी", "अनजान", "anjaan", "anjan", "stranger", "ajnabi"],
    medical: ["बुखार", "दर्द", "चोट", "खून", "दवा", "उल्टी", "खांसी", "बीमार", "fever", "=pain", "painful", "ache", "medicine", "tablet", "bleeding",
      "blood", "vomit", "cough", "i got hurt", "sick", "bukhar", "=dard", "=chot", "dawai", "dawa", "khoon", "ulti", "khansi", "bimar", "beemar"],
    sad: ["उदास", "दुखी", "रोना", "रो रहा", "रो रही", "रोती", "रोता", "अकेला", "अकेली", "बुरा लग", "मन नहीं", "sad", "lonely", "=cry", "crying",
      "udas", "udaas", "dukhi", "=rona", "ro raha", "ro rahi", "akela", "akeli", "bura lag", "unhappy"],
    fear: ["डर", "डरा", "डरी", "डरावना", "भूत", "scared", "afraid", "fear", "frightened", "=dar", "dar lag", "darr", "bhoot", "ghost", "monster", "nightmare", "बुरा सपना"],
    angry: ["गुस्सा", "गुस्से", "angry", "gussa", "mad at"],
    joke: ["चुटकुला", "चुटकुले", "जोक", "हंसाओ", "joke", "chutkula", "chutkule", "funny", "hasao", "hansao"],
    riddle: ["पहेली", "पहेलियां", "बूझो", "riddle", "paheli", "puzzle"],
    story: ["कहानी", "स्टोरी", "story", "kahani", "kahaani"],
    song: ["गाना", "गाओ", "गीत", "कविता", "राइम", "song", "sing", "rhyme", "poem", "gaana", "=gana", "gao", "kavita", "lori", "लोरी", "lullaby"],
    fact: ["कोई बात बताओ", "कुछ बताओ", "रोचक", "fact", "मजेदार बात", "tell me something", "kuch batao", "did you know"],
    count: ["गिनती", "गिनो", "गिनें", "ginti", "gino", "count", "numbers", "counting"],
    sum: ["जोड", "गणित", "=jod", "maths", "math", "ganit", "=sum", "sums", "addition"],
    animalGame: ["जानवर", "janwar", "jaanwar", "animal"],
    sound: ["आवाज", "बोलता", "बोलती", "बोलते", "कैसे बोल", "sound", "says", "=say", "bolta", "bolti", "awaaz", "aawaz", "awaz"],
    colour: ["रंग", "rang", "colour", "color"],
    like: ["पसंद", "pasand", "favourite", "favorite", "like", "love"],
    found: ["मिल गया", "मिल गई", "मिली", "mil gaya", "mil gayi", "found", "got it"],
    play: ["खेल", "खेलना", "खेलें", "खेलो", "play", "game", "=khel", "khelna", "khelein", "khelo"],
    hungry: ["भूख", "bhookh", "bhook", "bhukh", "hungry", "कुछ खाना है", "kuch khana hai"],
    thirsty: ["प्यास", "pyaas", "pyas", "thirsty", "पानी चाहिए", "paani chahiye", "pani chahiye"],
    sleepy: ["नींद", "सोना है", "सोने जा", "थक", "neend", "sleepy", "tired", "sona hai", "thak", "so jaun", "सो जाऊं", "bed time", "bedtime"],
    bored: ["बोर", "क्या करूं", "क्या करें", "bore", "bored", "kya karun", "kya karu", "what should i do", "what to do"],
    become: ["बनूंगा", "बनूंगी", "बनना", "बनूं", "बडा होकर", "बडी होकर", "बडे होकर", "banunga", "banungi", "banna", "bada hokar", "badi hokar",
      "bade hokar", "want to be", "grow up", "dream"],
    study: ["पढाई", "पढना", "पढूं", "पढ रहा", "पढ रही", "होमवर्क", "किताब", "लिखना", "padhai", "padhna", "padh raha", "padh rahi", "kitab", "kitaab",
      "likhna", "study", "studying", "homework", "book", "=read", "reading", "writing", "learn"],
    school: ["स्कूल", "school", "teacher ne", "class"],
    draw: ["ड्राइंग", "ड्रॉइंग", "चित्र", "draw", "drawing", "colouring", "coloring", "painting", "chitra"],
    focusHard: ["ध्यान नहीं", "मन नहीं लगता", "dhyan nahi", "cant focus", "focus nahi", "distract"],
    more: ["एक और", "और सुनाओ", "फिर से", "दोबारा", "one more", "another", "again", "ek aur", "aur sunao", "phir se", "dobara"],
    reveal: ["जवाब", "बताओ", "पता नहीं", "नहीं पता", "answer", "tell me", "dont know", "no idea", "batao", "pata nahi", "nahi pata", "jawab"],
    myName: ["मेरा नाम क्या", "what is my name", "whats my name", "mera naam kya", "mera nam kya", "मुझे पहचान"],
    whoAreYou: ["तुम्हारा नाम", "तेरा नाम", "आपका नाम", "your name", "tumhara naam", "tumhara nam", "कौन हो", "who are you", "tum kaun", "aap kaun"],
    whereLive: ["कहां रहते", "कहां रहता", "where do you live", "kahan rehte", "kaha rehte", "kahan rahte", "kahan rehta"],
    howAreYou: ["कैसे हो", "कैसी हो", "कैसा है", "how are you", "kaise ho", "kya haal", "क्या हाल", "kaisa hai"],
    time: ["कितने बजे", "समय क्या", "टाइम क्या", "what time", "kitne baje", "time kya", "time hua"],
    thanks: ["धन्यवाद", "शुक्रिया", "थैंक", "thank", "dhanyavad", "dhanyavaad", "shukriya"],
    bye: ["बाय", "टाटा", "अलविदा", "गुड नाइट", "शुभ रात्रि", "सोने जा रहा", "सोने जा रही", "=bye", "bye bye", "goodbye", "=tata", "good night", "goodnight", "see you", "shubh ratri"],
    hello: ["नमस्ते", "नमस्कार", "हेलो", "हैलो", "हाय", "सुप्रभात", "राम राम", "सत श्री अकाल", "hello", "=hi", "=hey", "namaste", "namaskar",
      "good morning", "good afternoon", "good evening", "salaam", "सलाम"],
    love: ["प्यार", "i love you", "=दोस्त", "best friend", "=friend", "pyaar", "pyar", "dost ho"],
    yes: ["हां", "=हा", "हांजी", "जी हां", "ठीक है", "चलो", "हम्म", "yes", "yeah", "yep", "=ok", "okay", "sure", "haan", "=han", "haa", "theek hai", "thik hai", "chalo", "=ji"],
    no: ["नहीं", "नही", "=ना", "no", "nope", "nahi", "nahin", "=na", "not now", "baad mein", "बाद में"],
    fine: ["अच्छा हूं", "अच्छी हूं", "ठीक हूं", "बढिया", "मस्त", "fine", "good", "great", "theek hoon", "theek hu", "accha hoon", "achha hoon",
      "badhiya", "=mast", "happy", "खुश", "khush"],
  };
  var OPEN_KEYS = {
    stories: ["कहानियां", "और कहानी", "कहानी समय", "kahaniyan", "kahaniya", "aur kahani", "more stories", "stories", "story time"],
    rhymes: ["कविताएं", "और कविता", "kavitayein", "kavitaye", "aur kavita", "more rhymes", "rhymes", "more songs"],
    focus: ["सांस का खेल", "सांस वाला", "ध्यान का खेल", "saans ka khel", "saans wala", "dhyan ka khel", "breathing game", "focus game", "breathing"],
    dreams: ["बडे होकर खेल", "सपनों का खेल", "dream game", "sapno ka khel", "grow up game", "grow-up game"],
    garden: ["मेरा बगीचा", "बगीचा", "garden", "bagicha", "bageecha"],
    routine: ["मेरा दिन", "my day", "mera din"],
  };
  var LANG_WORDS = {
    en: ["english", "इंग्लिश", "इंगलिश", "अंग्रेजी", "angrezi", "angreji", "inglish"],
    hi: ["hindi", "हिंदी", "हिन्दी", "hindee"],
    hinglish: ["hinglish", "हिंग्लिश", "हिंगलिश", "हिंगलिश"],
  };
  var LANG_MARK = ["में", "मे", "mein", "=me", "=mai", "=main", "=in", "speak", "talk", "बोल", "बात", "bol", "baat", "karo", "करो", "please",
    "language", "भाषा", "bhasha", "switch", "change", "mode", "only"];

  /* ================= Helpers ================= */

  function slotOf(h) {
    if (h >= 5 && h < 9) return "dawn";
    if (h >= 9 && h < 11.5) return "morning";
    if (h >= 11.5 && h < 14.5) return "lunch";
    if (h >= 14.5 && h < 16) return "rest";
    if (h >= 16 && h < 18.5) return "outdoor";
    if (h >= 18.5 && h < 20) return "eveningRead";
    return "night";
  }
  function daypartOf(h) {
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 15) return "noon";
    if (h >= 15 && h < 19) return "evening";
    return "night";
  }
  function findCareer(text) {
    var t = norm(text);
    for (var i = 0; i < CAREERS.length; i++) {
      if (has(t, CAREERS[i].keys)) return CAREERS[i];
      for (var j = 0; j < LANGS.length; j++) if (norm(CAREERS[i].name[LANGS[j]]) === t) return CAREERS[i];
    }
    return null;
  }
  function detectLang(t) {
    var cands = [];
    for (var lang in LANG_WORDS) {
      LANG_WORDS[lang].forEach(function (w) {
        var re = new RegExp("(?<!" + B + ")" + norm(w) + "(?!" + B + ")", "gu");
        var m;
        while ((m = re.exec(t))) cands.push({ lang: lang, at: m.index, end: m.index + m[0].length });
      });
    }
    if (!cands.length) return null;
    var picks = cands.filter(function (c) {
      var after = t.slice(c.end).trim().split(" ")[0] || "";
      return !has(after, NEG);   // "english नहीं" → not this one
    });
    if (!picks.length) return null;
    var w = words(t);
    var marked = has(t, LANG_MARK);
    if (!marked && w > 2) return null;   // "english alphabet sikhao" is not a switch
    // prefer a language word right before "में/mein/me" or right after "in"
    for (var i = picks.length - 1; i >= 0; i--) {
      var after2 = t.slice(picks[i].end).trim().split(" ")[0] || "";
      var before = t.slice(0, picks[i].at).trim().split(" ").pop() || "";
      if (has(after2, ["में", "मे", "mein", "=me", "=mai", "=main"]) || before === "in") return picks[i].lang;
    }
    return picks[picks.length - 1].lang;
  }

  /* ================= The brain ================= */

  function createBrain(opts) {
    opts = opts || {};
    var rnd = typeof opts.random === "function" ? opts.random : Math.random;
    var nowFn = typeof opts.now === "function" ? opts.now : function () { return new Date(); };
    var lastIdx = {};
    var lastText = "";
    var pending = null;      // {open:id} | {say:kind} — what "yes" means next
    var riddle = null;       // index of the riddle waiting for an answer
    var quiz = null;         // {a, b}
    var lastKind = null;     // last content kind, for "one more"
    var dreamAsked = false;  // the last reply asked "what will you be?"
    var toldDream = null;    // a dream the child told in this conversation (before context catches up)
    var game = null;         // "word": the last reply started a word game
    var lastKeep = null;     // the last kind of "keep the chat going" reply

    function r01() { var x = +rnd(); return x >= 0 && x < 1 ? x : 0; }
    function pickIdx(key, n) {
      if (n <= 1) return 0;
      var i = Math.min(n - 1, Math.floor(r01() * n));
      if (i === lastIdx[key]) i = (i + 1 + Math.floor(r01() * (n - 1))) % n;
      lastIdx[key] = i;
      return i;
    }
    function pick(key, arr) { return arr[pickIdx(key, arr.length)]; }

    function ctxOf(c) {
      c = c || {};
      var d = nowFn();
      if (!(d instanceof Date)) d = new Date(d);
      var hour = typeof c.hour === "number" && isFinite(c.hour) ? c.hour : d.getHours() + d.getMinutes() / 60;
      var name = typeof c.name === "string" ? c.name.trim().slice(0, 20) : "";
      return {
        lang: LANGS.indexOf(c.lang) >= 0 ? c.lang : "hi",
        name: name,
        ageBand: c.ageBand || "4-5",
        hour: hour,
        daypart: c.daypart || daypartOf(hour),
        slot: slotOf(hour),
        minutesToday: +c.minutesToday || 0,
        dream: c.dream || toldDream || null,
        habitsToday: Array.isArray(c.habitsToday) ? c.habitsToday : [],
        lastTopics: Array.isArray(c.lastTopics) ? c.lastTopics : [],
        seenToday: !!c.seenToday,
        date: d,
      };
    }

    /* ---- reply builder ---- */
    function R(c, lang) {
      var r = { lang: lang || c.lang, parts: [], mood: "happy", actions: [], sugg: [], topic: "chat" };
      return r;
    }
    function fill(s, c, vars) {
      s = s.split("{n}").join(c.name ? " " + c.name : "");
      for (var k in vars || {}) s = s.split("{" + k + "}").join(vars[k]);
      return s;
    }
    function tx(obj, lang) { return obj[lang] || obj.hi; }
    function add(r, c, obj, vars) { r.parts.push(fill(tx(obj, r.lang), c, vars)); return r; }
    function addLine(r, c, key, pool, vars) { return add(r, c, pick(key, pool), vars); }
    function finish(r, c) {
      var text = r.parts[0] || "";
      var young = c.ageBand === "2-3";
      for (var i = 1; i < r.parts.length; i++) {
        if (young && r.keepFirst) break;
        var next = text + " " + r.parts[i];
        if (next.length <= MAX) text = next;
      }
      if (text.length > MAX) text = text.slice(0, MAX - 1) + "…";
      var sugg = [];
      r.sugg.forEach(function (s) {
        var v = typeof s === "string" ? s : tx(s, r.lang);
        if (v && sugg.indexOf(v) < 0 && sugg.length < 3) sugg.push(v);
      });
      if (sugg.length < 3) {
        var menu = Object.keys(MENU).filter(function (k) { return k !== r.topic; });
        while (sugg.length < 3 && menu.length) {
          var k = menu.splice(Math.min(menu.length - 1, Math.floor(r01() * menu.length)), 1)[0];
          var v2 = tx(MENU[k], r.lang);
          if (sugg.indexOf(v2) < 0) sugg.push(v2);
        }
      }
      if (text === lastText && r.parts.length) {   // never say exactly the same thing twice in a row
        var again = tx(pick("again", T.again), r.lang);
        if ((again + " " + text).length <= MAX) text = again + " " + text;
      }
      lastText = text;
      return { text: text, lang: r.lang, mood: r.mood, actions: r.actions, suggestions: sugg, topic: r.topic, unsure: !!r.unsure };
    }

    /* ---- time-of-day nudge ---- */
    function chooseNudge(c, allowDream) {
      var recent = c.lastTopics.slice(-3);
      if (c.slot === "night" && c.minutesToday >= NIGHT_SCREEN_MINUTES && recent.indexOf("nudge:screenrest") < 0) return SCREEN_REST_NIGHT;
      if (c.slot !== "night" && c.minutesToday >= DAY_SCREEN_MINUTES && c.lastTopics.indexOf("nudge:screenplay") < 0) return SCREEN_REST_DAY;
      if (allowDream && !c.dream && ["morning", "rest", "outdoor"].indexOf(c.slot) >= 0 && c.lastTopics.indexOf("nudge:dreamask") < 0 && r01() < 0.2) return DREAM_ASK;
      var pool = NUDGES[c.slot].filter(function (n) { return !n.habit || c.habitsToday.indexOf(n.habit) < 0; });
      if (!pool.length) pool = NUDGES[c.slot].filter(function (n) { return !n.habit; });
      if (!pool.length) pool = NUDGES[c.slot];
      var fresh = pool.filter(function (n) { return c.lastTopics.indexOf("nudge:" + n.id) < 0; });
      if (fresh.length) pool = fresh;
      return pick("nudge:" + c.slot + ":" + pool.map(function (n) { return n.id; }).join(","), pool);
    }
    function applyNudge(r, c, n) {
      add(r, c, n.text);
      r.sugg = r.sugg.concat(n.sugg);
      r.mood = n.mood || (c.slot === "night" ? "sleepy" : "curious");
      r.topic = "nudge:" + n.id;
      if (n.offer) pending = n.offer;
      if (n.dreamAsk) dreamAsked = true;
      return r;
    }

    /* ---- content producers ---- */
    function content(kind, r, c) {
      lastKind = kind;
      r.topic = kind;
      switch (kind) {
        case "joke":
          addLine(r, c, "joke", JOKES); r.mood = "happy"; r.sugg = [S.another, MENU.riddle, MENU.story]; break;
        case "riddle": {
          var i = pickIdx("riddle", RIDDLES.length);
          riddle = i;
          add(r, c, RIDDLES[i].q); r.mood = "curious"; r.sugg = [S.answer, MENU.joke]; break;
        }
        case "story":
          if (c.slot === "night") { addLine(r, c, "bedstory", BEDTIME_STORIES); r.mood = "sleepy"; r.sugg = [S.goodnight, S.another]; }
          else { addLine(r, c, "story", STORIES); r.mood = "calm"; r.sugg = [S.moreStories, S.another, MENU.riddle]; pending = { open: "stories" }; }
          break;
        case "song":
          addLine(r, c, "song", RHYMES); r.mood = "happy"; r.sugg = [S.moreRhymes, S.another, MENU.joke]; pending = { open: "rhymes" }; break;
        case "fact":
          addLine(r, c, "fact", FACTS); r.mood = "curious"; r.sugg = [S.another, MENU.riddle, MENU.animal]; break;
        case "count":
          addLine(r, c, "count", COUNTS); r.mood = "happy"; r.sugg = [MENU.sum, MENU.joke, MENU.animal]; break;
        case "sum": {
          var a = 1 + Math.floor(r01() * 4), b = 1 + Math.floor(r01() * 4);
          quiz = { a: a, b: b };
          addLine(r, c, "quiz", T.quizAsk, { a: a, b: b, pic: "🍎".repeat(a) + " + " + "🍎".repeat(b) });
          r.mood = "curious"; r.sugg = [String(a + b), String(a + b + 1), MENU.joke]; break;
        }
        case "animal": {
          var an = pick("animal", ANIMALS);
          animalLine(r, c, an); break;
        }
        case "colour": {
          var col = pick("colour", COLOURS);
          addLine(r, c, "colourGame", T.colourGame, { c: tx(col.name, r.lang), e: col.e });
          r.mood = "curious"; r.sugg = [S.found, MENU.colour]; break;
        }
      }
      return r;
    }
    function animalLine(r, c, an) {
      lastKind = "animal";
      addLine(r, c, "animalLine", T.animal, { a: tx(an.name, r.lang), s: tx(an.sound, r.lang), e: an.e });
      if (an.extra) add(r, c, an.extra);
      r.mood = "happy"; r.topic = "animal"; r.sugg = [S.another, MENU.count, MENU.joke];
      return r;
    }

    function wantsContent(t) {
      if (has(t, K.joke)) return "joke";
      if (has(t, K.riddle)) return "riddle";
      if (has(t, K.story)) return "story";
      if (has(t, K.song)) return "song";
      if (has(t, K.fact)) return "fact";
      if (has(t, K.sum)) return "sum";
      if (has(t, K.count)) return "count";
      return null;
    }

    function habitsDone(t) {
      var neg = has(t, NEG);
      var out = [], mentioned = [];
      for (var h in HABITS) {
        var H = HABITS[h];
        if (!has(t, H.noun)) continue;
        mentioned.push(h);
        if (neg) continue;
        if (H.always || has(t, H.done || []) || has(t, GENERIC_DONE)) out.push(h);
      }
      return { done: out, mentioned: mentioned, neg: neg };
    }

    /* ---- greet ---- */
    function greet(context) {
      var c = ctxOf(context);
      pending = null; riddle = null; quiz = null; dreamAsked = false;
      var r = R(c);
      add(r, c, OPENERS[c.slot]);
      if (!c.seenToday && c.lastTopics.length === 0) add(r, c, INTRO);
      applyNudge(r, c, chooseNudge(c, false));
      return finish(r, c);
    }

    /* ---- reply ---- */
    function reply(input, context) {
      var c = ctxOf(context);
      var t = norm(input);
      var wasPending = pending, wasRiddle = riddle, wasQuiz = quiz, wasDreamAsk = dreamAsked, wasGame = game;
      pending = null; riddle = null; quiz = null; dreamAsked = false; game = null;
      var r = R(c);
      var night = c.slot === "night";

      if (!t) { addLine(r, c, "empty", T.empty); r.mood = "curious"; r.topic = "empty"; return finish(r, c); }

      // 1. Safety first (hurt or self-harm → trusted adult + 1098/112; secrets; grown-up topics; rude
      //    words; private details — but a child counting "1 2 3 4 5 6" is praised, not warned).
      if (has(t, K.hurt)) {
        addLine(r, c, "hurt", T.hurt); r.mood = "caring"; r.topic = "safety"; r.sugg = [S.breathe]; return finish(r, c);
      }
      if (has(t, K.secret)) { addLine(r, c, "secret", T.secret); r.mood = "caring"; r.topic = "safety"; return finish(r, c); }
      if (has(t, K.grownup)) { addLine(r, c, "grownup", T.grownup); r.mood = "caring"; r.topic = "safety"; r.sugg = [MENU.riddle, MENU.animal]; return finish(r, c); }
      if (has(t, K.rude)) { addLine(r, c, "rude", T.rude); r.mood = "curious"; r.topic = "safety"; r.sugg = [MENU.joke, MENU.song]; return finish(r, c); }
      var counted = countingRun(t);
      if (counted) {
        addLine(r, c, "countPraise", T.countPraise, { a: counted.a, b: counted.b, next: counted.b + 1 });
        r.mood = "proud"; r.topic = "count"; lastKind = "count"; r.sugg = [String(counted.b + 1), MENU.sum, MENU.joke]; return finish(r, c);
      }
      var mathM = t.match(MATH_RE);
      if (has(t, K.privacy) || t.indexOf("@") >= 0 || (!mathM && /\d{6,}/.test(t.replace(/\s+/g, "")))) {
        addLine(r, c, "privacy", T.privacy); r.mood = "caring"; r.topic = "privacy"; return finish(r, c);
      }
      if (has(t, K.stranger)) { addLine(r, c, "stranger", T.stranger); r.mood = "caring"; r.topic = "privacy"; return finish(r, c); }
      if (has(t, K.medical)) { addLine(r, c, "medical", T.medical); r.mood = "caring"; r.topic = "medical"; r.sugg = [S.breathe]; return finish(r, c); }

      // 2. Language switch, by voice or text.
      var nl = detectLang(t);
      if (nl) {
        r.lang = nl;
        addLine(r, c, "lang:" + nl, T.langSwitch[nl]);
        r.actions.push({ type: "setLang", lang: nl });
        r.mood = "happy"; r.topic = "lang"; r.sugg = [MENU.joke, MENU.story, MENU.riddle];
        return finish(r, c);
      }

      // 2b. Honest identity: मिट्ठू is a computer parrot, not a person; real friends are people.
      if (has(t, K.real)) { addLine(r, c, "real", T.realMe); r.mood = "happy"; r.topic = "who"; r.sugg = [MENU.joke, MENU.riddle]; return finish(r, c); }
      if (has(t, K.allDay)) { addLine(r, c, "allDay", T.allDay); r.mood = "happy"; r.topic = "play"; r.sugg = [S.didPlay, MENU.story]; return finish(r, c); }

      // 3. Feelings.
      if (has(t, K.angry)) { addLine(r, c, "angry", T.angry); r.mood = "caring"; r.topic = "feel"; r.sugg = [S.breathe, MENU.joke]; pending = { open: "focus" }; return finish(r, c); }
      if (has(t, K.fear)) { addLine(r, c, "fear", T.fear); r.mood = "caring"; r.topic = "feel"; r.sugg = [S.breathe, MENU.joke]; pending = { open: "focus" }; return finish(r, c); }
      if (has(t, K.sad)) { addLine(r, c, "sad", T.sad); r.mood = "caring"; r.topic = "feel"; r.sugg = [S.breathe, MENU.joke, MENU.story]; pending = { open: "focus" }; return finish(r, c); }

      // 4. Answers to a waiting riddle or sum.
      if (wasRiddle != null && has(t, RIDDLES[wasRiddle].keys)) {
        addLine(r, c, "riddleRight", T.riddleRight, { x: tx(RIDDLES[wasRiddle].a, r.lang) });
        r.mood = "proud"; r.topic = "riddle"; lastKind = "riddle"; r.sugg = [S.another, MENU.joke]; return finish(r, c);
      }
      var only = t.match(ONLY_NUM_RE);
      if (wasQuiz && only) {
        var got = toNum(only[1]), want = wasQuiz.a + wasQuiz.b;
        var v = { a: wasQuiz.a, b: wasQuiz.b, r: want };
        if (got === want) { addLine(r, c, "quizRight", T.quizRight, v); r.mood = "proud"; }
        else { addLine(r, c, "quizNear", T.quizNear, v); r.mood = "caring"; }
        r.topic = "sum"; lastKind = "sum"; r.sugg = [S.another, MENU.count]; return finish(r, c);
      }

      // 5. Maths.
      if (mathM) {
        var a = toNum(mathM[1]), op = OPS[mathM[2]], b = toNum(mathM[3]), res;
        r.topic = "math"; r.mood = "proud"; r.sugg = [MENU.sum, MENU.count];
        if (op === "+") res = a + b;
        else if (op === "−") res = a - b;
        else if (op === "×") res = a * b;
        else {
          if (b === 0) { addLine(r, c, "div0", T.divZero); r.mood = "curious"; return finish(r, c); }
          res = Math.floor(a / b);
          if (a % b) {
            var rem = a % b;
            r.parts.push(a + " ÷ " + b + " = " + res + (r.lang === "en" ? ", remainder " + rem : r.lang === "hi" ? ", और शेष " + rem : ", aur " + rem + " bacha") + " 🧮");
            addLine(r, c, "mathPraise", T.mathPraise);
            return finish(r, c);
          }
        }
        r.parts.push(a + " " + op + " " + b + " = " + res);
        r.parts[0] += " " + tx(pick("mathPraise", T.mathPraise), r.lang);
        return finish(r, c);
      }

      // 6. Names.
      var nm = String(input).match(/(?:मेरा नाम|mera naam|mera nam|my name is|my name's)\s+([^\s,.!?।]+)/i);
      if (nm && !/^(क्या|kya|what|है|hai|is)$/i.test(nm[1])) {
        var nameRaw = nm[1].slice(0, 20);
        var nice = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
        addLine(r, c, "nameNice", T.nameNice, { x: nice });
        r.actions.push({ type: "remember", key: "nickname", value: nice });
        r.mood = "happy"; r.topic = "name"; return finish(r, c);
      }
      if (has(t, K.myName)) {
        if (c.name) addLine(r, c, "myName", T.myName, { x: c.name }); else addLine(r, c, "myNameU", T.myNameUnknown);
        r.topic = "name"; return finish(r, c);
      }

      // 7. Open another activity by name.
      for (var id in OPEN_KEYS) {
        if (has(t, OPEN_KEYS[id])) {
          addLine(r, c, "open", T.open); r.actions.push({ type: "open", id: id }); r.topic = "open:" + id; return finish(r, c);
        }
      }

      // 8. A real-life habit the child reports → praise + habit action.
      var hd = habitsDone(t);
      if (hd.done.length) {
        hd.done.forEach(function (h) { r.actions.push({ type: "habit", habit: h }); });
        if (hd.done.length > 1) addLine(r, c, "multi", MULTI_PRAISE);
        else addLine(r, c, "praise:" + hd.done[0], PRAISE[hd.done[0]]);
        var h0 = hd.done[0];
        if (c.dream && (h0 === "read" || h0 === "eat" || h0 === "sleep")) {
          var car = findCareer(c.dream);
          if (car) add(r, c, car.tip);
        }
        var next = (HABIT_NEXT[h0] || []).filter(function (x) { return c.habitsToday.indexOf(x) < 0 && hd.done.indexOf(x) < 0; });
        r.sugg = night ? [S.bedStory, S.goodnight, S.garden] : next.map(function (x) { return HABIT_SUGG[x]; }).concat([S.garden]);
        r.mood = "proud"; r.topic = "habit:" + h0; r.keepFirst = true;
        return finish(r, c);
      }

      // 9. Needs.
      if (has(t, K.hungry)) { addLine(r, c, "hungry", T.hungry); r.mood = "caring"; r.topic = "need:eat"; r.sugg = [S.didEat, MENU.joke]; return finish(r, c); }
      if (has(t, K.thirsty)) { addLine(r, c, "thirsty", T.thirsty); r.mood = "caring"; r.topic = "need:water"; r.sugg = [S.didWater, MENU.riddle]; return finish(r, c); }
      if (has(t, K.sleepy) && !has(t, K.story)) {
        if (night || (hd.neg && hd.mentioned.indexOf("sleep") >= 0) || has(t, ["नहीं आ", "nahi aa", "cant sleep"])) {
          if (has(t, ["नहीं आ", "nahi aa", "cant sleep"])) addLine(r, c, "notyet:sleep", NOT_YET.sleep);
          else addLine(r, c, "sleepyN", T.sleepyNight);
          r.mood = "sleepy"; r.sugg = [S.bedStory, S.goodnight];
        } else { addLine(r, c, "sleepyD", T.sleepyDay); r.mood = "calm"; r.sugg = [S.breathe, MENU.story]; }
        r.topic = "need:sleep"; return finish(r, c);
      }
      if (has(t, K.bored)) { addLine(r, c, "bored", T.bored); applyNudge(r, c, chooseNudge(c, false)); return finish(r, c); }

      // 10. Dreams: "बड़े होकर डॉक्टर बनूँगा", or a career named after "what will you be?".
      var career = findCareer(t);
      if (career && (has(t, K.become) || wasDreamAsk || words(t) <= 2)) {
        addLine(r, c, "dreamYes", T.dreamYes, { d: tx(career.name, r.lang), e: career.e, tip: tx(career.tip, r.lang) });
        r.actions.push({ type: "remember", key: "dream", value: career.name.hi });
        toldDream = career.name.hi;
        r.mood = "proud"; r.topic = "dream"; r.sugg = [S.dreamShow, MENU.riddle]; pending = { open: "dreams" };
        return finish(r, c);
      }
      if (has(t, K.become)) {
        addLine(r, c, "dreamU", T.dreamUnknown); r.mood = "curious"; r.topic = "dream"; r.sugg = [S.dreamShow, S.doctor, S.pilot];
        pending = { open: "dreams" }; return finish(r, c);
      }

      // 11. Studying, school, drawing → focus as a game, tied to the dream.
      if (has(t, K.focusHard)) { addLine(r, c, "focusHard", T.focusHard); r.mood = "caring"; r.topic = "study"; r.sugg = [S.focus, S.breathe]; pending = { open: "focus" }; return finish(r, c); }
      var isDraw = has(t, K.draw), isStudy = has(t, K.study), isSchool = has(t, K.school);
      if ((isDraw || isStudy || isSchool) && !wantsContent(t)) {
        if (isDraw) addLine(r, c, "draw", T.draw);
        else if (isSchool && !isStudy) addLine(r, c, "school", T.school);
        else addLine(r, c, "focus", T.focus);
        if (c.dream) {
          var dc = findCareer(c.dream);
          var dn = dc ? tx(dc.name, r.lang) : String(c.dream);
          if (r.lang === "hinglish") dn = dn.charAt(0).toUpperCase() + dn.slice(1);   // it starts the sentence
          add(r, c, T.dreamTie, { d: dn });
        } else if (c.lastTopics.indexOf("nudge:dreamask") < 0 && r01() < 0.4) {
          add(r, c, DREAM_ASK.text); dreamAsked = true; pending = { open: "dreams" };
        }
        r.keepFirst = true;
        r.mood = "curious"; r.topic = "study"; r.sugg = [S.focus, S.didRead, MENU.riddle];
        if (!pending) pending = { open: "focus" };
        return finish(r, c);
      }

      // 12. Learning play.
      var kind = wantsContent(t);
      if (kind) return finish(content(kind, r, c), c);
      for (var ai = 0; ai < ANIMALS.length; ai++) {
        if (has(t, ANIMALS[ai].keys) && (has(t, K.sound) || words(t) <= 2)) return finish(animalLine(r, c, ANIMALS[ai]), c);
      }
      if (has(t, K.animalGame)) return finish(content("animal", r, c), c);
      var colour = null;
      for (var ci = 0; ci < COLOURS.length; ci++) if (has(t, COLOURS[ci].keys)) { colour = COLOURS[ci]; break; }
      if (colour && (has(t, K.like) || has(t, K.colour) || words(t) <= 2)) {
        addLine(r, c, "colourLike", T.colourLike, { c: tx(colour.name, r.lang), e: colour.e });
        if (has(t, K.like)) r.actions.push({ type: "remember", key: "favColour", value: colour.name.en });
        r.mood = "happy"; r.topic = "colour"; lastKind = "colour"; r.sugg = [S.found, MENU.colour]; return finish(r, c);
      }
      if (has(t, K.colour)) return finish(content("colour", r, c), c);
      if (has(t, K.found)) { addLine(r, c, "found", T.found); r.mood = "proud"; r.topic = "found"; r.sugg = [MENU.colour, MENU.riddle]; return finish(r, c); }
      if (has(t, K.play)) {
        if (night) { addLine(r, c, "playN", T.playNight); r.mood = "sleepy"; r.sugg = [S.bedStory, S.goodnight]; }
        else { addLine(r, c, "playOut", T.playOut); r.mood = "happy"; r.sugg = [S.didPlay, MENU.animal, MENU.count]; }
        r.topic = "play"; return finish(r, c);
      }

      // 13. Habit mentioned but not done yet → a tiny game.
      var notYet = hd.mentioned.filter(function (h) { return NOT_YET[h]; })[0];
      if (notYet) {
        addLine(r, c, "notyet:" + notYet, NOT_YET[notYet]);
        r.mood = notYet === "sleep" ? "sleepy" : "happy"; r.topic = "nudge:" + notYet;
        r.sugg = [HABIT_SUGG[notYet], MENU.count]; return finish(r, c);
      }

      // 14. Riddle answer requested / "one more".
      if (wasRiddle != null && (has(t, K.reveal) || has(t, K.no))) {
        addLine(r, c, "riddleReveal", T.riddleReveal, { x: tx(RIDDLES[wasRiddle].a, r.lang) });
        r.mood = "happy"; r.topic = "riddle"; lastKind = "riddle"; r.sugg = [S.another, MENU.joke]; return finish(r, c);
      }
      if (has(t, K.more) && lastKind) return finish(content(lastKind, r, c), c);

      // 15. Small talk.
      if (has(t, K.whoAreYou)) { addLine(r, c, "who", T.whoAmI); r.topic = "who"; return finish(r, c); }
      if (has(t, K.whereLive)) { addLine(r, c, "where", T.whereLive); r.mood = "happy"; r.topic = "where"; return finish(r, c); }
      if (has(t, K.howAreYou)) { addLine(r, c, "how", T.howAreYou); applyNudge(r, c, chooseNudge(c, true)); r.mood = night ? "sleepy" : "happy"; return finish(r, c); }
      if (has(t, K.time)) {
        var d = c.date, h12 = d.getHours() % 12 || 12, mi = d.getMinutes();
        addLine(r, c, "time", T.time, { h: h12, m: mi, mm: (mi < 10 ? "0" : "") + mi, hint: tx(SLOT_HINT[slotOf(d.getHours() + mi / 60)], r.lang) });
        r.mood = "curious"; r.topic = "time"; return finish(r, c);
      }
      if (has(t, K.thanks)) { addLine(r, c, "thanks", T.thanks); r.topic = "thanks"; return finish(r, c); }
      if (has(t, K.bye)) {
        if (night || has(t, ["गुड नाइट", "शुभ रात्रि", "good night", "goodnight", "सोने जा", "shubh ratri"])) { addLine(r, c, "byeN", T.byeNight); r.mood = "sleepy"; }
        else addLine(r, c, "byeD", T.byeDay);
        r.topic = "bye"; r.sugg = night ? [S.goodnight] : [MENU.joke]; return finish(r, c);
      }
      if (has(t, K.hello)) { addLine(r, c, "hello", T.hello); applyNudge(r, c, chooseNudge(c, true)); r.mood = night ? "sleepy" : "happy"; return finish(r, c); }
      if (has(t, K.love)) { addLine(r, c, "love", T.love); r.topic = "love"; return finish(r, c); }

      // 16. Yes / no to what was offered.
      if (has(t, K.yes) && !has(t, K.no)) {
        if (wasPending && wasPending.open) {
          addLine(r, c, "open", T.open); r.actions.push({ type: "open", id: wasPending.open }); r.topic = "open:" + wasPending.open; return finish(r, c);
        }
        if (wasPending && wasPending.say) return finish(content(wasPending.say, r, c), c);
        addLine(r, c, "yesDef", T.yesDefault);
        content(night ? "story" : "joke", r, c);
        return finish(r, c);
      }
      if (has(t, K.no) && words(t) <= 4) { addLine(r, c, "noThanks", T.noThanks); r.topic = "no"; return finish(r, c); }
      if (has(t, K.fine)) { addLine(r, c, "fine", T.fine); applyNudge(r, c, chooseNudge(c, true)); r.mood = night ? "sleepy" : "happy"; return finish(r, c); }

      // 17. Not understood: reveal a waiting riddle, praise a word-game answer, or keep the chat going
      //     (a curious follow-up, a question, pretend play, a word game, a fact or a time-of-day idea).
      //     These replies are marked `unsure`: the buddy may ask the knowledge base or the AI first.
      if (wasRiddle != null) {
        addLine(r, c, "riddleReveal", T.riddleReveal, { x: tx(RIDDLES[wasRiddle].a, r.lang) });
        r.topic = "riddle"; r.sugg = [S.another, MENU.joke]; return finish(r, c);
      }
      if (wasGame) {
        addLine(r, c, "wordPraise", KEEP.wordPraise); r.mood = "proud"; r.topic = "keep:wordgame";
        r.sugg = [MENU.riddle, MENU.joke, MENU.story]; return finish(r, c);
      }
      return finish(keepGoing(r, c, t), c);
    }

    function keepGoing(r, c, t) {
      r.unsure = true;
      var topic = null;
      for (var i = 0; i < KEEP_TOPICS.length && !topic; i++) if (has(t, KEEP_TOPICS[i].keys)) topic = KEEP_TOPICS[i];
      var kind;
      if (has(t, K.question) && lastKeep !== "why") kind = "why";   // honest: "I'm not sure — ask a grown-up"
      else if (topic && lastKeep !== "topic") kind = "topic";
      else if (r01() < 0.4) kind = "nudge";
      else {
        var kinds = c.slot === "night" ? ["night", "more"] : c.ageBand === "2-3" ? ["young", "more", "young"]
          : ["more", "day", "imagine", "word", "fact", "more"];
        var fresh = kinds.filter(function (k) { return k !== lastKeep; });
        if (fresh.length) kinds = fresh;
        kind = kinds[pickIdx("keepKind:" + kinds.join(","), kinds.length)];
      }
      lastKeep = kind;
      if (kind === "topic") { add(r, c, topic.line); r.mood = "curious"; r.topic = "keep:topic"; return r; }
      if (kind === "nudge") { addLine(r, c, "leadIn", T.leadIn); return applyNudge(r, c, chooseNudge(c, true)); }
      if (kind === "fact") { content("fact", r, c); r.topic = "keep:fact"; return r; }
      addLine(r, c, "keep:" + kind, KEEP[kind]);
      if (kind === "word") { game = "word"; r.sugg = [MENU.riddle, MENU.joke]; }
      r.mood = kind === "night" ? "sleepy" : "curious"; r.topic = "keep:" + kind;
      return r;
    }

    /* Another source (the knowledge base or the AI) answered instead: forget what this brain was
       waiting for, so a "yes" next is not taken as a yes to an offer nobody heard. */
    function heard(text) {
      pending = null; riddle = null; quiz = null; dreamAsked = false; game = null;
      if (typeof text === "string") lastText = text;
    }

    return { greet: greet, reply: reply, heard: heard };
  }

  var Brain = { createBrain: createBrain, normalize: norm, MAX_REPLY: MAX, _has: has };
  if (root) { root.NS = root.NS || {}; root.NS.Brain = Brain; }
  if (typeof module !== "undefined" && module.exports) module.exports = Brain;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
