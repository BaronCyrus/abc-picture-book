// N - noodles - "Eat the noodles."
import { shapes } from '../gl/shapes.js';
import { rest, worldPos } from './kit.js';

export default {
  art: [],
  kid: true,
  backdrop: (P) => P.room('#ffe9c7', '#e8b98a', '#d6a271'),
  build(S) {
    const { tl, fx, sfx, ground } = S;
    const top = -232; // table top
    const kid = S.kid({ height: 480 }).at(0, ground - 8);
    kid.groundShadow.opacity = 0;
    kid.j.armL = 40;
    kid.j.foreL = -20;
    kid.j.armR = 40;
    kid.j.foreR = -20;
    kid.foreOrder('L', 45);
    kid.foreOrder('R', 45);

    S.paper(shapes.rect('#b9794a', 512, 160, 10), { w: 800, order: 118, shadow: { alpha: 0.2 } }).at(0, top - 128);
    S.paper(shapes.rect('#d99a62', 512, 56, 24), { w: 900, order: 120 }).at(0, top - 22);
    const bowl = S.sprite('noodles', { w: 290, anchor: [0.5, 0.06], order: 130 }).at(0, top - 14);
    const mouth = { x: 0, y: ground - 8 + 322 };

    // steaming hot
    const steam = (x) => fx.puffs(x, top + 170, 2, { size: 50, vy: 70, spread: 16, alpha: 0.55 });
    for (const t of [0.15, 0.7, 1.3, 3.6, 4.1]) tl.call(() => steam(-40 + (t * 97) % 80), null, t);
    tl.to(kid.j, { head: 7, duration: 0.3 }, 0.2);
    tl.call(() => { kid.face = 'c'; }, null, 0.3);

    // pick up a long noodle ...
    const noodle = S.rope({ color: '#eeb02e', width: 13, segments: 20, order: 144 });
    noodle.visible = false;
    const end = { x: 20, y: top + 150 };
    let wob = 0;
    S.each((dt, t) => {
      if (!noodle.visible) return;
      const hand = worldPos(kid.handR);
      noodle.set(hand.x - 6, hand.y, end.x, end.y, 0, Math.sin(t * 26) * wob);
    });
    const T = 0.95;
    tl.to(kid.j, { armR: 30, foreR: -70, duration: 0.3, ease: 'power2.inOut' }, T - 0.3);
    S.say(T + 0.05);
    tl.call(() => { noodle.visible = true; sfx.tap(); }, null, T);
    tl.to(kid.j, { armR: 96, foreR: 64, head: 0, duration: 0.45, ease: 'power2.out' }, T + 0.05);

    // ... and sluuurp
    const U = T + 0.7;
    tl.to(kid.j, { armR: 8, foreR: -118, duration: 0.3, ease: 'power2.inOut' }, U - 0.28);
    tl.call(() => { kid.face = 'b'; wob = 13; sfx.slide(true); sfx.slide(true, 0.22); }, null, U);
    tl.to(end, { x: mouth.x + 4, y: mouth.y - 6, duration: 0.6, ease: 'power1.in' }, U);
    tl.to(kid.j, { head: -6, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, U);
    tl.call(() => { noodle.visible = false; sfx.pop(1.5); }, null, U + 0.6);

    // chew chew - yummy!
    const C = U + 0.7;
    tl.to(kid.j, { armR: 40, foreR: -20, duration: 0.4, ease: 'sine.inOut' }, C - 0.1);
    for (let i = 0; i < 3; i++) {
      tl.to(kid.neck.scale, { y: 0.96, x: 1.03, duration: 0.11, ease: 'sine.inOut', yoyo: true, repeat: 1 }, C + i * 0.24);
    }
    tl.call(() => { kid.face = 'c'; sfx.chime(); fx.hearts(0, mouth.y + 130, 5, { size: 46 }); }, null, C + 0.75);
    tl.to(kid.j, { armL: 132, foreL: 30, armR: 132, foreR: 30, head: 6, duration: 0.4, ease: 'back.out(1.8)' }, C + 0.75);
    tl.to(kid.j, { armL: 40, foreL: -20, armR: 40, foreR: -20, head: 4, duration: 0.5, ease: 'sine.inOut' }, C + 1.6);
    rest(tl, 0.8);
  },
};
