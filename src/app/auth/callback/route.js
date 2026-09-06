import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/* Google returns here with a one-time code. Exchange it for a session cookie,
   then send the user back to whatever page they signed in from.

   Everything here is defensive on purpose: this route runs exactly once, on a
   redirect the user cannot retry, and anything that throws becomes a blank 500
   with no way to tell what went wrong. So the base URL is validated rather than
   trusted, and every failure ends on /login with a message. */

/** A usable absolute origin, or null. Tolerates a missing scheme and a trailing slash. */
function toOrigin(value) {
  const v = String(value || "").trim().replace(/\/+$/, "");
  if (!v) return null;
  try { return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin; }
  catch { return null; }
}

export async function GET(request) {
  /* Fall back to the request's own origin, which is always valid, so a
     misconfigured NEXT_PUBLIC_SITE_URL degrades instead of 500ing. */
  const url = new URL(request.url);
  const configured = toOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const origin = configured || url.origin;
  const to = (path) => NextResponse.redirect(`${origin}${path.startsWith("/") ? path : `/${path}`}`);

  try {
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (oauthError) return to(`/login?error=${encodeURIComponent(oauthError)}`);
    if (!code) return to("/login?error=missing_code");

    const sb = await supabaseServer();
    if (!sb) return to("/today");                       // cloud off: nothing to exchange

    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return to(`/login?error=${encodeURIComponent(error.message)}`);

    const next = url.searchParams.get("next") || "/today";
    return to(next.startsWith("/") ? next : "/today");
  } catch (e) {
    /* Never let this surface as an unexplained 500. */
    const msg = e?.message || String(e);
    console.error("[auth/callback]", msg);
    if (!configured && process.env.NEXT_PUBLIC_SITE_URL) {
      return to(`/login?error=${encodeURIComponent(
        `NEXT_PUBLIC_SITE_URL is not a valid URL ("${process.env.NEXT_PUBLIC_SITE_URL}"). It must include https://`)}`);
    }
    return to(`/login?error=${encodeURIComponent(msg)}`);
  }
}
