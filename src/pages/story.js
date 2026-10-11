// Story page: a short sentence acted out as a paper-theatre scene. It plays once
// with narration (words light up as they are spoken), then rests as a still
// picture-book page. Tapping the picture plays it again.
import gsap from 'gsap';
import { h, icon } from '../core/util.js';
import { LETTERS, byId, clip, timing } from '../data/letters.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { sfx } from '../core/audio.js';
import { store, session } from '../core/store.js';
import { Backdrop, SCENES } from '../gl/backdrop.js';
import { world, setStageRect, hold, clearLayer, onFrame, onResize, invalidate, BOX } from '../gl/engine.js';
import { loadAll, tex, release as releaseArt, hasArt } from '../gl/assets.js';
import { Sprite, Node2D } from '../gl/sprite.js';
import { shapes, Rope } from '../gl/shapes.js';
import { Particles } from '../gl/fx.js';
import { Kid, KID_ART } from '../gl/kid.js';

const sceneModules = import.meta.glob('../scenes/*.js');

async function loadScene(id) {
  const load = sceneModules[`../scenes/${id}.js`] || sceneModules['../scenes/_fallback.js'];
  return (await load()).default;
}

function sceneArt(scene, L) {
  const names = [...(scene.art || []), ...(scene.kid ? KID_ART : [])];
  if (scene.hero !== false) names.push(L.art);
  return [...new Set(names)].filter(hasArt);
}

export async function prefetch(id) {
  const L = byId[id];
  const scene = await loadScene(id);
  await Promise.all([loadAll(sceneArt(scene, L), false), audio.load(clip('ava', 'sentence', id))]);
}

export async function create(root, id) {
  const L = byId[id];
  if (!L) throw new Error(`no letter ${id}`);
  session.lastLetter = id;
  const scene = await loadScene(id);
  const art = sceneArt(scene, L);
  const voicePath = clip('ava', 'sentence', id);
  await Promise.all([loadAll(art), loadAll(KID_ART.filter(hasArt), true), audio.load(voicePath)]);

  // ------------------------------------------------------------- DOM ----
  const page = h(`div.page.story-page${store.zh ? '.show-zh' : ''}`, {
    vars: { '--c': L.pal.base, '--cd': L.pal.dark },
  });
  const hit = h('button.hit', { 'aria-label': 'play again' });
  const replay = h('div.btn.replay', { html: icon('replay') });
  const slot = h('div.slot', {}, hit, replay);

  // split the sentence into words, keeping punctuation glued to its word
  const tokens = L.sentence.split(' ');
  const keyWords = new Set(L.word.toLowerCase().split(' '));
  const wordEls = tokens.map((tok) => {
    const bare = tok.toLowerCase().replace(/[^a-z-]/g, '');
    return h(`span.w${keyWords.has(bare) ? '.key' : ''}`, {}, tok);
  });
  const line = h('button.line', { 'aria-label': L.sentence }, ...wordEls);
  const lineBox = h('div.linebox', {}, line, h('div.zhline', { lang: 'zh' }, L.sentenceZh));
  const backBtn = h('button.btn.bl', { 'aria-label': 'back', html: icon('prev') });
  const homeBtn = h('button.btn.tl', { 'aria-label': 'home', html: icon('home') });
  const nextBtn = h('button.btn.go.br', { 'aria-label': 'next', html: icon('next') });
  const chip = h('div.story-letters', { 'aria-hidden': 'true' }, h('span.up', {}, L.upper), h('span.lo', {}, L.lower));
  page.append(slot, chip, lineBox, homeBtn, backBtn, nextBtn);
  root.append(page);

  // The scene is drawn as large as the screen allows: its ground line (y = -300) rests
  // just above the sentence card, and the card overlaps the empty foreground below it.
  const layout = () => {
    const W = window.innerWidth;
    const card = line.getBoundingClientRect();
    // Up to 6% may bleed off each side on narrow screens; scenes keep their action inside.
    const scale = Math.min(W / 880, (card.top - 6) / 872);
    const size = BOX * scale;
    // On tall screens there is room to spare: lift the ground a little so the picture
    // sits more in the middle instead of hugging the card.
    const spare = card.top - size * 0.9;
    const offset = Math.min(size * 0.2, Math.max(size * 0.066, spare * 0.35));
    const cy = card.top - offset - 300 * scale;
    setStageRect({ left: W / 2 - size / 2, top: cy - size / 2, width: size, height: size });
    slot.style.height = `${Math.max(120, card.top - 8)}px`;
    invalidate();
  };
  const stopResize = onResize(() => requestAnimationFrame(layout));

  // ----------------------------------------------------- narration ----
  let karaoke = 0;
  function stopKaraoke() {
    cancelAnimationFrame(karaoke);
    wordEls.forEach((el) => el.classList.remove('now'));
  }

  /** Speak the sentence and light the words up in time with the voice. */
  async function speak() {
    audio.unlock();
    stopKaraoke();
    const info = timing('ava', 'sentence', id);
    const handle = await audio.playVoice(voicePath);
    const words = info?.words || [];
    // map each timed word to its span (timings may merge/split tokens differently)
    let cursor = 0;
    const marks = words.map((wd) => {
      const target = wd.w.toLowerCase().replace(/[^a-z]/g, '');
      for (let k = cursor; k < tokens.length; k++) {
        const bare = tokens[k].toLowerCase().replace(/[^a-z]/g, '');
        if (bare === target || bare.startsWith(target) || target.startsWith(bare)) {
          cursor = k + 1;
          return { t: wd.t, el: wordEls[k] };
        }
      }
      return { t: wd.t, el: null };
    });
    const t0 = performance.now();
    const total = handle ? handle.duration : info?.dur ?? 1.5;
    const tick = () => {
      const t = handle ? handle.time() : (performance.now() - t0) / 1000;
      let cur = null;
      for (const m of marks) if (t >= m.t - 0.03) cur = m.el;
      wordEls.forEach((el) => el.classList.toggle('now', el === cur && t < total));
      if (t < total + 0.1 && (!handle || !handle.cancelled)) karaoke = requestAnimationFrame(tick);
      else wordEls.forEach((el) => el.classList.remove('now'));
    };
    karaoke = requestAnimationFrame(tick);
    return handle;
  }

  // --------------------------------------------------------- scene ----
  let tl = null;
  let fx = null;
  let frameFns = [];
  let releaseHold = null;
  let playing = false;
  let finished = false;
  let probing = false;

  const stopFrame = onFrame((dt, t) => {
    if (fx) fx.update(dt);
    for (const fn of frameFns) fn(dt, t);
  });

  function teardown() {
    if (tl) tl.kill();
    tl = null;
    world.traverse((o) => {
      gsap.killTweensOf(o);
      if (o.scale) gsap.killTweensOf(o.scale);
      if (o.j) gsap.killTweensOf(o.j);
      if (o.u) for (const k in o.u) if (o.u[k]?.value?.isVector4 || o.u[k]?.value?.isVector3) gsap.killTweensOf(o.u[k].value);
    });
    for (const fn of cleanups) fn();
    cleanups = [];
    frameFns = [];
    if (fx) fx.clear();
    clearLayer(world);
    Backdrop.clear();
  }
  let cleanups = [];

  function build() {
    teardown();
    const cfg = typeof scene.backdrop === 'function' ? scene.backdrop(SCENES) : SCENES[scene.backdrop || 'meadow']();
    const bd = new Backdrop(cfg);
    fx = new Particles(world, 700);
    tl = gsap.timeline({ paused: true });
    const S = {
      L,
      tl,
      bd,
      fx,
      world,
      sfx: probing ? new Proxy({}, { get: () => () => {} }) : sfx,
      ground: -300,
      /** illustrated sprite by art name */
      sprite: (name, o = {}) => new Sprite(tex(name), o).addTo(o.parent || world),
      /** code-drawn paper shape (texture from shapes.*) */
      paper: (texture, o = {}) => new Sprite(texture, o).addTo(o.parent || world),
      group: (o = {}) => new Node2D().addTo(o.parent || world),
      kid: (o = {}) => new Kid(o).addTo(world),
      rope: (o = {}) => {
        const r = new Rope(o);
        world.add(r);
        return r;
      },
      /** run fn(dt, time) every frame while the scene is playing */
      each: (fn) => frameFns.push(fn),
      /** start the narration at timeline time `at` */
      say: (at) => tl.call(() => !probing && speak(), null, at),
      /** endless ambient tween that is stopped when the scene rests */
      loop: (target, vars) => {
        const tw = gsap.to(target, { repeat: -1, yoyo: true, ease: 'sine.inOut', ...vars });
        cleanups.push(() => tw.kill());
        return tw;
      },
      onCleanup: (fn) => cleanups.push(fn),
    };
    scene.build(S);
    tl.eventCallback('onComplete', finish);
  }

  function play() {
    if (playing) return;
    playing = true;
    finished = false;
    replay.classList.remove('on');
    nextBtn.classList.remove('nudge');
    audio.stopVoice();
    stopKaraoke();
    build();
    layout();
    if (!releaseHold) releaseHold = hold();
    tl.play(0);
  }

  function finish() {
    // let particles settle, then freeze into a still page
    const settle = () => {
      if (!playing) return;
      if (fx && fx.active) {
        setTimeout(settle, 120);
        return;
      }
      playing = false;
      finished = true;
      for (const fn of cleanups) fn();
      cleanups = [];
      frameFns = [];
      if (releaseHold) releaseHold();
      releaseHold = null;
      replay.classList.add('on');
      nextBtn.classList.add('nudge');
      if (store.markDone(id)) sfx.chime();
    };
    setTimeout(settle, 250);
  }

  hit.addEventListener('click', () => {
    if (playing) return;
    sfx.pop();
    play();
  });
  line.addEventListener('click', () => {
    sfx.tap();
    speak();
  });
  const at = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  homeBtn.addEventListener('click', () => {
    sfx.tap();
    go('', { ...at(homeBtn), color: '#cfeaf9' });
  });
  backBtn.addEventListener('click', () => {
    sfx.tap();
    go(id, { ...at(backBtn), color: L.bg });
  });
  nextBtn.addEventListener('click', () => {
    sfx.pop();
    const next = LETTERS[L.index + 1];
    if (next) go(next.id, { ...at(nextBtn), color: next.bg });
    else go('', { ...at(nextBtn), color: '#cfeaf9' });
  });

  // First frame: build the scene so the reveal opens onto its opening pose.
  build();
  if (import.meta.env.DEV) {
    // Dev probe: __story.at(2.5) rebuilds the scene and jumps to that time (silently).
    window.__story = {
      id,
      get tl() { return tl; },
      play,
      at(t) {
        probing = true;
        playing = false;
        build();
        layout();
        tl.seek(t, false);
        if (fx) fx.update(0.25);
        invalidate();
        probing = false;
        return `${t} / ${tl.duration().toFixed(2)}`;
      },
    };
  }

  return {
    layout,
    start() {
      playing = false;
      play();
    },
    revealAt: () => at(slot),
    destroy() {
      playing = false;
      audio.stopVoice();
      stopKaraoke();
      teardown();
      stopFrame();
      stopResize();
      if (releaseHold) releaseHold();
      releaseArt(art.filter((n) => !KID_ART.includes(n)));
    },
  };
}
