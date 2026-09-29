package org.guardian.buddy;

/**
 * One thing a small child learns: a letter, a number, a colour, an animal…
 *
 * <p>Everything is picture-and-voice first, because children this age cannot
 * read yet. {@link #big} is the large glyph shown in the middle of the card
 * (a letter, a digit, or an emoji), {@link #caption} is the little label
 * underneath, and {@link #speak} is what Buddy says out loud in {@link #lang}.
 */
public class Card {

    public final String big;
    public final String caption;
    public final String speak;
    public final String lang;      // "hi" or "en"
    public final Integer bg;       // optional background colour (used by the "colours" lesson)

    public Card(String big, String caption, String speak, String lang) {
        this(big, caption, speak, lang, null);
    }

    public Card(String big, String caption, String speak, String lang, Integer bg) {
        this.big = big;
        this.caption = caption;
        this.speak = speak;
        this.lang = lang;
        this.bg = bg;
    }
}
