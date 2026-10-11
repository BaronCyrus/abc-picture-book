// I - ice cream - "I like ice cream."
import { clouds, plants, rest, worldPos } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'flower_r', 'flower_y'],
  kid: true,
  backdrop: (P) => {
    const c = P.park();
    c.sky.glow = { x: -320, y: 420, r: 560, a: 0.8, color: '#fff7c2' };
    return c;
  },
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S, [[300, 410, 230], [-60, 450, 170]]);
    plants(S, [['bush', -420, 210], ['flower_r', 380, 66, 31, -8], ['flower_y', 300, 58, 31, -14]]);

    const kid = S.kid({ height: 480 }).at(-20, ground);
    const cone = S.sprite('icecream', { w: 240, anchor: [0.5, 0.2] });
    kid.j.armR = 62;
    kid.j.foreR = 62;
    kid.give('R', cone, { order: 7.5 });

    // look at that!
    tl.to(kid.j, { head: 9, duration: 0.3, ease: 'sine.out' }, 0.2);
    tl.call(() => { kid.face = 'c'; sfx.sparkle(); }, null, 0.3);
    tl.call(() => { const p = worldPos(cone); fx.sparkle(p.x, p.y + 90, 7, { spread: 220, size: 36 }); }, null, 0.3);
    tl.to(kid, { lift: 24, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.out' }, 0.3);

    // lick ... lick ...
    const T = 0.95;
    S.say(T + 0.05);
    for (let i = 0; i < 2; i++) {
      const t = T + i * 1.05;
      kid.carry(tl, 'R', cone, 0, -80, 0.34, t, 'power2.inOut', -6);
      tl.to(kid.j, { head: 6, duration: 0.3, ease: 'sine.out' }, t);
      tl.call(() => { kid.face = 'b'; sfx.slide(true); }, null, t + 0.3);
      tl.to(kid.j, { head: 5, duration: 0.2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, t + 0.34);
      tl.call(() => fx.hearts(40, 190, 2, { size: 40 }), null, t + 0.42);
      kid.carry(tl, 'R', cone, 46, 84, 0.3, t + 0.72, 'power2.inOut', 0);
      tl.call(() => { kid.face = 'c'; }, null, t + 0.78);
    }

    // yum!
    const E = T + 2.2;
    kid.carry(tl, 'R', cone, 128, 30, 0.45, E, 'back.out(1.7)', 0);
    tl.to(kid.j, { armL: 120, foreL: 34, head: -5, duration: 0.45, ease: 'back.out(1.7)' }, E);
    tl.to(kid, { lift: 44, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, E);
    tl.call(() => {
      const p = worldPos(cone);
      sfx.chime();
      fx.sparkle(p.x, p.y + 60, 12, { spread: 340, size: 46 });
      fx.hearts(0, 200, 4, { size: 46 });
    }, null, E + 0.2);
    rest(tl, 1.3);
  },
};
