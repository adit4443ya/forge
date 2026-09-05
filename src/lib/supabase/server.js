import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from "./config";

/** Server Supabase client bound to the request cookies, or null when unconfigured. */
export async function supabaseServer() {
  if (!CLOUD_ENABLED) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a Server Component: middleware refreshes instead */ }
      },
    },
  });
}

/** The signed-in user, or null. Never throws. */
export async function currentUser() {
  const sb = await supabaseServer();
  if (!sb) return null;
  try { const { data } = await sb.auth.getUser(); return data?.user ?? null; }
  catch { return null; }
}
