#!/usr/bin/env node
/* The elapsed time was silently zero because it was computed inside a state
   updater, which React runs lazily — after the clock had been reset. Timing is
   the whole point of a timed drill, so it is asserted with real delays. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));

await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(600);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('Mental math'))?.click()); await w(500);
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('▶ Start'))?.click()); await w(700);

const PAUSE = 1200;
for (let k = 0; k < 3; k++) {
  await w(PAUSE);
  await p.type('.mm-input', '1');
  await p.keyboard.press('Enter');
  await w(250);
}
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'end')?.click()); await w(700);

const times = await p.$$eval('.mm-result', (rs) =>
  rs.map((r) => parseFloat((r.innerText.match(/([\d.]+)s/) || [])[1] || '0')));
const avgText = await p.evaluate(() => (document.body.innerText.match(/([\d.]+)s average/) || [])[1]);

console.log('\nmental math timing');
ok(`each question timed (${times.map((t) => t + 's').join(', ')})`, times.length === 3 && times.every((t) => t >= PAUSE / 1000 * 0.7));
ok('none reported as zero', times.every((t) => t > 0.1));
ok(`average is real (${avgText}s)`, parseFloat(avgText) >= PAUSE / 1000 * 0.7, `expected ≥ ${(PAUSE / 1000 * 0.7).toFixed(1)}s`);

/* Wrong answers must show the technique, which is the reason to drill at all. */
const why = await p.$$eval('.mm-why', (e) => e.length);
ok('missed questions explain the method', why >= 3, `${why} explanations`);

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mtiming is correct\x1b[0m\n');
process.exit(fails ? 1 : 0);
