// The one place that turns a spoken line into a manifest key. It mirrors the app exactly:
//   web/js/core/voice.js   clipKey = (lang, text) => NS.speechLang(lang) + "|" + NS.stripEmoji(text)
//   web/js/core/ns.js      NS.speechLang = lang => (lang === "en" ? "en" : "hi")
//                          NS.stripEmoji = emoji → " ", whitespace runs → " ", trim
// If either of those changes, change this file too (tools/voice/test checks known keys).
//
// The app looks a clip up for the whole text first, then for each phrase, so a clip recorded
// for the whole line (what this tool extracts) is always the one that plays.

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu;

export function normalizeText(text) {
  return String(text == null ? '' : text).replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
}

/** "en", "en-IN", "en_US" → "en"; everything else ("hi", "hi-IN", "hinglish") → "hi". */
export function normalizeLang(lang) {
  const l = String(lang == null ? '' : lang).trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return l === 'en' ? 'en' : 'hi';
}

export function clipKey(lang, text) {
  return `${normalizeLang(lang)}|${normalizeText(text)}`;
}

/** True when a normalized line has something to say (at least one letter or digit). */
export function isSpeakable(text) {
  return /[\p{L}\p{N}]/u.test(text);
}
