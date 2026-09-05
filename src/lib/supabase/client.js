"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from "./config";

let cached = null;
/** Browser Supabase client, or null when the project is not configured. */
export function supabaseBrowser() {
  if (!CLOUD_ENABLED) return null;
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
