package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import org.junit.Test;

public class VoiceCatalogTest {

    private static String g(String name, String... features) {
        return VoiceCatalog.guessGender(name, new HashSet<>(Arrays.asList(features)));
    }

    @Test
    public void featureHintsWin() {
        assertEquals("female", g("hi-in-x-hid-local", "female"));
        assertEquals("male", g("whatever", "gender=male"));
        assertEquals("female", g("whatever", "networkTimeoutMs", "gender:female"));
        assertEquals("unknown", g("whatever", "networkTimeoutMs", "embeddedTts", "notInstalled"));
    }

    @Test
    public void namesAndCodes() {
        assertEquals("female", g("hi-IN-SMTf00"));
        assertEquals("male", g("en-IN-SMTm00"));
        assertEquals("female", g("hi-IN-language#female_2-local"));
        assertEquals("male", g("en-US-language#male_1-local"));
        assertEquals("female", g("hi-in-x-hia-local"));
        assertEquals("female", g("hi-in-x-hia-network"));
        assertEquals("male", g("hi-in-x-hie-local"));
        assertEquals("male", g("hi-IN-x-hid-network"));
        assertEquals("male", g("en-us-x-iom-local"));
        assertEquals("female", g("en-us-x-sfg-local"));
        assertEquals("unknown", g("hi-in-x-zzz-local"));
        assertEquals("unknown", g("Manisha"));
        assertEquals("unknown", g(""));
        assertEquals("unknown", VoiceCatalog.guessGender(null, null));
        assertEquals("unknown", VoiceCatalog.guessGender("hi-IN", Collections.emptySet()));
    }

    @Test
    public void labels() {
        assertEquals("हिंदी · hie (फ़ोन में)", VoiceCatalog.label("hi-IN", "hi-in-x-hie-local", true));
        assertEquals("English · ena (इंटरनेट)", VoiceCatalog.label("en-IN", "en-in-x-ena-network", false));
        assertEquals("हिंदी · hi-IN-SMTf00 (फ़ोन में)", VoiceCatalog.label("hi-IN", "hi-IN-SMTf00", true));
    }

    @Test
    public void sortsAndSerialises() {
        List<VoiceCatalog.Entry> list = new ArrayList<>();
        list.add(new VoiceCatalog.Entry("en-us-x-iom-local", "en-US", "male", true, "English · iom"));
        list.add(new VoiceCatalog.Entry("hi-in-x-hia-network", "hi-IN", "female", false, "हिंदी · hia"));
        list.add(new VoiceCatalog.Entry("en-in-x-ena-local", "en-IN", "female", true, "English · ena"));
        list.add(new VoiceCatalog.Entry("hi-in-x-hie-local", "hi-IN", "male", true, "हिंदी · \"hie\""));
        VoiceCatalog.sort(list);
        assertEquals("hi-in-x-hie-local", list.get(0).id);
        assertEquals("hi-in-x-hia-network", list.get(1).id);
        assertEquals("en-in-x-ena-local", list.get(2).id);
        assertEquals("en-us-x-iom-local", list.get(3).id);
        String json = VoiceCatalog.toJson(list.subList(0, 1));
        assertEquals("[{\"id\":\"hi-in-x-hie-local\",\"lang\":\"hi-IN\",\"gender\":\"male\",\"local\":true,"
                + "\"label\":\"हिंदी · \\\"hie\\\"\"}]", json);
        assertTrue(VoiceCatalog.toJson(new ArrayList<>()).equals("[]"));
    }
}
