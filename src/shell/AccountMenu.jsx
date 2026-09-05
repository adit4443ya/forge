"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider.jsx";
import { useSyncState, progressStore, refresh } from "@/lib/progress/store.js";
import { tk } from "@/theme/carbon.jsx";

const DOT = { local: tk.faint, syncing: tk.warn, synced: tk.ok, error: tk.bad };
const LABEL = {
  local: "Saved in this browser",
  syncing: "Syncing…",
  synced: "Synced to your account",
  error: "Sync problem",
};

export default function AccountMenu() {
  const { user, cloud, signIn, signOut } = useAuth();
  const sync = useSyncState();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const status = user ? sync.status : "local";
  const initial = (user?.user_metadata?.full_name || user?.email || "?").trim()[0]?.toUpperCase() || "?";
  const avatar = user?.user_metadata?.avatar_url;

  const download = () => {
    const blob = new Blob([progressStore.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forge-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try { progressStore.importJson(await f.text()); }
      catch (e) { alert("Could not import that file: " + (e?.message || e)); }
    };
    input.click();
  };

  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button className="press avatar-btn" onClick={() => setOpen((o) => !o)}
        title={user ? `${user.email} · ${LABEL[status]}` : LABEL[status]} aria-expanded={open}>
        {avatar
          ? <img src={avatar} alt="" width={24} height={24} style={{ borderRadius: "50%" }} referrerPolicy="no-referrer" />
          : <span className="avatar-fallback">{user ? initial : "○"}</span>}
        <span className="sync-dot" style={{ background: DOT[status] }} />
      </button>

      {open && (
        <div className="menu anim-scale" style={{ width: 292, right: 0, left: "auto" }}>
          <div style={{ padding: "10px 11px 8px", borderBottom: `1px solid ${tk.line}` }}>
            <div style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 650 }}>
              {user ? (user.user_metadata?.full_name || user.email) : "Not signed in"}
            </div>
            <div className="mono" style={{ color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sync-dot" style={{ position: "static", background: DOT[status] }} />
              {LABEL[status]}
            </div>
            {status === "error" && sync.error && (
              <div style={{ color: tk.bad, fontSize: "var(--fs-micro)", marginTop: 6, lineHeight: 1.5 }}>{sync.error}</div>
            )}
          </div>

          <div style={{ padding: 5 }}>
            {cloud && !user && (
              <button className="press menu-item" onClick={() => { setOpen(false); signIn(); }}>
                <span>→</span><span style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>Sign in with Google</span>
              </button>
            )}
            {user && (
              <>
                <button className="press menu-item" onClick={() => { refresh(); }}>
                  <span>↻</span><span style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>Sync now</span>
                </button>
                <button className="press menu-item" onClick={() => { setOpen(false); signOut(); }}>
                  <span>←</span><span style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>Sign out</span>
                </button>
              </>
            )}
            <button className="press menu-item" onClick={download}>
              <span>↓</span><span style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>Export progress (JSON)</span>
            </button>
            <button className="press menu-item" onClick={upload}>
              <span>↑</span><span style={{ color: tk.text, fontSize: "var(--fs-sm)" }}>Import progress</span>
            </button>
          </div>

          {!cloud && (
            <div style={{ padding: "9px 11px", borderTop: `1px solid ${tk.line}`, color: tk.faint, fontSize: "var(--fs-micro)", lineHeight: 1.6 }}>
              Sign-in is off because this deployment has no Supabase project configured.
              Export keeps a backup you can import anywhere.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
