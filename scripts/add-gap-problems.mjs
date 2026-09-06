#!/usr/bin/env node
// Append scripts/gap_problems*.mjs entries to PROBLEMS in src/dsaData.jsx (idempotent by id).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAP_PROBLEMS } from './gap_problems.mjs';
import { GAP_PROBLEMS_2 } from './gap_problems_2.mjs';
import { GAP_PROBLEMS_3 } from './gap_problems_3.mjs';
import { GAP_PROBLEMS_4 } from './gap_problems_4.mjs';
const ALL_GAPS = [...GAP_PROBLEMS, ...GAP_PROBLEMS_2, ...GAP_PROBLEMS_3, ...GAP_PROBLEMS_4];
const here = path.dirname(fileURLToPath(import.meta.url));
const p = path.resolve(here, '../src/dsaData.jsx');
let s = fs.readFileSync(p, 'utf8');
const nv = s.indexOf('export const NVIDIA_PROBLEMS');
const end = s.lastIndexOf('];', nv);                       // end of PROBLEMS
const existing = new Set([...s.slice(0, end).matchAll(/^\s*id:\s*(\d+),/gm)].map((m) => +m[1]));
const fresh = ALL_GAPS.filter((g) => !existing.has(g.id));
if (!fresh.length) { console.log('nothing to add'); process.exit(0); }
const esc = (v) => JSON.stringify(v);
const block = fresh.map((g) => `
  // ══════════════════════════════
  //  ${g.section.toUpperCase()}  (id ${g.id}, added Sep 2026: curriculum gap)
  // ══════════════════════════════
  {
    id: ${g.id}, section: ${esc(g.section)}, title: ${esc(g.title)},
    difficulty: ${esc(g.difficulty)}, frequency: ${esc(g.frequency)}, leetcode: ${g.leetcode},
    pattern: ${esc(g.pattern)},
    intuition: ${esc(g.intuition)},
    keyInsight: ${esc(g.keyInsight)},
    approach: ${esc(g.approach)},
    complexity: ${esc(g.complexity)},
    tabCode: ${'`' + g.tabCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'},
  },`).join('\n');
s = s.slice(0, end) + block + '\n' + s.slice(end);
fs.writeFileSync(p, s);
console.log(`added ${fresh.length} problems: ${fresh.map((g) => g.id).join(', ')}`);
