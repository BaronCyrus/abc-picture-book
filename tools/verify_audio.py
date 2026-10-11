"""Sanity-check every narration clip with speech recognition.

    uv run --with faster-whisper python tools/verify_audio.py

Prints the clips whose transcript does not match the expected text, so they can
be listened to and regenerated if needed. (Single letters are hard for any
recogniser; treat those as hints only.)
"""
import json
import re
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
timings = json.loads((ROOT / "src/data/timings.json").read_text("utf-8"))
model = WhisperModel("small.en", device="cpu", compute_type="int8")

LETTER_SOUNDS = {
    "a": {"a", "eh", "hey", "ay"}, "b": {"b", "be", "bee"}, "c": {"c", "see", "sea"}, "d": {"d", "dee"},
    "e": {"e", "ee"}, "f": {"f", "eff"}, "g": {"g", "gee", "jee"}, "h": {"h", "age", "aitch"},
    "i": {"i", "eye", "aye"}, "j": {"j", "jay"}, "k": {"k", "kay", "okay"}, "l": {"l", "el", "elle"},
    "m": {"m", "em"}, "n": {"n", "en", "and"}, "o": {"o", "oh"}, "p": {"p", "pee", "pea"},
    "q": {"q", "queue", "cue"}, "r": {"r", "are"}, "s": {"s", "es", "yes"}, "t": {"t", "tea", "tee"},
    "u": {"u", "you"}, "v": {"v", "vee", "we"}, "w": {"w", "double you", "doubleyou"}, "x": {"x", "ex"},
    "y": {"y", "why"}, "z": {"z", "zee", "zed"},
}

norm = lambda s: re.sub(r"[^a-z ]", "", s.lower().replace("-", " ")).strip()
bad = 0
total = 0
for voice, clips in sorted(timings.items()):
    for key, info in sorted(clips.items()):
        kind, lid = key.split("/")
        path = ROOT / "public/audio" / voice / kind / f"{lid}.mp3"
        segs, _ = model.transcribe(str(path), language="en", beam_size=5, initial_prompt=info["text"] if kind != "letter" else "The alphabet: A, B, C, D, E, F, G.")
        heard = norm(" ".join(s.text for s in segs))
        want = norm(info["text"])
        total += 1
        ok = heard == want or heard.replace(" ", "") == want.replace(" ", "")
        if kind == "letter":
            ok = heard in LETTER_SOUNDS.get(lid, {lid})
        if not ok:
            bad += 1
            print(f"MISMATCH {voice}/{key}: want '{want}' heard '{heard}'")
print(f"checked {total} clips, {bad} mismatch(es)")
