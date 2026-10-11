// J - juice - "Drink the juice."
import { shapes } from '../gl/shapes.js';
import { rest, worldPos } from './kit.js';

export default {
  art: [],
  kid: true,
  backdrop: (P) => P.room('#d9efe4', '#e2b784', '#cf9f68'),
  build(S) {
    const { tl, fx, sfx, ground } = S;
    S.paper(shapes.ellipse('#f28b30', 512, 150), { w: 620, order: 5, shadow: { alpha: 0.18 } }).at(0, ground - 4);
    S.paper(shapes.ellipse('#fbcb9c', 512, 150), { w: 450, order: 6, shadow: false }).at(0, ground - 4);

    const kid = S.kid({ height: 480 }).at(-20, ground);
    const glass = S.sprite('juice', { w: 270, anchor: [0.42, 0.3] });
    kid.j.armR = 58;
    kid.j.foreR = 64;
    kid.give('R', glass, { order: 7.5 });
    tl.to(kid.j, { head: 8, duration: 0.3 }, 0.2);
    kid.blink(tl, 0.5);

    // up to the mouth, tip, glug glug glug
    const T = 0.9;
    S.say(T);
    kid.carry(tl, 'R', glass, -4, -104, 0.4, T, 'power2.inOut', 0);
    tl.to(kid.j, { head: 4, duration: 0.3 }, T);
    tl.call(() => { kid.face = 'b'; }, null, T + 0.36);
    kid.carry(tl, 'R', glass, -6, -108, 0.3, T + 0.4, 'sine.inOut', -32);
    tl.to(kid.j, { head: -7, duration: 0.3, ease: 'sine.inOut' }, T + 0.4);
    for (let i = 0; i < 3; i++) {
      const t = T + 0.72 + i * 0.3;
      tl.call(() => sfx.drip(), null, t);
      tl.to(kid.scale, { y: 1.02, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t);
      tl.to(kid.j, { head: -10, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t);
    }

    // ahhh!
    const E = T + 1.75;
    kid.carry(tl, 'R', glass, 70, 60, 0.4, E, 'back.out(1.6)', 0);
    tl.to(kid.j, { head: 6, armL: 60, foreL: 40, duration: 0.4, ease: 'back.out(1.6)' }, E);
    tl.call(() => {
      kid.face = 'c';
      sfx.chime();
      const p = worldPos(glass);
      fx.sparkle(p.x, p.y + 60, 10, { spread: 300, size: 44 });
      fx.drops(p.x, p.y + 120, 5, { color: '#f7a531', power: 260, size: 20 });
    }, null, E + 0.15);
    tl.to(kid, { lift: 28, duration: 0.16, ease: 'sine.out', yoyo: true, repeat: 1 }, E + 0.1);
    rest(tl, 1.3);
  },
};
