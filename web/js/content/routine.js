/* नन्हा स्कूल — content for "मेरा दिन" (routine). Pure data, no logic.
   The day in pictures. `hour` is the usual clock hour (24h) a little child does this;
   the order of the list IS the order of the day. `habit` is what we report to the garden
   (habit:done) when the child says they did it; null = nothing to report. */
(function () {
  "use strict";
  var NS = window.NS || (window.NS = {});
  NS.content = NS.content || {};

  NS.content.routine = {
    items: [
      { id: "wake", emoji: "🌅", hour: 7, habit: null,
        title: { hi: "उठना", en: "Wake up", hinglish: "Uthna" },
        line: { hi: "सुबह सात बजे — उठने का समय! सूरज भी जाग गया।", en: "Seven in the morning — time to wake up! The sun is awake too.", hinglish: "Subah saat baje — uthne ka time! Suraj bhi jaag gaya." },
        did: { hi: "क्या तुमने आँखें खोलकर एक बड़ी-सी अंगड़ाई ली?", en: "Did you open your eyes and take a big stretch?", hinglish: "Kya tumne aankhein kholkar ek badi si angdaai li?" },
        yay: { hi: "वाह! सुप्रभात! नया दिन, नया मज़ा।", en: "Yay! Good morning! A new day, new fun.", hinglish: "Waah! Good morning! Naya din, naya mazaa." } },
      { id: "brush", emoji: "🪥", hour: 7, habit: "brush",
        title: { hi: "ब्रश", en: "Brush teeth", hinglish: "Brush" },
        line: { hi: "उठकर सबसे पहले — दाँत चमकाओ! ऊपर-नीचे, गोल-गोल।", en: "First thing after waking — brush your teeth! Up and down, round and round.", hinglish: "Uthkar sabse pehle — daant chamkao! Upar-neeche, gol-gol." },
        did: { hi: "क्या तुमने दाँत चमकाए?", en: "Did you brush your teeth?", hinglish: "Kya tumne daant chamkaaye?" },
        yay: { hi: "वाह! दाँत मोतियों जैसे चमक रहे हैं!", en: "Wow! Your teeth are shining like pearls!", hinglish: "Waah! Daant motiyon jaise chamak rahe hain!" } },
      { id: "bath", emoji: "🛁", hour: 8, habit: "bath",
        title: { hi: "नहाना", en: "Bath time", hinglish: "Nahaana" },
        line: { hi: "छपाक-छपाक! नहाकर तन भी ताज़ा, मन भी ताज़ा।", en: "Splish-splash! A bath makes you feel fresh.", hinglish: "Chhapaak-chhapaak! Nahaakar sab fresh." },
        did: { hi: "क्या तुमने नहा लिया?", en: "Did you have your bath?", hinglish: "Kya tumne naha liya?" },
        yay: { hi: "आहा! कितनी अच्छी खुशबू आ रही है!", en: "Aha! You smell so nice!", hinglish: "Aha! Kitni achhi khushboo aa rahi hai!" } },
      { id: "breakfast", emoji: "🍳", hour: 8, habit: "eat",
        title: { hi: "नाश्ता", en: "Breakfast", hinglish: "Naashta" },
        line: { hi: "आठ बजे नाश्ता — पेट भरा, तो दिन भर ताक़त!", en: "Breakfast at eight — a full tummy gives energy all day!", hinglish: "Aath baje naashta — pet bhara, to din bhar taakat!" },
        did: { hi: "क्या तुमने नाश्ता किया?", en: "Did you eat your breakfast?", hinglish: "Kya tumne naashta kiya?" },
        yay: { hi: "बढ़िया! अब तुम्हारे अंदर ढेर सारी ताक़त है!", en: "Great! Now you have lots of energy!", hinglish: "Badhiya! Ab tumhare andar dher saari taakat hai!" } },
      { id: "school", emoji: "📚", hour: 9, habit: "read",
        title: { hi: "स्कूल / पढ़ाई", en: "School / learning", hinglish: "School / padhaai" },
        line: { hi: "नौ बजे स्कूल या पढ़ाई — रोज़ कुछ नया सीखेंगे!", en: "School or learning at nine — something new every day!", hinglish: "Nau baje school ya padhaai — roz kuch naya seekhenge!" },
        did: { hi: "क्या तुमने आज कुछ नया सीखा?", en: "Did you learn something new today?", hinglish: "Kya tumne aaj kuch naya seekha?" },
        yay: { hi: "शाबाश! तुम्हारा दिमाग़ और तेज़ हो गया!", en: "Well done! Your brain just grew stronger!", hinglish: "Shabaash! Tumhara dimaag aur tez ho gaya!" } },
      { id: "play", emoji: "⚽", hour: 12, habit: "play",
        title: { hi: "खेल", en: "Play", hinglish: "Khel" },
        line: { hi: "पढ़ाई के बाद थोड़ा खेल — दौड़ो, कूदो, हँसो!", en: "A little play after learning — run, jump and laugh!", hinglish: "Padhaai ke baad thoda khel — daudo, koodo, hanso!" },
        did: { hi: "क्या तुमने खेला?", en: "Did you play?", hinglish: "Kya tumne khela?" },
        yay: { hi: "वाह! खेलने से शरीर मज़बूत होता है!", en: "Yay! Playing makes your body strong!", hinglish: "Waah! Khelne se body strong hoti hai!" } },
      { id: "lunch", emoji: "🍛", hour: 13, habit: "eat",
        title: { hi: "खाना", en: "Lunch", hinglish: "Khaana" },
        line: { hi: "दोपहर एक बजे — दाल, चावल, सब्ज़ी। हाथ धोकर खाना!", en: "One o'clock — dal, rice and veggies. Wash hands, then eat!", hinglish: "Dopahar ek baje — dal, chawal, sabzi. Haath dhokar khaana!" },
        did: { hi: "क्या तुमने खाना खाया?", en: "Did you eat your lunch?", hinglish: "Kya tumne khaana khaaya?" },
        yay: { hi: "शाबाश! अब पेट भी ख़ुश, तुम भी ख़ुश!", en: "Well done! Happy tummy, happy you!", hinglish: "Shabaash! Pet bhi khush, tum bhi khush!" } },
      { id: "rest", emoji: "😴", hour: 14, habit: null,
        title: { hi: "आराम", en: "Rest", hinglish: "Aaraam" },
        line: { hi: "दो बजे थोड़ा आराम — आँखें बंद, शरीर ढीला।", en: "Rest at two — eyes closed, body soft and floppy.", hinglish: "Do baje thoda aaraam — aankhein band, body dheeli." },
        did: { hi: "क्या तुमने थोड़ा आराम किया?", en: "Did you rest a little?", hinglish: "Kya tumne thoda aaraam kiya?" },
        yay: { hi: "बढ़िया! आराम के बाद फिर से ताज़ा!", en: "Lovely! Fresh again after a rest!", hinglish: "Badhiya! Aaraam ke baad phir se fresh!" } },
      { id: "outdoor", emoji: "🌳", hour: 17, habit: "play",
        title: { hi: "शाम का खेल", en: "Evening play", hinglish: "Shaam ka khel" },
        line: { hi: "शाम पाँच बजे — बाहर खेलने चलो! झूला, गेंद, पकड़म-पकड़ाई।", en: "Five in the evening — let's play outside! Swings, ball, tag.", hinglish: "Shaam paanch baje — bahar khelne chalo! Jhoola, ball, pakdam-pakdaai." },
        did: { hi: "क्या तुमने बाहर खेला?", en: "Did you play outside?", hinglish: "Kya tumne bahar khela?" },
        yay: { hi: "वाह! ताज़ी हवा में खेलना सबसे मज़ेदार!", en: "Yay! Playing in fresh air is the best!", hinglish: "Waah! Fresh hawa mein khelna sabse mazedaar!" } },
      { id: "story", emoji: "📖", hour: 19, habit: "read",
        title: { hi: "पढ़ाई / कहानी", en: "Study / story", hinglish: "Padhaai / kahaani" },
        line: { hi: "शाम सात बजे — थोड़ी पढ़ाई या एक प्यारी कहानी।", en: "Seven in the evening — a little study or a lovely story.", hinglish: "Shaam saat baje — thodi padhaai ya ek pyaari kahaani." },
        did: { hi: "क्या तुमने कहानी सुनी या थोड़ी पढ़ाई की?", en: "Did you hear a story or study a little?", hinglish: "Kya tumne kahaani suni ya thodi padhaai ki?" },
        yay: { hi: "शाबाश! कहानियाँ हमें बहुत कुछ सिखाती हैं।", en: "Well done! Stories teach us so much.", hinglish: "Shabaash! Kahaaniyaan humein bahut kuch sikhaati hain." } },
      { id: "dinner", emoji: "🍲", hour: 20, habit: "eat",
        title: { hi: "रात का खाना", en: "Dinner", hinglish: "Raat ka khaana" },
        line: { hi: "रात आठ बजे — सब साथ बैठकर खाना खाएँगे।", en: "Eight at night — we all eat dinner together.", hinglish: "Raat aath baje — sab saath baithkar khaana khaayenge." },
        did: { hi: "क्या तुमने रात का खाना खाया?", en: "Did you eat your dinner?", hinglish: "Kya tumne raat ka khaana khaaya?" },
        yay: { hi: "बढ़िया! साथ में खाना खाने में कितना मज़ा!", en: "Great! Eating together is so much fun!", hinglish: "Badhiya! Saath mein khaana khaane mein kitna mazaa!" } },
      { id: "sleep", emoji: "🌙", hour: 21, habit: "sleep",
        title: { hi: "सोना", en: "Sleep", hinglish: "Sona" },
        line: { hi: "रात नौ बजे — ब्रश, कहानी और फिर मीठी नींद।", en: "Nine at night — brush, a story, then sweet sleep.", hinglish: "Raat nau baje — brush, kahaani aur phir meethi neend." },
        did: { hi: "क्या तुमने सोने की तैयारी कर ली?", en: "Are you ready for bed?", hinglish: "Kya tumne sone ki taiyaari kar li?" },
        yay: { hi: "शाबाश! अब फ़ोन रख दो, आँखें बंद… मीठे सपने!", en: "Well done! Now put the phone away, close your eyes… sweet dreams!", hinglish: "Shabaash! Ab phone rakh do, aankhein band… meethe sapne!" } }
    ],

    /* Extra real-life habits offered under "और क्या किया?" (not tied to a clock time). */
    extras: [
      { id: "water", emoji: "💧", habit: "water",
        title: { hi: "पानी पिया", en: "Drank water", hinglish: "Paani piya" },
        yay: { hi: "गट-गट-गट! पानी से शरीर ताज़ा रहता है।", en: "Gulp-gulp! Water keeps your body fresh.", hinglish: "Gat-gat-gat! Paani se body fresh rehti hai." } },
      { id: "help", emoji: "🤝", habit: "help",
        title: { hi: "मदद की", en: "Helped someone", hinglish: "Madad ki" },
        yay: { hi: "वाह! मदद करने वाले बच्चे सबको प्यारे लगते हैं।", en: "Wow! Helping makes everyone happy.", hinglish: "Waah! Madad karne waale bachche sabko pyaare lagte hain." } }
    ],

    /* "सुबह या रात?" sorting cards. part: "morning" | "night". */
    sort: [
      { emoji: "🌅", part: "morning", title: { hi: "सूरज उगना", en: "Sunrise" },
        why: { hi: "सूरज तो सुबह-सुबह उगता है!", en: "The sun rises in the morning!" } },
      { emoji: "🐓", part: "morning", title: { hi: "मुर्गे की कुकड़ूँ-कूँ", en: "Rooster's cock-a-doodle-doo" },
        why: { hi: "मुर्गा सुबह-सुबह कुकड़ूँ-कूँ करके सबको जगाता है!", en: "The rooster crows in the morning to wake everyone!" } },
      { emoji: "🍳", part: "morning", title: { hi: "नाश्ता", en: "Breakfast" },
        why: { hi: "नाश्ता हम सुबह करते हैं।", en: "We eat breakfast in the morning." } },
      { emoji: "🎒", part: "morning", title: { hi: "स्कूल जाना", en: "Going to school" },
        why: { hi: "स्कूल सुबह जाते हैं, बस्ता लेकर!", en: "We go to school in the morning, with our bag!" } },
      { emoji: "🛁", part: "morning", title: { hi: "नहाना", en: "Bath" },
        why: { hi: "सुबह नहाकर दिन ताज़ा शुरू होता है।", en: "A morning bath starts the day fresh." } },
      { emoji: "🌻", part: "morning", title: { hi: "फूल खिलना", en: "Flowers opening" },
        why: { hi: "सूरजमुखी सुबह सूरज को देखकर खिलता है।", en: "The sunflower opens up to the morning sun." } },
      { emoji: "🌙", part: "night", title: { hi: "चाँद", en: "The moon" },
        why: { hi: "चाँद मामा रात को आते हैं!", en: "The moon comes out at night!" } },
      { emoji: "⭐", part: "night", title: { hi: "तारे", en: "Stars" },
        why: { hi: "तारे रात को टिमटिमाते हैं।", en: "Stars twinkle at night." } },
      { emoji: "🦉", part: "night", title: { hi: "उल्लू", en: "Owl" },
        why: { hi: "उल्लू रात को जागता है और दिन में सोता है!", en: "The owl is awake at night and sleeps in the day!" } },
      { emoji: "😴", part: "night", title: { hi: "सोना", en: "Sleeping" },
        why: { hi: "रात को हम मीठी नींद सोते हैं।", en: "We sleep sweetly at night." } },
      { emoji: "🍲", part: "night", title: { hi: "रात का खाना", en: "Dinner" },
        why: { hi: "रात का खाना तो रात में ही होता है!", en: "Dinner is eaten at night!" } },
      { emoji: "🛏️", part: "night", title: { hi: "बिस्तर", en: "Bed" },
        why: { hi: "रात को हम बिस्तर पर सोने जाते हैं।", en: "At night we go to bed." } }
    ]
  };
})();
