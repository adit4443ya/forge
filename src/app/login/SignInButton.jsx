"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function SignInButton() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <button className="auth-google press" disabled={busy}
      onClick={() => { setBusy(true); signIn().catch(() => setBusy(false)); }}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.9h6c-.1 1-.8 2.5-2.2 3.5l3.4 2.6c2-1.8 3.4-4.6 3.4-8z" />
        <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.4-2.6c-.9.6-2.1 1.1-3.8 1.1-2.9 0-5.3-1.9-6.2-4.5l-3.5 2.7C4.1 20.5 7.8 23 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.6.4-2.4L2.3 6.9C1.5 8.4 1 10.1 1 12s.5 3.6 1.3 5.1l3.5-2.7z" />
        <path fill="#EA4335" d="M12 5.5c2 0 3.4.9 4.2 1.6l3-3C17.4 2.3 14.9 1 12 1 7.8 1 4.1 3.5 2.3 6.9l3.5 2.7C6.7 7.4 9.1 5.5 12 5.5z" />
      </svg>
      {busy ? "Redirecting to Google…" : "Continue with Google"}
    </button>
  );
}
