package org.marketcompass.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * Market Compass: shows the live web app full-screen. Pages on the app's own site stay in the app; every other link
 * (news stories, NSE pages) opens in the phone's browser. When offline it shows a retry screen.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://aditrikaushik.github.io/Guardian/market-compass/";
    static final String HOST = "aditrikaushik.github.io";
    static final String PATH = "/Guardian/market-compass";

    private WebView web;
    private ProgressBar bar;
    private LinearLayout offline;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);          // the app is a JavaScript page
        s.setDomStorageEnabled(true);          // your scorecard, log and settings are saved here
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                bar.setProgress(p);
                bar.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        root.addView(bar, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 8));

        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(android.view.Gravity.CENTER);
        offline.setBackgroundColor(0xFFF5F7FA);
        offline.setPadding(48, 48, 48, 48);
        TextView msg = new TextView(this);
        msg.setText("No internet connection.\nMarket Compass needs the internet for live prices.");
        msg.setTextSize(17);
        msg.setGravity(android.view.Gravity.CENTER);
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(v -> { offline.setVisibility(View.GONE); web.reload(); });
        offline.addView(msg);
        offline.addView(retry);
        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(PATH)) {
                return false;                  // stay inside the app
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));   // news, NSE, GitHub: phone's browser
            } catch (Exception ignored) { }
            return true;
        }

        @Override
        public void onPageStarted(WebView v, String url, Bitmap icon) {
            offline.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) offline.setVisibility(View.VISIBLE);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
