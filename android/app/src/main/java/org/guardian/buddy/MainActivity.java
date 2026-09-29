package org.guardian.buddy;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

/** A single chat screen: the child speaks or types, Buddy answers on screen and out loud. */
public class MainActivity extends Activity {

    private static final int REQ_SPEECH = 1;
    private static final Locale HINDI = new Locale("hi", "IN");

    private final BuddyBrain brain = new BuddyBrain();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private LinearLayout messages;
    private ScrollView scroll;
    private EditText input;
    private Button soundButton;

    private TextToSpeech tts;
    private boolean ttsReady;
    private boolean soundOn = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        messages = findViewById(R.id.messages);
        scroll = findViewById(R.id.scroll);
        input = findViewById(R.id.input);
        soundButton = findViewById(R.id.sound);

        findViewById(R.id.home).setOnClickListener(v -> finish());
        findViewById(R.id.send).setOnClickListener(v -> sendTyped());
        findViewById(R.id.mic).setOnClickListener(v -> listen());
        soundButton.setOnClickListener(v -> toggleSound());
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendTyped();
                return true;
            }
            return false;
        });

        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) {
                return;
            }
            int r = tts.setLanguage(HINDI);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.getDefault());
            }
            tts.setSpeechRate(0.95f);
            tts.setPitch(1.2f);
            ttsReady = true;
        });

        showBuddy(brain.greeting());
    }

    private void sendTyped() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) {
            return;
        }
        input.setText("");
        handleKid(text);
    }

    private void handleKid(String text) {
        addBubble(text, false);
        String reply = brain.reply(text);
        // A tiny pause feels more like a friend thinking than an instant answer.
        handler.postDelayed(() -> showBuddy(reply), 500);
    }

    private void showBuddy(String text) {
        addBubble(text, true);
        speak(text);
    }

    private void speak(String text) {
        if (!soundOn || !ttsReady) {
            return;
        }
        // Emoji are read out as their names ("smiling face"), so strip them before speaking.
        String spoken = text.replaceAll("[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{FE0F}\\x{200D}]", "");
        tts.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "buddy");
    }

    private void toggleSound() {
        soundOn = !soundOn;
        soundButton.setText(soundOn ? R.string.sound_on : R.string.sound_off);
        if (!soundOn && tts != null) {
            tts.stop();
        }
    }

    private void listen() {
        if (tts != null) {
            tts.stop();
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "बोलो, मैं सुन रहा हूँ… 👂");
        try {
            startActivityForResult(intent, REQ_SPEECH);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_speech, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SPEECH || resultCode != RESULT_OK || data == null) {
            return;
        }
        ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (results != null && !results.isEmpty()) {
            handleKid(results.get(0));
        }
    }

    private void addBubble(String text, boolean fromBuddy) {
        TextView bubble = new TextView(this);
        bubble.setText(fromBuddy ? "🤖  " + text : text);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        bubble.setTextColor(getColor(R.color.text));
        bubble.setBackgroundResource(fromBuddy ? R.drawable.bubble_buddy : R.drawable.bubble_kid);
        int pad = dp(14);
        bubble.setPadding(pad, dp(10), pad, dp(10));
        bubble.setLineSpacing(0, 1.15f);
        bubble.setMaxWidth((int) (getResources().getDisplayMetrics().widthPixels * 0.8));

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = fromBuddy ? Gravity.START : Gravity.END;
        lp.topMargin = dp(6);
        lp.bottomMargin = dp(6);
        messages.addView(bubble, lp);
        scroll.post(() -> scroll.fullScroll(ScrollView.FOCUS_DOWN));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (tts != null) {
            tts.shutdown();
        }
        super.onDestroy();
    }
}
