// Checks a deployed build (no dev hooks needed): cover -> home -> a word page ->
// its story -> next letter -> a story opened straight from a link. Fails on page
// errors and on any request that comes back 4xx/5xx.
//
//   node tools/livecheck.mjs [baseUrl] [screenshotDir]
//   node tools/livecheck.mjs https://baroncyrus.github.io/abc-picture-book/ /tmp/live
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'https://baroncyrus.github.io/abc-picture-book/';
const SHOTS = process.argv[3] || null;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 80 });
const step = (...a) => console.log(' ', ...a);

const t0 = Date.now();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForSelector('button.cover', { timeout: 60000 });
step(`cover after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.locator('button.cover').tap({ force: true });
await page.waitForSelector('button.tile');
await page.waitForTimeout(3500);
step('home tiles:', await page.locator('button.tile').count());
await shot('live_home');

await page.tap('button.tile[aria-label^="K,"]');
await page.waitForSelector('.word-page');
await page.waitForSelector('.mic[data-state="idle"]', { timeout: 30000 });
await page.waitForTimeout(1800);
step('word page', await page.evaluate(() => location.hash), '| letter', await page.locator('.big-letter .up').textContent(), '| word', (await page.locator('.word .ch').allTextContents()).join(''));
await shot('live_word');

await page.locator('.btn.go').tap({ force: true });
await page.waitForSelector('.story-page');
await page.waitForSelector('.replay.on', { timeout: 30000 });
step('story finished', await page.evaluate(() => location.hash));
await page.locator('.btn.go').tap({ force: true });
await page.waitForSelector('.mic', { timeout: 30000 });
step('next ->', await page.evaluate(() => location.hash));

await page.goto(BASE + '#/x/story', { waitUntil: 'load' });
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('button.cover', { timeout: 60000 });
await page.locator('button.cover').tap({ force: true });
await page.waitForSelector('.replay.on', { timeout: 30000 });
step('story from a link finished', await page.evaluate(() => location.hash));

const uniq = [...new Set(problems)];
console.log(uniq.length ? 'PROBLEMS:\n' + uniq.join('\n') : 'NO ERRORS, NO FAILED REQUESTS');
await browser.close();
process.exit(uniq.length ? 1 : 0);
