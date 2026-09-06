#!/usr/bin/env node
/* Every problem named in the content must resolve to something clickable:
   a problem in the local bank, or an exact page on a judge. A name that
   resolves to neither renders as a dead chip, which is what this prevents.

   With --verify it also asks LeetCode's API whether each slug still exists,
   so a renamed or removed problem is caught here rather than by a user. */
import fs from 'node:fs';
import { EXTERNAL_PROBLEMS, externalProblem } from '../src/data/externalLinks.js';
import { PATTERNS_2 } from '../src/data/patterns.js';

const dsa = fs.readFileSync(new URL('../src/dsaData.jsx', import.meta.url), 'utf8');
const seg = (a, b) => dsa.slice(dsa.indexOf(a), dsa.indexOf(b));
const bank = [...(seg('export const PROBLEMS', 'export const NVIDIA_PROBLEMS')
  + seg('export const NVIDIA_PROBLEMS', 'export const CPP_CONCEPTS')).matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
const inBank = (n) => bank.some((t) => t === n || t.toLowerCase().startsWith(String(n).toLowerCase().slice(0, 18)));

const cheat = [...seg('export const CHEATSHEET', 'export const TIPS').matchAll(/problems: \[([^\]]*)\]/g)]
  .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
const named = [...new Set([...cheat, ...PATTERNS_2.flatMap((p) => p.problems)])];

let bad = 0;
const dead = named.filter((n) => !inBank(n) && !externalProblem(n));
for (const n of dead) { bad++; console.log(`  \x1b[31m✗\x1b[0m "${n}" resolves to nothing — it would render as a dead chip`); }

const ext = named.filter((n) => !inBank(n) && externalProblem(n));
if (!bad) console.log(`  \x1b[32m✓\x1b[0m all ${named.length} named problems resolve (${named.length - ext.length} in bank, ${ext.length} external)`);

/* Nothing may point at a search page or a bare problem list. */
for (const [name, e] of Object.entries(EXTERNAL_PROBLEMS)) {
  const href = externalProblem(name).href;
  if (/\/problemset\/?$|search=|\/list\//.test(href)) { bad++; console.log(`  \x1b[31m✗\x1b[0m "${name}" points at a list or a search: ${href}`); }
  if (e.slug && !/^[a-z0-9-]+$/.test(e.slug)) { bad++; console.log(`  \x1b[31m✗\x1b[0m "${name}" has a malformed slug: ${e.slug}`); }
}
if (!bad) console.log(`  \x1b[32m✓\x1b[0m every external link is an exact problem page, not a search`);

if (process.argv.includes('--verify')) {
  console.log('\n  verifying slugs against the judge…');
  let checked = 0, failed = 0;
  for (const [name, e] of Object.entries(EXTERNAL_PROBLEMS)) {
    if (!e.slug) continue;
    try {
      const r = await fetch('https://leetcode.com/graphql', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query{question(titleSlug:"${e.slug}"){questionFrontendId title}}` }),
      });
      const q = (await r.json())?.data?.question;
      checked++;
      if (!q) { failed++; bad++; console.log(`  \x1b[31m✗\x1b[0m ${name} -> ${e.slug} no longer exists`); }
      else if (+q.questionFrontendId !== e.id) { failed++; bad++; console.log(`  \x1b[31m✗\x1b[0m ${name}: id ${e.id} recorded, judge says ${q.questionFrontendId}`); }
    } catch (err) { console.log(`  \x1b[90m·\x1b[0m ${name}: could not reach the judge (${err.message})`); }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!failed) console.log(`  \x1b[32m✓\x1b[0m ${checked} slugs still resolve to the recorded problem`);
}

console.log(bad ? `\n\x1b[31m${bad} problem(s)\x1b[0m\n` : '\n\x1b[32mevery reference is clickable\x1b[0m\n');
process.exit(bad ? 1 : 0);
