/* One place that decides whether the cloud exists.
   The app is fully usable with no Supabase project at all: progress then lives
   in localStorage only. Every cloud path checks this flag first. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const CLOUD_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT")
);
