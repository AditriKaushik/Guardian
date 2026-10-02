/* नन्हा स्कूल — content for "भविष्य की सैर" (Future Trip, modules/future.js) and the scenes of
   "जादुई खिड़की" (Magic Window, modules/magic.js). Pure data, no logic. Original text.

   Journey page: { bg, scene: [element…], text: {hi, en}, act?, min? }
     element: { e: emoji | p: prop, x, y (centre, % of the picture), s (size, % of its width),
                id?, name?: {hi, en} (tap → spoken), a?: animation, hidden? }
       props (drawn by future.js): panel (solar panel), battery, charger, drone, printer, bin,
       lander, rover, moon
       a: float | spin | drive | fly | pulse | twinkle
     act (a tiny interaction on the page):
       { type: "tap", target: id, times, prompt, done, steps?: [[{id, e?, level?, show?}…] per tap],
         after?: [{id, e?, a?, show?, hide?}] }
       { type: "choose", prompt, options: [{e, hi, en}], answer: index | "any", done, wrong? }
       { type: "sort", prompt, bins: [{id, e, color, hi, en}], items: [{e, hi, en, bin}], done }
     min: "4-5" — the page is skipped for 2–3 year olds (shorter trip).
   quiz: [{ q, options: [{e, hi, en}], answer, why }]   mission: { e, hi, en } (off-screen)
   bg: sky city space night sea farm hospital home garden screen lab */
(function () {
  "use strict";
  var NS = window.NS || (window.NS = {});
  NS.content = NS.content || {};

  var journeys = [
    /* ------------------------------------------------------------ 1. सूरज की बिजली */
    {
      id: "solar", icon: "☀️", color: "#FFB300", sticker: "☀️",
      title: { hi: "सूरज की बिजली", en: "Power from the Sun", hinglish: "Sooraj ki bijli" },
      pages: [
        { bg: "sky", scene: [
          { e: "☀️", id: "sun", x: 78, y: 22, s: 22, a: "spin", name: { hi: "सूरज", en: "the Sun" } },
          { e: "🏠", x: 34, y: 66, s: 26, name: { hi: "घर", en: "a house" } },
          { e: "🌳", x: 70, y: 70, s: 20, name: { hi: "पेड़", en: "a tree" } },
          { e: "☁️", x: 20, y: 18, s: 14, a: "float" } ],
          text: { hi: "देखो, सूरज चमक रहा है! सूरज हमें रोशनी और गर्मी देता है।", en: "Look, the Sun is shining! The Sun gives us light and warmth." } },
        { bg: "sky", scene: [
          { e: "☀️", x: 82, y: 18, s: 18, a: "spin", name: { hi: "सूरज", en: "the Sun" } },
          { e: "🏠", x: 40, y: 68, s: 30 },
          { p: "panel", x: 40, y: 42, s: 30, name: { hi: "सोलर पैनल", en: "a solar panel" } } ],
          text: { hi: "घर की छत पर नीली चमकती प्लेटें हैं। इन्हें सोलर पैनल कहते हैं — ये धूप पकड़ते हैं!", en: "On the roof are shiny blue plates. They're called solar panels — they catch sunshine!" } },
        { bg: "sky", scene: [
          { e: "☀️", id: "sun", x: 22, y: 24, s: 24, a: "pulse", name: { hi: "सूरज", en: "the Sun" } },
          { p: "panel", x: 56, y: 52, s: 30 },
          { p: "battery", id: "bat", x: 84, y: 66, s: 14, level: 0, name: { hi: "बैटरी", en: "the battery" } } ],
          text: { hi: "सोलर पैनल धूप से बिजली बनाता है, और बिजली बैटरी में जमा होती है।", en: "The solar panel turns sunshine into electricity, and the battery stores it." },
          act: { type: "tap", target: "sun", times: 3,
            prompt: { hi: "सूरज को तीन बार छुओ और धूप भेजो!", en: "Tap the Sun three times to send sunshine!" },
            steps: [[{ id: "bat", level: 0.34 }], [{ id: "bat", level: 0.67 }], [{ id: "bat", level: 1 }]],
            done: { hi: "धूप से बिजली बन गई! बैटरी भर गई।", en: "Sunshine made electricity! The battery is full." } } },
        { bg: "home", scene: [
          { e: "💡", id: "bulb", x: 30, y: 26, s: 18, name: { hi: "बल्ब", en: "a light bulb" } },
          { e: "📺", x: 66, y: 56, s: 22, name: { hi: "टीवी", en: "a TV" } },
          { p: "battery", x: 18, y: 72, s: 12, level: 1 },
          { e: "🛋️", x: 40, y: 80, s: 22 } ],
          text: { hi: "अब इसी बिजली से बल्ब जलता है और टीवी चलता है — बिना धुएँ के!", en: "Now this electricity lights the bulb and runs the TV — with no smoke!" } },
        { bg: "farm", min: "4-5", scene: [
          { e: "☀️", x: 84, y: 16, s: 16, a: "spin" },
          { p: "panel", x: 26, y: 52, s: 26 },
          { e: "🧑‍🌾", x: 56, y: 62, s: 20, name: { hi: "किसान", en: "a farmer" } },
          { e: "💧", x: 74, y: 70, s: 10, a: "pulse" },
          { e: "🌾", x: 86, y: 76, s: 16 }, { e: "🌾", x: 66, y: 82, s: 14 } ],
          text: { hi: "खेत में सोलर पंप ज़मीन से पानी निकालता है। किसान ख़ुश, पौधे ख़ुश!", en: "On the farm, a solar pump brings up water. Happy farmer, happy plants!" } },
        { bg: "night", scene: [
          { e: "🌙", x: 80, y: 20, s: 16, a: "float", name: { hi: "चाँद", en: "the Moon" } },
          { e: "🏠", x: 40, y: 64, s: 28 },
          { e: "💡", x: 40, y: 36, s: 12, a: "pulse" } ],
          text: { hi: "रात को सूरज नहीं होता। तो घर में बिजली कहाँ से आती है?", en: "There's no Sun at night. So where does the electricity come from?" },
          act: { type: "choose",
            prompt: { hi: "बताओ — बैटरी से, या चाँद से?", en: "Tell me — from the battery, or from the Moon?" },
            options: [{ e: "🔋", hi: "बैटरी से", en: "From the battery" }, { e: "🌙", hi: "चाँद से", en: "From the Moon" }], answer: 0,
            done: { hi: "हाँ! दिन में भरी बैटरी रात को बिजली देती है।", en: "Yes! The battery filled in the day gives power at night." },
            wrong: { hi: "चाँद बिजली नहीं देता! दिन में भरी बैटरी देती है।", en: "The Moon doesn't give electricity! The battery filled in the day does." } } },
        { bg: "sky", scene: [
          { e: "☀️", x: 50, y: 26, s: 26, a: "spin" },
          { p: "panel", x: 18, y: 72, s: 20 }, { p: "panel", x: 50, y: 74, s: 20 }, { p: "panel", x: 82, y: 72, s: 20 } ],
          text: { hi: "सूरज हर दिन आता है और कभी ख़त्म नहीं होता। आने वाले कल में और भी ज़्यादा घर सूरज की बिजली से चलेंगे!", en: "The Sun comes every day and never runs out. Tomorrow, more and more homes will run on sunshine!" } },
      ],
      quiz: [
        { q: { hi: "सोलर पैनल किससे बिजली बनाता है?", en: "What does a solar panel make electricity from?" },
          options: [{ e: "☀️", hi: "धूप से", en: "Sunshine" }, { e: "🌧️", hi: "बारिश से", en: "Rain" }, { e: "🍦", hi: "आइसक्रीम से", en: "Ice cream" }], answer: 0,
          why: { hi: "हाँ, धूप से! सोलर पैनल धूप पकड़ता है।", en: "Yes, sunshine! A solar panel catches the sunlight." } },
      ],
      mission: { e: "🌞", hi: "आज धूप में खड़े होकर अपनी परछाई देखो। सूरज को सीधे कभी मत देखना! फिर किसी बड़े के साथ ढूँढो — आस-पास कहीं सोलर पैनल है?", en: "Today, stand in the sunshine and look at your shadow. Never look straight at the Sun! Then, with a grown-up, look for solar panels nearby." },
    },

    /* ------------------------------------------------------------ 2. बिजली वाली गाड़ी */
    {
      id: "ev", icon: "🚗", color: "#43A047", sticker: "🚗",
      title: { hi: "बिजली वाली गाड़ी", en: "The Electric Car", hinglish: "Bijli wali gaadi" },
      pages: [
        { bg: "city", scene: [
          { e: "🚌", x: 36, y: 70, s: 28, a: "drive", name: { hi: "पुरानी बस", en: "an old bus" } },
          { e: "💨", id: "smoke", x: 66, y: 66, s: 18, a: "pulse" },
          { e: "😷", x: 84, y: 40, s: 14 } ],
          text: { hi: "पुरानी गाड़ियाँ पेट्रोल-डीज़ल पीती हैं और धुआँ छोड़ती हैं। खाँसी! खाँसी!", en: "Old cars and buses drink petrol and puff out smoke. Cough, cough!" } },
        { bg: "city", scene: [
          { e: "🚗", x: 46, y: 70, s: 30, name: { hi: "बिजली वाली गाड़ी", en: "an electric car" } },
          { e: "⚡", x: 46, y: 44, s: 14, a: "pulse" },
          { e: "🌳", x: 84, y: 64, s: 18 } ],
          text: { hi: "ये है बिजली वाली गाड़ी! इसमें पेट्रोल की टंकी नहीं, एक बड़ी बैटरी है।", en: "This is an electric car! It has a big battery instead of a petrol tank." } },
        { bg: "city", scene: [
          { e: "☀️", id: "sun", x: 16, y: 20, s: 22, a: "pulse", name: { hi: "सूरज", en: "the Sun" } },
          { p: "panel", x: 44, y: 34, s: 22 },
          { p: "charger", x: 54, y: 66, s: 12 },
          { e: "🚗", id: "car", x: 78, y: 72, s: 26 },
          { p: "battery", id: "bat", x: 78, y: 42, s: 12, level: 0.1 } ],
          text: { hi: "गाड़ी की बैटरी ख़ाली है। चलो, सूरज की बिजली से इसे चार्ज करें!", en: "The car's battery is empty. Let's charge it with sunshine power!" },
          act: { type: "tap", target: "sun", times: 3,
            prompt: { hi: "सूरज को छूकर गाड़ी चार्ज करो!", en: "Tap the Sun to charge the car!" },
            steps: [[{ id: "bat", level: 0.4 }], [{ id: "bat", level: 0.7 }], [{ id: "bat", level: 1 }]],
            after: [{ id: "car", a: "drive" }],
            done: { hi: "गाड़ी चार्ज हो गई! चलो, घूमने चलें — बिना धुएँ के।", en: "The car is charged! Let's go for a ride — with no smoke." } } },
        { bg: "city", scene: [
          { e: "🚗", x: 30, y: 72, s: 24, a: "drive" },
          { e: "🌸", x: 72, y: 74, s: 12 }, { e: "🐦", x: 70, y: 30, s: 12, a: "fly" }, { e: "🌳", x: 88, y: 64, s: 20 } ],
          text: { hi: "बिजली वाली गाड़ी चुपचाप चलती है — ना धुआँ, ना शोर। हवा साफ़ रहती है, चिड़िया भी ख़ुश!", en: "The electric car goes quietly — no smoke, no noise. The air stays clean, and the birds are happy too!" } },
        { bg: "city", min: "4-5", scene: [
          { e: "🛺", x: 20, y: 70, s: 20, name: { hi: "बिजली वाला ऑटो", en: "an electric auto-rickshaw" } },
          { e: "🚌", x: 52, y: 66, s: 24, name: { hi: "बिजली वाली बस", en: "an electric bus" } },
          { e: "🛵", x: 84, y: 72, s: 18, name: { hi: "बिजली वाला स्कूटर", en: "an electric scooter" } } ],
          text: { hi: "अब बिजली से ऑटो, बस और स्कूटर भी चलते हैं। इन्हें छूकर देखो!", en: "Now autos, buses and scooters run on electricity too. Tap them!" } },
        { bg: "night", scene: [
          { e: "🌙", x: 82, y: 18, s: 14 },
          { p: "charger", id: "plug", x: 32, y: 62, s: 14, name: { hi: "चार्जर", en: "the charger" } },
          { e: "🚗", x: 64, y: 72, s: 26 },
          { p: "battery", id: "bat", x: 64, y: 40, s: 10, level: 0.2 },
          { e: "💤", id: "zz", x: 80, y: 46, s: 12, a: "float", hidden: true } ],
          text: { hi: "रात को गाड़ी चार्जिंग पर आराम करती है — जैसे तुम सोकर फिर से ताज़ा हो जाते हो!", en: "At night the car rests on its charger — just like you sleep and wake up fresh!" },
          act: { type: "tap", target: "plug", times: 2,
            prompt: { hi: "चार्जर को छूकर गाड़ी को सुला दो!", en: "Tap the charger to put the car to bed!" },
            steps: [[{ id: "bat", level: 0.6 }], [{ id: "bat", level: 1 }, { id: "zz", show: true }]],
            done: { hi: "गाड़ी चार्ज हो रही है और आराम कर रही है। शुभ रात्रि, गाड़ी!", en: "The car is charging and resting. Good night, car!" } } },
        { bg: "garden", scene: [
          { e: "🚲", x: 30, y: 72, s: 24, a: "drive", name: { hi: "साइकिल", en: "a bicycle" } },
          { e: "🚶", x: 66, y: 70, s: 18, name: { hi: "पैदल चलना", en: "walking" } },
          { e: "☀️", x: 84, y: 18, s: 14 } ],
          text: { hi: "आने वाले कल में सड़कें शांत होंगी और हवा साफ़। और सबसे साफ़ सवारी? साइकिल और पैदल चलना!", en: "Tomorrow, roads will be quieter and the air cleaner. And the cleanest ride of all? Cycling and walking!" } },
      ],
      quiz: [
        { q: { hi: "किस गाड़ी से धुआँ नहीं निकलता?", en: "Which one makes no smoke?" },
          options: [{ e: "🔌🚗", hi: "बिजली वाली गाड़ी", en: "The electric car" }, { e: "💨🚚", hi: "धुएँ वाला ट्रक", en: "The smoky truck" }], answer: 0,
          why: { hi: "सही! बिजली वाली गाड़ी धुआँ नहीं छोड़ती।", en: "Right! An electric car makes no smoke." } },
      ],
      mission: { e: "🚶", hi: "आज किसी बड़े के साथ थोड़ा पैदल चलो, और गिनो — रास्ते में कितनी साइकिलें दिखीं?", en: "Today, take a little walk with a grown-up and count how many bicycles you see!" },
    },

    /* ------------------------------------------------------------ 3. ड्रोन डाकिया */
    {
      id: "drone", icon: "🚁", color: "#039BE5", sticker: "📦",
      title: { hi: "ड्रोन डाकिया", en: "The Drone Postman", hinglish: "Drone daakiya" },
      pages: [
        { bg: "sky", scene: [
          { p: "drone", x: 50, y: 40, s: 30, a: "fly", name: { hi: "ड्रोन", en: "a drone" } },
          { e: "🐦", x: 18, y: 26, s: 12, a: "fly", name: { hi: "चिड़िया", en: "a bird" } },
          { e: "✈️", x: 82, y: 18, s: 14, name: { hi: "हवाई जहाज़", en: "an aeroplane" } } ],
          text: { hi: "ऊपर क्या उड़ रहा है? ना चिड़िया, ना हवाई जहाज़ — ये ड्रोन है!", en: "What's flying up there? Not a bird, not a plane — it's a drone!" } },
        { bg: "sky", scene: [
          { p: "drone", id: "dr", x: 50, y: 60, s: 40 } ],
          text: { hi: "ड्रोन के चार छोटे पंखे बहुत तेज़ घूमते हैं — फ़र्र फ़र्र! और वह ऊपर उठ जाता है।", en: "A drone has four little fans that spin very fast — whirr whirr! — and up it goes." },
          act: { type: "tap", target: "dr", times: 3,
            prompt: { hi: "ड्रोन को तीन बार छुओ — पंखे घुमाओ!", en: "Tap the drone three times to spin its fans!" },
            steps: [[{ id: "dr", y: 52 }], [{ id: "dr", y: 40 }], [{ id: "dr", y: 26 }]],
            after: [{ id: "dr", a: "fly" }],
            done: { hi: "ड्रोन उड़ गया! फ़र्र फ़र्र!", en: "The drone is flying! Whirr whirr!" } } },
        { bg: "city", scene: [
          { p: "drone", x: 50, y: 22, s: 24, a: "fly" },
          { e: "📦", x: 50, y: 36, s: 10 },
          { e: "🏫", x: 18, y: 72, s: 22 }, { e: "🏥", x: 50, y: 72, s: 22 }, { e: "🏡", x: 82, y: 72, s: 22 } ],
          text: { hi: "दादी को दवा चाहिए। ड्रोन डाकिया दवा का डिब्बा लेकर आया है।", en: "Grandma needs her medicine. The drone postman has brought the parcel." },
          act: { type: "choose",
            prompt: { hi: "दादी का घर कौन-सा है? वो जिसके आगे बगीचा है!", en: "Which is Grandma's house? The one with a garden!" },
            options: [{ e: "🏫", hi: "स्कूल", en: "School" }, { e: "🏥", hi: "अस्पताल", en: "Hospital" }, { e: "🏡", hi: "बगीचे वाला घर", en: "House with a garden" }], answer: 2,
            done: { hi: "ड्रोन ने दवा पहुँचा दी! धन्यवाद, ड्रोन!", en: "The drone delivered the medicine! Thank you, drone!" },
            wrong: { hi: "ये दादी का घर नहीं है। बगीचे वाला घर ढूँढो!", en: "That's not Grandma's house. Find the house with a garden!" } } },
        { bg: "farm", min: "4-5", scene: [
          { e: "⛰️", x: 24, y: 50, s: 36 }, { e: "🏘️", x: 74, y: 70, s: 22 },
          { p: "drone", x: 52, y: 26, s: 22, a: "fly" }, { e: "💊", x: 52, y: 38, s: 8 } ],
          text: { hi: "ड्रोन पहाड़ों और दूर के गाँवों तक दवाइयाँ ले जाते हैं, जहाँ सड़क बहुत लंबी है।", en: "Drones carry medicines to mountains and faraway villages where the road is very long." } },
        { bg: "farm", scene: [
          { p: "drone", id: "dr", x: 50, y: 24, s: 24, name: { hi: "खेत का ड्रोन", en: "the farm drone" } },
          { e: "🌱", id: "p1", x: 24, y: 76, s: 14 }, { e: "🌱", id: "p2", x: 50, y: 78, s: 14 }, { e: "🌱", id: "p3", x: 76, y: 76, s: 14 },
          { e: "💧", id: "rain", x: 50, y: 50, s: 12, hidden: true, a: "pulse" } ],
          text: { hi: "खेत में ड्रोन ऊपर से देखता है कि कौन-से पौधे प्यासे हैं।", en: "On the farm, a drone looks from the sky to see which plants are thirsty." },
          act: { type: "tap", target: "dr", times: 3,
            prompt: { hi: "ड्रोन को छूकर पौधों को पानी दो!", en: "Tap the drone to water the plants!" },
            steps: [[{ id: "rain", show: true }, { id: "p1", e: "🌿" }], [{ id: "p2", e: "🌿" }], [{ id: "p3", e: "🌿" }]],
            after: [{ id: "rain", hide: true }],
            done: { hi: "पौधे हरे-भरे हो गए! शाबाश!", en: "The plants are green and happy! Well done!" } } },
        { bg: "city", scene: [
          { e: "🧑", x: 26, y: 70, s: 22, name: { hi: "ड्रोन चलाने वाले", en: "the drone pilot" } },
          { e: "🎮", x: 40, y: 72, s: 10 },
          { p: "drone", x: 66, y: 32, s: 24, a: "fly" } ],
          text: { hi: "ड्रोन को कोई इंसान चलाता है और नियम मानता है — किसी के घर में झाँकना नहीं!", en: "A person controls the drone and follows the rules — no peeking into anyone's home!" } },
        { bg: "sky", scene: [
          { p: "drone", x: 26, y: 34, s: 20, a: "fly" }, { p: "drone", x: 72, y: 24, s: 18, a: "fly" },
          { e: "🎁", x: 50, y: 70, s: 18, name: { hi: "तोहफ़ा", en: "a present" } } ],
          text: { hi: "आने वाले कल में आसमान में मददगार ड्रोन होंगे। तुम ड्रोन से किसे क्या भेजोगे?", en: "Tomorrow, helpful drones will fly in the sky. What would you send with a drone, and to whom?" } },
      ],
      quiz: [
        { q: { hi: "ड्रोन कैसे उड़ता है?", en: "How does a drone fly?" },
          options: [{ e: "🌀", hi: "घूमते पंखों से", en: "With spinning fans" }, { e: "🦶", hi: "पैरों से कूदकर", en: "By jumping on its feet" }], answer: 0,
          why: { hi: "हाँ! उसके पंखे घूमते हैं, फ़र्र फ़र्र!", en: "Yes! Its fans spin — whirr whirr!" } },
      ],
      mission: { e: "✈️", hi: "किसी बड़े के साथ काग़ज़ का हवाई जहाज़ बनाओ और देखो वो कितनी दूर उड़ता है!", en: "Make a paper plane with a grown-up and see how far it flies!" },
    },

    /* ------------------------------------------------------------ 4. अंतरिक्ष यात्रा */
    {
      id: "space", icon: "🚀", color: "#5E35B1", sticker: "🚀",
      title: { hi: "अंतरिक्ष यात्रा", en: "Trip to Space", hinglish: "Antariksh yatra" },
      pages: [
        { bg: "night", scene: [
          { p: "moon", x: 74, y: 24, s: 22, a: "float", name: { hi: "चाँद", en: "the Moon" } },
          { e: "⭐", x: 20, y: 18, s: 8, a: "twinkle" }, { e: "⭐", x: 40, y: 30, s: 6, a: "twinkle" }, { e: "✨", x: 56, y: 12, s: 8, a: "twinkle" },
          { e: "🏠", x: 30, y: 74, s: 22 } ],
          text: { hi: "रात को आसमान में चाँद और तारे दिखते हैं। क्या हम वहाँ जा सकते हैं?", en: "At night we see the Moon and stars. Can we go there?" } },
        { bg: "night", scene: [
          { e: "🚀", id: "rocket", x: 50, y: 64, s: 26, name: { hi: "रॉकेट", en: "the rocket" } },
          { e: "3️⃣", id: "count", x: 82, y: 24, s: 14 },
          { e: "🔥", id: "fire", x: 50, y: 88, s: 12, hidden: true, a: "pulse" } ],
          text: { hi: "हाँ! रॉकेट में बैठकर। रॉकेट बहुत तेज़ ऊपर जाता है।", en: "Yes! In a rocket. A rocket zooms up very fast." },
          act: { type: "tap", target: "rocket", times: 3,
            prompt: { hi: "रॉकेट को तीन बार छुओ — गिनती करो!", en: "Tap the rocket three times — count down!" },
            steps: [[{ id: "count", e: "2️⃣" }], [{ id: "count", e: "1️⃣" }, { id: "fire", show: true }], [{ id: "count", e: "🎉" }]],
            after: [{ id: "rocket", a: "launch" }, { id: "fire", a: "launch" }],
            done: { hi: "3… 2… 1… उड़ान! रॉकेट अंतरिक्ष की ओर!", en: "3… 2… 1… lift off! The rocket is off to space!" } } },
        { bg: "space", scene: [
          { p: "moon", x: 50, y: 96, s: 76 },
          { e: "✨", x: 26, y: 22, s: 8, a: "twinkle" }, { e: "⭐", x: 78, y: 16, s: 7, a: "twinkle" },
          { p: "lander", x: 50, y: 52, s: 22, name: { hi: "चंद्रयान", en: "Chandrayaan" } } ],
          text: { hi: "भारत के वैज्ञानिकों ने चंद्रयान भेजा। वह चाँद पर धीरे से उतरा — एक ऐसी जगह के पास, जहाँ पहले कोई नहीं उतरा था!", en: "Scientists in India sent Chandrayaan. It landed gently on the Moon — near a place where nobody had landed before!" } },
        { bg: "space", min: "4-5", scene: [
          { p: "moon", x: 50, y: 100, s: 84 },
          { p: "lander", x: 22, y: 56, s: 18 },
          { p: "rover", id: "rover", x: 46, y: 64, s: 16, name: { hi: "प्रज्ञान रोवर", en: "the Pragyan rover" } } ],
          text: { hi: "उसमें से एक छोटी गाड़ी निकली — प्रज्ञान रोवर। वह छह पहियों पर धीरे-धीरे चली और चाँद की मिट्टी को जाँचा।", en: "Out came a little rover named Pragyan. It rolled slowly on six wheels and studied the Moon's soil." },
          act: { type: "tap", target: "rover", times: 3,
            prompt: { hi: "रोवर को छूकर आगे चलाओ!", en: "Tap the rover to drive it forward!" },
            steps: [[{ id: "rover", x: 58 }], [{ id: "rover", x: 70 }], [{ id: "rover", x: 82 }]],
            done: { hi: "शाबाश! रोवर ने चाँद पर नए निशान बना दिए।", en: "Well done! The rover made new tracks on the Moon." } } },
        { bg: "space", scene: [
          { e: "🧑‍🚀", x: 40, y: 56, s: 28, a: "float", name: { hi: "अंतरिक्ष यात्री", en: "an astronaut" } },
          { e: "🌍", x: 80, y: 22, s: 16, a: "spin" } ],
          text: { hi: "अंतरिक्ष में साँस लेने वाली हवा नहीं है, इसलिए अंतरिक्ष यात्री ख़ास सूट पहनते हैं।", en: "There is no air to breathe in space, so astronauts wear special suits." },
          act: { type: "choose",
            prompt: { hi: "अंतरिक्ष में क्या पहनोगे — ख़ास सूट या टी-शर्ट?", en: "What will you wear in space — a special suit or a T-shirt?" },
            options: [{ e: "🧑‍🚀", hi: "ख़ास सूट", en: "A special suit" }, { e: "👕", hi: "टी-शर्ट", en: "A T-shirt" }], answer: 0,
            done: { hi: "सही! सूट में हवा भी है और गर्मी भी।", en: "Right! The suit has air inside and keeps you warm." },
            wrong: { hi: "टी-शर्ट में अंतरिक्ष में साँस नहीं ले पाओगे! ख़ास सूट चाहिए।", en: "You couldn't breathe in space in a T-shirt! You need a special suit." } } },
        { bg: "space", scene: [
          { e: "🔴", x: 62, y: 46, s: 40, a: "spin", name: { hi: "मंगल ग्रह", en: "planet Mars" } },
          { e: "🚀", x: 20, y: 70, s: 16, a: "fly" }, { e: "✨", x: 20, y: 20, s: 8, a: "twinkle" } ],
          text: { hi: "ये है मंगल ग्रह — लाल ग्रह! एक दिन इंसान वहाँ भी जाएँगे — शायद तुम भी!", en: "This is Mars — the red planet! One day people will go there too — maybe even you!" } },
        { bg: "space", scene: [
          { e: "🌏", x: 50, y: 50, s: 46, a: "spin", name: { hi: "हमारी धरती", en: "our Earth" } },
          { e: "✨", x: 16, y: 20, s: 8, a: "twinkle" }, { e: "⭐", x: 84, y: 78, s: 8, a: "twinkle" } ],
          text: { hi: "अंतरिक्ष से हमारी धरती नीली-हरी गेंद जैसी दिखती है। यही हमारा प्यारा घर है!", en: "From space, our Earth looks like a blue-green ball. It's our lovely home!" } },
      ],
      quiz: [
        { q: { hi: "चाँद पर जाने के लिए किसमें बैठेंगे?", en: "What will we ride to go to the Moon?" },
          options: [{ e: "🚀", hi: "रॉकेट", en: "A rocket" }, { e: "🚲", hi: "साइकिल", en: "A bicycle" }], answer: 0,
          why: { hi: "हाँ, रॉकेट! 3… 2… 1… उड़ान!", en: "Yes, a rocket! 3… 2… 1… lift off!" } },
        { q: { hi: "अंतरिक्ष यात्री ख़ास सूट क्यों पहनते हैं?", en: "Why do astronauts wear special suits?" },
          options: [{ e: "💨", hi: "वहाँ हवा नहीं है", en: "There's no air there" }, { e: "🎉", hi: "पार्टी के लिए", en: "For a party" }], answer: 0,
          why: { hi: "सही! अंतरिक्ष में साँस लेने वाली हवा नहीं है।", en: "Right! There's no air to breathe in space." } },
      ],
      mission: { e: "🌙", hi: "आज रात किसी बड़े के साथ चाँद को देखो। वो कैसा दिखा — गोल, आधा या पतला? कल फिर देखना — क्या बदला?", en: "Tonight, look at the Moon with a grown-up. Was it round, half or thin? Look again tomorrow — what changed?" },
    },

    /* ------------------------------------------------------------ 5. डॉक्टर के रोबो मददगार */
    {
      id: "helpers", icon: "🩺", color: "#00897B", sticker: "🩺",
      title: { hi: "डॉक्टर के रोबो मददगार", en: "Robot Helpers", hinglish: "Doctor ke robo madadgaar" },
      pages: [
        { bg: "hospital", scene: [
          { e: "🏥", x: 26, y: 56, s: 30 },
          { e: "🧑‍⚕️", x: 60, y: 64, s: 22, name: { hi: "डॉक्टर", en: "a doctor" } },
          { e: "👩‍⚕️", x: 82, y: 66, s: 20, name: { hi: "नर्स", en: "a nurse" } } ],
          text: { hi: "ये है अस्पताल। यहाँ डॉक्टर और नर्स सबका ख़याल रखते हैं।", en: "This is a hospital. Doctors and nurses take care of everyone here." } },
        { bg: "hospital", scene: [
          { e: "🤖", id: "bot", x: 22, y: 64, s: 22, name: { hi: "रोबो मददगार", en: "the robot helper" } },
          { e: "💊", x: 22, y: 44, s: 10 },
          { e: "🤒", x: 50, y: 64, s: 18 }, { e: "😀", x: 70, y: 64, s: 18 }, { e: "😴", x: 88, y: 64, s: 18 } ],
          text: { hi: "आज अस्पताल में एक रोबो मददगार भी है! वह दवा और खाना एक कमरे से दूसरे कमरे तक ले जाता है।", en: "Today the hospital has a robot helper too! It carries medicine and food from room to room." },
          act: { type: "choose",
            prompt: { hi: "रोबो को बताओ — दवा किसे चाहिए? जिसे बुख़ार है!", en: "Tell the robot — who needs the medicine? The one with a fever!" },
            options: [{ e: "🤒", hi: "बुख़ार वाला", en: "The one with a fever" }, { e: "😀", hi: "हँसता हुआ", en: "The smiling one" }, { e: "😴", hi: "सोता हुआ", en: "The sleeping one" }], answer: 0,
            done: { hi: "हाँ! रोबो ने बुख़ार वाले को दवा दे दी। जल्दी ठीक हो जाओ!", en: "Yes! The robot gave the medicine to the one with a fever. Get well soon!" },
            wrong: { hi: "इसे दवा नहीं चाहिए। जिसे बुख़ार है, उसे ढूँढो — थर्मामीटर वाला!", en: "This one doesn't need medicine. Find the one with a fever — with the thermometer!" } } },
        { bg: "hospital", min: "4-5", scene: [
          { e: "🧑‍⚕️", x: 30, y: 62, s: 24 },
          { e: "🦾", x: 64, y: 50, s: 26, name: { hi: "रोबो हाथ", en: "a robot arm" } },
          { e: "🔬", x: 84, y: 70, s: 14 } ],
          text: { hi: "कुछ रोबो हाथ बहुत स्थिर रहते हैं, ताकि डॉक्टर बहुत बारीक काम आराम से कर सकें।", en: "Some robot arms stay very steady, so doctors can do tiny, careful work." } },
        { bg: "hospital", scene: [
          { e: "🧑‍⚕️", x: 30, y: 60, s: 26, name: { hi: "डॉक्टर", en: "the doctor" } },
          { e: "💭", x: 44, y: 28, s: 16 },
          { e: "🤖", x: 72, y: 64, s: 20 } ],
          text: { hi: "पर रोबो अपने-आप फ़ैसला नहीं करता। डॉक्टर सोचते हैं और तय करते हैं — रोबो बस मदद करता है।", en: "But the robot doesn't decide on its own. The doctor thinks and decides — the robot just helps." } },
        { bg: "home", scene: [
          { e: "👴", x: 30, y: 62, s: 26, name: { hi: "दादाजी", en: "Grandpa" } },
          { e: "🤖", id: "bot", x: 72, y: 66, s: 22 },
          { e: "🥛", id: "glass", x: 72, y: 40, s: 10, hidden: true } ],
          text: { hi: "घर पर एक छोटा रोबो दादाजी को याद दिलाता है: 'दवा का समय!' और पानी भी लाता है।", en: "At home, a little robot reminds Grandpa, 'Time for medicine!' and brings water too." },
          act: { type: "tap", target: "bot", times: 1,
            prompt: { hi: "रोबो को छुओ — दादाजी के लिए पानी लाओ!", en: "Tap the robot to bring Grandpa some water!" },
            steps: [[{ id: "glass", show: true }, { id: "bot", x: 48 }]],
            done: { hi: "दादाजी ने पानी पिया और दवा ली। धन्यवाद, रोबो!", en: "Grandpa drank the water and took his medicine. Thank you, robot!" } } },
        { bg: "home", scene: [
          { e: "👵", x: 34, y: 60, s: 26 }, { e: "🤗", x: 62, y: 62, s: 24, a: "pulse" }, { e: "❤️", x: 48, y: 30, s: 12, a: "pulse" } ],
          text: { hi: "रोबो मदद कर सकता है। पर गले लगाना, प्यार करना और सच में ख़याल रखना — ये हम इंसान करते हैं!", en: "Robots can help. But hugging, loving and truly caring — that's what we people do!" } },
      ],
      quiz: [
        { q: { hi: "दादाजी को प्यार की झप्पी कौन देगा?", en: "Who will give Grandpa a loving hug?" },
          options: [{ e: "🧒", hi: "मैं", en: "Me" }, { e: "🤖", hi: "रोबो", en: "The robot" }], answer: 0,
          why: { hi: "हाँ, तुम! रोबो मदद करता है, पर प्यार की झप्पी तुम देते हो।", en: "Yes, you! A robot helps, but the hugs come from you." } },
      ],
      mission: { e: "🤗", hi: "आज घर में किसी बड़े की एक मदद करो — पानी लाओ या चप्पलें सजाओ — और उन्हें एक प्यारी झप्पी दो!", en: "Today, help a grown-up at home — bring water or tidy the shoes — and give them a big hug!" },
    },

    /* ------------------------------------------------------------ 6. बात करने वाले कंप्यूटर */
    {
      id: "talk", icon: "💬", color: "#8E24AA", sticker: "🗣️",
      title: { hi: "बात करने वाले कंप्यूटर", en: "Talking Computers", hinglish: "Baat karne wale computer" },
      pages: [
        { bg: "home", scene: [
          { e: "📱", x: 30, y: 58, s: 22, name: { hi: "फ़ोन", en: "a phone" } },
          { e: "🔊", x: 66, y: 60, s: 22, name: { hi: "बोलने वाला स्पीकर", en: "a talking speaker" } },
          { e: "💬", x: 48, y: 26, s: 16, a: "float" } ],
          text: { hi: "कुछ फ़ोन और स्पीकर हमारी बात सुन सकते हैं और जवाब भी दे सकते हैं।", en: "Some phones and speakers can listen to us and even answer back." } },
        { bg: "screen", scene: [
          { e: "📚", x: 20, y: 60, s: 20 }, { e: "📖", x: 40, y: 34, s: 14, a: "fly" }, { e: "📰", x: 60, y: 30, s: 12, a: "fly" },
          { e: "💻", x: 76, y: 62, s: 26, name: { hi: "कंप्यूटर", en: "the computer" } } ],
          text: { hi: "ये कंप्यूटर बहुत, बहुत सारी बातें पढ़कर सीखते हैं — किताबें, कहानियाँ, गाने!", en: "These computers learn by reading lots and lots of words — books, stories and songs!" } },
        { bg: "home", scene: [
          { e: "🧒", x: 26, y: 62, s: 24 }, { e: "🔊", x: 72, y: 62, s: 22 }, { e: "🌧️", x: 50, y: 24, s: 16 } ],
          text: { hi: "उससे साफ़-साफ़ पूछो, तभी वो ठीक से समझता है।", en: "Ask it clearly — that's how it understands you best." },
          act: { type: "choose",
            prompt: { hi: "कौन-सा सवाल साफ़ है? “वो क्या है?” या “आज बारिश होगी?”", en: "Which question is clear? “What's that?” or “Will it rain today?”" },
            options: [{ e: "👉❓", hi: "वो क्या है?", en: "What's that?" }, { e: "🌧️❓", hi: "आज बारिश होगी?", en: "Will it rain today?" }], answer: 1,
            done: { hi: "हाँ! साफ़ सवाल पूछा, तो साफ़ जवाब मिलेगा।", en: "Yes! A clear question gets a clear answer." },
            wrong: { hi: "'वो' मतलब क्या? कंप्यूटर समझ नहीं पाएगा। साफ़ सवाल चुनो!", en: "What is 'that'? The computer won't understand. Pick the clear question!" } } },
        { bg: "home", scene: [
          { e: "🔊", x: 30, y: 56, s: 22 }, { e: "💬", x: 52, y: 30, s: 14 }, { e: "🐱", x: 74, y: 62, s: 24, name: { hi: "बिल्ली", en: "a cat" } } ],
          text: { hi: "कंप्यूटर बहुत सी बातें पढ़कर सीखता है, पर वह भी गलती कर सकता है!", en: "The computer learns by reading lots of things, but it can make mistakes too!" },
          act: { type: "choose",
            prompt: { hi: "स्पीकर ने कहा: “बिल्ली भौं-भौं करती है!” — सही या गलत?", en: "The speaker said: “Cats say woof woof!” — right or wrong?" },
            options: [{ e: "✅", hi: "सही", en: "Right" }, { e: "❌", hi: "गलत", en: "Wrong" }], answer: 1,
            done: { hi: "हाँ, गलत! बिल्ली तो म्याऊँ करती है। कंप्यूटर ने गलती की — तुमने पकड़ ली!", en: "Yes, wrong! Cats say meow. The computer made a mistake — and you caught it!" },
            wrong: { hi: "सोचो — बिल्ली कैसे बोलती है? म्याऊँ! तो कंप्यूटर ने गलती की।", en: "Think — what does a cat say? Meow! So the computer made a mistake." } } },
        { bg: "home", scene: [
          { e: "🧒", x: 30, y: 62, s: 22 }, { e: "🤔", x: 30, y: 30, s: 14 }, { e: "👩", x: 70, y: 60, s: 26, name: { hi: "मम्मी", en: "Mummy" } } ],
          text: { hi: "इसलिए वो जो भी कहे, उस पर सोचो — और किसी बड़े से भी पूछ लो।", en: "So think about whatever it says — and check with a grown-up too." } },
        { bg: "screen", min: "4-5", scene: [
          { e: "💻", x: 50, y: 54, s: 30 }, { e: "🍔", x: 18, y: 26, s: 12 }, { e: "😴", x: 82, y: 26, s: 12 }, { e: "🔌", x: 50, y: 86, s: 10 } ],
          text: { hi: "कंप्यूटर इंसान नहीं है। उसे भूख नहीं लगती, नींद नहीं आती — वो एक मशीन है, एक औज़ार, जैसे पेंसिल या कैंची।", en: "A computer isn't a person. It doesn't get hungry or sleepy — it's a machine, a tool, like a pencil or scissors." } },
        { bg: "screen", scene: [
          { e: "🔒", x: 50, y: 50, s: 24, a: "pulse" }, { e: "🏠", x: 20, y: 70, s: 14 }, { e: "📷", x: 80, y: 70, s: 14 } ],
          text: { hi: "अपना पूरा नाम, घर का पता या फ़ोटो किसी मशीन को मत बताओ — पहले बड़ों से पूछो।", en: "Don't tell a machine your full name, address or photos — ask a grown-up first." } },
      ],
      quiz: [
        { q: { hi: "क्या कंप्यूटर भी गलती कर सकता है?", en: "Can a computer make mistakes?" },
          options: [{ e: "👍", hi: "हाँ", en: "Yes" }, { e: "👎", hi: "नहीं", en: "No" }], answer: 0,
          why: { hi: "हाँ! इसलिए हम सोचते हैं और बड़ों से पूछते हैं।", en: "Yes! That's why we think and ask grown-ups." } },
        { q: { hi: "कंप्यूटर क्या है?", en: "What is a computer?" },
          options: [{ e: "🛠️", hi: "एक मशीन, एक औज़ार", en: "A machine, a tool" }, { e: "🧒", hi: "एक इंसान", en: "A person" }], answer: 0,
          why: { hi: "सही! कंप्यूटर एक मशीन है — इंसान नहीं।", en: "Right! A computer is a machine — not a person." } },
      ],
      mission: { e: "❓", hi: "आज किसी बड़े से एक ऐसा सवाल पूछो जिसका जवाब तुम्हें नहीं पता — और साथ में जवाब ढूँढो!", en: "Today, ask a grown-up a question you don't know the answer to — and find the answer together!" },
    },

    /* ------------------------------------------------------------ 7. पानी बचाओ, पेड़ लगाओ */
    {
      id: "green", icon: "🌱", color: "#2E7D32", sticker: "🌳",
      title: { hi: "पानी बचाओ, पेड़ लगाओ", en: "Save Water, Plant Trees", hinglish: "Paani bachao, ped lagao" },
      pages: [
        { bg: "space", scene: [
          { e: "🌍", x: 50, y: 50, s: 46, a: "spin", name: { hi: "धरती", en: "the Earth" } }, { e: "💚", x: 80, y: 20, s: 12, a: "pulse" } ],
          text: { hi: "हमारी धरती हमारा घर है। उसे साफ़ और हरा रखना हम सबका काम है!", en: "The Earth is our home. Keeping it clean and green is everyone's job!" } },
        { bg: "home", scene: [
          { e: "🚰", id: "tap", x: 46, y: 36, s: 24, name: { hi: "नल", en: "the tap" } },
          { e: "💧", id: "drip", x: 50, y: 58, s: 12, a: "pulse" },
          { e: "💦", x: 50, y: 82, s: 14 } ],
          text: { hi: "अरे! नल खुला छूट गया। टप-टप-टप, पानी बह रहा है!", en: "Oh no! The tap was left open. Drip, drip, drip — water is running away!" },
          act: { type: "tap", target: "tap", times: 1,
            prompt: { hi: "नल को छूकर बंद करो!", en: "Tap the tap to turn it off!" },
            steps: [[{ id: "drip", hide: true }]],
            done: { hi: "शाबाश! तुमने पानी बचाया।", en: "Well done! You saved water." } } },
        { bg: "home", min: "4-5", scene: [
          { e: "🪥", x: 34, y: 52, s: 22, name: { hi: "टूथब्रश", en: "a toothbrush" } }, { e: "🚰", x: 70, y: 40, s: 20 }, { e: "🚫💧", x: 70, y: 70, s: 12 } ],
          text: { hi: "दाँत साफ़ करते समय नल बंद रखो। एक बार में बाल्टी भर पानी बचता है!", en: "Keep the tap off while you brush. You can save a whole bucket of water!" } },
        { bg: "garden", scene: [
          { p: "bin", x: 28, y: 70, s: 20, color: "#2E9D4A" }, { p: "bin", x: 72, y: 70, s: 20, color: "#1E88E5" } ],
          text: { hi: "कचरा भी सही डिब्बे में जाता है। गीला कचरा हरे डिब्बे में, सूखा कचरा नीले डिब्बे में।", en: "Rubbish goes in the right bin too. Wet waste in the green bin, dry waste in the blue bin." },
          act: { type: "sort",
            prompt: { hi: "हर चीज़ को सही डिब्बे में डालो — हरा या नीला?", en: "Put each thing in the right bin — green or blue?" },
            bins: [{ id: "wet", e: "🟢", color: "#2E9D4A", hi: "गीला कचरा", en: "Wet waste" }, { id: "dry", e: "🔵", color: "#1E88E5", hi: "सूखा कचरा", en: "Dry waste" }],
            items: [
              { e: "🍌", hi: "केले का छिलका", en: "banana peel", bin: "wet" },
              { e: "📰", hi: "पुराना अख़बार", en: "old newspaper", bin: "dry" },
              { e: "🍎", hi: "सेब का बचा टुकड़ा", en: "apple core", bin: "wet" },
              { e: "🧴", hi: "प्लास्टिक की बोतल", en: "plastic bottle", bin: "dry" } ],
            done: { hi: "वाह! सारा कचरा सही डिब्बे में!", en: "Wow! All the rubbish is in the right bin!" } } },
        { bg: "lab", min: "4-5", scene: [
          { e: "🧴", x: 20, y: 56, s: 16 }, { e: "♻️", x: 50, y: 50, s: 24, a: "spin", name: { hi: "रीसायकल", en: "recycling" } }, { e: "🪑", x: 80, y: 56, s: 18 } ],
          text: { hi: "पुरानी प्लास्टिक की बोतलें फिर से नई चीज़ें बन सकती हैं — कुर्सी, थैला, खिलौना! इसे रीसायकल कहते हैं।", en: "Old plastic bottles can become new things — a chair, a bag, a toy! That's called recycling." } },
        { bg: "garden", scene: [
          { e: "🌰", id: "plant", x: 50, y: 74, s: 16, name: { hi: "बीज", en: "a seed" } },
          { e: "💧", id: "water", x: 50, y: 30, s: 16, a: "float", name: { hi: "पानी", en: "water" } } ],
          text: { hi: "चलो, एक पेड़ लगाएँ! बीज को पानी चाहिए।", en: "Let's plant a tree! The seed needs water." },
          act: { type: "tap", target: "water", times: 3,
            prompt: { hi: "पानी को तीन बार छुओ और बीज को सींचो!", en: "Tap the water three times to water the seed!" },
            steps: [[{ id: "plant", e: "🌱" }], [{ id: "plant", e: "🌿" }], [{ id: "plant", e: "🌳", s: 40, y: 58 }]],
            after: [{ id: "water", hide: true }],
            done: { hi: "देखो! बीज से पौधा, और पौधे से पेड़ बन गया!", en: "Look! The seed became a plant, and the plant became a tree!" } } },
        { bg: "garden", scene: [
          { e: "🌳", x: 40, y: 56, s: 40 }, { e: "🍎", x: 34, y: 44, s: 8 }, { e: "🐦", x: 52, y: 30, s: 10, a: "fly" }, { e: "🧒", x: 78, y: 70, s: 18 } ],
          text: { hi: "पेड़ हमें छाया, फल और साफ़ हवा देते हैं। आओ, आने वाले कल को हरा-भरा बनाएँ!", en: "Trees give us shade, fruit and clean air. Let's make tomorrow green!" } },
      ],
      quiz: [
        { q: { hi: "केले का छिलका किस डिब्बे में जाएगा?", en: "Which bin does a banana peel go in?" },
          options: [{ e: "🟢", hi: "हरा — गीला कचरा", en: "Green — wet waste" }, { e: "🔵", hi: "नीला — सूखा कचरा", en: "Blue — dry waste" }], answer: 0,
          why: { hi: "सही! छिलका गीला कचरा है — हरे डिब्बे में।", en: "Right! A peel is wet waste — the green bin." } },
      ],
      mission: { e: "🌻", hi: "आज किसी पौधे को पानी दो, और दाँत साफ़ करते समय नल बंद रखना!", en: "Today, water a plant — and keep the tap off while you brush!" },
    },

    /* ------------------------------------------------------------ 8. 3D प्रिंटर */
    {
      id: "printer", icon: "🧊", color: "#F4511E", sticker: "🛠️",
      title: { hi: "3D प्रिंटर", en: "The 3D Printer", hinglish: "3D printer" },
      pages: [
        { bg: "lab", scene: [
          { p: "printer", x: 50, y: 56, s: 40, level: 0, name: { hi: "3D प्रिंटर", en: "a 3D printer" } } ],
          text: { hi: "ये है एक कमाल की मशीन — 3D प्रिंटर! ये चीज़ें बनाता है, परत पर परत।", en: "This is an amazing machine — a 3D printer! It builds things, layer on layer." } },
        { bg: "lab", scene: [
          { p: "printer", id: "pr", x: 50, y: 56, s: 44, level: 0 } ],
          text: { hi: "चलो, प्रिंटर से एक खिलौना बनाएँ!", en: "Let's make a toy with the printer!" },
          act: { type: "tap", target: "pr", times: 4,
            prompt: { hi: "प्रिंटर को चार बार छुओ — हर बार एक परत जुड़ेगी!", en: "Tap the printer four times — each tap adds a layer!" },
            steps: [[{ id: "pr", level: 0.25 }], [{ id: "pr", level: 0.5 }], [{ id: "pr", level: 0.75 }], [{ id: "pr", level: 1 }]],
            done: { hi: "देखो, परत पर परत से एक मीनार बन गई!", en: "Look — layer on layer, a tower is ready!" } } },
        { bg: "lab", scene: [
          { e: "📝", x: 26, y: 50, s: 22, name: { hi: "चित्र", en: "a design" } }, { e: "➡️", x: 50, y: 50, s: 12 }, { p: "printer", x: 76, y: 56, s: 30, level: 0.6 } ],
          text: { hi: "पहले कोई चित्र बनाता है — क्या बनाना है। फिर प्रिंटर उसे सच में बना देता है।", en: "First someone draws a design — what to make. Then the printer makes it for real." } },
        { bg: "lab", min: "4-5", scene: [
          { e: "🧸", x: 20, y: 56, s: 18, name: { hi: "खिलौने का हिस्सा", en: "a toy part" } }, { e: "🦾", x: 50, y: 50, s: 20, name: { hi: "मदद वाला हाथ", en: "a helper hand" } }, { e: "🏠", x: 80, y: 56, s: 20, name: { hi: "छोटा घर", en: "a small house" } } ],
          text: { hi: "3D प्रिंटर से टूटे खिलौने का हिस्सा, किसी के लिए मदद वाला हाथ, यहाँ तक कि छोटे घर भी बन सकते हैं!", en: "3D printers can make a missing toy piece, a helper hand for someone, even small houses!" } },
        { bg: "lab", scene: [
          { p: "printer", x: 50, y: 56, s: 34, level: 0.3 }, { e: "💭", x: 80, y: 22, s: 14 } ],
          text: { hi: "अगर तुम्हारे पास 3D प्रिंटर होता, तो तुम क्या बनाते?", en: "If you had a 3D printer, what would you make?" },
          act: { type: "choose",
            prompt: { hi: "चुनो — गाड़ी, डायनासोर या घर?", en: "Choose — a car, a dinosaur or a house?" },
            options: [{ e: "🚗", hi: "गाड़ी", en: "A car" }, { e: "🦕", hi: "डायनासोर", en: "A dinosaur" }, { e: "🏠", hi: "घर", en: "A house" }], answer: "any",
            done: { hi: "वाह! बढ़िया चुना। अब प्रिंटर परत पर परत उसे बनाएगा!", en: "Wow! Great choice. Now the printer will build it layer by layer!" } } },
        { bg: "lab", scene: [
          { e: "🧒", x: 30, y: 60, s: 26 }, { e: "💡", x: 30, y: 28, s: 14, a: "pulse" }, { p: "printer", x: 72, y: 60, s: 26, level: 1 } ],
          text: { hi: "पर पहले सोचना पड़ता है। बनाने वाले तुम हो — मशीन बस मदद करती है!", en: "But first you have to think. You are the maker — the machine just helps!" } },
      ],
      quiz: [
        { q: { hi: "3D प्रिंटर चीज़ें कैसे बनाता है?", en: "How does a 3D printer make things?" },
          options: [{ e: "🥞", hi: "परत पर परत", en: "Layer on layer" }, { e: "✨", hi: "जादू से", en: "By magic" }], answer: 0,
          why: { hi: "हाँ! परत पर परत, जैसे पराठे की परतें।", en: "Yes! Layer on layer, like a stack of pancakes." } },
      ],
      mission: { e: "🧱", hi: "आज ब्लॉक, मिट्टी या आटे से परत-पर-परत एक मीनार बनाओ। कितनी ऊँची बनी?", en: "Today, build a tower layer by layer with blocks, clay or dough. How tall did it get?" },
    },

    /* ------------------------------------------------------------ 9. इंटरनेट पर सुरक्षा */
    {
      id: "safe", icon: "🛡️", color: "#3949AB", sticker: "🛡️",
      title: { hi: "इंटरनेट पर सुरक्षा", en: "Safe on the Internet", hinglish: "Internet par suraksha" },
      pages: [
        { bg: "screen", scene: [
          { e: "🌐", x: 50, y: 44, s: 30, a: "spin", name: { hi: "इंटरनेट", en: "the internet" } },
          { e: "🎵", x: 18, y: 24, s: 12, a: "float" }, { e: "📖", x: 82, y: 26, s: 12, a: "float" }, { e: "🎮", x: 24, y: 78, s: 12 }, { e: "🎨", x: 78, y: 78, s: 12 } ],
          text: { hi: "इंटरनेट एक बहुत बड़े शहर जैसा है — उसमें कहानियाँ, गाने और खेल हैं।", en: "The internet is like a giant city — full of stories, songs and games." } },
        { bg: "city", scene: [
          { e: "🧒", x: 26, y: 64, s: 24 }, { e: "👤", x: 72, y: 62, s: 28, name: { hi: "अनजान", en: "a stranger" } }, { e: "❓", x: 72, y: 30, s: 12, a: "pulse" } ],
          text: { hi: "उस शहर में अनजान लोग भी होते हैं। सड़क की तरह इंटरनेट पर भी — अनजान लोगों को अपनी बातें नहीं बताते।", en: "That city has strangers too. Just like on the street, we don't tell strangers about ourselves online." } },
        { bg: "screen", scene: [
          { e: "💬", x: 50, y: 30, s: 22 }, { e: "📱", x: 50, y: 66, s: 24 } ],
          text: { hi: "फ़ोन पर कोई अनजान पूछता है: “तुम्हारा घर कहाँ है?”", en: "Someone you don't know asks on the phone: “Where do you live?”" },
          act: { type: "choose",
            prompt: { hi: "तुम क्या करोगे? पता बताओगे, या बड़ों को बुलाओगे?", en: "What will you do? Tell them, or call a grown-up?" },
            options: [{ e: "🏠", hi: "पता बता दूँ", en: "Tell my address" }, { e: "🙋", hi: "बड़ों को बुलाऊँ", en: "Call a grown-up" }], answer: 1,
            done: { hi: "बिल्कुल सही! पहले बड़ों को बताओ।", en: "Exactly right! Tell a grown-up first." },
            wrong: { hi: "रुको! घर का पता किसी अनजान को नहीं बताते। बड़ों को बुलाओ।", en: "Stop! We never tell a stranger where we live. Call a grown-up." } } },
        { bg: "screen", scene: [
          { e: "🎁", x: 34, y: 46, s: 26, a: "pulse" }, { e: "✨", x: 20, y: 24, s: 10, a: "twinkle" }, { e: "✨", x: 50, y: 22, s: 10, a: "twinkle" }, { e: "🙋", x: 76, y: 56, s: 22 } ],
          text: { hi: "अगर स्क्रीन पर अचानक चमकता डिब्बा आए — “दबाओ, इनाम जीतो!” — तो उसे मत दबाओ।", en: "If a shiny box suddenly pops up — “Tap here to win a prize!” — don't tap it." },
          act: { type: "choose",
            prompt: { hi: "तुम क्या दबाओगे? चमकता इनाम, या बड़ों से पूछोगे?", en: "What will you tap? The shiny prize, or ask a grown-up?" },
            options: [{ e: "🎁", hi: "इनाम जीतो!", en: "Win a prize!" }, { e: "🙋", hi: "बड़ों से पूछूँ", en: "Ask a grown-up" }], answer: 1,
            done: { hi: "शाबाश! अनजान चीज़ दबाने से पहले बड़ों से पूछते हैं।", en: "Well done! Ask a grown-up before tapping something you don't know." },
            wrong: { hi: "ओह! अनजान चमकते बटन धोखा भी हो सकते हैं। पहले बड़ों से पूछो।", en: "Oops! Strange shiny buttons can be tricks. Ask a grown-up first." } } },
        { bg: "screen", scene: [
          { e: "🧰", id: "box", x: 50, y: 56, s: 28, name: { hi: "ख़ज़ाने का बक्सा", en: "the treasure box" } },
          { e: "🔓", id: "lock", x: 50, y: 28, s: 14 } ],
          text: { hi: "तुम्हारा नाम, स्कूल, फ़ोटो और पासवर्ड — ये सब तुम्हारा ख़ज़ाना हैं। ख़ज़ाना छुपाकर रखते हैं!", en: "Your name, school, photos and passwords are your treasure. We keep treasure safe!" },
          act: { type: "tap", target: "box", times: 1,
            prompt: { hi: "बक्से को छूकर ताला लगाओ!", en: "Tap the box to lock it!" },
            steps: [[{ id: "lock", e: "🔒" }]],
            done: { hi: "ख़ज़ाना सुरक्षित! शाबाश!", en: "Treasure locked and safe! Well done!" } } },
        { bg: "home", scene: [
          { e: "🧒", x: 30, y: 62, s: 22 }, { e: "👨‍👩‍👧", x: 70, y: 60, s: 28, name: { hi: "घर के बड़े", en: "grown-ups at home" } }, { e: "❤️", x: 50, y: 28, s: 12, a: "pulse" } ],
          text: { hi: "अगर कुछ भी अजीब लगे, डर लगे या समझ न आए — तुरंत किसी बड़े को बताओ। तुम्हें कोई डाँट नहीं पड़ेगी। मुसीबत हो तो बड़े 1098 या 112 पर फ़ोन करके मदद ले सकते हैं।", en: "If anything feels strange, scary or confusing — tell a grown-up right away. You won't be in trouble. In an emergency, grown-ups can call 1098 or 112 for help." } },
        { bg: "garden", scene: [
          { e: "⚽", x: 30, y: 70, s: 16, a: "drive" }, { e: "🏃", x: 56, y: 64, s: 22 }, { e: "☀️", x: 82, y: 18, s: 14 }, { e: "📱", x: 84, y: 76, s: 10 }, { e: "💤", x: 90, y: 66, s: 8 } ],
          text: { hi: "और याद रखो: स्क्रीन को भी आराम चाहिए! बाहर खेलो, दौड़ो और दूर तक देखो।", en: "And remember: screens need rest too! Play outside, run around and look far away." } },
      ],
      quiz: [
        { q: { hi: "कोई अनजान तुम्हारा पता पूछे, तो?", en: "If a stranger asks where you live?" },
          options: [{ e: "🙋", hi: "बड़ों को बताओ", en: "Tell a grown-up" }, { e: "🏠", hi: "पता बता दो", en: "Tell them" }], answer: 0,
          why: { hi: "हाँ! पहले बड़ों को बताओ।", en: "Yes! Tell a grown-up first." } },
      ],
      mission: { e: "🛡️", hi: "आज किसी बड़े के साथ अपना सुरक्षा नियम ज़ोर से बोलो: “कुछ भी अनजान हो, तो पहले बड़ों से पूछूँगा!”", en: "Today, say your safety rule out loud with a grown-up: “If it's something I don't know, I'll ask a grown-up first!”" },
    },
  ];

  /* "जादुई खिड़की" scenes: layers from far (d 0) to near (d 1); x = 0–100 across the whole
     panorama, y = % of the window height. Animals hide behind `cover` and peek out when the
     child looks their way. */
  var windows = [
    {
      id: "jungle", icon: "🌴", sky: ["#B3E5FC", "#E8F5E9"], ground: "#7CB342",
      title: { hi: "जंगल", en: "Jungle", hinglish: "Jungle" },
      layers: [
        { d: 0.1, items: [{ e: "⛰️", x: 8, y: 44, s: 34 }, { e: "⛰️", x: 40, y: 46, s: 40 }, { e: "⛰️", x: 76, y: 44, s: 34 }, { e: "☁️", x: 22, y: 14, s: 12 }, { e: "☁️", x: 62, y: 10, s: 14 }, { e: "☀️", x: 90, y: 14, s: 12 }] },
        { d: 0.5, items: [{ e: "🌴", x: 4, y: 58, s: 30 }, { e: "🌳", x: 20, y: 60, s: 32 }, { e: "🌴", x: 38, y: 58, s: 28 }, { e: "🌳", x: 58, y: 60, s: 34 }, { e: "🌴", x: 78, y: 56, s: 30 }, { e: "🌳", x: 96, y: 60, s: 30 }] },
        { d: 1, items: [{ e: "🌿", x: 6, y: 90, s: 18 }, { e: "🌱", x: 26, y: 92, s: 14 }, { e: "🌿", x: 46, y: 90, s: 20 }, { e: "🍃", x: 66, y: 92, s: 14 }, { e: "🌿", x: 86, y: 90, s: 18 }] },
      ],
      animals: [
        { e: "🐒", d: 0.5, x: 22, y: 46, s: 14, cover: "🌳", hi: "बंदर", en: "a monkey", fact: { hi: "बंदर पेड़ों पर झूलता है!", en: "Monkeys swing from the trees!" } },
        { e: "🦚", d: 1, x: 44, y: 84, s: 16, cover: "🌿", hi: "मोर", en: "a peacock", fact: { hi: "मोर अपने रंग-बिरंगे पंख फैलाता है!", en: "A peacock spreads its colourful feathers!" } },
        { e: "🐘", d: 0.5, x: 60, y: 62, s: 18, cover: "🌳", hi: "हाथी", en: "an elephant", fact: { hi: "हाथी अपनी सूँड से पानी पीता है!", en: "An elephant drinks with its trunk!" } },
        { e: "🐅", d: 1, x: 84, y: 84, s: 16, cover: "🌿", hi: "बाघ", en: "a tiger", fact: { hi: "बाघ की धारियाँ उसे छिपने में मदद करती हैं!", en: "A tiger's stripes help it hide!" } },
        { e: "🦜", d: 0.5, x: 86, y: 40, s: 12, cover: "🌳", hi: "तोता", en: "a parrot", fact: { hi: "तोता बातें दोहरा सकता है!", en: "A parrot can copy words!" } },
      ],
      end: { hi: "तुमने सारे जानवर ढूँढ लिए! ये जादुई जंगल था। अब असली दुनिया में ढूँढो — खिड़की से बाहर कौन-सा पक्षी या पेड़ दिखता है?", en: "You found all the animals! That was a magic jungle. Now look in the real world — which bird or tree can you see outside the window?" },
    },
    {
      id: "sea", icon: "🐠", sky: ["#4FC3F7", "#01579B"], ground: "#F9E0A8",
      title: { hi: "समुद्र के अंदर", en: "Under the Sea", hinglish: "Samudra ke andar" },
      layers: [
        { d: 0.1, items: [{ e: "⚪", x: 10, y: 20, s: 5 }, { e: "⚪", x: 34, y: 12, s: 4 }, { e: "⚪", x: 58, y: 22, s: 5 }, { e: "⚪", x: 84, y: 14, s: 4 }] },
        { d: 0.5, items: [{ e: "🌿", x: 6, y: 80, s: 22 }, { e: "🌾", x: 26, y: 78, s: 24 }, { e: "🌿", x: 48, y: 80, s: 24 }, { e: "🌾", x: 70, y: 78, s: 22 }, { e: "🌿", x: 92, y: 80, s: 22 }] },
        { d: 1, items: [{ e: "🐚", x: 12, y: 92, s: 12 }, { e: "🌿", x: 34, y: 92, s: 16 }, { e: "⭐", x: 56, y: 94, s: 10 }, { e: "🌿", x: 78, y: 92, s: 16 }, { e: "🐚", x: 96, y: 92, s: 12 }] },
      ],
      animals: [
        { e: "🐠", d: 0.5, x: 16, y: 54, s: 14, cover: "🌿", hi: "रंगीन मछली", en: "a colourful fish", fact: { hi: "मछली पानी में साँस लेती है!", en: "Fish breathe under water!" } },
        { e: "🐙", d: 1, x: 36, y: 84, s: 16, cover: "🌿", hi: "ऑक्टोपस", en: "an octopus", fact: { hi: "ऑक्टोपस की आठ भुजाएँ होती हैं!", en: "An octopus has eight arms!" } },
        { e: "🐢", d: 0.5, x: 56, y: 60, s: 16, cover: "🌾", hi: "समुद्री कछुआ", en: "a sea turtle", fact: { hi: "समुद्री कछुआ बहुत दूर तक तैरता है!", en: "Sea turtles swim very far!" } },
        { e: "🦀", d: 1, x: 78, y: 86, s: 14, cover: "🌿", hi: "केकड़ा", en: "a crab", fact: { hi: "केकड़ा टेढ़ा-टेढ़ा चलता है!", en: "A crab walks sideways!" } },
        { e: "🐳", d: 0.1, x: 72, y: 36, s: 20, cover: "⚪", hi: "व्हेल", en: "a whale", fact: { hi: "व्हेल सबसे बड़ा जानवर है!", en: "The blue whale is the biggest animal of all!" } },
      ],
      end: { hi: "तुमने सारे समुद्री दोस्त ढूँढ लिए! ये जादुई समुद्र था। नहाते समय सोचो — मछली की तरह तैरना कैसा लगता होगा?", en: "You found all the sea friends! That was a magic sea. At bath time, imagine — how would it feel to swim like a fish?" },
    },
    {
      id: "space", icon: "🪐", sky: ["#0D1240", "#2A1B5C"], ground: "#9E9E9E",
      title: { hi: "अंतरिक्ष", en: "Space", hinglish: "Antariksh" },
      layers: [
        { d: 0.1, items: [{ e: "✨", x: 6, y: 12, s: 6 }, { e: "⭐", x: 20, y: 30, s: 5 }, { e: "✨", x: 36, y: 8, s: 6 }, { e: "⭐", x: 52, y: 24, s: 5 }, { e: "✨", x: 68, y: 10, s: 6 }, { e: "⭐", x: 84, y: 28, s: 5 }, { e: "✨", x: 96, y: 12, s: 6 }] },
        { d: 0.5, items: [{ e: "🌙", x: 14, y: 30, s: 20 }, { e: "☄️", x: 46, y: 16, s: 14 }, { e: "🌍", x: 88, y: 34, s: 22 }] },
        { d: 1, items: [{ e: "⛰️", x: 10, y: 90, s: 22 }, { e: "⛰️", x: 50, y: 92, s: 26 }, { e: "⛰️", x: 90, y: 90, s: 22 }] },
      ],
      animals: [
        { e: "🚀", d: 0.5, x: 28, y: 56, s: 16, cover: "⭐", hi: "रॉकेट", en: "a rocket", fact: { hi: "रॉकेट बहुत तेज़ ऊपर जाता है!", en: "A rocket zooms up very fast!" } },
        { e: "🧑‍🚀", d: 1, x: 32, y: 82, s: 16, cover: "⛰️", hi: "अंतरिक्ष यात्री", en: "an astronaut", fact: { hi: "अंतरिक्ष यात्री ख़ास सूट पहनते हैं!", en: "Astronauts wear special suits!" } },
        { e: "🛰️", d: 0.5, x: 62, y: 44, s: 14, cover: "☄️", hi: "उपग्रह", en: "a satellite", fact: { hi: "उपग्रह धरती के चारों ओर घूमता है!", en: "A satellite goes round and round the Earth!" } },
        { e: "🪐", d: 0.1, x: 70, y: 30, s: 18, cover: "✨", hi: "शनि ग्रह", en: "planet Saturn", fact: { hi: "शनि ग्रह के चारों ओर छल्ले हैं!", en: "Saturn has rings all around it!" } },
        { e: "🛸", d: 1, x: 76, y: 82, s: 14, cover: "⛰️", hi: "उड़न तश्तरी", en: "a flying saucer", fact: { hi: "ये तो कहानी वाली उड़न तश्तरी है — मज़े के लिए!", en: "This flying saucer is from stories — just for fun!" } },
      ],
      end: { hi: "तुमने अंतरिक्ष की सारी चीज़ें ढूँढ लीं! आज रात किसी बड़े के साथ असली आसमान देखो — कितने तारे दिखे?", en: "You found everything in space! Tonight, look at the real sky with a grown-up — how many stars can you see?" },
    },
    {
      id: "garden", icon: "🦋", sky: ["#E1F5FE", "#F1F8E9"], ground: "#9CCC65",
      title: { hi: "तितली का बगीचा", en: "Butterfly Garden", hinglish: "Titli ka bagicha" },
      layers: [
        { d: 0.1, items: [{ e: "☁️", x: 16, y: 14, s: 12 }, { e: "🌤️", x: 58, y: 12, s: 14 }, { e: "☁️", x: 90, y: 16, s: 12 }] },
        { d: 0.5, items: [{ e: "🌳", x: 8, y: 56, s: 30 }, { e: "🏡", x: 36, y: 60, s: 24 }, { e: "🌳", x: 66, y: 56, s: 30 }, { e: "🌻", x: 86, y: 66, s: 18 }] },
        { d: 1, items: [{ e: "🌷", x: 6, y: 90, s: 14 }, { e: "🌼", x: 24, y: 92, s: 14 }, { e: "🌸", x: 44, y: 90, s: 14 }, { e: "🌷", x: 64, y: 92, s: 14 }, { e: "🌼", x: 84, y: 90, s: 14 }] },
      ],
      animals: [
        { e: "🦋", d: 1, x: 14, y: 76, s: 14, cover: "🌷", hi: "तितली", en: "a butterfly", fact: { hi: "तितली फूलों का रस पीती है!", en: "Butterflies sip nectar from flowers!" } },
        { e: "🐝", d: 1, x: 52, y: 78, s: 12, cover: "🌸", hi: "मधुमक्खी", en: "a bee", fact: { hi: "मधुमक्खी शहद बनाती है!", en: "Bees make honey!" } },
        { e: "🐞", d: 0.5, x: 86, y: 62, s: 10, cover: "🌻", hi: "लाल कीड़ा", en: "a ladybird", fact: { hi: "इस कीड़े की पीठ पर काले धब्बे हैं!", en: "This ladybird has black spots on its back!" } },
        { e: "🐿️", d: 0.5, x: 66, y: 46, s: 12, cover: "🌳", hi: "गिलहरी", en: "a squirrel", fact: { hi: "गिलहरी की पीठ पर धारियाँ होती हैं!", en: "Indian squirrels have stripes on their backs!" } },
      ],
      end: { hi: "तुमने बगीचे के सारे दोस्त ढूँढ लिए! अब किसी बड़े के साथ बाहर जाओ — असली तितली या मधुमक्खी ढूँढो!", en: "You found all the garden friends! Now go outside with a grown-up — look for a real butterfly or bee!" },
    },
  ];

  NS.content.future = {
    journeys: journeys,
    windows: windows,
  };
})();
