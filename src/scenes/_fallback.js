// Used until a letter gets its own scene: the object simply hops in and wiggles.
import { artSize } from '../gl/assets.js';

export default {
  art: [],
  backdrop: 'meadow',
  build(S) {
    const { tl, L } = S;
    const a = artSize(L.art);
    const w = a.w >= a.h ? 460 : 460 * (a.w / a.h);
    const hero = S.sprite(L.art, { w, anchor: [0.5, 0.04], seg: 12, order: 50 }).at(0, 620);
    tl.to(hero, { y: S.ground, duration: 0.7, ease: 'bounce.out' }, 0.2);
    tl.call(() => S.sfx.thud(), null, 0.45);
    S.say(0.9);
    tl.to(hero.scale, { x: 1.12, y: 0.9, duration: 0.12, ease: 'power2.out' }, 1.0);
    tl.to(hero.scale, { x: 1, y: 1, duration: 0.8, ease: 'elastic.out(1.1, 0.3)' }, 1.12);
    tl.fromTo(hero, { bend: 40 }, { bend: 0, duration: 1.2, ease: 'elastic.out(1.2, 0.25)' }, 1.0);
    tl.call(() => S.fx.sparkle(0, S.ground + 260, 10), null, 1.1);
    tl.to({}, { duration: 1.2 });
  },
};
