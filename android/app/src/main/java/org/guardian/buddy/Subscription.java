package org.guardian.buddy;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/**
 * The 7-day free trial and the paid subscription, kept only on this phone in private
 * storage (never backed up — see res/xml/data_extraction_rules.xml).
 *
 * <p>What is stored: when the trial started, the latest time the app has seen (so turning
 * the phone's date back does not extend anything), the signed pass from the server, the
 * parent's restore code, and — only while a payment is in progress — the new
 * subscription's ID and restore code. No name, email or phone number is ever stored.
 *
 * <p>While payments are off ({@link Config#paymentsOn()}), everything is open.
 */
public final class Subscription {

    static final String PREFS = "nanha_school";
    private static final String KEY_TRIAL_START = "trial_start";
    private static final String KEY_LAST_SEEN = "last_seen";
    private static final String KEY_PASS = "pass";
    private static final String KEY_RESTORE = "restore";
    private static final String KEY_PENDING_SUB = "pending_sub";
    private static final String KEY_PENDING_CODE = "pending_code";

    /** The "latest time seen" is written at most once a minute. */
    private static final long LAST_SEEN_STEP_MS = 60_000L;

    /** Result codes of {@link #acceptPass}, shown to parents through ParentActivity's messages. */
    static final String BAD_PASS = "bad_pass";
    static final String PASS_EXPIRED = "pass_expired";

    // The last pass that checked out, so its signature is not re-checked on every tap.
    private static String verifiedToken;
    private static PassVerifier.Pass verifiedPass;

    private final SharedPreferences prefs;

    public Subscription(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean paymentsOn() {
        return Config.paymentsOn();
    }

    // ---- Clock and trial ---------------------------------------------------

    /** The current time (ms) from a clock that never runs backwards. */
    public long now() {
        long seen = getLong(KEY_LAST_SEEN);
        long t = Entitlement.clock(System.currentTimeMillis(), seen);
        if (t >= seen + LAST_SEEN_STEP_MS || seen == 0) {
            prefs.edit().putLong(KEY_LAST_SEEN, t).apply();
        }
        return t;
    }

    /** Days of free trial left (0 when it is over). The trial starts the first time this is asked. */
    public int trialDaysLeft() {
        long t = now();
        long start = getLong(KEY_TRIAL_START);
        if (start <= 0) {
            start = t;
            prefs.edit().putLong(KEY_TRIAL_START, start).apply();
        }
        return Entitlement.trialDaysLeft(start, t, Config.TRIAL_DAYS);
    }

    /**
     * Uses the server's clock (from a reply over HTTPS) to undo a phone date that was once set
     * in the future, so a paid pass or the trial is not cut short by it. Never moves time
     * earlier than the real time.
     */
    void syncClock(long serverTime) {
        long seen = getLong(KEY_LAST_SEEN);
        long start = getLong(KEY_TRIAL_START);
        long fixedSeen = Entitlement.correctedTime(seen, serverTime);
        long fixedStart = start > 0 ? Entitlement.correctedTime(start, serverTime) : start;
        if (fixedSeen != seen || fixedStart != start) {
            SharedPreferences.Editor editor = prefs.edit().putLong(KEY_LAST_SEEN, fixedSeen);
            if (start > 0) {
                editor.putLong(KEY_TRIAL_START, fixedStart);
            }
            editor.apply();
        }
    }

    // ---- Access ------------------------------------------------------------

    /** The stored pass if it is genuine (it may have expired), otherwise null. */
    public PassVerifier.Pass storedPass() {
        if (!paymentsOn()) {
            return null;
        }
        String token = getString(KEY_PASS);
        if (token == null) {
            return null;
        }
        PassVerifier.Pass pass = verify(token);
        if (pass == null) {
            prefs.edit().remove(KEY_PASS).apply();   // not genuine: forget it
        }
        return pass;
    }

    /** True while a genuine pass has not run out. */
    public boolean isSubscribed() {
        PassVerifier.Pass pass = storedPass();
        return pass != null && Entitlement.isActive(pass.exp, now());
    }

    /** True when everything is open: payments off, subscribed, or still in the free trial. */
    public boolean hasAccess() {
        return !paymentsOn() || isSubscribed() || trialDaysLeft() > 0;
    }

    /** Whether a home-screen tile (by its title) is locked right now. */
    public boolean isTileLocked(String title) {
        return Entitlement.isTileLocked(title, hasAccess(), Config.FREE_TILES);
    }

    /** Whether the rhyme at this position in the list is locked right now. */
    public boolean isRhymeLocked(int index) {
        return Entitlement.isRhymeLocked(index, hasAccess(), Config.FREE_RHYMES);
    }

    // ---- Passes ------------------------------------------------------------

    /** The stored pass token, to send back to the server for renewing or cancelling. */
    public String passToken() {
        return storedPass() != null ? getString(KEY_PASS) : null;
    }

    /** The pass token if it should be renewed now (ends within three days or has ended), else null. */
    public String tokenToRefresh() {
        PassVerifier.Pass pass = storedPass();
        if (pass == null || !Entitlement.needsRefresh(pass.exp, now())) {
            return null;
        }
        return getString(KEY_PASS);
    }

    /**
     * Checks a pass from the server and keeps it if it is genuine and (when given) for the
     * expected subscription. Returns null when the pass is kept and active, otherwise
     * {@link #BAD_PASS} or {@link #PASS_EXPIRED}.
     */
    public String acceptPass(String token, String expectedSubscriptionId) {
        PassVerifier.Pass pass = token == null ? null : verify(token);
        if (pass == null
                || (expectedSubscriptionId != null && !expectedSubscriptionId.equals(pass.sid))) {
            return BAD_PASS;
        }
        prefs.edit().putString(KEY_PASS, token).apply();
        return Entitlement.isActive(pass.exp, now()) ? null : PASS_EXPIRED;
    }

    // ---- Restore code and pending payment ------------------------------------

    /** The parent's restore code (no personal data inside), or null if there is none yet. */
    public String restoreCode() {
        return getString(KEY_RESTORE);
    }

    public void setRestoreCode(String code) {
        prefs.edit().putString(KEY_RESTORE, code).apply();
    }

    /** True while a payment was started in the browser and has not been confirmed yet. */
    public boolean hasPendingPayment() {
        return pendingSubscriptionId() != null && pendingRestoreCode() != null;
    }

    public String pendingSubscriptionId() {
        return getString(KEY_PENDING_SUB);
    }

    public String pendingRestoreCode() {
        return getString(KEY_PENDING_CODE);
    }

    public void setPendingPayment(String subscriptionId, String restoreCode) {
        prefs.edit()
                .putString(KEY_PENDING_SUB, subscriptionId)
                .putString(KEY_PENDING_CODE, restoreCode)
                .apply();
    }

    public void clearPendingPayment() {
        prefs.edit().remove(KEY_PENDING_SUB).remove(KEY_PENDING_CODE).apply();
    }

    /**
     * Handles the server's answer to /api/restore for a restore code: keeps the pass and the
     * code, and ends any payment in progress. Returns null on success or an error code.
     */
    public String finishRestore(JSONObject answer, String restoreCode) {
        String subscriptionId = Entitlement.subscriptionOfRestoreCode(restoreCode);
        String result = acceptPass(ApiClient.string(answer, "token"), subscriptionId);
        if (result == null || PASS_EXPIRED.equals(result)) {
            // The server vouched for this code, so keep it. When only the phone's date is off,
            // the pending payment stays so it is checked again once the date is fixed.
            setRestoreCode(restoreCode);
        }
        if (result == null) {
            clearPendingPayment();
        }
        return result;
    }

    /**
     * Sends a request to the subscription server. On the way back the phone's clock is
     * checked against the server's before {@code callback} runs (on the main thread).
     */
    public void call(String path, JSONObject body, ApiClient.Callback callback) {
        ApiClient.post(path, body, response -> {
            syncClock(response.serverTime);
            callback.onDone(response);
        });
    }

    // ---- Helpers -----------------------------------------------------------

    private static synchronized PassVerifier.Pass verify(String token) {
        if (token.equals(verifiedToken)) {
            return verifiedPass;
        }
        PassVerifier.Pass pass = PassVerifier.verify(token, Config.PUBLIC_KEY_SPKI);
        if (pass != null) {
            verifiedToken = token;
            verifiedPass = pass;
        }
        return pass;
    }

    private long getLong(String key) {
        try {
            return prefs.getLong(key, 0L);
        } catch (ClassCastException e) {
            return 0L;
        }
    }

    private String getString(String key) {
        try {
            String value = prefs.getString(key, null);
            return value == null || value.isEmpty() ? null : value;
        } catch (ClassCastException e) {
            return null;
        }
    }
}
