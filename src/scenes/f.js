// F - fish - "The fish swims."
import { wiggle, rest } from './kit.js';

export default {
  art: ['seaweed1', 'seaweed2', 'coral', 'starfish', 'shell', 'rock'],
  backdrop: 'underwater',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    const sand = ground + 44;
    const sway = (name, x, w, dy, order) => {
      const p = S.sprite(name, { w, anchor: [0.5, 0.03], seg: 12, order }).at(x, sand + dy);
      S.loop(p, { bend: w * 0.16, duration: 2.2 + (x % 5) * 0.15 });
      return p;
    };
    sway('seaweed1', -390, 190, 0, 20);
    sway('seaweed2', 380, 200, -6, 20);
    sway('seaweed2', -250, 120, -30, 18);
    S.sprite('coral', { w: 190, anchor: [0.5, 0.03], order: 22 }).at(250, sand - 24);
    S.sprite('rock', { w: 200, anchor: [0.5, 0.1], order: 24 }).at(-150, sand - 40);
    S.sprite('starfish', { w: 110, order: 26 }).at(60, sand - 30).rot = 14;
    S.sprite('shell', { w: 100, anchor: [0.5, 0.1], order: 26 }).at(-320, sand - 50);

    const fish = S.sprite('fish', { w: 330, seg: 18, order: 60 }).at(-760, 140);
    fish.wave('tail-left', { amp: 16, freq: 0.9, power: 1.6 });
    S.each((dt, t) => { fish.wavePhase = -t * 11; });
    S.onCleanup(() => { fish.waveAmp = 5; });

    // glide in along a gentle wave
    tl.to(fish, { x: 20, duration: 2.5, ease: 'sine.out' }, 0.1);
    tl.to(fish, { y: 190, duration: 0.65, ease: 'sine.inOut' }, 0.1);
    tl.to(fish, { y: 70, duration: 0.7, ease: 'sine.inOut' }, 0.75);
    tl.to(fish, { y: 150, duration: 0.6, ease: 'sine.inOut' }, 1.45);
    tl.to(fish, { y: 110, duration: 0.55, ease: 'sine.inOut' }, 2.05);
    tl.to(fish, { rot: 9, duration: 0.6, ease: 'sine.inOut' }, 0.1);
    tl.to(fish, { rot: -9, duration: 0.7, ease: 'sine.inOut' }, 0.75);
    tl.to(fish, { rot: 7, duration: 0.6, ease: 'sine.inOut' }, 1.45);
    tl.to(fish, { rot: 0, duration: 0.55, ease: 'sine.inOut' }, 2.05);
    tl.call(() => sfx.swish(), null, 0.2);
    S.say(0.85);
    for (const t of [0.6, 1.3, 2.0]) {
      tl.call(() => { fx.bubbles(fish.x + 150, fish.y + 20, 3, { size: 30 }); sfx.drip(); }, null, t);
    }

    // a happy little twirl
    const T = 2.75;
    tl.to(fish, { waveAmp: 30, duration: 0.2 }, T);
    wiggle(tl, fish, T, 10, 4, 0.11);
    tl.to(fish, { y: 150, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, T);
    tl.call(() => { fx.bubbles(fish.x + 140, fish.y + 30, 7, { spreadX: 80, size: 36 }); sfx.sparkle(); }, null, T + 0.1);
    tl.to(fish, { waveAmp: 12, duration: 0.5 }, T + 0.55);
    rest(tl, 1.5);
  },
};
