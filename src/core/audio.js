// Web Audio: narration clips + a handful of soft synthesised sound effects.
// Everything is created lazily; the context can only start after a user gesture.
import { BASE } from './util.js';

let ctx = null;
let master = null;
let voiceBus = null;
let sfxBus = null;
let musicBus = null;
let unlocked = false;
let currentVoice = null;
const buffers = new Map();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 0.95;
  master.connect(ctx.destination);
  voiceBus = ctx.createGain();
  voiceBus.gain.value = 1.0;
  voiceBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.5;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  return ctx;
}

/** The context and the (initially silent) bus that background music plays into. */
export function musicGraph() {
  return ensure() ? { ctx, bus: musicBus } : null;
}

/** True once sound can actually be heard. */
export const canPlay = () => !!ctx && unlocked && ctx.state === 'running';

/**
 * Call from inside a pointer/keyboard handler. Safe to call repeatedly.
 * Resolves once sound can really be heard (or after a short wait if it cannot).
 */
export function unlock() {
  if (!ensure()) return Promise.resolve(false);
  // iOS: keep Web Audio audible even when the ringer switch is on silent.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* not supported */
  }
  const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(() => {});
  if (!unlocked) {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
    unlocked = true;
  }
  return Promise.race([resumed, new Promise((res) => setTimeout(res, 500))]).then(() => canPlay());
}

for (const ev of ['pointerdown', 'touchend', 'keydown']) {
  window.addEventListener(ev, unlock, { capture: true, passive: true });
}

document.addEventListener('visibilitychange', () => {
  if (!ctx || !unlocked) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

export function load(path) {
  const url = BASE + path;
  if (!buffers.has(url)) {
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.arrayBuffer();
      })
      .then((data) => {
        ensure();
        return new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
      })
      .catch((err) => {
        buffers.delete(url);
        console.warn('[audio] failed', url, err);
        return null;
      });
    buffers.set(url, p);
  }
  return buffers.get(url);
}

export function stopVoice() {
  if (!currentVoice) return;
  const v = currentVoice;
  currentVoice = null;
  try {
    v.gain.gain.cancelScheduledValues(ctx.currentTime);
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    v.src.stop(ctx.currentTime + 0.08);
  } catch {
    /* already stopped */
  }
  v.cancelled = true;
}

/**
 * Plays a narration clip, replacing any clip already playing.
 * Resolves to a handle { duration, time(), done } or null if sound is unavailable.
 */
export async function playVoice(path, { onEnd } = {}) {
  const buf = await load(path);
  if (!buf || !canPlay()) return null;
  stopVoice();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  src.connect(gain).connect(voiceBus);
  const t0 = ctx.currentTime + 0.02;
  src.start(t0);
  const handle = {
    src,
    gain,
    duration: buf.duration,
    cancelled: false,
    time: () => ctx.currentTime - t0,
    done: null,
  };
  handle.done = new Promise((res) => {
    src.onended = () => {
      if (currentVoice === handle) currentVoice = null;
      if (!handle.cancelled && onEnd) onEnd();
      res(!handle.cancelled);
    };
  });
  currentVoice = handle;
  return handle;
}

// ---------------------------------------------------------------- sfx ----

function env(gainNode, t, attack, decay, peak) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.2, peak = 0.3, attack = 0.006, at = 0, curve = 'exp' }) {
  if (!canPlay()) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) {
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    else osc.frequency.linearRampToValueAtTime(f1, t + dur);
  }
  env(g, t, attack, dur, peak);
  osc.connect(g).connect(sfxBus);
  osc.start(t);
  osc.stop(t + attack + dur + 0.05);
}

let noiseBuf = null;
function noise({ dur = 0.3, f0 = 600, f1 = 2400, q = 0.9, peak = 0.25, at = 0, type = 'bandpass' }) {
  if (!canPlay()) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, t);
  filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, dur * 0.35, dur * 0.65, peak);
  src.connect(filt).connect(g).connect(sfxBus);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// C major pentatonic, two and a half octaves: pleasant in any order.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const noteFreq = (i) => 261.63 * Math.pow(2, SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length] / 12);

export const sfx = {
  /** soft bubble pop */
  pop(pitch = 1, at = 0) {
    tone({ f0: 560 * pitch, f1: 190 * pitch, dur: 0.11, peak: 0.45, at });
  },
  tap(at = 0) {
    tone({ type: 'triangle', f0: 880, f1: 660, dur: 0.06, peak: 0.25, at });
  },
  /** marimba-like note on a pentatonic scale */
  note(i, at = 0, peak = 0.35) {
    const f = noteFreq(i);
    tone({ f0: f, dur: 0.38, peak, at });
    tone({ f0: f * 4, dur: 0.07, peak: peak * 0.25, at });
  },
  boing(at = 0) {
    tone({ f0: 170, f1: 420, dur: 0.16, peak: 0.4, at, curve: 'lin' });
    tone({ f0: 420, f1: 250, dur: 0.22, peak: 0.25, at: at + 0.13, curve: 'lin' });
  },
  whoosh(at = 0, peak = 0.22) {
    noise({ dur: 0.34, f0: 500, f1: 2600, peak, at });
  },
  swish(at = 0) {
    noise({ dur: 0.2, f0: 2400, f1: 700, peak: 0.16, at });
  },
  sparkle(at = 0) {
    [14, 16, 19, 21].forEach((n, k) => tone({ f0: noteFreq(n) * 2, dur: 0.22, peak: 0.16, at: at + k * 0.055 }));
  },
  chime(at = 0) {
    [5, 7, 8, 10].forEach((n, k) => {
      tone({ f0: noteFreq(n), dur: 0.5, peak: 0.26, at: at + k * 0.09 });
      tone({ f0: noteFreq(n) * 2, dur: 0.25, peak: 0.08, at: at + k * 0.09 });
    });
  },
  thud(at = 0) {
    tone({ f0: 150, f1: 55, dur: 0.16, peak: 0.55, at });
  },
  splash(at = 0) {
    noise({ dur: 0.42, f0: 1800, f1: 500, peak: 0.3, at, q: 0.6 });
    tone({ f0: 320, f1: 120, dur: 0.14, peak: 0.25, at });
  },
  crack(at = 0) {
    noise({ dur: 0.07, f0: 3200, f1: 1500, peak: 0.4, at, q: 2 });
  },
  drip(at = 0) {
    tone({ f0: 900, f1: 1500, dur: 0.07, peak: 0.2, at, curve: 'lin' });
  },
  slide(up = true, at = 0) {
    tone({ type: 'triangle', f0: up ? 330 : 660, f1: up ? 660 : 330, dur: 0.22, peak: 0.2, at, curve: 'lin' });
  },
  /** low friendly rumble (lion, van) */
  rumble(at = 0, dur = 0.7) {
    if (!canPlay()) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.linearRampToValueAtTime(130, t + dur * 0.4);
    osc.frequency.linearRampToValueAtTime(80, t + dur);
    lfo.frequency.value = 26;
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(osc.frequency);
    filt.type = 'lowpass';
    filt.frequency.value = 520;
    env(g, t, dur * 0.25, dur * 0.75, 0.32);
    osc.connect(filt).connect(g).connect(sfxBus);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  },
};

if (import.meta.env.DEV) {
  window.__audio = {
    canPlay,
    state: () => ctx?.state,
    playing: () => !!currentVoice,
    /** record what the page is playing for `sec` seconds; resolves to a base64 webm (for offline analysis) */
    async record(sec) {
      const dest = ctx.createMediaStreamDestination();
      master.connect(dest);
      const rec = new MediaRecorder(dest.stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      await new Promise((r) => setTimeout(r, sec * 1000));
      const stopped = new Promise((r) => { rec.onstop = r; });
      rec.stop();
      await stopped;
      master.disconnect(dest);
      const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    },
  };
}
