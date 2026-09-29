package org.guardian.buddy;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * The first screen a child sees: big, colourful picture tiles. Tapping a tile
 * speaks its name and opens that lesson, so a child who cannot read yet can
 * still find their way around by pictures and sound.
 */
public class HomeActivity extends Activity {

    private Speaker speaker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        speaker = new Speaker(this);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));

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

        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        root.addView(grid);

        // A lesson tile for each part of the syllabus.
        for (Syllabus.Lesson lesson : Syllabus.Lesson.values()) {
            grid.addView(tile(grid, lesson.icon, lesson.title,
                    tileColor(lesson.ordinal()), v -> openLesson(lesson)));
        }
        // Rhymes, the tap-the-picture game, and free chat with Buddy.
        grid.addView(tile(grid, "🎵", "कविताएँ", tileColor(20),
                v -> start(RhymesActivity.class, "कविताएँ", "hi")));
        grid.addView(tile(grid, "🎮", "खेल", tileColor(21),
                v -> start(QuizActivity.class, "खेल खेलो", "hi")));
        grid.addView(tile(grid, "💬", "बात करो", tileColor(22),
                v -> start(MainActivity.class, "बात करो", "hi")));
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

    private View tile(GridLayout grid, String icon, String label, int color, View.OnClickListener onClick) {
        LinearLayout tile = new LinearLayout(this);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setGravity(Gravity.CENTER);
        tile.setBackground(rounded(color));
        int p = dp(16);
        tile.setPadding(p, p, p, p);
        tile.setOnClickListener(onClick);

        TextView emoji = new TextView(this);
        emoji.setText(icon);
        emoji.setTextSize(TypedValue.COMPLEX_UNIT_SP, 56);
        emoji.setGravity(Gravity.CENTER);
        tile.addView(emoji);

        TextView text = new TextView(this);
        text.setText(label);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        text.setTextColor(Color.WHITE);
        text.setGravity(Gravity.CENTER);
        tile.addView(text);

        int screen = getResources().getDisplayMetrics().widthPixels;
        int size = (screen - dp(24) - dp(24)) / 2;   // two columns inside the padded root
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
        lp.width = size;
        lp.height = size;
        lp.setMargins(dp(6), dp(6), dp(6), dp(6));
        tile.setLayoutParams(lp);
        return tile;
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
