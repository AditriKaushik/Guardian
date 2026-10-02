/* नन्हा स्कूल — content for "रोबो दोस्त" (Robot Friend, modules/robo.js). Pure data, no logic.

   Three games with चिंटू रोबो:
     teach  "रोबो को सिखाओ"  — sort pictures into two baskets; the robot learns from the examples
                               (a feature-count model in robo.js) and then guesses new pictures.
                               Round 1 has few examples, so the robot makes a mistake the child
                               corrects; round 2 adds examples and it gets them right.
     paths  "रास्ता बताओ"      — arrow cards that move the robot on a grid (3×3 / 4×4 / 5×5 by age).
     ask    "रोबो से पूछो"     — clear vs. vague requests, checking the robot, asking a grown-up.

   Every picture has `f`: the things the robot "notices" (keys of `features`). tools/test/future.test.mjs
   checks that each teach set really behaves as described (mistake in round 1, all right in round 2). */
(function () {
  "use strict";
  var NS = window.NS || (window.NS = {});
  NS.content = NS.content || {};

  /* What the robot can notice, and how it explains a guess ("…क्योंकि ये मीठा है!"). */
  var features = {
    red: { e: "🔴", hi: "लाल", en: "red", why: { hi: "ये लाल है", en: "it is red" } },
    green: { e: "🟢", hi: "हरा", en: "green", why: { hi: "ये हरा है", en: "it is green" } },
    yellow: { e: "🟡", hi: "पीला", en: "yellow", why: { hi: "ये पीला है", en: "it is yellow" } },
    orange: { e: "🟠", hi: "नारंगी", en: "orange", why: { hi: "ये नारंगी है", en: "it is orange" } },
    purple: { e: "🟣", hi: "बैंगनी", en: "purple", why: { hi: "ये बैंगनी है", en: "it is purple" } },
    blue: { e: "🔵", hi: "नीला", en: "blue", why: { hi: "ये नीला है", en: "it is blue" } },
    brown: { e: "🟤", hi: "भूरा", en: "brown", why: { hi: "ये भूरा है", en: "it is brown" } },
    white: { e: "⚪", hi: "सफ़ेद", en: "white", why: { hi: "ये सफ़ेद है", en: "it is white" } },
    grey: { e: "🌫️", hi: "स्लेटी", en: "grey", why: { hi: "ये स्लेटी है", en: "it is grey" } },
    pink: { e: "🌸", hi: "गुलाबी", en: "pink", why: { hi: "ये गुलाबी है", en: "it is pink" } },
    round: { e: "⚽", hi: "गोल", en: "round", why: { hi: "ये गोल है", en: "it is round" } },
    long: { e: "📏", hi: "लंबा", en: "long", why: { hi: "ये लंबा है", en: "it is long" } },
    small: { e: "🐜", hi: "छोटा", en: "small", why: { hi: "ये छोटा है", en: "it is small" } },
    big: { e: "🐘", hi: "बड़ा", en: "big", why: { hi: "ये बड़ा है", en: "it is big" } },
    food: { e: "🍽️", hi: "खाने की चीज़", en: "food", why: { hi: "ये खाने की चीज़ है", en: "it is food" } },
    animal: { e: "🐾", hi: "जानवर", en: "animal", why: { hi: "ये जानवर है", en: "it is an animal" } },
    plant: { e: "🌱", hi: "पौधा", en: "plant", why: { hi: "ये पौधा है", en: "it is a plant" } },
    vehicle: { e: "🚗", hi: "गाड़ी", en: "vehicle", why: { hi: "ये गाड़ी है", en: "it is a vehicle" } },
    sweet: { e: "🍯", hi: "मीठा", en: "sweet", why: { hi: "ये मीठा है", en: "it is sweet" } },
    cooked: { e: "🍳", hi: "पकाकर खाते हैं", en: "cooked", why: { hi: "इसे पकाकर खाते हैं", en: "we cook it" } },
    swims: { e: "🌊", hi: "तैरता है", en: "swims", why: { hi: "ये तैरता है", en: "it swims" } },
    walks: { e: "🐾", hi: "चलता है", en: "walks", why: { hi: "ये पैरों से चलता है", en: "it walks on legs" } },
    stripes: { e: "🦓", hi: "धारियाँ", en: "stripes", why: { hi: "इस पर धारियाँ हैं", en: "it has stripes" } },
    soft: { e: "☁️", hi: "मुलायम", en: "soft", why: { hi: "ये मुलायम है", en: "it is soft" } },
    tail: { e: "〰️", hi: "पूँछ", en: "tail", why: { hi: "इसकी पूँछ है", en: "it has a tail" } },
    teeth: { e: "🦷", hi: "दाँत", en: "teeth", why: { hi: "इसके बड़े दाँत हैं", en: "it has big teeth" } },
  };

  /* Teach sets. `level`: the youngest age band that gets this set first. rounds[i].teach are
     sorted by the child; rounds[i].test are guessed by the robot one by one — each checked picture
     joins the examples straight away, so later guesses already use it. */
  var teach = [
    {
      id: "colour", level: "2-3", icon: "🎨",
      title: { hi: "लाल या हरा?", en: "Red or green?", hinglish: "Laal ya hara?" },
      ask: { hi: "ये किस टोकरी में जाएगा — लाल या हरी?", en: "Which basket — red or green?" },
      baskets: [
        { id: "red", e: "🔴", color: "#E53935", soft: "#FFEBEE", hi: "लाल टोकरी", en: "Red basket", hinglish: "Laal tokri" },
        { id: "green", e: "🟢", color: "#2E9D4A", soft: "#E8F5E9", hi: "हरी टोकरी", en: "Green basket", hinglish: "Hari tokri" },
      ],
      items: [
        { id: "apple", e: "🍎", is: "red", f: ["red", "food", "round"], hi: "सेब", en: "apple" },
        { id: "frog", e: "🐸", is: "green", f: ["green", "animal", "small"], hi: "मेंढक", en: "frog" },
        { id: "gapple", e: "🍏", is: "green", f: ["green", "food", "round"], hi: "हरा सेब", en: "green apple" },
        { id: "firetruck", e: "🚒", is: "red", f: ["red", "vehicle", "big"], hi: "दमकल गाड़ी", en: "fire engine" },
        { id: "strawberry", e: "🍓", is: "red", f: ["red", "food", "small"], hi: "स्ट्रॉबेरी", en: "strawberry" },
        { id: "leaf", e: "🍃", is: "green", f: ["green", "plant", "small"], hi: "पत्ता", en: "leaf" },
        { id: "ladybug", e: "🐞", is: "red", f: ["red", "animal", "small"], hi: "लाल कीड़ा", en: "ladybird" },
        { id: "cucumber", e: "🥒", is: "green", f: ["green", "food", "long"], hi: "खीरा", en: "cucumber" },
        { id: "rose", e: "🌹", is: "red", f: ["red", "plant", "small"], hi: "गुलाब", en: "rose" },
        { id: "tree", e: "🌳", is: "green", f: ["green", "plant", "big"], hi: "पेड़", en: "tree" },
      ],
      rounds: [
        { teach: ["apple", "frog"], test: ["gapple", "firetruck"] },
        { teach: ["strawberry", "leaf"], test: ["ladybug", "cucumber"] },
      ],
      /* "उल्टा-पुल्टा" (4+): the child teaches these backwards; the robot then calls `test` wrong */
      mix: { teach: ["apple", "firetruck", "gapple", "cucumber"], test: ["strawberry", "frog"] },
      /* 4+ get one more picture per round (still few in round 1). */
      extra: [
        { teach: [], test: [] },
        { teach: ["rose", "tree"], test: [] },
      ],
    },
    {
      id: "fruitveg", level: "4-5", icon: "🧺",
      title: { hi: "फल या सब्ज़ी?", en: "Fruit or vegetable?", hinglish: "Phal ya sabzi?" },
      ask: { hi: "ये फल है या सब्ज़ी?", en: "Is it a fruit or a vegetable?" },
      baskets: [
        { id: "fruit", e: "🍇", color: "#C2185B", soft: "#FCE4EC", hi: "फल की टोकरी", en: "Fruit basket", hinglish: "Phal ki tokri" },
        { id: "veg", e: "🥕", color: "#2E9D4A", soft: "#E8F5E9", hi: "सब्ज़ी की टोकरी", en: "Vegetable basket", hinglish: "Sabzi ki tokri" },
      ],
      items: [
        { id: "apple", e: "🍎", is: "fruit", f: ["red", "round", "small", "sweet"], hi: "सेब", en: "apple" },
        { id: "brinjal", e: "🍆", is: "veg", f: ["purple", "long", "cooked"], hi: "बैंगन", en: "brinjal" },
        { id: "cherry", e: "🍒", is: "fruit", f: ["red", "small", "round", "sweet"], hi: "चेरी", en: "cherries" },
        { id: "garlic", e: "🧄", is: "veg", f: ["white", "small", "round", "cooked"], hi: "लहसुन", en: "garlic" },
        { id: "corn", e: "🌽", is: "veg", f: ["yellow", "long", "cooked"], hi: "भुट्टा", en: "corn" },
        { id: "banana", e: "🍌", is: "fruit", f: ["yellow", "long", "sweet"], hi: "केला", en: "banana" },
        { id: "carrot", e: "🥕", is: "veg", f: ["orange", "long", "cooked"], hi: "गाजर", en: "carrot" },
        { id: "watermelon", e: "🍉", is: "fruit", f: ["green", "big", "round", "sweet"], hi: "तरबूज़", en: "watermelon" },
        { id: "broccoli", e: "🥦", is: "veg", f: ["green", "cooked"], hi: "हरी गोभी", en: "broccoli" },
        { id: "potato", e: "🥔", is: "veg", f: ["brown", "round", "cooked"], hi: "आलू", en: "potato" },
        { id: "orange", e: "🍊", is: "fruit", f: ["orange", "round", "sweet"], hi: "संतरा", en: "orange" },
        { id: "pineapple", e: "🍍", is: "fruit", f: ["yellow", "big", "sweet"], hi: "अनानास", en: "pineapple" },
      ],
      rounds: [
        { teach: ["apple", "brinjal"], test: ["cherry", "garlic", "corn"] },
        { teach: ["banana", "carrot", "watermelon", "broccoli"], test: ["potato", "orange", "pineapple"] },
      ],
      mix: { teach: ["apple", "cherry", "brinjal", "garlic"], test: ["banana", "corn"] },
    },
    {
      id: "waterland", level: "6+", icon: "🌊",
      title: { hi: "पानी में या ज़मीन पर?", en: "Water or land?", hinglish: "Paani mein ya zameen par?" },
      ask: { hi: "ये पानी में रहता है या ज़मीन पर?", en: "Does it live in water or on land?" },
      baskets: [
        { id: "water", e: "🌊", color: "#1E88E5", soft: "#E3F2FD", hi: "पानी वाले", en: "Water animals", hinglish: "Paani wale" },
        { id: "land", e: "🌳", color: "#8D6E00", soft: "#FFF8E1", hi: "ज़मीन वाले", en: "Land animals", hinglish: "Zameen wale" },
      ],
      items: [
        { id: "whale", e: "🐋", is: "water", f: ["grey", "big", "swims", "tail"], hi: "व्हेल", en: "whale" },
        { id: "rabbit", e: "🐇", is: "land", f: ["white", "small", "walks"], hi: "ख़रगोश", en: "rabbit" },
        { id: "elephant", e: "🐘", is: "land", f: ["grey", "big", "walks", "tail"], hi: "हाथी", en: "elephant" },
        { id: "clownfish", e: "🐠", is: "water", f: ["orange", "small", "swims", "stripes"], hi: "धारी वाली मछली", en: "striped fish" },
        { id: "cow", e: "🐄", is: "land", f: ["white", "big", "walks"], hi: "गाय", en: "cow" },
        { id: "fish", e: "🐟", is: "water", f: ["blue", "small", "swims"], hi: "मछली", en: "fish" },
        { id: "octopus", e: "🐙", is: "water", f: ["pink", "soft", "swims"], hi: "ऑक्टोपस", en: "octopus" },
        { id: "tiger", e: "🐅", is: "land", f: ["orange", "big", "stripes", "walks"], hi: "बाघ", en: "tiger" },
        { id: "monkey", e: "🐒", is: "land", f: ["brown", "walks", "tail"], hi: "बंदर", en: "monkey" },
        { id: "shark", e: "🦈", is: "water", f: ["grey", "big", "swims", "teeth"], hi: "शार्क", en: "shark" },
        { id: "giraffe", e: "🦒", is: "land", f: ["yellow", "big", "walks"], hi: "जिराफ़", en: "giraffe" },
        { id: "dolphin", e: "🐬", is: "water", f: ["blue", "big", "swims"], hi: "डॉल्फ़िन", en: "dolphin" },
      ],
      rounds: [
        { teach: ["whale", "rabbit"], test: ["clownfish", "elephant", "cow"] },
        { teach: ["fish", "octopus", "tiger", "monkey"], test: ["shark", "giraffe", "dolphin"] },
      ],
      mix: { teach: ["whale", "clownfish", "elephant", "cow"], test: ["fish", "rabbit"] },
    },
  ];

  /* Arrow cards. abs = move one square that way (2–5 years); rel = like a real robot: forward,
     turn left, turn right (6+). The icons are drawn by robo.js; these are the spoken names. */
  var cards = {
    up: { hi: "ऊपर", en: "Up", hinglish: "Upar" },
    down: { hi: "नीचे", en: "Down", hinglish: "Neeche" },
    left: { hi: "बाएँ", en: "Left", hinglish: "Baayein" },
    right: { hi: "दाएँ", en: "Right", hinglish: "Daayein" },
    fwd: { hi: "आगे", en: "Forward", hinglish: "Aage" },
    tl: { hi: "बाएँ मुड़ो", en: "Turn left", hinglish: "Baayein mudo" },
    tr: { hi: "दाएँ मुड़ो", en: "Turn right", hinglish: "Daayein mudo" },
  };

  /* Grids: start [x, y, heading 0=up 1=right 2=down 3=left], goal [x, y], walls [[x, y]…]
     (x = column from the left, y = row from the top). `max` = most cards in a program. */
  var paths = {
    "2-3": {
      size: 3, mode: "abs", loops: false, max: 5,
      levels: [
        { start: [0, 1, 1], goal: [1, 1], prize: "🥭" },
        { start: [0, 1, 1], goal: [2, 1], prize: "⚽" },
        { start: [1, 2, 0], goal: [1, 0], prize: "🍌" },
        { start: [2, 0, 3], goal: [0, 0], prize: "🎁" },
        { start: [0, 2, 0], goal: [1, 1], prize: "🥭" },
        { start: [0, 0, 1], goal: [2, 2], prize: "⚽" },
      ],
    },
    "4-5": {
      size: 4, mode: "abs", loops: false, max: 8,
      levels: [
        { start: [0, 3, 1], goal: [3, 3], prize: "🥭" },
        { start: [0, 3, 0], goal: [0, 0], prize: "⚽" },
        { start: [0, 3, 1], goal: [2, 1], walls: [[1, 3]], prize: "🍌" },
        { start: [0, 0, 1], goal: [3, 0], walls: [[1, 0]], prize: "🎁" },
        { start: [0, 3, 1], goal: [3, 0], walls: [[1, 2], [2, 1], [3, 3]], prize: "🥭" },
        { start: [3, 3, 3], goal: [0, 0], walls: [[1, 1], [2, 2], [0, 2]], prize: "⚽" },
      ],
    },
    "6+": {
      size: 5, mode: "rel", loops: true, max: 9,
      levels: [
        { start: [0, 4, 0], goal: [0, 1], prize: "🥭" },
        { start: [0, 4, 1], goal: [4, 4], prize: "⚽" },
        { start: [0, 4, 0], goal: [2, 2], prize: "🍌" },
        { start: [0, 4, 1], goal: [4, 4], walls: [[2, 4]], prize: "🎁" },
        { start: [2, 4, 0], goal: [2, 0], walls: [[2, 2], [1, 1]], prize: "🥭" },
        { start: [0, 0, 2], goal: [4, 0], walls: [[2, 0], [2, 1], [2, 2]], prize: "⚽" },
        { start: [4, 4, 3], goal: [0, 0], walls: [[1, 4], [1, 3], [3, 1], [3, 0]], prize: "🍌" },
      ],
    },
  };

  /* "रोबो से पूछो" rounds. type ask: pick how to ask (clear gets the right thing);
     draw: the robot draws what you ask for; check: the robot is wrong — spot it;
     who: robot or grown-up?; robot: is the robot a person? `level` = youngest age band. */
  var ask = [
    {
      type: "ask", level: "2-3",
      need: { e: "🍎", hi: "लाल सेब", en: "the red apple" },
      intro: { hi: "तुम्हें लाल सेब चाहिए। रोबो से कैसे माँगोगे?", en: "You want the red apple. How will you ask the robot?" },
      shelf: ["🍏", "🍎", "🍌"],
      options: [
        { pic: "👉❓", clear: false, gets: "🍌", say: { hi: "वो दो!", en: "Give me that!" } },
        { pic: "🔴🍎", clear: true, gets: "🍎", say: { hi: "लाल सेब दो।", en: "Please give me the red apple." } },
      ],
    },
    {
      type: "ask", level: "2-3",
      need: { e: "🚕", hi: "पीली गाड़ी", en: "the yellow car" },
      intro: { hi: "अब तुम्हें पीली गाड़ी चाहिए। कैसे माँगोगे?", en: "Now you want the yellow car. How will you ask?" },
      shelf: ["🚗", "🚕", "🚙"],
      options: [
        { pic: "🚗❓", clear: false, gets: "🚗", say: { hi: "गाड़ी दो!", en: "Give me a car!" } },
        { pic: "🟡🚕", clear: true, gets: "🚕", say: { hi: "पीली गाड़ी दो।", en: "Please give me the yellow car." } },
      ],
    },
    {
      type: "robot", level: "2-3",
      intro: { hi: "चिंटू से पूछो: क्या तुम्हें भूख लगती है? रोबो क्या खाता है?", en: "Ask Chintu: do you get hungry? What does a robot eat?" },
      options: [
        { pic: "🍕", right: false, say: { hi: "पिज़्ज़ा खाता है", en: "It eats pizza" } },
        { pic: "🔋", right: true, say: { hi: "बिजली से चलता है", en: "It runs on electricity" } },
      ],
      answer: { hi: "सही! मैं इंसान नहीं, मशीन हूँ। मुझे खाना नहीं, बिजली चाहिए। भूख तो तुम्हें लगती है — तुम खाना खाओ!", en: "Right! I'm not a person, I'm a machine. I don't need food, I need electricity. You get hungry — you eat food!" },
    },
    {
      type: "draw", level: "4-5",
      intro: { hi: "चिंटू चित्र बना सकता है! पर क्या बनाए? तुम बताओ।", en: "Chintu can draw pictures! But what should it draw? You tell it." },
      options: [
        { pic: "✏️❓", clear: false, draw: ["〰️", "❓", "🌀"], say: { hi: "कुछ बनाओ।", en: "Draw something." } },
        { pic: "🌳🐤", clear: true, draw: ["🌳", "🐤", "☀️"], say: { hi: "पेड़ पर बैठी पीली चिड़िया बनाओ, और ऊपर सूरज।", en: "Draw a yellow bird sitting on a tree, with the sun above." } },
      ],
    },
    {
      type: "check", level: "4-5",
      show: "🍎🍎🍎", claim: "5",
      intro: { hi: "चिंटू ने सेब गिने। चिंटू कहता है: यहाँ पाँच सेब हैं! क्या ये सही है? तुम ख़ुद गिनो।", en: "Chintu counted the apples. Chintu says: there are five apples! Is that right? Count them yourself." },
      right: { hi: "हाँ! सेब तो तीन हैं। रोबो ने गलती की — इसलिए हम ख़ुद गिनकर जाँचते हैं।", en: "Yes! There are only three apples. The robot made a mistake — that's why we count and check ourselves." },
      wrong: { hi: "फिर से गिनो — एक, दो, तीन! सेब तीन हैं, पाँच नहीं। रोबो भी गलती कर सकता है।", en: "Count again — one, two, three! There are three apples, not five. Robots can make mistakes too." },
    },
    {
      type: "who", level: "2-3",
      show: "🤕",
      intro: { hi: "गिरने से घुटने में चोट लगी है। दर्द हो रहा है। किसे बताओगे?", en: "You fell and hurt your knee. It hurts. Who will you tell?" },
      options: [
        { pic: "🤖", right: false, say: { hi: "रोबो को", en: "The robot" } },
        { pic: "👩‍👧", right: true, say: { hi: "मम्मी-पापा या किसी बड़े को", en: "Mummy, Papa or a grown-up" } },
      ],
      answer: { hi: "बिल्कुल! मैं मशीन हूँ — मैं गले नहीं लगा सकता, पट्टी नहीं कर सकता। चोट लगे तो बड़ों को बताओ।", en: "Exactly! I'm a machine — I can't hug you or put on a bandage. When you're hurt, tell a grown-up." },
    },
    {
      type: "ask", level: "6+",
      need: { e: "📕", hi: "लाल किताब", en: "the red book" },
      intro: { hi: "तुम्हें शेर वाली लाल किताब चाहिए। सबसे साफ़ कैसे माँगोगे?", en: "You want the red book about lions. What's the clearest way to ask?" },
      shelf: ["📗", "📕", "📘"],
      options: [
        { pic: "👉❓", clear: false, gets: "📗", say: { hi: "वो दो!", en: "Give me that!" } },
        { pic: "📚❓", clear: false, gets: "📘", say: { hi: "किताब दो!", en: "Give me a book!" } },
        { pic: "🔴📕🦁", clear: true, gets: "📕", say: { hi: "शेर वाली लाल किताब दो।", en: "Please give me the red book about lions." } },
      ],
    },
    {
      type: "who", level: "4-5",
      show: "😟",
      intro: { hi: "रात को अँधेरे में डर लग रहा है। किससे कहोगे?", en: "You feel scared in the dark at night. Who will you tell?" },
      options: [
        { pic: "🤖", right: false, say: { hi: "रोबो से", en: "The robot" } },
        { pic: "👨‍👩‍👧", right: true, say: { hi: "घर के किसी बड़े से", en: "A grown-up at home" } },
      ],
      answer: { hi: "हाँ! दिल की बात — डर, दुख, ख़ुशी — अपने बड़ों से कहो। वो तुम्हें सच में समझते हैं।", en: "Yes! Feelings — scared, sad or happy — tell them to your grown-ups. They really understand you." },
    },
  ];

  /* What the robot fetches on the grid (spoken in "<prize> तक पहुँचाओ"). */
  var prizes = {
    "🥭": { hi: "आम", en: "the mango", go: { hi: "रोबो को आम तक पहुँचाओ!", en: "Take the robot to the mango!" } },
    "⚽": { hi: "गेंद", en: "the ball", go: { hi: "रोबो को गेंद तक पहुँचाओ!", en: "Take the robot to the ball!" } },
    "🍌": { hi: "केला", en: "the banana", go: { hi: "रोबो को केले तक पहुँचाओ!", en: "Take the robot to the banana!" } },
    "🎁": { hi: "तोहफ़ा", en: "the present", go: { hi: "रोबो को तोहफ़े तक पहुँचाओ!", en: "Take the robot to the present!" } },
  };

  NS.content.robo = {
    name: { hi: "चिंटू रोबो", en: "Chintu the robot", hinglish: "Chintu Robo" },
    features: features,
    teach: teach,
    cards: cards,
    paths: paths,
    prizes: prizes,
    ask: ask,
  };
})();
