#!/usr/bin/env node
// Validate src/data/dsaCurriculum.js against the problem bank in src/dsaData.jsx:
// every tiered id must exist, and no id may appear in two tiers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const data = fs.readFileSync(path.resolve(here, '../src/dsaData.jsx'), 'utf8');

// The bank is PROBLEMS + NVIDIA_PROBLEMS (ids 77-81). Every other collection in
// the file (concepts, bug hunts, quizzes) has its own id space: do not scan it.
const seg = (from, to) => data.slice(data.indexOf(from), data.indexOf(to));
const source = seg('export const PROBLEMS', 'export const NVIDIA_PROBLEMS')
             + seg('export const NVIDIA_PROBLEMS', 'export const CPP_CONCEPTS');
const bank = new Set([...source.matchAll(/^\s*id:\s*(\d+),/gm)].map((m) => +m[1]));

const { TIERS } = await import(path.resolve(here, '../src/data/dsaCurriculum.js'));
const seen = new Map();
let bad = 0;
for (const t of TIERS) for (const g of t.groups) for (const id of g.ids) {
  if (!bank.has(id)) { console.error(`tier ${t.id} / ${g.pattern}: id ${id} does not exist`); bad++; }
  if (seen.has(id)) { console.error(`id ${id} appears in tier ${seen.get(id)} and tier ${t.id}`); bad++; }
  seen.set(id, t.id);
}
const untiered = [...bank].filter((id) => !seen.has(id)).sort((a, b) => a - b);
console.log(`bank: ${bank.size} problems · tiered: ${seen.size} · untiered: ${untiered.length}${untiered.length ? ' (' + untiered.join(',') + ')' : ''}`);
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
if (untiered.length) { console.error('every problem must sit in a tier'); process.exit(1); }
console.log('curriculum OK');
