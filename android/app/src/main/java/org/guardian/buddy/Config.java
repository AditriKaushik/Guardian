package org.guardian.buddy;

/**
 * Settings for the optional subscription (7-day free trial, then paid).
 *
 * <p>Payments stay OFF — the whole app is free, with no locks and no trial banner —
 * until {@link #API_BASE} and {@link #PUBLIC_KEY_SPKI} are both filled in and the
 * server address starts with {@code https://}. See docs/SUBSCRIPTION_SETUP.md.
 *
 * <p>Nothing in this file is secret: the server address and the public key are safe to
 * publish. The private signing key and the Razorpay secret live only on the server.
 */
public final class Config {

    private Config() {
    }

    /**
     * Address of the subscription server (the Cloudflare Worker in server/), for example
     * "https://nanha-school-api.yourname.workers.dev". Must start with https://.
     * Leave empty to keep payments off.
     */
    public static final String API_BASE = "";

    /**
     * The server's PUBLIC key, used to check subscription passes on the phone (so the
     * app keeps working offline). Paste the base64 "SPKI" line printed by
     * {@code npm run genkeys} in server/ (step 3). Leave empty to keep payments off.
     */
    public static final String PUBLIC_KEY_SPKI = "";

    /**
     * The web page that shows Razorpay's secure checkout. The app opens it in the phone's
     * browser as PAY_PAGE_URL#s=&lt;subscription id&gt;&amp;k=&lt;Razorpay key id&gt;; card, UPI
     * and contact details are typed there, never into this app.
     */
    public static final String PAY_PAGE_URL = "https://aditrikaushik.github.io/Guardian/pay.html";

    /** Shown on the payment screen. Keep it the same as your Razorpay plan. */
    public static final String PRICE_TEXT = "₹99 / महीना";

    /** Free trial length in days. Keep it the same as TRIAL_DAYS in server/wrangler.toml. */
    public static final int TRIAL_DAYS = 7;

    /** Home-screen tiles (by their title) that stay free forever after the trial. */
    static final String[] FREE_TILES = {"ABC", "अक्षर", "गिनती"};

    /** How many rhymes (from the top of the list) stay free forever after the trial. */
    public static final int FREE_RHYMES = 2;

    /** True when the subscription is switched on (server address and public key are set). */
    public static boolean paymentsOn() {
        return paymentsOn(API_BASE, PAY_PAGE_URL, PUBLIC_KEY_SPKI);
    }

    /** The rule behind {@link #paymentsOn()}, separate so it can be unit-tested. */
    static boolean paymentsOn(String apiBase, String payPageUrl, String publicKeySpki) {
        return isHttpsUrl(apiBase)
                && isHttpsUrl(payPageUrl)
                && PassVerifier.cachedPublicKey(publicKeySpki) != null;
    }

    /** True for a plausible https:// address with a host and no spaces. */
    static boolean isHttpsUrl(String url) {
        if (url == null || !url.startsWith("https://") || url.length() <= "https://".length()) {
            return false;
        }
        for (int i = 0; i < url.length(); i++) {
            char c = url.charAt(i);
            if (c <= ' ' || c == 0x7F) {
                return false;
            }
        }
        char first = url.charAt("https://".length());
        return first != '/' && first != '?' && first != '#';
    }
}
