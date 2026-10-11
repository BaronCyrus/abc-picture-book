// O - octopus - "The octopus waves hello."
import { wiggle, rest } from './kit.js';

export default {
  art: ['fish', 'seaweed1', 'seaweed2', 'coral', 'starfish', 'shell', 'rock'],
  backdrop: 'underwater',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    const sand = ground + 44;
    const sway = (name, x, w, dy, order) => {
      const p = S.sprite(name, { w, anchor: [0.5, 0.03], seg: 12, order }).at(x, sand + dy);
      S.loop(p, { bend: w * 0.16, duration: 2.2 + (Math.abs(x) % 5) * 0.15 });
    };
    sway('seaweed2', -410, 190, 0, 20);
    sway('seaweed1', 410, 200, -6, 20);
    S.sprite('coral', { w: 170, anchor: [0.5, 0.03], order: 22 }).at(-270, sand - 26);
    S.sprite('shell', { w: 96, anchor: [0.5, 0.1], order: 26 }).at(300, sand - 50);
    S.sprite('starfish', { w: 100, order: 26 }).at(-120, sand - 34).rot = -12;

    const octo = S.sprite('octopus', { w: 430, anchor: [0.5, 0.45], seg: 20, order: 60 }).at(-70, -720);
    octo.wave('hang', { amp: 12, freq: 1.1, top: 0.62, power: 1.1 });
    S.each((dt, t) => { octo.wavePhase = t * 4.5; });
    S.onCleanup(() => { octo.waveAmp = 6; });

    // floats up from the deep
    tl.to(octo, { y: -40, duration: 1.3, ease: 'back.out(1.2)' }, 0.15);
    tl.call(() => { sfx.slide(true); fx.bubbles(-70, -260, 6, { spreadX: 160 }); }, null, 0.3);
    S.loop(octo.scale, { y: 1.04, x: 0.97, duration: 1.1 });

    // a little fish swims by
    const fish = S.sprite('fish', { w: 190, seg: 14, order: 70 }).at(-760, 250);
    fish.wave('tail-left', { amp: 11, freq: 0.9, power: 1.6 });
    S.each((dt, t) => { fish.wavePhase = -t * 12; });
    tl.to(fish, { x: 270, y: 210, duration: 1.7, ease: 'sine.out' }, 0.9);

    // hello! hello!
    const T = 2.0;
    S.say(T - 0.15);
    tl.to(octo, { waveAmp: 34, duration: 0.25 }, T);
    wiggle(tl, octo, T, 11, 6, 0.16);
    tl.call(() => { sfx.pop(1.2); fx.hearts(-70, 200, 4, { size: 44 }); }, null, T + 0.1);
    tl.call(() => { sfx.pop(1.5); fx.bubbles(-70, 120, 6, { spreadX: 220 }); }, null, T + 0.5);
    wiggle(tl, fish, T + 0.5, 9, 4, 0.12);
    tl.to(fish, { y: 250, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, T + 0.5);
    tl.call(() => fx.bubbles(350, 230, 3, { size: 26 }), null, T + 0.7);
    tl.to(octo, { waveAmp: 14, duration: 0.6 }, T + 1.2);
    tl.call(() => sfx.sparkle(), null, T + 1.2);
    rest(tl, 1.5);
  },
};
