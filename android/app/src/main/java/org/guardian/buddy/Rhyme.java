package org.guardian.buddy;

/** A nursery rhyme: a title, the lines to show, and the language to read them in. */
public class Rhyme {

    public final String title;
    public final String[] lines;
    public final String lang;   // "hi" or "en"

    public Rhyme(String title, String lang, String... lines) {
        this.title = title;
        this.lang = lang;
        this.lines = lines;
    }

    /** The whole rhyme as one block of text, for showing on screen. */
    public String text() {
        return String.join("\n", lines);
    }
}
