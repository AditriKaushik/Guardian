package org.guardian.buddy;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks a subscription "pass" from the server, so the app knows — even offline —
 * which subscription is paid for and until when.
 *
 * <p>A pass is {@code <payload>.<sig>}: the payload is base64url (no padding) of the
 * JSON {@code {"sid":"sub_…","exp":<unix seconds>}}, and the signature is an ECDSA P-256
 * / SHA-256 signature over the payload's ASCII text, in the 64-byte r||s (IEEE P1363)
 * form that WebCrypto makes. Only the server holds the private key; the app has the
 * public key ({@link Config#PUBLIC_KEY_SPKI}).
 *
 * <p>Plain Java on purpose (no Android classes, no org.json): it is unit-tested on a
 * computer, and it decodes base64 itself because java.util.Base64 only arrived in
 * Android 8 (API 26). Every method returns null for anything invalid and never throws.
 */
public final class PassVerifier {

    /** What a genuine pass says: which subscription, and until when (Unix seconds). */
    public static final class Pass {
        public final String sid;
        public final long exp;

        Pass(String sid, long exp) {
            this.sid = sid;
            this.exp = exp;
        }
    }

    /** The server never makes a longer pass; anything bigger is rejected before any work. */
    static final int MAX_TOKEN_LENGTH = 600;

    private static final Pattern SUBSCRIPTION_ID = Pattern.compile("^sub_[A-Za-z0-9]{6,40}$");

    /** Exactly the JSON the server writes (whitespace tolerated), and nothing else. */
    private static final Pattern PAYLOAD = Pattern.compile(
            "^\\{\\s*\"sid\"\\s*:\\s*\"(sub_[A-Za-z0-9]{6,40})\"\\s*,"
                    + "\\s*\"exp\"\\s*:\\s*([1-9][0-9]{0,11})\\s*\\}$");

    /** The order n of the P-256 curve, to make sure the configured key is really P-256. */
    private static final BigInteger P256_ORDER = new BigInteger(
            "FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16);

    private static String cachedSpki;
    private static PublicKey cachedKey;

    private PassVerifier() {
    }

    /** True for a well-formed Razorpay subscription ID ("sub_" + 6–40 letters or digits). */
    public static boolean isSubscriptionId(String value) {
        return value != null && SUBSCRIPTION_ID.matcher(value).matches();
    }

    /** Checks a pass with a base64 SPKI public key. Returns what it says, or null if it is not genuine. */
    public static Pass verify(String token, String publicKeySpki) {
        return verify(token, cachedPublicKey(publicKeySpki));
    }

    /**
     * Checks a pass's signature and contents. An expired pass is still returned (so it can
     * be renewed); the caller compares {@link Pass#exp} with the clock.
     */
    public static Pass verify(String token, PublicKey key) {
        try {
            if (token == null || key == null || token.length() > MAX_TOKEN_LENGTH) {
                return null;
            }
            int dot = token.indexOf('.');
            if (dot <= 0 || dot != token.lastIndexOf('.') || dot == token.length() - 1) {
                return null;
            }
            String payload = token.substring(0, dot);
            byte[] json = decodeBase64Url(payload);
            byte[] rawSignature = decodeBase64Url(token.substring(dot + 1));
            if (json == null || rawSignature == null || rawSignature.length != 64) {
                return null;
            }
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(key);
            verifier.update(payload.getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(derFromP1363(rawSignature))) {
                return null;
            }
            return parsePayload(new String(json, StandardCharsets.UTF_8));
        } catch (Exception e) {
            // A malformed token or signature simply means "not a genuine pass".
            return null;
        }
    }

    /** Reads {"sid":"sub_…","exp":123} strictly. Returns null for anything else. */
    static Pass parsePayload(String json) {
        if (json == null) {
            return null;
        }
        Matcher m = PAYLOAD.matcher(json);
        if (!m.matches()) {
            return null;
        }
        return new Pass(m.group(1), Long.parseLong(m.group(2)));
    }

    /** The public key parsed once and remembered (the key in Config never changes while running). */
    static synchronized PublicKey cachedPublicKey(String publicKeySpki) {
        if (publicKeySpki == null || publicKeySpki.isEmpty()) {
            return null;
        }
        if (!publicKeySpki.equals(cachedSpki)) {
            cachedKey = parsePublicKey(publicKeySpki);
            cachedSpki = publicKeySpki;
        }
        return cachedKey;
    }

    /**
     * Reads a base64 (standard or URL alphabet, padding and line breaks allowed) SPKI DER
     * EC public key. Returns null unless it is a valid P-256 key.
     */
    public static PublicKey parsePublicKey(String publicKeySpki) {
        try {
            if (publicKeySpki == null) {
                return null;
            }
            String clean = publicKeySpki.replaceAll("\\s+", "");
            int end = clean.length();
            while (end > 0 && clean.length() - end < 2 && clean.charAt(end - 1) == '=') {
                end--;
            }
            byte[] der = decode(clean.substring(0, end), true, true);
            if (der == null || der.length == 0) {
                return null;
            }
            PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der));
            if (!(key instanceof ECPublicKey)
                    || !P256_ORDER.equals(((ECPublicKey) key).getParams().getOrder())) {
                return null;
            }
            return key;
        } catch (Exception e) {
            return null;
        }
    }

    /** Decodes base64url without padding (the only form the server writes). Null if malformed. */
    static byte[] decodeBase64Url(String s) {
        return decode(s, true, false);
    }

    private static byte[] decode(String s, boolean urlAlphabet, boolean standardAlphabet) {
        if (s == null || s.length() % 4 == 1) {
            return null;
        }
        int length = s.length();
        byte[] out = new byte[length * 3 / 4];
        int buffer = 0;
        int bits = 0;
        int n = 0;
        for (int i = 0; i < length; i++) {
            int value = sextet(s.charAt(i), urlAlphabet, standardAlphabet);
            if (value < 0) {
                return null;
            }
            buffer = (buffer << 6) | value;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[n++] = (byte) (buffer >> bits);
                buffer &= (1 << bits) - 1;
            }
        }
        if (buffer != 0) {
            return null;   // leftover bits must be zero in a canonical encoding
        }
        return n == out.length ? out : Arrays.copyOf(out, n);
    }

    private static int sextet(char c, boolean urlAlphabet, boolean standardAlphabet) {
        if (c >= 'A' && c <= 'Z') {
            return c - 'A';
        }
        if (c >= 'a' && c <= 'z') {
            return c - 'a' + 26;
        }
        if (c >= '0' && c <= '9') {
            return c - '0' + 52;
        }
        if ((urlAlphabet && c == '-') || (standardAlphabet && c == '+')) {
            return 62;
        }
        if ((urlAlphabet && c == '_') || (standardAlphabet && c == '/')) {
            return 63;
        }
        return -1;
    }

    /**
     * Turns a 64-byte r||s signature (what WebCrypto makes) into the ASN.1 DER
     * SEQUENCE { INTEGER r, INTEGER s } that java.security.Signature expects.
     */
    static byte[] derFromP1363(byte[] raw) {
        if (raw == null || raw.length != 64) {
            throw new IllegalArgumentException("P-256 signatures are 64 bytes");
        }
        byte[] r = derInteger(raw, 0, 32);
        byte[] s = derInteger(raw, 32, 32);
        byte[] out = new byte[2 + r.length + s.length];
        out[0] = 0x30;
        out[1] = (byte) (r.length + s.length);   // at most 70, so the short length form fits
        System.arraycopy(r, 0, out, 2, r.length);
        System.arraycopy(s, 0, out, 2 + r.length, s.length);
        return out;
    }

    private static byte[] derInteger(byte[] src, int offset, int length) {
        int start = offset;
        int end = offset + length;
        while (start < end - 1 && src[start] == 0) {
            start++;                                    // minimal form: no leading zero bytes
        }
        boolean pad = (src[start] & 0x80) != 0;        // keep it positive
        int size = end - start + (pad ? 1 : 0);
        byte[] out = new byte[2 + size];
        out[0] = 0x02;
        out[1] = (byte) size;
        System.arraycopy(src, start, out, 2 + (pad ? 1 : 0), end - start);
        return out;
    }
}
