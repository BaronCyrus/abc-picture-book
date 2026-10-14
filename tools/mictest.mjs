// Follow-read check (dev only): feeds a WAV file to the page as the microphone,
// (the WAV starts playing when the microphone is opened, so keep ~0.3 s of lead-in)
// holds the microphone button on a word page, and reports the cheer it got.
//
//   node tools/mictest.mjs <letter> <file.wav> [holdSeconds]
//   SHOT=cheer.jpg SHOT_AT=1100 node tools/mictest.mjs ...   (screenshot 1.1 s after release)
import { chromium } from 'playwright-core';

const [id = 'a', wav, hold = '2.4'] = process.argv.slice(2);
const BASE = process.env.SHOTS_BASE || 'http://localhost:5183/';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--mute-audio', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, permissions: ['microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${BASE}?autostart#/lab/meadow`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.mouse.click(5, 5); // a real input event unlocks Web Audio
await page.evaluate((i) => { location.hash = `#/${i}`; }, id);
await page.waitForSelector('.mic[data-state="idle"]', { timeout: 20000 });
await page.waitForTimeout(2500);
const box = await page.locator('.mic').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
// warm-up press: the very first microphone open is slow (on phones it is the permission prompt)
await page.mouse.down();
await page.waitForTimeout(250);
await page.mouse.up();
await page.waitForFunction(() => document.querySelector('.mic').dataset.state === 'idle', null, { timeout: 15000 });
await page.waitForTimeout(600);
await page.mouse.down();
await page.waitForTimeout(Number(hold) * 1000);
const during = await page.evaluate(() => document.querySelector('.mic').dataset.state);
await page.mouse.up();
await page.waitForFunction(() => window.__lastGrade, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(500);
const res = await page.evaluate(() => ({
  grade: window.__lastGrade && { tier: window.__lastGrade.tier, rank: window.__lastGrade.rank, attempt: window.__lastGrade.attempt, model: window.__lastGrade.model },
  shown: document.querySelector('.praise.on .pr-text')?.textContent || null,
  stars: document.querySelectorAll('.praise.on .pr-star.on').length,
  mic: document.querySelector('.mic').dataset.state,
}));
if (process.env.SHOT) {
  await page.waitForTimeout(Math.max(0, Number(process.env.SHOT_AT || 500) - 500));
  await page.screenshot({ path: process.env.SHOT, type: 'jpeg', quality: 82 });
}
const r2 = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]));
console.log(JSON.stringify({ input: wav.split('/').pop(), stateWhileHolding: during, tier: res.grade?.tier, rank: res.grade?.rank, shown: res.shown, stars: res.stars, after: res.mic, attempt: r2(res.grade?.attempt), model: r2(res.grade?.model) }));
if (errors.length) console.log('ERRORS', errors);
await browser.close();
