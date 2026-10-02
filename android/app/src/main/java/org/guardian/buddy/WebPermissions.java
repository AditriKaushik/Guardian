package org.guardian.buddy;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.webkit.PermissionRequest;

/**
 * Answers the web app's permission requests (WebChromeClient.onPermissionRequest). The only
 * thing ever granted is the camera, video only, to the bundled app itself — for the
 * "जादुई खिड़की" (magic window) activity, which calls getUserMedia({video}) only after a
 * grown-up has turned the camera on. The phone's CAMERA permission is asked for the first time;
 * if it is refused, the page's request is refused too (getUserMedia rejects). The microphone,
 * protected media (DRM), MIDI and every other origin are always refused
 * (see {@link ShellPolicy#allowsCamera}).
 *
 * <p>Privacy: the camera picture stays on the phone. WebView hands the frames only to the page,
 * which shows them on the screen; nothing here (or in the web app) records, stores or uploads
 * them, and the page's Content-Security-Policy allows no upload destination but the payment
 * server.
 *
 * <p>All methods run on the main thread.
 */
final class WebPermissions {

    static final int PERMISSION_REQUEST = 42;

    private final WebViewActivity shell;

    /** A camera request waiting for the answer to Android's CAMERA permission dialog. */
    private PermissionRequest waiting;

    WebPermissions(WebViewActivity shell) {
        this.shell = shell;
    }

    /** From WebChromeClient.onPermissionRequest. */
    void onRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (!shell.isOnAppPage()
                || !ShellPolicy.allowsCamera(origin == null ? null : origin.toString(), request.getResources())) {
            deny(request);
            return;
        }
        if (shell.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            grant(request);
            return;
        }
        boolean asking = waiting != null;
        if (asking) {
            deny(waiting);                         // replaced by this newer request
        }
        waiting = request;
        if (!asking) {
            shell.requestPermissions(new String[] {Manifest.permission.CAMERA}, PERMISSION_REQUEST);
        }
    }

    /** From WebChromeClient.onPermissionRequestCanceled: the page no longer wants it. */
    void onCanceled(PermissionRequest request) {
        if (request == waiting) {
            waiting = null;                        // the dialog's answer will be ignored
        }
    }

    /** From Activity.onRequestPermissionsResult. */
    void onPermissionResult(boolean granted) {
        PermissionRequest request = waiting;
        waiting = null;
        if (request == null) {
            return;
        }
        if (granted && shell.isOnAppPage()) {
            grant(request);
        } else {
            deny(request);
        }
    }

    /** The app is closing: a request still waiting for the dialog is refused. */
    void cancel() {
        PermissionRequest request = waiting;
        waiting = null;
        if (request != null) {
            deny(request);
        }
    }

    private static void grant(PermissionRequest request) {
        try {
            request.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } catch (RuntimeException e) {
            deny(request);                         // already answered or its page is gone
        }
    }

    private static void deny(PermissionRequest request) {
        try {
            request.deny();
        } catch (RuntimeException ignored) {
            // already answered or its page is gone
        }
    }
}
