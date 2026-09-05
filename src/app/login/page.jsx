import Link from "next/link";
import { CLOUD_ENABLED } from "@/lib/supabase/config";
import SignInButton from "./SignInButton.jsx";

export const metadata = { title: "Sign in · Forge" };

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
        {error && <div className="auth-error">{decodeURIComponent(error)}</div>}
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
