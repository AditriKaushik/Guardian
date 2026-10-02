package org.guardian.buddy;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;

/**
 * On-device speech recognition for NanhaNative.listen(). Uses the phone's recogniser directly
 * (no Google pop-up), preferring the fully on-device one on Android 12+ and asking the
 * recogniser to stay offline. The microphone permission is asked for only on the first
 * listen() — the web app turns the mic on only after a grown-up allows it. Nothing heard is
 * logged or stored; the text goes straight to the page.
 *
 * <p>Every listen() ends with exactly one "listen-result" event for its id (text, or null when
 * nothing was understood, the permission was refused, there is no recogniser, or it was
 * cancelled). All methods run on the main thread.
 */
final class NativeListener {

    static final int PERMISSION_REQUEST = 41;
    private static final long TIMEOUT_MS = 20_000;

    private final Activity activity;
    private final NativeSpeech.Sink sink;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable timeout = () -> finish(null);

    private Session active;

    /** A listen() waiting for the permission answer. */
    private String waitingId;
    private String waitingTag;

    NativeListener(Activity activity, NativeSpeech.Sink sink) {
        this.activity = activity;
        this.sink = sink;
    }

    /** {@code tag} is "hi-IN" or "en-IN" (already validated). */
    void listen(String id, String tag) {
        finish(null);                              // one listen at a time
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            boolean asking = waitingId != null;
            if (asking) {
                emit(waitingId, null);             // replaced by this newer request
            }
            waitingId = id;
            waitingTag = tag;
            if (!asking) {
                activity.requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO},
                        PERMISSION_REQUEST);
            }
            return;
        }
        start(id, tag, true);
    }

    /** From Activity.onRequestPermissionsResult. */
    void onPermissionResult(boolean granted) {
        String id = waitingId;
        String tag = waitingTag;
        waitingId = null;
        waitingTag = null;
        if (id == null) {
            return;
        }
        if (granted) {
            start(id, tag, true);
        } else {
            emit(id, null);
        }
    }

    /**
     * Stops listening (app paused or closing); the open request gets text null. With
     * {@code includeWaiting}, a request waiting for the permission answer is dropped too.
     */
    void cancel(boolean includeWaiting) {
        if (includeWaiting && waitingId != null) {
            emit(waitingId, null);
            waitingId = null;
            waitingTag = null;
        }
        finish(null);
    }

    private void start(String id, String tag, boolean tryOnDevice) {
        SpeechRecognizer r = null;
        boolean onDevice = false;
        try {
            if (tryOnDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)) {
                r = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
                onDevice = true;
            }
        } catch (RuntimeException e) {
            r = null;
            onDevice = false;
        }
        try {
            if (r == null && SpeechRecognizer.isRecognitionAvailable(activity)) {
                r = SpeechRecognizer.createSpeechRecognizer(activity);
            }
        } catch (RuntimeException e) {
            r = null;
        }
        if (r == null) {
            emit(id, null);
            return;
        }
        Session session = new Session(r, id, tag, onDevice);
        active = session;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.getPackageName());
        main.postDelayed(timeout, TIMEOUT_MS);
        try {
            r.setRecognitionListener(session);
            r.startListening(intent);
        } catch (RuntimeException e) {
            finish(null);
        }
    }

    /** Ends the current listen (if any) with this text and frees its recogniser. */
    private void finish(String text) {
        main.removeCallbacks(timeout);
        Session s = active;
        active = null;
        if (s != null) {
            s.release();
            emit(s.id, text);
        }
    }

    private void emit(String id, String text) {
        String t = text == null ? null : text.trim();
        sink.emit(ShellPolicy.listenResultEvent(id, t == null || t.isEmpty() ? null : t));
    }

    /** One listen(): its recogniser and request. Callbacks from a finished session are ignored. */
    private final class Session implements RecognitionListener {
        final SpeechRecognizer recognizer;
        final String id;
        final String tag;
        final boolean onDevice;

        Session(SpeechRecognizer recognizer, String id, String tag, boolean onDevice) {
            this.recognizer = recognizer;
            this.id = id;
            this.tag = tag;
            this.onDevice = onDevice;
        }

        void release() {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (RuntimeException ignored) {
                // already gone
            }
        }

        @Override
        public void onResults(Bundle results) {
            if (active != this) {
                return;
            }
            ArrayList<String> heard = results == null ? null
                    : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            finish(heard == null || heard.isEmpty() ? null : heard.get(0));
        }

        @Override
        public void onError(int error) {
            if (active != this) {
                return;
            }
            // The on-device recogniser may not have this language yet: try the regular one
            // (still asked to stay offline) once.
            if (onDevice && (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED
                    || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)) {
                main.removeCallbacks(timeout);
                active = null;
                release();
                start(id, tag, false);
                return;
            }
            finish(null);
        }

        @Override
        public void onReadyForSpeech(Bundle params) {
        }

        @Override
        public void onBeginningOfSpeech() {
        }

        @Override
        public void onRmsChanged(float rmsdB) {
        }

        @Override
        public void onBufferReceived(byte[] buffer) {
        }

        @Override
        public void onEndOfSpeech() {
        }

        @Override
        public void onPartialResults(Bundle partialResults) {
        }

        @Override
        public void onEvent(int eventType, Bundle params) {
        }
    }
}
