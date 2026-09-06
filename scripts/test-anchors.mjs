#!/usr/bin/env node
/* Every contents entry must reach a heading that exists, and clicking it must
   actually move the reader. Deriving the id two different ways gave 63 dead
   links across five guides while looking completely fine. */
import puppeteer from 'puppeteer-core';
import { GUIDES } from '../src/data/generated/guides.js';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`\nevery contents entry resolves (${GUIDES.length} guides)`);
let deadTotal = 0, malformed = 0, checked = 0, worst = '';
for (const g of GUIDES) {
  await p.goto(`${B}/learn/guide/${g.num}`, { waitUntil: 'domcontentloaded' });
  await w(240);
  const r = await p.evaluate((expected) => {
    const ids = new Set([...document.querySelectorAll('h1[id],h2[id],h3[id]')].map((h) => h.id));
    /* Only [object Object] is malformed — "object" itself is a real word
       in ids like print-object-layout. */
    return { dead: expected.filter((e) => !ids.has(e)), bad: [...ids].filter((i) => /object-object/.test(i) || i === '') };
  }, g.headings.map((h) => h.id));
  checked += g.headings.length;
  deadTotal += r.dead.length; malformed += r.bad.length;
  if (r.dead.length && !worst) worst = `guide ${g.num}: ${r.dead.slice(0, 2).join(', ')}`;
}
ok(`no malformed heading ids (${checked} headings checked)`, malformed === 0, `${malformed} malformed`);
ok('no contents entry points at a missing heading', deadTotal === 0, `${deadTotal} dead — ${worst}`);

console.log('\nclicking a contents entry scrolls the reader');
await p.goto(`${B}/learn/guide/17`, { waitUntil: 'networkidle0' }); await w(800);
const top = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === 'auto');
  return el ? el.scrollTop : -1;
});
const reset = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === 'auto');
  if (el) el.scrollTop = 0;
});
let moved = 0;
for (const i of [2, 6, 11]) {
  await reset(); await w(200);
  await p.evaluate((n) => document.querySelectorAll('aside button')[n]?.click(), i);
  await w(900);
  if (await top() > 60) moved++;
}
ok(`three different entries each scroll (${moved}/3)`, moved === 3);

console.log('\n"start here" scrolls to the competency it opens');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.setItem('forge-progress-v2', JSON.stringify({ version: 2, prefs: { rolePicked: { value: true, at: Date.now() } } })));
await p.goto(`${B}/learn`, { waitUntil: 'networkidle0' }); await w(900);
/* Find the element that genuinely scrolls rather than assuming a class:
   .pane delegates to an inner div, and measuring the wrong one reported a
   working scroll as broken. */
const SCROLLER = `[...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY))`;
const scrollTop = () => p.evaluate(`(${SCROLLER})?.scrollTop ?? -1`);
const before = await scrollTop();
await p.evaluate(() => document.querySelector('.cm-next')?.click());
await w(1500);
const after = await scrollTop();
ok(`the pane scrolls (${before} -> ${after})`, after > before + 40, 'it used to stay at 0');
ok('and the competency opened', await p.evaluate(() => /how it is tested/i.test(document.body.innerText)));

await p.goto(`${B}/learn`, { waitUntil: 'networkidle0' }); await w(900);
await p.evaluate(() => document.querySelectorAll('.cm-row')[3]?.click());
await w(1500);
ok('a coverage-map row scrolls too', (await scrollTop()) > 40);

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mevery anchor resolves and scrolls\x1b[0m\n');
process.exit(fails ? 1 : 0);
