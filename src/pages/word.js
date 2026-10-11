// Word page: one big letter, one object, one word. The narrator says the letter,
// then the word; tapping the object or the word says it again (voices alternate
// between a grown-up and a child, which helps little ears generalise).
import gsap from 'gsap';
import { h, icon, mixHex, HAND_SVG } from '../core/util.js';
import { LETTERS, byId, clip, timing } from '../data/letters.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { sfx } from '../core/audio.js';
import { store, session } from '../core/store.js';
import { Backdrop, SCENES } from '../gl/backdrop.js';
import { world, setStageRect, hold, clearLayer, onFrame, onResize, BOX } from '../gl/engine.js';
import { loadTex, tex, artSize, release as releaseArt } from '../gl/assets.js';
import { Sprite, Node2D } from '../gl/sprite.js';
import { shapes } from '../gl/shapes.js';
import { Particles } from '../gl/fx.js';

export async function create(root, id) {
  const L = byId[id];
  if (!L) throw new Error(`no letter ${id}`);
  session.lastLetter = id;

  const letterClip = clip('ava', 'letter', id);
  const wordClips = [clip('ava', 'word', id), clip('ana', 'word', id)];
  await Promise.all([loadTex(L.art), audio.load(letterClip), ...wordClips.map((c) => audio.load(c))]);

  // ------------------------------------------------------------- DOM ----
  const page = h(`div.page.word-page${L.dark ? '.dark' : ''}${store.zh ? '.show-zh' : ''}`, {
    vars: { '--c': L.pal.base, '--cd': L.pal.dark },
  });
  const letters = h(
    'button.letters',
    { 'aria-label': `letter ${L.upper}` },
    h('span.up', {}, L.upper),
    h('span.lo', {}, L.lower),
  );
  const hit = h('button.hit', { 'aria-label': L.word });
  const hint = h('div.tap-hint', { html: HAND_SVG });
  const slot = h('div.slot', {}, hit, hint);
  const chars = [...L.word].map((ch, i) => h(`span.ch${L.hl.includes(i) ? '.hl' : ''}`, {}, ch));
  const wordBtn = h('button.word', { 'aria-label': L.word }, ...chars);
  const wordBox = h('div.wordbox', {}, wordBtn, h('div.zhline', { lang: 'zh' }, L.zh));
  const homeBtn = h('button.btn.tl', { 'aria-label': 'home', html: icon('home') });
  const zhBtn = h(`button.btn.zh.tr${store.zh ? '.on' : ''}`, { 'aria-label': '中文提示' }, '中');
  const nextBtn = h('button.btn.go.br', { 'aria-label': 'next', html: icon('next') });
  page.append(letters, slot, wordBox, homeBtn, zhBtn, nextBtn);
  root.append(page);

  // -------------------------------------------------------------- GL ----
  Backdrop.clear();
  const ray = L.dark ? '#8f9be0' : mixHex(L.bg, '#ffffff', 0.55);
  new Backdrop(SCENES.burst(L.bg, ray, L.dark));
  const size = artSize(L.art);
  const aspect = size.w / size.h;
  const SPAN = 640;
  const w = aspect >= 1 ? SPAN : SPAN * aspect;
  const hgt = w / aspect;
  const baseY = -hgt / 2 - 14;

  // heroRoot is rescaled in layout() so the picture fills tall and wide slots alike
  const heroRoot = new Node2D().addTo(world);
  const blob = new Sprite(shapes.blob(), { w: w * 0.86, shadow: false, order: 1 }).at(0, baseY - 6).addTo(heroRoot);
  blob.opacity = 0;
  const hero = new Sprite(tex(L.art), {
    w,
    anchor: [0.5, 0],
    seg: 16,
    order: 10,
    shadow: { dx: 9, dy: -13, alpha: 0.22, blur: 3.8 },
  })
    .at(0, baseY)
    .addTo(heroRoot);
  hero.scale.set(0.0001, 0.0001, 1);
  const fx = new Particles(heroRoot, 30);
  const stopFrame = onFrame((dt) => fx.update(dt));
  const release = hold();

  const layout = () => {
    const r = slot.getBoundingClientRect();
    setStageRect(r);
    const unit = Math.min(r.width, r.height) / BOX; // px per stage unit
    const k = Math.min((r.width * 0.84) / unit / w, (r.height * 0.8) / unit / hgt);
    heroRoot.scale.set(k, k, 1);
  };
  const stopResize = onResize(() => requestAnimationFrame(layout));

  // idle: a slow float so the picture feels alive
  const idle = gsap.timeline({ paused: true });
  idle.to(hero, { y: baseY + 16, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);
  idle.to(hero, { rot: 2.2, duration: 2.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);
  idle.to(blob.scale, { x: 0.9, y: 0.9, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);

  // ----------------------------------------------------------- voice ----
  let taps = 0;
  let wave = null;

  function waveWord(duration) {
    if (wave) wave.kill();
    wave = gsap.timeline();
    const step = Math.min(0.09, (duration * 0.6) / chars.length);
    chars.forEach((el, i) => {
      wave.to(el, { y: '-0.2em', scaleY: 1.12, duration: 0.14, ease: 'power2.out' }, i * step);
      wave.to(el, { y: 0, scaleY: 1, duration: 0.34, ease: 'bounce.out' }, i * step + 0.14);
    });
  }

  function boing(strength = 1) {
    gsap.killTweensOf(hero.scale);
    gsap.killTweensOf(hero, 'bend');
    const tl = gsap.timeline();
    tl.to(hero.scale, { x: 1 + 0.16 * strength, y: 1 - 0.16 * strength, duration: 0.09, ease: 'power2.out' });
    tl.to(hero.scale, { x: 1 - 0.09 * strength, y: 1 + 0.12 * strength, duration: 0.13, ease: 'power2.out' });
    tl.to(hero.scale, { x: 1, y: 1, duration: 0.8, ease: 'elastic.out(1.1, 0.32)' });
    gsap.fromTo(hero, { bend: 46 * strength * (Math.random() < 0.5 ? -1 : 1) }, { bend: 0, duration: 1.1, ease: 'elastic.out(1.2, 0.22)' });
  }

  async function sayWord({ auto = false } = {}) {
    audio.unlock();
    // first read is the grown-up; taps then alternate child / grown-up
    const path = auto ? wordClips[0] : wordClips[++taps % wordClips.length];
    const info = timing('ava', 'word', id);
    const handle = await audio.playVoice(path);
    hint.classList.toggle('on', !handle);
    waveWord(handle ? handle.duration : info?.dur ?? 0.8);
    return handle;
  }

  async function sayLetter() {
    audio.unlock();
    gsap.fromTo(letters, { scale: 1.25 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    return audio.playVoice(letterClip);
  }

  const onHero = () => {
    sfx.pop(1.15);
    boing(1);
    fx.sparkle(0, 30, 9, { spread: 330, size: 52 });
    sayWord();
  };
  hit.addEventListener('click', onHero);
  wordBtn.addEventListener('click', () => {
    sfx.tap();
    boing(0.5);
    sayWord();
  });
  letters.addEventListener('click', () => {
    sfx.tap();
    sayLetter();
  });

  homeBtn.addEventListener('click', () => {
    sfx.tap();
    const r = homeBtn.getBoundingClientRect();
    go('', { x: r.left + r.width / 2, y: r.top + r.height / 2, color: '#cfeaf9' });
  });
  zhBtn.addEventListener('click', () => {
    sfx.tap();
    store.zh = !store.zh;
    zhBtn.classList.toggle('on', store.zh);
    page.classList.toggle('show-zh', store.zh);
  });
  nextBtn.addEventListener('click', () => {
    sfx.pop();
    const r = nextBtn.getBoundingClientRect();
    go(`${id}/story`, { x: r.left + r.width / 2, y: r.top + r.height / 2, color: L.pal.light });
  });

  // ----------------------------------------------------------- intro ----
  let intro = null;
  gsap.set(letters, { scale: 0 });
  gsap.set(wordBtn, { scale: 0 });
  gsap.set(nextBtn, { scale: 0 });

  function start() {
    intro = gsap.timeline();
    intro.to(letters, { scale: 1, duration: 0.55, ease: 'back.out(2)' }, 0.05);
    intro.call(() => audio.canPlay() && audio.playVoice(letterClip), null, 0.12);
    const letterDur = timing('ava', 'letter', id)?.dur ?? 0.6;
    const tHero = Math.max(0.75, 0.12 + letterDur + 0.18);
    intro.call(() => sfx.pop(0.9), null, tHero);
    intro.to(hero.scale, { x: 1, y: 1, duration: 0.9, ease: 'elastic.out(1.05, 0.42)' }, tHero);
    intro.fromTo(hero, { bend: 30 }, { bend: 0, duration: 1.1, ease: 'elastic.out(1.2, 0.25)' }, tHero);
    intro.to(blob, { opacity: 0.5, duration: 0.4 }, tHero);
    intro.to(wordBtn, { scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, tHero + 0.2);
    intro.call(() => fx.sparkle(0, 30, 8, { spread: 300, size: 48 }), null, tHero + 0.12);
    intro.call(() => sayWord({ auto: true }), null, tHero + 0.32);
    intro.call(() => idle.play(), null, tHero + 1.0);
    intro.to(nextBtn, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, tHero + 1.3);
    intro.call(() => nextBtn.classList.add('nudge'), null, tHero + 2.6);
  }

  // Warm the next page so "next" feels instant.
  const warm = setTimeout(() => {
    import('./story.js').then((m) => m.prefetch && m.prefetch(id)).catch(() => {});
  }, 1500);

  return {
    layout,
    start,
    revealAt() {
      const r = slot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    destroy() {
      clearTimeout(warm);
      audio.stopVoice();
      if (intro) intro.kill();
      if (wave) wave.kill();
      idle.kill();
      gsap.killTweensOf([hero, hero.scale, blob, blob.scale, letters, wordBtn, nextBtn, ...chars]);
      stopFrame();
      stopResize();
      release();
      fx.clear();
      clearLayer(world);
      Backdrop.clear();
      const keep = new Set([L.art]);
      // keep only this hero warm for the story page; older heroes are freed
      releaseArt(LETTERS.map((l) => l.art).filter((n) => !keep.has(n)));
    },
  };
}
