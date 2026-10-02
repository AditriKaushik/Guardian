package org.guardian.buddy;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * The shell's security and plumbing rules, kept free of Android classes so they can be unit
 * tested on the JVM: which bundled file a URL maps to (and its MIME type), which addresses stay
 * inside the WebView, which may go to the browser, which bridge arguments are acceptable (and
 * which vibrations), which web permission requests are granted (the camera only), and how
 * events are written into JavaScript.
 */
final class ShellPolicy {

    private ShellPolicy() {
    }

    /** Where a navigation request may go. */
    enum Nav {
        /** The bundled web app: stays in the WebView. */
        APP,
        /** Another https page: opened in the phone's browser. */
        EXTERNAL,
        /** Anything else (javascript:, intent:, file:, http:, blocked hosts …): ignored. */
        BLOCK
    }

    /** TextToSpeech.getMaxSpeechInputLength() is 4000; stay a little below it. */
    static final int MAX_SPEECH_CHARS = 3900;
    /** Longest recognised text handed back to the page. */
    static final int MAX_HEARD_CHARS = 500;
    static final int MAX_ID_CHARS = 64;
    static final int MAX_VOICE_ID_CHARS = 200;
    static final int MAX_URL_CHARS = 2048;

    /** Files in web/ that make no sense inside the shell; requests for them get a 404. */
    private static final String[] HIDDEN_FILES = {"sw.js", "_headers"};

    // ---- Bundled files ----------------------------------------------------------------------

    /**
     * Maps a request URL on the app origin to a path inside the APK's assets, or returns null
     * when it is not on the app origin or is not a safe, servable file name (no "..", ".",
     * empty or hidden segments, backslashes or control characters; known file types only).
     * "/" and directory URLs map to their index.html. Query strings and fragments are ignored.
     */
    static String assetPath(String url) {
        String prefix = Config.APP_ORIGIN + "/";
        if (url == null || url.length() > MAX_URL_CHARS || !url.startsWith(prefix)) {
            return null;
        }
        String raw = url.substring(prefix.length());
        int cut = indexOfAny(raw, '?', '#');
        if (cut >= 0) {
            raw = raw.substring(0, cut);
        }
        String path = percentDecode(raw);
        if (path == null) {
            return null;
        }
        if (path.isEmpty() || path.endsWith("/")) {
            path = path + "index.html";
        }
        String[] segments = path.split("/", -1);
        for (String segment : segments) {
            if (segment.isEmpty() || segment.startsWith(".")) {
                return null;                       // "", ".", "..", ".hidden"
            }
            for (int i = 0; i < segment.length(); i++) {
                char c = segment.charAt(i);
                if (c < 0x20 || c == 0x7F || c == '\\' || c == ':') {
                    return null;
                }
            }
        }
        for (String hidden : HIDDEN_FILES) {
            if (path.equals(hidden)) {
                return null;
            }
        }
        return mimeType(path) == null ? null : path;
    }

    /** MIME type for a bundled file, or null for file types the shell does not serve. */
    static String mimeType(String path) {
        if (path == null) {
            return null;
        }
        int slash = path.lastIndexOf('/');
        int dot = path.lastIndexOf('.');
        if (dot <= slash + 1 || dot == path.length() - 1) {
            return null;                           // no extension (or a dot file)
        }
        switch (path.substring(dot + 1).toLowerCase(Locale.ROOT)) {
            case "html":
            case "htm":
                return "text/html";
            case "js":
            case "mjs":
                return "text/javascript";
            case "css":
                return "text/css";
            case "json":
                return "application/json";
            case "webmanifest":
                return "application/manifest+json";
            case "txt":
                return "text/plain";
            case "svg":
                return "image/svg+xml";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            case "gif":
                return "image/gif";
            case "ico":
                return "image/x-icon";
            case "woff2":
                return "font/woff2";
            case "woff":
                return "font/woff";
            case "ttf":
                return "font/ttf";
            case "mp3":
                return "audio/mpeg";
            case "ogg":
            case "oga":
            case "opus":
                return "audio/ogg";
            case "m4a":
                return "audio/mp4";
            case "wav":
                return "audio/wav";
            default:
                return null;
        }
    }

    /** "utf-8" for text types, null for binary ones (what WebResourceResponse expects). */
    static String encodingFor(String mimeType) {
        if (mimeType == null) {
            return null;
        }
        boolean text = mimeType.startsWith("text/") || mimeType.equals("application/json")
                || mimeType.equals("application/manifest+json") || mimeType.equals("image/svg+xml");
        return text ? "utf-8" : null;
    }

    // ---- Navigation ---------------------------------------------------------------------------

    /** Decides what happens when the page tries to navigate to {@code url}. */
    static Nav navigation(String url) {
        URI uri = parseHttps(url);
        if (uri == null) {
            return Nav.BLOCK;
        }
        if (isAppHost(uri)) {
            return Nav.APP;
        }
        if (isBlockedHost(uri.getHost())) {
            return Nav.BLOCK;
        }
        return Nav.EXTERNAL;
    }

    /** True for any https URL on the app origin. */
    static boolean isAppUrl(String url) {
        URI uri = parseHttps(url);
        return uri != null && isAppHost(uri);
    }

    /** True for a URL NanhaNative.openExternal may open: https on one of Config.EXTERNAL_HOSTS. */
    static boolean isAllowedExternal(String url) {
        URI uri = parseHttps(url);
        if (uri == null) {
            return false;
        }
        for (String host : Config.EXTERNAL_HOSTS) {
            if (host.equalsIgnoreCase(uri.getHost())) {
                return true;
            }
        }
        return false;
    }

    /** True for https URLs whose host must never load inside the WebView (see Config). */
    static boolean isBlockedInApp(String url) {
        URI uri = parseHttps(url);
        return uri != null && isBlockedHost(uri.getHost());
    }

    private static boolean isAppHost(URI uri) {
        return Config.APP_HOST.equalsIgnoreCase(uri.getHost());
    }

    private static boolean isBlockedHost(String host) {
        String h = host.toLowerCase(Locale.ROOT);
        if (h.endsWith(".")) {
            h = h.substring(0, h.length() - 1);
        }
        for (String suffix : Config.BLOCKED_HOST_SUFFIXES) {
            if (h.equals(suffix) || h.endsWith("." + suffix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * True for the app origin itself, as WebView reports a requesting page's origin:
     * "https://appassets.androidplatform.net" with nothing after it but an optional "/".
     */
    static boolean isAppOrigin(String origin) {
        URI uri = parseHttps(origin);
        if (uri == null || !isAppHost(uri) || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            return false;
        }
        String path = uri.getRawPath();
        return path == null || path.isEmpty() || "/".equals(path);
    }

    /** Parses a plain https URL (host present, default port, no user info), else null. */
    private static URI parseHttps(String url) {
        if (url == null || url.isEmpty() || url.length() > MAX_URL_CHARS) {
            return null;
        }
        for (int i = 0; i < url.length(); i++) {
            char c = url.charAt(i);
            if (c <= ' ' || c == 0x7F || c == '\\') {
                return null;
            }
        }
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            return null;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.isOpaque()) {
            return null;
        }
        String host = uri.getHost();
        if (host == null || host.isEmpty() || uri.getRawUserInfo() != null) {
            return null;
        }
        int port = uri.getPort();
        if (port != -1 && port != 443) {
            return null;
        }
        return uri;
    }

    // ---- Bridge arguments ---------------------------------------------------------------------

    /**
     * The only speech languages the bridge accepts ("hi", "hi-IN", "en", "en-IN"), as the
     * BCP-47 tag the shell uses ("hi-IN" or "en-IN"); null for anything else.
     */
    static String speechTag(String lang) {
        if (lang == null) {
            return null;
        }
        switch (lang) {
            case "hi":
            case "hi-IN":
                return "hi-IN";
            case "en":
            case "en-IN":
                return "en-IN";
            default:
                return null;
        }
    }

    /** A request id from the page: 1–64 characters of [A-Za-z0-9._:-]. */
    static boolean validId(String id) {
        return matchesIdChars(id, MAX_ID_CHARS, false);
    }

    /** A voice id from voices(): empty (meaning "pick for me") or up to 200 safe characters. */
    static boolean validVoiceId(String id) {
        return id == null || id.isEmpty() || matchesIdChars(id, MAX_VOICE_ID_CHARS, true);
    }

    private static boolean matchesIdChars(String s, int max, boolean allowHash) {
        if (s == null || s.isEmpty() || s.length() > max) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || c == '.' || c == '_' || c == '-' || c == ':' || (allowHash && c == '#');
            if (!ok) {
                return false;
            }
        }
        return true;
    }

    /** Parses a number sent as a string and keeps it within [min, max]; else the fallback. */
    static float clamp(String value, float fallback, float min, float max) {
        if (value == null || value.isEmpty() || value.length() > 16) {
            return fallback;
        }
        float f;
        try {
            f = Float.parseFloat(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
        if (Float.isNaN(f) || Float.isInfinite(f)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, f));
    }

    /**
     * Text to speak: emoji and separators removed (so they are not read out as "smiling
     * face"), whitespace collapsed, and cut to what the speech engine accepts.
     */
    static String cleanSpeech(String text) {
        if (text == null) {
            return "";
        }
        String stripped = text.replaceAll(
                "[\\x{1F000}-\\x{1FAFF}\\x{2190}-\\x{27BF}\\x{2B00}-\\x{2BFF}\\x{FE0F}\\x{200D}]", " ");
        String clean = stripped.replace("·", " ").replaceAll("\\s+", " ").trim();
        return clip(clean, MAX_SPEECH_CHARS);
    }

    /** Cuts to at most {@code max} chars without splitting a surrogate pair. */
    static String clip(String s, int max) {
        if (s == null || s.length() <= max) {
            return s;
        }
        int end = max;
        if (Character.isHighSurrogate(s.charAt(end - 1))) {
            end--;
        }
        return s.substring(0, end);
    }

    // ---- Web permissions (the camera) ---------------------------------------------------------

    /** android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE (same text; no Android import). */
    static final String VIDEO_CAPTURE = "android.webkit.resource.VIDEO_CAPTURE";

    /**
     * Decides a web permission request (WebChromeClient.onPermissionRequest): true only when
     * the bundled app (its exact origin) asks for the camera alone — every requested resource
     * is {@link #VIDEO_CAPTURE}. Everything else is refused as a whole: the microphone (speech
     * uses the phone's own recogniser, NanhaNative.listen), protected media (DRM), MIDI,
     * resources unknown to this version, any other origin, and mixed requests such as camera +
     * microphone (WebView cannot grant only part of a request).
     */
    static boolean allowsCamera(String origin, String[] resources) {
        if (!isAppOrigin(origin) || resources == null || resources.length == 0) {
            return false;
        }
        for (String resource : resources) {
            if (!VIDEO_CAPTURE.equals(resource)) {
                return false;
            }
        }
        return true;
    }

    // ---- Haptics ------------------------------------------------------------------------------

    /** VibrationEffect.DEFAULT_AMPLITUDE: the phone's normal strength. */
    static final int DEFAULT_AMPLITUDE = -1;

    /**
     * One of the few short vibrations NanhaNative.vibrate may play. {@code timings} alternate
     * pause/pulse in milliseconds, starting with the pause before the first pulse (the layout
     * of VibrationEffect.createWaveform and the old Vibrator.vibrate(long[], -1));
     * {@code amplitudes} has one strength per segment: 0 for pauses, 1–255 or
     * {@link #DEFAULT_AMPLITUDE} for pulses.
     */
    static final class Haptic {
        final long[] timings;
        final int[] amplitudes;

        Haptic(long[] timings, int[] amplitudes) {
            this.timings = timings;
            this.amplitudes = amplitudes;
        }
    }

    /**
     * The vibration for a NanhaNative.vibrate pattern name, or null for anything else — the
     * page picks a name, never a length, so it cannot make the phone buzz for long:
     * "tap" (10 ms), "soft" (20 ms, gentler where the phone can vary the strength) and
     * "success" (two short pulses).
     */
    static Haptic haptic(String pattern) {
        if (pattern == null) {
            return null;
        }
        switch (pattern) {
            case "tap":
                return new Haptic(new long[] {0, 10}, new int[] {0, DEFAULT_AMPLITUDE});
            case "soft":
                return new Haptic(new long[] {0, 20}, new int[] {0, 96});
            case "success":
                return new Haptic(new long[] {0, 20, 80, 20},
                        new int[] {0, DEFAULT_AMPLITUDE, 0, DEFAULT_AMPLITUDE});
            default:
                return null;
        }
    }

    // ---- Events into JavaScript --------------------------------------------------------------

    /** The JavaScript that delivers one event (a JSON text) to the page. */
    static String eventScript(String json) {
        return "window.NS&&NS.native&&typeof NS.native.onEvent==='function'&&NS.native.onEvent("
                + quote(json) + ")";
    }

    /** Asks the page to handle Back; evaluates to true when it did. */
    static final String BACK_SCRIPT =
            "(function(){try{return !!(window.NS&&NS.back&&NS.back());}catch(e){return false;}})()";

    static String resumeEvent() {
        return "{\"type\":\"resume\"}";
    }

    /** Sent when the phone's voices become available (call voices() again). */
    static String voicesEvent() {
        return "{\"type\":\"voices\"}";
    }

    static String speakDoneEvent(String id) {
        return "{\"type\":\"speak-done\",\"id\":" + quote(id) + "}";
    }

    static String listenResultEvent(String id, String text) {
        return "{\"type\":\"listen-result\",\"id\":" + quote(id)
                + ",\"text\":" + (text == null ? "null" : quote(clip(text, MAX_HEARD_CHARS))) + "}";
    }

    /**
     * A JSON string literal, which is also a safe JavaScript string literal: quotes,
     * backslashes, control characters and U+2028/U+2029 are escaped, and "&lt;" too.
     */
    static String quote(String s) {
        if (s == null) {
            return "null";
        }
        StringBuilder b = new StringBuilder(s.length() + 2);
        b.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    b.append("\\\"");
                    break;
                case '\\':
                    b.append("\\\\");
                    break;
                case '\n':
                    b.append("\\n");
                    break;
                case '\r':
                    b.append("\\r");
                    break;
                case '\t':
                    b.append("\\t");
                    break;
                case '\b':
                    b.append("\\b");
                    break;
                case '\f':
                    b.append("\\f");
                    break;
                default:
                    if (c < 0x20 || c == 0x7F || c == ' ' || c == ' ' || c == '<') {
                        b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
            }
        }
        return b.append('"').toString();
    }

    // ---- Helpers ------------------------------------------------------------------------------

    private static int indexOfAny(String s, char a, char b) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == a || c == b) {
                return i;
            }
        }
        return -1;
    }

    /** Strict UTF-8 percent-decoding; null for malformed escapes or invalid UTF-8. */
    static String percentDecode(String s) {
        if (s.indexOf('%') < 0) {
            return s;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '%') {
                if (i + 2 >= s.length()) {
                    return null;
                }
                int hi = Character.digit(s.charAt(i + 1), 16);
                int lo = Character.digit(s.charAt(i + 2), 16);
                if (hi < 0 || lo < 0) {
                    return null;
                }
                out.write((hi << 4) | lo);
                i += 2;
            } else if (c < 0x80) {
                out.write(c);
            } else {
                return null;                       // Chromium always escapes non-ASCII
            }
        }
        java.nio.charset.CharsetDecoder decoder = java.nio.charset.StandardCharsets.UTF_8.newDecoder();
        try {
            return decoder.decode(java.nio.ByteBuffer.wrap(out.toByteArray())).toString();
        } catch (java.nio.charset.CharacterCodingException e) {
            return null;
        }
    }
}
