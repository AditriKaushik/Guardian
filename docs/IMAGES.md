# नन्हा स्कूल — realistic pictures

Small children learn the world from what they see. "आ से आम" should show a mango that looks
like a mango, not a flat cartoon symbol. So every emoji that the lessons, games and stories use
as a **picture of a real thing** (fruit, vegetable, animal, bird, vehicle, body part, food,
everyday object, person) has a soft, realistic 3D picture. Abstract symbols (colour swatches,
shapes, arrows, UI buttons, decorations, flags) stay emoji on purpose.

## What is shipped today

| | |
|---|---|
| pictures | `web/img/real/<slug>.webp`, 256×256 (the full Fluent render, sharp on 2× screens), WebP with transparency (~7 KB each, ~2 MB in all) |
| source | [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D renders, MIT License |
| credits | `web/img/real/CREDITS.txt` (licence text + every file and its source) |
| lookup | `web/js/content/images.js` → `NS.images`, `NS.img(key)`, `NS.img.parts(text)` |
| people | the Fluent "Medium" skin-tone render, unless the content asks for a specific tone (careers mixes tones on purpose); the yellow "Default" render is a cartoon, not a person |
| animals | `🐶 🐱 🐮 🐰 🐵 🐷 🐯` (cartoon faces) show the full-body animal |
| families | `👩‍👧 👨‍👩‍👧 👨‍👩‍👦` are composed from Fluent person renders (Fluent has no 3D families) |

These are 3D *illustrations*, not photographs: much closer to real things than emoji, still soft
and friendly. Real photographs can replace any of them later (see the last section).

## Using the pictures (for module authors)

```js
NS.img("🥭")              // "img/real/mango.webp"  (relative to index.html), or null
NS.img("☀️") === NS.img("☀")   // U+FE0F/U+FE0E are ignored
NS.img("👩🏿‍🌾")             // skin tone kept when that picture exists, else the same person in another tone
NS.img.parts("🥭🥭🥭")      // [{key:"🥭", url:"img/real/mango.webp"}, …]  — counting rows, story scenes
NS.img.parts("🐦🌳🚫")      // url is null for 🚫 → show the emoji for that one
```

- Show the picture with `<img src=… alt="">` (the caption/voice already names the thing) and fall
  back to the emoji text when `NS.img` returns `null`. Text still goes in via `textContent`.
- `img-src 'self'` in the CSP already allows these files; the service worker caches each picture
  the first time it is shown (same-origin GET), and the Android shell bundles `web/` (WebP is fine).
- Lesson cards (`js/content/lessons.js`): letters and numbers keep their picture in `pic`
  (a counting card's `pic` is a repeated emoji, e.g. `"🥭🥭🥭🥭🥭"` → use `NS.img.parts`);
  colour and shape cards keep the swatch in `big` and now also carry a real object of that colour
  or shape in `pic` (लाल → 🍅 tomato, हरा → 🫛 peas, वृत्त → 🛞 wheel, हीरा → 🪁 kite …).

## Adding or changing pictures

```sh
pip install pillow
node tools/images/suggest-fluent.mjs            # lists emoji in content/modules with no picture yet
node tools/images/suggest-fluent.mjs --write    # … and adds Fluent entries to tools/images/fluent.json
python3 tools/images/fetch-fluent.py --prune    # downloads, keeps 256×256, writes WebP, removes unused
node tools/images/build-images.mjs              # rewrites js/content/images.js + CREDITS.txt
python3 tools/images/contact-sheet.py --out /tmp/sheet.png --per-page 60   # LOOK at them
node --test tools/test/*.test.mjs               # images.test.mjs prints coverage per deck
```

- `tools/images/fluent.json` is the curated list: `{slug, src, name, keys}` per picture (`src` is the
  path under `assets/` in the Fluent repo). Edit it by hand to pick a better render for an emoji,
  e.g. map a key to another Fluent picture.
- `tools/images/symbols.mjs` lists emoji that are symbols on purpose (no picture needed).
- `images.js` is generated — never edit it by hand.
- Always look at a contact sheet before shipping: is it the right thing, does it look real and
  friendly, is it fine for a 2–6 year old?
- Budget: `web/img/real/` must stay ≤ 5 MB (the test fails above that).

## Choosing lesson words that have a real picture

A picture word must be a concrete thing a small child can see around them, and its picture must
show exactly that thing. Words like ठठेरा, ओखली, यंत्र, क्षत्रिय or दवात are archaic or abstract
and had no honest picture, so the varnamala now uses everyday things (अनानास, इंजन, ईंट, ओस,
ठेला, डिब्बा, दूध, नाव, फूल, योग, रोटी, लकड़ी, क्षितिज …). Before adding a word, check that
`NS.img(emoji)` shows *that* thing (an apple is not a pomegranate; a yo-yo is not a लट्टू).

## Later: real photographs from Wikimedia Commons (optional)

`tools/images/fetch-photos.mjs` can replace any picture with a real photograph. It is built so
that **no picture is ever chosen or published by a machine**:

1. **A person chooses.** In `tools/images/photos.csv` (a worklist of the lesson nouns, in lesson
   order) the person fills `commons_file` with the exact Commons file title they picked on
   commons.wikimedia.org, e.g. `File:Some mango.jpg`. Prefer: one whole object, plain background,
   good light, the variety Indian children know (देसी आम, हरा तोता, Indian cow). Avoid photos of
   identifiable people and children — keep the Fluent pictures for people and body parts.
2. **Fetch** (needs internet; run on a normal computer, not in a locked-down sandbox):
   ```sh
   node tools/images/fetch-photos.mjs check --csv tools/images/photos.csv
   node tools/images/fetch-photos.mjs fetch --csv tools/images/photos.csv --contact "you@example.org"
   ```
   For each chosen file it asks the Commons API
   (`action=query&prop=imageinfo&iiprop=url|size|mime|thumbmime|sha1|extmetadata&iiurlwidth=384&iiurlheight=384`)
   and **refuses** anything that is not CC0, public domain or CC BY (no BY-SA, NC, ND, GFDL,
   non-free), anything with Commons "Restrictions" (personality rights, trademarks …), non-photos,
   and CC BY files without an author to credit. Accepted files are downloaded as Commons-scaled
   thumbnails (fit 384×384) into a staging folder **outside `web/`** (default: the system temp
   folder), with their licence, author and source page in a `.json` next to each picture, plus
   `review.txt` and `review.png` (contact sheet). Wikimedia requires a User-Agent with contact
   details (`--contact`); behind an HTTPS proxy run with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).
3. **A person reviews** every downloaded picture: right thing? a real, clear photo on a phone?
   safe and kind for ages 2–6 (nothing scary, no violence, no brands, no people's faces)?
   If yes they write their name in `approved_by` and copy the 12-character hash from `review.txt`
   into `approved_hash` — the approval is for exactly that picture.
4. **Publish**:
   ```sh
   node tools/images/fetch-photos.mjs publish --csv tools/images/photos.csv
   ```
   Only approved rows whose staged picture still matches the approved hash are copied to
   `web/img/real/photo/<slug>.webp` (converted with Pillow when present). It writes
   `tools/images/photos.json` (title, author, licence, source, changes, approver) and runs
   `build-images.mjs`: in `images.js` a photo wins over the Fluent picture for the same emoji, and
   `CREDITS.txt` gets a full attribution for every photo (CC BY needs it). Removing an approval
   and publishing again unpublishes that photo.
5. Look at the app on a phone, then run the tests.
