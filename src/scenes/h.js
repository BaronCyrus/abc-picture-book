// H - hat - "Put on the hat."
import { clouds, plants, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'flower_r', 'grass'],
  kid: true,
  backdrop: (P) => {
    const c = P.park();
    c.sky.glow = { x: 330, y: 400, r: 520, a: 0.75, color: '#fff7c2' };
    return c;
  },
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S, [[-340, 400, 240], [120, 440, 180]]);
    plants(S, [['bush', 400, 210], ['flower_r', -380, 66, 31, -8], ['grass', -280, 130, 29]]);

    const kid = S.kid({ height: 470 }).at(-10, ground);
    kid.j.head = -4;

    // the hat drifts down like a leaf (it rides in a holder so it can be handed to the head)
    const hold = S.group().at(210, 640);
    hold.rot = 18;
    const hat = S.sprite('hat', { w: 310, anchor: [0.5, 0.3], order: kid.baseOrder + 9, parent: hold });
    tl.to(hold, { y: 300, duration: 1.1, ease: 'sine.inOut' }, 0.2);
    tl.to(hold, { x: -70, rot: -14, duration: 0.55, ease: 'sine.inOut' }, 0.2);
    tl.to(hold, { x: 30, rot: 8, duration: 0.55, ease: 'sine.inOut' }, 0.75);
    tl.call(() => sfx.swish(), null, 0.25);
    tl.to(kid.j, { head: -9, duration: 0.3 }, 0.4);
    tl.call(() => { kid.face = 'c'; }, null, 0.7);

    // catch it with both hands
    tl.to(kid.j, { armL: 152, foreL: 16, armR: 152, foreR: 16, duration: 0.4, ease: 'back.out(1.6)' }, 0.85);
    tl.to(hold, { x: -10, y: 268, rot: 0, duration: 0.3, ease: 'power2.out' }, 1.3);
    tl.call(() => sfx.pop(1.1), null, 1.5);

    // and pull it on
    const T = 1.85;
    S.say(T - 0.1);
    tl.call(() => kid.crown.attach(hold), null, T);
    tl.to(hold, { x: 0, y: -36, rot: 0, duration: 0.3, ease: 'back.in(1.4)' }, T + 0.05);
    tl.to(kid.j, { armL: 138, foreL: -30, armR: 138, foreR: -30, head: 0, duration: 0.3, ease: 'power2.in' }, T + 0.05);
    tl.call(() => { sfx.thud(); kid.face = 'b'; }, null, T + 0.35);
    tl.to(hat.scale, { y: 0.84, x: 1.1, duration: 0.07 }, T + 0.35);
    tl.to(hat.scale, { y: 1, x: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' }, T + 0.42);
    tl.to(kid.scale, { y: 0.94, x: 1.04, duration: 0.07 }, T + 0.35);
    tl.to(kid.scale, { y: 1, x: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' }, T + 0.42);

    // ta-da!
    const E = T + 0.95;
    tl.call(() => { kid.face = 'c'; sfx.chime(); fx.sparkle(-10, 240, 14, { spread: 380, size: 48 }); }, null, E);
    tl.to(kid.j, { armL: 96, foreL: 40, armR: 96, foreR: 40, duration: 0.4, ease: 'back.out(2)' }, E);
    tl.to(kid.j, { head: 9, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, E + 0.1);
    tl.to(kid, { lift: 30, duration: 0.16, ease: 'sine.out', yoyo: true, repeat: 1 }, E);
    tl.to(kid.j, { armL: 24, foreL: 16, armR: 24, foreR: 16, head: 5, duration: 0.5, ease: 'sine.inOut' }, E + 0.8);
    rest(tl, 0.9);
  },
};
