#!/usr/bin/env node
/* The product is role-specific, not company-specific. Naming a vendor's
   hardware is a technical fact and stays ("Hexagon HVX", "Snapdragon", Agner
   Fog's tables). Framing content as one employer's interview does not, and it
   creeps back in easily, so it is checked.

   Also catches leftovers from personal documents: a named interviewer, "you"
   addressed as a specific candidate, or orphaned "PART n" titles. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'content/guides');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();

const CO = '(?:qualcomm|nvidia|amd|intel|apple|google|meta|microsoft|jane street|hudson river|optiver|citadel|two sigma)';
const BAD = [
  { re: new RegExp(`${CO}[^.\\n]{0,40}\\b(interview|round|loop|onsite)\\b`, 'i'),
    why: 'frames content as a specific company\'s interview' },
  { re: new RegExp(`\\b(at|joining|onboard(?:ing)? at|your first .{0,20} at)\\s+${CO}\\b`, 'i'),
    why: 'written as if the reader is joining one employer' },
  { re: new RegExp(`${CO}[^.\\n]{0,30}\\b(cares|wants|asks|expects|screens)\\b`, 'i'),
    why: 'asserts what a named company wants' },
  { re: /\b(?:tomorrow|your interviewer)\b[^.\n]{0,40}\b(?:is|will)\b/i,
    why: 'addressed to one candidate on one day' },
];
/* Names that appeared in the source documents as interviewers, not authors. */
const NAMES = /\b(Swapnil|Swapnil's)\b/;

let bad = 0;
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  raw.split('\n').forEach((line, i) => {
    for (const { re, why } of BAD) {
      if (re.test(line)) {
        bad++;
        console.log(`  \x1b[31m✗\x1b[0m ${f}:${i + 1} — ${why}`);
        console.log(`      \x1b[90m${line.trim().slice(0, 130)}\x1b[0m`);
      }
    }
    if (NAMES.test(line)) {
      bad++;
      console.log(`  \x1b[31m✗\x1b[0m ${f}:${i + 1} — names a person from the source document`);
      console.log(`      \x1b[90m${line.trim().slice(0, 130)}\x1b[0m`);
    }
  });
  /* "# PART n" is fine as an internal section heading — these guides are long
     and use it deliberately. It is only wrong as the FIRST h1, because that is
     what becomes the guide's title. */
  const body = raw.replace(/^<!--[\s\S]*?-->\s*/, '');
  const firstH1 = (body.match(/^#\s+(.*)$/m) || [])[1];
  if (!firstH1) {
    bad++;
    console.log(`  \x1b[31m✗\x1b[0m ${f} — no H1 at all; the title falls back to the filename`);
  } else if (/^PART\s+\d/i.test(firstH1.trim())) {
    bad++;
    console.log(`  \x1b[31m✗\x1b[0m ${f} — title is "${firstH1.trim()}", a section heading rather than a title`);
  } else if (body.indexOf(`# ${firstH1}`) > 400) {
    bad++;
    console.log(`  \x1b[31m✗\x1b[0m ${f} — first H1 is buried; add a title heading at the top`);
  }
}
if (!bad) console.log(`  \x1b[32m✓\x1b[0m ${files.length} guides: role-specific, titled, no personal leftovers`);
console.log(bad ? `\n\x1b[31m${bad} problem(s)\x1b[0m\n` : '\n\x1b[32mguide content is clean\x1b[0m\n');
process.exit(bad ? 1 : 0);
