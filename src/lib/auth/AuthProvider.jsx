"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../supabase/client.js";
import { CLOUD_ENABLED } from "../supabase/config.js";
import { bootProgress } from "../progress/store.js";

const AuthCtx = createContext({ user: null, loading: false, cloud: false, signIn: () => {}, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(CLOUD_ENABLED);

  useEffect(() => {
    bootProgress();
    const sb = supabaseBrowser();
    // No project configured: `loading` already started false via CLOUD_ENABLED.
    if (!sb) return;
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data?.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const signIn = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    await sb.auth.signOut();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, cloud: CLOUD_ENABLED, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
