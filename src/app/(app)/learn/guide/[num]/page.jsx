import { notFound } from "next/navigation";
import { loadGuideBody, GUIDES } from "@/lib/content/guides.js";
import { abs, jsonLd, SITE_NAME } from "@/lib/seo.js";
import GuideReader from "@/screens/GuideReader.jsx";

/* Every guide is a real URL, prerendered at build time. The markdown is read
   here on the server, so none of the 532 KB of guide text reaches the browser
   bundle — only the one guide being read is sent, already parsed into HTML.
   Being server-rendered is also what makes these the site's search surface:
   they are the pages a crawler can actually read. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ num: g.num }));
}

/* The description a crawler shows is the snippet a human decides on, so it
   says what the guide covers rather than repeating metadata about it. */
function summarise(g) {
  const topics = (g.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const lead = topics.length ? `Covers ${topics.slice(0, 6).join(", ")}. ` : "";
  return `${lead}${g.readTime} read, ${g.headings.length} sections, in the ${g.category} track of Forge.`;
}

export async function generateMetadata({ params }) {
  const { num } = await params;
  const g = GUIDES.find((x) => x.num === num);
  if (!g) return {};
  const description = summarise(g);
  const url = abs(`/learn/guide/${g.num}`);
  return {
    title: g.title,
    description,
    keywords: (g.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    alternates: { canonical: `/learn/guide/${g.num}` },
    openGraph: { title: g.title, description, url, type: "article", siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title: g.title, description },
  };
}

export default async function GuidePage({ params }) {
  const { num } = await params;
  const guide = await loadGuideBody(num);
  if (!guide) notFound();
  const url = abs(`/learn/guide/${guide.num}`);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: guide.title,
        description: summarise(guide),
        articleSection: guide.category,
        keywords: guide.tags || undefined,
        wordCount: guide.words || undefined,
        timeRequired: /^(\d+)/.test(guide.readTime) ? `PT${guide.readTime.match(/^(\d+)/)[1]}M` : undefined,
        inLanguage: "en",
        mainEntityOfPage: url,
        isPartOf: { "@id": abs("/#website") },
        /* The section headings are the guide's real table of contents, and
           they are what a search result's jump-links are built from. */
        hasPart: guide.headings.slice(0, 25).map((h) => ({
          "@type": "WebPageElement", name: h.text, url: `${url}#${h.id}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Forge", item: abs("/") },
          { "@type": "ListItem", position: 2, name: "Learn", item: abs("/learn") },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <GuideReader guide={guide} />
    </>
  );
}
