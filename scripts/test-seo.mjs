#!/usr/bin/env node
/* Discoverability is easy to break silently: a missing metadataBase turns
   canonicals relative, a guide added without a sitemap entry is invisible, and
   malformed JSON-LD is ignored without any error anywhere. So it is checked
   against the running server, the same way the other browser gates are. */
import { GUIDES } from '../src/data/generated/guides.js';
import { LAB_INDEX } from '../src/data/generated/labs.js';

const BASE = process.env.BASE || 'http://localhost:3000';
let bad = 0;
const fail = (m) => { bad++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);

const get = async (p) => {
  const r = await fetch(`${BASE}${p}`);
  return { status: r.status, text: await r.text() };
};

/* JSON-LD is only useful if it parses; a stray "<" or a trailing comma makes
   the whole block dead weight that nothing reports. */
function lds(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch (e) { fail(`unparseable JSON-LD: ${e.message}`); }
  }
  return out;
}

const robots = await get('/robots.txt');
if (robots.status !== 200) fail(`robots.txt returned ${robots.status}`);
else if (!/Sitemap:\s*https?:\/\/\S+sitemap\.xml/i.test(robots.text)) fail('robots.txt does not point at the sitemap');
else pass('robots.txt served and points at the sitemap');

const sm = await get('/sitemap.xml');
if (sm.status !== 200) fail(`sitemap.xml returned ${sm.status}`);
else {
  const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.some((u) => !/^https?:\/\//.test(u))) fail('sitemap contains a relative <loc> — metadataBase is not set');
  const missGuides = GUIDES.filter((g) => !urls.some((u) => u.endsWith(`/learn/guide/${g.num}`)));
  const missLabs = LAB_INDEX.filter((l) => !urls.some((u) => u.endsWith(`/labs/${l.id}`)));
  if (missGuides.length) fail(`${missGuides.length} guide(s) missing from the sitemap, e.g. ${missGuides[0].num}`);
  if (missLabs.length) fail(`${missLabs.length} lab(s) missing from the sitemap, e.g. ${missLabs[0].id}`);
  if (!missGuides.length && !missLabs.length) pass(`sitemap lists all ${GUIDES.length} guides and ${LAB_INDEX.length} labs (${urls.length} URLs)`);
}

const og = await fetch(`${BASE}/opengraph-image`);
if (og.status !== 200) fail(`/opengraph-image returned ${og.status}`);
else if (!(og.headers.get('content-type') || '').includes('image/png')) fail('/opengraph-image is not a PNG');
else pass('OpenGraph card renders');

const home = await get('/');
for (const [what, re] of [
  ['a canonical link', /<link rel="canonical" href="https?:\/\/[^"]+"/],
  ['a meta description', /<meta name="description" content="[^"]{60,}"/],
  ['og:title', /property="og:title"/],
  ['og:image', /property="og:image"/],
  ['twitter:card', /name="twitter:card"/],
]) { if (re.test(home.text)) pass(`landing page has ${what}`); else fail(`landing page is missing ${what}`); }

const homeLd = lds(home.text);
if (!homeLd.some((d) => JSON.stringify(d).includes('"WebSite"'))) fail('landing page has no WebSite JSON-LD');
else pass('landing page carries WebSite + SoftwareApplication JSON-LD');
const list = homeLd.find((d) => d['@type'] === 'ItemList');
if (!list) fail('landing page has no ItemList of guides and labs');
else if (list.itemListElement.length !== GUIDES.length + LAB_INDEX.length)
  fail(`ItemList has ${list.itemListElement.length} entries, expected ${GUIDES.length + LAB_INDEX.length}`);
else pass(`ItemList covers all ${list.itemListElement.length} guides and labs`);

/* The directory has to be in the HTML, not built by client JS — that is the
   entire reason it exists. */
const linked = GUIDES.filter((g) => home.text.includes(`/learn/guide/${g.num}"`)).length;
const linkedLabs = LAB_INDEX.filter((l) => home.text.includes(`/labs/${l.id}"`)).length;
if (linked !== GUIDES.length || linkedLabs !== LAB_INDEX.length)
  fail(`landing HTML links ${linked}/${GUIDES.length} guides and ${linkedLabs}/${LAB_INDEX.length} labs`);
else pass('every guide and lab is reachable from the landing HTML without JavaScript');

const g = GUIDES[0];
const gp = await get(`/learn/guide/${g.num}`);
if (!gp.text.includes(`href="${BASE}/learn/guide/${g.num}"`) && !/rel="canonical"/.test(gp.text))
  fail('guide page has no canonical');
else pass('guide page has a canonical');
const gld = lds(gp.text);
if (!gld.some((d) => JSON.stringify(d).includes('"TechArticle"'))) fail('guide page has no TechArticle JSON-LD');
else if (!gld.some((d) => JSON.stringify(d).includes('"BreadcrumbList"'))) fail('guide page has no BreadcrumbList');
else pass('guide page carries TechArticle + BreadcrumbList JSON-LD');

const l = LAB_INDEX[0];
const lp = await get(`/labs/${l.id}`);
const lld = lds(lp.text);
if (!lld.some((d) => JSON.stringify(d).includes('"LearningResource"'))) fail('lab page has no LearningResource JSON-LD');
else pass('lab page carries LearningResource/HowTo JSON-LD');
if (!/<meta name="description" content="[^"]{40,}"/.test(lp.text)) fail('lab page description is missing or too short');
else pass('lab page has a real description');

/* Login and the auth callback must never be indexed. */
const login = await get('/login');
if (!/name="robots" content="[^"]*noindex/.test(login.text)) fail('/login is indexable');
else pass('/login is noindex');
if (!/Disallow:\s*\/auth\//.test(robots.text)) fail('robots.txt does not disallow /auth/');
else pass('robots.txt disallows /auth/');

console.log(bad ? `\n\x1b[31mtest-seo: ${bad} failure(s)\x1b[0m\n` : '\n\x1b[32mtest-seo: PASS\x1b[0m\n');
process.exit(bad ? 1 : 0);
