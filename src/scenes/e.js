// E - egg - "The egg cracks open."
import { clouds, plants, wiggle, squash, rest } from './kit.js';

export default {
  art: ['egg_top', 'egg_bottom', 'chick', 'cloud1', 'cloud2', 'grass', 'flower_r', 'flower_y'],
  backdrop: 'meadow',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['grass', -270, 170, 20], ['grass', 290, 190, 20], ['flower_r', -400, 70, 31], ['flower_y', 410, 64, 31, -10]]);

    const base = ground - 22;
    const egg = S.sprite('egg', { w: 350, anchor: [0.5, 0.03], seg: 6, order: 50 }).at(0, base);

    // The two shell halves and the chick wait hidden behind the whole egg.
    const shell = S.group().at(0, base);
    const back = S.sprite('egg_bottom', { w: 368, anchor: [0.5, 0.03], order: 40, parent: shell });
    const chick = S.sprite('chick', { w: 250, anchor: [0.5, 0.05], order: 45, parent: shell }).at(0, 50);
    const front = S.sprite('egg_bottom', { w: 368, anchor: [0.5, 0.03], order: 52, shadow: false, parent: shell });
    front.crop(0, 0, 1, 0.6);
    const cap = S.sprite('egg_top', { w: 350, anchor: [0.5, 0.2], order: 54, parent: shell }).at(0, 254);
    for (const p of [back, chick, front, cap]) p.opacity = 0;
    chick.scale.set(0.5, 0.5, 1);

    // wobble ... wobble ...
    wiggle(tl, egg, 0.5, 7, 3, 0.11);
    tl.call(() => sfx.tap(), null, 0.5);
    wiggle(tl, egg, 1.15, 11, 3, 0.1);
    tl.call(() => sfx.tap(), null, 1.15);

    // CRACK
    const T = 1.7;
    S.say(T - 0.25);
    tl.call(() => {
      egg.opacity = 0;
      for (const p of [back, front, cap]) p.opacity = 1;
      chick.opacity = 1;
      sfx.crack();
      fx.puffs(0, base + 246, 4, { size: 44, spread: 150, color: '#fff6e6' });
    }, null, T);
    squash(tl, shell, T, 0.07, 0.4);
    tl.to(cap, { y: 276, rot: -7, duration: 0.14, ease: 'power2.out' }, T);
    wiggle(tl, cap, T + 0.2, 6, 3, 0.09);
    tl.call(() => sfx.crack(), null, T + 0.3);

    // the lid flips away and a chick pops out
    const P = T + 0.62;
    tl.to(cap, { x: 330, duration: 0.7, ease: 'power1.out' }, P);
    tl.to(cap, { y: 520, duration: 0.3, ease: 'power2.out' }, P);
    tl.to(cap, { y: 30, duration: 0.4, ease: 'bounce.out' }, P + 0.3);
    tl.to(cap, { rot: -200, duration: 0.7, ease: 'power1.out' }, P);
    tl.call(() => { sfx.pop(1.4); sfx.sparkle(0.08); fx.sparkle(0, base + 300, 12, { spread: 380, size: 48 }); }, null, P);
    tl.to(chick.scale, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)' }, P);
    tl.to(chick, { y: 126, duration: 0.45, ease: 'back.out(2.2)' }, P);
    tl.call(() => sfx.thud(), null, P + 0.55);

    // cheep cheep!
    const C = P + 0.75;
    for (let i = 0; i < 3; i++) {
      tl.to(chick, { y: 160, duration: 0.13, ease: 'power2.out' }, C + i * 0.3);
      tl.to(chick, { y: 126, duration: 0.15, ease: 'power2.in' }, C + i * 0.3 + 0.13);
      tl.call(() => sfx.pop(2.1), null, C + i * 0.3);
    }
    wiggle(tl, chick, C, 5, 6, 0.14);
    tl.call(() => fx.notes(120, base + 380, 2), null, C + 0.1);
    rest(tl, 1.1);
  },
};
