#!/usr/bin/env node
// Copy the lab manifest from the debug_lab repository into src/data/labs.json.
//   node scripts/sync-labs.mjs [path/to/labs.json]     (default: ../../debug_lab/labs.json or $LABS_JSON)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || process.env.LABS_JSON || path.resolve(here, '../../../debug_lab/labs.json');
const dst = path.resolve(here, '../src/data/labs.json');
const raw = fs.readFileSync(src, 'utf8');
const m = JSON.parse(raw);
if (m.version !== 1 || !Array.isArray(m.tracks) || !Array.isArray(m.labs)) throw new Error('unexpected labs.json shape');
const ids = new Set();
for (const l of m.labs) {
  if (ids.has(l.id)) throw new Error('duplicate lab id ' + l.id);
  ids.add(l.id);
  if (!m.tracks.some((t) => t.id === l.track)) throw new Error(`lab ${l.id} references unknown track ${l.track}`);
  for (const p of l.prereqs || []) if (!m.labs.some((x) => x.id === p)) throw new Error(`lab ${l.id} prereq ${p} not found`);
}
fs.writeFileSync(dst, raw);
console.log(`synced ${m.labs.length} labs / ${m.tracks.length} tracks / ${(m.planned_tracks || []).length} planned tracks -> ${path.relative(process.cwd(), dst)}`);
