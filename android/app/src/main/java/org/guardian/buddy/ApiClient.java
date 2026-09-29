package org.guardian.buddy;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

import javax.net.ssl.HttpsURLConnection;

/**
 * Talks to the subscription server (server/worker.js): one JSON POST at a time, over
 * HTTPS only, on a background thread, with the answer delivered back on the main thread.
 *
 * <p>Nothing is ever logged — not the request, not the answer, not the pass. The server
 * is sent only what each call needs (a trial-day count, a restore code or a pass); no
 * name, email or phone number ever leaves the phone.
 */
final class ApiClient {

    /** What came back: either {@link #json} or an {@link #error} code (never both). */
    static final class Response {
        /** The server's JSON answer, when the call worked. */
        final JSONObject json;
        /** "network" when the server could not be reached, otherwise the server's error code. */
        final String error;
        /** The server's clock (ms since 1970) from its Date header, or 0 if unknown. */
        final long serverTime;

        private Response(JSONObject json, String error, long serverTime) {
            this.json = json;
            this.error = error;
            this.serverTime = serverTime;
        }

        static Response ok(JSONObject json, long serverTime) {
            return new Response(json, null, serverTime);
        }

        static Response failed(String error, long serverTime) {
            return new Response(null, error, serverTime);
        }
    }

    /** Receives the answer on the main thread. */
    interface Callback {
        void onDone(Response response);
    }

    static final String NETWORK = "network";
    static final String SERVER_ERROR = "server_error";

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 15_000;
    private static final int MAX_RESPONSE_BYTES = 16 * 1024;
    private static final Pattern ERROR_CODE = Pattern.compile("^[a-z_]{1,40}$");

    private static final Executor WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "nanha-api");
        thread.setDaemon(true);
        return thread;
    });
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private ApiClient() {
    }

    /** Sends {@code body} to {@link Config#API_BASE} + {@code path}; the answer arrives on the main thread. */
    static void post(String path, JSONObject body, Callback callback) {
        final String payload = body.toString();
        WORKER.execute(() -> {
            Response response = send(path, payload);
            MAIN.post(() -> callback.onDone(response));
        });
    }

    /** Builds a small JSON body from key, value, key, value… */
    static JSONObject body(Object... keysAndValues) {
        JSONObject json = new JSONObject();
        for (int i = 0; i + 1 < keysAndValues.length; i += 2) {
            try {
                json.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
            } catch (JSONException ignored) {
                // Only happens for a null key or a non-finite number, which callers never pass.
            }
        }
        return json;
    }

    /** A string field of a JSON answer, or null if it is missing or not a string. */
    static String string(JSONObject json, String key) {
        Object value = json == null ? null : json.opt(key);
        return value instanceof String ? (String) value : null;
    }

    private static Response send(String path, String payload) {
        String base = Config.API_BASE;
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String address = base + path;
        if (!Config.isHttpsUrl(address)) {
            return Response.failed(SERVER_ERROR, 0);   // never send anything over plain http
        }
        HttpsURLConnection connection = null;
        try {
            URLConnection opened = new URL(address).openConnection();
            if (!(opened instanceof HttpsURLConnection)) {
                return Response.failed(SERVER_ERROR, 0);
            }
            connection = (HttpsURLConnection) opened;
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(false);
            connection.setDoOutput(true);
            // No Origin header is sent: the server treats requests without one as coming from the app.
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(bytes);
            }

            int status = connection.getResponseCode();
            long serverTime = connection.getDate();
            boolean ok = status >= 200 && status < 300;
            JSONObject json = parse(read(ok ? connection.getInputStream() : connection.getErrorStream()));
            if (ok) {
                return json != null ? Response.ok(json, serverTime) : Response.failed(SERVER_ERROR, serverTime);
            }
            String code = json != null ? json.optString("error", "") : "";
            return Response.failed(ERROR_CODE.matcher(code).matches() ? code : SERVER_ERROR, serverTime);
        } catch (IOException | RuntimeException e) {
            // Offline, timed out, TLS refused, … Details are deliberately not logged.
            return Response.failed(NETWORK, 0);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) {
            return "";
        }
        try (InputStream stream = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[2048];
            int n;
            while ((n = stream.read(chunk)) != -1) {
                if (out.size() + n > MAX_RESPONSE_BYTES) {
                    return "";   // far bigger than any real answer: treat as a server error
                }
                out.write(chunk, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static JSONObject parse(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }
        try {
            return new JSONObject(text);
        } catch (JSONException e) {
            return null;
        }
    }
}
