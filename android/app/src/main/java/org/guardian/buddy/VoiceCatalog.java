package org.guardian.buddy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Describes the phone's text-to-speech voices to the web app (NanhaNative.voices()), without
 * Android classes so it can be unit tested. Android does not say whether a voice is male or
 * female, so {@link #guessGender} makes a best-effort guess and says "unknown" when unsure.
 */
final class VoiceCatalog {

    private VoiceCatalog() {
    }

    static final String FEMALE = "female";
    static final String MALE = "male";
    static final String UNKNOWN = "unknown";

    /** One voice as the web app sees it. */
    static final class Entry {
        final String id;
        final String lang;
        final String gender;
        final boolean local;
        final String label;

        Entry(String id, String lang, String gender, boolean local, String label) {
            this.id = id;
            this.lang = lang;
            this.gender = gender;
            this.local = local;
            this.label = label;
        }
    }

    /**
     * Google's speech engine names its voices like "hi-in-x-hie-local" / "-network". This table
     * gives the voice behind each code, as reported by users of the engine's voice list.
     * It is best effort (Google does not document it); unlisted codes are "unknown".
     */
    private static final Map<String, String> GOOGLE_VOICES = new HashMap<>();

    static {
        String[] female = {
            "hi-in-x-hia", "hi-in-x-hic",
            "en-in-x-ena", "en-in-x-enc", "en-in-x-ahp", "en-in-x-cxx",
            "en-us-x-sfg", "en-us-x-iob", "en-us-x-iog", "en-us-x-tpc", "en-us-x-tpf",
            "en-gb-x-gba", "en-gb-x-gbc", "en-gb-x-gbg", "en-gb-x-fis",
        };
        String[] male = {
            "hi-in-x-hid", "hi-in-x-hie",
            "en-in-x-end", "en-in-x-ene",
            "en-us-x-iol", "en-us-x-iom", "en-us-x-tpd",
            "en-gb-x-gbb", "en-gb-x-gbd", "en-gb-x-rjs",
        };
        for (String code : female) {
            GOOGLE_VOICES.put(code, FEMALE);
        }
        for (String code : male) {
            GOOGLE_VOICES.put(code, MALE);
        }
    }

    /**
     * Best-effort gender of a voice: first from engine feature hints ("female", "male",
     * "gender=female" …), then from the name (words like "female"/"male", Samsung's
     * "SMTf"/"SMTm" codes, Google's known voice codes), else "unknown".
     */
    static String guessGender(String name, Collection<String> features) {
        if (features != null) {
            for (String feature : features) {
                String g = genderWord(feature);
                if (g != null) {
                    return g;
                }
            }
        }
        if (name == null || name.isEmpty()) {
            return UNKNOWN;
        }
        String n = name.toLowerCase(Locale.ROOT);
        String g = genderWord(n);
        if (g != null) {
            return g;
        }
        // Samsung: "hi-IN-SMTf00" (female), "en-IN-SMTm00" (male).
        int smt = n.indexOf("smt");
        if (smt >= 0 && smt + 3 < n.length()) {
            char c = n.charAt(smt + 3);
            if (c == 'f') {
                return FEMALE;
            }
            if (c == 'm') {
                return MALE;
            }
        }
        // Google: "hi-in-x-hie-local", "hi-in-x-hie-network", "hi-IN-x-hie".
        String code = n;
        for (String suffix : new String[] {"-local", "-network"}) {
            if (code.endsWith(suffix)) {
                code = code.substring(0, code.length() - suffix.length());
            }
        }
        String known = GOOGLE_VOICES.get(code);
        return known != null ? known : UNKNOWN;
    }

    /** "female"/"male" when the text contains that word (or gender=…), else null. */
    private static String genderWord(String text) {
        if (text == null) {
            return null;
        }
        String t = text.toLowerCase(Locale.ROOT);
        if (t.contains("female") || t.contains("woman")) {
            return FEMALE;
        }
        // "male" as a whole word only (not inside other words).
        String[] parts = t.split("[^a-z]+");
        for (String part : parts) {
            if (part.equals("male") || part.equals("man")) {
                return MALE;
            }
        }
        return null;
    }

    /** Short human-readable label, e.g. "हिंदी · hie (फ़ोन में)". */
    static String label(String lang, String name, boolean local) {
        String language = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("hi") ? "हिंदी" : "English";
        String shortName = name == null ? "" : name;
        String n = shortName.toLowerCase(Locale.ROOT);
        int x = n.indexOf("-x-");
        if (x >= 0) {
            shortName = shortName.substring(x + 3);
            int dash = shortName.indexOf('-');
            if (dash > 0) {
                shortName = shortName.substring(0, dash);
            }
        }
        return language + " · " + shortName + (local ? " (फ़ोन में)" : " (इंटरनेट)");
    }

    /** Orders voices: Hindi first, Indian English next, on-phone voices before online ones. */
    static void sort(List<Entry> entries) {
        entries.sort(Comparator
                .comparingInt((Entry e) -> langRank(e.lang))
                .thenComparing(e -> !e.local)
                .thenComparing(e -> e.id));
    }

    private static int langRank(String lang) {
        String l = lang == null ? "" : lang.toLowerCase(Locale.ROOT);
        if (l.startsWith("hi")) {
            return 0;
        }
        if (l.equals("en-in")) {
            return 1;
        }
        return 2;
    }

    /** JSON array of {id, lang, gender, local, label}. */
    static String toJson(List<Entry> entries) {
        List<String> items = new ArrayList<>(entries.size());
        for (Entry e : entries) {
            items.add("{\"id\":" + ShellPolicy.quote(e.id)
                    + ",\"lang\":" + ShellPolicy.quote(e.lang)
                    + ",\"gender\":" + ShellPolicy.quote(e.gender)
                    + ",\"local\":" + e.local
                    + ",\"label\":" + ShellPolicy.quote(e.label) + "}");
        }
        return "[" + String.join(",", items) + "]";
    }
}
