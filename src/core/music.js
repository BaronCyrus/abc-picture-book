// Background music for the home page, synthesised on the fly: a small, cheerful
// original tune for marimba, plucked chords, soft bass and shaker. No audio file,
// loops seamlessly, and stays quiet under everything else.
import { musicGraph, canPlay } from './audio.js';

const BPM = 112;
const STEP = 60 / BPM / 2; // one eighth note
const LEVEL = 0.2; // overall loudness of the music bus
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 8 bars, 8 eighth-notes each. 0 = rest.
const TUNE_A = [
  76, 76, 79, 0, 76, 0, 72, 0, //  C   mi mi so  mi  do
  74, 0, 76, 0, 72, 0, 0, 0, //    Am  re  mi  do
  77, 77, 81, 0, 77, 0, 72, 0, //  F   fa fa la  fa  do
  74, 0, 71, 0, 74, 0, 0, 79, //   G   re  ti  re      (so)
  76, 76, 79, 0, 84, 0, 79, 0, //  C   mi mi so  do' so
  81, 0, 79, 0, 76, 0, 0, 0, //    Am  la  so  mi
  77, 0, 76, 0, 74, 0, 71, 0, //   F G fa  mi  re  ti
  72, 0, 0, 0, 0, 0, 67, 0, //     C   do          (so,)
];
// second time round: a lighter answer that dances on the chord notes
const TUNE_B = [
  72, 0, 76, 79, 0, 76, 79, 0,
  72, 0, 76, 81, 0, 76, 72, 0,
  72, 0, 77, 81, 0, 77, 81, 0,
  71, 0, 74, 79, 0, 74, 71, 0,
  72, 0, 76, 79, 0, 84, 79, 0,
  69, 0, 72, 76, 0, 81, 76, 0,
  77, 0, 81, 77, 74, 0, 79, 74,
  72, 0, 76, 0, 72, 0, 0, 0,
];
// [bass root, bass fifth, pluck chord] per half bar
const HARMONY = [
  [48, [64, 67, 72]], [55, [64, 67, 72]], //  C
  [45, [64, 69, 72]], [52, [64, 69, 72]], //  Am
  [53, [65, 69, 72]], [48, [65, 69, 72]], //  F
  [55, [62, 67, 71]], [50, [62, 67, 71]], //  G
  [48, [64, 67, 72]], [55, [64, 67, 72]], //  C
  [45, [64, 69, 72]], [52, [64, 69, 72]], //  Am
  [53, [65, 69, 72]], [55, [62, 67, 71]], //  F  G
  [48, [64, 67, 72]], [55, [64, 67, 72]], //  C
];

let g = null;
let timer = 0;
let step = 0;
let loop = 0;
let nextTime = 0;
let noise = null;
let wanted = false;

function env(node, t, peak, decay, attack = 0.004) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function voice(type, freq, t, peak, decay) {
  const o = g.ctx.createOscillator();
  const a = g.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  env(a, t, peak, decay);
  o.connect(a).connect(g.bus);
  o.start(t);
  o.stop(t + decay + 0.06);
}

/** wooden bar: a pure tone with a short bright "tock" on top */
function marimba(midi, t, vel = 1) {
  const f = hz(midi);
  voice('sine', f, t, 0.5 * vel, 0.42);
  voice('sine', f * 4, t, 0.11 * vel, 0.06);
  voice('triangle', f * 2, t, 0.05 * vel, 0.16);
}

function pluck(notes, t) {
  notes.forEach((m, i) => voice('triangle', hz(m), t + i * 0.012, 0.085, 0.2));
}

function bass(midi, t) {
  voice('triangle', hz(midi), t, 0.34, 0.3);
  voice('sine', hz(midi + 12), t, 0.1, 0.22);
}

function shaker(t, peak) {
  if (!noise) {
    noise = g.ctx.createBuffer(1, g.ctx.sampleRate * 0.25, g.ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = g.ctx.createBufferSource();
  src.buffer = noise;
  const hp = g.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const a = g.ctx.createGain();
  env(a, t, peak, 0.045, 0.002);
  src.connect(hp).connect(a).connect(g.bus);
  src.start(t);
  src.stop(t + 0.08);
}

function schedule(i, t) {
  const tune = loop % 2 === 0 ? TUNE_A : TUNE_B;
  const note = tune[i];
  if (note) marimba(note, t, i % 8 === 0 ? 1 : 0.82);
  const beat = i % 2 === 0;
  const half = Math.floor(i / 4);
  const [root, chord] = HARMONY[half];
  if (i % 4 === 0) bass(root, t);
  if (i % 4 === 2) pluck(chord, t); // off-beat strum: oom-PAH
  shaker(t, beat ? 0.035 : 0.06);
  if (i % 8 === 4) voice('sine', 1320, t, 0.05, 0.05); // soft wood-block on beat 3
}

function tick() {
  if (!g || g.ctx.state !== 'running') return;
  if (nextTime < g.ctx.currentTime) nextTime = g.ctx.currentTime + 0.06; // after a pause: pick the beat back up
  while (nextTime < g.ctx.currentTime + 0.3) {
    schedule(step, nextTime);
    nextTime += STEP;
    step += 1;
    if (step >= 64) {
      step = 0;
      loop += 1;
    }
  }
}

export const music = {
  /** Fade the tune in (does nothing until sound has been unlocked by a tap). */
  start() {
    wanted = true;
    if (timer || !canPlay()) return;
    g = musicGraph();
    if (!g) return;
    const now = g.ctx.currentTime;
    g.bus.gain.cancelScheduledValues(now);
    g.bus.gain.setValueAtTime(Math.max(0.0001, g.bus.gain.value), now);
    g.bus.gain.linearRampToValueAtTime(LEVEL, now + 1.4);
    step = 0;
    loop = 0;
    nextTime = now + 0.12;
    timer = setInterval(tick, 90);
    tick();
  },
  stop(fade = 0.6) {
    wanted = false;
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    const now = g.ctx.currentTime;
    g.bus.gain.cancelScheduledValues(now);
    g.bus.gain.setValueAtTime(g.bus.gain.value, now);
    g.bus.gain.linearRampToValueAtTime(0.0001, now + fade);
  },
  get playing() {
    return !!timer;
  },
  /** true if the page asked for music, even if the browser has not let it start yet */
  get wanted() {
    return wanted;
  },
};

if (import.meta.env.DEV) window.__music = music;
