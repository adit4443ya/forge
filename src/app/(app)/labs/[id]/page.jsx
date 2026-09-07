import { notFound } from "next/navigation";
import { loadLab, LAB_INDEX, LAB_TRACKS } from "@/lib/content/labs.js";
import { abs, jsonLd, SITE_NAME } from "@/lib/seo.js";
import LabRunner from "@/screens/LabRunner.jsx";

export function generateStaticParams() {
  return LAB_INDEX.map((l) => ({ id: l.id }));
}

/* Not every lab has a hand-written teaser, and an empty description is worse
   than a generated one — so fall back to the skills and the evidence the lab
   asks you to produce, which is the honest summary anyway. */
function summarise(l) {
  if (l.teaser) return l.teaser;
  const skills = (l.skills || []).slice(0, 5).join(", ");
  const parts = [];
  if (skills) parts.push(`Hands-on with ${skills}`);
  if (l.evidence) parts.push(`Finish it by producing: ${l.evidence}`);
  if (!parts.length) parts.push(`A guided lab you run on your own machine`);
  return `${parts.join(". ")}.`.replace(/\.\.$/, ".");
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const l = LAB_INDEX.find((x) => x.id === id);
  if (!l) return {};
  const description = summarise(l);
  const url = abs(`/labs/${l.id}`);
  return {
    title: l.title,
    description,
    keywords: l.skills || undefined,
    alternates: { canonical: `/labs/${l.id}` },
    openGraph: { title: l.title, description, url, type: "article", siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title: l.title, description },
  };
}

export default async function LabPage({ params }) {
  const { id } = await params;
  const lab = await loadLab(id);
  if (!lab) notFound();
  const track = LAB_TRACKS.find((t) => t.id === lab.track) || null;
  const idx = LAB_INDEX.findIndex((l) => l.id === id);
  const meta = LAB_INDEX[idx] || lab;
  const url = abs(`/labs/${id}`);
  /* A lab genuinely is a HowTo: numbered steps, each with a command to run.
     Describing it as one is accurate, not SEO decoration. */
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LearningResource", "HowTo"],
        "@id": `${url}#lab`,
        name: lab.title,
        description: summarise(meta),
        learningResourceType: "Lab exercise",
        educationalLevel: track ? track.title : undefined,
        teaches: (meta.skills || []).join(", ") || undefined,
        totalTime: meta.minutes ? `PT${meta.minutes}M` : undefined,
        inLanguage: "en",
        mainEntityOfPage: url,
        isPartOf: { "@id": abs("/#website") },
        step: (lab.steps || []).slice(0, 20).map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.title || `Step ${i + 1}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Forge", item: abs("/") },
          { "@type": "ListItem", position: 2, name: "Labs", item: abs("/labs") },
          { "@type": "ListItem", position: 3, name: lab.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <LabRunner
        lab={lab}
        track={track}
        prev={idx > 0 ? LAB_INDEX[idx - 1] : null}
        next={idx >= 0 && idx < LAB_INDEX.length - 1 ? LAB_INDEX[idx + 1] : null}
      />
    </>
  );
}
