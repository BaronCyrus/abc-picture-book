// Hold-to-talk recording for the follow-read button. Everything stays in memory on
// the device: the microphone is opened when the button is pressed and released
// (tracks stopped) as soon as it is let go, so iOS switches playback back to the
// loudspeaker and the "recording" indicator disappears.
import { context } from './audio.js';

const WORKLET = `
class AbcCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('abc-capture', AbcCapture);
`;

let workletReady = null;

function setSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {
    /* not supported */
  }
}

export const micSupported = () =>
  !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!(window.AudioContext || window.webkitAudioContext);

/**
 * Opens the microphone and starts capturing.
 * Resolves to { level(), stop() } or throws (permission denied, no device ...).
 */
export async function startRecording() {
  const ctx = context();
  if (!ctx) throw new Error('no audio');
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  setSession('play-and-record');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (err) {
    setSession('playback');
    throw err;
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const probe = new Float32Array(analyser.fftSize);

  const chunks = [];
  let node;
  if (ctx.audioWorklet && window.AudioWorkletNode) {
    if (!workletReady) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      workletReady = ctx.audioWorklet.addModule(url);
    }
    await workletReady;
    node = new AudioWorkletNode(ctx, 'abc-capture');
    node.port.onmessage = (e) => chunks.push(e.data);
  } else {
    node = ctx.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  }
  // The capture node must be pulled by the graph to run; route it into silence.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute).connect(ctx.destination);
  const started = performance.now();

  return {
    /** current input loudness 0..1 (for the pulsing rings) */
    level() {
      analyser.getFloatTimeDomainData(probe);
      let s = 0;
      for (let i = 0; i < probe.length; i++) s += probe[i] * probe[i];
      return Math.min(1, Math.sqrt(s / probe.length) * 6);
    },
    elapsed: () => (performance.now() - started) / 1000,
    async stop() {
      // let the last block arrive
      await new Promise((r) => setTimeout(r, 120));
      try {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
        if (node.port) node.port.onmessage = null;
      } catch {
        /* already gone */
      }
      for (const t of stream.getTracks()) t.stop();
      setSession('playback');
      let n = 0;
      for (const c of chunks) n += c.length;
      const pcm = new Float32Array(n);
      let o = 0;
      for (const c of chunks) {
        pcm.set(c, o);
        o += c.length;
      }
      return { pcm, sampleRate: ctx.sampleRate };
    },
  };
}
