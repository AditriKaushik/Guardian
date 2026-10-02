package org.guardian.buddy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.Test;

/** The shell's settings agree with the bundled web app. */
public class ConfigTest {

    /** web/index.html, found from the module folder (Gradle) or the repository root. */
    private static File indexHtml() {
        for (String path : new String[] {"../../web/index.html", "../web/index.html", "web/index.html"}) {
            File f = new File(path);
            if (f.isFile()) {
                return f;
            }
        }
        return null;
    }

    @Test
    public void cspHeaderMatchesTheWebAppsMetaTag() throws IOException {
        File index = indexHtml();
        assertNotNull("web/index.html not found", index);
        String html = new String(Files.readAllBytes(index.toPath()), StandardCharsets.UTF_8);
        Matcher m = Pattern.compile(
                "<meta\\s+http-equiv=\"Content-Security-Policy\"\\s+content=\"([^\"]*)\"",
                Pattern.CASE_INSENSITIVE).matcher(html);
        assertTrue("no CSP <meta> in web/index.html", m.find());
        assertEquals("Config.CONTENT_SECURITY_POLICY must equal the CSP <meta> in web/index.html",
                m.group(1), Config.CONTENT_SECURITY_POLICY);
    }

    @Test
    public void originAndStartPage() {
        assertEquals("https://appassets.androidplatform.net", Config.APP_ORIGIN);
        assertEquals("https://appassets.androidplatform.net/index.html", Config.START_URL);
        assertEquals("index.html", ShellPolicy.assetPath(Config.START_URL));
    }

    @Test
    public void payPageIsAnAllowedExternalPage() {
        assertTrue(ShellPolicy.isAllowedExternal(Config.PAY_PAGE_URL));
        assertTrue(ShellPolicy.isAllowedExternal(Config.PAY_PAGE_URL + "#s=sub_ABC123&k=rzp_test_ABC123"));
    }
}
