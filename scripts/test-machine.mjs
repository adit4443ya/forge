#!/usr/bin/env node
/* The Machine surface exists to unify material that was correct but scattered,
   so the things worth asserting are the JOINS, not the prose:

     - every chain step and litmus drill points at a heading that exists
     - the litmus verdicts are well formed, because a typo renders as a blank
       cell rather than an error
     - the page's substance reaches the SERVED HTML. This one is a regression
       guard with history: a <script> or any prose inside a Suspense boundary
       is deferred into the RSC payload and never appears in the HTML, which
       once silently removed all JSON-LD from the site.
     - the tab actually navigates, and a drill actually reveals

   Static assertions run with no browser; the UI half needs BASE to be up. */
import fs from 'node:fs';
import { LITMUS, LITMUS_FAMILIES, MODELS } from '../src/data/litmus.js';
import { GUIDES } from '../src/data/generated/guides.js';
import { LAB_INDEX } from '../src/data/generated/labs.js';
import { RAPID, DOMAINS } from '../src/data/rapidfire.js';

const B = process.env.BASE || 'http://localhost:4310';
let bad = 0;
const ok = (m, c, d = '') => { if (!c) bad++; console.log(`  ${c ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`); };

const headings = Object.fromEntries(GUIDES.map((g) => [String(g.num), new Set((g.headings || []).map((h) => h.id))]));
const labIds = new Set(LAB_INDEX.map((l) => l.id));

console.log('\nlitmus data is well formed');
{
  const verdicts = new Set(['forbidden', 'allowed']);
  const families = new Set(LITMUS_FAMILIES.map((f) => f.id));
  const ids = LITMUS.map((l) => l.id);
  ok(`${LITMUS.length} drills, unique ids`, new Set(ids).size === ids.length);
  const missing = LITMUS.filter((l) => MODELS.some((m) => !verdicts.has(l.verdict[m.id])));
  ok('every drill has a valid verdict for every model', missing.length === 0,
    missing.map((l) => l.id).join(', '));
  ok('every drill names a known family', LITMUS.every((l) => families.has(l.family)),
    LITMUS.filter((l) => !families.has(l.family)).map((l) => l.id).join(', '));
  ok('every drill has threads, a question, a mechanism and a fix',
    LITMUS.every((l) => l.threads?.length >= 2 && l.ask && l.why && l.fix));
  ok('difficulty is 1-4', LITMUS.every((l) => l.d >= 1 && l.d <= 4));
}

console.log('\nevery cross-reference resolves');
{
  const deadGuide = LITMUS.filter((l) => l.guide && !headings[l.guide.num]?.has(l.guide.anchor));
  ok('litmus drills point at headings that exist', deadGuide.length === 0,
    deadGuide.map((l) => `${l.id}->${l.guide.num}/${l.guide.anchor}`).join(', '));
  const deadLab = LITMUS.filter((l) => l.lab && !labIds.has(l.lab));
  ok('litmus drills point at labs that exist', deadLab.length === 0,
    deadLab.map((l) => `${l.id}->${l.lab}`).join(', '));

  /* The chain is the spine of the page; a dead anchor there is the whole point
     of the surface failing silently. */
  const screen = fs.readFileSync(new URL('../src/screens/Machine.jsx', import.meta.url), 'utf8');
  const chain = [...screen.matchAll(/guide:\s*"(\d+)",\s*anchor:\s*"([a-z0-9-]+)"/g)];
  const deadChain = chain.filter(([, num, a]) => !headings[num]?.has(a));
  ok(`all ${chain.length} chain steps point at real headings`, chain.length >= 10 && deadChain.length === 0,
    deadChain.map(([, n, a]) => `${n}/${a}`).join(', '));
}

console.log('\nthe spine and the deck are wired in');
{
  const spine = ['24', '25', '26', '27'];
  ok('guides 24-27 exist and are categorised together',
    spine.every((n) => GUIDES.find((g) => String(g.num) === n)?.category === 'The Machine'));
  ok('the memory rapid-fire domain is registered', DOMAINS.some((d) => d.id === 'mem'));
  const mem = RAPID.filter((r) => r.domain === 'mem');
  ok(`the memory deck has questions (${mem.length})`, mem.length >= 40);
  ok('every memory question has an answer and an edge', mem.every((r) => r.q && r.a && r.edge));

  /* The competencies that used to lean on one thin guide each. */
  const roles = fs.readFileSync(new URL('../src/data/roles.js', import.meta.url), 'utf8');
  for (const [id, want] of [['s-memory', '24'], ['s-kernel', '26'], ['h-conc', '25']]) {
    const seg = roles.slice(roles.indexOf(`id: "${id}"`), roles.indexOf(`id: "${id}"`) + 600);
    ok(`${id} now points at guide ${want}`, new RegExp(`guides:\\s*\\[[^\\]]*"${want}"`).test(seg));
  }
}

/* ── the UI half ─────────────────────────────────────────────────────── */
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch { /* not installed */ }
const reachable = await fetch(`${B}/machine`).then((r) => r.ok).catch(() => false);
if (!puppeteer || !reachable) {
  console.log(`\n\x1b[33m- skipping the UI half (${!puppeteer ? 'puppeteer-core missing' : `${B} not reachable`})\x1b[0m`);
} else {
  console.log('\nthe page serves its substance to a crawler');
  const html = await fetch(`${B}/machine`).then((r) => r.text());
  ok('JSON-LD reaches the served HTML', /application\/ld\+json/.test(html) && /LearningResource/.test(html));
  ok('the four guides are linked in the HTML',
    ['24', '25', '26', '27'].every((n) => html.includes(`/learn/guide/${n}`)));
  ok('the subject matter is in the HTML, not just "Loading"',
    /MESI/.test(html) && /TLB reach/.test(html) && !/Loading…/.test(html));

  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const w = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('\nthe surface works');
  await p.goto(`${B}/today`, { waitUntil: 'networkidle0' }); await w(400);
  const navHit = await p.evaluate(() => {
    const a = [...document.querySelectorAll('nav.tabs a')].find((x) => /Machine/i.test(x.textContent));
    if (a) a.click();
    return !!a;
  });
  ok('the Machine tab is in the primary nav', navHit);
  await w(900);
  ok('clicking it navigates', p.url().includes('/machine'), p.url());

  const chainSeq = await p.evaluate(() => {
    const nums = document.body.innerText.split('\n').map((l) => l.trim()).filter((l) => /^\d{2}$/.test(l));
    /* the chain is the 01..N run at the top; guide-number tags follow it */
    let n = 0;
    for (const v of nums) { if (Number(v) === n + 1) n++; else break; }
    return n;
  });
  ok('the chain renders every numbered step in order', chainSeq === 11, `${chainSeq} of 11`);

  /* Tabs */
  const clickTab = (label) => p.evaluate((l) => {
    const t = [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent.includes(l));
    if (t) t.click();
    return !!t;
  }, label);
  ok('the litmus tab exists', await clickTab('Litmus')); await w(500);
  const drills = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /Reveal the verdict/.test(b.textContent)).length);
  ok('litmus drills render', drills >= 10, `${drills} drills`);

  /* .reveal collapses with grid-template-rows, not display:none, so the text is
     in the DOM whether open or shut — innerText cannot tell. Measure the height. */
  const revealed = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('button')].find((x) => /Reveal the verdict/.test(x.textContent));
    if (!btn) return null;
    const panel = btn.closest('div');
    const inner = () => panel?.querySelector('.reveal > .reveal-inner');
    const before = inner()?.getBoundingClientRect().height ?? -1;
    btn.click();
    await new Promise((r) => setTimeout(r, 600));
    const after = inner()?.getBoundingClientRect().height ?? -1;
    const open = !!panel?.querySelector('.reveal.open');
    const text = inner()?.innerText || '';
    return { before, after, open, hasMechanism: /mechanism/i.test(text), hasFix: /the fix/i.test(text) };
  });
  ok('a drill is collapsed until revealed', revealed && revealed.before === 0, JSON.stringify(revealed));
  ok('revealing it opens the panel', revealed && revealed.open && revealed.after > 100,
    revealed ? `${revealed.before}px -> ${Math.round(revealed.after)}px` : 'null');
  ok('…and the panel holds the mechanism and the fix', revealed && revealed.hasMechanism && revealed.hasFix);

  ok('the reference tab exists', await clickTab('Reference')); await w(500);
  const ref = await p.evaluate(() => {
    const t = document.body.innerText;
    return { latency: /L1D hit/.test(t), barriers: /StoreLoad/.test(t), papers: /x86-TSO/.test(t) };
  });
  ok('the reference tab shows the latency table', ref.latency);
  ok('…the barrier matrix', ref.barriers);
  ok('…and the literature', ref.papers);

  ok('no console errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
}

console.log(bad ? `\n\x1b[31mtest-machine: ${bad} failure(s)\x1b[0m\n` : '\n\x1b[32mtest-machine: PASS\x1b[0m\n');
process.exit(bad ? 1 : 0);
