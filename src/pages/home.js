// Home: the 26 capital letters as big cut-paper shapes on a stitched path that
// winds through a meadow. Each letter sways gently; a butterfly keeps travelling
// A -> Z and makes the letter it lands on hop.
import gsap from 'gsap';
import { h, clamp, icon, HAND_SVG } from '../core/util.js';
import { LETTERS, PALETTE } from '../data/letters.js';
import { go } from '../core/router.js';
import { sfx, canPlay } from '../core/audio.js';
import { music } from '../core/music.js';
import { store, session } from '../core/store.js';
import { Backdrop } from '../gl/backdrop.js';
import { world, setStageRect, bounds, hold, clearLayer, onFrame, onResize } from '../gl/engine.js';
import { loadAll, tex, thumbUrl, hasArt, artUrl } from '../gl/assets.js';
import { Sprite } from '../gl/sprite.js';

/** true: the path snakes back and forth (board-game style); false: every row reads left to right. */
const SERPENTINE = true;

const DECOR = ['cloud1', 'cloud2', 'bush', 'grass', 'flower_r', 'flower_y', 'bird'].filter(hasArt);

const STAR_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.3 5.9 20.6l1.4-6.7-5-4.7 6.8-.8z" fill="#FFD23F" stroke="#E0A800" stroke-width="1.2" stroke-linejoin="round"/></svg>';

/** Smooth path through points (Catmull-Rom -> cubic Bezier). */
function splinePath(pts, tension = 1) {
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function safeInsets() {
  const probe = h('div', {
    style: {
      position: 'fixed',
      visibility: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    },
  });
  document.body.append(probe);
  const ps = getComputedStyle(probe);
  const out = {
    top: parseFloat(ps.paddingTop) || 0,
    bottom: parseFloat(ps.paddingBottom) || 0,
    left: parseFloat(ps.paddingLeft) || 0,
    right: parseFloat(ps.paddingRight) || 0,
  };
  probe.remove();
  return out;
}

function computeLayout(W, H, insets) {
  const titleH = clamp(Math.min(W, H) * 0.115, 44, 92);
  const titleTop = clamp(H * 0.014, 6, 18);
  const padX = clamp(W * 0.03, 8, 56);
  const top = insets.top + titleTop + titleH + clamp(H * 0.02, 8, 26);
  const bottom = H - insets.bottom - clamp(H * 0.025, 10, 30);
  const areaW = W - padX * 2 - insets.left - insets.right;
  const areaH = bottom - top;
  let best = null;
  for (const cols of [4, 5, 6, 7, 9, 13]) {
    const rows = Math.ceil(26 / cols);
    const cw = areaW / cols;
    const ch = areaH / rows;
    const d = Math.min(cw * 0.86, ch * 0.72);
    if (!best || d > best.d + 0.5) best = { cols, rows, cw, ch, d };
  }
  const { cols, cw, ch } = best;
  const d = Math.min(best.d, 170);
  const pts = LETTERS.map((_, i) => {
    const r = Math.floor(i / cols);
    let c = i % cols;
    if (SERPENTINE && r % 2 === 1) c = cols - 1 - c;
    return {
      x: insets.left + padX + (c + 0.5) * cw,
      y: top + (r + 0.5) * ch + d * 0.1 + Math.sin(i * 1.9) * ch * 0.04,
    };
  });
  return { d, pts, titleH, titleTop };
}

export async function create(root) {
  await loadAll(DECOR, true).catch(() => {});

  const page = h('div.page.home');
  const title = h(
    'div.home-title',
    {},
    ...['A', 'B', 'C'].map((ch, i) => {
      const pal = [PALETTE.red, PALETTE.yellow, PALETTE.blue][i];
      return h('span.blk', { vars: { '--c': pal.base, '--cd': pal.dark } }, ch);
    }),
    h('span.sub', {}, 'Picture Book'),
  );

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'trail');
  svg.innerHTML =
    '<defs><mask id="trailMask" maskUnits="userSpaceOnUse"><path class="m" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1"/></mask></defs>' +
    '<g mask="url(#trailMask)"><path class="glow"/><path class="stitch"/></g>';
  const maskEl = svg.querySelector('mask');
  const maskPath = svg.querySelector('.m');
  const glowPath = svg.querySelector('.glow');
  const stitchPath = svg.querySelector('.stitch');

  const board = h('div.board');
  let hint = null;
  let leaving = false;
  const dropHint = () => {
    if (!hint) return;
    const el = hint;
    hint = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 300);
  };

  const tiles = LETTERS.map((L) => {
    const el = h(
      'button.tile',
      {
        'aria-label': `${L.upper}, ${L.word}`,
        vars: {
          '--c': L.pal.base,
          '--cd': L.pal.dark,
          '--sway': `${(2.7 + ((L.index * 7) % 5) * 0.24).toFixed(2)}s`,
          '--delay': `${(-(L.index * 0.43) % 3).toFixed(2)}s`,
        },
      },
      h(
        'span.hopper',
        {},
        h(
          'span.swayer',
          {},
          h(
            'span.glyph',
            {},
            L.upper,
            hasArt(L.art) && h('img.sticker', { src: thumbUrl(L.art), alt: '', decoding: 'async' }),
            store.isDone(L.id) && h('span.star', { html: STAR_SVG }),
          ),
        ),
      ),
    );
    el.addEventListener('pointerdown', () => {
      el.classList.add('press');
      sfx.tap();
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => el.classList.remove('press'));
    el.addEventListener('click', () => {
      if (leaving) return;
      leaving = true;
      const r = el.getBoundingClientRect();
      sfx.pop(1 + (L.index % 5) * 0.06);
      session.lastLetter = L.id;
      store.hinted = true;
      dropHint();
      // every tap makes the letter jump; the page turns once it has landed
      const glyph = el.querySelector('.glyph');
      gsap.timeline()
        .to(glyph, { y: '-28%', scaleX: 0.9, scaleY: 1.12, duration: 0.14, ease: 'power2.out' })
        .to(glyph, { y: '0%', scaleX: 1.1, scaleY: 0.9, duration: 0.13, ease: 'power2.in' })
        .to(glyph, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'elastic.out(1.2, 0.35)' });
      setTimeout(() => go(L.id, { x: r.left + r.width / 2, y: r.top + r.height / 2, color: L.bg }), 300);
    });
    return el;
  });

  const flyer = hasArt('butterfly') ? h('div.flyer', {}, h('img', { src: artUrl('butterfly'), alt: '' })) : null;
  const musicBtn = h(`button.btn.tr.music${store.music ? '' : '.off'}`, { 'aria-label': 'music · 音乐', html: icon('music') });
  musicBtn.addEventListener('click', () => {
    sfx.tap();
    store.music = !store.music;
    musicBtn.classList.toggle('off', !store.music);
    if (store.music) music.start();
    else music.stop(0.3);
  });

  board.append(svg, ...tiles);
  if (flyer) board.append(flyer);
  page.append(title, board, musicBtn);
  root.append(page);

  // Before the book is opened (or the intro has run) the letters wait off-stage.
  if (!session.introPlayed) {
    gsap.set(tiles, { scale: 0 });
    gsap.set(maskPath, { strokeDashoffset: 1 });
    gsap.set(svg, { opacity: 0 }); // (a zero-length dash would still show its round cap)
    gsap.set(title, { opacity: 0, y: -60 });
    if (flyer) gsap.set(flyer, { opacity: 0 });
  }

  let lay = null;
  let tour = null;
  let clouds = [];
  const release = hold();

  function buildWorld() {
    world.children.forEach((c) => gsap.killTweensOf(c));
    clearLayer(world);
    Backdrop.clear();
    setStageRect({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    const b = bounds();
    const H = b.top - b.bottom;
    const W = b.right - b.left;
    new Backdrop({
      sky: { top: '#7cc8f4', bot: '#e9f8fe', y0: b.bottom + H * 0.16, y1: b.top, vig: 0.12 },
      strips: [
        { y: b.bottom + H * 0.2, amp: 46, freq: 0.0032, seed: 1.3, color: '#c4e7a0', color2: '#aedb88', shadow: 0.14 },
        { y: b.bottom + H * 0.125, amp: 36, freq: 0.0046, seed: 4.1, color: '#a2d87c', color2: '#8ccb68', shadow: 0.18 },
        { y: b.bottom + H * 0.06, amp: 18, freq: 0.006, seed: 7.7, color: '#84c861', color2: '#6cb650', shadow: 0.22 },
      ],
    });
    clouds = [];
    const have = (n) => DECOR.includes(n);
    if (have('cloud1') && have('cloud2')) {
      const spots = [
        ['cloud1', 0.14, 0.9, 250, 9],
        ['cloud2', 0.72, 0.8, 210, 6],
        ['cloud1', 0.46, 0.63, 170, 4],
        ['cloud2', 0.02, 0.5, 190, 7],
      ];
      for (const [name, fx, fy, w, v] of spots) {
        const s = new Sprite(tex(name), { w, order: -950, shadow: { alpha: 0.1, dy: -12, dx: 6 } });
        s.at(b.left + W * fx, b.bottom + H * fy).addTo(world);
        s.opacity = 0.96;
        clouds.push({ s, v, w });
      }
    }
    const ground = b.bottom + H * 0.06;
    const deco = [
      ['bush', b.left + W * 0.1, ground - 6, 230, -850],
      ['flower_r', b.left + W * 0.25, ground - 34, 78, -840],
      ['grass', b.right - W * 0.3, ground - 20, 150, -850],
      ['flower_y', b.right - W * 0.12, ground - 30, 86, -840],
      ['bush', b.right - W * 0.02, ground - 20, 190, -845],
    ];
    for (const [name, x, y, w, order] of deco) {
      if (!have(name)) continue;
      const s = new Sprite(tex(name), { w, anchor: [0.5, 0.05], order, seg: 8 });
      s.at(x, y).addTo(world);
      gsap.to(s, { bend: w * 0.05, duration: 2 + Math.random(), ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }
  }

  const stopFrame = onFrame((dt) => {
    const b = bounds();
    for (const c of clouds) {
      c.s.position.x += c.v * dt;
      if (c.s.position.x - c.w / 2 > b.right) c.s.position.x = b.left - c.w / 2;
    }
  });

  function buildTour(delay) {
    if (tour) tour.kill();
    if (!flyer) return;
    const { pts, d } = lay;
    const perch = (i) => ({ x: pts[i].x - d * 0.36, y: pts[i].y - d * 0.5 });
    flyer.style.setProperty('--fly', `${Math.round(d * 0.5)}px`);
    const off = { x: perch(0).x - d * 1.2, y: perch(0).y - d * 0.9 };
    gsap.set(flyer, { x: off.x, y: off.y, rotation: 12 });
    tour = gsap.timeline({ repeat: -1, delay });
    tour.set(flyer, { opacity: 1 });
    LETTERS.forEach((L, i) => {
      const p = perch(i);
      const prev = i === 0 ? off : perch(i - 1);
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      const dur = clamp(dist / (d * 2.4), 0.5, 1.5);
      const tilt = clamp((p.x - prev.x) / d, -1, 1) * 14;
      tour.call(() => flyer.classList.remove('rest'));
      tour.to(flyer, { x: p.x, duration: dur, ease: 'sine.inOut' });
      tour.to(flyer, { y: p.y, duration: dur, ease: 'back.out(1.6)' }, '<');
      tour.to(flyer, { rotation: tilt, duration: dur * 0.5, ease: 'sine.out' }, '<');
      tour.to(flyer, { rotation: 0, duration: dur * 0.5, ease: 'sine.in' }, '>');
      tour.call(() => {
        flyer.classList.add('rest');
        const t = tiles[i];
        t.classList.remove('hop');
        void t.offsetWidth;
        t.classList.add('hop');
      });
      tour.to({}, { duration: 0.8 });
      tour.call(() => tiles[i].classList.remove('hop'));
    });
    tour.call(() => flyer.classList.remove('rest'));
    tour.to(flyer, { x: `+=${d * 2}`, y: `-=${d * 2}`, rotation: 20, duration: 1.2, ease: 'sine.in' });
    tour.set(flyer, { x: off.x, y: off.y });
  }

  function placeHint() {
    if (!hint || !lay) return;
    const { pts, d } = lay;
    hint.style.setProperty('--hand', `${Math.round(clamp(d * 0.78, 46, 110))}px`);
    gsap.set(hint, { x: pts[0].x + d * 0.2, y: pts[0].y + d * 0.34 });
  }

  /** First visit only: a little hand taps on "A" until a letter is chosen. */
  function showHint(delay) {
    if (store.hinted || hint) return;
    hint = h('div.hand-hint', { html: HAND_SVG });
    board.append(hint);
    placeHint();
    const el = hint;
    gsap.delayedCall(delay, () => el.isConnected && el.classList.add('on'));
  }

  let started = false;
  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    lay = computeLayout(W, H, safeInsets());
    const { d, pts } = lay;
    page.style.setProperty('--title-h', `${lay.titleH}px`);
    page.style.setProperty('--title-top', `${lay.titleTop}px`);
    tiles.forEach((el, i) => {
      el.style.setProperty('--d', `${d.toFixed(1)}px`);
      gsap.set(el, { x: pts[i].x, y: pts[i].y });
    });
    const dPath = splinePath(pts, 1.1);
    for (const p of [maskPath, glowPath, stitchPath]) p.setAttribute('d', dPath);
    maskEl.setAttribute('x', 0);
    maskEl.setAttribute('y', 0);
    maskEl.setAttribute('width', W);
    maskEl.setAttribute('height', H);
    maskPath.setAttribute('stroke-width', d * 0.8);
    glowPath.setAttribute('stroke-width', d * 0.36);
    stitchPath.setAttribute('stroke-width', Math.max(3, d * 0.066));
    stitchPath.setAttribute('stroke-dasharray', `${(d * 0.11).toFixed(1)} ${(d * 0.19).toFixed(1)}`);
    buildWorld();
    if (started) buildTour(0.4);
    placeHint();
  }
  const stopResize = onResize(() => layout());

  let intro = null;
  function start() {
    started = true;
    if (store.music) music.start();
    if (session.introPlayed) {
      gsap.set(maskPath, { strokeDashoffset: 0 });
      const last = tiles[LETTERS.findIndex((l) => l.id === session.lastLetter)];
      if (last) gsap.fromTo(last, { scale: 1.3 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)', delay: 0.25 });
      buildTour(0.4);
      showHint(1.2);
      return;
    }
    session.introPlayed = true;
    intro = gsap.timeline();
    intro.to(title, { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0);
    intro.set(svg, { opacity: 1 }, 0.15);
    intro.to(maskPath, { strokeDashoffset: 0, duration: 2.3, ease: 'power1.inOut' }, 0.15);
    tiles.forEach((el, i) => {
      const at = 0.2 + i * 0.08;
      intro.fromTo(el, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }, at);
      intro.call(() => canPlay() && sfx.note(i % 14, 0, 0.2), null, at + 0.05);
    });
    buildTour(3.4);
    showHint(3.0);
  }

  return {
    layout,
    start,
    destroy() {
      music.stop(0.5);
      if (tour) tour.kill();
      if (intro) intro.kill();
      gsap.killTweensOf([...tiles, flyer, maskPath, svg, title, hint].filter(Boolean));
      stopFrame();
      stopResize();
      release();
      world.children.forEach((c) => gsap.killTweensOf(c));
      clearLayer(world);
      Backdrop.clear();
    },
  };
}
