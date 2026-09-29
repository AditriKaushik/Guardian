package org.guardian.buddy;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

/**
 * Shows one lesson as big flashcards, one at a time. Each new card is read out
 * loud automatically; tapping the card repeats it. Two large arrow buttons let
 * a small child move back and forth. When the lesson is finished Buddy gives a
 * little cheer.
 */
public class FlashcardActivity extends Activity {

    public static final String EXTRA_LESSON = "lesson";

    private Speaker speaker;
    private List<Card> cards;
    private String defaultLang = "hi";
    private int index;

    private TextView bigView;
    private TextView captionView;
    private TextView progressView;
    private LinearLayout cardBox;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        speaker = new Speaker(this);

        Syllabus.Lesson lesson = Syllabus.Lesson.valueOf(
                getIntent().getStringExtra(EXTRA_LESSON));
        cards = Syllabus.cards(lesson);
        defaultLang = lesson.lang;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));
        int pad = dp(12);
        root.setPadding(pad, pad, pad, pad);

        // Top bar: home + lesson title.
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        Button home = new Button(this);
        home.setText("🏠");
        home.setTextSize(22);
        home.setOnClickListener(v -> finish());
        top.addView(home);
        TextView title = new TextView(this);
        title.setText(lesson.title);
        title.setTextSize(24);
        title.setTextColor(Color.rgb(0xE5, 0x6A, 0x1C));
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        titleLp.leftMargin = dp(8);
        title.setLayoutParams(titleLp);
        top.addView(title);
        progressView = new TextView(this);
        progressView.setTextSize(18);
        progressView.setTextColor(Color.rgb(0x6B, 0x6B, 0x6B));
        top.addView(progressView);
        root.addView(top);

        // The card itself — a big tappable box.
        cardBox = new LinearLayout(this);
        cardBox.setOrientation(LinearLayout.VERTICAL);
        cardBox.setGravity(Gravity.CENTER);
        cardBox.setOnClickListener(v -> speakCurrent());
        LinearLayout.LayoutParams boxLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        boxLp.setMargins(0, dp(10), 0, dp(10));
        cardBox.setLayoutParams(boxLp);

        bigView = new TextView(this);
        bigView.setGravity(Gravity.CENTER);
        bigView.setTextColor(Color.rgb(0x2B, 0x2B, 0x2B));
        cardBox.addView(bigView);

        captionView = new TextView(this);
        captionView.setGravity(Gravity.CENTER);
        captionView.setTextSize(26);
        captionView.setPadding(dp(8), dp(12), dp(8), dp(8));
        cardBox.addView(captionView);

        TextView tapHint = new TextView(this);
        tapHint.setText("🔊 सुनने के लिए तस्वीर दबाओ");
        tapHint.setGravity(Gravity.CENTER);
        tapHint.setTextSize(14);
        tapHint.setTextColor(Color.rgb(0x8A, 0x8A, 0x8A));
        tapHint.setPadding(0, dp(8), 0, 0);
        cardBox.addView(tapHint);

        root.addView(cardBox);

        // Bottom: big back / next buttons.
        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.HORIZONTAL);
        Button prev = bigButton("◀ पीछे", 0xFF9E9E9E);
        prev.setOnClickListener(v -> show(index - 1));
        Button next = bigButton("आगे ▶", 0xFF2EAD6B);
        next.setOnClickListener(v -> show(index + 1));
        bottom.addView(prev);
        bottom.addView(next);
        root.addView(bottom);

        setContentView(root);
        show(0);
    }

    private Button bigButton(String text, int color) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(22);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(color);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                0, dp(64), 1);
        lp.setMargins(dp(6), 0, dp(6), 0);
        b.setLayoutParams(lp);
        return b;
    }

    private void show(int i) {
        if (i < 0) {
            return;
        }
        if (i >= cards.size()) {
            speaker.say("शाबाश! तुमने पूरा कर लिया। बहुत बढ़िया!", "hi");
            captionView.setText("🎉 शाबाश! तुमने पूरा कर लिया! 🌟");
            bigView.setText("🥳");
            bigView.setTextSize(96);
            cardBox.setBackgroundColor(Color.rgb(0xC8, 0xF0, 0xD8));
            progressView.setText("");
            return;
        }
        index = i;
        Card card = cards.get(i);

        // Colour lesson: paint the whole card in the real colour.
        if (card.bg != null) {
            cardBox.setBackgroundColor(card.bg);
            int text = isDark(card.bg) ? Color.WHITE : Color.rgb(0x2B, 0x2B, 0x2B);
            captionView.setTextColor(text);
        } else {
            cardBox.setBackgroundColor(Color.rgb(0xFF, 0xFF, 0xFF));
            captionView.setTextColor(Color.rgb(0x2B, 0x2B, 0x2B));
        }

        bigView.setText(card.big);
        // A single letter/digit shows huge; longer strings (counting dots) smaller.
        bigView.setTextSize(card.big.length() <= 3 ? 120 : 60);
        captionView.setText(card.caption);
        progressView.setText((i + 1) + "/" + cards.size());
        speakCurrent();
    }

    private void speakCurrent() {
        if (index >= 0 && index < cards.size()) {
            Card card = cards.get(index);
            speaker.say(card.speak, card.lang != null ? card.lang : defaultLang);
        }
    }

    private static boolean isDark(int color) {
        double luminance = 0.299 * Color.red(color)
                + 0.587 * Color.green(color)
                + 0.114 * Color.blue(color);
        return luminance < 140;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onPause() {
        speaker.stop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        speaker.shutdown();
        super.onDestroy();
    }
}
