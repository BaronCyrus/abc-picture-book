// K - kite - "Fly a kite."
import { clouds, plants, rest, worldPos } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_r'],
  kid: true,
  backdrop: 'meadow',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S, [[-360, 300, 230], [60, 460, 170], [400, 180, 200]], 2.4);
    const greens = plants(S, [['grass', 300, 170, 29], ['grass', -420, 150, 29], ['flower_r', 420, 64, 31, -8]]);
    greens.forEach((g) => S.loop(g, { bend: 26, duration: 0.9 }));

    const kid = S.kid({ height: 430 }).at(-250, ground);
    kid.j.armR = 70;
    kid.j.foreR = 40;

    const kite = S.sprite('kite', { w: 250, anchor: [0.5, 0.62], seg: 20, order: 80 }).at(-110, -150);
    kite.rot = -24;
    kite.wave('hang', { amp: 0, freq: 1.3, top: 0.5, power: 1.2 });
    const line = S.rope({ color: '#fffaf0', width: 4, order: 79 });
    const follow = (dt, t) => {
      const hand = worldPos(kid.handR);
      line.set(hand.x, hand.y, kite.x, kite.y - 20, 30 + (kite.y + 150) * 0.12);
      kite.wavePhase = -(t || 0) * 9;
    };
    S.each(follow);
    follow(0, 0);

    // a gust of wind ...
    tl.call(() => sfx.whoosh(0, 0.3), null, 0.25);
    tl.call(() => fx.puffs(-460, 0, 4, { vx: 520, vy: 30, size: 60, alpha: 0.6 }), null, 0.25);
    tl.to(kid.j, { head: 8, duration: 0.3 }, 0.3);
    tl.to(kite, { waveAmp: 26, duration: 0.5 }, 0.3);

    // ... and up it goes
    const T = 0.75;
    S.say(T + 0.1);
    tl.call(() => { kid.face = 'c'; }, null, T);
    tl.to(kite, { x: 190, y: 330, duration: 1.9, ease: 'power2.out' }, T);
    tl.to(kite, { rot: 16, duration: 0.5, ease: 'sine.inOut' }, T);
    tl.to(kite, { rot: -12, duration: 0.5, ease: 'sine.inOut' }, T + 0.5);
    tl.to(kite, { rot: 10, duration: 0.5, ease: 'sine.inOut' }, T + 1.0);
    tl.to(kite, { rot: -4, duration: 0.5, ease: 'sine.inOut' }, T + 1.5);
    tl.to(kid.j, { armR: 132, foreR: 22, armL: 46, foreL: 26, head: 12, duration: 1.0, ease: 'power2.out' }, T);
    kid.walk(tl, T + 0.2, -190, 1.0, { steps: 3, swing: false, hop: 10 });
    tl.call(() => sfx.slide(true), null, T + 0.1);

    // dancing in the sky
    const E = T + 2.0;
    tl.to(kite, { x: 150, y: 350, rot: 8, duration: 0.6, ease: 'sine.inOut' }, E);
    tl.to(kite, { x: 200, y: 330, rot: -6, duration: 0.6, ease: 'sine.inOut' }, E + 0.6);
    tl.to(kid, { lift: 30, duration: 0.16, ease: 'sine.out', yoyo: true, repeat: 3 }, E);
    tl.call(() => { sfx.chime(); fx.sparkle(180, 340, 12, { spread: 340, size: 44 }); }, null, E + 0.1);
    tl.to(kite, { waveAmp: 14, duration: 0.5 }, E + 0.8);
    rest(tl, 0.9);
  },
};
