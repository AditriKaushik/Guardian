package org.guardian.buddy;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The plain rules behind the free trial and the subscription: how many trial days are
 * left, which tiles and rhymes are locked, when a pass has run out. Kept free of Android
 * classes so they can be unit-tested on a computer; {@link Subscription} feeds them the
 * stored values.
 */
final class Entitlement {

    static final long DAY_MS = 24L * 60 * 60 * 1000;

    /** A pass is quietly renewed when it runs out within this time (or already has). */
    static final long REFRESH_WINDOW_MS = 3 * DAY_MS;

    /** The rhymes tile always opens (the rhymes inside may be locked one by one). */
    static final String RHYMES_TILE = "कविताएँ";

    /** A restore code is the subscription ID, a dot, and a 16-character check made by the server. */
    private static final Pattern RESTORE_CODE =
            Pattern.compile("^(sub_[A-Za-z0-9]{6,40})\\.([A-Za-z0-9_-]{16})$");

    /** The server's clock is only trusted when it looks like a real date (after 1 Jan 2020). */
    private static final long EARLIEST_SERVER_TIME_MS = 1_577_836_800_000L;
    private static final long CLOCK_TOLERANCE_MS = 10 * 60 * 1000L;

    private Entitlement() {
    }

    /**
     * A clock that never runs backwards: moving the phone's date back does not win back
     * trial days or pass time, because the latest time ever seen still counts.
     */
    static long clock(long phoneNow, long lastSeen) {
        return Math.max(phoneNow, lastSeen);
    }

    /** Whole days of free trial left, rounded up (so the first day shows the full length). */
    static int trialDaysLeft(long trialStart, long now, int trialDays) {
        long left = trialStart + trialDays * DAY_MS - now;
        if (left <= 0 || trialDays <= 0) {
            return 0;
        }
        long days = (left + DAY_MS - 1) / DAY_MS;
        return (int) Math.min(days, trialDays);
    }

    /** True while a pass that ends at {@code expSeconds} is still valid. */
    static boolean isActive(long expSeconds, long nowMs) {
        return expSeconds * 1000L > nowMs;
    }

    /** True when a pass should be renewed: it ends within three days, or has already ended. */
    static boolean needsRefresh(long expSeconds, long nowMs) {
        return expSeconds * 1000L - nowMs < REFRESH_WINDOW_MS;
    }

    /** A home tile is locked only without access, and never for rhymes or the always-free tiles. */
    static boolean isTileLocked(String title, boolean hasAccess, String[] freeTiles) {
        if (hasAccess || RHYMES_TILE.equals(title)) {
            return false;
        }
        for (String free : freeTiles) {
            if (free.equals(title)) {
                return false;
            }
        }
        return true;
    }

    /** The first {@code freeRhymes} rhymes are always free; the rest need access. */
    static boolean isRhymeLocked(int index, boolean hasAccess, int freeRhymes) {
        return !hasAccess && index >= freeRhymes;
    }

    /**
     * If a stored time is ahead of the server's clock (the phone's date was once set in the
     * future), pulls it back to the server's time so a paid pass is not wrongly treated as
     * expired. It is only ever moved back to the real time, never earlier, so this cannot be
     * used to stretch the trial.
     */
    static long correctedTime(long stored, long serverNow) {
        if (serverNow < EARLIEST_SERVER_TIME_MS) {
            return stored;
        }
        return stored > serverNow + CLOCK_TOLERANCE_MS ? serverNow : stored;
    }

    /** Removes spaces and line breaks a parent may paste along with a restore code. */
    static String cleanRestoreCode(String typed) {
        return typed == null ? "" : typed.replaceAll("\\s+", "");
    }

    /** The subscription ID inside a well-formed restore code, or null if it is not one. */
    static String subscriptionOfRestoreCode(String code) {
        if (code == null) {
            return null;
        }
        Matcher m = RESTORE_CODE.matcher(code);
        return m.matches() ? m.group(1) : null;
    }
}
