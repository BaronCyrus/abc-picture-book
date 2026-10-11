// D - dog - "Walk the dog."
import { clouds, plants, trot, wiggle, rest, worldPos } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_r', 'flower_y'],
  kid: true,
  backdrop: 'park',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', 420, 210], ['flower_r', -420, 64, 31, -8], ['flower_y', -330, 56, 31, -14], ['grass', 250, 120, 29]]);

    const dog = S.sprite('dog', { w: 250, anchor: [0.5, 0.03], order: 60 }).at(-420, ground - 8);
    const kid = S.kid({ height: 430 }).at(-700, ground);
    kid.j.armR = 52;
    kid.j.foreR = 34;

    const leash = S.rope({ color: '#e9523c', width: 6, order: 99 });
    S.each(() => {
      const hand = worldPos(kid.handR);
      leash.set(hand.x, hand.y, dog.x + dog.w * 0.16, dog.y + dog.h * 0.5, 24);
    });
    leash.set(-700, -200, -420, -200, 24);

    // off they go, the dog trotting ahead
    kid.walk(tl, 0.1, -205, 2.3, { steps: 7, swing: false });
    for (let i = 0; i < 7; i++) {
      tl.to(kid.j, { armL: i % 2 ? -4 : 22, duration: 0.3, ease: 'sine.inOut' }, 0.1 + i * (2.3 / 7));
    }
    trot(tl, dog, 0.1, 175, 2.3, { hops: 7, height: 22, rock: 4 });
    tl.call(() => sfx.tap(), null, 0.5);
    S.say(0.8);
    kid.blink(tl, 1.5);

    // arrive: the dog is delighted
    const T = 2.55;
    tl.to(kid.j, { armL: 8, head: 6, duration: 0.25 }, T);
    wiggle(tl, dog, T, 6, 5, 0.09);
    tl.to(dog, { y: `+=${46}`, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 3 }, T + 0.1);
    tl.call(() => { kid.face = 'c'; sfx.boing(); fx.hearts(200, -60, 4, { size: 42 }); }, null, T + 0.15);
    tl.call(() => { sfx.pop(1.3); sfx.pop(1.5, 0.16); }, null, T + 0.3);
    tl.call(() => fx.notes(255, -60, 2), null, T + 0.3);
    rest(tl, 1.3);
  },
};
