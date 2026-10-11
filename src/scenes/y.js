// Y - yo-yo - "The yo-yo goes up and down."
import { clouds, plants, rest, worldPos } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_r'],
  kid: true,
  backdrop: 'park',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', -420, 200], ['grass', 430, 150, 29], ['flower_r', 330, 60, 31, -10]]);

    const kid = S.kid({ height: 470 }).at(-150, ground);
    kid.j.armR = 100;
    kid.j.foreR = 14;
    kid.j.head = 9;

    // only the body of the toy is drawn (its painted string is cropped away); the real string is a rope
    const yoyo = S.sprite('yoyo', { w: 170, anchor: [0.5, 0.34], order: 80 }).at(0, 0);
    yoyo.crop(0, 0, 1, 0.7);
    const string = S.rope({ color: '#fffaf0', width: 4, segments: 6, order: 79 });
    const hand = () => worldPos(kid.handR);
    const topY = () => hand().y - 92;
    const lowY = ground + 78;
    const place = () => {
      const h = hand();
      yoyo.x = h.x + 4;
      string.set(h.x + 4, h.y - 6, yoyo.x, yoyo.y + 40, 0);
    };
    yoyo.y = topY();
    S.each(place);
    place();

    const down = (at, d = 0.34) => {
      tl.to(kid.j, { armR: 92, foreR: 6, duration: 0.12, ease: 'power2.out' }, at);
      tl.to(kid.j, { armR: 100, foreR: 14, duration: 0.24, ease: 'sine.inOut' }, at + 0.12);
      tl.to(yoyo, { y: lowY, rot: `-=${540}`, duration: d, ease: 'power1.in' }, at);
      tl.call(() => sfx.slide(false), null, at);
    };
    const up = (at, d = 0.36) => {
      tl.to(yoyo, { y: () => topY(), rot: `+=${540}`, duration: d, ease: 'power1.out' }, at);
      tl.to(kid.j, { armR: 106, foreR: 18, duration: 0.14, ease: 'power2.out' }, at + d - 0.1);
      tl.to(kid.j, { armR: 100, foreR: 14, duration: 0.2, ease: 'sine.inOut' }, at + d + 0.04);
      tl.call(() => sfx.slide(true), null, at);
    };

    // warm-up throw
    down(0.4);
    up(0.78);
    tl.call(() => { kid.face = 'c'; }, null, 0.8);
    // "The yo-yo goes UP and DOWN." - the toy follows the words
    const T = 1.45;
    S.say(T);
    down(T + 0.25, 0.4);
    up(T + 0.98, 0.34); // "up"
    tl.to(kid.j, { head: 3, duration: 0.3 }, T + 0.98);
    down(T + 1.45, 0.34); // "down"
    tl.to(kid.j, { head: 12, duration: 0.3 }, T + 1.45);
    up(T + 1.95, 0.36);

    // caught it!
    const E = T + 2.4;
    tl.call(() => { sfx.pop(1.2); sfx.chime(0.1); fx.sparkle(yoyo.x, yoyo.y, 12, { spread: 320, size: 44 }); }, null, E);
    tl.to(kid, { lift: 36, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, E);
    tl.to(kid.j, { armL: 130, foreL: 24, head: 4, duration: 0.4, ease: 'back.out(1.8)' }, E);
    rest(tl, 1.4);
  },
};
