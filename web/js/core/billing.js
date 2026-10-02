/* नन्हा स्कूल — subscription: 7-day free trial, then premium (moved from app.js, unchanged rules).

   Payments stay off (everything free) until config.js has API_BASE and PUBLIC_KEY_JWK.
   The trial needs no signup or card. After it, a few activities stay free forever and the rest
   wait behind a grown-ups' question, so a child never sees a payment screen.
   Nothing personal is ever sent to the server: no email, no phone, no name.

   NS.billing: PAYMENTS_ON, hasAccess(), subscribed(), trialDaysLeft(), isFree(def),
               isLocked(def), rhymeLocked(i), refresh() → Promise<changed>, statusBanner(),
               gate(next), askGrownUp(), paywall(), account(), restoreView(), confirmPending() */
(function () {
  "use strict";
  const NS = window.NS;
  const CFG = NS.config;
  const el = NS.el;
  const store = NS.store.raw;
  const PAYMENTS_ON = !!(CFG.API_BASE && CFG.PUBLIC_KEY_JWK && window.crypto && window.crypto.subtle);
  const DAY = 86400000;
  /* Grown-ups' screens: Hindi, or English when the child's language is English. */
  const T = o => NS.t(o, NS.lang() === "en" ? "en" : "hi");

  /* Older versions kept the parent's email here to prefill forms. Nothing personal is stored now. */
  store.del("ns_email");
  let subscribed = false;

  /* The trial clock never runs backwards, so moving the phone's date back doesn't extend it. */
  function nowMs() {
    const seen = Number(store.get("ns_seen")) || 0;
    const t = Math.max(Date.now(), seen);
    store.set("ns_seen", String(t));
    return t;
  }
  function trialDaysLeft() {
    let start = Number(store.get("ns_trial"));
    if (!start) { start = nowMs(); store.set("ns_trial", String(start)); }
    return Math.max(0, Math.ceil((start + CFG.TRIAL_DAYS * DAY - nowMs()) / DAY));
  }
  function hasAccess() { return !PAYMENTS_ON || subscribed || trialDaysLeft() > 0; }
  function isFree(def) {
    if (!def) return false;
    if (def.free === true) return true;
    const free = Array.isArray(CFG.FREE) ? CFG.FREE : [];
    return free.includes(def.id) || free.includes(NS.t(def.title, "hi"));
  }
  function isLocked(def) { return !isFree(def) && !hasAccess(); }
  function rhymeLocked(i) { return i >= CFG.FREE_RHYMES && !hasAccess(); }

  /* A pass is "payload.signature", signed by the server; checked here with the public key. */
  function fromB64url(s) {
    let t = s.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    const bin = atob(t);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function readPass(token) {
    try {
      const [payload, sig] = String(token).split(".");
      if (!payload || !sig) return null;
      const key = await crypto.subtle.importKey("jwk", CFG.PUBLIC_KEY_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromB64url(sig), new TextEncoder().encode(payload));
      return ok ? JSON.parse(new TextDecoder().decode(fromB64url(payload))) : null;
    } catch (e) { return null; }
  }
  /* Saves a pass from the server if it checks out. Returns the pass while it is valid, else null. */
  async function savePass(token) {
    const pass = await readPass(token);
    if (!pass) return null;
    store.set("ns_pass", token);
    subscribed = pass.exp > nowMs() / 1000;
    return subscribed ? pass : null;
  }
  /* Re-checks the stored pass and quietly renews it near the end of the paid period.
     Returns true when what the child can open has changed. */
  async function refreshEntitlement() {
    if (!PAYMENTS_ON) return false;
    const before = hasAccess() + "|" + subscribed;
    const token = store.get("ns_pass");
    const pass = token ? await readPass(token) : null;
    if (token && !pass) store.del("ns_pass");
    const t = nowMs() / 1000;
    subscribed = !!(pass && pass.exp > t);
    if (pass && pass.exp - t < 3 * 86400) {
      try { const r = await api("/api/refresh", { token }); await savePass(r.token); } catch (e) {}
    }
    return before !== hasAccess() + "|" + subscribed;
  }

  /* Every request to the server. Nothing personal is ever sent: no email, no phone, no name. */
  async function api(path, data) {
    let res;
    try {
      res = await fetch(CFG.API_BASE.replace(/\/+$/, "") + path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        credentials: "omit", cache: "no-store",
      });
    } catch (e) { throw { code: "network" }; }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: out.error || "server_error" };
    return out;
  }
  function errorText(e) {
    return T(({
      network: { hi: "इंटरनेट से जुड़ें और फिर कोशिश करें।", en: "Please connect to the internet and try again." },
      not_active: { hi: "यह सब्सक्रिप्शन अभी चालू नहीं है।", en: "This subscription is not active yet." },
      bad_signature: { hi: "भुगतान की जाँच नहीं हो पाई।", en: "The payment could not be verified." },
      too_many_requests: { hi: "बहुत बार कोशिश हुई। एक मिनट बाद फिर कोशिश करें।", en: "Too many tries. Please wait a minute and try again." },
      plan_unavailable: { hi: "सालाना प्लान अभी उपलब्ध नहीं है। कृपया महीने का प्लान चुनें।", en: "The yearly plan isn't available yet. Please choose the monthly plan." },
      no_pay_page: { hi: "भुगतान पेज का पता सेट नहीं है (config.js में PAY_PAGE_URL)।", en: "The payment page address is not set (PAY_PAGE_URL in config.js)." },
    })[e && e.code] || { hi: "कुछ गड़बड़ हुई। थोड़ी देर बाद फिर कोशिश करें।", en: "Something went wrong. Please try again in a little while." });
  }
  const BAD_CODE = { hi: "यह कोड सही नहीं है। कोड दोबारा जाँचें — जैसा भुगतान के बाद दिखा था, ठीक वैसा ही लिखें।",
    en: "This code is not right. Please check it — type it exactly as it was shown after payment." };
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject({ code: "network" });
      document.head.appendChild(s);
    });
  }

  /* Small builders for the grown-ups' screens (text only). */
  const button = (label, cls, onClick) => { const b = el("button", cls, label); b.type = "button"; b.onclick = onClick; return b; };
  function link(href, text) { const a = el("a", null, text); a.href = href; return a; }
  function field(id, placeholder) {
    const i = document.createElement("input");
    i.className = "pin"; i.id = id; i.type = "text"; i.placeholder = placeholder;
    i.autocomplete = "off"; i.spellcheck = false;
    i.setAttribute("aria-label", placeholder);
    return i;
  }
  const ui = () => NS.ui;
  function legalLinks() {
    const p = el("p", "psmall plegal");
    p.append(link("legal/privacy.html", "गोपनीयता नीति"), " · ", link("legal/terms.html", "नियम और शर्तें"),
      " · ", link("legal/refund.html", "रद्द करना और रिफ़ंड"));
    return p;
  }
  /* The restore code is random and says nothing about the family; it is all that is needed to
     bring premium back on another phone, so it is shown big with a copy button. */
  function restoreCodeBlock(code) {
    const out = el("p", "mono code", code); out.id = "restoreCodeOut";
    const copyLabel = T({ hi: "कोड कॉपी करें", en: "Copy code" });
    const copy = button(copyLabel, "pbtn secondary", async () => {
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = T({ hi: "✓ कोड कॉपी हो गया", en: "✓ Code copied" });
      } catch (e) {
        const range = document.createRange(); range.selectNodeContents(out);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        copy.textContent = T({ hi: "कोड चुन लिया है — अब कॉपी करें", en: "Code selected — copy it now" });
      }
      setTimeout(() => { copy.textContent = copyLabel; }, 2500);
    });
    copy.id = "copyCode";
    return [el("p", "psmall", T({ hi: "यह आपका रिस्टोर कोड है। इसे सँभालकर रखें — नए फ़ोन पर प्रीमियम वापस पाने के लिए यही चाहिए। इसमें आपकी कोई निजी जानकारी नहीं है।",
      en: "This is your restore code. Keep it safe — it brings premium back on a new phone. It holds no personal information. (इसमें आपकी कोई निजी जानकारी नहीं है।)" })), out, copy];
  }

  function statusBanner() {
    if (!PAYMENTS_ON) return null;
    let label = T({ hi: "⭐ प्रीमियम चालू है", en: "⭐ Premium is on" });
    if (!subscribed) {
      const left = trialDaysLeft();
      label = left > 0
        ? T({ hi: `🎁 मुफ़्त ट्रायल: ${left} दिन बाकी · बड़ों के लिए`, en: `🎁 Free trial: ${left} days left · for grown-ups` })
        : T({ hi: "🔒 कुछ पाठ बंद हैं · बड़ों के लिए: पूरा ऐप खोलें", en: "🔒 Some lessons are locked · grown-ups: open the full app" });
    }
    return button(label, "banner", () => gate(paywall));
  }

  function askGrownUp() {
    gate(paywall);
    NS.voice.say(NS.tr("askGrownUp"));
  }

  /* A question small children can't answer yet, so payments and settings are only ever seen by
     grown-ups. */
  function gate(next) {
    ui().setTop("👨‍👩‍👧 " + T({ hi: "बड़ों के लिए", en: "For grown-ups" }), true);
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    const box = ui().panel(T({ hi: "यह हिस्सा माता-पिता के लिए है", en: "This part is for parents" }));
    box.classList.add("gate");
    const answer = field("gateAnswer", T({ hi: "जवाब", en: "Answer" }));
    answer.inputMode = "numeric";
    const msg = el("p", "pmsg", "");
    msg.setAttribute("role", "alert");
    const check = () => {
      const given = Number(answer.value.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)).trim());
      if (given === a * b) { next(); return; }
      msg.textContent = T({ hi: "जवाब सही नहीं है। नया सवाल…", en: "That's not right. A new question…" });
      setTimeout(() => gate(next), 900);
    };
    answer.addEventListener("keydown", e => { if (e.key === "Enter") check(); });
    box.append(el("p", "plead", T({ hi: "आगे जाने के लिए इस सवाल का जवाब लिखें:", en: "To continue, type the answer:" })),
      el("p", "pq", `${a} × ${b} = ?`), answer, button(T({ hi: "आगे", en: "Continue · आगे" }), "pbtn", check), msg);
    setTimeout(() => { try { answer.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }

  /* ---------------- Paywall: calm, two clear choices, one button ---------------- */
  function plans() {
    const P = CFG.PLANS && typeof CFG.PLANS === "object" ? CFG.PLANS : {};
    const out = [{ id: "monthly", price: (P.monthly && P.monthly.price) || CFG.PRICE_TEXT || "", note: (P.monthly && P.monthly.note) || "" }];
    if (P.yearly && P.yearly.price) out.push({ id: "yearly", price: P.yearly.price, note: P.yearly.note || "" });
    return out;
  }
  function paywall() {
    if (subscribed) { account(); return; }
    ui().setTop("⭐ " + T({ hi: "प्रीमियम", en: "Premium" }), true);
    const left = trialDaysLeft();
    const box = ui().panel(T({ hi: "पूरा नन्हा स्कूल खोलें", en: "Open all of Nanha School" }));
    box.classList.add("paywall");
    box.appendChild(NS.mascot ? NS.mascot("happy", "mascot-sm") : el("span"));
    const list = el("ul", "plist");
    [{ hi: "सारे पाठ, कविताएँ, खेल, कहानियाँ और बातचीत", en: "All lessons, rhymes, games, stories and chat" },
      { hi: "अच्छी आदतें और सोने की तैयारी", en: "Good habits and bedtime" }]
      .forEach(t => list.appendChild(el("li", null, "✓ " + T(t))));
    box.appendChild(list);

    const trust = el("ul", "trust");
    trust.setAttribute("aria-label", T({ hi: "भरोसा", en: "Our promise" }));
    [["🚫", { hi: "कोई विज्ञापन नहीं", en: "No ads" }], ["📱", { hi: "बच्चे का डेटा फ़ोन से बाहर नहीं जाता", en: "Your child's data never leaves the phone" }],
      ["↩️", { hi: "कभी भी रद्द करें", en: "Cancel any time" }], ["🎁", { hi: `${CFG.TRIAL_DAYS} दिन मुफ़्त`, en: `${CFG.TRIAL_DAYS} days free` }]]
      .forEach(([i, t]) => { const li = el("li", null); li.append(el("span", "ti", i), el("span", null, T(t))); trust.appendChild(li); });
    box.appendChild(trust);

    const opts = plans();
    let chosen = opts[0].id;
    const priceEl = el("p", "price", opts[0].price);
    if (opts.length > 1) {
      const group = el("div", "plans");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", T({ hi: "प्लान चुनें", en: "Choose a plan" }));
      const cards = opts.map(o => {
        const c = button("", "plan", () => select(o.id));
        c.setAttribute("role", "radio");
        c.dataset.plan = o.id;
        c.append(el("span", "plan-name", o.id === "yearly" ? T({ hi: "सालाना", en: "Yearly" }) : T({ hi: "महीने का", en: "Monthly" })),
          el("span", "plan-price", o.price));
        if (o.note) c.append(el("span", "plan-note", o.note));
        group.appendChild(c);
        return c;
      });
      const select = id => {
        chosen = id;
        cards.forEach(c => { const on = c.dataset.plan === id; c.classList.toggle("on", on); c.setAttribute("aria-checked", String(on)); });
        priceEl.textContent = opts.find(o => o.id === id).price;
      };
      select(chosen);
      box.appendChild(group);
      priceEl.classList.add("vh");
    }
    if (opts[0].price || opts.length > 1) box.appendChild(priceEl);
    const trialNote = el("p", "psmall", left > 0
      ? T({ hi: `आपके मुफ़्त ट्रायल के ${left} दिन बाकी हैं। अभी सब्सक्राइब करें — पहला भुगतान ट्रायल ख़त्म होने के बाद ही होगा। (कार्ड या UPI की पुष्टि के लिए बैंक एक छोटी राशि ले सकता है, जो अपने-आप वापस हो जाती है।)`,
        en: `${left} days of your free trial are left. Subscribe now — the first payment happens only after the trial ends. (Your bank may take a small amount to confirm the card or UPI; it is refunded automatically.) (${left} दिन बाकी)` })
      : T({ hi: "मुफ़्त ट्रायल पूरा हो गया। सब्सक्राइब करके सारे पाठ फिर से खोलें।", en: "The free trial is over. Subscribe to open every lesson again." }));
    trialNote.id = "trialNote";
    const msg = el("p", "pmsg", "");
    msg.setAttribute("role", "status");
    const pay = button(T({ hi: "सब्सक्राइब करें", en: "Subscribe · सब्सक्राइब करें" }), "pbtn primary", () => startCheckout(msg, pay, chosen));
    box.append(trialNote, pay, msg,
      el("p", "psmall", T({ hi: "भुगतान Razorpay के सुरक्षित पेज पर होता है: UPI, कार्ड या नेटबैंकिंग। फ़ोन नंबर, ईमेल और कार्ड जैसी जानकारी आप सिर्फ़ उसी पेज पर भरते हैं — वह इस ऐप या हमारे सर्वर तक कभी नहीं आती।",
        en: "Payment happens on Razorpay's secure page: UPI, card or netbanking. Your phone number, email and card details are typed only on that page — they never reach this app or our server. (सिर्फ़ उसी पेज पर · कभी नहीं आती)" })),
      legalLinks(),
      button(T({ hi: "पहले से सब्सक्राइब किया है? यहाँ वापस पाएँ", en: "Already subscribed? Restore it here" }), "plink", restoreView));
  }

  function payPageUrl() {
    if (CFG.PAY_PAGE_URL && /^https:\/\//.test(CFG.PAY_PAGE_URL)) return CFG.PAY_PAGE_URL;
    if (location.protocol === "https:" && location.hostname !== "appassets.androidplatform.net") return new URL("pay.html", location.href).href;
    return "";
  }

  async function startCheckout(msg, pay, plan) {
    msg.className = "pmsg";
    pay.disabled = true;
    msg.textContent = T({ hi: "एक पल…", en: "One moment…" });
    const body = { trial_days_left: trialDaysLeft() };
    if (plans().length > 1) body.plan = plan === "yearly" ? "yearly" : "monthly";
    if (NS.native.available) return startNativeCheckout(msg, pay, body);
    try {
      const { subscription_id, key_id, restore_code } = await api("/api/subscribe", body);
      if (!window.Razorpay) await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      msg.textContent = "";
      // No prefill: the parent types contact details on Razorpay's own page, so they never pass through this app.
      const checkout = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: "नन्हा स्कूल",
        description: "प्रीमियम सब्सक्रिप्शन",
        theme: { color: "#FF8A3D" },
        handler: async resp => {
          msg.textContent = T({ hi: "भुगतान की जाँच हो रही है…", en: "Checking the payment…" });
          try {
            const r = await api("/api/verify", {
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_subscription_id: resp.razorpay_subscription_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (!(await savePass(r.token))) throw { code: "not_active" };
            store.set("ns_sub", subscription_id);
            if (restore_code) store.set("ns_restore", restore_code);
            thanks(restore_code, subscription_id);
          } catch (e) {
            // Paid, but not confirmed yet: keep the code on this phone so it can't be lost.
            if (restore_code) store.set("ns_restore", restore_code);
            checkPending(restore_code);
          }
        },
        modal: { ondismiss: () => { pay.disabled = false; msg.textContent = T({ hi: "भुगतान पूरा नहीं हुआ। आप फिर से कोशिश कर सकते हैं।", en: "The payment was not completed. You can try again." }); } },
      });
      checkout.open();
    } catch (e) {
      pay.disabled = false;
      msg.textContent = errorText(e);
    }
  }

  /* Android shell: the checkout opens in the phone's browser (pay.html), and the app confirms with
     /api/restore when it comes back to the foreground or the parent taps "मैंने भुगतान कर दिया". */
  const SUB_RE = /^sub_[A-Za-z0-9]{6,40}$/, KEY_RE = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;
  async function startNativeCheckout(msg, pay, body) {
    try {
      const page = payPageUrl();
      if (!page) throw { code: "no_pay_page" };
      const { subscription_id, key_id, restore_code } = await api("/api/subscribe", body);
      if (!SUB_RE.test(subscription_id) || !KEY_RE.test(key_id)) throw { code: "server_error" };
      store.set("ns_pending", JSON.stringify({ code: restore_code || "", sid: subscription_id, t: Date.now() }));
      const opened = NS.native.call("openExternal", page + "#s=" + encodeURIComponent(subscription_id) + "&k=" + encodeURIComponent(key_id));
      if (opened === false || opened === "false") throw { code: "no_pay_page" };
      waitingForPayment();
    } catch (e) {
      pay.disabled = false;
      msg.textContent = errorText(e);
    }
  }
  function pending() { try { return JSON.parse(store.get("ns_pending") || "null"); } catch (e) { return null; } }
  function waitingForPayment(note) {
    ui().setTop("⭐ " + T({ hi: "प्रीमियम", en: "Premium" }), true);
    const box = ui().panel(T({ hi: "भुगतान ब्राउज़र में खुल गया है", en: "Payment opened in your browser" }));
    const msg = el("p", "pmsg", note || "");
    msg.setAttribute("role", "status");
    const done = button(T({ hi: "मैंने भुगतान कर दिया", en: "I have paid" }), "pbtn primary", async () => {
      done.disabled = true;
      msg.className = "pmsg"; msg.textContent = T({ hi: "जाँच हो रही है…", en: "Checking…" });
      const ok = await confirmPending();
      if (!ok) { done.disabled = false; msg.textContent = T({ hi: "अभी पुष्टि नहीं हुई। भुगतान पूरा होने के एक-दो मिनट बाद फिर दबाएँ।", en: "Not confirmed yet. Please tap again a minute or two after paying." }); }
    });
    box.append(el("p", "plead", T({ hi: "भुगतान पूरा करके इस ऐप पर लौटें — प्रीमियम अपने-आप खुल जाएगा।", en: "Finish paying and come back to this app — premium opens by itself." })),
      done, msg, button(T({ hi: "ऐप पर चलें", en: "Back to the app" }), "pbtn secondary", () => NS.home()));
    const p = pending();
    if (p && p.code) box.append(...restoreCodeBlock(p.code));
  }
  /* Confirms a payment started in the browser. Returns true when premium is on. */
  async function confirmPending(quiet) {
    const p = pending();
    if (!PAYMENTS_ON || !p || !p.code) return false;
    try {
      const r = await api("/api/restore", { restore_code: p.code });
      const pass = await savePass(r.token);
      if (!pass) return false;
      store.set("ns_restore", p.code);
      store.set("ns_sub", pass.sid || p.sid);
      store.del("ns_pending");
      if (!quiet || (NS.ui && NS.ui.state() !== "activity")) thanks(p.code, pass.sid || p.sid);
      return true;
    } catch (e) { return false; }
  }
  NS.on("native:resume", () => {
    if (pending()) confirmPending(true);
    refreshEntitlement().then(changed => { if (changed && NS.ui && NS.ui.state() === "home") NS.home(); });
  });

  function checkPending(code) {
    ui().setTop("⭐ " + T({ hi: "प्रीमियम", en: "Premium" }), true);
    const box = ui().panel(T({ hi: "भुगतान हो गया, जाँच बाकी है", en: "Paid — check still pending" }));
    box.append(el("p", "plead", T({ hi: "भुगतान की जाँच अभी पूरी नहीं हुई। थोड़ी देर बाद “वापस पाएँ” में यह कोड डालें।", en: "The payment check is not finished yet. In a little while, enter this code under “Restore”." })));
    if (code) box.append(...restoreCodeBlock(code));
    box.append(button("वापस पाएँ", "pbtn", restoreView), button(T({ hi: "ऐप पर चलें", en: "Back to the app" }), "pbtn secondary", () => NS.home()));
  }

  function thanks(code, subId) {
    ui().setTop("🎉 " + T({ hi: "धन्यवाद!", en: "Thank you!" }), true);
    const box = ui().panel(T({ hi: "प्रीमियम चालू हो गया! 🎉", en: "Premium is on! 🎉" }));
    box.append(el("p", "plead", T({ hi: "अब बच्चा सारे पाठ, कविताएँ, खेल और बातचीत इस्तेमाल कर सकता है।", en: "Your child can now use every lesson, rhyme, game and chat." })));
    if (code) box.append(...restoreCodeBlock(code));
    if (subId) box.append(el("p", "psmall", T({ hi: "सब्सक्रिप्शन ID: ", en: "Subscription ID: " }) + subId));
    box.append(button("ऐप पर चलें", "pbtn", () => NS.home()));
    if (NS.rewards) NS.rewards.celebrate("🎉", T({ hi: "धन्यवाद!", en: "Thank you!" }), false);
  }

  function restoreView() {
    ui().setTop("🔄 " + T({ hi: "वापस पाएँ", en: "Restore" }), true);
    const box = ui().panel(T({ hi: "पहले से सब्सक्राइब किया है?", en: "Subscribed already?" }));
    const code = field("restoreCode", T({ hi: "रिस्टोर कोड", en: "Restore code" }));
    const p = pending();
    code.value = store.get("ns_restore") || (p && p.code) || "";
    code.autocapitalize = "off"; code.setAttribute("autocorrect", "off"); // the code is case-sensitive
    const msg = el("p", "pmsg", "");
    msg.setAttribute("role", "status");
    const go = button("वापस पाएँ", "pbtn", async () => {
      const c = code.value.replace(/\s+/g, "");
      msg.className = "pmsg";
      if (!c) { msg.textContent = T({ hi: "कृपया रिस्टोर कोड लिखें।", en: "Please type the restore code." }); return; }
      go.disabled = true;
      msg.textContent = T({ hi: "जाँच हो रही है…", en: "Checking…" });
      try {
        const r = await api("/api/restore", { restore_code: c });
        const pass = await savePass(r.token);
        if (!pass) throw { code: "not_active" };
        store.set("ns_restore", c);
        if (pass.sid) store.set("ns_sub", pass.sid);
        store.del("ns_pending");
        thanks(c, pass.sid);
      } catch (err) {
        go.disabled = false;
        msg.textContent = err && (err.code === "not_found" || err.code === "bad_request") ? T(BAD_CODE) : errorText(err);
      }
    });
    code.addEventListener("keydown", e => { if (e.key === "Enter") go.click(); });
    const help = el("p", "psmall");
    help.append(T({ hi: "कोड खो गया? ", en: "Lost the code? (कोड खो गया?) " }), link("legal/contact.html", "भुगतान की रसीद वाली जानकारी के साथ हमसे संपर्क करें"));
    box.append(el("p", "psmall", T({ hi: "सब्सक्राइब करने के बाद जो रिस्टोर कोड दिखा था, वही यहाँ लिखें।", en: "Type the restore code that was shown after subscribing." })), code, go, msg, help);
  }

  function account() {
    ui().setTop("⭐ " + T({ hi: "प्रीमियम", en: "Premium" }), true);
    const box = ui().panel(T({ hi: "आपका प्रीमियम चालू है ⭐", en: "Your premium is on ⭐ (चालू)" }));
    box.appendChild(el("p", "plead", T({ hi: "यह अपने-आप नवीनीकृत होता है। रद्द करने पर, जितने दिनों के पैसे दिए हैं उतने दिन ऐप चलता रहेगा।", en: "It renews automatically. If you cancel, the app keeps working for the days already paid for." })));
    const code = store.get("ns_restore");
    if (code) box.append(...restoreCodeBlock(code));
    const sid = store.get("ns_sub");
    if (sid) box.append(el("p", "psmall", T({ hi: "सब्सक्रिप्शन ID: ", en: "Subscription ID: " }) + sid));
    const msg = el("p", "pmsg", "");
    msg.setAttribute("role", "status");
    const confirmRow = el("div", "confirm"); confirmRow.hidden = true;
    const cancelBtn = button(T({ hi: "सब्सक्रिप्शन रद्द करें", en: "Cancel subscription (रद्द करें)" }), "pbtn danger", () => { cancelBtn.hidden = true; confirmRow.hidden = false; });
    const yes = button("हाँ, रद्द करें", "pbtn danger", async () => {
      yes.disabled = true;
      try {
        const r = await api("/api/cancel", { token: store.get("ns_pass") });
        confirmRow.hidden = true;
        msg.className = "pmsg ok";
        msg.textContent = r.ends_at
          ? T({ hi: `रद्द हो गया। ${new Date(r.ends_at * 1000).toLocaleDateString("hi-IN")} तक प्रीमियम चलेगा, उसके बाद पैसे नहीं कटेंगे।`,
            en: `Cancelled (रद्द हो गया). Premium lasts until ${new Date(r.ends_at * 1000).toLocaleDateString("en-IN")}; you won't be charged after that.` })
          : T({ hi: "रद्द हो गया। आगे से पैसे नहीं कटेंगे।", en: "Cancelled (रद्द हो गया). You won't be charged again." });
      } catch (e) { yes.disabled = false; msg.className = "pmsg"; msg.textContent = errorText(e); }
    });
    const no = button(T({ hi: "नहीं", en: "No" }), "pbtn secondary", () => { confirmRow.hidden = true; cancelBtn.hidden = false; });
    confirmRow.append(el("p", "plead", T({ hi: "पक्का रद्द करना है?", en: "Are you sure you want to cancel?" })), yes, no);
    box.append(button("ऐप पर चलें", "pbtn", () => NS.home()), cancelBtn, confirmRow, msg);
  }

  NS.billing = {
    PAYMENTS_ON, hasAccess, trialDaysLeft, isFree, isLocked, rhymeLocked,
    subscribed: () => subscribed, refresh: refreshEntitlement, statusBanner,
    gate, askGrownUp, paywall, account, restoreView, confirmPending, plans,
  };
})();
