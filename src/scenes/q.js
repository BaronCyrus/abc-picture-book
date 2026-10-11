// Q - queen - "Here comes the queen."
import { shapes } from '../gl/shapes.js';
import { trot, squash, rest } from './kit.js';

export default {
  art: [],
  kid: true,
  backdrop: (P) => P.room('#e6dcf6', '#c9a7e0', '#b790d3'),
  build(S) {
    const { tl, fx, sfx, ground } = S;
    // red carpet with golden trim
    S.paper(shapes.rect('#e2b53a', 512, 96, 6), { w: 1500, order: 4, shadow: { alpha: 0.16 } }).at(0, ground - 14);
    S.paper(shapes.rect('#d6453c', 512, 80, 4), { w: 1500, order: 5, shadow: false }).at(0, ground - 14);

    const kid = S.kid({ height: 400 }).at(-290, ground + 4);
    kid.j.head = 8;

    const queen = S.sprite('queen', { w: 320, anchor: [0.5, 0.02], seg: 6, order: 60 }).at(760, ground - 6);

    // ta-ta-taa!
    tl.call(() => { sfx.note(5); sfx.note(7, 0.14); sfx.note(9, 0.28); sfx.note(12, 0.42, 0.4); }, null, 0.15);
    tl.call(() => { kid.face = 'c'; }, null, 0.4);
    tl.to(kid.j, { head: 12, duration: 0.3 }, 0.4);

    // here she comes, step by royal step
    S.say(0.8);
    trot(tl, queen, 0.6, 110, 2.1, { hops: 6, height: 14, rock: 2.5 });
    for (let i = 0; i < 6; i++) {
      tl.call(() => fx.sparkle(queen.x + 60, ground + 60, 3, { spread: 120, size: 26 }), null, 0.75 + i * 0.35);
    }
    // the child waves
    tl.to(kid.j, { armL: 150, foreL: 20, duration: 0.3, ease: 'back.out(1.8)' }, 1.0);
    for (let i = 0; i < 5; i++) {
      tl.to(kid.j, { foreL: i % 2 ? 26 : -22, duration: 0.2, ease: 'sine.inOut' }, 1.3 + i * 0.2);
    }

    // a graceful curtsy and a shower of confetti
    const E = 2.85;
    squash(tl, queen, E, 0.07, 0.7);
    tl.to(queen, { rot: 5, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, E);
    tl.call(() => {
      sfx.chime();
      fx.confetti(110, ground + 300, 30, { power: 560 });
      fx.sparkle(110, ground + 400, 10, { spread: 260, size: 40 });
    }, null, E + 0.1);
    tl.to(kid.j, { lean: 10, head: 16, armL: 30, foreL: 20, duration: 0.4, ease: 'sine.inOut' }, E + 0.1);
    tl.to(kid.j, { lean: 0, head: 8, armL: 120, foreL: 30, duration: 0.4, ease: 'back.out(1.6)' }, E + 0.8);
    rest(tl, 1.5);
  },
};
