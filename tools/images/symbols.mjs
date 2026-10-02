// Emoji that stay emoji on purpose: colour swatches, shapes, arrows, UI controls, decorations and
// flags are symbols, not pictures of real things, so they get no realistic picture.
// Shared by tools/images/suggest-fluent.mjs and tools/test/images.test.mjs.
export const keyOf = (e) => String(e).replace(/[︎️]/g, "");

export const SYMBOLS = new Set(`
🔴 🟢 🔵 🟡 🟠 🟣 🟤 ⚫ ⚪ 🟩 🟥 🟦 🟨 🟧 🟪 🟫 ⬛ ⬜ 🔺 🔻 🔷 🔶 🔹 🔸 ⭕ ❤ 💛 💚 💙 💜 🧡 🤎 🖤 🤍 🩶 🩷 🩵 💖
🔤 🔢 🔠 🔡 ➡ ⬅ ⬆ ⬇ ↩ ↪ 🔄 🔁 🔃 ▶ ⏸ ⏹ ⏺ ✅ ❌ ✔ ✖ 🔒 🔓 🔊 🔇 🔉 🔈 ➕ ➖ ❓ ❔ ❗ ❕ 🚫 💬 💭 🗨
🎶 🎵 ✨ 🌟 💫 🎉 🎊 💤 〰 🌀 👉 👈 👍 🗣 🎤 ⌨ 🗑 📲 📊 📒 📜 🎮 🎭 🌠 ⚙ 🇮🇳 🙉
`.trim().split(/\s+/).map(keyOf));
