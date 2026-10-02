package org.guardian.buddy;

import android.webkit.JavascriptInterface;

/**
 * window.NanhaNative — the web app's door to the phone (see docs/ARCHITECTURE.md, "Native
 * bridge"). Methods run on WebView's bridge thread: each one checks its arguments, does
 * nothing unless the WebView is showing the bundled app (https://appassets.androidplatform.net),
 * and hands the work to the UI thread. Results come back as events via NS.native.onEvent.
 *
 * <p>Parameters are strings (the page passes String(n) for numbers), except secure().
 */
final class NanhaBridge {

    static final String NAME = "NanhaNative";

    private final WebViewActivity shell;

    NanhaBridge(WebViewActivity shell) {
        this.shell = shell;
    }

    /** Always "android". */
    @JavascriptInterface
    public String platform() {
        return "android";
    }

    /** JSON array [{id, lang, gender, local, label}] of installed Hindi/English voices. */
    @JavascriptInterface
    public String voices() {
        if (!shell.isOnAppPage()) {
            return "[]";
        }
        return shell.speech().voicesJson();
    }

    /**
     * Speaks {@code text}; emits {"type":"speak-done","id":id} when finished, stopped or failed.
     * lang: "hi", "hi-IN", "en" or "en-IN". voiceId: an id from voices(), or "" for automatic.
     * rate/pitch: numbers as strings (1 = normal), kept within 0.3–2.0 and 0.5–2.0.
     */
    @JavascriptInterface
    public void speak(String id, String text, String lang, String voiceId, String rate, String pitch) {
        if (!shell.isOnAppPage() || !ShellPolicy.validId(id)) {
            return;
        }
        String tag = ShellPolicy.speechTag(lang);
        String clean = ShellPolicy.cleanSpeech(text);
        if (tag == null || !ShellPolicy.validVoiceId(voiceId)) {
            shell.emit(ShellPolicy.speakDoneEvent(id));
            return;
        }
        float r = ShellPolicy.clamp(rate, 1f, 0.3f, 2f);
        float p = ShellPolicy.clamp(pitch, 1f, 0.5f, 2f);
        shell.runOnUiThread(() -> shell.speech().speak(id, clean, tag, voiceId, r, p));
    }

    /** Stops speaking. */
    @JavascriptInterface
    public void stop() {
        if (shell.isOnAppPage()) {
            shell.runOnUiThread(() -> shell.speech().stop());
        }
    }

    /**
     * On-device speech recognition; emits {"type":"listen-result","id":id,"text":"…"|null}.
     * The first call asks for the microphone permission.
     */
    @JavascriptInterface
    public void listen(String id, String lang) {
        if (!shell.isOnAppPage() || !ShellPolicy.validId(id)) {
            return;
        }
        String tag = ShellPolicy.speechTag(lang);
        if (tag == null) {
            shell.emit(ShellPolicy.listenResultEvent(id, null));
            return;
        }
        shell.runOnUiThread(() -> shell.listener().listen(id, tag));
    }

    /**
     * Opens an https page on an allowed host (Config.EXTERNAL_HOSTS — the payment page) in the
     * phone's browser. Returns false (and does nothing) for any other address.
     */
    @JavascriptInterface
    public boolean openExternal(String url) {
        if (!shell.isOnAppPage() || !ShellPolicy.isAllowedExternal(url)) {
            return false;
        }
        shell.runOnUiThread(() -> shell.openInBrowser(url));
        return true;
    }

    /**
     * secure(true) while a grown-ups' screen is showing (payment, restore code): the screen
     * can't be captured in screenshots, recordings or the recent-apps preview. secure(false)
     * when leaving it.
     */
    @JavascriptInterface
    public void secure(boolean on) {
        if (shell.isOnAppPage()) {
            shell.runOnUiThread(() -> shell.setSecure(on));
        }
    }
}
