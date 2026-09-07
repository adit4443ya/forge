import { GUIDES } from "@/data/generated/guides.js";
import { LAB_INDEX } from "@/data/generated/labs.js";
import { STATS } from "@/data/generated/stats.js";
import { abs } from "@/lib/seo.js";

/* Guides and labs are the pages with real indexable prose — they are
   server-rendered and prerendered at build time — so they get the higher
   priority. The app surfaces are client screens behind a shell; they belong in
   the sitemap so the routes are known, but they are not the search entry. */
export default function sitemap() {
  const built = STATS.generatedAt ? new Date(STATS.generatedAt) : new Date();
  const lastModified = Number.isNaN(built.valueOf()) ? new Date() : built;

  const fixed = [
    { url: abs("/"), priority: 1, changeFrequency: "weekly" },
    { url: abs("/learn"), priority: 0.8, changeFrequency: "weekly" },
    { url: abs("/practice"), priority: 0.8, changeFrequency: "weekly" },
    { url: abs("/labs"), priority: 0.8, changeFrequency: "weekly" },
    { url: abs("/today"), priority: 0.5, changeFrequency: "daily" },
    { url: abs("/progress"), priority: 0.3, changeFrequency: "monthly" },
  ];

  return [
    ...fixed,
    ...GUIDES.map((g) => ({ url: abs(`/learn/guide/${g.num}`), priority: 0.9, changeFrequency: "monthly" })),
    ...LAB_INDEX.map((l) => ({ url: abs(`/labs/${l.id}`), priority: 0.7, changeFrequency: "monthly" })),
  ].map((e) => ({ lastModified, ...e }));
}
