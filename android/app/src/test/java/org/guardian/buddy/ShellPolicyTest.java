package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ShellPolicyTest {

    private static final String O = "https://appassets.androidplatform.net";

    // ---- asset paths ----

    @Test
    public void mapsAppUrlsToAssets() {
        assertEquals("index.html", ShellPolicy.assetPath(O + "/"));
        assertEquals("index.html", ShellPolicy.assetPath(O + "/index.html"));
        assertEquals("index.html", ShellPolicy.assetPath(O + "/index.html?x=1#top"));
        assertEquals("js/core/ns.js", ShellPolicy.assetPath(O + "/js/core/ns.js"));
        assertEquals("legal/index.html", ShellPolicy.assetPath(O + "/legal/"));
        assertEquals("fonts/baloo2-latin.woff2", ShellPolicy.assetPath(O + "/fonts/baloo2-latin.woff2"));
        assertEquals("audio/a b.mp3", ShellPolicy.assetPath(O + "/audio/a%20b.mp3"));
        assertEquals("audio/क.mp3", ShellPolicy.assetPath(O + "/audio/%E0%A4%95.mp3"));
    }

    @Test
    public void refusesTraversalAndOddPaths() {
        assertNull(ShellPolicy.assetPath(O + "/../secret.js"));
        assertNull(ShellPolicy.assetPath(O + "/js/../../x.js"));
        assertNull(ShellPolicy.assetPath(O + "/%2e%2e/x.js"));
        assertNull(ShellPolicy.assetPath(O + "/js/%2E%2E/x.js"));
        assertNull(ShellPolicy.assetPath(O + "/js/..%2Fx.js"));
        assertNull(ShellPolicy.assetPath(O + "/js/./x.js"));
        assertNull(ShellPolicy.assetPath(O + "//x.js"));
        assertNull(ShellPolicy.assetPath(O + "/js//x.js"));
        assertNull(ShellPolicy.assetPath(O + "/.git/config.json"));
        assertNull(ShellPolicy.assetPath(O + "/js\\x.js"));
        assertNull(ShellPolicy.assetPath(O + "/js%5Cx.js"));
        assertNull(ShellPolicy.assetPath(O + "/x%00.js"));
        assertNull(ShellPolicy.assetPath(O + "/x%.js"));
        assertNull(ShellPolicy.assetPath(O + "/x%zz.js"));
        assertNull(ShellPolicy.assetPath(O + "/x%C3.js"));        // invalid UTF-8
        assertNull(ShellPolicy.assetPath(O + "/a:b.js"));
    }

    @Test
    public void refusesOtherOriginsAndUnservableFiles() {
        assertNull(ShellPolicy.assetPath(null));
        assertNull(ShellPolicy.assetPath("https://example.com/index.html"));
        assertNull(ShellPolicy.assetPath("http://appassets.androidplatform.net/index.html"));
        assertNull(ShellPolicy.assetPath("https://appassets.androidplatform.net.evil.com/index.html"));
        assertNull(ShellPolicy.assetPath("https://appassets.androidplatform.net:8443/index.html"));
        assertNull(ShellPolicy.assetPath(O + "/sw.js"));
        assertNull(ShellPolicy.assetPath(O + "/_headers"));
        assertNull(ShellPolicy.assetPath(O + "/README"));
        assertNull(ShellPolicy.assetPath(O + "/legal"));
        assertNull(ShellPolicy.assetPath(O + "/x.exe"));
        assertNull(ShellPolicy.assetPath(O + "/x.md"));
    }

    @Test
    public void mimeTypes() {
        assertEquals("text/html", ShellPolicy.mimeType("index.html"));
        assertEquals("text/javascript", ShellPolicy.mimeType("js/core/ns.js"));
        assertEquals("text/css", ShellPolicy.mimeType("app.css"));
        assertEquals("application/json", ShellPolicy.mimeType("audio/manifest.json"));
        assertEquals("application/manifest+json", ShellPolicy.mimeType("manifest.webmanifest"));
        assertEquals("image/svg+xml", ShellPolicy.mimeType("icon.svg"));
        assertEquals("font/woff2", ShellPolicy.mimeType("fonts/a.WOFF2"));
        assertEquals("audio/mpeg", ShellPolicy.mimeType("audio/a.mp3"));
        assertEquals("audio/ogg", ShellPolicy.mimeType("audio/a.ogg"));
        assertEquals("image/png", ShellPolicy.mimeType("a.png"));
        assertNull(ShellPolicy.mimeType("Makefile"));
        assertNull(ShellPolicy.mimeType(".htaccess"));
        assertNull(ShellPolicy.mimeType("dir.js/file"));
        assertNull(ShellPolicy.mimeType("trailing."));
        assertNull(ShellPolicy.mimeType(null));
        assertEquals("utf-8", ShellPolicy.encodingFor("text/html"));
        assertEquals("utf-8", ShellPolicy.encodingFor("image/svg+xml"));
        assertNull(ShellPolicy.encodingFor("font/woff2"));
        assertNull(ShellPolicy.encodingFor("audio/mpeg"));
    }

    // ---- navigation and external links ----

    @Test
    public void navigation() {
        assertEquals(ShellPolicy.Nav.APP, ShellPolicy.navigation(O + "/index.html#home"));
        assertEquals(ShellPolicy.Nav.APP, ShellPolicy.navigation(O + "/legal/privacy.html"));
        assertEquals(ShellPolicy.Nav.EXTERNAL, ShellPolicy.navigation("https://example.org/page"));
        assertEquals(ShellPolicy.Nav.EXTERNAL, ShellPolicy.navigation("https://aditrikaushik.github.io/Guardian/pay.html"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https://checkout.razorpay.com/v1/x"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https://razorpay.com/"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("http://example.org/"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("javascript:alert(1)"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("intent://open#Intent;scheme=x;end"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("file:///sdcard/x.html"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("content://x/y"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("data:text/html,hi"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("nanhaschool://open"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https://user@example.org/"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https://example.org:8080/"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https:///nohost"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation("https://exa mple.org/"));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation(""));
        assertEquals(ShellPolicy.Nav.BLOCK, ShellPolicy.navigation(null));
    }

    @Test
    public void appUrl() {
        assertTrue(ShellPolicy.isAppUrl(O + "/index.html"));
        assertTrue(ShellPolicy.isAppUrl(O + "/"));
        assertFalse(ShellPolicy.isAppUrl("http://appassets.androidplatform.net/index.html"));
        assertFalse(ShellPolicy.isAppUrl("https://appassets.androidplatform.net.evil.com/"));
        assertFalse(ShellPolicy.isAppUrl("https://evil.com/?https://appassets.androidplatform.net/"));
        assertFalse(ShellPolicy.isAppUrl("about:blank"));
        assertFalse(ShellPolicy.isAppUrl(null));
    }

    @Test
    public void externalAllowList() {
        assertTrue(ShellPolicy.isAllowedExternal("https://aditrikaushik.github.io/Guardian/pay.html#s=sub_1&k=rzp_test_1"));
        assertTrue(ShellPolicy.isAllowedExternal("https://AditriKaushik.github.io/Guardian/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("http://aditrikaushik.github.io/Guardian/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("https://evil.github.io/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("https://aditrikaushik.github.io.evil.com/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("https://x@aditrikaushik.github.io/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("https://aditrikaushik.github.io:444/pay.html"));
        assertFalse(ShellPolicy.isAllowedExternal("intent://aditrikaushik.github.io/#Intent;end"));
        assertFalse(ShellPolicy.isAllowedExternal("javascript:alert(1)//aditrikaushik.github.io"));
        assertFalse(ShellPolicy.isAllowedExternal(O + "/index.html"));
        assertFalse(ShellPolicy.isAllowedExternal(null));
        StringBuilder longUrl = new StringBuilder("https://aditrikaushik.github.io/");
        while (longUrl.length() <= ShellPolicy.MAX_URL_CHARS) {
            longUrl.append('a');
        }
        assertFalse(ShellPolicy.isAllowedExternal(longUrl.toString()));
    }

    @Test
    public void blockedInApp() {
        assertTrue(ShellPolicy.isBlockedInApp("https://checkout.razorpay.com/v1/checkout.js"));
        assertTrue(ShellPolicy.isBlockedInApp("https://api.razorpay.com/"));
        assertFalse(ShellPolicy.isBlockedInApp("https://notrazorpay.com/"));
        assertFalse(ShellPolicy.isBlockedInApp("https://nanha.example.workers.dev/api/restore"));
        assertFalse(ShellPolicy.isBlockedInApp(O + "/index.html"));
    }

    // ---- bridge arguments ----

    @Test
    public void languageWhitelist() {
        assertEquals("hi-IN", ShellPolicy.speechTag("hi"));
        assertEquals("hi-IN", ShellPolicy.speechTag("hi-IN"));
        assertEquals("en-IN", ShellPolicy.speechTag("en"));
        assertEquals("en-IN", ShellPolicy.speechTag("en-IN"));
        assertNull(ShellPolicy.speechTag("en-US"));
        assertNull(ShellPolicy.speechTag("HI"));
        assertNull(ShellPolicy.speechTag("hinglish"));
        assertNull(ShellPolicy.speechTag("fr"));
        assertNull(ShellPolicy.speechTag(""));
        assertNull(ShellPolicy.speechTag(null));
    }

    @Test
    public void ids() {
        assertTrue(ShellPolicy.validId("s1"));
        assertTrue(ShellPolicy.validId("speak:42_a.b-c"));
        assertFalse(ShellPolicy.validId(""));
        assertFalse(ShellPolicy.validId(null));
        assertFalse(ShellPolicy.validId("a\"b"));
        assertFalse(ShellPolicy.validId("a b"));
        assertFalse(ShellPolicy.validId("x".repeat(65)));
        assertTrue(ShellPolicy.validId("x".repeat(64)));
        assertTrue(ShellPolicy.validVoiceId(""));
        assertTrue(ShellPolicy.validVoiceId(null));
        assertTrue(ShellPolicy.validVoiceId("hi-in-x-hie-local"));
        assertTrue(ShellPolicy.validVoiceId("hi-IN-SMTf00"));
        assertTrue(ShellPolicy.validVoiceId("hi-IN-language#female_1-local"));
        assertFalse(ShellPolicy.validVoiceId("x');alert(1)//"));
        assertFalse(ShellPolicy.validVoiceId("x".repeat(201)));
    }

    @Test
    public void clampsNumbers() {
        assertEquals(1f, ShellPolicy.clamp(null, 1f, 0.3f, 2f), 0f);
        assertEquals(1f, ShellPolicy.clamp("", 1f, 0.3f, 2f), 0f);
        assertEquals(1f, ShellPolicy.clamp("abc", 1f, 0.3f, 2f), 0f);
        assertEquals(1f, ShellPolicy.clamp("NaN", 1f, 0.3f, 2f), 0f);
        assertEquals(1f, ShellPolicy.clamp("Infinity", 1f, 0.3f, 2f), 0f);
        assertEquals(0.85f, ShellPolicy.clamp("0.85", 1f, 0.3f, 2f), 1e-6f);
        assertEquals(2f, ShellPolicy.clamp("9", 1f, 0.3f, 2f), 0f);
        assertEquals(0.3f, ShellPolicy.clamp("-1", 1f, 0.3f, 2f), 0f);
    }

    @Test
    public void cleansSpeech() {
        assertEquals("A for Apple", ShellPolicy.cleanSpeech("🍎 A for Apple"));
        assertEquals("क से कमल", ShellPolicy.cleanSpeech("क · से  कमल ✨"));
        assertEquals("", ShellPolicy.cleanSpeech(null));
        assertEquals(ShellPolicy.MAX_SPEECH_CHARS, ShellPolicy.cleanSpeech("a".repeat(5000)).length());
        // never splits a surrogate pair
        String s = "a".repeat(9) + "\uD835\uDC00";
        assertEquals(9, ShellPolicy.clip(s, 10).length());
    }

    // ---- events ----

    @Test
    public void quotesSafely() {
        assertEquals("\"a\\\"b\\\\c\"", ShellPolicy.quote("a\"b\\c"));
        assertEquals("\"\\n\\r\\t\\u0001\\u2028\\u2029\\u003c/script>\"",
                ShellPolicy.quote("\n\r\t\u0001\u2028\u2029</script>"));
        assertEquals("\"नमस्ते\"", ShellPolicy.quote("नमस्ते"));
        assertEquals("null", ShellPolicy.quote(null));
    }

    @Test
    public void events() {
        assertEquals("{\"type\":\"resume\"}", ShellPolicy.resumeEvent());
        assertEquals("{\"type\":\"speak-done\",\"id\":\"s1\"}", ShellPolicy.speakDoneEvent("s1"));
        assertEquals("{\"type\":\"listen-result\",\"id\":\"l1\",\"text\":null}",
                ShellPolicy.listenResultEvent("l1", null));
        assertEquals("{\"type\":\"listen-result\",\"id\":\"l1\",\"text\":\"हाथी \\\"बड़ा\\\"\"}",
                ShellPolicy.listenResultEvent("l1", "हाथी \"बड़ा\""));
        String script = ShellPolicy.eventScript("{\"type\":\"resume\"}");
        assertEquals("window.NS&&NS.native&&typeof NS.native.onEvent==='function'&&NS.native.onEvent("
                + "\"{\\\"type\\\":\\\"resume\\\"}\")", script);
        // A hostile recognised text cannot break out of the string literal.
        String evil = ShellPolicy.eventScript(ShellPolicy.listenResultEvent("l", "\");alert(1);//\u2028"));
        // the quote arrives double-escaped (\\\") so it stays inside the outer string literal
        assertTrue(evil.contains("\\\\\\\");alert"));
        assertFalse(evil.replace("\\\\", "").replace("\\\"", "").contains("\");alert"));
        assertFalse(evil.contains("\u2028"));
    }
}
