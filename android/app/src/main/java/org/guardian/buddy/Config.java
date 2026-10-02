package org.guardian.buddy;

/**
 * Settings for the Android shell. The app itself (lessons, profiles, payments) is the web app
 * in the repository's web/ folder, bundled into the APK as assets; this file only says where
 * the shell serves it from and which outside addresses it may hand to the phone's browser.
 *
 * <p>Nothing in this file is secret.
 */
public final class Config {

    private Config() {
    }

    /**
     * The web app is served from this host, intercepted inside the WebView and read from the
     * APK's assets: it never touches the network, but gives the app a real HTTPS origin.
     * The payment server must list {@link #APP_ORIGIN} in ALLOWED_ORIGINS (server/wrangler.toml).
     */
    public static final String APP_HOST = "appassets.androidplatform.net";

    /** Origin of the web app inside the shell. */
    public static final String APP_ORIGIN = "https://" + APP_HOST;

    /** The page the shell opens. */
    public static final String START_URL = APP_ORIGIN + "/index.html";

    /**
     * The checkout page the web app opens in the phone's browser (NanhaNative.openExternal),
     * as PAY_PAGE_URL#s=&lt;subscription id&gt;&amp;k=&lt;Razorpay key id&gt;. Kept here for
     * reference; the address the app actually uses comes from web/config.js.
     */
    public static final String PAY_PAGE_URL = "https://aditrikaushik.github.io/Guardian/pay.html";

    /**
     * The only hosts NanhaNative.openExternal may open (https only). If the payment page moves
     * (for example to a custom domain), add its host here.
     */
    static final String[] EXTERNAL_HOSTS = {"aditrikaushik.github.io"};

    /**
     * Hosts (and their subdomains) that may never load inside the shell's WebView. In the
     * Android app Razorpay's checkout runs in the phone's browser, never in a frame inside the
     * app, so no third-party page can ever share a WebView with the native bridge.
     */
    static final String[] BLOCKED_HOST_SUFFIXES = {"razorpay.com"};

    /**
     * Sent as a header with every bundled file. It must stay identical to the
     * Content-Security-Policy &lt;meta&gt; in web/index.html (a unit test checks this), because a
     * page is limited by both policies at once.
     */
    static final String CONTENT_SECURITY_POLICY = "default-src 'self'; "
            + "script-src 'self' https://checkout.razorpay.com https://cdn.razorpay.com; "
            + "style-src 'self' 'unsafe-inline'; "
            + "font-src 'self'; "
            + "img-src 'self' data: https://*.razorpay.com; "
            + "media-src 'self'; "
            + "connect-src 'self' https://*.workers.dev https://*.razorpay.com; "
            + "frame-src https://*.razorpay.com; "
            + "form-action 'self' https://*.razorpay.com; "
            + "worker-src 'self'; "
            + "manifest-src 'self'; "
            + "object-src 'none'; "
            + "base-uri 'none'";
}
