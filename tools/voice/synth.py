#!/usr/bin/env python3
"""Neural voice for every line in tools/voice/lines.csv (optional — a recorded human voice is better).

Writes tools/voice/recordings/<female|male>/<id>.wav, the same place a human recording goes,
so build-manifest.mjs treats both the same way. Existing files are kept (a human recording is
never overwritten); delete a file to have it synthesised again.

Engines (only ones whose licence we could confirm allows commercial use — see docs/VOICE.md):
  indic-parler-tts   ai4bharat/indic-parler-tts (Apache-2.0). Hindi: Divya (f) / Rohit (m);
                     Indian English: Mary (f) / Thoma (m).
  kokoro             hexgrad/Kokoro-82M (Apache-2.0). Hindi: hf_alpha (f) / hm_omega (m);
                     English: af_heart (f) / am_michael (m) — American accent, no Indian English voice.

Usage (normally run by .github/workflows/voice.yml, which installs the engine):
  python tools/voice/synth.py --engine indic-parler-tts --voice female [--shard 0 --shards 4] [--limit 20]
"""

import argparse
import csv
import hashlib
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Speakers per engine → voice → language.
SPEAKERS = {
    "indic-parler-tts": {
        "female": {"hi": "Divya", "en": "Mary"},
        "male": {"hi": "Rohit", "en": "Thoma"},
    },
    "kokoro": {
        "female": {"hi": "hf_alpha", "en": "af_heart"},
        "male": {"hi": "hm_omega", "en": "am_michael"},
    },
}

# Parler-TTS is steered by a plain-English description of the delivery we want.
PARLER_STYLE = (
    "{name} speaks in a warm, gentle, cheerful and expressive voice, at a slightly slow pace, "
    "like a kind teacher talking to a small child. The recording is very clear and close-up, "
    "with no background noise."
)


def read_lines(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if not rows or rows[0] != ["id", "lang", "text"]:
        sys.exit("lines.csv must start with the header id,lang,text — run extract-lines.mjs first")
    return [{"id": r[0], "lang": r[1], "text": r[2]} for r in rows[1:] if len(r) >= 3 and r[0]]


def shard_of(line_id, shards):
    return int(hashlib.sha1(line_id.encode("utf-8")).hexdigest(), 16) % shards


def seed_of(line_id, voice):
    return int(hashlib.sha1(f"{voice}|{line_id}".encode("utf-8")).hexdigest()[:8], 16)


class IndicParler:
    def __init__(self):
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        name = "ai4bharat/indic-parler-tts"
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(name).to(self.device)
        self.tokenizer = AutoTokenizer.from_pretrained(name)
        self.description_tokenizer = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path)
        self.rate = self.model.config.sampling_rate

    def say(self, text, lang, speaker, seed):
        from transformers import set_seed

        set_seed(seed)  # same line → same take on every run
        desc = self.description_tokenizer(PARLER_STYLE.format(name=speaker), return_tensors="pt").to(self.device)
        prompt = self.tokenizer(text, return_tensors="pt").to(self.device)
        with self.torch.no_grad():
            audio = self.model.generate(
                input_ids=desc.input_ids,
                attention_mask=desc.attention_mask,
                prompt_input_ids=prompt.input_ids,
                prompt_attention_mask=prompt.attention_mask,
            )
        return audio.cpu().numpy().squeeze(), self.rate


class Kokoro:
    LANG_CODE = {"hi": "h", "en": "a"}

    def __init__(self):
        from kokoro import KPipeline

        self.pipelines = {lang: KPipeline(lang_code=code) for lang, code in self.LANG_CODE.items()}
        self.rate = 24000

    def say(self, text, lang, speaker, seed):
        import numpy as np

        pipeline = self.pipelines[lang]
        chunks = [np.asarray(audio) for _, _, audio in pipeline(text, voice=speaker, speed=0.9) if audio is not None]
        if not chunks:
            raise RuntimeError("no audio")
        return np.concatenate(chunks), self.rate


ENGINES = {"indic-parler-tts": IndicParler, "kokoro": Kokoro}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", required=True, choices=sorted(ENGINES))
    ap.add_argument("--voice", required=True, choices=["female", "male"])
    ap.add_argument("--lines", default=str(HERE / "lines.csv"))
    ap.add_argument("--out", default=str(HERE / "recordings"))
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--shards", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0, help="stop after this many new lines (0 = all)")
    args = ap.parse_args()
    if not 0 <= args.shard < args.shards:
        sys.exit("--shard must be between 0 and --shards - 1")

    speakers = SPEAKERS[args.engine][args.voice]
    out_dir = Path(args.out) / args.voice
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = []
    for line in read_lines(args.lines):
        if shard_of(line["id"], args.shards) != args.shard:
            continue
        if line["lang"] not in speakers:
            print(f"  skip {line['id']}: no {args.voice} {line['lang']} speaker for {args.engine}")
            continue
        if any((out_dir / f"{line['id']}{ext}").exists() for ext in (".wav", ".mp3", ".m4a", ".ogg", ".flac")):
            continue  # already recorded or synthesised — never overwrite
        todo.append(line)
    if args.limit:
        todo = todo[: args.limit]
    print(f"{args.engine} / {args.voice} / shard {args.shard + 1} of {args.shards}: {len(todo)} line(s) to synthesise")
    if not todo:
        return

    import soundfile as sf

    engine = ENGINES[args.engine]()
    failed = 0
    for i, line in enumerate(todo, 1):
        try:
            audio, rate = engine.say(line["text"], line["lang"], speakers[line["lang"]], seed_of(line["id"], args.voice))
            tmp = out_dir / f"{line['id']}.tmp.wav"
            sf.write(str(tmp), audio, rate)
            os.replace(tmp, out_dir / f"{line['id']}.wav")
            print(f"  [{i}/{len(todo)}] {line['id']}")
        except Exception as e:  # one bad line must not lose the others
            failed += 1
            print(f"  ! {line['id']}: {type(e).__name__}: {e}", file=sys.stderr)
    if failed:
        # Partial failures don't fail the job (the other clips are still useful); total failure does.
        print(f"::warning::{failed} of {len(todo)} line(s) failed to synthesise", file=sys.stderr)
        if failed == len(todo):
            sys.exit(1)


if __name__ == "__main__":
    main()
