// B - ball - "Bounce the ball."
import { shapes } from '../gl/shapes.js';
import { clouds, plants, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bush', 'grass', 'flower_y'],
  kid: true,
  backdrop: 'park',
  build(S) {
    const { tl, fx, sfx, ground } = S;
    clouds(S);
    plants(S, [['bush', -410, 200], ['grass', 400, 150], ['flower_y', 300, 60, 31, -10]]);

    const kid = S.kid({ height: 430 }).at(-150, ground);
    const R = 70;
    const bx = 46;
    const top = -96;
    const floor = ground + R - 8;
    const shade = S.paper(shapes.blob(), { w: 190, shadow: false, order: 40 }).at(bx, ground - 6);
    shade.opacity = 0.25;
    const ball = S.sprite('ball', { w: R * 2, order: 109 }).at(bx, top);
    kid.j.armR = 95;
    kid.j.foreR = 20;
    kid.j.head = 8;

    // dribble: push down, squash on the ground, come back to the hand
    const T0 = 0.75;
    S.say(T0 + 0.05);
    const beat = 0.56;
    for (let i = 0; i < 4; i++) {
      const t = T0 + i * beat;
      tl.to(kid.j, { armR: 80, foreR: 12, duration: 0.12, ease: 'power2.out' }, t);
      tl.to(kid.j, { armR: 96, foreR: 20, duration: 0.3, ease: 'sine.inOut' }, t + 0.14);
      tl.to(ball, { y: floor, duration: 0.2, ease: 'power2.in' }, t);
      tl.to(shade, { opacity: 0.55, duration: 0.2 }, t);
      tl.to(shade.scale, { x: 1.15, y: 1.15, duration: 0.2 }, t);
      tl.call(() => { sfx.thud(); sfx.boing(0.02); }, null, t + 0.2);
      tl.to(ball.scale, { x: 1.2, y: 0.78, duration: 0.06, ease: 'power2.out' }, t + 0.2);
      tl.to(ball, { y: floor - 12, duration: 0.06 }, t + 0.2);
      tl.to(ball.scale, { x: 0.94, y: 1.08, duration: 0.1, ease: 'power2.out' }, t + 0.26);
      tl.to(ball.scale, { x: 1, y: 1, duration: 0.18, ease: 'sine.out' }, t + 0.36);
      tl.to(ball, { y: top, duration: 0.26, ease: 'power2.out' }, t + 0.26);
      tl.to(ball, { rot: `+=${50}`, duration: beat, ease: 'none' }, t);
      tl.to(shade, { opacity: 0.25, duration: 0.26 }, t + 0.26);
      tl.to(shade.scale, { x: 1, y: 1, duration: 0.26 }, t + 0.26);
      tl.to(kid.j, { head: i % 2 ? 8 : 4, duration: 0.25, ease: 'sine.inOut' }, t);
    }
    kid.blink(tl, T0 + 1.1);

    // last one bounces high ... and is caught in a big hug
    const T1 = T0 + 4 * beat;
    tl.to(kid.j, { armR: 78, foreR: 10, duration: 0.12, ease: 'power2.out' }, T1);
    tl.to(ball, { y: floor, duration: 0.18, ease: 'power2.in' }, T1);
    tl.call(() => { sfx.thud(); sfx.boing(0.02); }, null, T1 + 0.18);
    tl.to(ball.scale, { x: 1.26, y: 0.72, duration: 0.06, ease: 'power2.out' }, T1 + 0.18);
    tl.to(ball.scale, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1, 0.4)' }, T1 + 0.24);
    tl.to(ball, { y: 330, rot: '+=200', duration: 0.5, ease: 'power2.out' }, T1 + 0.24);
    tl.to(shade, { opacity: 0.1, duration: 0.4 }, T1 + 0.24);
    tl.call(() => { kid.face = 'c'; }, null, T1 + 0.3);
    tl.to(kid.j, { armR: 150, foreR: 12, armL: 150, foreL: 12, head: 0, duration: 0.4, ease: 'back.out(1.5)' }, T1 + 0.3);
    tl.to(ball, { x: -150, y: -110, rot: '+=120', duration: 0.42, ease: 'power2.in' }, T1 + 0.76);
    tl.to(shade, { x: -150, opacity: 0, duration: 0.3 }, T1 + 0.76);
    tl.call(() => { ball.order = kid.baseOrder + 7; sfx.pop(0.9); }, null, T1 + 1.16);
    tl.to(kid.j, { armR: 34, foreR: -92, armL: 34, foreL: -92, duration: 0.3, ease: 'back.out(2)' }, T1 + 1.08);
    tl.to(ball.scale, { x: 1.1, y: 0.93, duration: 0.08 }, T1 + 1.18);
    tl.to(ball.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, T1 + 1.26);
    tl.to(kid.scale, { y: 0.95, x: 1.04, duration: 0.08 }, T1 + 1.18);
    tl.to(kid.scale, { y: 1, x: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, T1 + 1.26);
    tl.call(() => { fx.sparkle(-150, 40, 12, { spread: 320, size: 44 }); sfx.chime(); }, null, T1 + 1.3);
    tl.to(kid.j, { head: 7, duration: 0.3, ease: 'sine.inOut' }, T1 + 1.3);
    rest(tl, 1.0);
  },
};
