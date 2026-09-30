package org.guardian.buddy;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Payments switch on only with an https server address and a valid P-256 public key. */
public class ConfigTest {

    private static final String API = "https://nanha-school-api.example.workers.dev";
    private static final String PAY = "https://example.github.io/Guardian/pay.html";

    @Test
    public void paymentsNeedHttpsAndAKey() {
        assertTrue(Config.paymentsOn(API, PAY, PassVerifierTest.SPKI));
        assertFalse(Config.paymentsOn("", PAY, PassVerifierTest.SPKI));
        assertFalse(Config.paymentsOn(API, PAY, ""));
        assertFalse(Config.paymentsOn(API, PAY, "not a key"));
        assertFalse(Config.paymentsOn("http://nanha-school-api.example.workers.dev", PAY, PassVerifierTest.SPKI));
        assertFalse(Config.paymentsOn(API, "http://example.github.io/pay.html", PassVerifierTest.SPKI));
    }

    @Test
    public void httpsUrlCheck() {
        assertTrue(Config.isHttpsUrl(API));
        assertTrue(Config.isHttpsUrl(API + "/api/restore"));
        assertFalse(Config.isHttpsUrl(null));
        assertFalse(Config.isHttpsUrl(""));
        assertFalse(Config.isHttpsUrl("https://"));
        assertFalse(Config.isHttpsUrl("https:///path"));
        assertFalse(Config.isHttpsUrl("HTTP://example.com"));
        assertFalse(Config.isHttpsUrl("https://exa mple.com"));
        assertFalse(Config.isHttpsUrl("ftp://example.com"));
    }
}
