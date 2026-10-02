/* नन्हा स्कूल — content for "कहानी समय" (stories). Pure data, no logic.
   All stories are original, written for this app (the ant & grasshopper is a kind retelling of the
   folk fable in our own words). Each page: scene (emoji picture), hi, en.
   Each story: 1–2 picture questions (answer = index of the right choice) and an off-screen mission. */
(function () {
  "use strict";
  var NS = window.NS || (window.NS = {});
  NS.content = NS.content || {};

  NS.content.stories = [
    {
      id: "chinki", cover: "🐦", color: "#8BC34A",
      title: { hi: "चिंकी का घोंसला", en: "Chinki's Nest" },
      pages: [
        { scene: "🐦🌳☀️", hi: "यह चिंकी गौरैया है। चिंकी ची-ची करके गाती है।", en: "This is Chinki the sparrow. She sings chee-chee." },
        { scene: "☁️🐦☁️", hi: "एक दिन माँ बोली, “चिंकी, कुछ दिनों में बारिश आएगी।”", en: "One day her mother said, “Chinki, the rain will come in a few days.”" },
        { scene: "🐦💭🏠", hi: "चिंकी ने सोचा, “तो मैं आज से ही घोंसला बनाना शुरू करती हूँ।”", en: "Chinki thought, “Then I will start building my nest today.”" },
        { scene: "🐦🌾🌾🌳", hi: "रोज़ सुबह वह थोड़े-थोड़े तिनके लाती। एक तिनका, दो तिनके, तीन तिनके!", en: "Every morning she brought a few straws. One straw, two straws, three straws!" },
        { scene: "🦜🎶🐦", hi: "मिट्ठू तोता बोला, “आओ, सारा दिन खेलें!” चिंकी मुस्कुराई, “पहले काम, फिर खेल। शाम को खेलेंगे!”", en: "Mitthu the parrot said, “Let's play all day!” Chinki smiled, “Work first, then play. We'll play in the evening!”" },
        { scene: "🌳🐦🏠", hi: "कुछ ही दिनों में घोंसला तैयार हो गया — गोल, गरम और मज़बूत।", en: "In a few days the nest was ready — round, warm and strong." },
        { scene: "🌧️🌳🐦", hi: "फिर आई झमाझम बारिश! चिंकी अपने घोंसले में आराम से बैठी रही।", en: "Then came the pouring rain! Chinki sat snug in her nest." },
        { scene: "🐦🦜🌈", hi: "भीगा हुआ मिट्ठू आया। चिंकी बोली, “अंदर आ जाओ, दोस्त!” बारिश के बाद दोनों ने इंद्रधनुष देखा।", en: "Mitthu came by, all wet. Chinki said, “Come in, friend!” After the rain they watched a rainbow together." }
      ],
      questions: [
        { q: { hi: "चिंकी ने घोंसला कब बनाया?", en: "When did Chinki build her nest?" },
          choices: [ { emoji: "☀️", hi: "बारिश से पहले", en: "Before the rain" }, { emoji: "🌧️", hi: "बारिश में", en: "In the rain" } ], answer: 0 },
        { q: { hi: "चिंकी रोज़ क्या लाती थी?", en: "What did Chinki bring every day?" },
          choices: [ { emoji: "🍬", hi: "टॉफ़ी", en: "Sweets" }, { emoji: "🌾", hi: "तिनके", en: "Straws" }, { emoji: "⚽", hi: "गेंद", en: "A ball" } ], answer: 1 }
      ],
      mission: { emoji: "🧸", hi: "आज अपने खिलौने उनकी जगह पर रखो — जैसे चिंकी ने अपना घर सँवारा!", en: "Today put your toys back in their place — just like Chinki took care of her home!" }
    },
    {
      id: "golu", cover: "🐘", color: "#7E57C2",
      title: { hi: "गोलू हाथी की दौड़", en: "Golu's Morning Race" },
      pages: [
        { scene: "🐘🌳🌳", hi: "जंगल में एक छोटा हाथी रहता था — गोलू।", en: "A little elephant named Golu lived in the forest." },
        { scene: "🦚📣", hi: "मोर ने सबको बताया, “कल सुबह जंगल में दौड़ होगी!”", en: "The peacock told everyone, “Tomorrow morning there will be a race in the forest!”" },
        { scene: "🌙🐒🎶", hi: "रात को भोलू बंदर बोला, “गोलू, चलो देर तक नाचते हैं!”", en: "At night Bholu the monkey said, “Golu, let's dance till late!”" },
        { scene: "🐘🌙😴", hi: "गोलू बोला, “नहीं भोलू, अब सोने का समय है। कल दौड़ है!” और वह समय पर सो गया।", en: "Golu said, “No Bholu, it's time to sleep. The race is tomorrow!” And he went to sleep on time." },
        { scene: "🌅🐘💪", hi: "सुबह गोलू उठा तो एकदम ताज़ा! उसने पानी पिया और सूँड़ हिलाई।", en: "In the morning Golu woke up feeling fresh! He drank water and waved his trunk." },
        { scene: "🐒🥱", hi: "पर भोलू की आँखें नींद से भारी थीं। “उफ़्फ़, मुझे तो नींद आ रही है!”", en: "But Bholu's eyes were heavy. “Oof, I'm so sleepy!”" },
        { scene: "🏁🐘🐒🦒", hi: "दौड़ शुरू! गोलू धम-धम दौड़ा और सबसे पहले पहुँचा।", en: "The race began! Golu ran thump-thump and got there first." },
        { scene: "🐘🤝🐒", hi: "गोलू ने भोलू का हाथ पकड़ा, “आज रात हम दोनों समय पर सोएँगे, और कल साथ दौड़ेंगे!”", en: "Golu held Bholu's hand, “Tonight we'll both sleep on time, and tomorrow we'll race together!”" }
      ],
      questions: [
        { q: { hi: "गोलू दौड़ में सबसे पहले क्यों पहुँचा?", en: "Why did Golu get there first?" },
          choices: [ { emoji: "😴", hi: "वह समय पर सोया था", en: "He slept on time" }, { emoji: "📺", hi: "उसने देर तक टीवी देखा", en: "He watched TV till late" } ], answer: 0 },
        { q: { hi: "रात को सोने का समय हो, तो क्या करें?", en: "When it's bedtime at night, what do we do?" },
          choices: [ { emoji: "💃", hi: "देर तक नाचें", en: "Dance till late" }, { emoji: "🌙", hi: "सो जाएँ", en: "Go to sleep" } ], answer: 1 }
      ],
      mission: { emoji: "🌙", hi: "आज रात गोलू की तरह सबको “शुभ रात्रि” बोलो और समय पर सो जाओ।", en: "Tonight say “good night” to everyone like Golu, and sleep on time." }
    },
    {
      id: "cheenu", cover: "🐜", color: "#FF7043",
      title: { hi: "चीनू चींटी और टिंकू टिड्डा", en: "Cheenu the Ant and Tinku the Grasshopper" },
      pages: [
        { scene: "☀️🐜🌾", hi: "गर्मी के दिन थे। चीनू चींटी रोज़ दाने इकट्ठे करती थी।", en: "It was summer. Cheenu the ant gathered grain every day." },
        { scene: "🦗🎻🎶", hi: "टिंकू टिड्डा सारा दिन गाना गाता — “टिन-टिन-टिन!”", en: "Tinku the grasshopper sang all day — “tin-tin-tin!”" },
        { scene: "🐜💬🦗", hi: "चीनू बोली, “टिंकू, थोड़ा गाओ, थोड़े दाने भी जमा करो। सर्दी आने वाली है।”", en: "Cheenu said, “Tinku, sing a little and store a little grain too. Winter is coming.”" },
        { scene: "🦗😄", hi: "टिंकू हँसा, “अरे, अभी तो बहुत समय है!”", en: "Tinku laughed, “Oh, there's lots of time!”" },
        { scene: "❄️🌬️🦗", hi: "फिर आई ठंडी-ठंडी सर्दी। टिंकू के पास खाने को कुछ नहीं था। उसे भूख लगी।", en: "Then the cold winter came. Tinku had nothing to eat. He was hungry." },
        { scene: "🏠🐜🦗", hi: "चीनू ने दरवाज़ा खोला, “आओ टिंकू, हमारे पास सबके लिए दाने हैं।”", en: "Cheenu opened the door, “Come in, Tinku, we have grain for everyone.”" },
        { scene: "🦗🎻🐜🐜", hi: "टिंकू ने सबके लिए मीठा गाना गाया। सारी चींटियाँ ख़ुश होकर नाचीं।", en: "Tinku sang a sweet song for everyone. All the ants danced happily." },
        { scene: "☀️🦗🐜🌾", hi: "अगली गर्मी में टिंकू ने गाना भी गाया और चीनू के साथ दाने भी जमा किए।", en: "Next summer Tinku sang AND gathered grain with Cheenu." }
      ],
      questions: [
        { q: { hi: "सर्दी से पहले चीनू ने क्या किया?", en: "What did Cheenu do before winter?" },
          choices: [ { emoji: "🌾", hi: "दाने जमा किए", en: "Stored grain" }, { emoji: "😴", hi: "सारा दिन सोई", en: "Slept all day" } ], answer: 0 },
        { q: { hi: "अगली गर्मी में टिंकू ने क्या किया?", en: "What did Tinku do the next summer?" },
          choices: [ { emoji: "🎻", hi: "सिर्फ़ गाना", en: "Only sang" }, { emoji: "🎻🌾", hi: "गाना भी, काम भी", en: "Sang and worked too" } ], answer: 1 }
      ],
      mission: { emoji: "🤝", hi: "आज घर में किसी बड़े की एक छोटी-सी मदद करो — जैसे चीनू और टिंकू ने मिलकर काम किया।", en: "Today help a grown-up at home with one small job — like Cheenu and Tinku worked together." }
    },
    {
      id: "daantdada", cover: "🦷", color: "#29B6F6",
      title: { hi: "दाँत दादा", en: "Grandpa Tooth" },
      pages: [
        { scene: "👦🛏️🌙", hi: "रोहन को नींद आ रही थी। उसने सोचा, “आज ब्रश नहीं करूँगा।”", en: "Rohan was sleepy. He thought, “I won't brush today.”" },
        { scene: "🦷👴✨", hi: "तभी एक छोटी-सी चमकती आवाज़ आई, “नमस्ते रोहन! मैं हूँ दाँत दादा।”", en: "Just then a tiny, twinkly voice said, “Hello Rohan! I am Grandpa Tooth.”" },
        { scene: "🦷🍬🦠", hi: "“दिन भर जो खाया, उसके छोटे टुकड़े दाँतों में छिपे हैं। रात को वे कीटाणु बनकर ऊधम मचाते हैं!”", en: "“Little bits of what you ate are hiding in your teeth. At night they turn into germs and make mischief!”" },
        { scene: "👦🪥💧", hi: "रोहन उछला, “तो मैं उन्हें भगा दूँगा!” उसने ब्रश पर थोड़ा-सा पेस्ट लगाया।", en: "Rohan jumped up, “Then I'll chase them away!” He put a little paste on his brush." },
        { scene: "🪥⬆️⬇️🔄", hi: "ऊपर-नीचे, आगे-पीछे, गोल-गोल! रोहन ने अच्छे से ब्रश किया।", en: "Up and down, front and back, round and round! Rohan brushed really well." },
        { scene: "🦷✨😁", hi: "दाँत दादा मुस्कुराए, “देखो, सारे दाँत मोतियों जैसे चमक रहे हैं!”", en: "Grandpa Tooth smiled, “Look, all your teeth are shining like pearls!”" },
        { scene: "🌅🪥🌙", hi: "उस दिन से रोहन दो बार ब्रश करता है — सुबह भी और रात को भी।", en: "Since that day Rohan brushes twice — in the morning and at night." },
        { scene: "😁🍎👨‍👩‍👦", hi: "अब रोहन हँसता है तो सब कहते हैं, “कितनी चमकदार मुस्कान!”", en: "Now when Rohan laughs, everyone says, “What a shiny smile!”" }
      ],
      questions: [
        { q: { hi: "रोहन दिन में कितनी बार ब्रश करता है?", en: "How many times a day does Rohan brush?" },
          choices: [ { emoji: "🌅🌙", hi: "दो बार — सुबह और रात", en: "Twice — morning and night" }, { emoji: "🚫", hi: "कभी नहीं", en: "Never" } ], answer: 0 },
        { q: { hi: "ब्रश करने के बाद दाँत कैसे हो गए?", en: "How were the teeth after brushing?" },
          choices: [ { emoji: "🟤", hi: "गंदे", en: "Dirty" }, { emoji: "✨", hi: "चमकदार", en: "Shiny" } ], answer: 1 }
      ],
      mission: { emoji: "🪥", hi: "आज रात ब्रश करते समय गोल-गोल ब्रश घुमाओ और दाँत दादा को “नमस्ते” बोलो!", en: "Tonight, brush round and round and say “hello” to Grandpa Tooth!" }
    },
    {
      id: "meera", cover: "🎨", color: "#EC407A",
      title: { hi: "मीरा की तस्वीर", en: "Meera's Picture" },
      pages: [
        { scene: "👧🖍️📄", hi: "मीरा को चित्र बनाना बहुत अच्छा लगता है। आज वह एक बड़ा सूरज बना रही है।", en: "Meera loves to draw. Today she is drawing a big sun." },
        { scene: "🦋👧", hi: "तभी खिड़की पर एक तितली आई। मीरा ने देखा… फिर बोली, “पहले मेरा सूरज!”", en: "Just then a butterfly came to the window. Meera looked… then said, “My sun first!”" },
        { scene: "☀️🖍️", hi: "उसने सूरज में पीला रंग भरा — धीरे-धीरे, ध्यान से।", en: "She coloured the sun yellow — slowly and carefully." },
        { scene: "🐶🎾", hi: "फिर मोती कुत्ता गेंद लेकर आया, “भौं-भौं, खेलो!”", en: "Then Moti the dog brought a ball, “Woof-woof, play!”" },
        { scene: "👧🙂🐶", hi: "मीरा बोली, “मोती, बस थोड़ी देर। तस्वीर पूरी करके खेलेंगे।”", en: "Meera said, “Moti, just a little while. We'll play when my picture is done.”" },
        { scene: "🌳🏠🌈", hi: "उसने एक पेड़ बनाया, एक घर बनाया और एक सुंदर इंद्रधनुष भी!", en: "She drew a tree, a house and a beautiful rainbow too!" },
        { scene: "🖼️👩", hi: "तस्वीर पूरी हो गई! माँ ने उसे दीवार पर लगा दिया।", en: "The picture was finished! Mother put it up on the wall." },
        { scene: "👧🐶🎾🌳", hi: "फिर मीरा और मोती ने बगीचे में ख़ूब खेला। काम पूरा हुआ, तो खेल में और भी मज़ा आया!", en: "Then Meera and Moti played and played in the garden. With the work done, playing was even more fun!" }
      ],
      questions: [
        { q: { hi: "तितली आई, तो मीरा ने क्या किया?", en: "When the butterfly came, what did Meera do?" },
          choices: [ { emoji: "🏃", hi: "तस्वीर छोड़ दी", en: "Left her picture" }, { emoji: "🖍️", hi: "तस्वीर पूरी की", en: "Finished her picture" } ], answer: 1 },
        { q: { hi: "मीरा ने सबसे पहले क्या बनाया?", en: "What did Meera draw first?" },
          choices: [ { emoji: "☀️", hi: "सूरज", en: "The sun" }, { emoji: "🚗", hi: "गाड़ी", en: "A car" }, { emoji: "🐟", hi: "मछली", en: "A fish" } ], answer: 0 }
      ],
      mission: { emoji: "🖍️", hi: "आज एक तस्वीर बनाओ, उसे पूरा करो और किसी बड़े को दिखाओ।", en: "Today draw a picture, finish it, and show it to a grown-up." }
    },
    {
      id: "kuku", cover: "🐢", color: "#26A69A",
      title: { hi: "कुकू और चीकू स्कूल में", en: "Kuku and Cheeku at School" },
      pages: [
        { scene: "🏫🐢🐇", hi: "जंगल के स्कूल में कुकू कछुआ और चीकू खरगोश साथ पढ़ते थे।", en: "Kuku the turtle and Cheeku the rabbit went to the forest school together." },
        { scene: "🦉📚", hi: "उल्लू दीदी बोलीं, “आज हम गिनती सीखेंगे — एक से पाँच तक!”", en: "Owl Didi said, “Today we'll learn to count — from one to five!”" },
        { scene: "🐇🦋", hi: "चीकू खिड़की से बाहर तितली देखने लगा।", en: "Cheeku started watching a butterfly outside the window." },
        { scene: "🐢👂", hi: "कुकू ने ध्यान से सुना — “एक, दो, तीन, चार, पाँच!”", en: "Kuku listened carefully — “one, two, three, four, five!”" },
        { scene: "🌳🥭🥭🥭", hi: "उल्लू दीदी ने पूछा, “बताओ, पेड़ पर कितने आम हैं?”", en: "Owl Didi asked, “Tell me, how many mangoes are on the tree?”" },
        { scene: "🐢☝️", hi: "कुकू ने धीरे-धीरे गिना, “एक, दो, तीन… तीन आम!” “शाबाश, कुकू!”", en: "Kuku counted slowly, “One, two, three… three mangoes!” “Well done, Kuku!”" },
        { scene: "🐇🤔🐢", hi: "चीकू बोला, “मुझे भी सिखाओ ना!” कुकू ने प्यार से उसके साथ गिनती की।", en: "Cheeku said, “Please teach me too!” Kuku happily counted with him." },
        { scene: "🐢🐇🏃", hi: "छुट्टी में चीकू ने कुकू को तेज़ दौड़ना सिखाया। दोनों पक्के दोस्त बन गए!", en: "At playtime Cheeku taught Kuku to run fast. They became best friends!" }
      ],
      questions: [
        { q: { hi: "उल्लू दीदी की बात किसने ध्यान से सुनी?", en: "Who listened carefully to Owl Didi?" },
          choices: [ { emoji: "🐢", hi: "कुकू कछुआ", en: "Kuku the turtle" }, { emoji: "🐇", hi: "चीकू खरगोश", en: "Cheeku the rabbit" } ], answer: 0 },
        { q: { hi: "पेड़ पर कितने आम थे?", en: "How many mangoes were on the tree?" },
          choices: [ { emoji: "🥭", hi: "एक", en: "One" }, { emoji: "🥭🥭🥭", hi: "तीन", en: "Three" }, { emoji: "🥭🥭", hi: "दो", en: "Two" } ], answer: 1 }
      ],
      mission: { emoji: "🔢", hi: "आज घर में कोई तीन चीज़ें गिनो — जैसे तीन चम्मच या तीन जूते!", en: "Today count three things at home — like three spoons or three shoes!" }
    },
    {
      id: "beej", cover: "🌱", color: "#66BB6A",
      title: { hi: "नन्हा बीज", en: "The Little Seed" },
      pages: [
        { scene: "👵🌰👦", hi: "दादी ने अमन को एक छोटा-सा बीज दिया।", en: "Grandma gave Aman a tiny seed." },
        { scene: "👦🪴💧", hi: "अमन ने उसे गमले में बोया और थोड़ा पानी डाला।", en: "Aman planted it in a pot and gave it a little water." },
        { scene: "👦❓🪴", hi: "अगली सुबह अमन दौड़कर आया, “अरे! अभी तक कुछ नहीं उगा?”", en: "Next morning Aman ran to look, “Oh! Nothing has grown yet?”" },
        { scene: "👵🙂", hi: "दादी हँसीं, “बीज रोज़ थोड़ा-थोड़ा बढ़ता है, मिट्टी के अंदर। धीरज रखो।”", en: "Grandma laughed, “A seed grows a little every day, under the soil. Be patient.”" },
        { scene: "☀️💧🪴", hi: "अमन रोज़ सुबह पानी डालता और गमले को धूप में रखता।", en: "Every morning Aman watered it and put the pot in the sun." },
        { scene: "🌱😮", hi: "एक दिन मिट्टी से एक नन्हा हरा पत्ता झाँका!", en: "One day a tiny green leaf peeped out of the soil!" },
        { scene: "🌿🌿", hi: "रोज़ थोड़ा-थोड़ा… पत्ते बढ़ते गए, पौधा बड़ा होता गया।", en: "A little every day… more leaves came, and the plant grew bigger." },
        { scene: "🌼👦👵", hi: "और एक सुबह — पीला फूल खिल गया! अमन बोला, “रोज़ थोड़ा-थोड़ा, और देखो कितना सुंदर!”", en: "And one morning — a yellow flower bloomed! Aman said, “A little every day, and look how beautiful!”" }
      ],
      questions: [
        { q: { hi: "बीज कैसे बढ़ता है?", en: "How does a seed grow?" },
          choices: [ { emoji: "🌱", hi: "रोज़ थोड़ा-थोड़ा", en: "A little every day" }, { emoji: "⚡", hi: "एक ही पल में", en: "All at once" } ], answer: 0 },
        { q: { hi: "पौधे को बढ़ने के लिए क्या चाहिए?", en: "What does a plant need to grow?" },
          choices: [ { emoji: "🍫", hi: "चॉकलेट", en: "Chocolate" }, { emoji: "☀️💧", hi: "धूप और पानी", en: "Sun and water" } ], answer: 1 }
      ],
      mission: { emoji: "💧", hi: "आज किसी पौधे को थोड़ा पानी दो — और रोज़ देखो वह कैसे बढ़ता है।", en: "Today give a plant a little water — and watch it grow, day by day." }
    },
    {
      id: "arya", cover: "🩺", color: "#5C6BC0",
      title: { hi: "आर्या का सपना", en: "Arya's Dream" },
      pages: [
        { scene: "👧🩺🧸", hi: "आर्या डॉक्टर बनना चाहती है। वह अपने भालू की जाँच करती है, “आ… बोलो!”", en: "Arya wants to be a doctor. She checks her teddy, “Say aah!”" },
        { scene: "👧👩‍⚕️🏥", hi: "एक दिन वह डॉक्टर नसरीन से मिली। “आंटी, मैं डॉक्टर कैसे बनूँ?”", en: "One day she met Doctor Nasreen. “Auntie, how can I become a doctor?”" },
        { scene: "👩‍⚕️📚", hi: "डॉक्टर नसरीन मुस्कुराईं, “रोज़ थोड़ा-थोड़ा सीखो। डॉक्टर भी रोज़ कुछ नया पढ़ते हैं।”", en: "Doctor Nasreen smiled, “Learn a little every day. Doctors read something new every day too.”" },
        { scene: "🍎💧😴", hi: "“और अपना ध्यान रखो — अच्छा खाना, पानी और समय पर नींद।”", en: "“And take care of yourself — good food, water and sleep on time.”" },
        { scene: "👧🔢📖", hi: "आर्या ने रोज़ थोड़ी गिनती सीखी, थोड़े अक्षर सीखे।", en: "Every day Arya learned a little counting and a few letters." },
        { scene: "👦🩹👧", hi: "एक दिन भाई के घुटने पर चोट लगी। आर्या ने हाथ धोए और पट्टी लाने में माँ की मदद की।", en: "One day her brother hurt his knee. Arya washed her hands and helped Mother bring a bandage." },
        { scene: "👦😊👧", hi: "भाई मुस्कुराया, “तुम तो अभी से छोटी डॉक्टर हो!”", en: "Her brother smiled, “You're a little doctor already!”" },
        { scene: "👧🌙⭐", hi: "रात को आर्या ने सोचा, “रोज़ थोड़ा-थोड़ा सीखूँगी, और एक दिन डॉक्टर बनूँगी!”", en: "That night Arya thought, “I'll learn a little every day, and one day I'll be a doctor!”" }
      ],
      questions: [
        { q: { hi: "डॉक्टर बनने के लिए आर्या रोज़ क्या करती है?", en: "What does Arya do every day to become a doctor?" },
          choices: [ { emoji: "📖", hi: "थोड़ा सीखती है", en: "Learns a little" }, { emoji: "📺", hi: "सारा दिन टीवी", en: "Watches TV all day" } ], answer: 0 },
        { q: { hi: "आर्या ने भाई की मदद कैसे की?", en: "How did Arya help her brother?" },
          choices: [ { emoji: "⚽", hi: "गेंद फेंककर", en: "By throwing a ball" }, { emoji: "🩹", hi: "पट्टी लाकर", en: "By bringing a bandage" } ], answer: 1 }
      ],
      mission: { emoji: "💭", hi: "आज घर में किसी को बताओ — बड़े होकर तुम्हारा क्या सपना है?", en: "Today tell someone at home — what is your dream for when you grow up?" }
    },
    {
      id: "mintu", cover: "🐒", color: "#FB8C00",
      title: { hi: "मिंटू और सूरज घड़ी", en: "Mintu and the Sun Clock" },
      pages: [
        { scene: "🐒🌳❓", hi: "मिंटू बंदर को कभी पता ही नहीं चलता था कि कब क्या करना है।", en: "Mintu the monkey never knew when to do what." },
        { scene: "🐒🍌🌙", hi: "वह आधी रात को केले खाता और दोपहर में सो जाता!", en: "He ate bananas at midnight and slept at noon!" },
        { scene: "🦉🌳", hi: "उल्लू नानी बोलीं, “मिंटू, सूरज को देखो। सूरज हमारी घड़ी है।”", en: "Owl Nani said, “Mintu, look at the sun. The sun is our clock.”" },
        { scene: "🌅🐒🍌", hi: "“सूरज उगे — तो उठो, मुँह धोओ और नाश्ता करो।”", en: "“When the sun rises — wake up, wash your face and eat breakfast.”" },
        { scene: "☀️🐒⚽", hi: "“सूरज सिर के ऊपर — तो खाना खाओ, खेलो और सीखो।”", en: "“When the sun is high — eat lunch, play and learn.”" },
        { scene: "🌇🐒📖", hi: "“सूरज ढले — तो घर आओ और कहानी सुनो।”", en: "“When the sun goes down — come home and listen to a story.”" },
        { scene: "🌙⭐🐒😴", hi: "“और चाँद-तारे आएँ — तो मीठी नींद सो जाओ।”", en: "“And when the moon and stars come out — have a sweet sleep.”" },
        { scene: "🐒😄🌞", hi: "अब मिंटू रोज़ सूरज को देखता है। वह दिन भर ताज़ा रहता है और ख़ूब खेलता है!", en: "Now Mintu watches the sun every day. He feels fresh all day and plays a lot!" }
      ],
      questions: [
        { q: { hi: "सूरज उगे, तो क्या करें?", en: "When the sun rises, what do we do?" },
          choices: [ { emoji: "😴", hi: "सो जाएँ", en: "Go to sleep" }, { emoji: "🌅", hi: "उठें और नाश्ता करें", en: "Wake up and eat breakfast" } ], answer: 1 },
        { q: { hi: "चाँद-तारे आएँ, तो क्या करें?", en: "When the moon and stars come out, what do we do?" },
          choices: [ { emoji: "😴", hi: "सो जाएँ", en: "Go to sleep" }, { emoji: "🍌", hi: "केले खाएँ", en: "Eat bananas" } ], answer: 0 }
      ],
      mission: { emoji: "🌞", hi: "आज खिड़की से बाहर देखो — सूरज है या चाँद? अभी दिन है या रात?", en: "Today look out of the window — is it the sun or the moon? Is it day or night?" }
    },
    {
      id: "pihu", cover: "🧸", color: "#8D6E63",
      title: { hi: "पीहू और चंदा मामा", en: "Pihu and the Moon" },
      pages: [
        { scene: "🧸🚗🧩⚽", hi: "पीहू का कमरा खिलौनों से भरा था — भालू, गाड़ी, पज़ल, गेंद!", en: "Pihu's room was full of toys — teddy, car, puzzle, ball!" },
        { scene: "🌙👀", hi: "खिड़की से चंदा मामा ने झाँका, “पीहू, सोने का समय हो गया!”", en: "The Moon peeped through the window, “Pihu, it's time for bed!”" },
        { scene: "🧸💬", hi: "भालू बोला, “पर मैं फ़र्श पर कैसे सोऊँ? मुझे अपने डिब्बे में जाना है।”", en: "Teddy said, “But how can I sleep on the floor? I want to go to my box.”" },
        { scene: "👧🧺", hi: "पीहू बोली, “चलो, खेल-खेल में सबको घर पहुँचाते हैं!”", en: "Pihu said, “Let's make it a game and take everyone home!”" },
        { scene: "🚗📦⚽🧺", hi: "“गाड़ी — वूँ-वूँ — डिब्बे में! गेंद — टप-टप — टोकरी में!”", en: "“Car — vroom-vroom — into the box! Ball — bounce-bounce — into the basket!”" },
        { scene: "🧩👩👧", hi: "माँ ने भी मदद की। दोनों ने मिलकर पज़ल के टुकड़े गिने — एक, दो, तीन, चार!", en: "Mother helped too. Together they counted the puzzle pieces — one, two, three, four!" },
        { scene: "🧸😊🛏️", hi: "कमरा साफ़! भालू ख़ुश, गाड़ी ख़ुश और पीहू भी ख़ुश।", en: "The room is tidy! Teddy is happy, the car is happy, and Pihu is happy too." },
        { scene: "🌙😴👧", hi: "चंदा मामा मुस्कुराए, “शुभ रात्रि, पीहू!” और पीहू मीठी नींद सो गई।", en: "The Moon smiled, “Good night, Pihu!” And Pihu fell sweetly asleep." }
      ],
      questions: [
        { q: { hi: "सोने से पहले पीहू ने क्या किया?", en: "What did Pihu do before bed?" },
          choices: [ { emoji: "🧺", hi: "खिलौने समेटे", en: "Put her toys away" }, { emoji: "📺", hi: "टीवी देखा", en: "Watched TV" } ], answer: 0 },
        { q: { hi: "पीहू की मदद किसने की?", en: "Who helped Pihu?" },
          choices: [ { emoji: "🐘", hi: "हाथी ने", en: "An elephant" }, { emoji: "👩", hi: "माँ ने", en: "Mother" } ], answer: 1 }
      ],
      mission: { emoji: "🧸", hi: "आज सोने से पहले अपने खिलौनों को उनके “घर” पहुँचाओ!", en: "Tonight before bed, take your toys back to their “homes”!" }
    },
    {
      id: "munni", cover: "💧", color: "#42A5F5",
      title: { hi: "मुन्नी और पानी", en: "Munni and the Water" },
      pages: [
        { scene: "👧⚽☀️", hi: "मुन्नी धूप में ख़ूब खेल रही थी।", en: "Munni was playing and playing in the sun." },
        { scene: "👧😓", hi: "थोड़ी देर में वह थक गई। “मुझे तो बहुत थकान लग रही है।”", en: "After a while she felt tired. “I feel so tired.”" },
        { scene: "🌻👀", hi: "उसने देखा, बगीचे का सूरजमुखी भी झुका हुआ था।", en: "She saw that the sunflower in the garden was drooping too." },
        { scene: "👨‍🌾💧🌻", hi: "माली काका ने फूल को पानी दिया। थोड़ी देर में फूल फिर से सीधा खड़ा हो गया!", en: "Gardener Kaka watered the flower. Soon it stood up straight again!" },
        { scene: "👨‍🌾💬👧", hi: "काका बोले, “मुन्नी, तुम्हें भी पानी चाहिए। हमारा शरीर भी पौधे जैसा है।”", en: "Kaka said, “Munni, you need water too. Our body is like a plant.”" },
        { scene: "👧💧😊", hi: "मुन्नी ने गट-गट पानी पिया। “आहा! अब मैं फिर से ताज़ा हूँ!”", en: "Munni drank gulp-gulp. “Aha! Now I feel fresh again!”" },
        { scene: "👧💧⚽🌻", hi: "अब मुन्नी खेलते समय पानी की बोतल साथ रखती है — और सूरजमुखी को भी पानी देती है।", en: "Now Munni keeps her water bottle with her when she plays — and waters the sunflower too." }
      ],
      questions: [
        { q: { hi: "थकी हुई मुन्नी ने क्या किया?", en: "What did tired Munni do?" },
          choices: [ { emoji: "🍭", hi: "टॉफ़ी खाई", en: "Ate a sweet" }, { emoji: "💧", hi: "पानी पिया", en: "Drank water" } ], answer: 1 },
        { q: { hi: "फूल फिर से सीधा कैसे हुआ?", en: "How did the flower stand up again?" },
          choices: [ { emoji: "💧", hi: "उसे पानी मिला", en: "It got water" }, { emoji: "🌙", hi: "रात हो गई", en: "Night came" } ], answer: 0 }
      ],
      mission: { emoji: "💧", hi: "आज खेलने के बाद एक गिलास पानी पियो!", en: "Today, drink a glass of water after you play!" }
    }
  ];
})();
