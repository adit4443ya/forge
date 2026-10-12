import { Suspense } from "react";
import MachineClient from "./MachineClient.jsx";
import { abs, jsonLd, SITE_NAME } from "@/lib/seo.js";
import { LITMUS } from "@/data/litmus.js";
import { RAPID } from "@/data/rapidfire.js";

const DESC =
  "How memory actually works, as one subject: DRAM and caches, MESI coherence and false sharing, "
  + "the store buffer and why weak memory models exist, x86-TSO versus AArch64, litmus tests, TLB reach "
  + "and huge pages, and the OS costs that show up only at p99.9. Four guides, "
  + `${LITMUS.length} litmus drills and ${RAPID.filter((r) => r.domain === "mem").length} rapid-fire questions.`;

export const metadata = {
  title: "The Machine — memory, coherence and ordering",
  description: DESC,
  alternates: { canonical: "/machine" },
  openGraph: { title: "The Machine", description: DESC, url: abs("/machine"), type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: "The Machine", description: DESC },
};

/* A LearningResource rather than an Article: this page is a curriculum over
   other pages, and the ItemList is what makes the four guides discoverable
   as a sequence rather than as four unrelated documents. */
const LD = {
  "@context": "https://schema.org",
  "@type": "LearningResource",
  name: "The Machine — memory, coherence and ordering",
  description: DESC,
  url: abs("/machine"),
  learningResourceType: "Course",
  teaches: [
    "cache hierarchy", "DRAM row buffers", "cache coherence", "MESI protocol", "false sharing",
    "memory consistency models", "x86-TSO", "AArch64 weak memory", "litmus tests",
    "C++ memory_order", "virtual memory", "TLB reach", "huge pages", "NUMA", "tail latency",
  ],
  hasPart: [
    { "@type": "TechArticle", name: "The Memory Hierarchy, Derived", url: abs("/learn/guide/24") },
    { "@type": "TechArticle", name: "Coherence and the Hardware Memory Model", url: abs("/learn/guide/25") },
    { "@type": "TechArticle", name: "Virtual Memory and the OS Tax", url: abs("/learn/guide/26") },
    { "@type": "TechArticle", name: "Concurrency in Practice", url: abs("/learn/guide/27") },
  ],
};

/* The interactive screen reads search params, so it is a client component behind
   a Suspense boundary — which means its prose never reaches the served HTML.
   The fallback DOES, so it carries the page's substance instead of the word
   "Loading…". Kept deliberately compact: it is replaced on hydration, and a
   large block would flash. */
const SPINE_LINKS = [
  ["24", "The Memory Hierarchy, Derived", "DRAM row buffers, cache lines, associativity and conflict misses, prefetchers, memory-level parallelism"],
  ["25", "Coherence and the Hardware Memory Model", "MESI, false sharing, the store buffer, x86-TSO versus AArch64 weak memory, litmus tests"],
  ["26", "Virtual Memory and the OS Tax", "page walks, TLB reach, huge pages, NUMA, page faults, scheduler jitter and tail latency"],
  ["27", "Concurrency in Practice", "the C++ memory model, memory_order, SPSC queues, seqlocks, RCU, hazard pointers, ABA"],
];

function CrawlableSummary() {
  return (
    <div className="boot">
      <h1>The Machine</h1>
      <p>{DESC}</p>
      <ul>
        {SPINE_LINKS.map(([num, title, covers]) => (
          <li key={num}>
            <a href={`/learn/guide/${num}`}>{title}</a> — {covers}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MachinePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(LD)} />
      <Suspense fallback={<CrawlableSummary />}><MachineClient /></Suspense>
    </>
  );
}
