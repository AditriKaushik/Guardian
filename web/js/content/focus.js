/* नन्हा स्कूल — content for "ध्यान" (focus & calm). Pure data, no logic. */
(function () {
  "use strict";
  var NS = window.NS || (window.NS = {});
  NS.content = NS.content || {};

  NS.content.focus = {
    /* Memory match: faces of the cards (one per pair needed; 6 pairs max). */
    memory: ["🐶", "🐱", "🐰", "🦁", "🐸", "🐼", "🐵", "🐯", "🐮", "🐷", "🐔", "🐟"],

    /* Odd one out. level 1 = different kind of thing (2–3), 2 = different colour/shape (4–5),
       3 = small difference (6+). We show (size-1) cards from `same` plus `odd`. */
    odd: [
      { level: 1, same: ["🍎", "🍌", "🍇"], odd: "🐶", why: { hi: "बाकी सब फल हैं — कुत्ता फल नहीं है!", en: "The others are fruits — a dog is not a fruit!" } },
      { level: 1, same: ["🐶", "🐱", "🐰"], odd: "🚗", why: { hi: "बाकी सब जानवर हैं — गाड़ी जानवर नहीं है!", en: "The others are animals — a car is not an animal!" } },
      { level: 1, same: ["🚗", "🚌", "🚲"], odd: "🍌", why: { hi: "बाकी सब सवारी हैं — केला तो खाते हैं!", en: "The others are things we ride — we eat a banana!" } },
      { level: 1, same: ["🌸", "🌼", "🌷"], odd: "🐟", why: { hi: "बाकी सब फूल हैं — मछली पानी में रहती है!", en: "The others are flowers — a fish lives in water!" } },
      { level: 1, same: ["🪥", "🧼", "🛁"], odd: "🦁", why: { hi: "बाकी सब साफ़-सफ़ाई की चीज़ें हैं — शेर नहीं!", en: "The others help us stay clean — a lion doesn't!" } },
      { level: 1, same: ["☀️", "🌅", "🐓"], odd: "🌙", why: { hi: "बाकी सब सुबह के हैं — चाँद तो रात को आता है!", en: "The others belong to the morning — the moon comes at night!" } },
      { level: 2, same: ["🔴", "🔴", "🔴"], odd: "🔵", why: { hi: "बाकी सब लाल हैं — यह नीला है!", en: "The others are red — this one is blue!" } },
      { level: 2, same: ["⭐", "⭐", "⭐"], odd: "🌙", why: { hi: "बाकी सब तारे हैं — यह चाँद है!", en: "The others are stars — this is the moon!" } },
      { level: 2, same: ["🟩", "🟩", "🟩"], odd: "🟢", why: { hi: "बाकी सब चौकोर हैं — यह गोल है!", en: "The others are squares — this one is round!" } },
      { level: 2, same: ["🐟", "🐟", "🐟"], odd: "🐦", why: { hi: "बाकी सब मछलियाँ हैं — यह चिड़िया है!", en: "The others are fish — this is a bird!" } },
      { level: 2, same: ["🍎", "🍎", "🍎"], odd: "🍊", why: { hi: "बाकी सब सेब हैं — यह संतरा है!", en: "The others are apples — this is an orange!" } },
      { level: 3, same: ["🍎", "🍎", "🍎"], odd: "🍏", why: { hi: "बाकी सब लाल सेब हैं — यह हरा सेब है!", en: "The others are red apples — this one is green!" } },
      { level: 3, same: ["👆", "👆", "👆"], odd: "👇", why: { hi: "बाकी उँगलियाँ ऊपर हैं — यह नीचे है!", en: "The other fingers point up — this one points down!" } },
      { level: 3, same: ["🌕", "🌕", "🌕"], odd: "🌗", why: { hi: "बाकी सब पूरे चाँद हैं — यह आधा है!", en: "The others are full moons — this one is half!" } },
      { level: 3, same: ["🕐", "🕐", "🕐"], odd: "🕒", why: { hi: "बाकी घड़ियों में एक बजा है — इसमें तीन बजे हैं!", en: "The other clocks say one o'clock — this one says three!" } },
      { level: 3, same: ["➡️", "➡️", "➡️"], odd: "⬅️", why: { hi: "बाकी तीर दाईं ओर हैं — यह बाईं ओर है!", en: "The other arrows point right — this one points left!" } },
      { level: 3, same: ["😀", "😀", "😀"], odd: "😮", why: { hi: "बाकी सब मुस्कुरा रहे हैं — इसका मुँह गोल खुला है!", en: "The others are smiling — this one's mouth is a round O!" } }
    ],

    /* "जो मैं कहूँ वही दबाओ" — things to tap. */
    listen: [
      { emoji: "🐱", hi: "बिल्ली", en: "cat" },
      { emoji: "🐶", hi: "कुत्ता", en: "dog" },
      { emoji: "🐮", hi: "गाय", en: "cow" },
      { emoji: "🐘", hi: "हाथी", en: "elephant" },
      { emoji: "🦆", hi: "बत्तख", en: "duck" },
      { emoji: "🐟", hi: "मछली", en: "fish" },
      { emoji: "🍎", hi: "सेब", en: "apple" },
      { emoji: "🍌", hi: "केला", en: "banana" },
      { emoji: "🥭", hi: "आम", en: "mango" },
      { emoji: "🪥", hi: "ब्रश", en: "toothbrush" },
      { emoji: "📚", hi: "किताब", en: "book" },
      { emoji: "💧", hi: "पानी", en: "water" },
      { emoji: "🛏️", hi: "बिस्तर", en: "bed" },
      { emoji: "⚽", hi: "गेंद", en: "ball" }
    ],

    /* Gentle praise for effort (never for speed). */
    praise: [
      { hi: "तुमने ध्यान से देखा!", en: "You looked so carefully!" },
      { hi: "वाह, कितना अच्छा ध्यान!", en: "Wow, what great attention!" },
      { hi: "शाबाश! तुमने ध्यान से सुना!", en: "Well done! You listened carefully!" },
      { hi: "बहुत बढ़िया! तुम्हारी आँखें तो जासूस जैसी हैं!", en: "Brilliant! You have detective eyes!" }
    ],
    tryAgain: [
      { hi: "कोई बात नहीं, एक बार फिर ध्यान से देखो।", en: "That's okay — look once more, carefully." },
      { hi: "अरे, लगभग! फिर से कोशिश करो।", en: "Oh, almost! Try again." }
    ]
  };
})();
