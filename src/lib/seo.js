/* Everything discoverability-related resolves through here, so there is one
   answer to "what is this site's URL" rather than one per call site.
   NEXT_PUBLIC_SITE_URL is already the deployment's own idea of its origin (the
   OAuth callback validates against it), so SEO reuses it instead of inventing
   a second source of truth. Locally it is unset and the fallback keeps
   metadataBase valid — Next warns and guesses otherwise. */
const FALLBACK = "http://localhost:3000";

export function siteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (raw) {
    try {
      return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
    } catch { /* fall through — a malformed value must not break the build */ }
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return FALLBACK;
}

export const abs = (p = "/") => new URL(p, siteUrl()).toString();

export const SITE_NAME = "Forge";

/* The phrases someone would actually type when looking for this. Kept here
   rather than sprinkled through pages so they stay consistent and reviewable —
   and deliberately about the subject matter, not about any employer. */
export const KEYWORDS = [
  "compiler engineer interview preparation",
  "LLVM interview questions",
  "systems programming interview",
  "high frequency trading interview preparation",
  "low latency C++ interview",
  "C++ object model questions",
  "quant developer interview",
  "performance engineering practice",
  "perf counters lab",
  "cache behaviour lab",
  "AArch64 codegen",
  "SSA form",
  "register allocation",
  "alias analysis",
  "lock-free queue",
  "memory model acquire release",
  "spaced repetition engineering interview",
  "coding interview patterns",
];

/* Rendered as a <script type="application/ld+json">. Kept as a helper because
   the escaping matters: a literal "</script>" inside JSON would end the tag. */
export function jsonLd(data) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
