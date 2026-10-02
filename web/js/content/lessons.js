/* नन्हा स्कूल — flashcard lessons (pure data, used by js/modules/learn.js and the quiz).

   deck  = {id, icon, title:{hi,en,hinglish?}, color, intro:{hi,en}, sticker, flip?, speakLang?, cards}
   card  = {big, pic?, name:{hi,en}, say:{hi,en}, bg?}
     big        what is shown large (letter, number or picture)
     pic        picture shown on the back of a flip card (letters and numbers); on colour and
                shape cards, a real thing of that colour / shape (e.g. लाल → 🍅, वृत्त → 🛞)
     Pictures are emoji keys; js/content/images.js maps them to realistic pictures (NS.img).
     name       the thing's name; the caption shows "hindi · english"
     say        what the voice says (in the UI language, Hinglish → Hindi); a deck's speakLang
                ("en" for ABC, "hi" for अक्षर) fixes the language instead. */
(function () {
  "use strict";
  const c = (big, pic, hi, en, sayHi, sayEn, bg) => ({ big, pic, name: { hi, en }, say: { hi: sayHi || hi, en: sayEn || en }, bg });

  const ABC = [["A","Apple","🍎"],["B","Ball","⚽"],["C","Cat","🐈"],["D","Dog","🐕"],["E","Elephant","🐘"],["F","Fish","🐟"],["G","Grapes","🍇"],["H","Hat","🎩"],["I","Ice cream","🍦"],["J","Juice","🧃"],["K","Kite","🪁"],["L","Lion","🦁"],["M","Monkey","🐒"],["N","Nest","🪺"],["O","Orange","🍊"],["P","Parrot","🦜"],["Q","Queen","👸"],["R","Rabbit","🐇"],["S","Sun","☀️"],["T","Tiger","🐯"],["U","Umbrella","☂️"],["V","Van","🚐"],["W","Watch","⌚"],["X","X-mas tree","🎄"],["Y","Yo-yo","🪀"],["Z","Zebra","🦓"]];
  const VARN = [["अ","अनानास","🍍"],["आ","आम","🥭"],["इ","इंजन","🚂"],["ई","ईंट","🧱"],["उ","उल्लू","🦉"],["ऊ","ऊन","🧶"],["ए","एम्बुलेंस","🚑"],["ऐ","ऐनक","👓"],["ओ","ओस","💧"],["औ","औरत","👩"],["अं","अंगूर","🍇"],["क","कमल","🪷"],["ख","खरगोश","🐇"],["ग","गमला","🪴"],["घ","घड़ी","⌚"],["च","चम्मच","🥄"],["छ","छाता","☂️"],["ज","जहाज़","🚢"],["झ","झंडा","🚩"],["ट","टमाटर","🍅"],["ठ","ठेला","🛒"],["ड","डिब्बा","📦"],["ढ","ढोल","🥁"],["त","तितली","🦋"],["थ","थाली","🍽️"],["द","दूध","🥛"],["ध","धनुष","🏹"],["न","नाव","⛵"],["प","पतंग","🪁"],["फ","फूल","🌺"],["ब","बकरी","🐐"],["भ","भालू","🐻"],["म","मछली","🐟"],["य","योग","🧘"],["र","रोटी","🫓"],["ल","लकड़ी","🪵"],["व","वन","🌳"],["श","शेर","🦁"],["स","सेब","🍎"],["ह","हाथी","🐘"],["क्ष","क्षितिज","🌅"],["त्र","त्रिशूल","🔱"],["ज्ञ","ज्ञानी","👴"]];
  const NUMW = ["एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ","दस"];
  const NUME = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
  const COUNT_PICS = ["🍎","🍌","🐥","🎈","🥭","🍓","🐟","🌸","🚗","🦋"];

  const decks = [
    { id: "abc", icon: "🔤", title: { hi: "ABC", en: "ABC" }, color: "#EF5350", sticker: "🍎", flip: true, speakLang: "en",
      intro: { hi: "अंग्रेज़ी अक्षर! A B C", en: "The English alphabet! A B C" },
      cards: ABC.map(([l, w, e]) => ({ big: l, pic: e, name: { hi: w, en: w }, say: { hi: l + " for " + w, en: l + " for " + w }, front: { hi: l, en: l } })) },
    { id: "varn", icon: "अ", title: { hi: "अक्षर", en: "Hindi letters", hinglish: "Akshar" }, color: "#AB47BC", sticker: "🦚", flip: true, speakLang: "hi",
      intro: { hi: "हिंदी वर्णमाला! अ आ इ ई", en: "हिंदी वर्णमाला! अ आ इ ई" },
      cards: VARN.map(([l, w, e]) => ({ big: l, pic: e, name: { hi: w, en: w }, say: { hi: l + " से " + w, en: l + " से " + w }, front: { hi: l, en: l } })) },
    { id: "count", icon: "🔢", title: { hi: "गिनती", en: "Counting", hinglish: "Ginti" }, color: "#5C6BC0", sticker: "🐞", flip: true,
      intro: { hi: "एक, दो, तीन… चलो गिनती सीखें!", en: "One, two, three… let's count!" },
      cards: NUMW.map((w, i) => ({ big: String(i + 1), pic: COUNT_PICS[i].repeat(i + 1), name: { hi: w, en: NUME[i] },
        say: { hi: w, en: NUME[i] }, front: { hi: w, en: NUME[i] },
        back: { hi: "गिनो: " + NUMW.slice(0, i + 1).join(", ") + "!", en: "Count: " + NUME.slice(0, i + 1).join(", ") + "!" } })) },
    { id: "colors", icon: "🎨", title: { hi: "रंग", en: "Colours", hinglish: "Rang" }, color: "#29B6F6", sticker: "🌈",
      intro: { hi: "रंगों के नाम सीखो!", en: "Let's learn the colours!" },
      cards: [c("🔴", "🍅", "लाल", "Red", 0, 0, "#E53935"), c("🟢", "🫛", "हरा", "Green", 0, 0, "#43A047"), c("🔵", "🧢", "नीला", "Blue", 0, 0, "#1E88E5"),
        c("🟡", "🍌", "पीला", "Yellow", 0, 0, "#FDD835"), c("🟠", "🍊", "नारंगी", "Orange", 0, 0, "#FB8C00"), c("🟣", "🍆", "बैंगनी", "Purple", 0, 0, "#8E24AA"),
        c("🟤", "🐻", "भूरा", "Brown", 0, 0, "#6D4C41"), c("⚫", "🐜", "काला", "Black", 0, 0, "#212121"), c("⚪", "🥛", "सफ़ेद", "White", 0, 0, "#FAFAFA"),
        c("🌸", "🪷", "गुलाबी", "Pink", 0, 0, "#EC407A")] },
    { id: "shapes", icon: "🔷", title: { hi: "आकार", en: "Shapes", hinglish: "Aakaar" }, color: "#26A69A", sticker: "⭐",
      intro: { hi: "आकार सीखो — गोल, चौकोर, तिकोना!", en: "Let's learn shapes — round, square, triangle!" },
      cards: [c("⭕", "🛞", "वृत्त", "Circle"), c("🟥", "🖼️", "वर्ग", "Square"), c("🔺", "⛺", "त्रिकोण", "Triangle"), c("⭐", null, "तारा", "Star"), c("❤️", null, "दिल", "Heart"), c("🔷", "🪁", "हीरा", "Diamond")] },
    { id: "animals", icon: "🐘", title: { hi: "जानवर", en: "Animals", hinglish: "Jaanwar" }, color: "#8D6E63", sticker: "🦁",
      intro: { hi: "जानवर और उनकी आवाज़!", en: "Animals and the sounds they make!" },
      cards: [c("🐄", null, "गाय", "Cow", "गाय बोलती है, मूँ मूँ", "The cow says moo moo"), c("🐕", null, "कुत्ता", "Dog", "कुत्ता बोलता है, भौं भौं", "The dog says woof woof"),
        c("🐈", null, "बिल्ली", "Cat", "बिल्ली बोलती है, म्याऊँ म्याऊँ", "The cat says meow meow"), c("🦁", null, "शेर", "Lion", "शेर दहाड़ता है, दहाड़", "The lion roars, roar!"),
        c("🐐", null, "बकरी", "Goat", "बकरी बोलती है, में में", "The goat says maa maa"), c("🐓", null, "मुर्गा", "Rooster", "मुर्गा बोलता है, कुकड़ूँ कूँ", "The rooster says cock-a-doodle-doo"),
        c("🐘", null, "हाथी", "Elephant", "हाथी बहुत बड़ा होता है", "The elephant is very big"), c("🐒", null, "बंदर", "Monkey", "बंदर पेड़ पर कूदता है", "The monkey jumps in the tree"),
        c("🐸", null, "मेंढक", "Frog", "मेंढक बोलता है, टर्र टर्र", "The frog says ribbit ribbit"), c("🐦", null, "चिड़िया", "Bird", "चिड़िया बोलती है, चूँ चूँ", "The bird says tweet tweet")] },
    { id: "fruits", icon: "🍎", title: { hi: "फल-सब्ज़ी", en: "Fruits & veg", hinglish: "Phal-sabzi" }, color: "#66BB6A", sticker: "🥭",
      intro: { hi: "फल और सब्ज़ियाँ — खाओ और बढ़ो!", en: "Fruits and vegetables — eat and grow!" },
      cards: [c("🍎", null, "सेब", "Apple"), c("🍌", null, "केला", "Banana"), c("🥭", null, "आम", "Mango"), c("🍇", null, "अंगूर", "Grapes"), c("🍊", null, "संतरा", "Orange"),
        c("🍉", null, "तरबूज़", "Watermelon"), c("🥕", null, "गाजर", "Carrot"), c("🍅", null, "टमाटर", "Tomato"), c("🥔", null, "आलू", "Potato"), c("🧅", null, "प्याज़", "Onion")] },
    { id: "vehicles", icon: "🚗", title: { hi: "वाहन", en: "Vehicles", hinglish: "Gaadiyan" }, color: "#FF7043", sticker: "🚂",
      intro: { hi: "गाड़ियों के नाम — पों पों!", en: "Things that go — beep beep!" },
      cards: [c("🚗", null, "कार", "Car"), c("🚌", null, "बस", "Bus"), c("🚂", null, "रेलगाड़ी", "Train"), c("✈️", null, "हवाई जहाज़", "Aeroplane"), c("🚲", null, "साइकिल", "Cycle"),
        c("🛺", null, "ऑटो", "Auto", "ऑटो रिक्शा", "Auto rickshaw"), c("⛵", null, "नाव", "Boat"), c("🚑", null, "एम्बुलेंस", "Ambulance")] },
    { id: "body", icon: "✋", title: { hi: "शरीर", en: "My body", hinglish: "Shareer" }, color: "#EC407A", sticker: "💪",
      intro: { hi: "हमारे शरीर के अंग!", en: "Parts of our body!" },
      cards: [c("👁️", null, "आँख", "Eye", "आँख, इससे हम देखते हैं", "Eyes — we see with them"), c("👂", null, "कान", "Ear", "कान, इससे हम सुनते हैं", "Ears — we hear with them"),
        c("👃", null, "नाक", "Nose", "नाक, इससे हम सूँघते हैं", "Nose — we smell with it"), c("👄", null, "मुँह", "Mouth", "मुँह, इससे हम बोलते और खाते हैं", "Mouth — we talk and eat with it"),
        c("✋", null, "हाथ", "Hand", "हाथ, इससे हम काम करते हैं", "Hands — we work with them"), c("🦶", null, "पैर", "Foot", "पैर, इससे हम चलते हैं", "Feet — we walk with them"),
        c("🦷", null, "दाँत", "Teeth", "दाँत, इनसे हम चबाते हैं", "Teeth — we chew with them"), c("💇", null, "बाल", "Hair")] },
    { id: "manners", icon: "🙏", title: { hi: "अच्छी बातें", en: "Kind words", hinglish: "Achhi baatein" }, color: "#FFA726", sticker: "💛",
      intro: { hi: "प्यार से बोलना सीखो!", en: "Let's learn kind words!" },
      cards: [c("🙏", null, "नमस्ते", "Namaste", "बड़ों को नमस्ते कहते हैं", "We say namaste to elders"), c("🎁", null, "धन्यवाद", "Thank you", "कोई कुछ दे तो धन्यवाद कहते हैं", "When someone gives us something, we say thank you"),
        c("🙋", null, "कृपया", "Please", "कुछ माँगते समय कृपया कहते हैं", "When we ask for something, we say please"), c("🙇", null, "माफ़ करना", "Sorry", "गलती हो जाए तो माफ़ी माँगते हैं", "If we make a mistake, we say sorry"),
        c("🪥", null, "ब्रश करो", "Brush", "सुबह उठकर दाँत साफ़ करते हैं", "We brush our teeth in the morning"), c("🧼", null, "हाथ धोओ", "Wash hands", "खाने से पहले हाथ धोते हैं", "We wash our hands before eating"),
        c("🍎", null, "फल खाओ", "Eat fruit", "हरी सब्ज़ी और फल खाने से हम मज़बूत बनते हैं", "Green vegetables and fruit make us strong"), c("🛌", null, "जल्दी सोओ", "Sleep early", "रात को जल्दी सोते हैं और सुबह जल्दी उठते हैं", "We sleep early and wake up early")] },
  ];

  window.NS.content.lessons = {
    decks,
    deck: id => decks.find(d => d.id === id) || null,
    /* Picture decks inside the "दुनिया देखो" tile, in this order. */
    worldDecks: ["colors", "shapes", "animals", "fruits", "vehicles", "body", "manners"],
  };
})();
