package org.guardian.buddy;

import java.util.Random;

/**
 * The grown-ups' question in front of payments and the account: a times-table sum
 * (both numbers from 6 to 9) that small children cannot answer yet. Answers may be
 * typed with ordinary or Devanagari digits (५६ = 56).
 */
final class ParentGate {

    static final int MIN = 6;
    static final int MAX = 9;

    final int a;
    final int b;

    ParentGate(Random random) {
        this(MIN + random.nextInt(MAX - MIN + 1), MIN + random.nextInt(MAX - MIN + 1));
    }

    ParentGate(int a, int b) {
        this.a = a;
        this.b = b;
    }

    /** True when both numbers are in range (used when restoring a saved question). */
    static boolean isValid(int a, int b) {
        return a >= MIN && a <= MAX && b >= MIN && b <= MAX;
    }

    String question() {
        return a + " × " + b + " = ?";
    }

    boolean check(String answer) {
        int given = parseNumber(answer);
        return given >= 0 && given == a * b;
    }

    /**
     * Reads a small whole number typed with 0–9 and/or ०–९, ignoring surrounding spaces.
     * Returns -1 for anything else.
     */
    static int parseNumber(String text) {
        if (text == null) {
            return -1;
        }
        String s = text.trim();
        if (s.isEmpty() || s.length() > 4) {
            return -1;
        }
        int value = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int digit;
            if (c >= '0' && c <= '9') {
                digit = c - '0';
            } else if (c >= '०' && c <= '९') {   // Devanagari ० … ९
                digit = c - '०';
            } else {
                return -1;
            }
            value = value * 10 + digit;
        }
        return value;
    }
}
