// A gentle, on-device check of a child's attempt at a word. This is NOT a
// pronunciation assessment: it listens for a real, clear attempt whose length
// and rhythm (number of syllable beats) resemble the model reading, and turns
// that into an encouraging tier. Anyone who says something gets at least "good";
// only silence or a very short noise asks to "try again".

const FRAME = 0.02; // seconds
const HOP = 0.01;

/** Loudness envelope in dBFS, one value per 10 ms. */
function envelope(pcm, sr) {
  const win = Math.round(sr * FRAME);
  const hop = Math.round(sr * HOP);
  const out = [];
  for (let i = 0; i + win <= pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += pcm[j] * pcm[j];
    out.push(10 * Math.log10(s / win + 1e-10));
  }
  return out;
}

function percentile(arr, p) {
  if (!arr.length) return -100;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

/**
 * Features of one utterance.
 * @returns { voiced: seconds of voice, peak: dBFS, snr: dB, beats: syllable-like peaks }
 */
export function analyse(pcm, sr) {
  const env = envelope(pcm, sr);
  if (env.length < 5) return { voiced: 0, peak: -100, snr: 0, beats: 0, span: 0, from: 0, to: 0 };
  const peak = Math.max(...env);
  const floor = Math.min(percentile(env, 0.1), peak - 12);
  const thr = Math.max(floor + 9, peak - 22, -52);
  const on = env.map((v) => v > thr);
  // fill tiny gaps (< 60 ms) so one word is one stretch
  for (let i = 1; i < on.length - 6; i++) {
    if (!on[i] && on[i - 1]) {
      let j = i;
      while (j < on.length && !on[j] && j - i < 6) j++;
      if (j < on.length && on[j] && j - i < 6) for (let k = i; k < j; k++) on[k] = true;
    }
  }
  const voicedFrames = on.filter(Boolean).length;
  const first = on.indexOf(true);
  const last = on.lastIndexOf(true);
  // syllable beats: local maxima of a smoothed envelope that stand out by 5 dB
  const sm = env.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i - 4); k <= Math.min(env.length - 1, i + 4); k++) {
      s += env[k];
      c++;
    }
    return s / c;
  });
  let beats = 0;
  let lastBeat = -100;
  let valley = Infinity;
  for (let i = 1; i < sm.length - 1; i++) {
    valley = Math.min(valley, sm[i]);
    if (on[i] && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && sm[i] - valley > 5 && i - lastBeat > 12) {
      beats++;
      lastBeat = i;
      valley = sm[i];
    }
  }
  return {
    voiced: voicedFrames * HOP,
    span: first >= 0 ? (last - first + 1) * HOP : 0,
    /** where the voice starts / ends in the recording (seconds), for playback */
    from: first >= 0 ? first * HOP : 0,
    to: last >= 0 ? (last + 1) * HOP + FRAME : 0,
    peak,
    snr: peak - floor,
    beats: Math.max(beats, voicedFrames > 0 ? 1 : 0),
  };
}

/**
 * Compare an attempt with the model reading.
 * @param rank where the target word placed among all 26 words (1 = sounds most like it),
 *             or 0 when unknown (templates not loaded)
 * @returns { tier: 'excellent' | 'great' | 'good' | 'again', score: 0..1 }
 */
export function grade(attempt, model, rank = 0) {
  if (attempt.peak < -50 || attempt.voiced < 0.16 || attempt.snr < 8) return { tier: 'again', score: 0 };
  // small children speak slowly; be generous with length
  const ratio = attempt.span / Math.max(0.2, model.span);
  const lengthScore = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(2.8));
  const beatDiff = Math.abs(attempt.beats - model.beats);
  const beatScore = beatDiff === 0 ? 1 : beatDiff === 1 ? 0.6 : 0.25;
  const clarity = Math.min(1, Math.max(0, (attempt.snr - 10) / 18));
  let score;
  if (rank > 0) {
    // mostly "was it this word?"; length, rhythm and clarity break the ties
    const content = rank === 1 ? 1 : rank <= 3 ? 0.85 : rank <= 8 ? 0.5 : 0.15;
    score = 0.6 * content + 0.2 * lengthScore + 0.1 * beatScore + 0.1 * clarity;
  } else {
    score = 0.45 * lengthScore + 0.35 * beatScore + 0.2 * clarity;
  }
  const tier = score >= 0.72 ? 'excellent' : score >= 0.45 ? 'great' : 'good';
  return { tier, score };
}

// ------------------------------------------------- "which word was it?" ----
// Spectral fingerprints (MFCC) compared with dynamic time warping against the
// model readings of all 26 words. The same functions build the templates offline
// (tools/templates.mjs), so features are computed identically on both sides.

const SR16 = 16000;
const NFFT = 512;
const NMEL = 26;
const NCEP = 12;

/** Linear-interpolation resample to 16 kHz. */
export function to16k(pcm, sr) {
  if (sr === SR16) return pcm;
  const ratio = sr / SR16;
  const n = Math.floor(pcm.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const f = x - i0;
    out[i] = pcm[i0] * (1 - f) + (pcm[i0 + 1] ?? pcm[i0]) * f;
  }
  return out;
}

let melBank = null;
let hamming = null;
let dctM = null;
function tables() {
  if (melBank) return;
  const mel = (f) => 2595 * Math.log10(1 + f / 700);
  const hz = (m) => 700 * (10 ** (m / 2595) - 1);
  const lo = mel(60);
  const hi = mel(7600);
  const pts = Array.from({ length: NMEL + 2 }, (_, i) => hz(lo + ((hi - lo) * i) / (NMEL + 1)));
  const bin = pts.map((f) => Math.floor(((NFFT + 1) * f) / SR16));
  melBank = [];
  for (let m = 1; m <= NMEL; m++) {
    const row = new Float32Array(NFFT / 2 + 1);
    for (let k = bin[m - 1]; k < bin[m]; k++) row[k] = (k - bin[m - 1]) / Math.max(1, bin[m] - bin[m - 1]);
    for (let k = bin[m]; k < bin[m + 1]; k++) row[k] = (bin[m + 1] - k) / Math.max(1, bin[m + 1] - bin[m]);
    melBank.push(row);
  }
  hamming = Float32Array.from({ length: 400 }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / 399));
  dctM = Array.from({ length: NCEP }, (_, c) =>
    Float32Array.from({ length: NMEL }, (_, m) => Math.cos((Math.PI * (c + 1) * (m + 0.5)) / NMEL)),
  );
}

function fftPower(frame) {
  // iterative radix-2 FFT of a real frame (length NFFT), returns |X|^2 for 0..NFFT/2
  const re = new Float32Array(NFFT);
  const im = new Float32Array(NFFT);
  re.set(frame);
  for (let i = 1, j = 0; i < NFFT; i++) {
    let bit = NFFT >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
    }
  }
  for (let len = 2; len <= NFFT; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < NFFT; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
  const p = new Float32Array(NFFT / 2 + 1);
  for (let k = 0; k <= NFFT / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
  return p;
}

/** MFCC frames (12 coefficients, mean-normalised) of the voiced part of an utterance. */
export function fingerprint(pcm, sr) {
  tables();
  const a = analyse(pcm, sr);
  if (a.voiced <= 0) return [];
  const from = Math.max(0, Math.floor((a.from - 0.02) * sr));
  const to = Math.min(pcm.length, Math.ceil((a.to + 0.02) * sr));
  const x = to16k(pcm.subarray(from, to), sr);
  const frames = [];
  const buf = new Float32Array(NFFT);
  for (let s = 0; s + 400 <= x.length; s += 160) {
    buf.fill(0);
    for (let i = 0; i < 400; i++) {
      const v = x[s + i] - 0.97 * (s + i > 0 ? x[s + i - 1] : 0);
      buf[i] = v * hamming[i];
    }
    const pow = fftPower(buf);
    const logMel = new Float32Array(NMEL);
    for (let m = 0; m < NMEL; m++) {
      let e = 0;
      const row = melBank[m];
      for (let k = 0; k < row.length; k++) e += row[k] * pow[k];
      logMel[m] = Math.log(e + 1e-10);
    }
    const c = new Float32Array(NCEP);
    for (let i = 0; i < NCEP; i++) {
      let s2 = 0;
      for (let m = 0; m < NMEL; m++) s2 += dctM[i][m] * logMel[m];
      c[i] = s2;
    }
    frames.push(c);
  }
  // cepstral mean normalisation (removes most of the voice / microphone colour)
  const mean = new Float32Array(NCEP);
  for (const f of frames) for (let i = 0; i < NCEP; i++) mean[i] += f[i] / frames.length;
  return frames.map((f) => Array.from(f, (v, i) => v - mean[i]));
}

/** Length-normalised dynamic time warping distance between two fingerprints. */
export function dtw(A, B) {
  const n = A.length;
  const m = B.length;
  if (!n || !m) return Infinity;
  const band = Math.max(8, Math.ceil(Math.max(n, m) * 0.45));
  const INF = 1e18;
  let prev = new Float64Array(m + 1).fill(INF);
  let cur = new Float64Array(m + 1).fill(INF);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(INF);
    const center = (i * m) / n;
    const j0 = Math.max(1, Math.floor(center - band));
    const j1 = Math.min(m, Math.ceil(center + band));
    for (let j = j0; j <= j1; j++) {
      const a = A[i - 1];
      const b = B[j - 1];
      let d = 0;
      for (let k = 0; k < a.length; k++) {
        const t = a[k] - b[k];
        d += t * t;
      }
      d = Math.sqrt(d);
      cur[j] = d + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

/** Every other frame, rounded to quarters: what the templates store and what is compared. */
export const compact = (fp) => fp.filter((_, i) => i % 2 === 0).map((f) => f.map((x) => Math.round(x * 4) / 4));

/** templates.json stores quarter steps as integers to stay small */
export const unpackTemplates = (raw) =>
  Object.fromEntries(Object.entries(raw).map(([id, list]) => [id, list.map((fp) => fp.map((f) => f.map((v) => v / 4)))]));

/**
 * Which of the reference words sounds most like the attempt?
 * @param templates { id: [fingerprint, ...] }
 * @returns { rank: 1-based place of `target`, best: id }
 */
export function placeAmong(fp, templates, target) {
  const scores = Object.entries(templates).map(([id, list]) => [id, Math.min(...list.map((t) => dtw(fp, t)))]);
  scores.sort((x, y) => x[1] - y[1]);
  return { rank: scores.findIndex(([id]) => id === target) + 1, best: scores[0][0] };
}
