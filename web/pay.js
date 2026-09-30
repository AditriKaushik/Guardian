// नन्हा स्कूल — checkout page for the Android app.
//
// The app opens  pay.html#s=<subscription_id>&k=<razorpay_key_id>  in the phone's browser.
// The values ride in the #hash, which browsers never send to a server. This page reads them,
// wipes them from the address bar, and opens Razorpay's checkout for that subscription.
// It never calls our backend and stores nothing; the Android app confirms the payment itself.
(function () {
  "use strict";

  const SUB_RE = /^sub_[A-Za-z0-9]{6,40}$/;
  const KEY_RE = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;
  const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";
  const APP_LINK = "intent://open#Intent;scheme=nanhaschool;package=org.guardian.buddy;end";

  // Read the hash once, then remove it from the address bar and from this history entry.
  const params = new URLSearchParams(location.hash.slice(1));
  const subscriptionId = params.get("s") || "";
  const keyId = params.get("k") || "";
  if (location.hash || location.href.endsWith("#")) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  // Text only: nothing on this page is ever parsed as HTML.
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text, cls) { const a = el("a", cls, text); a.href = href; return a; }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("network"));
      document.head.appendChild(s);
    });
  }

  const box = document.getElementById("pay");
  const heading = el("h1", "ptitle", "नन्हा स्कूल प्रीमियम");
  box.replaceChildren(heading);

  if (!SUB_RE.test(subscriptionId) || !KEY_RE.test(keyId)) {
    box.append(el("p", "plead", "यह लिंक सही नहीं है। नन्हा स्कूल ऐप से फिर से कोशिश करें।"));
    return;
  }

  const pay = el("button", "pbtn big", "भुगतान करें");
  pay.type = "button";
  pay.id = "payBtn";
  const msg = el("p", "pmsg", "");
  const legal = el("p", "psmall plegal");
  legal.append(link("legal/privacy.html", "गोपनीयता नीति"), " · ", link("legal/terms.html", "नियम और शर्तें"));
  box.append(
    el("p", "plead", "सब्सक्रिप्शन शुरू करने के लिए नीचे बटन दबाएँ।"),
    pay, msg,
    el("p", "psmall", "भुगतान Razorpay के सुरक्षित पेज पर होता है: UPI, कार्ड या नेटबैंकिंग। फ़ोन नंबर, ईमेल और कार्ड जैसी जानकारी सिर्फ़ Razorpay के पास जाती है — नन्हा स्कूल तक कभी नहीं आती।"),
    legal);

  function paid() {
    box.replaceChildren(
      heading,
      el("p", "plead", "✅ भुगतान हो गया! अब नन्हा स्कूल ऐप पर वापस जाएँ — वहाँ प्रीमियम अपने-आप खुल जाएगा।"),
      link(APP_LINK, "ऐप पर वापस जाएँ", "applink"));
  }
  function notPaid() {
    pay.disabled = false;
    msg.textContent = "भुगतान पूरा नहीं हुआ। फिर से कोशिश करें।";
  }

  pay.addEventListener("click", async () => {
    pay.disabled = true;
    msg.textContent = "एक पल…";
    try {
      if (!window.Razorpay) await loadScript(CHECKOUT_JS);
    } catch (e) {
      pay.disabled = false;
      msg.textContent = "इंटरनेट से जुड़ें और फिर कोशिश करें।";
      return;
    }
    msg.textContent = "";
    try {
      // No prefill: the parent's contact details are typed on Razorpay's page and go only to Razorpay.
      const checkout = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "नन्हा स्कूल",
        description: "प्रीमियम सब्सक्रिप्शन",
        theme: { color: "#FF8A3D" },
        handler: paid,
        modal: { ondismiss: notPaid },
      });
      checkout.open();
    } catch (e) {
      pay.disabled = false;
      msg.textContent = "कुछ गड़बड़ हुई। फिर से कोशिश करें।";
    }
  });
})();
