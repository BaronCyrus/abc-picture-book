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
 * @returns { tier: 'excellent' | 'great' | 'good' | 'again', score: 0..1 }
 */
export function grade(attempt, model) {
  if (attempt.peak < -50 || attempt.voiced < 0.16 || attempt.snr < 8) return { tier: 'again', score: 0 };
  // small children speak slowly; be generous with length
  const ratio = attempt.span / Math.max(0.2, model.span);
  const lengthScore = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(2.8));
  const beatDiff = Math.abs(attempt.beats - model.beats);
  const beatScore = beatDiff === 0 ? 1 : beatDiff === 1 ? 0.6 : 0.25;
  const clarity = Math.min(1, Math.max(0, (attempt.snr - 10) / 18));
  const score = 0.45 * lengthScore + 0.35 * beatScore + 0.2 * clarity;
  const tier = score >= 0.7 ? 'excellent' : score >= 0.45 ? 'great' : 'good';
  return { tier, score };
}
