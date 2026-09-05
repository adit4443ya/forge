import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/* Google returns here with a one-time code. Exchange it for a session cookie,
   then send the user back to whatever page they signed in from. */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/today";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const sb = await supabaseServer();
  if (!sb) return NextResponse.redirect(`${origin}/today`);   // cloud off: nothing to exchange

  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/today"}`);
}
