package org.guardian.buddy;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * The first screen a child sees: big, colourful picture tiles. Tapping a tile
 * speaks its name and opens that lesson, so a child who cannot read yet can
 * still find their way around by pictures and sound.
 *
 * <p>When the subscription is switched on ({@link Config#paymentsOn()}), tiles that
 * need premium after the free trial look faded with a 🔒, and a small banner at the
 * bottom leads grown-ups to the parents' area.
 */
public class HomeActivity extends Activity {

    private static final String ASK_GROWN_UP = "ये खोलने के लिए मम्मी या पापा को बुलाओ";

    /** A pass that is about to run out is renewed at most this often. */
    private static final long REFRESH_EVERY_MS = 30 * 60_000L;

    // Shared by all home screens in this run of the app, so the server is not asked twice.
    private static boolean refreshing;
    private static long lastRefreshAt;
    private static boolean pendingChecked;

    private Speaker speaker;
    private Subscription subscription;
    private GridLayout grid;
    private TextView banner;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        speaker = new Speaker(this);
        subscription = new Subscription(this);

        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));
        screen.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(12);
        root.setPadding(pad, pad, pad, pad);
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("😊 नन्हा स्कूल");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        title.setTextColor(Color.rgb(0xE5, 0x6A, 0x1C));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(8), 0, dp(2));
        root.addView(title);

        TextView hint = new TextView(this);
        hint.setText("किसी भी तस्वीर पर दबाओ और सीखो 👇");
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        hint.setTextColor(Color.rgb(0x6B, 0x6B, 0x6B));
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, 0, 0, dp(10));
        root.addView(hint);

        grid = new GridLayout(this);
        grid.setColumnCount(2);
        root.addView(grid);

        // The parents' banner: only shown while the subscription is switched on.
        banner = new TextView(this);
        banner.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        banner.setTextColor(Color.rgb(0x9A, 0x44, 0x0E));
        banner.setTypeface(Typeface.DEFAULT_BOLD);
        banner.setGravity(Gravity.CENTER);
        banner.setPadding(dp(14), dp(12), dp(14), dp(12));
        banner.setBackground(rounded(Color.rgb(0xFF, 0xE3, 0xC7)));
        banner.setVisibility(View.GONE);
        banner.setOnClickListener(v -> openParents());
        LinearLayout.LayoutParams bannerLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bannerLp.setMargins(dp(12), dp(4), dp(12), dp(10));
        screen.addView(banner, bannerLp);

        setContentView(screen);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Rebuilt every time: a grown-up may just have subscribed, or the trial may have ended.
        showTiles();
        refreshPassQuietly();
        checkPendingPaymentQuietly();
    }

    private void showTiles() {
        grid.removeAllViews();
        // A lesson tile for each part of the syllabus.
        for (Syllabus.Lesson lesson : Syllabus.Lesson.values()) {
            addTile(lesson.icon, lesson.title, tileColor(lesson.ordinal()), v -> openLesson(lesson));
        }
        // Rhymes, the tap-the-picture game, and free chat with Buddy.
        addTile("🎵", "कविताएँ", tileColor(20),
                v -> start(RhymesActivity.class, "कविताएँ", "hi"));
        addTile("🎮", "खेल", tileColor(21),
                v -> start(QuizActivity.class, "खेल खेलो", "hi"));
        addTile("💬", "बात करो", tileColor(22),
                v -> start(MainActivity.class, "बात करो", "hi"));
        updateBanner();
    }

    private void addTile(String icon, String label, int color, View.OnClickListener onClick) {
        boolean locked = subscription.isTileLocked(label);
        grid.addView(tile(icon, label, color, locked, locked ? v -> askGrownUp() : onClick));
    }

    private void updateBanner() {
        if (!subscription.paymentsOn()) {
            banner.setVisibility(View.GONE);
            return;
        }
        String text;
        if (subscription.isSubscribed()) {
            text = "⭐ प्रीमियम चालू है";
        } else {
            int left = subscription.trialDaysLeft();
            text = left > 0
                    ? "🎁 मुफ़्त ट्रायल: " + left + " दिन बाकी · बड़ों के लिए"
                    : "🔒 कुछ पाठ बंद हैं · बड़ों के लिए: पूरा ऐप खोलें";
        }
        banner.setText(text);
        banner.setVisibility(View.VISIBLE);
    }

    private void openLesson(Syllabus.Lesson lesson) {
        speaker.say(lesson.subtitle, lesson.lang);
        Intent intent = new Intent(this, FlashcardActivity.class);
        intent.putExtra(FlashcardActivity.EXTRA_LESSON, lesson.name());
        startActivity(intent);
    }

    private void start(Class<?> activity, String announce, String lang) {
        speaker.say(announce, lang);
        startActivity(new Intent(this, activity));
    }

    /** A locked tile: Buddy asks the child to fetch a grown-up, and the parents' area opens. */
    private void askGrownUp() {
        speaker.say(ASK_GROWN_UP, "hi");
        openParents();
    }

    private void openParents() {
        startActivity(new Intent(this, ParentActivity.class));
    }

    /** Quietly renews a pass that runs out within three days. Failures are simply ignored. */
    private void refreshPassQuietly() {
        long t = SystemClock.elapsedRealtime();
        if (refreshing || (lastRefreshAt != 0 && t - lastRefreshAt < REFRESH_EVERY_MS)) {
            return;
        }
        String token = subscription.tokenToRefresh();
        if (token == null) {
            return;
        }
        refreshing = true;
        lastRefreshAt = t;
        subscription.call("/api/refresh", ApiClient.body("token", token), response -> {
            refreshing = false;
            if (response.error != null) {
                return;   // offline, or not renewed yet: the current pass stays as it is
            }
            if (subscription.acceptPass(ApiClient.string(response.json, "token"), null) == null && alive()) {
                showTiles();
            }
        });
    }

    /**
     * If a grown-up paid in the browser but the app was closed before the payment was
     * confirmed, confirms it now (once per app start), without showing anything.
     */
    private void checkPendingPaymentQuietly() {
        if (pendingChecked || !subscription.paymentsOn() || !subscription.hasPendingPayment()) {
            return;
        }
        pendingChecked = true;
        String code = subscription.pendingRestoreCode();
        subscription.call("/api/restore", ApiClient.body("restore_code", code), response -> {
            if (response.error == null && subscription.finishRestore(response.json, code) == null && alive()) {
                showTiles();
            }
        });
    }

    private boolean alive() {
        return !isFinishing() && !isDestroyed();
    }

    private View tile(String icon, String label, int color, boolean locked, View.OnClickListener onClick) {
        FrameLayout tile = new FrameLayout(this);
        tile.setBackground(rounded(locked ? faded(color) : color));
        tile.setOnClickListener(onClick);
        tile.setContentDescription(locked ? label + " 🔒" : label);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        int p = dp(16);
        content.setPadding(p, p, p, p);
        if (locked) {
            content.setAlpha(0.55f);
        }

        TextView emoji = new TextView(this);
        emoji.setText(icon);
        emoji.setTextSize(TypedValue.COMPLEX_UNIT_SP, 56);
        emoji.setGravity(Gravity.CENTER);
        content.addView(emoji);

        TextView text = new TextView(this);
        text.setText(label);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        text.setTextColor(Color.WHITE);
        text.setGravity(Gravity.CENTER);
        content.addView(text);
        tile.addView(content, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        if (locked) {
            TextView lock = new TextView(this);
            lock.setText("🔒");
            lock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
            FrameLayout.LayoutParams lockLp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.TOP | Gravity.END);
            lockLp.setMargins(dp(10), dp(8), dp(10), dp(8));
            tile.addView(lock, lockLp);
        }

        int screen = getResources().getDisplayMetrics().widthPixels;
        int size = (screen - dp(24) - dp(24)) / 2;   // two columns inside the padded root
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = size;
        lp.height = size;
        lp.setMargins(dp(6), dp(6), dp(6), dp(6));
        tile.setLayoutParams(lp);
        return tile;
    }

    /** A washed-out, lighter version of a tile colour, so locked tiles look "asleep". */
    private static int faded(int color) {
        int r = Color.red(color);
        int g = Color.green(color);
        int b = Color.blue(color);
        int grey = (int) (0.299 * r + 0.587 * g + 0.114 * b);
        return Color.rgb(fade(grey, r), fade(grey, g), fade(grey, b));
    }

    private static int fade(int grey, int channel) {
        return Math.min(255, grey + Math.round((channel - grey) * 0.35f) + 24);
    }

    private android.graphics.drawable.GradientDrawable rounded(int color) {
        android.graphics.drawable.GradientDrawable d = new android.graphics.drawable.GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(24));
        return d;
    }

    private static final int[] PALETTE = {
            0xFFEF5350, 0xFFAB47BC, 0xFF5C6BC0, 0xFF29B6F6, 0xFF26A69A,
            0xFF66BB6A, 0xFF9CCC65, 0xFFFFA726, 0xFFFF7043, 0xFF8D6E63,
            0xFFEC407A, 0xFF7E57C2, 0xFF42A5F5, 0xFF26C6DA, 0xFF9CCC65,
    };

    private int tileColor(int i) {
        return PALETTE[i % PALETTE.length];
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        speaker.shutdown();
        super.onDestroy();
    }
}
