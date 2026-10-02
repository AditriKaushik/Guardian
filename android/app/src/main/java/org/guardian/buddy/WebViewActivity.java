package org.guardian.buddy;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * The whole Android app: one full-screen WebView showing the web app from web/ (bundled as
 * assets and served from https://appassets.androidplatform.net/), plus the NanhaNative bridge
 * for the phone's voices, speech recognition and the browser (for payments).
 *
 * <p>Security: only the bundled app runs inside the WebView. Other https links open in the
 * browser; every other kind of address is ignored. No file or content access, no mixed content,
 * no third-party frames (Razorpay is blocked here — in the app it runs in the browser), and
 * the bridge works only while the bundled app is showing.
 */
public class WebViewActivity extends Activity {

    private static final long BACK_TIMEOUT_MS = 1500;

    private final Handler main = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private View statusStrip;
    private WebView webView;
    private NativeSpeech speech;
    private NativeListener listener;
    private AssetManager assets;

    /** True while the WebView's current page is on the app origin (set on the UI thread). */
    private volatile boolean onAppPage;
    private boolean backPending;
    private final Runnable backTimeout = () -> backPending = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        assets = getApplicationContext().getAssets();

        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.bg));
        try {
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);   // debug builds only
            webView = new WebView(this);
        } catch (RuntimeException e) {
            // No usable "Android System WebView" (missing, disabled or being updated).
            showMessage(getString(R.string.no_webview));
            return;
        }
        webView.setBackgroundColor(getColor(R.color.bg));
        statusStrip = new View(this);
        statusStrip.setBackgroundColor(getColor(R.color.header));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(statusStrip, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, Gravity.TOP));
        setContentView(root);
        goEdgeToEdge();

        speech = new NativeSpeech(this, this::emit);
        listener = new NativeListener(this, this::emit);

        configureWebView();
        webView.loadUrl(Config.START_URL);
    }

    // ---- Window: edge to edge, the WebView padded clear of the system bars -------------------

    @SuppressWarnings("deprecation")   // setDecorFitsSystemWindows: Android 15 is edge-to-edge anyway
    private void goEdgeToEdge() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                // Light icons on the orange status bar, dark icons on the cream navigation bar.
                controller.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else {
            setLegacyEdgeToEdge(window);
        }
        if (Build.VERSION.SDK_INT < 35) {
            setLegacyBarColors(window);
        }
        root.setOnApplyWindowInsetsListener(this::applyInsets);
        root.requestApplyInsets();
    }

    @SuppressWarnings("deprecation")
    private static void setLegacyEdgeToEdge(Window window) {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
    }

    @SuppressWarnings("deprecation")
    private static void setLegacyBarColors(Window window) {
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        // Before Android 8 the navigation-bar icons are always white: keep that bar dark.
        window.setNavigationBarColor(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? android.graphics.Color.TRANSPARENT : android.graphics.Color.BLACK);
    }

    /**
     * Keeps the page clear of the status bar, navigation bar, display cutout and keyboard by
     * giving the WebView margins (the orange strip fills the status-bar area). The insets are
     * consumed here, so the page sees env(safe-area-inset-*) = 0 and needs no special case.
     */
    @SuppressWarnings("deprecation")
    private WindowInsets applyInsets(View v, WindowInsets insets) {
        if (webView == null) {
            return insets;
        }
        int left;
        int top;
        int right;
        int bottom;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            left = i.left;
            top = i.top;
            right = i.right;
            bottom = i.bottom;
        } else {
            left = insets.getSystemWindowInsetLeft();
            top = insets.getSystemWindowInsetTop();
            right = insets.getSystemWindowInsetRight();
            bottom = insets.getSystemWindowInsetBottom();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                DisplayCutout cutout = insets.getDisplayCutout();
                if (cutout != null) {
                    left = Math.max(left, cutout.getSafeInsetLeft());
                    top = Math.max(top, cutout.getSafeInsetTop());
                    right = Math.max(right, cutout.getSafeInsetRight());
                    bottom = Math.max(bottom, cutout.getSafeInsetBottom());
                }
            }
        }
        FrameLayout.LayoutParams web = (FrameLayout.LayoutParams) webView.getLayoutParams();
        web.setMargins(left, top, right, bottom);
        webView.setLayoutParams(web);
        FrameLayout.LayoutParams strip = (FrameLayout.LayoutParams) statusStrip.getLayoutParams();
        strip.height = top;
        statusStrip.setLayoutParams(strip);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return WindowInsets.CONSUMED;
        }
        return insets.consumeSystemWindowInsets();
    }

    // ---- WebView -------------------------------------------------------------------------------

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @SuppressWarnings("deprecation")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);              // child profiles live in the page's storage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setGeolocationEnabled(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // voice clips play without a tap
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                        // keep the child-sized layout stable
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSaveFormData(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(false);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new ShellClient());
        webView.setWebChromeClient(new WebChromeClient());   // default: denies all web permissions
        webView.addJavascriptInterface(new NanhaBridge(this), NanhaBridge.NAME);

        // Service workers fetch through their own client: serve them the same bundled files.
        ServiceWorkerController workers = ServiceWorkerController.getInstance();
        ServiceWorkerWebSettings ws = workers.getServiceWorkerWebSettings();
        ws.setAllowContentAccess(false);
        ws.setAllowFileAccess(false);
        workers.setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return serve(request);
            }
        });
    }

    /**
     * Answers requests for the app origin from the APK's assets (never the network); blocks
     * hosts that must not load in the app; lets everything else (the payment API) through.
     * Runs on a WebView background thread.
     */
    private WebResourceResponse serve(WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (ShellPolicy.isAppUrl(url)) {
            String method = request.getMethod();
            if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
                return status(405, "Method Not Allowed");
            }
            String path = ShellPolicy.assetPath(url);
            if (path == null) {
                return status(404, "Not Found");
            }
            String mime = ShellPolicy.mimeType(path);
            try {
                InputStream in = assets.open(path, AssetManager.ACCESS_STREAMING);
                return new WebResourceResponse(mime, ShellPolicy.encodingFor(mime), 200, "OK",
                        headers(), in);
            } catch (IOException e) {
                return status(404, "Not Found");
            }
        }
        if (ShellPolicy.isBlockedInApp(url)) {
            return status(403, "Forbidden");
        }
        return null;
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, headers(),
                new ByteArrayInputStream(new byte[0]));
    }

    private static Map<String, String> headers() {
        Map<String, String> h = new HashMap<>();
        h.put("Content-Security-Policy", Config.CONTENT_SECURITY_POLICY);
        h.put("X-Content-Type-Options", "nosniff");
        h.put("Cache-Control", "no-cache");
        h.put("Referrer-Policy", "strict-origin-when-cross-origin");
        return h;
    }

    private final class ShellClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            switch (ShellPolicy.navigation(url)) {
                case APP:
                    return false;
                case EXTERNAL:
                    if (request.isForMainFrame()) {
                        openInBrowser(url);
                    }
                    return true;
                default:
                    return true;
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return serve(request);
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            onAppPage = ShellPolicy.isAppUrl(url);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            onAppPage = ShellPolicy.isAppUrl(url);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            onAppPage = ShellPolicy.isAppUrl(url);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The page's renderer crashed or was killed for memory: start afresh instead of
            // letting the whole app crash. (Android 8+; older versions restart the app.)
            if (view == webView) {
                onAppPage = false;
                root.removeView(webView);
                webView.destroy();
                webView = null;
                recreate();
            }
            return true;
        }
    }

    // ---- Used by the bridge --------------------------------------------------------------------

    boolean isOnAppPage() {
        return onAppPage;
    }

    NativeSpeech speech() {
        return speech;
    }

    NativeListener listener() {
        return listener;
    }

    /** Sends one event (JSON) to the page, on the UI thread. Any thread. */
    void emit(String json) {
        main.post(() -> {
            if (webView != null && onAppPage) {
                webView.evaluateJavascript(ShellPolicy.eventScript(json), null);
            }
        });
    }

    /** Opens an https page in the phone's browser (UI thread). */
    void openInBrowser(String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException e) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_LONG).show();
        }
    }

    /** FLAG_SECURE on/off (UI thread): no screenshots or recents preview of grown-ups' screens. */
    void setSecure(boolean on) {
        if (on) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    // ---- Lifecycle -----------------------------------------------------------------------------

    @Override
    protected void onNewIntent(Intent intent) {
        // nanhaschool://open (back from the payment page): nothing is read from the link;
        // onResume tells the page, which then checks the payment with the server itself.
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            emit(ShellPolicy.resumeEvent());
        }
    }

    @Override
    protected void onPause() {
        // Nothing speaks or listens while the app is in the background. (A listen() waiting for
        // the microphone permission dialog — which itself pauses this activity — is kept.)
        if (listener != null) {
            listener.cancel(false);
        }
        if (speech != null) {
            speech.stop();
        }
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        if (listener != null) {
            listener.cancel(true);
        }
        if (speech != null) {
            speech.shutdown();
        }
        if (webView != null) {
            webView.removeJavascriptInterface(NanhaBridge.NAME);
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == NativeListener.PERMISSION_REQUEST && listener != null) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            listener.onPermissionResult(granted);
        }
    }

    /** Back: the page goes back a screen if it can (NS.back() returns true); else the app closes. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null || !onAppPage) {
            super.onBackPressed();
            return;
        }
        if (backPending) {
            return;
        }
        backPending = true;
        main.postDelayed(backTimeout, BACK_TIMEOUT_MS);
        webView.evaluateJavascript(ShellPolicy.BACK_SCRIPT, result -> {
            main.removeCallbacks(backTimeout);
            backPending = false;
            if (!"true".equals(result) && !isFinishing()) {
                finish();
            }
        });
    }

    private void showMessage(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(20);
        view.setGravity(Gravity.CENTER);
        view.setPadding(48, 48, 48, 48);
        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
    }
}
