import { abs, siteUrl } from "@/lib/seo.js";

/* Auth routes carry one-time codes and the login page is a dead end for a
   crawler; everything else is public and worth indexing. */
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/auth/", "/login"] }],
    sitemap: abs("/sitemap.xml"),
    host: siteUrl(),
  };
}
