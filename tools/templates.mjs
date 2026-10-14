// Builds src/data/templates.json: spectral fingerprints of every word read by ten
// different voices (grown-ups, children, men, British and American). The
// follow-read check compares a child's attempt with all of them; using many
// voices is what lets it recognise a voice it has never heard (leave-one-voice-out:
// the right word lands in the top 3 for 97% of words, a wrong word sneaks in 4%).
//
//   uv run --with edge-tts --with numpy python tools/tts.py --template-voices
//   node tools/templates.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fingerprint, compact } from '../src/core/speech.js';

const letters = JSON.parse(readFileSync('src/data/letters.json', 'utf8'));

function decode(path, sr = 24000) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', String(sr), 'pipe:1'], { maxBuffer: 1 << 26 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

const dirs = ['public/audio/emma/word', 'public/audio/ava/word'];
if (existsSync('.cache/voices')) for (const v of readdirSync('.cache/voices')) dirs.push(`.cache/voices/${v}`);

const out = {};
for (const L of letters) {
  out[L.id] = [];
  for (const d of dirs) {
    const file = `${d}/${L.id}.mp3`;
    if (!existsSync(file)) continue;
    out[L.id].push(compact(fingerprint(decode(file), 24000)).map((f) => f.map((x) => Math.round(x * 4))));
  }
}
writeFileSync('src/data/templates.json', JSON.stringify(out));
const frames = Object.values(out).flat().reduce((s, f) => s + f.length, 0);
console.log(`templates: ${Object.keys(out).length} words x ${dirs.length} voices, ${frames} frames`);
