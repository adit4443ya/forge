#!/usr/bin/env node
/* The product is role-specific, not company-specific.
 *
 * Naming a vendor's hardware is a technical fact and stays ("Hexagon HVX",
 * "Snapdragon", "NVIDIA's ptxas", Agner Fog's tables, google-benchmark, the
 * Google sign-in button). What does NOT stay is company *targeting*: framing a
 * page as one employer's interview, claiming a company asks a given question,
 * or using a company as a style label ("Google-style round"). That framing
 * creeps back in easily, so it is checked — across guide markdown AND src/,
 * because most of it lived in the data files, not the guides.
 *
 * A claim that quotes a company's own public posting or prep page is evidence,
 * not a stereotype, and is exempt when wrapped in
 *   content-check:sourced  …  content-check:end
 * with the source link present in the same block.
 *
 * Also catches leftovers from personal documents: a named interviewer, "you"
 * addressed as a specific candidate, or orphaned "PART n" titles. */
import fs from 'node:fs';
import path from 'node:path';

const CO = '(?:qualcomm|nvidia|amd|intel|apple|google|meta|microsoft|jane street|'
  + 'hudson river|hrt|optiver|citadel|two sigma|graviton|bloomberg)';
const BAD = [
  { re: new RegExp(`${CO}[^.\\n]{0,45}\\b(interview|round|loop|onsite|panel|screen)\\b`, 'i'),
    why: "frames content as a specific company's interview" },
  { re: new RegExp(`\\b(asked|asks|ask|favourite|favorite|common)\\b[^.\\n]{0,35}\\bat\\s+${CO}\\b`, 'i'),
    why: 'claims a named company asks this' },
  { re: new RegExp(`${CO}[^.\\n]{0,30}\\b(cares|wants|asks|expects|screens|favours|favors|likes)\\b`, 'i'),
    why: 'asserts what a named company wants' },
  { re: new RegExp(`\\b(at|joining|onboard(?:ing)? at|your first .{0,20} at)\\s+${CO}\\b[^.\\n]{0,40}\\b(you|your|we)\\b`, 'i'),
    why: 'written as if the reader is joining one employer' },
  { re: new RegExp(`\\b${CO}\\s*[-–—:]\\s*style\\b`, 'i'),
    why: 'uses a company as a style label' },
  { re: /\b(?:tomorrow|your interviewer)\b[^.\n]{0,40}\b(?:is|will)\b/i,
    why: 'addressed to one candidate on one day' },
];
/* Names that appeared in the source documents as interviewers, not authors. */
const NAMES = /\b(Swapnil|Swapnil's)\b/;

let bad = 0;
const flag = (loc, why, line) => {
  bad++;
  console.log(`  \x1b[31m✗\x1b[0m ${loc} — ${why}`);
  if (line) console.log(`      \x1b[90m${line.trim().slice(0, 130)}\x1b[0m`);
};

/* Lines inside a sourced block are exempt, but only if the source is actually
   reachable: a link in the block itself, or a "Sources: <link>" line elsewhere
   in the same file (several modules gather their citations in one footer).
   Without that the marker is just a way to silence the check, which is worse
   than no check at all. */
function scan(file, raw, rel) {
  const lines = raw.split('\n');
  const exempt = new Set();
  let open = -1;
  lines.forEach((line, i) => {
    if (/content-check:sourced/.test(line)) open = i;
    else if (/content-check:end/.test(line) && open >= 0) {
      const block = lines.slice(open, i + 1);
      const cited = block.some((l) => /https?:\/\//.test(l))
        || lines.some((l) => /\bSources?:/.test(l) && /https?:\/\//.test(l));
      if (cited) {
        for (let k = open; k <= i; k++) exempt.add(k);
      } else {
        flag(`${rel}:${open + 1}`, 'content-check:sourced block cites no source link', line);
      }
      open = -1;
    }
  });
  if (open >= 0) flag(`${rel}:${open + 1}`, 'content-check:sourced block is never closed');

  lines.forEach((line, i) => {
    if (exempt.has(i)) return;
    for (const { re, why } of BAD) if (re.test(line)) { flag(`${rel}:${i + 1}`, why, line); break; }
    if (NAMES.test(line)) flag(`${rel}:${i + 1}`, 'names a person from the source document', line);
  });
}

/* 1. Guide markdown — targeting plus title hygiene. */
const dir = path.join(process.cwd(), 'content/guides');
const guides = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
for (const f of guides) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  scan(f, raw, f);
  /* "# PART n" is fine as an internal section heading — these guides are long
     and use it deliberately. It is only wrong as the FIRST h1, because that is
     what becomes the guide's title. */
  const body = raw.replace(/^<!--[\s\S]*?-->\s*/, '');
  const firstH1 = (body.match(/^#\s+(.*)$/m) || [])[1];
  if (!firstH1) flag(f, 'no H1 at all; the title falls back to the filename');
  else if (/^PART\s+\d/i.test(firstH1.trim())) flag(f, `title is "${firstH1.trim()}", a section heading rather than a title`);
  else if (body.indexOf(`# ${firstH1}`) > 400) flag(f, 'first H1 is buried; add a title heading at the top');
}

/* 2. Everything under src/ — the data files carry more prose than the guides. */
const srcFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); }
    else if (/\.(js|jsx|md)$/.test(e.name)) srcFiles.push(p);
  }
})('src');
for (const p of srcFiles) scan(p, fs.readFileSync(p, 'utf8'), p);

if (!bad) console.log(`  \x1b[32m✓\x1b[0m ${guides.length} guides + ${srcFiles.length} source files: role-specific, titled, no personal leftovers`);
console.log(bad ? `\n\x1b[31m${bad} problem(s)\x1b[0m\n` : '\n\x1b[32mcontent is clean\x1b[0m\n');
process.exit(bad ? 1 : 0);
