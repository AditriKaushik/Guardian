package org.guardian.buddy;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * A gentle "find the picture" game. Buddy names a thing out loud and shows a
 * few big pictures; the child taps the right one. Right answers get a cheer and
 * a star, wrong ones get a kind "try again" — there is no losing, only learning.
 */
public class QuizActivity extends Activity {

    private final Random random = new Random();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Speaker speaker;
    private List<Card> pool;

    private TextView question;
    private TextView score;
    private LinearLayout optionsBox;
    private Card answer;
    private int stars;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        speaker = new Speaker(this);

        // Only lessons whose "big" glyph is a picture make good tap targets.
        pool = new ArrayList<>();
        pool.addAll(Syllabus.cards(Syllabus.Lesson.ANIMALS));
        pool.addAll(Syllabus.cards(Syllabus.Lesson.FRUITS));
        pool.addAll(Syllabus.cards(Syllabus.Lesson.VEHICLES));
        pool.addAll(Syllabus.cards(Syllabus.Lesson.COLORS));
        pool.addAll(Syllabus.cards(Syllabus.Lesson.SHAPES));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));
        int pad = dp(14);
        root.setPadding(pad, pad, pad, pad);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        Button home = new Button(this);
        home.setText("🏠");
        home.setTextSize(22);
        home.setOnClickListener(v -> finish());
        top.addView(home);
        score = new TextView(this);
        score.setTextSize(22);
        score.setPadding(dp(10), 0, 0, 0);
        top.addView(score);
        root.addView(top);

        question = new TextView(this);
        question.setTextSize(26);
        question.setTextColor(Color.rgb(0xE5, 0x6A, 0x1C));
        question.setGravity(Gravity.CENTER);
        question.setPadding(0, dp(14), 0, dp(14));
        question.setOnClickListener(v -> askAgain());
        root.addView(question);

        optionsBox = new LinearLayout(this);
        optionsBox.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        optionsBox.setLayoutParams(lp);
        root.addView(optionsBox);

        setContentView(root);
        updateScore();
        nextQuestion();
    }

    private void nextQuestion() {
        // Pick the answer and two different distractors.
        List<Card> choices = new ArrayList<>();
        answer = pool.get(random.nextInt(pool.size()));
        choices.add(answer);
        int guard = 0;
        while (choices.size() < 3 && guard++ < 50) {
            Card c = pool.get(random.nextInt(pool.size()));
            if (!c.big.equals(answer.big) && !contains(choices, c)) {
                choices.add(c);
            }
        }
        Collections.shuffle(choices);

        String name = plainName(answer.caption);
        question.setText(name + " कहाँ है? 👆");
        askAgain();

        optionsBox.removeAllViews();
        for (Card c : choices) {
            Button b = new Button(this);
            b.setText(c.big);
            b.setTextSize(64);
            b.setBackgroundColor(Color.WHITE);
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
            blp.setMargins(0, dp(6), 0, dp(6));
            b.setLayoutParams(blp);
            b.setOnClickListener(v -> onPick(c));
            optionsBox.addView(b);
        }
    }

    private void onPick(Card picked) {
        if (picked.big.equals(answer.big)) {
            stars++;
            updateScore();
            String[] cheers = {"शाबाश! 🌟", "बहुत बढ़िया! 🎉", "एकदम सही! 👏", "वाह! 🥳"};
            String cheer = cheers[random.nextInt(cheers.length)];
            question.setText(cheer);
            speaker.say(cheer + " " + plainName(answer.caption), "hi");
            handler.postDelayed(this::nextQuestion, 1400);
        } else {
            question.setText("फिर से कोशिश करो 🙂");
            speaker.say("फिर से कोशिश करो", "hi");
        }
    }

    private void askAgain() {
        if (answer != null) {
            speaker.say(plainName(answer.caption) + " कहाँ है?", "hi");
        }
    }

    private void updateScore() {
        score.setText("⭐ " + stars);
    }

    /** Turns a caption like "गाय · Cow" or "लाल · Red" into just "गाय" / "लाल". */
    private static String plainName(String caption) {
        String first = caption.split("·")[0];
        // Drop a trailing emoji if present ("क से कमल  🌸" style not used here).
        return Speaker.clean(first).trim().isEmpty() ? caption : first.trim();
    }

    private static boolean contains(List<Card> list, Card c) {
        for (Card x : list) {
            if (x.big.equals(c.big)) {
                return true;
            }
        }
        return false;
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
        handler.removeCallbacksAndMessages(null);
        speaker.shutdown();
        super.onDestroy();
    }
}
