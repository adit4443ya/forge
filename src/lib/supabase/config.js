/* One place that decides whether the cloud exists.
   The app is fully usable with no Supabase project at all: progress then lives
   in localStorage only. Every cloud path checks this flag first. */

/* The dashboard shows several URLs and only one of them is the project URL.
   People reliably paste the REST endpoint (".../rest/v1/") or the auth one, so
   normalise rather than fail: the origin is the only part that matters. */
export function normalizeSupabaseUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  try {
    return new URL(v).origin;
  } catch {
    return v.replace(/\/(rest|auth|storage|realtime|functions)\/v\d.*$/, "").replace(/\/+$/, "");
  }
}

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
export const CLOUD_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT")
);
