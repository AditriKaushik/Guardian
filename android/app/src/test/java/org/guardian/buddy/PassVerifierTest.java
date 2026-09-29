package org.guardian.buddy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.Random;
import org.junit.Test;

/**
 * Checks pass verification against a REAL fixture: a P-256 key pair made with Node's
 * WebCrypto and tokens signed exactly like issue() in server/worker.js (payload =
 * base64url of JSON.stringify({sid, exp}); signature = crypto.subtle.sign ECDSA/SHA-256
 * over the payload text, 64-byte r||s, base64url). The public key is in the base64 SPKI
 * form that server/genkeys.mjs prints for Config.PUBLIC_KEY_SPKI.
 */
public class PassVerifierTest {

    static final String SPKI = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+MrskAln+H7XCINRKeKu/nzUybueo"
            + "GVnDI8w1w9sb70r2FYBrd6sXAQUGa8RLF4UOhUpqWfKmx5egDJLhxs/nw==";

    static final String SID = "sub_Nanha7Test42Xyz";
    static final long EXP = 1893456000L;

    /** {"sid":"sub_Nanha7Test42Xyz","exp":1893456000} signed with the SPKI key's private half. */
    static final String VALID = "eyJzaWQiOiJzdWJfTmFuaGE3VGVzdDQyWHl6IiwiZXhwIjoxODkzNDU2MDAwfQ"
            + ".HpPiREpXTm7HMkCKj4_FblHtB68sk_aRgiiBIgaqRMRETaqWHcbug7j1JxupQQLQBNAVuk8kkc6ZVwt0HmS2xA";

    /** The same payload signed with a different key pair. */
    private static final String OTHER_KEY = "eyJzaWQiOiJzdWJfTmFuaGE3VGVzdDQyWHl6IiwiZXhwIjoxODkzNDU2MDAwfQ"
            + ".2kMqymwyk6HsyJiytr6ExvCqAuCOotjgSdrelHAAK_4hoD5FPDSzA0Qq_uJMF27lHNPegnSV2rYOvL4Gh6vxaw";

    /** Correctly signed, but the payload is not a valid pass: wrong ID prefix. */
    private static final String BAD_SID = "eyJzaWQiOiJjdXNfTmFuaGE3VGVzdDQyWHl6IiwiZXhwIjoxODkzNDU2MDAwfQ"
            + ".JWhfSi9159u1AiD74e6wBH8hsl3lvmpi3BSbtNVoj4wKHoC4Aj3QkSv7LHBgnmUtFQ8tvC0onmVtOpEJa5R1Iw";

    /** Correctly signed, but exp is a string. */
    private static final String STRING_EXP = "eyJzaWQiOiJzdWJfTmFuaGE3VGVzdDQyWHl6IiwiZXhwIjoiMTg5MzQ1NjAwMCJ9"
            + ".kDNvyRUrM374N6qFIseNJPIMgJH9LlT_-e8oyO_7ualNmLWnNrXHWBd5RjnsesBXmuvnc20vFsvBTLvTF-5Uzw";

    /** Correctly signed, but with an extra field the server never writes. */
    private static final String EXTRA_FIELD =
            "eyJzaWQiOiJzdWJfTmFuaGE3VGVzdDQyWHl6IiwiZXhwIjoxODkzNDU2MDAwLCJhZG1pbiI6dHJ1ZX0"
            + ".vZoMiGiJV8dozNrGPUuOYD9fLLpiM0wNs4y0APBADV0YjQD9YqosVgfwASlATa5E9t4zLKUlYZaskfhhseG9xw";

    @Test
    public void validTokenGivesSidAndExp() {
        PassVerifier.Pass pass = PassVerifier.verify(VALID, SPKI);
        assertNotNull(pass);
        assertEquals(SID, pass.sid);
        assertEquals(EXP, pass.exp);

        PassVerifier.Pass again = PassVerifier.verify(VALID, PassVerifier.parsePublicKey(SPKI));
        assertNotNull(again);
        assertEquals(SID, again.sid);
    }

    @Test
    public void tamperedPayloadIsRejected() {
        String signature = VALID.substring(VALID.indexOf('.') + 1);
        String longer = b64url("{\"sid\":\"" + SID + "\",\"exp\":1993456000}");
        assertNull(PassVerifier.verify(longer + "." + signature, SPKI));
        String otherSid = b64url("{\"sid\":\"sub_SomeoneElse99\",\"exp\":" + EXP + "}");
        assertNull(PassVerifier.verify(otherSid + "." + signature, SPKI));
    }

    @Test
    public void tamperedSignatureIsRejected() {
        int at = VALID.indexOf('.') + 10;
        char swapped = VALID.charAt(at) == 'A' ? 'B' : 'A';
        String tampered = VALID.substring(0, at) + swapped + VALID.substring(at + 1);
        assertNull(PassVerifier.verify(tampered, SPKI));

        String payload = VALID.substring(0, VALID.indexOf('.'));
        String zeros = b64url(new byte[64]);
        assertNull(PassVerifier.verify(payload + "." + zeros, SPKI));
        String shortSig = VALID.substring(0, VALID.length() - 4);
        assertNull(PassVerifier.verify(shortSig, SPKI));
    }

    @Test
    public void malformedTokensAreRejected() {
        String payload = VALID.substring(0, VALID.indexOf('.'));
        String signature = VALID.substring(VALID.indexOf('.') + 1);
        String[] bad = {
                null, "", "abc", "a.b.c", ".", "abc.", ".abc", "a.b",
                "!!!!.@@@@", "%%%.%%%", "a b.c d",
                VALID + ".x", VALID + "=", payload + "=." + signature,
                payload.replace('J', '+') + "." + signature,
                payload + "." + signature.replace('_', '/'),
                payload + "." + signature + signature,
                repeat('A', PassVerifier.MAX_TOKEN_LENGTH) + "." + signature,
                "कख.ग",
        };
        for (String token : bad) {
            assertNull("should reject: " + token, PassVerifier.verify(token, SPKI));
        }
        assertNull(PassVerifier.verify(VALID, (PublicKey) null));
        assertNull(PassVerifier.verify(VALID, ""));
        assertNull(PassVerifier.verify(VALID, "not a key"));
    }

    @Test
    public void tokenFromAnotherKeyIsRejected() {
        assertNull(PassVerifier.verify(OTHER_KEY, SPKI));
    }

    @Test
    public void signedButMalformedPayloadIsRejected() {
        assertNull(PassVerifier.verify(BAD_SID, SPKI));
        assertNull(PassVerifier.verify(STRING_EXP, SPKI));
        assertNull(PassVerifier.verify(EXTRA_FIELD, SPKI));
    }

    @Test
    public void payloadParserIsStrict() {
        assertNotNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":1}"));
        assertNotNull(PassVerifier.parsePayload("{ \"sid\" : \"sub_abcdef\" , \"exp\" : 123 }"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcde\",\"exp\":1}"));           // ID too short
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abc-def\",\"exp\":1}"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":-1}"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":0}"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":1.5}"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":1234567890123}"));
        assertNull(PassVerifier.parsePayload("{\"exp\":1,\"sid\":\"sub_abcdef\"}"));
        assertNull(PassVerifier.parsePayload("{\"sid\":\"sub_abcdef\",\"exp\":1}x"));
        assertNull(PassVerifier.parsePayload(null));
        assertTrue(PassVerifier.isSubscriptionId("sub_Nanha7Test42Xyz"));
        assertFalse(PassVerifier.isSubscriptionId("sub_abc"));
        assertFalse(PassVerifier.isSubscriptionId(null));
    }

    @Test
    public void onlyP256KeysAreAccepted() throws Exception {
        assertNotNull(PassVerifier.parsePublicKey(SPKI));
        // Line breaks and the URL-safe alphabet are tolerated in the configured key.
        String wrapped = SPKI.substring(0, 40) + "\n" + SPKI.substring(40, 80) + "\r\n " + SPKI.substring(80);
        assertNotNull(PassVerifier.parsePublicKey(wrapped));
        assertNotNull(PassVerifier.parsePublicKey(SPKI.replace('+', '-').replace('/', '_')));

        assertNull(PassVerifier.parsePublicKey(null));
        assertNull(PassVerifier.parsePublicKey(""));
        assertNull(PassVerifier.parsePublicKey("abc"));
        assertNull(PassVerifier.parsePublicKey(SPKI.substring(0, SPKI.length() - 10)));

        KeyPairGenerator rsa = KeyPairGenerator.getInstance("RSA");
        rsa.initialize(2048);
        assertNull(PassVerifier.parsePublicKey(std(rsa.generateKeyPair().getPublic().getEncoded())));

        KeyPairGenerator p384 = KeyPairGenerator.getInstance("EC");
        p384.initialize(new ECGenParameterSpec("secp384r1"));
        assertNull(PassVerifier.parsePublicKey(std(p384.generateKeyPair().getPublic().getEncoded())));
    }

    /** Signs with a key made by the JVM, converts DER → r||s like WebCrypto, and verifies. */
    @Test
    public void jvmRoundTrip() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair pair = generator.generateKeyPair();
        String spki = std(pair.getPublic().getEncoded());
        KeyPair stranger = generator.generateKeyPair();
        Random random = new Random(42);

        // Enough signatures that r or s regularly start with a zero byte or a high bit.
        for (int i = 0; i < 300; i++) {
            String sid = "sub_Test" + Long.toString(random.nextLong() & Long.MAX_VALUE, 36) + i;
            long exp = 1_700_000_000L + random.nextInt(1_000_000_000);
            String payload = b64url("{\"sid\":\"" + sid + "\",\"exp\":" + exp + "}");

            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(pair.getPrivate());
            signer.update(payload.getBytes(StandardCharsets.US_ASCII));
            byte[] der = signer.sign();
            byte[] raw = p1363FromDer(der);
            assertArrayEquals("DER conversion must be exact", der, PassVerifier.derFromP1363(raw));

            PassVerifier.Pass pass = PassVerifier.verify(payload + "." + b64url(raw), spki);
            assertNotNull(pass);
            assertEquals(sid, pass.sid);
            assertEquals(exp, pass.exp);

            signer.initSign(stranger.getPrivate());
            signer.update(payload.getBytes(StandardCharsets.US_ASCII));
            String forged = payload + "." + b64url(p1363FromDer(signer.sign()));
            assertNull(PassVerifier.verify(forged, spki));
        }
    }

    @Test
    public void derConversionHandlesLeadingZerosAndHighBit() {
        byte[] raw = new byte[64];
        raw[31] = 0x01;              // r = 1 (31 leading zero bytes)
        raw[32] = (byte) 0x80;       // s has its top bit set, so it needs a 0x00 in front
        byte[] expected = new byte[2 + 3 + 35];
        expected[0] = 0x30;
        expected[1] = 38;
        expected[2] = 0x02;
        expected[3] = 1;
        expected[4] = 0x01;
        expected[5] = 0x02;
        expected[6] = 33;
        expected[7] = 0x00;
        expected[8] = (byte) 0x80;
        assertArrayEquals(expected, PassVerifier.derFromP1363(raw));
    }

    @Test
    public void base64UrlDecoderMatchesJava() {
        Random random = new SecureRandom();
        for (int length = 0; length < 100; length++) {
            byte[] bytes = new byte[length];
            random.nextBytes(bytes);
            assertArrayEquals(bytes, PassVerifier.decodeBase64Url(b64url(bytes)));
        }
        assertArrayEquals(new byte[] {0}, PassVerifier.decodeBase64Url("AA"));
        assertNull(PassVerifier.decodeBase64Url("AB"));     // non-zero leftover bits
        assertNull(PassVerifier.decodeBase64Url("A"));      // impossible length
        assertNull(PassVerifier.decodeBase64Url("AA=="));   // padding is never sent
        assertNull(PassVerifier.decodeBase64Url("a+b/"));   // standard alphabet is not base64url
        assertNull(PassVerifier.decodeBase64Url(null));
    }

    // ---- helpers (test only; the app itself cannot use java.util.Base64 on API 24) ----

    static String b64url(String text) {
        return b64url(text.getBytes(StandardCharsets.UTF_8));
    }

    static String b64url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String std(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static String repeat(char c, int n) {
        char[] chars = new char[n];
        Arrays.fill(chars, c);
        return new String(chars);
    }

    /** DER SEQUENCE { INTEGER r, INTEGER s } → 64-byte r||s (what WebCrypto produces). */
    private static byte[] p1363FromDer(byte[] der) {
        int offset = 2;                              // 0x30, length (always short form for P-256)
        byte[] out = new byte[64];
        for (int part = 0; part < 2; part++) {
            int length = der[offset + 1];
            int start = offset + 2;
            int end = start + length;
            while (length > 32) {                    // drop the sign byte
                start++;
                length--;
            }
            System.arraycopy(der, start, out, part * 32 + (32 - length), length);
            offset = end;
        }
        return out;
    }
}
