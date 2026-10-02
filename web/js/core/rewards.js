/* नन्हा स्कूल — stickers and gentle celebrations. No streaks, nothing is ever taken away.

   NS.rewards.grant({sticker, reason}, activityId)  saves a sticker for the current profile and
                                                    shows a short sparkle + "शाबाश!" (ctx.reward)
   NS.rewards.list()                                [{s, r, a, t}] of the current profile
   NS.rewards.celebrate(emoji, text?)               the sparkle alone (no sticker saved) */
(function () {
  "use strict";
  const NS = window.NS;
  const MAX = 600;

  function list() {
    const core = NS.store.core();
    return core ? core.get("stickers", []) : [];
  }

  let layer = null, hideTimer = null;
  function celebrate(emoji, text, spoken) {
    if (layer) layer.remove();
    clearTimeout(hideTimer);
    layer = NS.el("div", "celebrate");
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-live", "polite");
    const burst = NS.el("div", "burst");
    const colors = ["#FFD54F", "#FF8A65", "#4FC3F7", "#81C784", "#BA68C8", "#F06292"];
    for (let i = 0; i < 18; i++) {
      const s = NS.el("i", "spark" + (i % 3 === 0 ? " star" : ""));
      const ang = (i / 18) * Math.PI * 2;
      const dist = 90 + (i % 4) * 28;
      s.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
      s.style.setProperty("--dy", Math.round(Math.sin(ang) * dist) + "px");
      s.style.setProperty("--c", colors[i % colors.length]);
      s.style.setProperty("--d", (i % 5) * 40 + "ms");
      burst.appendChild(s);
    }
    const st = NS.el("div", "sticker-pop", emoji);
    st.setAttribute("aria-hidden", "true");
    const label = NS.el("div", "celebrate-text", text || NS.tr("shabash"));
    const card = NS.el("div", "celebrate-card");
    card.append(burst, st, label);
    layer.appendChild(card);
    const close = () => { if (layer) { layer.classList.add("out"); const l = layer; layer = null; setTimeout(() => l.remove(), 300); } };
    layer.addEventListener("click", close);
    document.body.appendChild(layer);
    hideTimer = setTimeout(close, 2600);
    if (spoken !== false) NS.voice.sayAfter(spoken || (text || NS.tr("shabash")));
  }

  function grant(r, activityId) {
    r = r || {};
    const sticker = NS.stripEmoji(r.sticker || "") === "" && r.sticker ? String(r.sticker).slice(0, 16) : "⭐";
    const core = NS.store.core();
    if (core) {
      const all = core.get("stickers", []);
      const reason = typeof r.reason === "object" && r.reason ? NS.t(r.reason, "hi") : r.reason;   // string or {hi, en}
      all.push({ s: sticker, r: String(reason || "").slice(0, 80), a: activityId || "", t: NS.now() });
      while (all.length > MAX) all.shift();
      core.set("stickers", all);
    }
    celebrate(sticker, NS.tr("shabash") + " " + NS.tr("newSticker"), NS.tr("shabash") + " " + NS.tr("newSticker"));
    NS.emit("reward:granted", { sticker, reason: r.reason || "", activity: activityId || "" });
  }

  NS.rewards = { grant, list, celebrate };
})();
