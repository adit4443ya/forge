import { notFound } from "next/navigation";
import { loadGuideBody, GUIDES } from "@/lib/content/guides.js";
import GuideReader from "@/screens/GuideReader.jsx";

/* Every guide is a real URL, prerendered at build time. The markdown is read
   here on the server, so none of the 532 KB of guide text reaches the browser
   bundle — only the one guide being read is sent, already parsed into HTML. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ num: g.num }));
}

export async function generateMetadata({ params }) {
  const { num } = await params;
  const g = GUIDES.find((x) => x.num === num);
  return g ? { title: g.title, description: `${g.category} · ${g.readTime} · ${g.headings.length} sections` } : {};
}

export default async function GuidePage({ params }) {
  const { num } = await params;
  const guide = await loadGuideBody(num);
  if (!guide) notFound();
  return <GuideReader guide={guide} />;
}
