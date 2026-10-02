/* नन्हा स्कूल — on-device storage (localStorage only; nothing here ever leaves the device).

   Keys:
     ns_profiles            {"v":1,"list":[profile…],"current":"<id>"}
                            profile = {id, name, avatar, ageBand: "2-3"|"4-5"|"6+",
                                       voice: "female"|"male", lang: "hi"|"en"|"hinglish", created}
     ns_settings            device settings set by grown-ups: {sessionMin, bedtimeHour, mic,
                            speed: "normal"|"slow", sound, voicePick: {"hi|female": voiceId…}}
     ns_p_<pid>_core        per-profile core data (stickers, minutes used per day, habits)
     ns_p_<pid>_a_<id>      per-profile data of activity <id>  (ctx.data)
     ns_trial, ns_seen, ns_pass, ns_sub, ns_restore, ns_pending   subscription (billing.js,
                            device-wide: the family's subscription, not a child's data)
   Every value is JSON (except the billing keys, kept as plain strings for compatibility). */
(function () {
  "use strict";
  const NS = window.NS;

  const raw = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } },
  };
  const readJSON = (k, fallback) => {
    const s = raw.get(k);
    if (s == null) return fallback;
    try { return JSON.parse(s); } catch (e) { return fallback; }
  };
  const writeJSON = (k, v) => raw.set(k, JSON.stringify(v));
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

  const AGE = ["2-3", "4-5", "6+"];
  const AVATARS = ["🐯", "🐼", "🦁", "🐰", "🐶", "🐱", "🦊", "🐵", "🐨", "🦄", "🐸", "🐧", "🦋", "🐢", "🐘", "🦚"];
  const SETTINGS_DEFAULT = {
    sessionMin: 0, bedtimeHour: 0, mic: false, speed: "normal", sound: true, voicePick: {},
  };

  function sanitizeProfile(p) {
    return {
      id: String(p.id),
      name: String(p.name || "").replace(/[\u0000-\u001F<>]/g, "").slice(0, 24).trim(),
      avatar: AVATARS.includes(p.avatar) ? p.avatar : AVATARS[0],
      ageBand: AGE.includes(p.ageBand) ? p.ageBand : "4-5",
      voice: p.voice === "male" ? "male" : "female",
      lang: NS.LANGS.includes(p.lang) ? p.lang : "hi",
      created: Number(p.created) || NS.now(),
    };
  }
  function loadProfiles() {
    const d = readJSON("ns_profiles", null);
    const list = d && Array.isArray(d.list) ? d.list.filter(p => p && p.id).map(sanitizeProfile) : [];
    const current = d && list.some(p => p.id === d.current) ? d.current : (list[0] ? list[0].id : null);
    return { v: 1, list, current };
  }
  let P = loadProfiles();
  const saveProfiles = () => writeJSON("ns_profiles", P);

  /* A small JSON bucket stored under one key, cached in memory. */
  const buckets = new Map();
  function bucket(key) {
    if (buckets.has(key)) return buckets.get(key);
    let data = readJSON(key, {});
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    const b = {
      get(k, fallback) { return Object.prototype.hasOwnProperty.call(data, k) ? clone(data[k]) : fallback; },
      set(k, v) {
        if (v === undefined) delete data[k]; else data[k] = clone(v);
        writeJSON(key, data);
      },
      all() { return clone(data); },
      clear() { data = {}; raw.del(key); },
    };
    buckets.set(key, b);
    return b;
  }
  const profileKey = (pid, name) => "ns_p_" + pid + "_" + name;

  function newId() {
    const a = new Uint8Array(6);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 6; i++) a[i] = Math.random() * 256; }
    return "p" + [...a].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  NS.store = {
    raw, AVATARS, AGE,
    profiles: () => clone(P.list),
    current: () => clone(P.list.find(p => p.id === P.current) || null),
    setCurrent(id) {
      if (!P.list.some(p => p.id === id)) return false;
      P.current = id; saveProfiles();
      NS.emit("profile:changed", { id });
      return true;
    },
    addProfile(p) {
      const prof = sanitizeProfile(Object.assign({}, p, { id: newId(), created: NS.now() }));
      P.list.push(prof); P.current = prof.id; saveProfiles();
      NS.emit("profile:changed", { id: prof.id });
      return clone(prof);
    },
    updateProfile(id, patch) {
      const i = P.list.findIndex(p => p.id === id);
      if (i < 0) return null;
      const before = P.list[i];
      P.list[i] = sanitizeProfile(Object.assign({}, before, patch, { id: before.id, created: before.created }));
      saveProfiles();
      if (id === P.current && before.voice !== P.list[i].voice) NS.emit("voice:changed", { voice: P.list[i].voice });
      return clone(P.list[i]);
    },
    /* Deletes a child's profile and every piece of their data on this device. */
    deleteProfile(id) {
      const prefix = "ns_p_" + id + "_";
      raw.keys().filter(k => k.startsWith(prefix)).forEach(k => { raw.del(k); buckets.delete(k); });
      P.list = P.list.filter(p => p.id !== id);
      if (P.current === id) P.current = P.list[0] ? P.list[0].id : null;
      saveProfiles();
      NS.emit("profile:changed", { id: P.current });
    },
    /* Deletes every child's data and the settings. The family's subscription (pass and restore
       code) stays, so a parent does not lose what they paid for. */
    deleteAll() {
      raw.keys().filter(k => k.startsWith("ns_p_") || k === "ns_profiles" || k === "ns_settings").forEach(k => raw.del(k));
      buckets.clear();
      P = { v: 1, list: [], current: null };
      NS.emit("profile:changed", { id: null });
    },
    settings() {
      const s = Object.assign({}, SETTINGS_DEFAULT, readJSON("ns_settings", {}) || {});
      if (![10, 15, 20, 30].includes(s.sessionMin)) s.sessionMin = [10, 15, 20, 30].includes(NS.config.SESSION_MINUTES) ? NS.config.SESSION_MINUTES : 15;
      if (!(s.bedtimeHour >= 18 && s.bedtimeHour <= 23)) s.bedtimeHour = Number(NS.config.BEDTIME_HOUR) || 20;
      s.mic = s.mic === true;
      s.sound = s.sound !== false;
      s.speed = s.speed === "slow" ? "slow" : "normal";
      if (!s.voicePick || typeof s.voicePick !== "object") s.voicePick = {};
      return s;
    },
    setSetting(k, v) {
      const s = readJSON("ns_settings", {}) || {};
      s[k] = v;
      writeJSON("ns_settings", s);
      NS.emit("settings:changed", { key: k, value: v });
    },
    bucket: (pid, name) => bucket(profileKey(pid, name)),
    /* Core per-profile data (stickers, usage, habits) of the current profile. */
    core() { return P.current ? bucket(profileKey(P.current, "core")) : null; },
    /* ctx.data for an activity: a bucket of the current profile. */
    activityData(activityId) {
      const pid = P.current;
      if (!pid) return { get: (k, f) => f, set() {} };
      const b = bucket(profileKey(pid, "a_" + activityId));
      return { get: (k, f) => b.get(k, f), set: (k, v) => b.set(k, v) };
    },
  };
  /* Same as ctx.data, for a module that must store something while its screen is closed
     (e.g. the garden counting habits reported elsewhere). Bound to the current profile. */
  NS.activeData = id => (typeof id === "string" && /^[a-z][a-z0-9]*$/.test(id) ? NS.store.activityData(id) : null);
})();
