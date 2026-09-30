package org.guardian.buddy;

import android.graphics.Color;

import java.util.ArrayList;
import java.util.List;

/**
 * All the learning content for little children (pre-nursery / nursery / prep).
 *
 * <p>It is a plain, offline data source: English and Hindi alphabets, numbers,
 * colours, shapes, animals with their sounds, fruits and vegetables, vehicles,
 * body parts, good manners, and nursery rhymes. Nothing here needs the
 * internet, so it is safe and always available.
 */
public final class Syllabus {

    private Syllabus() {
    }

    /** The lessons shown as tiles on the home screen, in order. */
    public enum Lesson {
        ENGLISH_ABC("🔤", "ABC", "अंग्रेज़ी अक्षर", "en"),
        HINDI_VARN("अ", "अक्षर", "हिंदी वर्णमाला", "hi"),
        NUMBERS("🔢", "गिनती", "एक दो तीन… गिनती सीखो", "hi"),
        COLORS("🎨", "रंग", "रंगों के नाम सीखो", "hi"),
        SHAPES("🔷", "आकार", "आकार सीखो", "hi"),
        ANIMALS("🐘", "जानवर", "जानवर और उनकी आवाज़", "hi"),
        FRUITS("🍎", "फल-सब्ज़ी", "फल और सब्ज़ियाँ", "hi"),
        VEHICLES("🚗", "वाहन", "गाड़ियों के नाम", "hi"),
        BODY("✋", "शरीर", "शरीर के अंग", "hi"),
        MANNERS("🙏", "अच्छी बातें", "प्यार से बोलना सीखो", "hi");

        public final String icon;
        public final String title;
        public final String subtitle;
        public final String lang;

        Lesson(String icon, String title, String subtitle, String lang) {
            this.icon = icon;
            this.title = title;
            this.subtitle = subtitle;
            this.lang = lang;
        }
    }

    /** Returns the flashcards for one lesson. */
    public static List<Card> cards(Lesson lesson) {
        switch (lesson) {
            case ENGLISH_ABC: return englishAbc();
            case HINDI_VARN:  return hindiVarnmala();
            case NUMBERS:     return numbers();
            case COLORS:      return colors();
            case SHAPES:      return shapes();
            case ANIMALS:     return animals();
            case FRUITS:      return fruits();
            case VEHICLES:    return vehicles();
            case BODY:        return body();
            case MANNERS:     return manners();
            default:          return new ArrayList<>();
        }
    }

    // ---- English A B C ("A for Apple") ----------------------------------

    private static final String[][] ABC = {
            {"A", "Apple", "🍎"}, {"B", "Ball", "⚽"}, {"C", "Cat", "🐈"},
            {"D", "Dog", "🐕"}, {"E", "Elephant", "🐘"}, {"F", "Fish", "🐟"},
            {"G", "Grapes", "🍇"}, {"H", "Hat", "🎩"}, {"I", "Ice cream", "🍦"},
            {"J", "Juice", "🧃"}, {"K", "Kite", "🪁"}, {"L", "Lion", "🦁"},
            {"M", "Monkey", "🐒"}, {"N", "Nest", "🪺"}, {"O", "Orange", "🍊"},
            {"P", "Parrot", "🦜"}, {"Q", "Queen", "👑"}, {"R", "Rabbit", "🐇"},
            {"S", "Sun", "☀️"}, {"T", "Tiger", "🐯"}, {"U", "Umbrella", "☂️"},
            {"V", "Van", "🚐"}, {"W", "Watch", "⌚"}, {"X", "Xylophone", "🎶"},
            {"Y", "Yak", "🐂"}, {"Z", "Zebra", "🦓"},
    };

    private static List<Card> englishAbc() {
        List<Card> out = new ArrayList<>();
        for (String[] r : ABC) {
            out.add(new Card(r[0], r[0] + " for " + r[1] + "  " + r[2],
                    r[0] + " for " + r[1], "en"));
        }
        return out;
    }

    // ---- Hindi वर्णमाला ("क से कमल") ------------------------------------

    private static final String[][] VARN = {
            // स्वर
            {"अ", "अनार", "🍎"}, {"आ", "आम", "🥭"}, {"इ", "इमली", "🌿"},
            {"ई", "ईख", "🌾"}, {"उ", "उल्लू", "🦉"}, {"ऊ", "ऊन", "🧶"},
            {"ए", "एड़ी", "🦶"}, {"ऐ", "ऐनक", "👓"}, {"ओ", "ओखली", "🪵"},
            {"औ", "औरत", "👩"}, {"अं", "अंगूर", "🍇"}, {"अः", "अः", "😮"},
            // व्यंजन
            {"क", "कमल", "🌸"}, {"ख", "खरगोश", "🐇"}, {"ग", "गमला", "🪴"},
            {"घ", "घड़ी", "⌚"}, {"च", "चम्मच", "🥄"}, {"छ", "छाता", "☂️"},
            {"ज", "जहाज़", "✈️"}, {"झ", "झंडा", "🚩"}, {"ट", "टमाटर", "🍅"},
            {"ठ", "ठठेरा", "🔨"}, {"ड", "डमरू", "🥁"}, {"ढ", "ढोल", "🥁"},
            {"त", "तितली", "🦋"}, {"थ", "थाली", "🍽️"}, {"द", "दवात", "🖋️"},
            {"ध", "धनुष", "🏹"}, {"न", "नल", "🚰"}, {"प", "पतंग", "🪁"},
            {"फ", "फल", "🍎"}, {"ब", "बकरी", "🐐"}, {"भ", "भालू", "🐻"},
            {"म", "मछली", "🐟"}, {"य", "यंत्र", "⚙️"}, {"र", "रथ", "🛕"},
            {"ल", "लट्टू", "🪀"}, {"व", "वन", "🌳"}, {"श", "शेर", "🦁"},
            {"स", "सेब", "🍎"}, {"ह", "हाथी", "🐘"}, {"क्ष", "क्षत्रिय", "🛡️"},
            {"त्र", "त्रिशूल", "🔱"}, {"ज्ञ", "ज्ञानी", "📖"},
    };

    private static List<Card> hindiVarnmala() {
        List<Card> out = new ArrayList<>();
        for (String[] r : VARN) {
            out.add(new Card(r[0], r[0] + " से " + r[1] + "  " + r[2],
                    r[0] + " से " + r[1], "hi"));
        }
        return out;
    }

    // ---- Numbers 1–10, counted with pictures -----------------------------

    private static final String[] NUM_WORDS = {
            "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस"};
    private static final String[] NUM_EN = {
            "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"};

    private static List<Card> numbers() {
        List<Card> out = new ArrayList<>();
        for (int n = 1; n <= 10; n++) {
            StringBuilder dots = new StringBuilder();
            for (int i = 0; i < n; i++) {
                dots.append("🍎");
            }
            out.add(new Card(String.valueOf(n),
                    dots + "\n" + NUM_WORDS[n - 1] + " · " + NUM_EN[n - 1],
                    NUM_WORDS[n - 1], "hi"));
        }
        return out;
    }

    // ---- Colours (card takes on the real colour) -------------------------

    private static List<Card> colors() {
        List<Card> out = new ArrayList<>();
        out.add(color("🔴", "लाल", "Red", Color.rgb(0xE5, 0x39, 0x35)));
        out.add(color("🟢", "हरा", "Green", Color.rgb(0x43, 0xA0, 0x47)));
        out.add(color("🔵", "नीला", "Blue", Color.rgb(0x1E, 0x88, 0xE5)));
        out.add(color("🟡", "पीला", "Yellow", Color.rgb(0xFD, 0xD8, 0x35)));
        out.add(color("🟠", "नारंगी", "Orange", Color.rgb(0xFB, 0x8C, 0x00)));
        out.add(color("🟣", "बैंगनी", "Purple", Color.rgb(0x8E, 0x24, 0xAA)));
        out.add(color("🟤", "भूरा", "Brown", Color.rgb(0x6D, 0x4C, 0x41)));
        out.add(color("⚫", "काला", "Black", Color.rgb(0x21, 0x21, 0x21)));
        out.add(color("⚪", "सफ़ेद", "White", Color.rgb(0xFA, 0xFA, 0xFA)));
        out.add(color("🌸", "गुलाबी", "Pink", Color.rgb(0xEC, 0x40, 0x7A)));
        return out;
    }

    private static Card color(String emoji, String hindi, String en, int bg) {
        return new Card(emoji, hindi + " · " + en, hindi, "hi", bg);
    }

    // ---- Shapes ----------------------------------------------------------

    private static List<Card> shapes() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("⭕", "वृत्त · Circle", "वृत्त", "hi"));
        out.add(new Card("🟥", "वर्ग · Square", "वर्ग", "hi"));
        out.add(new Card("🔺", "त्रिकोण · Triangle", "त्रिकोण", "hi"));
        out.add(new Card("⭐", "तारा · Star", "तारा", "hi"));
        out.add(new Card("❤️", "दिल · Heart", "दिल", "hi"));
        out.add(new Card("🔷", "हीरा · Diamond", "हीरा", "hi"));
        return out;
    }

    // ---- Animals and their sounds ----------------------------------------

    private static List<Card> animals() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("🐄", "गाय · Cow", "गाय बोलती है, मूँ मूँ", "hi"));
        out.add(new Card("🐕", "कुत्ता · Dog", "कुत्ता बोलता है, भौं भौं", "hi"));
        out.add(new Card("🐈", "बिल्ली · Cat", "बिल्ली बोलती है, म्याऊँ म्याऊँ", "hi"));
        out.add(new Card("🦁", "शेर · Lion", "शेर दहाड़ता है, दहाड़", "hi"));
        out.add(new Card("🐐", "बकरी · Goat", "बकरी बोलती है, में में", "hi"));
        out.add(new Card("🐓", "मुर्गा · Rooster", "मुर्गा बोलता है, कुकड़ूँ कूँ", "hi"));
        out.add(new Card("🐘", "हाथी · Elephant", "हाथी बहुत बड़ा होता है", "hi"));
        out.add(new Card("🐒", "बंदर · Monkey", "बंदर पेड़ पर कूदता है", "hi"));
        out.add(new Card("🐸", "मेंढक · Frog", "मेंढक बोलता है, टर्र टर्र", "hi"));
        out.add(new Card("🐦", "चिड़िया · Bird", "चिड़िया बोलती है, चूँ चूँ", "hi"));
        return out;
    }

    // ---- Fruits and vegetables -------------------------------------------

    private static List<Card> fruits() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("🍎", "सेब · Apple", "सेब", "hi"));
        out.add(new Card("🍌", "केला · Banana", "केला", "hi"));
        out.add(new Card("🥭", "आम · Mango", "आम", "hi"));
        out.add(new Card("🍇", "अंगूर · Grapes", "अंगूर", "hi"));
        out.add(new Card("🍊", "संतरा · Orange", "संतरा", "hi"));
        out.add(new Card("🍉", "तरबूज़ · Watermelon", "तरबूज़", "hi"));
        out.add(new Card("🥕", "गाजर · Carrot", "गाजर", "hi"));
        out.add(new Card("🍅", "टमाटर · Tomato", "टमाटर", "hi"));
        out.add(new Card("🥔", "आलू · Potato", "आलू", "hi"));
        out.add(new Card("🧅", "प्याज़ · Onion", "प्याज़", "hi"));
        return out;
    }

    // ---- Vehicles --------------------------------------------------------

    private static List<Card> vehicles() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("🚗", "कार · Car", "कार", "hi"));
        out.add(new Card("🚌", "बस · Bus", "बस", "hi"));
        out.add(new Card("🚂", "रेलगाड़ी · Train", "रेलगाड़ी", "hi"));
        out.add(new Card("✈️", "हवाई जहाज़ · Aeroplane", "हवाई जहाज़", "hi"));
        out.add(new Card("🚲", "साइकिल · Cycle", "साइकिल", "hi"));
        out.add(new Card("🛺", "ऑटो · Auto", "ऑटो रिक्शा", "hi"));
        out.add(new Card("⛵", "नाव · Boat", "नाव", "hi"));
        out.add(new Card("🚑", "एम्बुलेंस · Ambulance", "एम्बुलेंस", "hi"));
        return out;
    }

    // ---- Body parts ------------------------------------------------------

    private static List<Card> body() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("👁️", "आँख · Eye", "आँख, इससे हम देखते हैं", "hi"));
        out.add(new Card("👂", "कान · Ear", "कान, इससे हम सुनते हैं", "hi"));
        out.add(new Card("👃", "नाक · Nose", "नाक, इससे हम सूँघते हैं", "hi"));
        out.add(new Card("👄", "मुँह · Mouth", "मुँह, इससे हम बोलते और खाते हैं", "hi"));
        out.add(new Card("✋", "हाथ · Hand", "हाथ, इससे हम काम करते हैं", "hi"));
        out.add(new Card("🦶", "पैर · Foot", "पैर, इससे हम चलते हैं", "hi"));
        out.add(new Card("🦷", "दाँत · Teeth", "दाँत, इनसे हम चबाते हैं", "hi"));
        out.add(new Card("💇", "बाल · Hair", "बाल", "hi"));
        return out;
    }

    // ---- Good manners (helps children learn to talk politely) ------------

    private static List<Card> manners() {
        List<Card> out = new ArrayList<>();
        out.add(new Card("🙏", "नमस्ते", "बड़ों को नमस्ते कहते हैं", "hi"));
        out.add(new Card("😊", "धन्यवाद", "कोई कुछ दे तो धन्यवाद कहते हैं", "hi"));
        out.add(new Card("🙂", "कृपया", "कुछ माँगते समय कृपया कहते हैं", "hi"));
        out.add(new Card("🤝", "माफ़ करना", "गलती हो जाए तो माफ़ी माँगते हैं", "hi"));
        out.add(new Card("🪥", "ब्रश करो", "सुबह उठकर दाँत साफ़ करते हैं", "hi"));
        out.add(new Card("🧼", "हाथ धोओ", "खाने से पहले हाथ धोते हैं", "hi"));
        out.add(new Card("🍎", "फल खाओ", "हरी सब्ज़ी और फल खाने से हम मज़बूत बनते हैं", "hi"));
        out.add(new Card("😴", "जल्दी सोओ", "रात को जल्दी सोते हैं और सुबह जल्दी उठते हैं", "hi"));
        return out;
    }

    // ---- Nursery rhymes --------------------------------------------------

    public static List<Rhyme> rhymes() {
        List<Rhyme> out = new ArrayList<>();
        out.add(new Rhyme("मछली जल की रानी 🐟", "hi",
                "मछली जल की रानी है,",
                "जीवन उसका पानी है।",
                "हाथ लगाओ डर जाएगी,",
                "बाहर निकालो मर जाएगी।"));
        out.add(new Rhyme("आलू कचालू 🥔", "hi",
                "आलू कचालू बेटा कहाँ गए थे?",
                "बैंगन की टोकरी में सो रहे थे।",
                "बैंगन ने लात मारी रो रहे थे,",
                "मम्मी ने प्यार किया हँस रहे थे।"));
        // Original rhymes (written for this app), in place of film-song lyrics still under copyright.
        out.add(new Rhyme("चंदा-तारे 🌙", "hi",
                "चंदा चमके, तारे चमकें,",
                "आसमान में झिलमिल दमकें।",
                "नन्हे-मुन्ने, अब सो जाओ,",
                "मीठे-मीठे सपने पाओ।"));
        out.add(new Rhyme("हाथी दादा 🐘", "hi",
                "हाथी दादा, बड़े निराले,",
                "सूँड़ हिलाकर पानी डाले।",
                "कान हिलाएँ पंखे जैसे,",
                "चलें झूमते, मस्त मतवाले।"));
        out.add(new Rhyme("नाचे मोर 🦚", "hi",
                "काले बादल, रिमझिम पानी,",
                "मोर ने छेड़ी नई कहानी।",
                "पंख फैलाकर छम-छम नाचा,",
                "देख के ख़ुश हैं दादी-नानी।"));
        out.add(new Rhyme("Twinkle Twinkle ⭐", "en",
                "Twinkle, twinkle, little star,",
                "How I wonder what you are.",
                "Up above the world so high,",
                "Like a diamond in the sky."));
        out.add(new Rhyme("Johny Johny 👶", "en",
                "Johny, Johny, yes papa?",
                "Eating sugar? No, papa.",
                "Telling lies? No, papa.",
                "Open your mouth, ha ha ha!"));
        out.add(new Rhyme("Baa Baa Black Sheep 🐑", "en",
                "Baa, baa, black sheep,",
                "Have you any wool?",
                "Yes sir, yes sir,",
                "Three bags full."));
        out.add(new Rhyme("Jack and Jill 🪣", "en",
                "Jack and Jill went up the hill,",
                "To fetch a pail of water.",
                "Jack fell down and broke his crown,",
                "And Jill came tumbling after."));
        return out;
    }
}
