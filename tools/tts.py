"""Generate narration clips for every letter / word / sentence.

Usage (from the project root):
    uv run --with edge-tts --with numpy python tools/tts.py [--only a,b,c] [--force]

Output:
    public/audio/emma/letter/<id>.mp3     cheerful narrator: "A!"
    public/audio/emma/word/<id>.mp3       cheerful narrator: "Apple!"
    public/audio/ava/word/<id>.mp3        second adult voice, alternates with the narrator on taps
    public/audio/ava/sentence/<id>.mp3    calm storyteller for the story pages
    public/audio/ana/sound/<id>.mp3       animal / vehicle sound ("Woof! Woof!") if the letter has one
    public/audio/emma/praise/<key>.mp3    follow-read feedback ("Excellent!" ...)
    src/data/timings.json   (clip durations + per-word timings for karaoke highlighting)

Clips are trimmed (so they start the instant a child taps), level-matched and
re-encoded with ffmpeg. Word timings are shifted to match the trimmed audio.
"""

import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LETTERS = json.loads((ROOT / "src/data/letters.json").read_text("utf-8"))
OUT = ROOT / "public/audio"
TIMINGS = ROOT / "src/data/timings.json"
SR = 24000

# voice key -> (edge voice, rate for short clips, rate for sentences)
# Emma was picked as the word-page narrator because her pitch moves ~13 semitones
# within a single word (Ava: ~6), which is what "cheerful" sounds like.
VOICES = {
    "emma": ("en-US-EmmaNeural", "-10%", "-20%"),
    "ava": ("en-US-AvaNeural", "-20%", "-28%"),
    "ana": ("en-US-AnaNeural", "-8%", "-12%"),
}

PRAISE = {"excellent": "Excellent!", "great": "Great job!", "good": "Good!", "again": "Try again!"}

# Spellings that make the letter name come out clearly (checked with tools/verify_audio.py).
LETTER_TEXT = {"i": "I."}  # "I!" comes out with a breathy onset that sounds like "bye"

# Words whose second-voice reading did not come out clearly; the page then uses the narrator only.
SKIP_ALT = {"h"}  # Ava's "Hat." is heard as "hot"


def sentence_case(s: str) -> str:
    return s[:1].upper() + s[1:]


def jobs_for(entry):
    """(voice, kind, id, text) for one letter."""
    lid = entry["id"]
    word = sentence_case(entry["word"])
    jobs = [
        ("emma", "letter", lid, LETTER_TEXT.get(lid, f"{lid.upper()}!")),
        ("emma", "word", lid, f"{word}!"),
        # second adult voice for taps: hearing two speakers helps, and adult models keep
        # final consonants clear (the child voice was too soft on dog / goat / hat ...)
        *([] if lid in SKIP_ALT else [("ava", "word", lid, f"{word}.")]),
        ("ava", "sentence", lid, entry["sentence"]),
    ]
    if entry.get("sound"):
        jobs.append(("ana", "sound", lid, entry["sound"]))
    return jobs


async def synth(text, voice, rate):
    """Returns (mp3 bytes, [(text, start_s, dur_s)])."""
    last_err = None
    for attempt in range(4):
        try:
            com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
            audio = bytearray()
            words = []
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    words.append((chunk["text"], chunk["offset"] / 1e7, chunk["duration"] / 1e7))
            if audio:
                return bytes(audio), words
            last_err = RuntimeError("empty audio")
        except Exception as e:  # network hiccup: retry
            last_err = e
        await asyncio.sleep(1.5 * (attempt + 1))
    raise last_err


def decode(mp3: bytes) -> np.ndarray:
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        input=mp3, capture_output=True, check=True,
    )
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def encode(pcm: np.ndarray, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", "80k", "-ar", str(SR), str(path)],
        input=pcm.astype(np.float32).tobytes(), check=True,
    )


def polish(pcm: np.ndarray):
    """Trim silence, fade edges, match loudness. Returns (pcm, lead_s, tail_s): the short
    silences left before the first and after the last voiced sample."""
    win = int(SR * 0.01)
    env = np.sqrt(np.convolve(pcm ** 2, np.ones(win) / win, mode="same"))
    active = np.where(env > 0.012)[0]
    if len(active) == 0:
        return pcm, 0.0, 0.0
    start = max(0, active[0] - int(SR * 0.035))
    end = min(len(pcm), active[-1] + int(SR * 0.16))
    out = pcm[start:end].copy()
    fi, fo = int(SR * 0.008), int(SR * 0.05)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    voiced = env[start:end] > 0.02
    rms = float(np.sqrt(np.mean(out[voiced] ** 2))) if voiced.any() else 0.05
    gain = 10 ** (-20.5 / 20) / max(rms, 1e-4)
    peak = float(np.max(np.abs(out))) or 1.0
    gain = min(gain, 10 ** (-1.2 / 20) / peak)
    return out * gain, (active[0] - start) / SR, (end - 1 - active[-1]) / SR


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma separated letter ids")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    timings = json.loads(TIMINGS.read_text("utf-8")) if TIMINGS.exists() else {}
    sem = asyncio.Semaphore(4)

    async def run(vkey, kind, lid, text):
        voice, rate_word, rate_sentence = VOICES[vkey]
        path = OUT / vkey / kind / f"{lid}.mp3"
        key = f"{kind}/{lid}"
        if path.exists() and not args.force and key in timings.get(vkey, {}):
            return
        async with sem:
            mp3, words = await synth(text, voice, rate_sentence if kind == "sentence" else rate_word)
        pcm, lead, tail = polish(decode(mp3))
        encode(pcm, path)
        dur = len(pcm) / SR
        info = {"dur": round(dur, 3), "text": text}
        if kind == "sentence" and words:
            # The service's word offsets drift against the audio (early at the start, right at
            # the end), so stretch them linearly onto the span that is actually voiced.
            t0 = words[0][1]
            span = (words[-1][1] + words[-1][2]) - t0
            k = (dur - lead - tail) / span if span > 0 else 1.0
            info["words"] = [
                {"w": w, "t": round(lead + (t - t0) * k, 3), "d": round(d * k, 3)} for (w, t, d) in words
            ]
        timings.setdefault(vkey, {})[key] = info
        print(f"  {vkey:4s} {key:12s} {info['dur']:5.2f}s  {text}")

    tasks = []
    for entry in LETTERS:
        if only and entry["id"] not in only:
            continue
        for vkey, kind, lid, text in jobs_for(entry):
            tasks.append(run(vkey, kind, lid, text))
    if not only:
        for key, text in PRAISE.items():
            tasks.append(run("emma", "praise", key, text))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    errs = [r for r in results if isinstance(r, Exception)]
    TIMINGS.write_text(json.dumps(timings, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf-8")
    print(f"done: {len(tasks) - len(errs)} ok, {len(errs)} failed")
    for e in errs:
        print("  ERROR", repr(e), file=sys.stderr)
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    asyncio.run(main())
