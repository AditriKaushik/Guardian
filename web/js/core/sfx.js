/* नन्हा स्कूल — sound effects: tiny, soft sounds synthesised with WebAudio. No audio files, no
   network, nothing stored. Designed to be quiet enough that nobody needs to mute the app in a
   waiting room: short wooden "tok"s, a bell-like chime, a gentle two-note "hmm", a soft sparkle.
   At night (daypart "night") everything is quieter, lower and rounder (lullaby-safe).

   NS.sfx.play(name)   name: tap | pop | correct | tryagain | sparkle | whoosh | flip | open | close
                       → true when a sound (or a haptic tick) was started, false when sound effects
                       are off, the 🔊 mute is on, or the name is unknown. Never throws.
   NS.sfx.enabled()    false when the child's 🔊 mute is on or a grown-up turned "आवाज़ें" off
   NS.sfx.volume(v?)   master volume 0…1 for this session (default 0.6); returns the value
   NS.sfx.haptic(kind) "tap" | "success" | "soft" — the Android shell's vibration only (same rules)
   NS.sfx.names        the sound names above

   The core plays "tap" for every button press (a tile plays "pop"; an element may choose its
   own with data-sfx="<name>" or none with data-sfx="none"), "sparkle" with every sticker and
   "whoosh" when an activity opens. Modules add meaning: "correct" / "tryagain" for answers,
   "flip" for cards, "open" / "close" for their own panels.
   In the Android shell each sound is paired with NanhaNative.vibrate("tap"|"success"|"soft"). */
(function () {
  "use strict";
  const NS = window.NS;
  const AC = window.AudioContext || window.webkitAudioContext || null;
  const NAMES = ["tap", "pop", "correct", "tryagain", "sparkle", "whoosh", "flip", "open", "close"];
  const HAPTIC = { tap: "tap", pop: "tap", correct: "success", sparkle: "success", tryagain: "soft", flip: "soft", open: "soft", close: "soft", whoosh: null };
  const MIN_GAP = { tap: 45, pop: 60, flip: 70, whoosh: 220 };   // ms between two of the same sound
  let ctx = null, master = null, tone = null, noiseBuf = null;
  let vol = 0.6;
  const last = {};

  function settings() {
    try { return NS.store ? NS.store.settings() : { sound: true, sfx: true }; } catch (e) { return { sound: true, sfx: true }; }
  }
  function enabled() { const s = settings(); return s.sound !== false && s.sfx !== false; }
  const night = () => { try { return NS.daypart() === "night"; } catch (e) { return false; } };

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { try { ctx = new AC(); } catch (x) { ctx = null; return null; } }
      tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.Q.value = 0.4;
      master = ctx.createGain();
      tone.connect(master);
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") { try { ctx.resume().catch(() => {}); } catch (e) {} }
    const n = night();
    master.gain.setValueAtTime(vol * (n ? 0.4 : 1), ctx.currentTime);
    tone.frequency.setValueAtTime(n ? 1900 : 7500, ctx.currentTime);
    return ctx;
  }
  /* Browsers only let sound start after a tap: wake the audio on the first touch. */
  const unlock = () => { if (enabled()) ensure(); };
  ["pointerdown", "keydown"].forEach(t => window.addEventListener(t, unlock, { capture: true, passive: true, once: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) {}
  });

  /* One soft note: an oscillator with a quick attack and a smooth exponential decay. */
  function note(t, freq, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);
    const peak = Math.max(0.0002, o.gain || 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(tone);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
  /* Bell: a note plus a quiet octave and a quieter fifth above it. */
  function bell(t, f, dur, gain) {
    note(t, f, dur, { gain });
    note(t, f * 2, dur * 0.6, { gain: gain * 0.22 });
    note(t, f * 3, dur * 0.35, { gain: gain * 0.08 });
  }
  function noise(t, dur, o) {
    o = o || {};
    if (!noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.6);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain || 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(tone);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  const vary = (x, amt) => x * (1 + (Math.random() * 2 - 1) * amt);   // no two taps sound identical
  const SOUNDS = {
    tap(t) {                     // a small wooden "tok"
      note(t, vary(620, 0.05), 0.075, { type: "triangle", to: 380, glide: 0.06, gain: 0.12 });
      noise(t, 0.025, { f0: 2400, q: 1.5, gain: 0.018, attack: 0.002 });
    },
    pop(t) {                     // a soft bubble
      note(t, vary(320, 0.06), 0.11, { to: 900, glide: 0.07, gain: 0.15, attack: 0.004 });
    },
    correct(t, n) {              // bell chime up a major triad (an octave lower at night)
      const base = n ? 523.25 : 1046.5;
      bell(t, base, 0.55, 0.11);
      bell(t + 0.085, base * 1.26, 0.55, 0.1);
      bell(t + 0.17, base * 1.5, 0.75, 0.1);
    },
    tryagain(t) {                // gentle "hm-mm", two soft low notes, never a buzzer
      note(t, 392, 0.2, { gain: 0.09, attack: 0.02 });
      note(t + 0.17, 349.2, 0.32, { to: 330, glide: 0.3, gain: 0.08, attack: 0.03 });
    },
    sparkle(t, n) {              // a quick run of high pentatonic notes with a little shimmer
      const run = n ? [784, 880, 1047, 1175, 1319] : [1568, 1760, 2093, 2349, 2637, 3136];
      run.forEach((f, i) => note(t + i * 0.045, f, 0.32, { gain: 0.05, detune: i % 2 ? 7 : -7 }));
      noise(t, 0.45, { type: "highpass", f0: 6500, gain: n ? 0.004 : 0.012, attack: 0.05 });
    },
    whoosh(t) {                  // air moving past: band-passed noise sweeping up
      noise(t, 0.3, { f0: 380, f1: 1700, q: 0.8, gain: 0.035, attack: 0.09 });
    },
    flip(t) {                    // a page flick
      noise(t, 0.07, { f0: 2600, q: 1.2, gain: 0.05, attack: 0.004 });
      note(t + 0.01, 700, 0.06, { to: 480, gain: 0.03 });
    },
    open(t) {                    // two notes rising
      note(t, 523.25, 0.18, { gain: 0.07 });
      note(t + 0.08, 783.99, 0.24, { gain: 0.07 });
    },
    close(t) {                   // two notes falling
      note(t, 783.99, 0.18, { gain: 0.06 });
      note(t + 0.08, 523.25, 0.24, { gain: 0.06 });
    },
  };

  function haptic(kind) {
    if (!enabled() || !NS.native || !NS.native.available) return false;
    if (!["tap", "success", "soft"].includes(kind)) return false;
    return NS.native.call("vibrate", kind) === true;
  }

  function play(name) {
    if (!SOUNDS[name] || !enabled()) return false;
    const now = Date.now();
    if (last[name] && now - last[name] < (MIN_GAP[name] || 90)) return false;
    last[name] = now;
    let played = false;
    try {
      const c = ensure();
      if (c && c.state !== "closed") { SOUNDS[name](c.currentTime + 0.005, night()); played = true; }
    } catch (e) { /* a sound effect never breaks the app */ }
    const h = HAPTIC[name];
    if (h && haptic(h)) played = true;
    return played;
  }

  NS.sfx = {
    play, enabled, haptic,
    volume(v) { if (typeof v === "number" && v >= 0 && v <= 1) vol = v; return vol; },
    names: NAMES.slice(),
  };
})();
