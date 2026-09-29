package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Random;
import org.junit.Test;

public class BuddyBrainTest {

    private final BuddyBrain brain = new BuddyBrain(new Random(1));

    @Test
    public void doesSimpleMathInHindiAndEnglish() {
        assertTrue(brain.reply("२ जमा ३").startsWith("2 + 3 = 5"));
        assertTrue(brain.reply("12 x 4").startsWith("12 × 4 = 48"));
        assertTrue(brain.reply("what is 5 plus 6").startsWith("5 + 6 = 11"));
    }

    @Test
    public void remembersTheChildsName() {
        assertTrue(brain.reply("मेरा नाम राहुल है").contains("राहुल"));
        assertEquals("तुम्हारा नाम राहुल है! 😊", brain.reply("मेरा नाम क्या है"));
    }

    @Test
    public void pointsToATrustedAdultWhenAChildIsHurt() {
        assertTrue(brain.reply("वो मुझे मारता है").contains("1098"));
    }

    @Test
    public void keywordsDoNotMatchInsideOtherWords() {
        assertTrue(brain.reply("नमस्ते").startsWith("नमस्ते"));
        assertTrue(!brain.reply("हमारा घर बड़ा है").contains("1098"));
        assertTrue(!brain.reply("तुम कहाँ रहते हो").startsWith("तो ये लो"));
    }
}
