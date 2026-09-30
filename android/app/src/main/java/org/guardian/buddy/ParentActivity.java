package org.guardian.buddy;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.os.SystemClock;
import android.text.InputFilter;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Random;
import java.util.regex.Pattern;

/**
 * The grown-ups' area: the parents' question, the subscription offer, confirming a
 * payment made in the browser, restoring premium with a restore code, and the account
 * (with cancelling).
 *
 * <p>A child only gets here through a locked tile or the parents' banner, and always meets
 * the grown-ups' question first. The one exception is the link back from the payment page
 * (nanhaschool://open): then the app only checks the payment and shows no payment screen.
 * Nothing is read from that link. Screenshots and screen recording are blocked here.
 */
public class ParentActivity extends Activity {

    private enum Mode { GATE, PAYWALL, RESTORE, THANKS, ACCOUNT, CHECKING }

    /** After this long away from the app, the grown-ups' question is asked again. */
    private static final long RELOCK_AFTER_MS = 5 * 60_000L;

    private static final Pattern KEY_ID = Pattern.compile("^rzp_[A-Za-z0-9_]{4,60}$");
    private static final String NO_BROWSER = "no_browser";
    private static final String ASK_AGAIN = "जवाब सही नहीं है। यह रहा नया सवाल।";
    private static final String WRONG_CODE = "यह कोड सही नहीं है। दोबारा जाँचें।";

    private static final String STATE_MODE = "mode";
    private static final String STATE_UNLOCKED = "unlocked";
    private static final String STATE_NOTE = "note";
    private static final String STATE_A = "gate_a";
    private static final String STATE_B = "gate_b";
    private static final String STATE_SAVED_AT = "saved_at";

    // Fixed view IDs, so Android keeps what was typed when the screen rotates.
    private static final int ID_ANSWER = 0x7A0001;
    private static final int ID_CODE = 0x7A0002;

    private static final int CREAM = 0xFFFFF8E7;
    private static final int ORANGE = 0xFFFF8A3D;
    private static final int TITLE = 0xFFE56A1C;
    private static final int TEXT = 0xFF2B2B2B;
    private static final int MUTED = 0xFF6B6B6B;
    private static final int GREEN = 0xFF2EAD6B;
    private static final int RED = 0xFFE53935;
    private static final int GREY = 0xFF9E9E9E;
    private static final int ERROR = 0xFFC62828;
    private static final int CODE_BG = 0xFFFFF1DC;

    private final Random random = new SecureRandom();

    private Subscription subscription;
    private Mode mode = Mode.GATE;
    private boolean unlocked;      // the grown-ups' question was answered in this visit
    private String note;           // a message that belongs to the current screen
    private ParentGate gate;
    private boolean checking;      // a payment check is running
    private boolean busy;          // a subscribe / restore / cancel request is running
    private boolean resumed;       // on screen right now
    private long stoppedAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep payment and account screens out of screenshots, recordings and the recent-apps preview.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE);
        subscription = new Subscription(this);
        if (!Config.paymentsOn()) {
            finish();   // everything is free, so there is nothing here for grown-ups to do
            return;
        }
        gate = new ParentGate(random);
        if (savedInstanceState != null) {
            restoreState(savedInstanceState);
        } else {
            mode = isPaymentReturn(getIntent()) && subscription.hasPendingPayment()
                    ? Mode.CHECKING : Mode.GATE;
        }
        render();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (!isPaymentReturn(intent)) {
            return;
        }
        if (subscription.hasPendingPayment()) {
            mode = Mode.CHECKING;
            note = null;
        } else if (mode != Mode.THANKS) {
            lockAgain();
            mode = Mode.GATE;
        }
        render();
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        // Back from the payment page (or from paying in a UPI app): check the payment by itself.
        if (mode == Mode.CHECKING && !checking) {
            if (subscription.hasPendingPayment()) {
                startCheck();
            } else {
                render();
            }
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        super.onPause();
    }

    @Override
    protected void onStop() {
        stoppedAt = SystemClock.elapsedRealtime();
        super.onStop();
    }

    @Override
    protected void onRestart() {
        super.onRestart();
        if (awayTooLong(stoppedAt)) {
            lockAgain();
            render();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putInt(STATE_MODE, mode.ordinal());
        state.putBoolean(STATE_UNLOCKED, unlocked);
        state.putString(STATE_NOTE, note);
        if (gate != null) {
            state.putInt(STATE_A, gate.a);
            state.putInt(STATE_B, gate.b);
        }
        state.putLong(STATE_SAVED_AT, SystemClock.elapsedRealtime());
    }

    private void restoreState(Bundle state) {
        Mode[] modes = Mode.values();
        int index = state.getInt(STATE_MODE, 0);
        mode = index >= 0 && index < modes.length ? modes[index] : Mode.GATE;
        unlocked = state.getBoolean(STATE_UNLOCKED);
        note = state.getString(STATE_NOTE);
        int a = state.getInt(STATE_A);
        int b = state.getInt(STATE_B);
        if (ParentGate.isValid(a, b)) {
            gate = new ParentGate(a, b);
        }
        if (awayTooLong(state.getLong(STATE_SAVED_AT))) {
            lockAgain();
        }
    }

    /** True if more than a few minutes passed since {@code since} (or it is unknown). */
    private static boolean awayTooLong(long since) {
        long now = SystemClock.elapsedRealtime();
        return since <= 0 || now < since || now - since > RELOCK_AFTER_MS;
    }

    /** Asks the grown-ups' question again, unless a payment check or the thank-you is showing. */
    private void lockAgain() {
        unlocked = false;
        if (mode != Mode.CHECKING && mode != Mode.THANKS) {
            mode = Mode.GATE;
            note = null;
            gate = new ParentGate(random);
        }
    }

    /** The link back from the payment page. Only its address is checked; nothing is read from it. */
    private static boolean isPaymentReturn(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return false;
        }
        Uri data = intent.getData();
        return data != null && "nanhaschool".equals(data.getScheme()) && "open".equals(data.getHost());
    }

    // ---- Screens -------------------------------------------------------------

    private void go(Mode next) {
        mode = next;
        note = null;
        render();
    }

    private void render() {
        hideKeyboard();
        Mode target = resolve(mode);
        if (target != mode) {
            mode = target;
            note = null;
        }
        switch (mode) {
            case PAYWALL:
                showPaywall();
                break;
            case RESTORE:
                showRestore();
                break;
            case THANKS:
                showThanks();
                break;
            case ACCOUNT:
                showAccount();
                break;
            case CHECKING:
                showChecking();
                break;
            case GATE:
            default:
                showGate();
                break;
        }
    }

    /** Sends each screen where it belongs right now (payment screens only after the question). */
    private Mode resolve(Mode wanted) {
        switch (wanted) {
            case PAYWALL:
            case ACCOUNT:
                if (!unlocked) {
                    return Mode.GATE;
                }
                return subscription.isSubscribed() ? Mode.ACCOUNT : Mode.PAYWALL;
            case RESTORE:
                return unlocked ? Mode.RESTORE : Mode.GATE;
            case CHECKING:
                if (checking || subscription.hasPendingPayment()) {
                    return Mode.CHECKING;
                }
                if (subscription.isSubscribed()) {
                    return Mode.THANKS;
                }
                return unlocked ? Mode.PAYWALL : Mode.GATE;
            default:
                return wanted;
        }
    }

    private void showGate() {
        LinearLayout card = page("👨‍👩‍👧 बड़ों के लिए");
        text(card, "यह हिस्सा माता-पिता के लिए है", 22, TITLE, true);
        text(card, "आगे जाने के लिए इस सवाल का जवाब लिखें:", 17, TEXT, false);
        TextView question = text(card, gate.question(), 40, TEXT, true);
        question.setGravity(Gravity.CENTER);

        EditText answer = field(card, ID_ANSWER, "जवाब");
        // A number keyboard, while still accepting Devanagari digits typed on a Hindi keyboard.
        answer.setRawInputType(InputType.TYPE_CLASS_NUMBER);
        answer.setFilters(new InputFilter[] {new InputFilter.LengthFilter(4)});
        answer.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        answer.setGravity(Gravity.CENTER);
        answer.setImeOptions(EditorInfo.IME_ACTION_DONE);
        answer.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                checkGate(answer);
                return true;
            }
            return false;
        });
        button(card, "आगे", GREEN, v -> checkGate(answer));
        if (note != null) {
            text(card, note, 17, ERROR, false);
        }
    }

    private void checkGate(EditText answer) {
        if (gate.check(answer.getText().toString())) {
            unlocked = true;
            go(Mode.PAYWALL);
        } else {
            gate = new ParentGate(random);
            mode = Mode.GATE;
            note = ASK_AGAIN;
            render();
        }
    }

    private void showPaywall() {
        LinearLayout card = page("⭐ प्रीमियम");
        text(card, "पूरा नन्हा स्कूल खोलें", 24, TITLE, true);
        String[] benefits = {
                "सारे " + Syllabus.Lesson.values().length + " पाठ, सारी कविताएँ, खेल और बातचीत",
                "कोई विज्ञापन नहीं",
                "बच्चे का कोई निजी डेटा नहीं लिया जाता",
                "कभी भी रद्द करें",
        };
        for (String benefit : benefits) {
            text(card, "✓ " + benefit, 18, TEXT, false);
        }
        TextView price = text(card, Config.PRICE_TEXT, 28, GREEN, true);
        price.setGravity(Gravity.CENTER);

        int left = subscription.trialDaysLeft();
        text(card, left > 0
                ? "आपके मुफ़्त ट्रायल के " + left + " दिन बाकी हैं। अभी सब्सक्राइब करें — पहला भुगतान"
                        + " ट्रायल ख़त्म होने के बाद ही होगा। (कार्ड या UPI की पुष्टि के लिए बैंक एक छोटी"
                        + " राशि ले सकता है, जो अपने-आप वापस हो जाती है।)"
                : "मुफ़्त ट्रायल पूरा हो गया। सब्सक्राइब करके सारे पाठ फिर से खोलें।",
                15, MUTED, false);

        if (subscription.hasPendingPayment()) {
            text(card, "आपने पहले भुगतान शुरू किया था। अगर वह पूरा हो गया है, तो पहले यहाँ जाँचें:",
                    15, TEXT, false);
            button(card, "मैंने भुगतान कर दिया — जाँचें", GREEN, v -> startCheck());
        }

        Button pay = button(card, "सब्सक्राइब करें", ORANGE, null);
        TextView message = message(card);
        pay.setOnClickListener(v -> subscribe(pay, message));

        text(card, "भुगतान Razorpay के सुरक्षित पेज पर (फ़ोन के ब्राउज़र में) होता है: UPI, कार्ड या"
                + " नेटबैंकिंग। फ़ोन नंबर, ईमेल जैसी संपर्क जानकारी और कार्ड या UPI की जानकारी सिर्फ़"
                + " उसी पेज पर भरी जाती है — ये इस ऐप तक कभी नहीं आतीं।", 14, MUTED, false);
        link(card, "पहले से सब्सक्राइब किया है? वापस पाएँ", v -> go(Mode.RESTORE));
    }

    private void showRestore() {
        LinearLayout card = page("🔄 वापस पाएँ");
        text(card, "पहले से सब्सक्राइब किया है?", 22, TITLE, true);
        text(card, "अपना रिस्टोर कोड लिखें या पेस्ट करें (यह sub_ से शुरू होता है)।", 16, TEXT, false);

        EditText codeField = field(card, ID_CODE, "रिस्टोर कोड");
        // A plain code: no suggestions, so the keyboard does not learn or offer it elsewhere.
        codeField.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        codeField.setTypeface(Typeface.MONOSPACE);
        codeField.setFilters(new InputFilter[] {new InputFilter.LengthFilter(80)});
        String saved = subscription.restoreCode();
        if (saved != null) {
            codeField.setText(saved);
        }

        Button restoreButton = button(card, "वापस पाएँ", GREEN, null);
        TextView message = message(card);
        restoreButton.setOnClickListener(v -> restore(codeField, restoreButton, message));

        text(card, "कोड खो गया? भुगतान की रसीद के साथ हमसे संपर्क करें।", 15, MUTED, false);
        link(card, "← वापस", v -> go(Mode.PAYWALL));
    }

    private void showThanks() {
        LinearLayout card = page("🎉 धन्यवाद!");
        text(card, "प्रीमियम चालू हो गया! 🎉", 24, TITLE, true);
        text(card, "अब बच्चा सारे पाठ, कविताएँ, खेल और बातचीत इस्तेमाल कर सकता है।", 18, TEXT, false);
        showRestoreCode(card);
        button(card, "ऐप पर चलें", GREEN, v -> goHome());
    }

    private void showAccount() {
        LinearLayout card = page("⭐ प्रीमियम");
        text(card, "आपका प्रीमियम चालू है ⭐", 24, TITLE, true);
        text(card, "यह अपने-आप नवीनीकृत होता है। रद्द करने पर, जितने दिनों के पैसे दिए हैं उतने दिन"
                + " ऐप चलता रहेगा।", 16, TEXT, false);
        showRestoreCode(card);
        button(card, "ऐप पर चलें", GREEN, v -> goHome());
        if (note != null) {
            text(card, note, 17, GREEN, true);   // already cancelled in this visit
            return;
        }

        Button cancel = button(card, "सब्सक्रिप्शन रद्द करें", RED, null);
        LinearLayout confirm = new LinearLayout(this);
        confirm.setOrientation(LinearLayout.VERTICAL);
        confirm.setVisibility(View.GONE);
        card.addView(confirm, matchWrap());
        text(confirm, "पक्का रद्द करना है?", 18, TEXT, true);
        Button yes = button(confirm, "हाँ, रद्द करें", RED, null);
        button(confirm, "नहीं", GREY, v -> {
            confirm.setVisibility(View.GONE);
            cancel.setVisibility(View.VISIBLE);
        });
        TextView message = message(card);
        cancel.setOnClickListener(v -> {
            cancel.setVisibility(View.GONE);
            confirm.setVisibility(View.VISIBLE);
        });
        yes.setOnClickListener(v -> cancelSubscription(yes, message));
    }

    private void showChecking() {
        LinearLayout card = page("💳 भुगतान की जाँच");
        if (checking) {
            ProgressBar spinner = new ProgressBar(this);
            spinner.setIndeterminate(true);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(64), dp(64));
            lp.gravity = Gravity.CENTER_HORIZONTAL;
            lp.topMargin = dp(12);
            card.addView(spinner, lp);
            TextView wait = text(card, "भुगतान की जाँच हो रही है…", 20, TEXT, true);
            wait.setGravity(Gravity.CENTER);
            return;
        }
        text(card, note != null ? note
                : "Razorpay के पेज पर भुगतान पूरा करें, फिर इस ऐप पर वापस आएँ। भुगतान अपने-आप जाँचा जाएगा।",
                18, TEXT, false);
        button(card, "मैंने भुगतान कर दिया — जाँचें", GREEN, v -> startCheck());
        if (unlocked) {
            link(card, "← वापस", v -> go(Mode.PAYWALL));
        }
        button(card, "बंद करें", GREY, v -> goHome());
    }

    /** The restore code with a copy button (THANKS and ACCOUNT). */
    private void showRestoreCode(LinearLayout card) {
        String code = subscription.restoreCode();
        if (code == null) {
            return;
        }
        text(card, "यह आपका रिस्टोर कोड है। इसे सँभालकर रखें — नए फ़ोन पर प्रीमियम वापस पाने के लिए यही"
                + " चाहिए। इसमें आपकी कोई निजी जानकारी नहीं है।", 16, MUTED, false);
        TextView box = text(card, code, 17, TEXT, true);
        box.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        box.setTextIsSelectable(true);
        box.setGravity(Gravity.CENTER);
        box.setBackground(rounded(CODE_BG, 12));
        box.setPadding(dp(12), dp(12), dp(12), dp(12));
        button(card, "कोड कॉपी करें", ORANGE, v -> copyCode(code));
    }

    // ---- Actions -------------------------------------------------------------

    /** Starts a subscription and opens Razorpay's page in the browser. */
    private void subscribe(Button pay, TextView message) {
        if (busy) {
            return;
        }
        busy = true;
        setWorking(pay, true);
        show(message, "एक पल…", MUTED);
        String earlier = subscription.pendingRestoreCode();
        if (earlier == null) {
            createSubscription(pay, message);
            return;
        }
        // A payment started earlier may have gone through: check it first, so no one pays twice.
        subscription.call("/api/restore", ApiClient.body("restore_code", earlier), response -> {
            String result = response.error != null
                    ? response.error : subscription.finishRestore(response.json, earlier);
            if (!alive() || mode != Mode.PAYWALL) {
                busy = false;
                return;
            }
            if (result == null) {
                busy = false;
                go(Mode.THANKS);
            } else if (isNotPaid(result)) {
                createSubscription(pay, message);
            } else {
                busy = false;
                setWorking(pay, false);
                show(message, errorText(result), ERROR);
            }
        });
    }

    private void createSubscription(Button pay, TextView message) {
        int daysLeft = subscription.trialDaysLeft();
        subscription.call("/api/subscribe", ApiClient.body("trial_days_left", daysLeft), response -> {
            busy = false;
            if (!alive() || mode != Mode.PAYWALL) {
                return;
            }
            setWorking(pay, false);
            if (response.error != null) {
                show(message, errorText(response.error), ERROR);
                return;
            }
            String subscriptionId = ApiClient.string(response.json, "subscription_id");
            String keyId = ApiClient.string(response.json, "key_id");
            String restoreCode = ApiClient.string(response.json, "restore_code");
            if (!PassVerifier.isSubscriptionId(subscriptionId)
                    || keyId == null || !KEY_ID.matcher(keyId).matches()
                    || !subscriptionId.equals(Entitlement.subscriptionOfRestoreCode(restoreCode))) {
                show(message, errorText(ApiClient.SERVER_ERROR), ERROR);
                return;
            }
            if (!resumed) {
                // Android does not let an app open the browser from the background; nothing is saved.
                show(message, "कृपया फिर से 'सब्सक्राइब करें' दबाएँ।", MUTED);
                return;
            }
            openPaymentPage(subscriptionId, keyId, restoreCode, message);
        });
    }

    private void openPaymentPage(String subscriptionId, String keyId, String restoreCode, TextView message) {
        Uri page = Uri.parse(Config.PAY_PAGE_URL
                + "#s=" + Uri.encode(subscriptionId) + "&k=" + Uri.encode(keyId));
        Intent browser = new Intent(Intent.ACTION_VIEW, page);
        browser.addCategory(Intent.CATEGORY_BROWSABLE);
        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        subscription.setPendingPayment(subscriptionId, restoreCode);
        try {
            startActivity(browser);
        } catch (ActivityNotFoundException e) {
            subscription.clearPendingPayment();
            show(message, errorText(NO_BROWSER), ERROR);
            return;
        }
        go(Mode.CHECKING);   // checked by itself when the parent comes back (onResume)
    }

    /** Asks the server whether the payment started in the browser has gone through. */
    private void startCheck() {
        String code = subscription.pendingRestoreCode();
        if (code == null || !subscription.hasPendingPayment()) {
            render();
            return;
        }
        if (checking) {
            return;
        }
        checking = true;
        go(Mode.CHECKING);
        subscription.call("/api/restore", ApiClient.body("restore_code", code), response -> {
            checking = false;
            String result = response.error != null
                    ? response.error : subscription.finishRestore(response.json, code);
            if (!alive()) {
                return;
            }
            if (result == null) {
                go(Mode.THANKS);
            } else {
                mode = Mode.CHECKING;
                note = isNotPaid(result)
                        ? "भुगतान अभी पूरा नहीं हुआ है। अगर आपने भुगतान कर दिया है, तो एक मिनट रुककर"
                                + " नीचे का बटन दबाएँ।"
                        : errorText(result);
                render();
            }
        });
    }

    private void restore(EditText codeField, Button restoreButton, TextView message) {
        String code = Entitlement.cleanRestoreCode(codeField.getText().toString());
        if (Entitlement.subscriptionOfRestoreCode(code) == null) {
            show(message, WRONG_CODE, ERROR);
            return;
        }
        if (busy) {
            return;
        }
        busy = true;
        setWorking(restoreButton, true);
        show(message, "जाँच हो रही है…", MUTED);
        subscription.call("/api/restore", ApiClient.body("restore_code", code), response -> {
            busy = false;
            String result = response.error != null
                    ? response.error : subscription.finishRestore(response.json, code);
            if (!alive() || mode != Mode.RESTORE) {
                return;
            }
            if (result == null) {
                go(Mode.THANKS);
                return;
            }
            setWorking(restoreButton, false);
            boolean wrongCode = "not_found".equals(result) || "bad_request".equals(result);
            show(message, wrongCode ? WRONG_CODE : errorText(result), ERROR);
        });
    }

    private void cancelSubscription(Button yes, TextView message) {
        String token = subscription.passToken();
        if (token == null) {
            render();
            return;
        }
        if (busy) {
            return;
        }
        busy = true;
        setWorking(yes, true);
        show(message, "एक पल…", MUTED);
        subscription.call("/api/cancel", ApiClient.body("token", token), response -> {
            busy = false;
            if (!alive() || mode != Mode.ACCOUNT) {
                return;
            }
            if (response.error != null || !response.json.optBoolean("cancelled", false)) {
                setWorking(yes, false);
                show(message, errorText(response.error != null ? response.error : ApiClient.SERVER_ERROR), ERROR);
                return;
            }
            long endsAt = response.json.optLong("ends_at", 0L);
            note = endsAt > 0
                    ? "रद्द हो गया। " + formatDate(endsAt) + " तक प्रीमियम चलेगा, उसके बाद पैसे नहीं कटेंगे।"
                    : "रद्द हो गया। आगे से पैसे नहीं कटेंगे।";
            render();
        });
    }

    private void copyCode(String code) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard == null) {
            return;
        }
        ClipData clip = ClipData.newPlainText("नन्हा स्कूल रिस्टोर कोड", code);
        // ClipDescription.EXTRA_IS_SENSITIVE: Android 13+ then hides the code in its clipboard preview.
        PersistableBundle extras = new PersistableBundle();
        extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
        clip.getDescription().setExtras(extras);
        clipboard.setPrimaryClip(clip);
        if (Build.VERSION.SDK_INT < 33) {   // newer Android shows its own "copied" notice
            Toast.makeText(this, "कोड कॉपी हो गया", Toast.LENGTH_SHORT).show();
        }
    }

    private void goHome() {
        if (isTaskRoot()) {
            startActivity(new Intent(this, HomeActivity.class));
        }
        finish();
    }

    // ---- Messages ------------------------------------------------------------

    private static boolean isNotPaid(String code) {
        return "not_active".equals(code) || "not_found".equals(code);
    }

    /** A friendly Hindi message for a server or app error code. */
    static String errorText(String code) {
        switch (code == null ? "" : code) {
            case ApiClient.NETWORK:
                return "इंटरनेट से जुड़ें और फिर कोशिश करें।";
            case "not_found":
                return WRONG_CODE;
            case "not_active":
                return "यह सब्सक्रिप्शन अभी चालू नहीं है।";
            case "bad_token":
                return "आपका पास अब मान्य नहीं है। 'वापस पाएँ' में रिस्टोर कोड डालकर फिर खोलें।";
            case "too_many_requests":
                return "बहुत बार कोशिश हुई। एक मिनट रुककर फिर कोशिश करें।";
            case "payment_provider_error":
                return "भुगतान सेवा से अभी जवाब नहीं मिला। थोड़ी देर बाद फिर कोशिश करें।";
            case Subscription.BAD_PASS:
                return "जाँच पूरी नहीं हो पाई। थोड़ी देर बाद फिर कोशिश करें।";
            case Subscription.PASS_EXPIRED:
                return "फ़ोन की तारीख़ या समय सही नहीं लगता। उसे ठीक करके फिर कोशिश करें।";
            case NO_BROWSER:
                return "इस फ़ोन में वेब ब्राउज़र नहीं मिला। कोई ब्राउज़र (जैसे Chrome) इंस्टॉल करके फिर कोशिश करें।";
            default:
                return "कुछ गड़बड़ हुई। थोड़ी देर बाद फिर कोशिश करें।";
        }
    }

    private static String formatDate(long unixSeconds) {
        return new SimpleDateFormat("d MMMM yyyy", new Locale("hi", "IN"))
                .format(new Date(unixSeconds * 1000L));
    }

    // ---- Building blocks -----------------------------------------------------

    private boolean alive() {
        return !isFinishing() && !isDestroyed();
    }

    /** An orange header with a home button, and a white card on the cream page; returns the card. */
    private LinearLayout page(String heading) {
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(CREAM);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(ORANGE);
        bar.setPadding(dp(14), dp(14), dp(14), dp(14));
        Button home = new Button(this);
        home.setText("🏠");
        home.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        home.setPadding(0, 0, 0, 0);
        home.setBackground(pressable(Color.WHITE, 26));
        home.setContentDescription("ऐप पर वापस");
        home.setOnClickListener(v -> goHome());
        bar.addView(home, new LinearLayout.LayoutParams(dp(52), dp(52)));
        TextView title = new TextView(this);
        title.setText(heading);
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        titleLp.leftMargin = dp(12);
        bar.addView(title, titleLp);
        screen.addView(bar, matchWrap());

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), dp(16), dp(16), dp(16));
        scroll.addView(body, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        screen.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(Color.WHITE, 20));
        card.setPadding(dp(20), dp(16), dp(20), dp(16));
        body.addView(card, matchWrap());

        setContentView(screen);
        return card;
    }

    private TextView text(LinearLayout parent, String value, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.15f);
        if (bold) {
            view.setTypeface(Typeface.DEFAULT_BOLD);
        }
        LinearLayout.LayoutParams lp = matchWrap();
        lp.topMargin = dp(6);
        lp.bottomMargin = dp(6);
        parent.addView(view, lp);
        return view;
    }

    /** A status line under a button; hidden until there is something to say. */
    private TextView message(LinearLayout parent) {
        TextView view = text(parent, "", 17, ERROR, false);
        view.setVisibility(View.GONE);
        return view;
    }

    private static void show(TextView message, String value, int color) {
        message.setText(value);
        message.setTextColor(color);
        message.setVisibility(View.VISIBLE);
    }

    private Button button(LinearLayout parent, String label, int color, View.OnClickListener onClick) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        button.setTextColor(Color.WHITE);
        button.setBackground(pressable(color, 28));
        button.setMinHeight(dp(60));
        button.setPadding(dp(16), dp(10), dp(16), dp(10));
        button.setOnClickListener(onClick);
        LinearLayout.LayoutParams lp = matchWrap();
        lp.topMargin = dp(8);
        lp.bottomMargin = dp(8);
        parent.addView(button, lp);
        return button;
    }

    private void link(LinearLayout parent, String label, View.OnClickListener onClick) {
        TextView view = text(parent, label, 17, TITLE, false);
        view.setPaintFlags(view.getPaintFlags() | Paint.UNDERLINE_TEXT_FLAG);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(8), dp(10), dp(8), dp(10));
        view.setOnClickListener(onClick);
    }

    private EditText field(LinearLayout parent, int id, String hint) {
        EditText field = new EditText(this);
        field.setId(id);
        field.setHint(hint);
        field.setSingleLine(true);
        field.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        field.setTextColor(TEXT);
        LinearLayout.LayoutParams lp = matchWrap();
        lp.topMargin = dp(8);
        lp.bottomMargin = dp(8);
        parent.addView(field, lp);
        return field;
    }

    private static void setWorking(Button button, boolean working) {
        button.setEnabled(!working);
        button.setAlpha(working ? 0.5f : 1f);
    }

    private void hideKeyboard() {
        View focus = getCurrentFocus();
        if (focus == null) {
            return;
        }
        InputMethodManager keyboard = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (keyboard != null) {
            keyboard.hideSoftInputFromWindow(focus.getWindowToken(), 0);
        }
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radiusDp));
        return shape;
    }

    private Drawable pressable(int color, int radiusDp) {
        return new RippleDrawable(ColorStateList.valueOf(0x33000000), rounded(color, radiusDp), null);
    }

    private static LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
