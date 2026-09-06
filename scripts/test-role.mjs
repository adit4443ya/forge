#!/usr/bin/env node
/* The role switch claims every surface re-sorts around it. This asserts that it
   actually does, on each surface, rather than only on Learn. */
import puppeteer from 'puppeteer-core';
const B = process.env.BASE || 'http://localhost:4310';
let fails = 0;
const ok = (m, c, d = '') => { if (!c) fails++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
const w = (ms) => new Promise((r) => setTimeout(r, ms));

const setRole = async (id) => {
  await p.evaluate((r) => {
    const k = 'forge-progress-v2';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.version = 2; s.role = r; s.stamps = { ...(s.stamps || {}), role: Date.now() };
    s.prefs = { ...(s.prefs || {}), rolePicked: { value: true, at: Date.now() } };
    localStorage.setItem(k, JSON.stringify(s));
  }, id);
};

console.log('\nfirst-run picker');
await p.goto(`${B}/today`, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle0' }); await w(900);
ok('shown to a new visitor', await p.$('.rp') !== null);
const cards = await p.$$eval('.rp-card', (e) => e.length).catch(() => 0);
ok(`offers every role (${cards})`, cards === 3);
await p.evaluate(() => [...document.querySelectorAll('.rp-card')].find((c) => /HFT/.test(c.textContent))?.click());
await w(700);
ok('dismisses on choice', await p.$('.rp') === null);
await p.reload({ waitUntil: 'networkidle0' }); await w(800);
ok('does not come back', await p.$('.rp') === null);

console.log('\nproblems re-sort');
const firstFor = async (roleId) => {
  await setRole(roleId);
  await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(900);
  return p.evaluate(() => [...document.querySelectorAll('.wb-list button .truncate')].slice(0, 6).map((e) => e.textContent.trim()));
};
const hft = await firstFor('hft');
const comp = await firstFor('compiler');
ok('the top of the list differs by role', JSON.stringify(hft) !== JSON.stringify(comp));
console.log(`      \x1b[90mhft:      ${hft.slice(0, 3).join(' · ')}\x1b[0m`);
console.log(`      \x1b[90mcompiler: ${comp.slice(0, 3).join(' · ')}\x1b[0m`);
const marked = await p.$$eval('.role-dot', (e) => e.length).catch(() => 0);
ok(`role-relevant rows are marked (${marked})`, marked > 0);
ok('the role filter chip exists', await p.$('.role-chip') !== null);

console.log('\ndrills open with the role decks');
const decksFor = async (roleId, tabLabel) => {
  await setRole(roleId);
  await p.goto(`${B}/practice`, { waitUntil: 'networkidle0' }); await w(700);
  await p.evaluate((t) => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t))?.click(), tabLabel);
  await w(700);
  return p.$$eval('.rf-deck[data-on]', (e) => e.map((x) => x.textContent.trim().split(/\s{2,}|\n/)[0]));
};
const rfHft = await decksFor('hft', 'Rapid fire');
const rfComp = await decksFor('compiler', 'Rapid fire');
ok('rapid fire preselects different decks', JSON.stringify(rfHft) !== JSON.stringify(rfComp));
console.log(`      \x1b[90mhft: ${rfHft.join(', ')}\x1b[0m`);
console.log(`      \x1b[90mcompiler: ${rfComp.join(', ')}\x1b[0m`);
ok('not every deck is on by default', rfHft.length < 6 && rfHft.length > 0, `${rfHft.length} of 6`);

console.log('\nlabs');
await setRole('compiler');
await p.goto(`${B}/labs`, { waitUntil: 'networkidle0' }); await w(900);
const labBtn = await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /only|Showing all/.test(x.textContent))?.textContent.trim());
ok('role filter is on by default', /✓/.test(labBtn || ''), labBtn);
const nComp = await p.$$eval('.lab-card', (e) => e.length);
await setRole('hft');
await p.goto(`${B}/labs`, { waitUntil: 'networkidle0' }); await w(900);
const nHft = await p.$$eval('.lab-card', (e) => e.length);
ok(`lab count differs by role (compiler ${nComp}, hft ${nHft})`, nComp !== nHft);

console.log('\ntoday: the session itself differs');
const sessionFor = async (roleId) => {
  await setRole(roleId);
  await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await w(900);
  return p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
};
const tHft = await sessionFor('hft');
const tComp = await sessionFor('compiler');
ok('the session text differs by role', tHft !== tComp);
ok('compiler session mentions IR or a pass', /IR|pass|transformation/i.test(tComp));
ok('hft session mentions the tail or allocation', /tail|p99|allocat|cache line/i.test(tHft));

await b.close();
console.log(fails ? `\n\x1b[31m${fails} problem(s)\x1b[0m\n` : '\n\x1b[32mthe role switch changes every surface\x1b[0m\n');
process.exit(fails ? 1 : 0);
