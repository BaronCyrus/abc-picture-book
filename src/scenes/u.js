// U - umbrella - "Open the umbrella."
import { rand } from '../core/util.js';
import { shapes } from '../gl/shapes.js';
import { plants, rest } from './kit.js';

export default {
  art: ['umbrella_closed', 'cloud1', 'cloud2', 'bush', 'grass', 'flower_r'],
  kid: true,
  backdrop: 'rainy',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    plants(S, [['bush', -420, 200], ['grass', 420, 150, 29], ['flower_r', 320, 60, 31, -8]]).forEach((p) => p.tint(0.82, 0.86, 0.9));
    for (const [n, x, y, w] of [['cloud1', -200, 420, 360], ['cloud2', 230, 450, 320]]) {
      S.sprite(n, { w, order: -940, shadow: { alpha: 0.14 } }).at(x, y).tint(0.72, 0.75, 0.84);
    }

    const kid = S.kid({ height: 450 }).at(-30, ground);
    kid.j.armR = 92;
    kid.j.foreR = 62;
    kid.j.head = -6;
    // both umbrellas ride in the same hand; only one is visible at a time
    const closed = S.sprite('umbrella_closed', { w: 150, anchor: [0.5, 0.09] });
    const open = S.sprite('umbrella', { w: 760, anchor: [0.5, 0.07], seg: 10 });
    kid.give('R', closed, { order: 7.4 });
    kid.give('R', open, { order: 9.5, x: -40 });
    open.opacity = 0;
    open.scale.set(0.2, 0.5, 1);

    // drip, drip, drip on the head
    const drip = () => {
      const x = -30 + rand(-70, 70);
      fx.emit({ tex: shapes.drop('#bfe0f7'), x, y: ground + 520, vy: -900, life: 0.34, size: 22, alpha: 0.9 });
    };
    for (let i = 0; i < 5; i++) {
      tl.call(drip, null, 0.15 + i * 0.2);
      tl.call(() => sfx.drip(), null, 0.45 + i * 0.2);
    }
    tl.to(kid.j, { head: -10, duration: 0.2, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0.4);
    tl.to(kid.scale, { y: 0.97, duration: 0.1, yoyo: true, repeat: 5 }, 0.45);

    // whoosh - open!
    const T = 1.45;
    S.say(T - 0.2);
    tl.to(kid.j, { armR: 104, foreR: 58, duration: 0.2, ease: 'power2.out' }, T - 0.15);
    tl.call(() => { closed.opacity = 0; open.opacity = 1; sfx.whoosh(); sfx.pop(0.8, 0.12); }, null, T);
    tl.to(open.scale, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.38)' }, T);
    tl.call(() => { kid.face = 'c'; }, null, T + 0.15);
    tl.to(kid.j, { head: 6, armL: 40, foreL: 26, duration: 0.4, ease: 'back.out(1.6)' }, T + 0.15);
    tl.to(kid, { lift: 26, duration: 0.14, ease: 'sine.out', yoyo: true, repeat: 1 }, T + 0.1);

    // now the rain bounces off
    const splash = () => {
      const x = -30 + rand(-170, 190);
      const y = ground + 470 - Math.abs(x + 30) * 0.5;
      fx.drops(x, y, 2, { color: '#d6ecfb', power: 190, cone: 110, size: 15, g: 700 });
    };
    for (let i = 0; i < 16; i++) tl.call(splash, null, T + 0.4 + i * 0.13);
    for (let i = 0; i < 6; i++) tl.call(() => sfx.drip(), null, T + 0.45 + i * 0.3);
    tl.to(kid.j, { lean: 4, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 3 }, T + 0.6);
    tl.call(() => { sfx.chime(); fx.sparkle(-30, ground + 300, 8, { spread: 300, size: 40 }); }, null, T + 1.3);
    rest(tl, 2.2);
  },
};
