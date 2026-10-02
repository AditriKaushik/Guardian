# The NanhaNative bridge: the web app calls these methods by name, so R8 must keep them.
-keepclassmembers class org.guardian.buddy.NanhaBridge {
    @android.webkit.JavascriptInterface public *;
}
