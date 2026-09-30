package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** The free-trial clock, pass expiry and which tiles and rhymes are locked. */
public class EntitlementTest {

    private static final long DAY = Entitlement.DAY_MS;
    private static final long START = 1_790_000_000_000L;   // some moment in 2026
    private static final String[] FREE = {"ABC", "गिनती"};

    @Test
    public void clockNeverRunsBackwards() {
        assertEquals(5000L, Entitlement.clock(1000L, 5000L));
        assertEquals(6000L, Entitlement.clock(6000L, 5000L));
    }

    @Test
    public void trialCountsDownFromSevenDays() {
        assertEquals(7, Entitlement.trialDaysLeft(START, START, 7));
        assertEquals(7, Entitlement.trialDaysLeft(START, START + 1, 7));
        assertEquals(6, Entitlement.trialDaysLeft(START, START + DAY, 7));
        assertEquals(1, Entitlement.trialDaysLeft(START, START + 6 * DAY + 1, 7));
        assertEquals(0, Entitlement.trialDaysLeft(START, START + 7 * DAY, 7));
        assertEquals(0, Entitlement.trialDaysLeft(START, START + 100 * DAY, 7));
        assertEquals(7, Entitlement.trialDaysLeft(START + 3 * DAY, START, 7));   // never more than the trial
        assertEquals(0, Entitlement.trialDaysLeft(START, START, 0));
    }

    @Test
    public void settingThePhoneDateBackDoesNotExtendTheTrial() {
        long lastSeen = START + 6 * DAY + DAY / 2;           // six and a half days in
        long phoneSaysNow = START + DAY;                    // someone moved the date back
        long now = Entitlement.clock(phoneSaysNow, lastSeen);
        assertEquals(1, Entitlement.trialDaysLeft(START, now, 7));
    }

    @Test
    public void passExpiryAndRefreshWindow() {
        long exp = (START + 10 * DAY) / 1000;
        assertTrue(Entitlement.isActive(exp, START));
        assertFalse(Entitlement.isActive(exp, START + 10 * DAY));
        assertFalse(Entitlement.needsRefresh(exp, START));
        assertTrue(Entitlement.needsRefresh(exp, START + 7 * DAY + 1));
        assertTrue(Entitlement.needsRefresh(exp, START + 20 * DAY));   // already ended: try to renew
    }

    @Test
    public void tilesLockOnlyWithoutAccess() {
        for (String title : new String[] {"ABC", "गिनती", "कविताएँ", "रंग", "खेल", "बात करो"}) {
            assertFalse(title, Entitlement.isTileLocked(title, true, FREE));
        }
        assertFalse(Entitlement.isTileLocked("ABC", false, FREE));
        assertFalse(Entitlement.isTileLocked("गिनती", false, FREE));
        assertFalse(Entitlement.isTileLocked("कविताएँ", false, FREE));
        assertTrue(Entitlement.isTileLocked("रंग", false, FREE));
        assertTrue(Entitlement.isTileLocked("खेल", false, FREE));
        assertTrue(Entitlement.isTileLocked("बात करो", false, FREE));
    }

    @Test
    public void firstRhymesStayFree() {
        assertFalse(Entitlement.isRhymeLocked(0, false, 2));
        assertFalse(Entitlement.isRhymeLocked(1, false, 2));
        assertTrue(Entitlement.isRhymeLocked(2, false, 2));
        assertTrue(Entitlement.isRhymeLocked(8, false, 2));
        assertFalse(Entitlement.isRhymeLocked(8, true, 2));
    }

    @Test
    public void serverClockOnlyPullsAFutureDateBack() {
        long server = START;
        assertEquals(server, Entitlement.correctedTime(server + 30 * DAY, server));   // phone was ahead
        assertEquals(server - DAY, Entitlement.correctedTime(server - DAY, server));   // never moved later
        assertEquals(server + 60_000L, Entitlement.correctedTime(server + 60_000L, server));   // small drift
        assertEquals(server + 30 * DAY, Entitlement.correctedTime(server + 30 * DAY, 0L));    // no server time
    }

    @Test
    public void restoreCodes() {
        String code = "sub_Nanha7Test42Xyz.AbCdEfGh12_-34xY";
        assertEquals("sub_Nanha7Test42Xyz", Entitlement.subscriptionOfRestoreCode(code));
        assertEquals(code, Entitlement.cleanRestoreCode("  sub_Nanha7Test42Xyz.AbCd\nEfGh12_-34xY \n"));
        assertNull(Entitlement.subscriptionOfRestoreCode("sub_Nanha7Test42Xyz"));
        assertNull(Entitlement.subscriptionOfRestoreCode("sub_Nanha7Test42Xyz.short"));
        assertNull(Entitlement.subscriptionOfRestoreCode("sub_Nanha7Test42Xyz.AbCdEfGh12_-34xYZ"));
        assertNull(Entitlement.subscriptionOfRestoreCode("cus_Nanha7Test42Xyz.AbCdEfGh12_-34xY"));
        assertNull(Entitlement.subscriptionOfRestoreCode("sub_Nanha7Test42Xyz.AbCdEfGh12+/34xY"));
        assertNull(Entitlement.subscriptionOfRestoreCode(null));
    }
}
