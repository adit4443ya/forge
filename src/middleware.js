import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from "@/lib/supabase/config";
import { withDeadline } from "@/lib/deadline";

/* Refreshes the Supabase session cookie on navigation so a signed-in user
   stays signed in. A no-op when no Supabase project is configured, which is
   what makes the app work with zero setup.

   Two things this must never do, both learned from a 504 in production:

   1. Call Supabase for a visitor who has no session. Nothing on the server
      reads the user — the only other server-side Supabase client is the one the
      auth callback builds for the code exchange — so for a signed-out visitor
      there is nothing to refresh. Without the cookie check below, every
      anonymous page view and every crawler hit (120 URLs in the sitemap) spent
      a network round-trip to Supabase to be told "no session".

   2. Wait indefinitely. A slow or unreachable Supabase does not throw, it
      hangs, so a try/catch does not cover it: the request blocks until the
      platform kills the middleware and serves 504
      MIDDLEWARE_INVOCATION_TIMEOUT — the whole page fails because a background
      cookie refresh was slow. The refresh is an optimisation; supabase-js
      refreshes its own token in the browser regardless. So it gets a deadline,
      and missing it costs nothing. */

const REFRESH_DEADLINE_MS = 2500;

/* @supabase/ssr stores the session in sb-<project-ref>-auth-token, split across
   .0/.1 cookies when it is long. Any of them means "there may be a session". */
const hasSessionCookie = (request) =>
  request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

export async function middleware(request) {
  const response = NextResponse.next({ request });
  if (!CLOUD_ENABLED) return response;
  if (!hasSessionCookie(request)) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  /* A missed deadline degrades to "cookie not refreshed this time", never to
     an error page. */
  try { await withDeadline(supabase.auth.getUser(), REFRESH_DEADLINE_MS); }
  catch { /* offline or misconfigured: serve the page anyway */ }

  return response;
}

export const config = {
  /* Skip what has no session to refresh: build assets, images, and the SEO
     endpoints, which are fetched by crawlers that never sign in. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
