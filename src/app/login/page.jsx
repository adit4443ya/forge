import Link from "next/link";
import { CLOUD_ENABLED } from "@/lib/supabase/config";
import SignInButton from "./SignInButton.jsx";

export const metadata = { title: "Sign in · Forge", robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  return (
    <main className="auth-shell">
      <div className="auth-card anim-rise">
        <div className="auth-mark">F</div>
        <h1>Forge</h1>
        <p className="auth-sub">
          Sign in to keep your progress across devices. Everything works without an account too —
          it just stays in this browser.
        </p>
        {error && (
          <div className="auth-error">
            {decodeURIComponent(error)}
            {/redirect|callback|missing_code/i.test(error) && (
              <div style={{ marginTop: 8, opacity: .85, fontSize: "var(--fs-micro)", lineHeight: 1.6 }}>
                Supabase only returns to URLs on its allowlist. Add this exact value under
                Authentication → URL Configuration → Redirect URLs.
              </div>
            )}
          </div>
        )}
        {CLOUD_ENABLED
          ? <SignInButton />
          : <div className="auth-note">
              No Supabase project is configured for this deployment, so sign-in is off.
              Progress is saved in this browser only.
            </div>}
        <Link className="auth-skip" href="/today">Continue without an account →</Link>
      </div>
    </main>
  );
}
