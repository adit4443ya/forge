#!/usr/bin/env node
/* Opens guides the way a person does: Learn → Guides tab → click the card.
   The earlier smoke test loaded guide URLs directly, so it passed while every
   link in the UI pointed at a route that no longer rendered a guide. */
import puppeteer from 'puppeteer-core';
import { GUIDES } from '../src/data/generated/guides.js';

const BASE = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const openGuidesTab = async () => {
  await page.goto(BASE + '/learn', { waitUntil: 'networkidle0' });
  await wait(500);
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith('Guides'))?.click());
  await wait(500);
};

const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

/* ── every guide card navigates to a rendered guide ──────────────────── */
console.log(`\nclicking every guide card (${GUIDES.length})`);
await openGuidesTab();
let opened = 0;
for (const g of GUIDES) {
  const before = errors.length;
  const clicked = await page.evaluate((title) => {
    const span = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === title);
    if (!span) return false;
    let el = span;
    for (let i = 0; i < 6 && el; i++) {
      if (getComputedStyle(el).cursor === 'pointer') { el.click(); return true; }
      el = el.parentElement;
    }
    return false;
  }, g.title);
  if (!clicked) { ok(`${g.num} card present`, false, 'no clickable card found'); continue; }
  await wait(700);
  const url = new URL(page.url()).pathname;
  const prose = await page.evaluate(() => document.querySelector('.prose')?.innerText.length || 0);
  const good = url === `/learn/guide/${g.num}` && prose > 500 && errors.length === before;
  if (good) opened++;
  else ok(`${g.num} ${g.title.slice(0, 42)}`, false, `url=${url} prose=${prose}`);
  await openGuidesTab();
}
ok(`all ${GUIDES.length} guides open from the list`, opened === GUIDES.length, `${opened}/${GUIDES.length}`);

/* ── legacy query-param links still work ─────────────────────────────── */
console.log('\nlegacy links');
await page.goto(BASE + '/learn?guide=17', { waitUntil: 'networkidle0' });
await wait(900);
ok('/learn?guide=17 redirects to the guide', new URL(page.url()).pathname === '/learn/guide/17', page.url());
ok('  and renders it', (await bodyText()).includes('Linux for Low Latency'));

/* ── the command palette opens a guide, and a heading anchor ─────────── */
console.log('\ncommand palette');
await page.goto(BASE + '/today', { waitUntil: 'networkidle0' });
await wait(400);
await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
await wait(400);
await page.keyboard.type('Networking for Trading');
await wait(500);
const hits = await page.$$eval('[data-i]', (e) => e.length).catch(() => 0);
ok('palette finds the guide', hits > 0, `${hits} results`);
await page.keyboard.press('Enter');
await wait(1000);
ok('palette opens the guide', new URL(page.url()).pathname.startsWith('/learn/guide/'), page.url());
ok('  content rendered', (await page.evaluate(() => document.querySelector('.prose')?.innerText.length || 0)) > 500);

/* A heading result carries an anchor. Click the Guide-kind row explicitly:
   pressing Enter blindly picks whatever ranks first, which may be a lab. */
await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
await wait(400);
await page.keyboard.type('NUMA');
await wait(600);
const pickedGuide = await page.evaluate(() => {
  const row = [...document.querySelectorAll('[data-i]')].find((e) => e.innerText.startsWith('Guide'));
  if (!row) return null;
  const label = row.innerText.split('\n')[1] || '';
  row.click();
  return label;
});
if (pickedGuide) {
  await wait(1300);
  const res = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY === 'auto');
    return { hash: location.hash, scrollTop: el ? el.scrollTop : -1 };
  });
  ok(`heading "${pickedGuide}" adds an anchor`, res.hash.length > 1, res.hash || '(none)');
  ok('  and scrolls the guide to it', res.scrollTop > 50, `scrollTop ${res.scrollTop}`);
} else {
  ok('palette has a guide-heading result', false, 'none found');
}

/* ── back button returns to the list ─────────────────────────────────── */
console.log('\nnavigation');
await openGuidesTab();
await page.evaluate(() => {
  const span = [...document.querySelectorAll('span')].find((s) => s.textContent.trim().startsWith('Toolchain Field Manual'));
  let el = span; for (let i = 0; i < 6 && el; i++) { if (getComputedStyle(el).cursor === 'pointer') { el.click(); return; } el = el.parentElement; }
});
await wait(800);
ok('opened guide 21', new URL(page.url()).pathname === '/learn/guide/21', page.url());
await page.goBack({ waitUntil: 'networkidle0' });
await wait(700);
ok('back returns to /learn', new URL(page.url()).pathname === '/learn');
await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Library'))?.click());

await browser.close();
console.log(`\nconsole errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e));
if (errors.length) fails += errors.length;
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mevery guide opens from the UI\x1b[0m\n');
process.exit(fails ? 1 : 0);
