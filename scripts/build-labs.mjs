#!/usr/bin/env node
/* Turn the debug_lab source files into structured, renderable lab walkthroughs.
   The lab headers are a consistent format — a title line, a meta line, then
   named sections and numbered STEPs each carrying commands and real output —
   so the site can guide someone through a lab instead of just linking to it.

   Output is vendored into content/labs.json so the app stays self-contained
   and deployable without the lab repository present.

   Usage: node scripts/build-labs.mjs [path-to-debug_lab] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || process.env.DEBUG_LAB || path.join(process.env.HOME || '', 'debug_lab');
const OUT = path.join(root, 'content/labs.json');

if (!fs.existsSync(SRC)) {
  if (fs.existsSync(OUT)) {
    console.log(`debug_lab not found at ${SRC} — keeping the vendored content/labs.json`);
    process.exit(0);
  }
  console.error(`FATAL: debug_lab not found at ${SRC} and no vendored content/labs.json`);
  process.exit(1);
}

/* Strip the C block-comment gutter (" * ") without eating code indentation. */
const degutter = (lines) => {
  const out = lines.map((l) => l.replace(/^\s*\*\s?/, ''));
  const indents = out.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const base = indents.length ? Math.min(...indents) : 0;
  return out.map((l) => l.slice(base)).join('\n').replace(/\s+$/, '');
};

/* A step body mixes shell commands with their output. Split it so the UI can
   offer a copy button for the command and show the output as a result. */
function parseBody(text) {
  const blocks = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const cmd = /^\s*\$\s(.+)$/.exec(line);
    if (cmd) {
      if (!cur || cur.kind !== 'cmd' || cur.output.length) blocks.push((cur = { kind: 'cmd', commands: [], output: [] }));
      cur.commands.push(cmd[1].trim());
    } else if (cur && cur.kind === 'cmd') {
      cur.output.push(line);
    } else {
      if (!cur || cur.kind !== 'prose') blocks.push((cur = { kind: 'prose', lines: [] }));
      cur.lines.push(line);
    }
  }
  /* A step's recorded output is usually followed by the author's reading of it,
     at the same indent, with no separator. Peel that trailing commentary off so
     the UI can show "what you will see" apart from "what it means". Only a
     TRAILING run of sentence-like lines is moved, so real output is never eaten. */
  const looksLikeProse = (l) => {
    const t = l.trim();
    if (!t) return false;
    if (/ {3,}/.test(t)) return false;              // aligned columns: a table, not a sentence
    if (/^[$#>|+*=—─-]/.test(t)) return false;      // prompts, rules, diagrams
    if (/[{};]\s*$|::|=>|\)\s*$/.test(t)) return false;
    const words = t.split(/\s+/);
    if (words.length < 4) return false;
    const wordy = words.filter((w) => /^[A-Za-z][A-Za-z'’,.;:()-]*$/.test(w)).length;
    return wordy / words.length >= 0.6;
  };
  const peel = (outLines) => {
    let i = outLines.length;
    while (i > 0 && !outLines[i - 1].trim()) i--;            // ignore trailing blanks
    let j = i;
    while (j > 0 && looksLikeProse(outLines[j - 1])) j--;
    // Require a real paragraph, never claim the whole block, and only start at
    // a sentence boundary — otherwise a wrapped line gets torn out mid-thought.
    if (i - j < 2 || j === 0) return [outLines, ''];
    const first = outLines[j].trim();
    const startsSentence = /^["'(]?[A-Z]/.test(first) && !/^[A-Z_]{4,}\b/.test(first);
    const afterBlank = !outLines[j - 1].trim();
    if (!startsSentence && !afterBlank) return [outLines, ''];
    return [outLines.slice(0, j), outLines.slice(j, i).map((l) => l.replace(/\s+$/, '')).join('\n').trim()];
  };

  const out = [];
  for (const b of blocks) {
    if (b.kind !== 'cmd') {
      const text = b.lines.join('\n').trim();
      if (text) out.push({ kind: 'prose', text });
      continue;
    }
    if (!b.commands.length) continue;
    const [outputLines, trailing] = peel(b.output);
    out.push({ kind: 'cmd', commands: b.commands, output: outputLines.join('\n').replace(/^\n+|\s+$/g, '') });
    if (trailing) out.push({ kind: 'prose', text: trailing });
  }
  return out;
}

function parseLab(file, track) {
  const raw = fs.readFileSync(file, 'utf8');
  const isMd = file.endsWith('.md');
  const isLl = file.endsWith('.ll');
  const name = path.basename(file);
  const num = (name.match(/^(\d+)/) || [])[1] || '';

  if (isMd) {
    const title = (/^#\s+(.*)/m.exec(raw) || [])[1] || name;
    return { id: `${track}-${num}`, num, track, file: `${track}/${name}`, title: title.trim(),
             lang: 'markdown', teaches: '', build: '', steps: [], sections: [], markdown: raw, source: '', difficulty: 2 };
  }

  // The header is the first block comment.
  const end = raw.indexOf('*/');
  const header = end > 0 ? raw.slice(0, end) : raw.slice(0, 4000);
  const lines = header.split('\n');

  const titleLine = lines.find((l) => /LAB\s*#?\d*\s*:/i.test(l)) || '';
  const title = (titleLine.split(':').slice(1).join(':') || name).trim();
  const meta = lines.find((l) => /TRACK:/.test(l)) || '';
  const difficulty = Number((/DIFFICULTY:\s*(\d)/.exec(meta) || [])[1]) || 2;
  const needs = (/NEEDS:\s*(.+?)\s*$/.exec(meta) || [])[1] || '';

  /* Walk the header collecting SECTION: and STEP N — blocks. */
  const steps = [];
  const sections = [];
  let mode = null, buf = [], head = '';
  const flush = () => {
    if (!mode) return;
    const text = degutter(buf);
    if (mode === 'step') {
      const m = /^STEP\s+(\d+)\s*[—:-]?\s*(.*)$/i.exec(head);
      steps.push({ n: Number(m?.[1]) || steps.length + 1, title: (m?.[2] || '').replace(/:$/, '').trim(), blocks: parseBody(text) });
    } else {
      sections.push({ title: head.replace(/:$/, '').trim(), blocks: parseBody(text) });
    }
    buf = [];
  };
  for (const line of lines) {
    const bare = line.replace(/^\s*\*?\s?/, '');
    const stepHead = /^STEP\s+\d+\s*[—:-]/i.test(bare);
    const sectHead = /^[A-Z][A-Z0-9 /,'()-]{3,44}:\s*$/.test(bare) || /^[A-Z][A-Z0-9 /,'()-]{3,44}:\s+\S/.test(bare);
    if (stepHead) { flush(); mode = 'step'; head = bare; continue; }
    if (sectHead && !/^\s*\$/.test(bare)) {
      const key = bare.split(':')[0];
      if (!/^(TRACK|LAB)\b/.test(key)) {
        flush(); mode = 'section';
        head = key;                                  // the label only — the rest is body
        buf = [bare.slice(key.length + 1)];
        continue;
      }
    }
    if (mode) buf.push(line);
  }
  flush();

  const pick = (re) => sections.find((s) => re.test(s.title));
  const teaches = pick(/WHAT THIS TEACHES/i);
  const build = pick(/^BUILD/i);
  const tryIt = pick(/TRY THIS/i);
  const buildRaw = build?.blocks.map((b) => (b.kind === 'cmd' ? b.commands.join('\n') : b.text)).join('\n').trim() || '';
  const arrow = /\s*->\s*(\S.*)$/.exec(buildRaw);
  const buildCmd = (arrow ? buildRaw.slice(0, arrow.index) : buildRaw).trim().replace(/^\((.*)\)$/, '$1');
  const artifact = arrow ? arrow[1].trim() : '';

  /* Vendor the code itself so a lab can be read without leaving the site.
     The header comment is dropped: it is already parsed into steps above. */
  const source = (end > 0 ? raw.slice(end + 2) : raw).replace(/^\s*\n/, '').replace(/\s+$/, '');

  return {
    id: `${track}-${num}`, num, track, file: `${track}/${name}`, title, difficulty, needs, source,
    lang: file.endsWith('.cpp') ? 'cpp' : isLl ? 'llvm' : 'c',
    teaches: teaches ? teaches.blocks.filter((b) => b.kind === 'prose').map((b) => b.text).join('\n\n') : '',
    build: buildCmd, artifact,
    steps,
    tryIt: tryIt ? tryIt.blocks : [],
    sections: sections.filter((s) => !/WHAT THIS TEACHES|^BUILD|TRY THIS/i.test(s.title)),
  };
}

const TRACKS = [
  { id: 'debug', dir: '.', title: 'Runtime debugging', order: 0,
    summary: 'Sixteen deliberately broken programs. Predict the symptom, then prove the cause with a tool.' },
  { id: 'ir', dir: 'ir', order: 1, title: 'IR and the pipeline', summary: 'Read what the compiler produced and say which pass did it.' },
  { id: 'cross_level', dir: 'cross_level', order: 2, title: 'Source to assembly', summary: 'Follow one construct all the way down.' },
  { id: 'perf', dir: 'perf', order: 3, title: 'Measurement', summary: 'Establish a noise floor, then measure with counters instead of guessing.' },
  { id: 'cache', dir: 'cache', order: 4, title: 'Memory hierarchy', summary: 'Stride, working set, layout, sharing, parallelism and the TLB.' },
  { id: 'codegen', dir: 'codegen', order: 5, title: 'Code generation', summary: 'What the optimizer does with your idioms, and when it gives up.' },
  { id: 'concurrency', dir: 'concurrency', order: 6, title: 'Concurrency', summary: 'Races, queues, memory orders and what a mutex actually costs.' },
  { id: 'systems', dir: 'systems', order: 7, title: 'Systems and syscalls', summary: 'Allocator behaviour, the syscall floor, timing and the network path.' },
  { id: 'aarch64', dir: 'aarch64', order: 8, title: 'AArch64 and SVE', summary: 'NEON, SVE, LSE atomics and runtime dispatch, on a root-free toolchain.' },
  { id: 'bigcode', dir: 'bigcode', order: 10, title: 'Large codebases', summary: 'Navigate, bisect and reduce inside a codebase too big to read.' },
  { id: 'passwork', dir: 'passwork', order: 9, title: 'Pass work', summary: 'Bisect to one pass, read what it did, reduce it, pin it with a test.' },
  { id: 'capstones', dir: 'capstones', order: 11, title: 'Capstones', summary: 'Multi-day investigations that combine every track.' },
];

/* The repository's own manifest carries ids, skills, prereqs and the evidence
   each lab should leave behind — all things the source comment does not state. */
const manifestPath = path.join(SRC, 'labs.json');
const MANIFEST = fs.existsSync(manifestPath)
  ? (JSON.parse(fs.readFileSync(manifestPath, 'utf8')).labs || [])
  : [];

const labs = [];
const tracks = [];
for (const t of TRACKS) {
  const dir = path.join(SRC, t.dir);
  if (!fs.existsSync(dir)) continue;
  /* Most tracks number their files; ir/ and cross_level/ do not, so take the
     file list and the ids from the repository's own manifest when one exists. */
  const fromManifest = MANIFEST.filter((l) => l.track === t.id);
  const files = fromManifest.length
    ? [...new Set(fromManifest.map((l) => path.basename(l.file)))]
    : fs.readdirSync(dir).filter((f) => /^\d+.*\.(c|cpp|md|ll)$/.test(f)).sort();
  if (!files.length) continue;
  for (const f of files) {
    const full = path.join(dir, f);
    if (!fs.existsSync(full)) { console.error(`  ! missing ${t.id}/${f}`); continue; }
    try {
      const entry = fromManifest.find((l) => path.basename(l.file) === f);
      const lab = parseLab(full, t.id);
      if (entry) {
        lab.id = entry.id;
        if (!lab.title || lab.title === f) lab.title = entry.title;
        lab.manifestTitle = entry.title;
        lab.skills = entry.skills || [];
        lab.prereqs = entry.prereqs || [];
        lab.evidence = entry.evidence || '';
        lab.difficulty = entry.difficulty || lab.difficulty;
      }
      labs.push(lab);
    } catch (e) { console.error(`  ! ${t.id}/${f}: ${e.message}`); }
  }
  /* A track whose labs all live in one file (capstones) gets one entry each. */
  if (fromManifest.length > files.length) {
    for (const entry of fromManifest) {
      if (labs.some((l) => l.id === entry.id)) continue;
      const base = labs.find((l) => path.basename(l.file) === path.basename(entry.file));
      if (!base) continue;
      labs.push({ ...base, id: entry.id, title: entry.title, skills: entry.skills || [],
                  prereqs: entry.prereqs || [], evidence: entry.evidence || '',
                  difficulty: entry.difficulty || base.difficulty });
    }
  }
  tracks.push({ id: t.id, title: t.title, summary: t.summary, order: t.order,
                run: t.dir === '.' ? './build.sh && ls bin/' : `cd ${t.dir} && ./build.sh` });
}

const withSteps = labs.filter((l) => l.steps.length).length;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tracks, labs, generatedAt: new Date().toISOString().slice(0, 10) }, null, 1));

/* The list view only needs headline fields. Keeping bodies out of the client
   bundle is the same trade as the guides: the browser downloads one lab, not
   all sixty-one. */
const index = labs.map((l) => ({
  id: l.id, num: l.num, track: l.track, file: l.file, title: l.title,
  difficulty: l.difficulty, skills: l.skills || [], prereqs: l.prereqs || [],
  evidence: l.evidence || '', steps: l.steps.length,
  minutes: 12 + l.steps.length * 8,
  teaser: (l.teaches || '').split('\n')[0].slice(0, 210),
}));
const outDir = path.join(root, 'src/data/generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'labs.js'),
  '/* GENERATED by scripts/build-labs.mjs — do not edit. */\n' +
  'export const LAB_TRACKS = ' + JSON.stringify(tracks, null, 1) + ';\n' +
  'export const LAB_INDEX = ' + JSON.stringify(index, null, 1) + ';\n' +
  'export const labById = (id) => LAB_INDEX.find((l) => l.id === id);\n');

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0);
console.log(`labs: ${labs.length} across ${tracks.length} tracks · ${withSteps} with parsed steps · ` +
            `${labs.reduce((a, l) => a + l.steps.length, 0)} steps · ` +
            `content ${kb(OUT)} KB (server) · index ${kb(path.join(outDir, 'labs.js'))} KB (client)`);
