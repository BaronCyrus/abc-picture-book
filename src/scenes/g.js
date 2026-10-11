// G - goat - "The goat eats grass."
import { clouds, plants, trot, hop, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'grass', 'bush', 'flower_y'],
  backdrop: 'meadow',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', -420, 190], ['flower_y', 420, 60, 31, -8]]);

    // three juicy tufts; the goat eats the nearest one
    const tufts = [
      S.sprite('grass', { w: 270, anchor: [0.5, 0.04], seg: 8, order: 70 }).at(170, ground - 30),
      S.sprite('grass', { w: 150, anchor: [0.5, 0.04], seg: 8, order: 30 }).at(320, ground - 22),
    ];
    tufts.forEach((g, i) => S.loop(g, { bend: 9, duration: 1.9 + i * 0.4 }));

    const goat = S.sprite('goat', { w: 430, anchor: [0.36, 0.03], order: 60 }).at(-720, ground - 8);
    trot(tl, goat, 0.1, -150, 1.5, { hops: 5, height: 20, rock: 3 });
    tl.call(() => sfx.tap(), null, 0.3);

    // head down ...
    const T = 1.85;
    tl.to(goat, { rot: -23, duration: 0.35, ease: 'back.out(1.5)' }, T - 0.1);
    S.say(T - 0.15);
    // ... munch munch munch
    const meal = tufts[0];
    for (let i = 0; i < 4; i++) {
      const t = T + 0.2 + i * 0.36;
      tl.to(goat, { rot: -17, duration: 0.13, ease: 'sine.out' }, t);
      tl.to(goat, { rot: -23, duration: 0.15, ease: 'sine.in' }, t + 0.13);
      tl.to(meal.scale, { y: 1 - (i + 1) * 0.17, x: 1 - (i + 1) * 0.07, duration: 0.2, ease: 'power2.out' }, t + 0.2);
      tl.call(() => {
        sfx.crack();
        fx.leaves(170, ground + 110, 3, { spreadX: 50, color: ['#6FB34A', '#9cd476'] });
      }, null, t + 0.2);
    }
    // yum
    const E = T + 1.75;
    tl.to(goat, { rot: 0, duration: 0.4, ease: 'back.out(1.6)' }, E);
    hop(tl, goat, E + 0.35, 44, 0.34);
    hop(tl, goat, E + 0.72, 30, 0.3);
    tl.call(() => { sfx.boing(); fx.hearts(60, 60, 4, { size: 44 }); }, null, E + 0.35);
    tl.call(() => fx.notes(110, 40, 2), null, E + 0.5);
    rest(tl, 1.2);
  },
};
