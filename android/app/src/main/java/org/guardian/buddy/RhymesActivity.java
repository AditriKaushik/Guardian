package org.guardian.buddy;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

/**
 * A list of nursery rhymes. Tapping one opens a simple player that shows the
 * words and reads them out loud, line by line, in the right language.
 *
 * <p>When the subscription is on and there is no access, only the first
 * {@link Config#FREE_RHYMES} rhymes play; the rest show a 🔒 and call a grown-up.
 */
public class RhymesActivity extends Activity {

    private Speaker speaker;
    private Subscription subscription;
    private List<Rhyme> rhymes;
    private boolean showingList = true;
    private boolean keepTalking;   // let "call a grown-up" finish while the parents' area opens

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        speaker = new Speaker(this);
        subscription = new Subscription(this);
        rhymes = Syllabus.rhymes();
    }

    @Override
    protected void onResume() {
        super.onResume();
        keepTalking = false;
        if (showingList) {
            showList();   // rebuilt each time: what is locked may have changed
        }
    }

    private void showList() {
        showingList = true;
        speaker.stop();
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(14);
        root.setPadding(pad, pad, pad, pad);
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("🎵 कविताएँ");
        title.setTextSize(28);
        title.setTextColor(Color.rgb(0xE5, 0x6A, 0x1C));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(12));
        root.addView(title);

        int[] palette = {0xFFEF5350, 0xFFAB47BC, 0xFF5C6BC0, 0xFF29B6F6,
                0xFF26A69A, 0xFF66BB6A, 0xFFFFA726, 0xFFEC407A, 0xFF7E57C2};
        for (int i = 0; i < rhymes.size(); i++) {
            Rhyme rhyme = rhymes.get(i);
            boolean locked = subscription.isRhymeLocked(i);
            Button b = new Button(this);
            b.setText(locked ? "🔒 " + rhyme.title : rhyme.title);
            b.setTextSize(22);
            b.setTextColor(Color.WHITE);
            b.setAllCaps(false);
            b.setBackgroundColor(palette[i % palette.length]);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(72));
            lp.setMargins(0, dp(6), 0, dp(6));
            b.setLayoutParams(lp);
            if (locked) {
                b.setAlpha(0.55f);
                b.setOnClickListener(v -> askGrownUp());
            } else {
                b.setOnClickListener(v -> showPlayer(rhyme));
            }
            root.addView(b);
        }

        Button home = new Button(this);
        home.setText("🏠 वापस");
        home.setTextSize(20);
        home.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(60));
        hlp.topMargin = dp(14);
        home.setLayoutParams(hlp);
        root.addView(home);

        setContentView(scroll);
    }

    /** A locked rhyme: Buddy asks the child to fetch a grown-up, and the parents' area opens. */
    private void askGrownUp() {
        speaker.say("ये खोलने के लिए मम्मी या पापा को बुलाओ", "hi");
        keepTalking = true;
        startActivity(new Intent(this, ParentActivity.class));
    }

    private void showPlayer(Rhyme rhyme) {
        showingList = false;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(0xFF, 0xF8, 0xE7));
        int pad = dp(16);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(rhyme.title);
        title.setTextSize(26);
        title.setTextColor(Color.rgb(0xE5, 0x6A, 0x1C));
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        ScrollView scroll = new ScrollView(this);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        scroll.setLayoutParams(scrollLp);
        TextView words = new TextView(this);
        words.setText(rhyme.text());
        words.setTextSize(26);
        words.setLineSpacing(dp(6), 1.2f);
        words.setTextColor(Color.rgb(0x2B, 0x2B, 0x2B));
        words.setGravity(Gravity.CENTER);
        words.setPadding(dp(8), dp(20), dp(8), dp(20));
        scroll.addView(words);
        root.addView(scroll);

        LinearLayout buttons = new LinearLayout(this);
        Button play = new Button(this);
        play.setText("▶ सुनो");
        play.setTextSize(22);
        play.setTextColor(Color.WHITE);
        play.setBackgroundColor(0xFF2EAD6B);
        play.setOnClickListener(v -> speaker.sayLines(rhyme.lines, rhyme.lang));
        buttons.addView(play, wideButton());

        Button stop = new Button(this);
        stop.setText("⏹ रुको");
        stop.setTextSize(22);
        stop.setTextColor(Color.WHITE);
        stop.setBackgroundColor(0xFFEF5350);
        stop.setOnClickListener(v -> speaker.stop());
        buttons.addView(stop, wideButton());
        root.addView(buttons);

        Button back = new Button(this);
        back.setText("⬅ और कविताएँ");
        back.setTextSize(20);
        back.setOnClickListener(v -> showList());
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(60));
        blp.topMargin = dp(10);
        back.setLayoutParams(blp);
        root.addView(back);

        setContentView(root);
        speaker.sayLines(rhyme.lines, rhyme.lang);
    }

    private LinearLayout.LayoutParams wideButton() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(64), 1);
        lp.setMargins(dp(6), 0, dp(6), 0);
        return lp;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onPause() {
        if (!keepTalking) {
            speaker.stop();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        speaker.shutdown();
        super.onDestroy();
    }
}
