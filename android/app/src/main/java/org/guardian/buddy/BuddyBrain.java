package org.guardian.buddy;

import java.util.Calendar;
import java.util.Locale;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Works out a friendly, child-safe reply to whatever a child says or types.
 *
 * Runs fully offline: no internet, no accounts, nothing leaves the phone.
 * Understands Hindi (Devanagari), Hinglish and simple English.
 */
public class BuddyBrain {

    private static final Pattern MATH = Pattern.compile(
            "(\\d+)\\s*(\\+|plus|जमा|प्लस|और|-|minus|घटा|माइनस|x|×|\\*|times|into|गुणा|इंटू|/|÷|divided by|भाग)\\s*(\\d+)");

    private static final String[] JOKES = {
            "टीचर: बताओ, सबसे पुराना जानवर कौन सा है?\nबच्चा: ज़ेबरा!\nटीचर: क्यों?\nबच्चा: क्योंकि वो अभी भी ब्लैक एंड व्हाइट है! 😄",
            "मच्छर ने मच्छर से कहा — आज बाहर मत जाना, लोग ताली बजा-बजाकर हमें ढूँढ रहे हैं! 🦟😂",
            "पप्पू: मम्मी, मैं बड़ा होकर चाँद पर जाऊँगा!\nमम्मी: पहले होमवर्क पर तो चले जाओ! 🌙😆",
            "एक चींटी ने हाथी से कहा — धक्का मत देना, मैं भी भारी हूँ! 🐜🐘😄",
            "किताब ने पेंसिल से कहा — तुम्हारी तो हर बात का पॉइंट होता है! ✏️😄",
    };

    private static final String[] STORIES = {
            "एक बार एक प्यासा कौआ था। 🐦 उसे एक घड़ा मिला, पर पानी बहुत नीचे था। "
                    + "उसने एक-एक करके कंकड़ घड़े में डाले, और पानी ऊपर आ गया! "
                    + "कौए ने पानी पिया और खुश होकर उड़ गया। सीख: कोशिश करने वालों की हार नहीं होती! 💪",
            "एक खरगोश और एक कछुए ने दौड़ लगाई। 🐇🐢 खरगोश तेज़ था, इसलिए बीच में सो गया। "
                    + "कछुआ धीरे-धीरे चलता रहा और जीत गया! सीख: धीरे पर लगातार चलने वाला जीतता है। 🏆",
            "एक छोटा सा चूहा था जिसने जाल में फँसे शेर को अपने दाँतों से जाल काटकर बचाया। 🐭🦁 "
                    + "शेर ने कहा — धन्यवाद दोस्त! सीख: कोई भी छोटा नहीं होता, हर कोई मदद कर सकता है। ❤️",
    };

    private static final String[] RIDDLES = {
            "पहेली: ऐसी कौन सी चीज़ है जो जितनी बड़ी होती है, उतनी कम दिखाई देती है? 🤔\n(जवाब: अँधेरा! 🌑)",
            "पहेली: हरी थी मन भरी थी, लाख मोती जड़ी थी, राजा जी के बाग में दुशाला ओढ़े खड़ी थी। 🤔\n(जवाब: भुट्टा! 🌽)",
            "पहेली: ऐसी कौन सी चीज़ है जिसके दाँत हैं पर वो खाती नहीं? 🤔\n(जवाब: कंघी! 🪮)",
            "पहेली: काला है पर कौआ नहीं, लंबा है पर साँप नहीं, बाँधते हैं पर रस्सी नहीं। 🤔\n(जवाब: चोटी! 💇)",
    };

    private static final String[] FACTS = {
            "क्या तुम जानते हो? 🐙 ऑक्टोपस के तीन दिल होते हैं!",
            "क्या तुम जानते हो? 🐘 हाथी कूद नहीं सकता!",
            "क्या तुम जानते हो? 🍯 शहद कभी खराब नहीं होता!",
            "क्या तुम जानते हो? 🦒 जिराफ़ की जीभ नीली-काली होती है!",
            "क्या तुम जानते हो? ☀️ सूरज इतना बड़ा है कि उसमें लाखों पृथ्वी समा जाएँ!",
    };

    private static final String[] FALLBACK = {
            "वाह, ये तो मज़ेदार बात है! 😊 और बताओ?",
            "हम्म... मैं अभी सीख रहा हूँ। 🤖 तुम मुझसे चुटकुला, कहानी, पहेली या जोड़-घटाना पूछ सकते हो!",
            "अच्छा! तुम्हें सबसे ज़्यादा क्या करना पसंद है? 🎨⚽📚",
            "सुनकर अच्छा लगा! 🌟 क्या तुम एक मज़ेदार बात सुनना चाहोगे? बोलो 'कोई बात बताओ'।",
            "मुझे पूरी बात समझ नहीं आई 🙈 — फिर से बोलोगे?",
    };

    private final Random random;
    private String kidName;

    public BuddyBrain() {
        this(new Random());
    }

    BuddyBrain(Random random) {
        this.random = random;
    }

    public String greeting() {
        return "नमस्ते दोस्त! 👋 मैं बात बडी हूँ। तुम मुझसे बात कर सकते हो — "
                + "नीचे 🎤 दबाकर बोलो या लिखो। तुम्हारा नाम क्या है?";
    }

    public String reply(String input) {
        String text = normalize(input);
        if (text.isEmpty()) {
            return "कुछ तो बोलो! 😊";
        }

        // Safety first: anything that sounds like a child being hurt or scared.
        if (has(text, "मारता", "मारती", "मुझे मारा", "पीटता", "पीटा", "छूता", "छुआ", "गलत तरीके",
                "डरा रहा", "धमकी", "hurt me", "hits me", "touch me", "beat me", "maarta", "marta hai")) {
            return "ये सुनकर मुझे बहुत चिंता हुई। 💛 ये तुम्हारी गलती नहीं है। "
                    + "अभी किसी भरोसेमंद बड़े — मम्मी, पापा, टीचर — को ज़रूर बताओ। "
                    + "भारत में बच्चों की मदद के लिए 1098 (चाइल्डलाइन) पर फ़ोन कर सकते हो, ये मुफ़्त है।";
        }
        if (has(text, "पता बताओ", "घर का पता", "फोन नंबर", "फ़ोन नंबर", "पासवर्ड", "address", "password",
                "phone number", "अजनबी", "stranger")) {
            return "याद रखो 🛡️: अपना पता, फ़ोन नंबर या पासवर्ड किसी अनजान को कभी मत बताना — "
                    + "मुझे भी नहीं! कोई अजनबी कुछ पूछे तो मम्मी-पापा को बताओ।";
        }
        if (has(text, "उदास", "दुखी", "रोना", "रो रहा", "रो रही", "अकेला", "अकेली", "डर लग", "डर लगता",
                "sad", "lonely", "scared", "cry", "udas", "dukhi")) {
            return "अरे, कोई बात नहीं दोस्त 🤗 कभी-कभी सबको ऐसा लगता है। "
                    + "गहरी साँस लो — एक, दो, तीन। 🌬️ अपने मम्मी-पापा या किसी बड़े से भी बात करो, "
                    + "वो तुम्हें बहुत प्यार करते हैं। क्या तुम्हें खुश करने के लिए एक चुटकुला सुनाऊँ?";
        }

        String math = tryMath(text);
        if (math != null) {
            return math;
        }

        String name = extractName(text);
        if (name != null) {
            kidName = name;
            return "कितना प्यारा नाम है, " + name + "! 🌈 तुमसे मिलकर बहुत खुशी हुई। "
                    + "बोलो, क्या करें — चुटकुला, कहानी या पहेली?";
        }

        if (has(text, "चुटकुला", "जोक", "हँसाओ", "हंसाओ", "joke", "chutkula", "funny")) {
            return pick(JOKES);
        }
        if (has(text, "कहानी", "स्टोरी", "story", "kahani")) {
            return pick(STORIES);
        }
        if (has(text, "पहेली", "riddle", "paheli", "बूझो")) {
            return pick(RIDDLES);
        }
        if (has(text, "कोई बात बताओ", "कुछ बताओ", "रोचक", "fact", "मज़ेदार बात", "मजेदार बात", "पता है")) {
            return pick(FACTS);
        }
        if (has(text, "कैसे हो", "कैसी हो", "कैसा है", "how are you", "kaise ho", "kya haal", "क्या हाल")) {
            return "मैं एकदम बढ़िया हूँ! 😄 तुम कैसे हो" + nameSuffix() + "?";
        }
        if (has(text, "तुम्हारा नाम", "तेरा नाम", "आपका नाम", "your name", "tumhara naam", "कौन हो", "who are you")) {
            return "मेरा नाम बात बडी है! 🤖 मैं तुम्हारा बात करने वाला दोस्त हूँ।";
        }
        if (has(text, "मेरा नाम क्या", "what is my name", "mera naam kya")) {
            return kidName != null ? "तुम्हारा नाम " + kidName + " है! 😊" : "तुमने अभी तक अपना नाम नहीं बताया! बोलो 'मेरा नाम ... है'।";
        }
        if (has(text, "समय", "टाइम", "कितने बजे", "time")) {
            Calendar c = Calendar.getInstance();
            return String.format(Locale.US, "अभी %d बजकर %d मिनट हुए हैं। ⏰",
                    c.get(Calendar.HOUR) == 0 ? 12 : c.get(Calendar.HOUR), c.get(Calendar.MINUTE));
        }
        if (has(text, "धन्यवाद", "शुक्रिया", "थैंक", "thank", "dhanyavad", "shukriya")) {
            return "तुम्हारा भी धन्यवाद" + nameSuffix() + "! 💖 तुम बहुत अच्छे हो।";
        }
        if (has(text, "बाय", "टाटा", "अलविदा", "bye", "tata", "गुड नाइट", "good night", "सोने जा")) {
            return "टाटा" + nameSuffix() + "! 👋 जल्दी मिलेंगे। अपना ख़याल रखना!";
        }
        if (has(text, "नमस्ते", "नमस्कार", "हेलो", "हैलो", "हाय", "hello", "hi", "hey", "namaste")) {
            return "नमस्ते" + nameSuffix() + "! 😊 आज तुम्हारा दिन कैसा रहा?";
        }
        if (has(text, "अच्छा हूँ", "अच्छी हूँ", "ठीक हूँ", "बढ़िया", "मस्त हूँ", "fine", "good", "theek", "accha")) {
            return "वाह, बहुत बढ़िया! 🎉 आज तुमने क्या मज़ेदार किया?";
        }
        if (has(text, "हाँ", "हां", "ठीक है", "yes", "ok", "haan")) {
            return "तो ये लो! " + pick(JOKES);
        }
        if (has(text, "खाना", "खाया", "भूख", "food", "hungry", "khana")) {
            return "खाना बहुत ज़रूरी है! 🍎🥕 फल और सब्ज़ियाँ खाने से हम मज़बूत बनते हैं। तुम्हें क्या खाना सबसे पसंद है?";
        }
        if (has(text, "पढ़ाई", "पढ़ाई", "स्कूल", "होमवर्क", "school", "homework", "padhai")) {
            return "स्कूल में बहुत कुछ नया सीखने को मिलता है! 📚 तुम्हारा पसंदीदा विषय कौन सा है?";
        }
        if (has(text, "खेल", "खेलना", "play", "game", "khel")) {
            return "खेलना तो सबसे मज़ेदार है! ⚽ चलो एक खेल: मैं पहेली पूछता हूँ — बोलो 'पहेली'!";
        }
        if (has(text, "गाना", "गाओ", "song", "sing", "gana")) {
            return "🎵 मछली जल की रानी है, जीवन उसका पानी है। हाथ लगाओ डर जाएगी, बाहर निकालो मर जाएगी! 🐟🎶";
        }
        if (has(text, "प्यार", "love", "दोस्त", "friend")) {
            return "तुम मेरे सबसे अच्छे दोस्त हो! 💛";
        }
        return pick(FALLBACK);
    }

    private String nameSuffix() {
        return kidName != null ? " " + kidName : "";
    }

    private String tryMath(String text) {
        Matcher m = MATH.matcher(text);
        if (!m.find()) {
            return null;
        }
        long a = Long.parseLong(m.group(1));
        long b = Long.parseLong(m.group(3));
        String op = m.group(2);
        String sign;
        long result;
        if (op.equals("+") || op.equals("plus") || op.equals("जमा") || op.equals("प्लस") || op.equals("और")) {
            sign = "+";
            result = a + b;
        } else if (op.equals("-") || op.equals("minus") || op.equals("घटा") || op.equals("माइनस")) {
            sign = "−";
            result = a - b;
        } else if (op.equals("/") || op.equals("÷") || op.equals("divided by") || op.equals("भाग")) {
            if (b == 0) {
                return "शून्य से भाग नहीं दे सकते — ये तो गणित का जादू भी नहीं कर सकता! 🎩";
            }
            if (a % b != 0) {
                return a + " ÷ " + b + " = " + (a / b) + ", और शेष " + (a % b) + " बचता है। 🧮";
            }
            sign = "÷";
            result = a / b;
        } else {
            sign = "×";
            result = a * b;
        }
        return a + " " + sign + " " + b + " = " + result + " 🧮 शाबाश, गणित करते रहो!";
    }

    private static String extractName(String text) {
        Matcher m = Pattern.compile("(?:मेरा नाम|mera naam|my name is)\\s+([^\\s,.!?]+)").matcher(text);
        if (!m.find()) {
            return null;
        }
        String name = m.group(1);
        if (name.equals("क्या") || name.equals("kya") || name.equals("is") || name.equals("है")) {
            return null;
        }
        return Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    private String pick(String[] options) {
        return options[random.nextInt(options.length)];
    }

    private static boolean has(String text, String... keywords) {
        for (String k : keywords) {
            if (k.length() <= 3) {
                // Short words must match whole words ("hi" not in "this", "हाँ" not in "कहाँ").
                if ((" " + text + " ").contains(" " + k + " ")) {
                    return true;
                }
            } else if (text.contains(k)) {
                return true;
            }
        }
        return false;
    }

    /** Lower-cases, strips punctuation and turns Devanagari digits (०-९) into 0-9. */
    static String normalize(String input) {
        if (input == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (char ch : input.toLowerCase(Locale.ROOT).toCharArray()) {
            if (ch >= '०' && ch <= '९') {
                sb.append((char) ('0' + (ch - '०')));
            } else if (ch == '?' || ch == '!' || ch == ',' || ch == '।') {
                sb.append(' ');
            } else {
                sb.append(ch);
            }
        }
        return sb.toString().replaceAll("\\s+", " ").trim();
    }
}
