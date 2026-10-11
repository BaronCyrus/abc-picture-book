// W - whale - "The whale sprays water."
import { rand } from '../core/util.js';
import { shapes } from '../gl/shapes.js';
import { clouds, squash, rest } from './kit.js';

export default {
  art: ['cloud1', 'cloud2', 'bird'],
  backdrop: (P) => {
    const c = P.sea();
    c.sky.glow = { x: -330, y: 420, r: 560, a: 0.7, color: '#fff7c2' };
    return c;
  },
  build(S) {
    const { tl, fx, sfx } = S;
    clouds(S, [[330, 400, 250], [-80, 450, 180]]);
    const bird = S.sprite('bird', { w: 80, order: -500 }).at(-700, 330);
    tl.to(bird, { x: 700, duration: 5, ease: 'none' }, 0);
    tl.to(bird, { y: 360, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 7 }, 0);

    // the whale sits between the wave layers (two waves roll in front of it)
    const whale = S.sprite('whale', { w: 560, anchor: [0.5, 0.3], seg: 18, order: 100 }).at(-40, -760);
    whale.wave('tail-left', { amp: 12, freq: 0.5, power: 2.2 });
    S.each((dt, t) => { whale.wavePhase = -t * 3.2; });
    S.onCleanup(() => { whale.waveAmp = 0; });

    // up from the deep with a splash
    tl.to(whale, { y: -200, duration: 1.0, ease: 'back.out(1.4)' }, 0.25);
    tl.fromTo(whale, { rot: 14 }, { rot: 0, duration: 1.0, ease: 'power2.out' }, 0.25);
    tl.call(() => {
      sfx.splash();
      fx.drops(-40, -250, 14, { color: '#bfe6fb', power: 520, cone: 130, size: 26 });
      fx.drops(-40, -250, 8, { color: '#ffffff', power: 380, cone: 150, size: 20 });
    }, null, 0.55);
    S.loop(whale, { y: -186, duration: 1.3 });
    S.loop(whale, { rot: 2.5, duration: 1.7 });

    // PSHHHH - a fountain from the blowhole
    const T = 1.75;
    S.say(T - 0.35);
    squash(tl, whale, T - 0.1, 0.06, 0.4);
    const spout = () => {
      const x = whale.x + 30;
      const y = whale.y + 215;
      for (let i = 0; i < 3; i++) {
        fx.emit({
          tex: shapes.drop(i % 2 ? '#ffffff' : '#bfe6fb'), x: x + rand(-10, 10), y,
          vx: rand(-150, 150), vy: rand(560, 820), g: 1300, life: rand(0.9, 1.25), size: rand(20, 34), rot: rand(-20, 20),
        });
      }
    };
    for (let i = 0; i < 22; i++) tl.call(spout, null, T + i * 0.055);
    tl.call(() => { sfx.whoosh(0, 0.34); sfx.whoosh(0.3, 0.3); sfx.whoosh(0.6, 0.26); }, null, T);
    tl.call(() => sfx.splash(), null, T + 1.0);
    tl.to(whale.scale, { y: 1.05, duration: 0.2, ease: 'sine.inOut', yoyo: true, repeat: 5 }, T);

    // a happy wiggle
    const E = T + 1.5;
    tl.to(whale, { waveAmp: 26, duration: 0.3, yoyo: true, repeat: 1 }, E);
    tl.call(() => { sfx.chime(); fx.sparkle(whale.x + 30, whale.y + 330, 10, { spread: 360, size: 42, colors: ['#ffffff', '#bfe6fb', '#ffd23f'] }); }, null, E);
    for (let i = 0; i < 4; i++) tl.call(spout, null, E + 0.5 + i * 0.07);
    rest(tl, 1.7);
  },
};
