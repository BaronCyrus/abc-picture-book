// C - cat - "Pat the cat."
import { shapes } from '../gl/shapes.js';
import { rest } from './kit.js';

export default {
  art: [],
  kid: true,
  backdrop: (P) => P.room('#f8dcc8', '#d9a066'),
  build(S) {
    const { tl, fx, sfx, ground } = S;
    S.paper(shapes.ellipse('#e8705a', 512, 150), { w: 640, order: 5, shadow: { alpha: 0.18 } }).at(40, ground - 2);
    S.paper(shapes.ellipse('#f6c15c', 512, 150), { w: 470, order: 6, shadow: false }).at(40, ground - 2);

    const cat = S.sprite('cat', { w: 240, anchor: [0.5, 0.02], seg: 8, order: 50 }).at(110, ground - 4);
    S.loop(cat.scale, { y: 1.025, duration: 1.3 });

    const kid = S.kid({ height: 430 }).at(-620, ground);
    kid.walk(tl, 0.1, -70, 1.3, { steps: 4 });
    tl.to(cat, { rot: -5, duration: 0.3, ease: 'sine.inOut' }, 1.0);
    tl.to(cat, { rot: 0, duration: 0.3, ease: 'sine.inOut' }, 1.5);

    // reach over ...
    const T = 1.75;
    tl.to(kid.j, { armR: 124, foreR: 34, lean: 4, head: 8, duration: 0.45, ease: 'back.out(1.4)' }, T - 0.3);
    S.say(T);
    // ... and pat, pat, pat
    for (let i = 0; i < 3; i++) {
      const t = T + 0.15 + i * 0.42;
      tl.to(kid.j, { armR: 112, foreR: 30, duration: 0.14, ease: 'power2.out' }, t);
      tl.to(kid.j, { armR: 124, foreR: 34, duration: 0.24, ease: 'sine.inOut' }, t + 0.14);
      tl.to(cat.scale, { y: 0.95, x: 1.03, duration: 0.1, ease: 'power2.out' }, t + 0.04);
      tl.to(cat.scale, { y: 1, x: 1, duration: 0.26, ease: 'sine.out' }, t + 0.14);
      tl.call(() => sfx.tap(), null, t + 0.06);
      tl.to(cat, { rot: i % 2 ? -3 : 3, duration: 0.2, ease: 'sine.inOut' }, t);
    }
    tl.call(() => { kid.face = 'b'; fx.hearts(120, 70, 5, { size: 46 }); sfx.sparkle(); }, null, T + 0.75);
    tl.to(kid.j, { armR: 116, foreR: 32, head: 10, duration: 0.3, ease: 'sine.out' }, T + 1.45);
    tl.to(cat, { rot: 4, duration: 0.4, ease: 'sine.inOut' }, T + 1.45);
    tl.call(() => fx.hearts(140, 90, 3, { size: 40 }), null, T + 1.6);
    rest(tl, 1.4);
  },
};
