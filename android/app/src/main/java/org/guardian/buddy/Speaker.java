package org.guardian.buddy;

import android.content.Context;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

/**
 * Reads text out loud in a warm, slightly slow, higher-pitched voice that is
 * easy for very small children to follow. Handles both Hindi and English and
 * strips emoji so they are not read out as "smiling face".
 */
public class Speaker {

    private static final Locale HINDI = new Locale("hi", "IN");

    private TextToSpeech tts;
    private boolean ready;
    private boolean enabled = true;
    private int counter;

    public Speaker(Context context) {
        tts = new TextToSpeech(context.getApplicationContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setSpeechRate(0.85f);
                tts.setPitch(1.25f);
            }
        });
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        if (!enabled) {
            stop();
        }
    }

    /** Speaks one phrase, interrupting anything already being said. */
    public void say(String text, String lang) {
        if (!enabled || !ready || text == null) {
            return;
        }
        applyLanguage(lang);
        tts.speak(clean(text), TextToSpeech.QUEUE_FLUSH, null, id());
    }

    /** Speaks several lines one after another (used for rhymes). */
    public void sayLines(String[] lines, String lang) {
        if (!enabled || !ready || lines == null) {
            return;
        }
        applyLanguage(lang);
        boolean first = true;
        for (String line : lines) {
            String clean = clean(line);
            if (clean.isEmpty()) {
                continue;
            }
            int mode = first ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
            tts.speak(clean, mode, null, id());
            first = false;
        }
    }

    public void stop() {
        if (ready) {
            tts.stop();
        }
    }

    public void shutdown() {
        tts.shutdown();
    }

    private void applyLanguage(String lang) {
        Locale locale = "en".equals(lang) ? Locale.US : HINDI;
        int result = tts.setLanguage(locale);
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            tts.setLanguage(Locale.getDefault());
        }
    }

    private String id() {
        return "u" + (counter++);
    }

    /** Removes emoji and separators so only real words are spoken. */
    static String clean(String text) {
        if (text == null) {
            return "";
        }
        String stripped = text.replaceAll(
                "[\\x{1F000}-\\x{1FAFF}\\x{2190}-\\x{27BF}\\x{2B00}-\\x{2BFF}\\x{FE0F}\\x{200D}]", " ");
        return stripped.replace("·", " ").replaceAll("\\s+", " ").trim();
    }
}
