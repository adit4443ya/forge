#!/usr/bin/env node
/* Labs are the surface a person said felt disconnected, so its contract is
   tested explicitly: every lab opens from the list, a lab with steps shows
   copyable commands and reference output, and the evidence note persists. */
import puppeteer from 'puppeteer-core';
import { LAB_INDEX } from '../src/data/generated/labs.js';

const BASE = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 150)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 150)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── every lab page renders ───────────────────────────────────────────── */
console.log(`\nevery lab page (${LAB_INDEX.length}) over HTTP`);
let httpOk = 0;
for (const l of LAB_INDEX) {
  const res = await fetch(`${BASE}/labs/${l.id}`);
  const html = await res.text();
  if (res.status !== 200) { errors.push(`[${l.id}] HTTP ${res.status}`); continue; }
  if (html.length < 6000) { errors.push(`[${l.id}] only ${html.length} bytes`); continue; }
  httpOk++;
}
ok(`all ${LAB_INDEX.length} lab pages render server-side`, httpOk === LAB_INDEX.length, `${httpOk}/${LAB_INDEX.length}`);

/* ── the guided runner ────────────────────────────────────────────────── */
console.log('\nguided runner (perf-01)');
await page.goto(`${BASE}/labs/perf-01`, { waitUntil: 'networkidle0' });
await wait(700);
const r = await page.evaluate(() => ({
  steps: document.querySelectorAll('.lab-step').length,
  cmds: document.querySelectorAll('.lab-cmd').length,
  copies: document.querySelectorAll('.copy-btn').length,
  outputs: document.querySelectorAll('.lab-out').length,
  teaches: (document.querySelector('.lab-lede')?.innerText || '').length,
  evidence: /evidence to leave with/i.test(document.body.innerText),
}));
ok('steps rendered', r.steps >= 4, `${r.steps} steps`);
ok('commands are copyable', r.copies >= r.cmds && r.cmds > 0, `${r.cmds} commands, ${r.copies} copy buttons`);
ok('reference output shown', r.outputs > 0, `${r.outputs} output blocks`);
ok('teaches section present', r.teaches > 200, `${r.teaches} chars`);
ok('evidence prompt present', r.evidence);

/* ticking a step updates progress */
await page.evaluate(() => document.querySelector('.lab-step-head')?.click());
await wait(400);
ok('ticking a step marks it done', await page.$eval('.lab-step', (e) => e.dataset.done === '1'));

/* ── evidence note persists ───────────────────────────────────────────── */
console.log('\nevidence note');
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Write it|Edit/.test(b.textContent))?.click());
await wait(400);
const typed = 'p50 was 28.9 ms pinned and 53.8 ms on an E-core.';
await page.evaluate((t) => {
  const ta = document.querySelector('.lab-textarea');
  if (!ta) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, t);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}, typed);
await wait(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save note'))?.click());
await wait(500);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('forge-progress-v2') || '{}').evidence?.['perf-01']?.claim || '');
ok('note saved to progress', stored === typed, stored.slice(0, 40));
await page.reload({ waitUntil: 'networkidle0' });
await wait(700);
ok('note survives a reload', (await page.evaluate(() => document.body.innerText)).includes('28.9 ms'));

/* ── the list links into the runner ───────────────────────────────────── */
console.log('\nlab list');
await page.goto(`${BASE}/labs`, { waitUntil: 'networkidle0' });
await wait(700);
const cards = await page.$$eval('.lab-card', (e) => e.length);
ok('cards rendered', cards > 20, `${cards} cards`);
await page.evaluate(() => document.querySelector('.lab-card-link')?.click());
await wait(800);
ok('a card opens the runner', /\/labs\/[a-z0-9-]+$/.test(new URL(page.url()).pathname), page.url());

/* ── markdown labs still render ───────────────────────────────────────── */
await page.goto(`${BASE}/labs/bigcode-01`, { waitUntil: 'networkidle0' });
await wait(700);
ok('markdown labs render', (await page.evaluate(() => document.querySelector('.prose')?.innerText.length || 0)) > 500);

await browser.close();
console.log(`\nconsole errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ', e));
fails += errors.length;
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mlabs behave correctly\x1b[0m\n');
process.exit(fails ? 1 : 0);
