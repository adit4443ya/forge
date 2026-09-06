"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useNow } from "@/ui/hooks.js";
import { Mono, mmss } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";
import { TEMPLATE_BY_ID, templateForRole } from "@/data/sessions.js";
import { ROLE_BY_ID } from "@/data/roles.js";

/* ══════════════════════════════════════════════════════════════════════════
   SESSION BAR — the session follows you.

   Starting a session used to replace the whole Today page, and then opening a
   problem from it landed you on Practice with no step counter, no clock and no
   way back: the runner stopped running the moment you did what it told you to.
   This bar rides above every surface while a session is live.
   ══════════════════════════════════════════════════════════════════════════ */

export default function SessionBar() {
  const prog = useProgress();
  const pathname = usePathname();
  const now = useNow(1000);
  const s = prog.session;
  if (!s) return null;
  /* Today already shows the full runner; a bar there would be a second copy. */
  if (pathname === "/today") return null;

  const base = TEMPLATE_BY_ID[s.templateId];
  if (!base) return null;
  const t = templateForRole(base, prog.role);
  const done = (s.done || []).length;
  const secs = Math.max(0, Math.floor((now - s.startedAt) / 1000));
  const over = secs > t.minutes * 60;
  const step = t.steps[Math.min(done, t.steps.length - 1)];

  return (
    <div className="sess-bar">
      <span className="sess-dot" />
      <Mono>{t.name}</Mono>
      <span className="sess-step">
        step {Math.min(done + 1, t.steps.length)} of {t.steps.length} · {step?.label}
      </span>
      <div style={{ flex: 1 }} />
      <Mono style={{ color: over ? "var(--tk-warn)" : undefined }}>
        {mmss(secs)}{over ? ` · ${t.minutes}m planned` : ` / ${t.minutes}m`}
      </Mono>
      <Link href="/today" className="press sess-btn">back to session</Link>
      <button className="press sess-btn" onClick={() => progressStore.endSession(Math.round(secs / 60))}>
        finish
      </button>
    </div>
  );
}

export { ROLE_BY_ID };
