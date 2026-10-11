// T - teddy - "Hug the teddy."
import { shapes } from '../gl/shapes.js';
import { wiggle, rest } from './kit.js';

export default {
  art: [],
  kid: true,
  backdrop: (P) => P.room('#fde3e6', '#e9b98c', '#d8a474'),
  build(S) {
    const { tl, fx, sfx, ground } = S;
    S.paper(shapes.ellipse('#3f93d6', 512, 150), { w: 660, order: 5, shadow: { alpha: 0.18 } }).at(20, ground - 4);
    S.paper(shapes.ellipse('#a9d2f1', 512, 150), { w: 490, order: 6, shadow: false }).at(20, ground - 4);

    const kid = S.kid({ height: 480 }).at(-640, ground);
    const teddy = S.sprite('teddy', { w: 250, anchor: [0.5, 0.04], seg: 8, order: 60 }).at(130, ground - 2);
    S.loop(teddy, { rot: 3, duration: 1.2 });

    // there's teddy!
    kid.walk(tl, 0.1, -120, 1.2, { steps: 4 });
    tl.call(() => { kid.face = 'c'; }, null, 0.9);
    tl.to(kid.j, { armL: 78, foreL: 20, armR: 78, foreR: 20, head: 8, duration: 0.35, ease: 'back.out(1.8)' }, 1.35);
    wiggle(tl, teddy, 1.3, 8, 3, 0.1);

    // teddy hops into open arms
    const T = 1.85;
    tl.to(teddy, { x: -118, duration: 0.42, ease: 'sine.inOut' }, T);
    tl.to(teddy, { y: ground + 210, duration: 0.22, ease: 'power2.out' }, T);
    tl.to(teddy, { y: ground + 118, duration: 0.2, ease: 'power2.in' }, T + 0.22);
    tl.to(teddy.scale, { x: 0.9, y: 0.9, duration: 0.42 }, T);
    tl.call(() => { sfx.boing(); teddy.order = kid.baseOrder + 7; }, null, T);
    S.say(T + 0.2);

    // squeeeeze
    const H = T + 0.42;
    tl.to(kid.j, { armL: 30, foreL: -96, armR: 30, foreR: -96, head: 12, duration: 0.28, ease: 'back.out(2)' }, H);
    tl.call(() => { kid.face = 'b'; sfx.pop(0.8); }, null, H + 0.1);
    tl.to(teddy.scale, { x: 1.0, y: 0.82, duration: 0.12, ease: 'power2.out' }, H + 0.08);
    tl.to(teddy.scale, { x: 0.92, y: 0.9, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, H + 0.2);
    tl.to(kid.scale, { x: 1.04, y: 0.96, duration: 0.12, ease: 'power2.out' }, H + 0.08);
    tl.to(kid.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, H + 0.2);
    tl.call(() => fx.hearts(-118, ground + 360, 6, { size: 50 }), null, H + 0.25);
    tl.call(() => sfx.sparkle(), null, H + 0.3);

    // rocking side to side
    const E = H + 0.9;
    for (let i = 0; i < 4; i++) {
      tl.to(kid.j, { lean: i % 2 ? -5 : 5, head: i % 2 ? 6 : 14, duration: 0.34, ease: 'sine.inOut' }, E + i * 0.34);
      tl.to(teddy, { rot: i % 2 ? -6 : 6, x: -118 + (i % 2 ? -12 : 12), duration: 0.34, ease: 'sine.inOut' }, E + i * 0.34);
    }
    tl.to(kid.j, { lean: 0, head: 10, duration: 0.3, ease: 'sine.inOut' }, E + 1.36);
    tl.to(teddy, { rot: 0, x: -118, duration: 0.3, ease: 'sine.inOut' }, E + 1.36);
    tl.call(() => fx.hearts(-118, ground + 380, 4, { size: 44 }), null, E + 0.7);
    rest(tl, 0.9);
  },
};
