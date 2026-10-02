package org.guardian.buddy;

import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

/**
 * Short vibrations for NanhaNative.vibrate(): only the patterns {@link ShellPolicy#haptic}
 * knows ("tap", "success", "soft"), never a length the page chooses. Nothing buzzes when the
 * phone has no vibrator, when touch feedback is turned off in the phone's settings, or when the
 * phone is on silent. The vibrations are marked as touch feedback, so on Android 8+ the
 * phone's own vibration-strength settings (and on Android 13+ its vibration switches) apply too.
 */
final class NativeHaptics {

    private final ContentResolver resolver;
    private final Vibrator vibrator;
    private final AudioManager audio;

    NativeHaptics(Context context) {
        Context app = context.getApplicationContext();
        resolver = app.getContentResolver();
        Vibrator v;
        AudioManager a;
        try {
            v = app.getSystemService(Vibrator.class);
            a = app.getSystemService(AudioManager.class);
        } catch (RuntimeException e) {
            v = null;
            a = null;
        }
        vibrator = v;
        audio = a;
    }

    /** True when a vibration would be felt now (vibrator present, touch feedback on, not silent). Any thread. */
    boolean canVibrate() {
        try {
            return vibrator != null && vibrator.hasVibrator()
                    && (audio == null || audio.getRingerMode() != AudioManager.RINGER_MODE_SILENT)
                    && touchFeedbackOn();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Plays one allowed pattern. Main thread. */
    void play(ShellPolicy.Haptic h) {
        if (h == null || !canVibrate()) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                VibrationEffect effect = h.timings.length == 2
                        ? VibrationEffect.createOneShot(h.timings[1], h.amplitudes[1])
                        : VibrationEffect.createWaveform(h.timings, h.amplitudes, -1);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    vibrateAsTouch(vibrator, effect);
                } else {
                    vibrateAsSonification(vibrator, effect);
                }
            } else {
                vibrateLegacy(vibrator, h.timings);
            }
        } catch (RuntimeException e) {
            // a misbehaving vibrator service must not crash the app
        }
    }

    /**
     * The phone's "touch feedback" (vibrate on touch) switch. Deprecated as an API on
     * Android 13, but still kept in step with the settings screen; from 13 on the system also
     * applies it itself to USAGE_TOUCH vibrations.
     */
    @SuppressWarnings("deprecation")
    private boolean touchFeedbackOn() {
        return Settings.System.getInt(resolver, Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0;
    }

    /** Android 13+. */
    private static void vibrateAsTouch(Vibrator vibrator, VibrationEffect effect) {
        vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
    }

    /** Android 8–12: sonification usage is how touch feedback was marked before VibrationAttributes. */
    @SuppressWarnings("deprecation")
    private static void vibrateAsSonification(Vibrator vibrator, VibrationEffect effect) {
        vibrator.vibrate(effect, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
    }

    /**
     * Android 7: the old on/off pattern call — the same as Vibrator.vibrate(ms) for the
     * one-pulse patterns, and it also plays "success"'s two pulses.
     */
    @SuppressWarnings("deprecation")
    private static void vibrateLegacy(Vibrator vibrator, long[] timings) {
        vibrator.vibrate(timings, -1);
    }
}
