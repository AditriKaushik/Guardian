# नन्हा स्कूल — Architecture (v2)

One app, every screen. The **web app in `web/` is the only app**. Android runs it inside a
thin native shell (WebView) that adds the phone's best voices and on-device speech
recognition. iPhone, Windows, desktop and tablets use the same web app as an installable PWA.
All personal data (child profiles, progress, settings) lives **only on the device**.

## Files

```
web/
  index.html            loads the scripts below in this order (all `defer`, no inline code)
  config.js             owner settings (payments, prices, free tiles)
  app.css               design system + responsive layout (one stylesheet)
  js/core/ns.js         the NS namespace, registry, event bus, helpers   (core agent)
  js/core/store.js      on-device storage: profiles, per-profile data    (core agent)
  js/core/voice.js      speech out (clips → native → Web Speech), speech in (core agent)
  js/core/ui.js         shell: header, home, navigation, settings, parents (core agent)
  js/core/rewards.js    stickers & gentle celebrations                   (core agent)
  js/core/billing.js    trial, passes, paywall, restore (moved from app.js) (core agent)
  js/content/*.js       pure data: lessons, rhymes, stories, careers …    (owners below)
  js/modules/learn.js   flashcards, rhymes, quiz (existing activities)    (core agent)
  js/modules/routine.js "मेरा दिन" day world                              (habits agent)
  js/modules/garden.js  "मेरा बगीचा" habit garden                          (habits agent)
  js/modules/stories.js "कहानी समय" stories                              (habits agent)
  js/modules/dreams.js  "बड़े होकर" dream jobs                             (habits agent)
  js/modules/focus.js   "ध्यान" focus games + breathing                    (habits agent)
  js/brain/brain.js     talking-buddy brain: pure logic, no DOM           (buddy agent)
  js/modules/buddy.js   talking-buddy chat screen                         (buddy agent)
  audio/manifest.json   optional recorded/neural voice clips (see VOICE.md)
```

Script order in `index.html`: `config.js`, `js/core/ns.js`, `js/core/store.js`,
`js/core/voice.js`, `js/core/rewards.js`, `js/core/billing.js`, `js/content/*.js`,
`js/brain/brain.js`, `js/modules/*.js`, `js/core/ui.js` (last: it boots the app).

Classic scripts sharing one global `window.NS`. No build step, no frameworks, no
third-party code. CSP stays strict (`script-src 'self' …razorpay`).

## The module contract (every activity uses exactly this)

```js
NS.registerActivity({
  id: "routine",                 // unique, a-z
  icon: "🌞",                    // emoji shown on the home tile
  title: { hi: "मेरा दिन", en: "My Day" },
  color: "#FFB300",              // tile colour
  section: "grow",               // "learn" | "grow" | "play" — groups tiles on home
  free: false,                   // true = stays free after the trial
  order: 10,                     // sort order within the section
  open(ctx) { … },               // render into ctx.screen; return optional cleanup fn
});
```

`ctx` (built by the core for each open):

| member | what it does |
|---|---|
| `ctx.screen` | empty `<div>` to render into (core already set the header title/back button) |
| `ctx.lang` | current UI language: `"hi"`, `"en"` or `"hinglish"` |
| `ctx.t(obj)` | picks the right string from `{hi, en, hinglish?}` (falls back hi → en) |
| `ctx.say(text, lang?)` | speaks (returns a Promise that resolves when done or skipped). `lang` defaults to the voice language for `ctx.lang` |
| `ctx.sayLines(lines, lang?)` | speaks lines in order (Promise) |
| `ctx.stopVoice()` | stops speaking |
| `ctx.listen({lang})` | Promise → recognised text, or `null` if speech input is unavailable/cancelled |
| `ctx.profile` | read-only copy: `{id, name, avatar, ageBand: "2-3"|"4-5"|"6+", voice: "female"|"male", lang}` |
| `ctx.data` | this activity's per-profile storage: `ctx.data.get(key, fallback)`, `ctx.data.set(key, value)` (JSON values, saved on device) |
| `ctx.reward({sticker, reason})` | grants a sticker (emoji) with a gentle celebration; returns nothing |
| `ctx.daypart()` | `"morning"` (5–11), `"noon"` (11–15), `"evening"` (15–19), `"night"` (19–5) by the device clock |
| `ctx.minutesToday()` | minutes this profile has used the app today |
| `ctx.home()` | go back to the home screen |
| `ctx.open(id)` | open another activity |
| `ctx.el(tag, cls, text)` | create an element (text via textContent only) |
| `ctx.button(label, cls, onClick)` | create a big accessible button |
| `ctx.isLocked` | false inside `open` (the core shows the paywall gate for locked tiles) |

Rules for every module:
- Text into the DOM **only** via `textContent` (never `innerHTML`).
- Every on-screen instruction is also spoken (children can't read).
- No timers that pressure, no streaks that can be lost, no guilt ("I'll be sad if you go"),
  no fake urgency, no ads, no network calls. Rewards are tied to learning or real-life habits.
- Persist only through `ctx.data` (never `localStorage` directly).

## Events (`NS.on(name, fn)` / `NS.emit(name, payload)`)

- `habit:done` `{habit}` — a real-life habit the child reported (brush, eat, play, read, sleep,
  water, help). Emitted by routine/buddy; the garden listens and grows a plant.
- `profile:changed`, `lang:changed`, `voice:changed`
- `session:wind-down` — emitted by the core when the session limit is reached (see below).

## Sessions and time (the covert "value of time" design)

- Default session length 15 minutes (parents can set 10/15/20/30). At the limit the core shows
  a calm "चलो, अब थोड़ा आराम/खेल" screen with an off-screen activity suggestion and returns to
  home only after a grown-up's question. No countdown is ever shown to the child.
- At night (`daypart() === "night"`, after 20:00 by default) home shows the sky darkening and a
  "सोने की तैयारी" bedtime path: a lullaby, then a goodnight from the buddy.
- The home sky follows the real time of day (sun rising, high, setting, moon), so the child
  absorbs the rhythm of a day without being told.

## Native bridge (Android shell)

When the app runs inside the Android shell, `window.NanhaNative` exists (all methods sync,
strings only; results come back via `window.NS.native.onEvent(jsonString)`):

| method | purpose |
|---|---|
| `NanhaNative.platform()` | `"android"` |
| `NanhaNative.voices()` | JSON array `[{id, lang, gender: "female"|"male"|"unknown", local: true|false, label}]` |
| `NanhaNative.speak(id, text, lang, voiceId, rate, pitch)` | speak; emits `{"type":"speak-done","id":…}` |
| `NanhaNative.stop()` | stop speaking |
| `NanhaNative.listen(id, lang)` | on-device speech recognition; emits `{"type":"listen-result","id":…,"text":…}` or `{"type":"listen-result","id":…,"text":null}` |
| `NanhaNative.openExternal(url)` | open an https URL in the phone's browser (used for payment) |

Events also include `{"type":"resume"}` when the app returns to the foreground.

The shell serves `web/` from `https://appassets.androidplatform.net/` (intercepted, offline,
never touches the network), so the app has a real HTTPS origin.

## Payments (unchanged server contract, plus plan choice)

`POST /api/subscribe {trial_days_left, plan?: "monthly"|"yearly"}` → `{subscription_id, key_id, restore_code}`.
- In a browser: Razorpay checkout opens in the page (as today).
- In the Android shell: the app opens `pay.html#s=…&k=…` with `NanhaNative.openExternal`,
  stores the pending restore code on the device, and confirms with `/api/restore` when the
  `resume` event arrives (or the parent taps "मैंने भुगतान कर दिया").

## Core additions (v2.1, backward compatible)

Everything above still holds; the core also provides:

| member | what it does |
|---|---|
| `ctx.habitsToday()` | names of the habits this profile reported today (from `habit:done`) |
| `ctx.canListen()` | `true` when a grown-up turned the mic on **and** speech recognition exists |
| `ctx.profile` | also the read-only fields above; `name` may be `""` (the name is optional) |
| `ctx.reward({sticker, reason})` | `reason` may be a string or `{hi, en}`; the "शाबाश!" waits for the current sentence to finish |
| activity `hidden: true` | registered but no home tile (e.g. `sleep`, opened by the night-time bedtime card) |
| activity `relang: true` | the core re-opens the activity when the language changes; without it only the header title updates and the module may listen to `lang:changed` |
| `NS.activeData(id)` | the same get/set store as `ctx.data` of activity `id`, for the current profile (e.g. the garden counting habits while closed, the buddy reading `NS.activeData("dreams").get("dream")`) |
| `NS.now()`, `NS.dayKey(date?)` | the clock in one place (tests fake it) and the local day as `"YYYY-MM-DD"` |
| `NS.setLang(lang)` | saves the current profile's language, re-renders, emits `lang:changed {lang}` (no event if unchanged) |
| `NS.back()` | Android back button: closes the current screen; returns `false` on home so the app may close |
| `NS.mascot(mood, cls)` | मिट्ठू the parrot as inline SVG; moods `idle happy sleepy curious calm proud caring`; `NS.mascot.mood(svg, mood)` switches; `NS.ui.talk(svg, text)` moves the beak while speaking |
| `NS.voice.sayAfter(text)` | speak after the current sentence (dropped if something else starts speaking first) |

Events (additions): `habit:done` habits are `brush bath eat play read sleep water help`;
`dream:chosen {id, title: {hi, en}, icon}` (dreams.js; the stored `ctx.data` "dream" is
`{id, title: {hi, en}, icon, at}` — read titles with `NS.t(title)`); `reward:granted
{sticker, reason, activity}`; `session:wind-down {minutes}`; `settings:changed {key, value}`;
`activity:registered {id}`; `native:<type>` for every bridge event.

Native bridge (additions, see android/): all arguments are strings; request ids match
`[A-Za-z0-9._:-]{1,64}`; `lang` is `hi-IN` or `en-IN` (Hinglish → `hi-IN`); `voices()` returns
`[]` until the engine is ready and then the shell sends `{"type":"voices"}`;
`NanhaNative.secure("true"|"false")` is called when the grown-ups' screens (gate, paywall,
restore code) open and close; `openExternal(url)` returns `true`/`false`. The service worker is
never registered inside the shell.

Storage (all `localStorage`, on the device only): `ns_profiles`, `ns_settings`,
`ns_p_<profileId>_core` (stickers, minutes per day, habits, activities opened),
`ns_p_<profileId>_a_<activityId>` (`ctx.data`), `ns_session`, and the family's subscription
`ns_trial ns_seen ns_pass ns_sub ns_restore ns_pending`. "Delete all data" removes everything
except the subscription.

## Voice clips (`web/audio/manifest.json`)

```json
{"version":1,"clips":{"female":{"hi|अ से अनार":"audio/female/hi/0001.mp3"},"male":{"hi|अ से अनार":"audio/male/hi/0001.mp3"}}}
```

- Key = `<speech lang>|<normalized text>`. Speech lang is `hi` or `en` (`NS.speechLang`:
  Hinglish text is spoken with the Hindi voice, so its key starts with `hi|`).
- Normalized text = `NS.stripEmoji(text)`: emoji, skin-tone modifiers, regional indicators,
  VS15/VS16, ZWJ and keycap marks replaced by a space, whitespace runs collapsed to one space,
  trimmed. Punctuation and letter case are kept.
- The voice looks up the whole text first, then each phrase (text split after `। ॥ . ! ? ; : ,`
  and line breaks), and plays any clip it finds (wanted gender first, then the other gender)
  before falling back to the native or browser voice. Paths are relative to `index.html` and
  must match `audio/…`.
- An empty manifest (`{"version":1,"clips":{"female":{},"male":{}}}`) means "no clips".
  Clips are cached by the service worker on first play, never precached.
