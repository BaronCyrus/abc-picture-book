// Hash router with an iris-wipe transition. Staying a single page keeps the audio
// context unlocked, so narration can start by itself after every tap.
import * as wipe from './wipe.js';
import * as audio from './audio.js';
import { h, nextFrame, icon, HAND_SVG } from './util.js';
import { PALETTE } from '../data/letters.js';

// Dev only: "?autostart" skips the cover so headless screenshots can run unattended.
const AUTOSTART = import.meta.env.DEV && new URLSearchParams(location.search).has('autostart');

/**
 * Browsers stay silent until the first touch, so the book opens on a cover:
 * one tap anywhere starts everything (music, narration) for the rest of the visit.
 */
async function cover() {
  if (AUTOSTART || audio.canPlay()) return;
  const blocks = [PALETTE.red, PALETTE.yellow, PALETTE.blue].map((pal, i) =>
    h('span.blk', { vars: { '--c': pal.base, '--cd': pal.dark } }, 'ABC'[i]),
  );
  const el = h(
    'button.cover',
    { 'aria-label': 'Start · 开始' },
    h('span.cover-title', {}, ...blocks),
    h('span.cover-sub', {}, 'Picture Book'),
    h('span.cover-play', { html: icon('play') }),
    h('span.cover-hand', { html: HAND_SVG }),
  );
  document.body.append(el);
  await new Promise((res) => el.addEventListener('click', res, { once: true }));
  await audio.unlock();
  audio.sfx.pop(1.1);
  audio.sfx.sparkle(0.08);
  el.classList.add('off');
  setTimeout(() => el.remove(), 500);
}

const app = document.getElementById('app');
const routes = [];
let current = null;
let busy = false;
let again = false;
let nextFx = null;
let first = true;

const loader = h('div.loader', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
document.body.append(loader);

export function route(pattern, load) {
  routes.push({ pattern, load });
}

/** @param fx { x, y, color } where the wipe grows from */
export function go(path, fx) {
  nextFx = fx || null;
  const hash = '#/' + path;
  if (location.hash === hash) render();
  else location.hash = hash;
}

export const currentPath = () => location.hash.replace(/^#\/?/, '');

function resolve(path) {
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) return { load: r.load, params: m.slice(1) };
  }
  return null;
}

async function render() {
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  const fx = nextFx || {};
  nextFx = null;
  let target = resolve(currentPath());
  if (!target) {
    history.replaceState(null, '', '#/');
    target = resolve('');
  }
  let timer = 0;
  try {
    if (first) wipe.coverNow(fx.color);
    else await wipe.cover(fx);
    if (current) current.destroy();
    current = null;
    app.replaceChildren();
    timer = setTimeout(() => loader.classList.add('on'), 500);
    const mod = await target.load();
    current = await mod.create(app, ...target.params);
    clearTimeout(timer);
    loader.classList.remove('on');
    await nextFrame(2);
    if (current.layout) current.layout();
    await nextFrame(1);
    const reveal = wipe.reveal(current.revealAt ? current.revealAt() : undefined);
    if (first) {
      await reveal;
      await cover();
    }
    if (current.start) current.start();
    await reveal;
  } catch (err) {
    clearTimeout(timer);
    loader.classList.remove('on');
    console.error('[router]', err);
    if (currentPath() !== '') {
      busy = false;
      first = false;
      go('');
      return;
    }
    wipe.reveal();
  }
  first = false;
  busy = false;
  if (again) {
    again = false;
    render();
  }
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
