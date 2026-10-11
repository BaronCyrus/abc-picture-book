// X - fox - "The fox is in the box."
import { clouds, plants, hop, wiggle, squash, rest } from './kit.js';

export default {
  art: ['box', 'cloud1', 'cloud2', 'bush', 'grass', 'flower_y'],
  backdrop: 'park',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', -430, 200], ['grass', 440, 150, 29], ['flower_y', -310, 58, 31, -10]]);

    // the box is drawn twice: once behind the fox, and its front wall again on top
    const bx = 150;
    const by = ground - 24;
    const box = S.group().at(bx, by);
    S.sprite('box', { w: 420, anchor: [0.5, 0.03], order: 40, parent: box });
    const front = S.sprite('box', { w: 420, anchor: [0.5, 0.03], order: 70, shadow: false, parent: box });
    front.crop(0, 0, 1, 0.5);

    const fox = S.sprite('fox', { w: 270, anchor: [0.5, 0.03], seg: 6, order: 60 }).at(-720, ground - 6);

    // hop ... hop ...
    tl.to(fox, { x: -260, duration: 1.0, ease: 'none' }, 0.15);
    for (let i = 0; i < 3; i++) {
      hop(tl, fox, 0.15 + i * 0.335, 90, 0.33);
      tl.call(() => sfx.pop(1 + i * 0.15), null, 0.15 + i * 0.335);
    }
    wiggle(tl, fox, 1.2, 6, 2, 0.1);
    tl.call(() => fx.sparkle(bx, by + 330, 5, { spread: 160, size: 30 }), null, 1.2);

    // ... and a big jump right into the box
    const T = 1.65;
    squash(tl, fox, T - 0.2, 0.13, 0.18);
    tl.call(() => sfx.boing(), null, T);
    tl.to(fox, { x: bx, duration: 0.56, ease: 'none' }, T);
    tl.to(fox, { y: ground + 360, rot: -10, duration: 0.3, ease: 'power2.out' }, T);
    tl.to(fox, { y: by - 150, rot: 0, duration: 0.26, ease: 'power2.in' }, T + 0.3);
    S.say(T + 0.3);
    tl.call(() => { sfx.thud(); fx.puffs(bx, by + 250, 5, { size: 54, spread: 200, color: '#f3e3c3' }); }, null, T + 0.56);
    squash(tl, box, T + 0.56, 0.08, 0.5);
    wiggle(tl, box, T + 0.6, 3, 3, 0.07);

    // peek-a-boo!
    const P = T + 1.15;
    tl.to(fox, { y: by + 62, duration: 0.4, ease: 'back.out(2.4)' }, P);
    tl.call(() => { sfx.pop(1.3); sfx.sparkle(0.1); fx.sparkle(bx, by + 420, 12, { spread: 360, size: 44 }); }, null, P + 0.05);
    wiggle(tl, fox, P + 0.5, 6, 4, 0.13);
    tl.to(fox, { y: by + 82, duration: 0.14, ease: 'sine.out', yoyo: true, repeat: 3 }, P + 0.5);
    tl.call(() => fx.hearts(bx + 20, by + 440, 3, { size: 42 }), null, P + 0.6);
    rest(tl, 1.5);
  },
};
