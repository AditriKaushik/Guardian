package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Random;
import org.junit.Test;

/** The grown-ups' times-table question. */
public class ParentGateTest {

    @Test
    public void numbersAreSixToNine() {
        Random random = new Random(7);
        for (int i = 0; i < 500; i++) {
            ParentGate gate = new ParentGate(random);
            assertTrue(ParentGate.isValid(gate.a, gate.b));
        }
        assertFalse(ParentGate.isValid(5, 7));
        assertFalse(ParentGate.isValid(7, 10));
    }

    @Test
    public void acceptsOrdinaryAndDevanagariDigits() {
        ParentGate gate = new ParentGate(7, 8);
        assertEquals("7 × 8 = ?", gate.question());
        assertTrue(gate.check("56"));
        assertTrue(gate.check(" 56 "));
        assertTrue(gate.check("५६"));
        assertTrue(gate.check("5६"));
        assertFalse(gate.check("65"));
        assertFalse(gate.check(""));
        assertFalse(gate.check(null));
        assertFalse(gate.check("abc"));
        assertFalse(gate.check("-56"));
        assertFalse(gate.check("56.0"));
        assertFalse(gate.check("5 6"));
        assertEquals(-1, ParentGate.parseNumber("12345"));
    }
}
