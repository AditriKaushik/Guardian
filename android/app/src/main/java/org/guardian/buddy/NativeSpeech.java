package org.guardian.buddy;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The phone's text-to-speech for NanhaNative.speak()/stop()/voices(). On-phone voices are
 * preferred (nothing the app says leaves the phone). Every speak() ends with exactly one
 * "speak-done" event for its id — when finished, stopped, interrupted by the next speak(),
 * failed, or when the phone has no speech engine — so the page's promises always settle.
 */
final class NativeSpeech extends UtteranceProgressListener implements TextToSpeech.OnInitListener {

    /** Receives event JSON for the page. */
    interface Sink {
        void emit(String json);
    }

    private static final int INITIALISING = 0;
    private static final int READY = 1;
    private static final int FAILED = 2;
    private static final int MAX_VOICES = 80;
    private static final Locale HINDI = new Locale("hi", "IN");
    private static final Locale INDIAN_ENGLISH = new Locale("en", "IN");

    private final Sink sink;
    private final TextToSpeech tts;
    private volatile int state = INITIALISING;

    /** A speak() that arrived before the engine was ready (main thread only; latest wins). */
    private String[] pending;

    NativeSpeech(Context context, Sink sink) {
        this.sink = sink;
        this.tts = new TextToSpeech(context.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        // Called on the main thread (and, if the engine cannot be bound at all, possibly from
        // inside the constructor, before the tts field is set — so it is not used on failure).
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setOnUtteranceProgressListener(this);
            state = READY;
            String[] request = pending;
            pending = null;
            if (request != null) {
                speakNow(request);
            }
            sink.emit(ShellPolicy.voicesEvent());
        } else {
            state = FAILED;
            String[] request = pending;
            pending = null;
            if (request != null) {
                done(request[0]);
            }
        }
    }

    /** Main thread. Arguments are already validated: id, clean text, "hi-IN"/"en-IN", voice id. */
    void speak(String id, String text, String tag, String voiceId, float rate, float pitch) {
        String[] request = {id, text, tag, voiceId == null ? "" : voiceId,
            Float.toString(rate), Float.toString(pitch)};
        if (text.isEmpty() || state == FAILED) {
            done(id);
        } else if (state == INITIALISING) {
            if (pending != null) {
                done(pending[0]);                  // replaced, like QUEUE_FLUSH would
            }
            pending = request;
        } else {
            speakNow(request);
        }
    }

    private void speakNow(String[] r) {
        try {
            chooseVoice(r[2], r[3]);
            tts.setSpeechRate(Float.parseFloat(r[4]));
            tts.setPitch(Float.parseFloat(r[5]));
            if (tts.speak(r[1], TextToSpeech.QUEUE_FLUSH, new Bundle(), r[0]) != TextToSpeech.SUCCESS) {
                done(r[0]);
            }
        } catch (RuntimeException e) {
            done(r[0]);                            // a misbehaving engine must not crash the app
        }
    }

    /** Main thread. Stops speaking; the interrupted utterance reports speak-done via onStop. */
    void stop() {
        if (pending != null) {
            done(pending[0]);
            pending = null;
        }
        if (state == READY) {
            try {
                tts.stop();
            } catch (RuntimeException ignored) {
                // nothing to stop
            }
        }
    }

    void shutdown() {
        stop();
        try {
            tts.shutdown();
        } catch (RuntimeException ignored) {
            // already gone
        }
    }

    /** JSON for NanhaNative.voices(): installed Hindi and English voices. Any thread. */
    String voicesJson() {
        if (state != READY) {
            return "[]";
        }
        List<VoiceCatalog.Entry> entries = new ArrayList<>();
        for (Voice v : voices()) {
            Locale l = v.getLocale();
            String language = l == null ? "" : l.getLanguage();
            if (!("hi".equals(language) || "en".equals(language)) || !installed(v)) {
                continue;
            }
            boolean local = !v.isNetworkConnectionRequired();
            String tag = l.toLanguageTag();
            entries.add(new VoiceCatalog.Entry(v.getName(), tag,
                    VoiceCatalog.guessGender(v.getName(), features(v)), local,
                    VoiceCatalog.label(tag, v.getName(), local)));
            if (entries.size() >= MAX_VOICES) {
                break;
            }
        }
        VoiceCatalog.sort(entries);
        return VoiceCatalog.toJson(entries);
    }

    /** Uses the voice the page asked for; else the best on-phone voice for the language. */
    private void chooseVoice(String tag, String voiceId) {
        Locale locale = "hi-IN".equals(tag) ? HINDI : INDIAN_ENGLISH;
        Set<Voice> all = voices();
        Voice chosen = null;
        if (!voiceId.isEmpty()) {
            for (Voice v : all) {
                if (voiceId.equals(v.getName()) && installed(v) && v.getLocale() != null
                        && ("hi".equals(v.getLocale().getLanguage()) || "en".equals(v.getLocale().getLanguage()))) {
                    chosen = v;
                    break;
                }
            }
        }
        if (chosen == null) {
            chosen = bestLocal(all, locale, true);
        }
        if (chosen == null) {
            chosen = bestLocal(all, locale, false);
        }
        if (chosen != null && tts.setVoice(chosen) == TextToSpeech.SUCCESS) {
            return;
        }
        int result = tts.setLanguage(locale);
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            tts.setLanguage("hi-IN".equals(tag) ? new Locale("hi") : Locale.US);
        }
    }

    /** Highest-quality installed on-phone voice for the locale (country match or language only). */
    private static Voice bestLocal(Set<Voice> all, Locale locale, boolean sameCountry) {
        Voice best = null;
        for (Voice v : all) {
            Locale l = v.getLocale();
            if (l == null || !locale.getLanguage().equals(l.getLanguage())
                    || (sameCountry && !locale.getCountry().equalsIgnoreCase(l.getCountry()))
                    || v.isNetworkConnectionRequired() || !installed(v)) {
                continue;
            }
            if (best == null || v.getQuality() > best.getQuality()
                    || (v.getQuality() == best.getQuality() && v.getLatency() < best.getLatency())) {
                best = v;
            }
        }
        return best;
    }

    private Set<Voice> voices() {
        try {
            Set<Voice> set = tts.getVoices();
            return set == null ? Collections.emptySet() : set;
        } catch (RuntimeException e) {
            return Collections.emptySet();
        }
    }

    private static Set<String> features(Voice v) {
        Set<String> f = v.getFeatures();
        return f == null ? Collections.emptySet() : f;
    }

    private static boolean installed(Voice v) {
        return !features(v).contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
    }

    private void done(String id) {
        if (id != null) {
            sink.emit(ShellPolicy.speakDoneEvent(id));
        }
    }

    // UtteranceProgressListener (called on a speech-engine thread; sink.emit posts to the UI thread)

    @Override
    public void onStart(String utteranceId) {
        // nothing to report
    }

    @Override
    public void onDone(String utteranceId) {
        done(utteranceId);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onError(String utteranceId) {
        done(utteranceId);
    }

    @Override
    public void onStop(String utteranceId, boolean interrupted) {
        done(utteranceId);
    }
}
