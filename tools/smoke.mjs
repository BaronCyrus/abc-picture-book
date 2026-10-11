// End-to-end smoke test (dev only): taps through the real flow on a phone-sized
// touch viewport, then opens every letter's word page and plays every story to
// the end, failing on any page error.
//
//   node tools/smoke.mjs            (needs the dev server on :5183)
import { chromium } from 'playwright-core';

const BASE = process.env.SHOTS_BASE || 'http://localhost:5183/';
const IDS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text());
});
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
});
const log = (...a) => console.log(...a);
const hash = () => page.evaluate(() => location.hash);
const ok = (cond, msg) => {
  log(cond ? '  ok  ' : '  FAIL', msg);
  if (!cond) errors.push('assert: ' + msg);
};

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForSelector('button.cover');
await page.waitForTimeout(1200);
ok(true, 'the book opens on its cover');
ok(!(await page.evaluate(() => window.__audio.canPlay())), 'no sound before the first touch (browser rule)');
if (process.env.SHOT_DIR) await page.screenshot({ path: process.env.SHOT_DIR + '/cover.jpg', type: 'jpeg', quality: 82 });
await page.locator('button.cover').tap({ force: true });
await page.waitForTimeout(700);
ok(await page.evaluate(() => window.__audio.canPlay()), 'tapping the cover unlocks sound');
ok(await page.evaluate(() => window.__music.playing), 'cheerful background music starts on the home page');
await page.waitForTimeout(3600);
ok((await page.locator('button.cover').count()) === 0, 'the cover is gone');
ok((await page.locator('button.tile').count()) === 26, 'home shows 26 letter tiles');
ok((await page.locator('.hand-hint.on').count()) === 1, 'first visit: a hand shows where to tap');
if (process.env.SHOT_DIR) await page.screenshot({ path: process.env.SHOT_DIR + '/home_first.jpg', type: 'jpeg', quality: 82 });
ok(await page.evaluate(() => getComputedStyle(document.querySelector('.tile .glyph')).animationName === 'sway'), 'letters sway');
await page.locator('.btn.music').tap({ force: true });
await page.waitForTimeout(500);
ok(!(await page.evaluate(() => window.__music.playing)), 'the music button switches the music off');
await page.locator('.btn.music').tap({ force: true });
await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__music.playing), '... and on again');
ok((await page.locator('button.tile img.sticker').count()) === 26, 'every tile has its picture sticker');

log('tap A on the home path');
await page.tap('button.tile[aria-label^="A,"]');
await page.waitForSelector('.word-page');
await page.waitForTimeout(3600);
ok((await hash()) === '#/a', 'opens the word page for A');
ok(!(await page.evaluate(() => window.__music.playing)), 'music stops when leaving the home page');
ok((await page.locator('.word .ch').allTextContents()).join('') === 'apple', 'shows the word "apple"');

log('tap the picture, then the word');
await page.tap('.slot .hit');
await page.waitForTimeout(250);
ok(await page.evaluate(() => window.__audio.playing()), 'tapping the picture speaks the word');
await page.waitForTimeout(1300);
await page.tap('button.word');
await page.waitForTimeout(250);
ok(await page.evaluate(() => window.__audio.playing()), 'tapping the word speaks it again');
await page.waitForTimeout(1200);

log('next -> story');
await page.locator('.btn.go').tap({ force: true });
await page.waitForSelector('.story-page');
ok((await hash()) === '#/a/story', 'opens the story page');
await page.waitForSelector('.replay.on', { timeout: 20000 });
ok(true, 'story plays once and comes to rest');
const pix = () => page.evaluate(() => {
  const c = document.getElementById('gl');
  const t = document.createElement('canvas');
  t.width = 64; t.height = 64;
  const g = t.getContext('2d');
  g.drawImage(c, 0, 0, 64, 64);
  return Array.from(g.getImageData(0, 0, 64, 64).data).reduce((a, b) => (a * 31 + b) % 1000000007, 7);
});
// compare only the picture (the "next" button below it keeps breathing as a hint)
const still = { x: 0, y: 120, width: 390, height: 380 };
const a1 = await page.screenshot({ type: 'png', clip: still });
await page.waitForTimeout(900);
const a2 = await page.screenshot({ type: 'png', clip: still });
ok(Buffer.compare(a1, a2) === 0, 'the finished picture is perfectly still');
log('tap the still picture');
await page.tap('.story-page .slot .hit');
await page.waitForTimeout(700);
ok((await page.locator('.replay.on').count()) === 0, 'tapping the picture replays the animation');
await page.waitForSelector('.replay.on', { timeout: 20000 });
await page.tap('button.line');
await page.waitForTimeout(250);
ok(await page.evaluate(() => window.__audio.playing()), 'tapping the sentence reads it again');
await page.waitForTimeout(1500);

log('next -> B, back, home');
await page.locator('.btn.go').tap({ force: true });
await page.waitForSelector('.word-page');
await page.waitForTimeout(1500);
ok((await hash()) === '#/b', 'next goes on to letter B');
await page.locator('.btn.tl').tap({ force: true });
await page.waitForSelector('button.tile');
await page.waitForTimeout(1500);
ok((await hash()) === '#/', 'home button returns to the path');
ok((await page.locator('button.tile .star').count()) === 1, 'finished letter A wears a star');
ok((await page.locator('.hand-hint').count()) === 0, 'the hand hint does not come back');
ok(await page.evaluate(() => window.__music.playing), 'music is back on the home page');

log('every letter: word page + full story');
for (const id of IDS) {
  await page.evaluate((i) => { location.hash = `#/${i}`; }, id);
  await page.waitForFunction((i) => location.hash === `#/${i}` && document.querySelector('.word-page'), id, { timeout: 20000 });
  await page.waitForTimeout(900);
  const t0 = Date.now();
  await page.evaluate((i) => { location.hash = `#/${i}/story`; }, id);
  await page.waitForFunction((i) => window.__story && window.__story.id === i, id, { timeout: 20000 });
  await page.waitForSelector('.replay.on', { timeout: 25000 });
  log(`  ${id}  story finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForSelector('button.tile');
await page.waitForTimeout(1200);
ok((await page.locator('button.tile .star').count()) === 26, 'all 26 letters now wear a star');

const uniq = [...new Set(errors)];
log(uniq.length ? `\n${uniq.length} PROBLEM(S):\n` + uniq.join('\n') : '\nALL GOOD - no errors');
await browser.close();
process.exit(uniq.length ? 1 : 0);
