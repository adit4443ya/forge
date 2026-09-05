import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from "@/lib/supabase/config";

/* Refreshes the Supabase session cookie on navigation so a signed-in user
   stays signed in. A no-op when no Supabase project is configured, which is
   what makes the app work with zero setup. */
export async function middleware(request) {
  const response = NextResponse.next({ request });
  if (!CLOUD_ENABLED) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try { await supabase.auth.getUser(); } catch { /* offline or misconfigured: serve anyway */ }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
