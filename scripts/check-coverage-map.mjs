#!/usr/bin/env node
/* The coverage map keys its rapid-fire mapping by competency id. A typo there
   is invisible in the UI — the row just shows an em dash — so it is asserted
   here instead. Also checks that every competency can actually be covered. */
import { readFileSync } from 'node:fs';
import { ROLES, allCompetencies } from '../src/data/roles.js';
import { RAPID, DOMAINS } from '../src/data/rapidfire.js';
import { LAB_INDEX } from '../src/data/generated/labs.js';
import { GUIDES } from '../src/data/generated/guides.js';

const src = readFileSync(new URL('../src/screens/CoverageMap.jsx', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('const DOMAIN_HINTS'), src.indexOf('};', src.indexOf('const DOMAIN_HINTS')));
const mapped = new Map();
for (const m of block.matchAll(/"([a-z-]+)":\s*\[([^\]]*)\]/g)) {
  mapped.set(m[1], m[2].split(',').map((x) => x.trim().replace(/"/g, '')).filter(Boolean));
}

let bad = 0;
const fail = (m) => { bad++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);

const comps = allCompetencies();
const compIds = new Set(comps.map((c) => c.id));
const domainIds = new Set(DOMAINS.map((d) => d.id));

for (const id of mapped.keys()) if (!compIds.has(id)) fail(`DOMAIN_HINTS names "${id}", which is not a competency id`);
for (const c of comps) if (!mapped.has(c.id)) fail(`competency "${c.id}" (${c.name}) has no rapid-fire mapping`);
for (const [id, ds] of mapped) for (const d of ds) if (!domainIds.has(d)) fail(`"${id}" maps to unknown domain "${d}"`);
if (!bad) ok(`all ${comps.length} competencies map to real rapid-fire domains`);

/* Sections are typed by hand and a typo shows as an empty cell, not an error. */
const dsaSrc = readFileSync(new URL('../src/dsaData.jsx', import.meta.url), 'utf8');
const seg = (a, b) => dsaSrc.slice(dsaSrc.indexOf(a), dsaSrc.indexOf(b));
const bankSrc = seg('export const PROBLEMS', 'export const NVIDIA_PROBLEMS')
              + seg('export const NVIDIA_PROBLEMS', 'export const CPP_CONCEPTS');
const sections = new Set([...bankSrc.matchAll(/section: "([^"]+)"/g)].map((m) => m[1]));
for (const c of comps) {
  for (const sec of c.sections || []) {
    if (!sections.has(sec)) fail(`"${c.id}" references section "${sec}", which no problem uses`);
  }
}
if (!bad) ok(`all ${comps.reduce((a, c) => a + (c.sections || []).length, 0)} section references resolve to real problems`);

/* Every competency must have at least one kind of evidence available. */
const guideNums = new Set(GUIDES.map((g) => g.num));
for (const c of comps) {
  for (const g of c.guides || []) if (!guideNums.has(g)) fail(`"${c.id}" references guide ${g}, which does not exist`);
  const labs = LAB_INDEX.filter((l) => (c.labs || []).some((p) => l.id === p || l.id.startsWith(p)));
  for (const p of c.labs || []) {
    if (!LAB_INDEX.some((l) => l.id === p || l.id.startsWith(p))) fail(`"${c.id}" references lab prefix "${p}", which matches nothing`);
  }
  const rapid = RAPID.filter((r) => (mapped.get(c.id) || []).includes(r.domain));
  if (!(c.guides || []).length && !labs.length && !(c.sections || []).length && !rapid.length) {
    fail(`"${c.id}" (${c.name}) has no evidence of any kind — its row would be entirely blank`);
  }
}
if (!bad) ok('every competency has at least one kind of evidence available');
console.log(bad ? `\n\x1b[31m${bad} problem(s)\x1b[0m\n` : `\n\x1b[32mcoverage map wiring is sound\x1b[0m (${ROLES.length} roles)\n`);
process.exit(bad ? 1 : 0);
