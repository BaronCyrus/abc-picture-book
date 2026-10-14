// Word page: the big letter on the left, its object on the right.
//
// On arrival the narrator cheers the letter three times ("A! A! A!") while it hops,
// then the object comes in from the left edge of the screen in its own way (the dog
// runs wagging its tail, the fish swims, the ball bounces ...), the word card pops
// up and the word is read. Tapping the letter makes it jump and says it; tapping the
// picture or the word makes the object do its signature move and says the word
// (animals add their sound). The microphone button is hold-to-talk follow-reading:
// release, get a cheer ("Excellent!" + stars + flowers), then hear yourself.
import gsap from 'gsap';
import { h, icon, mixHex, wait, rand } from '../core/util.js';
import { LETTERS, byId, clip, timing } from '../data/letters.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { sfx } from '../core/audio.js';
import { micSupported, startRecording } from '../core/mic.js';
import { analyse, grade, fingerprint, compact, placeAmong, unpackTemplates } from '../core/speech.js';
import { store, session } from '../core/store.js';
import { Backdrop, SCENES } from '../gl/backdrop.js';
import { world, setStageRect, hold, clearLayer, onFrame, onResize, BOX, bounds, view } from '../gl/engine.js';
import { loadTex, loadAll, tex, artSize, hasArt, release as releaseArt } from '../gl/assets.js';
import { Sprite, Node2D } from '../gl/sprite.js';
import { shapes } from '../gl/shapes.js';
import { Particles } from '../gl/fx.js';
import { MOTIONS, createMotion } from './motions.js';

const NARRATOR = 'emma';
const SECOND_VOICE = 'ava';
const PRAISE = {
  excellent: { text: 'Excellent!', stars: 3 },
  great: { text: 'Great!', stars: 2 },
  good: { text: 'Good!', stars: 1 },
  again: { text: 'Try again!', stars: 0 },
};
const STAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.3 5.9 20.6l1.4-6.7-5-4.7 6.8-.8z"/></svg>';
const RAINBOW = ['#E9523C', '#F28B30', '#F4B81F', '#6FB34A', '#2FAE9E', '#3F93D6', '#6470D2', '#9C60C6', '#E5619F'];

export async function create(root, id) {
  const L = byId[id];
  if (!L) throw new Error(`no letter ${id}`);
  session.lastLetter = id;
  const M = MOTIONS[id] || {};
  const extra = M.extra && hasArt(M.extra) ? M.extra : null;

  const letterClip = clip(NARRATOR, 'letter', id);
  const wordClips = [NARRATOR, SECOND_VOICE].filter((v) => timing(v, 'word', id)).map((v) => clip(v, 'word', id));
  const soundClip = L.sound ? clip('ana', 'sound', id) : null;
  await Promise.all([
    loadTex(L.art),
    extra ? loadTex(extra) : null,
    loadAll(['flower_r', 'flower_y'].filter(hasArt), true).catch(() => {}),
    audio.load(letterClip),
    ...wordClips.map((c) => audio.load(c)),
    soundClip ? audio.load(soundClip) : null,
  ]);
  for (const k of Object.keys(PRAISE)) audio.load(clip(NARRATOR, 'praise', k));

  // ------------------------------------------------------------- DOM ----
  const page = h(`div.page.word-page${L.dark ? '.dark' : ''}${store.zh ? '.show-zh' : ''}`, {
    vars: { '--c': L.pal.base, '--cd': L.pal.dark },
  });
  // three layers so the pop-in, the idle sway and the hops never fight over one transform
  const glyphs = h('span.bl-in', {}, h('span.up', {}, L.upper), h('span.lo', {}, L.lower));
  const sway = h('span.bl-sway', {}, glyphs);
  const bigLetter = h('button.big-letter', { 'aria-label': `letter ${L.upper}` }, sway);
  const hit = h('button.hit', { 'aria-label': L.word });
  const slot = h('div.slot', {}, hit);
  const stage = h('div.wp-stage', {}, bigLetter, slot);

  const chars = [...L.word].map((ch, i) => h(`span.ch${L.hl.includes(i) ? '.hl' : ''}`, {}, ch));
  const wordBtn = h('button.word', { 'aria-label': L.word }, ...chars);
  const wordBox = h('div.wordbox', {}, wordBtn, h('div.zhline', { lang: 'zh' }, L.zh));

  const canMic = micSupported();
  const micBtn = canMic
    ? h(
        'button.mic',
        { 'aria-label': '按住跟读 · hold and say the word', 'data-state': 'idle' },
        h('span.mic-ring'),
        h('span.mic-ring.r2'),
        h('span.mic-face', { html: icon('mic') }),
      )
    : null;
  const micCap = canMic ? h('div.mic-cap', {}, '按住跟读') : null;
  const readBox = canMic ? h('div.readbox', {}, micBtn, micCap) : null;
  const bottom = h('div.wp-bottom', {}, wordBox, readBox);

  const praise = h('div.praise', { 'aria-live': 'polite' });
  const homeBtn = h('button.btn.tl', { 'aria-label': 'home', html: icon('home') });
  const zhBtn = h(`button.btn.zh.tr${store.zh ? '.on' : ''}`, { 'aria-label': '中文提示' }, '中');
  const nextBtn = h('button.btn.go.br', { 'aria-label': 'next', html: icon('next') });
  page.append(stage, bottom, homeBtn, zhBtn, nextBtn, praise);
  root.append(page);

  // -------------------------------------------------------------- GL ----
  Backdrop.clear();
  const ray = L.dark ? '#8f9be0' : mixHex(L.bg, '#ffffff', 0.55);
  const bd = new Backdrop(SCENES.burst(L.bg, ray, L.dark));
  const size = artSize(L.art);
  const aspect = size.w / size.h;
  const SPAN = 640;
  const w = aspect >= 1 ? SPAN : SPAN * aspect;
  const hgt = w / aspect;
  const baseY = -hgt / 2 - 14;
  const center = M.pivot === 'center';
  const anchor = center ? [0.5, 0.5] : [0.5, 0];
  const shadow = { dx: 9, dy: -13, alpha: 0.22, blur: 3.8 };

  // heroRoot is rescaled in layout() so the picture fills tall and wide slots alike
  const heroRoot = new Node2D().addTo(world);
  const blob = new Sprite(shapes.blob(), { w: w * 0.86, shadow: false, order: 1 }).at(0, baseY - 6).addTo(heroRoot);
  blob.opacity = 0;
  // base holds the resting spot; mover's x / y are offsets from it (0 = at rest)
  const base = new Node2D().at(0, baseY).addTo(heroRoot);
  const mover = new Node2D().addTo(base);
  const rocker = new Node2D().addTo(mover);
  if (center) rocker.y = hgt / 2;
  const hero = new Sprite(tex(L.art), { w, anchor, seg: 22, order: 10, shadow }).addTo(rocker);
  let extraSprite = null;
  if (extra) {
    const es = artSize(extra);
    const ew = extra === 'umbrella_closed' ? hgt * (es.w / es.h) : w;
    extraSprite = new Sprite(tex(extra), { w: ew, anchor, seg: 8, order: 11, shadow }).addTo(rocker);
    extraSprite.opacity = 0;
  }
  mover.visible = false;
  const fx = new Particles(heroRoot, 30);

  const rig = { mover, rocker, hero, extraSprite, w, h: hgt, baseX: 0, baseY, startX: -1600, fx, sfx, glow: bd.glow };
  const motion = createMotion(id, rig);
  const stopFrame = onFrame((dt, t) => {
    fx.update(dt);
    motion.update(dt, t);
    blob.x = mover.x;
    const f = Math.max(0.4, 1 - Math.max(0, mover.y) / 520);
    blob.scale.set(f, f, 1);
    blob.opacity = mover.visible ? 0.5 * f : 0;
  });
  const release = hold();

  let k = 1;
  function fitLetter() {
    // layout sizes, not getBoundingClientRect: the letter may be mid pop-in (scaled)
    const bw = bigLetter.offsetWidth;
    const bh = bigLetter.offsetHeight;
    if (!bw || !bh) return;
    let fs = bh * 0.9;
    glyphs.style.fontSize = `${fs}px`;
    // leave room for the hops, sways and the pop-in overshoot
    const s = Math.min(1, (bw * 0.84) / glyphs.offsetWidth, (bh * 0.9) / glyphs.offsetHeight);
    fs *= s;
    glyphs.style.fontSize = `${Math.floor(fs)}px`;
  }
  const layout = () => {
    fitLetter();
    const r = slot.getBoundingClientRect();
    setStageRect(r);
    const unit = Math.min(r.width, r.height) / BOX;
    k = Math.min((r.width * 0.9) / unit / w, (r.height * 0.84) / unit / hgt);
    heroRoot.scale.set(k, k, 1);
    rig.startX = bounds().left / k - w * 0.75;
  };
  const stopResize = onResize(() => requestAnimationFrame(layout));
  if (import.meta.env.DEV) window.__word = { heroRoot, mover, rocker, hero, slot, bigLetter, glyphs, get k() { return k; }, motion, react: () => react() };

  /** a point on the screen in the particle layer's coordinates */
  function screenToLocal(sx, sy) {
    return { x: (sx - view.cx) / view.scale / k, y: (view.cy - sy) / view.scale / k };
  }

  // ----------------------------------------------------------- letter ----
  let destroyed = false;
  let chantToken = 0;

  function hopLetter(strength = 1) {
    gsap.killTweensOf(glyphs);
    const tl = gsap.timeline();
    tl.to(glyphs, {
      yPercent: -14 * strength,
      scaleX: 0.92,
      scaleY: 1.1,
      rotation: (Math.random() < 0.5 ? -1 : 1) * 7 * strength,
      duration: 0.15,
      ease: 'power2.out',
    });
    tl.to(glyphs, { yPercent: 0, scaleX: 1.08, scaleY: 0.92, rotation: 0, duration: 0.16, ease: 'power2.in' });
    tl.to(glyphs, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' });
    return tl;
  }

  function sparkleAtLetter(n = 4) {
    const r = bigLetter.getBoundingClientRect();
    const p = screenToLocal(r.left + r.width * rand(0.25, 0.8), r.top + r.height * rand(0.15, 0.4));
    fx.sparkle(p.x, p.y, n, { spread: 300, size: 46 });
  }

  /** "A! A! A!" with a little hop each time (each one a touch higher) */
  async function chant(times = 3) {
    const token = ++chantToken;
    for (let i = 0; i < times; i++) {
      if (token !== chantToken || destroyed) return;
      hopLetter(1);
      sparkleAtLetter(3);
      const handle = await audio.playVoice(letterClip, { rate: 1 + i * 0.07 });
      if (!handle) {
        await wait(650);
        continue;
      }
      if (!(await handle.done)) return;
      await wait(170);
    }
  }

  bigLetter.addEventListener('click', () => {
    sfx.tap();
    hopLetter(1.3);
    sparkleAtLetter(5);
    chantToken++;
    audio.playVoice(letterClip, { rate: 1 + Math.random() * 0.08 });
  });

  // ------------------------------------------------------- word + object ----
  let arrived = false;
  let taps = 0;
  let wave = null;
  let acting = null;

  function waveWord(duration) {
    if (wave) wave.kill();
    wave = gsap.timeline();
    const step = Math.min(0.09, (duration * 0.6) / chars.length);
    chars.forEach((el, i) => {
      wave.to(el, { y: '-0.2em', scaleY: 1.12, duration: 0.14, ease: 'power2.out' }, i * step);
      wave.to(el, { y: 0, scaleY: 1, duration: 0.34, ease: 'bounce.out' }, i * step + 0.14);
    });
  }

  /** the object does its thing, the word is read, animals add their sound */
  async function react({ auto = false } = {}) {
    if (!arrived || destroyed) return;
    chantToken++;
    acting = motion.act();
    const voice = auto ? wordClips[0] : wordClips[++taps % wordClips.length];
    const handle = await audio.playVoice(voice);
    waveWord(handle ? handle.duration : 0.8);
    if (soundClip && handle && (await handle.done) && !destroyed) {
      await wait(60);
      audio.playVoice(soundClip);
    }
  }

  hit.addEventListener('click', () => {
    if (!arrived) return;
    sfx.pop(1.15);
    react();
  });
  wordBtn.addEventListener('click', () => {
    if (!arrived) return;
    sfx.tap();
    gsap.fromTo(wordBtn, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
    react();
  });

  // ------------------------------------------------------- follow-read ----
  let pressing = false;
  let rec = null;
  let busy = false;
  let autoStop = 0;
  let levelRaf = 0;
  let capTimer = 0;
  let modelFeatures = null;

  const setMic = (state) => micBtn && (micBtn.dataset.state = state);

  function tip(text, ms = 2200) {
    if (!micCap) return;
    micCap.textContent = text;
    micCap.classList.add('tip');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      micCap.textContent = '按住跟读';
      micCap.classList.remove('tip');
    }, ms);
  }

  // fingerprints of every word read by ten voices; fetched the first time the mic is used
  let templatesP = null;
  const templates = () =>
    (templatesP ||= import('../data/templates.json').then((m) => unpackTemplates(m.default)).catch(() => null));

  async function model() {
    if (!modelFeatures) {
      const buf = await audio.load(wordClips[0]);
      modelFeatures = buf ? analyse(buf.getChannelData(0), buf.sampleRate) : { span: 0.6, beats: 1 };
    }
    return modelFeatures;
  }

  function showPraise(tier) {
    const P = PRAISE[tier];
    praise.replaceChildren();
    praise.append(
      h(
        'div.pr-text',
        {},
        ...[...P.text].map((ch, i) => h('span', { vars: { '--i': i, '--c': RAINBOW[i % RAINBOW.length] } }, ch)),
      ),
    );
    if (P.stars) {
      praise.append(
        h(
          'div.pr-stars',
          {},
          ...[0, 1, 2].map((i) => h(`span.pr-star${i < P.stars ? '.on' : ''}`, { vars: { '--i': i }, html: STAR_SVG })),
        ),
      );
      for (let i = 0; i < P.stars; i++) sfx.note(7 + i * 2, 0.35 + i * 0.18, 0.25);
    }
    praise.dataset.tier = tier;
    praise.classList.remove('on');
    void praise.offsetWidth;
    praise.classList.add('on');
  }
  const hidePraise = () => praise.classList.remove('on');

  /** confetti, stars and a shower of paper flowers */
  function party(tier) {
    const n = { excellent: 1, great: 0.65, good: 0.35 }[tier] || 0;
    const c = screenToLocal(view.w / 2, view.h * 0.38);
    fx.confetti(c.x, c.y, Math.round(44 * n), { power: 1000 });
    fx.sparkle(c.x, c.y, Math.round(20 * n), { spread: 560, size: 62 });
    const flowers = ['flower_r', 'flower_y'].filter(hasArt);
    for (let i = 0; i < Math.round(14 * n) && flowers.length; i++) {
      const a = rand(0.12, 0.88) * Math.PI;
      const v = rand(520, 980);
      fx.emit({
        tex: tex(flowers[i % flowers.length]), x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: 900, drag: 0.8, life: rand(1.5, 2.3), size: rand(60, 105), spin: rand(-300, 300), rot: rand(360), sway: 60,
      });
    }
  }

  async function cheer(tier, pcm, sampleRate, attempt) {
    showPraise(tier);
    const voice = await audio.playVoice(clip(NARRATOR, 'praise', tier));
    if (tier === 'again') {
      sfx.boing();
      gsap.fromTo(micBtn, { rotation: -14 }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.4, 0.3)' });
      if (voice) await voice.done;
      await wait(700);
      hidePraise();
      return;
    }
    if (tier === 'excellent') sfx.chime();
    else sfx.sparkle();
    party(tier);
    acting = motion.act();
    if (voice) await voice.done;
    if (destroyed) return;
    // ... and now hear yourself
    const from = Math.max(0, attempt.from - 0.08);
    const to = Math.min(pcm.length / sampleRate, attempt.to + 0.15);
    setMic('play');
    const mine = audio.playPcm(pcm.subarray(Math.floor(from * sampleRate), Math.floor(to * sampleRate)), sampleRate);
    if (mine) await mine.done;
    await wait(250);
    hidePraise();
  }

  async function micDown(e) {
    if (!arrived || busy || destroyed) return;
    e.preventDefault();
    try {
      micBtn.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    pressing = true;
    busy = true;
    templates();
    chantToken++;
    audio.stopVoice();
    hidePraise();
    setMic('wait');
    wordBtn.classList.add('cue');
    sfx.tap();
    let session;
    const asked = performance.now();
    try {
      session = await startRecording();
    } catch (err) {
      console.warn('[mic]', err);
      pressing = false;
      busy = false;
      wordBtn.classList.remove('cue');
      setMic('off');
      tip(err && err.name === 'NotAllowedError' ? '请允许使用麦克风' : '麦克风暂时不可用', 3200);
      gsap.fromTo(micBtn, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.5, 0.3)' });
      setTimeout(() => !destroyed && setMic('idle'), 3200);
      return;
    }
    if (!pressing || destroyed) {
      await session.stop();
      busy = false;
      wordBtn.classList.remove('cue');
      setMic('idle');
      // a slow open usually means the browser just asked for permission
      tip(performance.now() - asked > 900 ? '好了！再按住说一遍' : '按住按钮，说完再松手', 3000);
      return;
    }
    rec = session;
    setMic('rec');
    const tick = () => {
      if (!rec) return;
      micBtn.style.setProperty('--lvl', rec.level().toFixed(3));
      levelRaf = requestAnimationFrame(tick);
    };
    tick();
    autoStop = setTimeout(micUp, 5000);
  }

  async function micUp() {
    if (!pressing && !rec) return;
    pressing = false;
    clearTimeout(autoStop);
    const session = rec;
    rec = null;
    cancelAnimationFrame(levelRaf);
    if (micBtn) micBtn.style.setProperty('--lvl', '0');
    if (!session) return; // still opening: micDown finishes the job
    const held = session.elapsed();
    const { pcm, sampleRate } = await session.stop();
    wordBtn.classList.remove('cue');
    if (destroyed) return;
    if (held < 0.45) {
      busy = false;
      setMic('idle');
      tip('按住按钮，说完再松手');
      return;
    }
    setMic('think');
    const attempt = analyse(pcm, sampleRate);
    let rank = 0;
    const T = attempt.voiced > 0 ? await templates() : null;
    if (T) rank = placeAmong(compact(fingerprint(pcm, sampleRate)), T, id).rank;
    const { tier } = grade(attempt, await model(), rank);
    if (import.meta.env.DEV) window.__lastGrade = { tier, rank, attempt, model: await model() };
    await cheer(tier, pcm, sampleRate, attempt);
    busy = false;
    if (!destroyed) setMic('idle');
  }

  if (micBtn) {
    micBtn.addEventListener('pointerdown', micDown);
    micBtn.addEventListener('pointerup', micUp);
    micBtn.addEventListener('pointercancel', micUp);
    micBtn.addEventListener('lostpointercapture', micUp);
  }

  // ------------------------------------------------------------ nav ----
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
  let nudge = 0;
  gsap.set(bigLetter, { scale: 0 });
  gsap.set([wordBtn, nextBtn], { scale: 0 });
  if (readBox) gsap.set(readBox, { scale: 0 });

  function arrive() {
    // the arrival move kills the tail end of the entrance tweens, which can make GSAP
    // pass this callback a second time
    if (arrived) return;
    arrived = true;
    gsap.to(wordBtn, { scale: 1, duration: 0.5, ease: 'back.out(1.8)' });
    react({ auto: true });
    if (readBox) gsap.to(readBox, { scale: 1, duration: 0.5, ease: 'back.out(2)', delay: 1.1 });
    gsap.to(nextBtn, { scale: 1, duration: 0.5, ease: 'back.out(2)', delay: 1.5 });
    nudge = setTimeout(() => nextBtn.classList.add('nudge'), 4500);
  }

  function start() {
    intro = gsap.timeline();
    intro.to(bigLetter, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0.05);
    const letterDur = timing(NARRATOR, 'letter', id)?.dur ?? 0.5;
    const chantLen = audio.canPlay() ? 3 * letterDur + 2 * 0.2 : 0;
    intro.call(() => chant(3), null, 0.2);
    const tEnter = 0.2 + Math.max(0.5, chantLen - 0.45);
    intro.call(() => { mover.visible = true; }, null, tEnter);
    const D = motion.enter(intro, tEnter);
    intro.call(arrive, null, tEnter + D);
  }

  // Warm the next page so "next" feels instant.
  const warm = setTimeout(() => {
    import('./story.js').then((m) => m.prefetch && m.prefetch(id)).catch(() => {});
  }, 2500);

  return {
    layout,
    start,
    revealAt() {
      const r = stage.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    destroy() {
      destroyed = true;
      chantToken++;
      clearTimeout(warm);
      clearTimeout(nudge);
      clearTimeout(autoStop);
      clearTimeout(capTimer);
      cancelAnimationFrame(levelRaf);
      if (rec) rec.stop().catch(() => {});
      rec = null;
      audio.stopVoice();
      if (intro) intro.kill();
      if (wave) wave.kill();
      if (acting) acting.kill();
      motion.kill();
      gsap.killTweensOf([mover, rocker, rocker.scale, hero, blob, glyphs, bigLetter, wordBtn, nextBtn, readBox, micBtn, ...chars].filter(Boolean));
      stopFrame();
      stopResize();
      release();
      fx.clear();
      clearLayer(world);
      Backdrop.clear();
      // keep only this hero warm for the story page; older heroes are freed
      releaseArt(LETTERS.map((l) => l.art).filter((n) => n !== L.art));
    },
  };
}
