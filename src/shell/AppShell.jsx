"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { tk, hue as H, useTheme } from "@/theme/carbon.jsx";
import { ROLES, ROLE_BY_ID } from "@/data/roles.js";
import { useProgress, progressStore } from "@/lib/progress/store.js";
import { NavCtx, SURFACES, targetFromParams, hrefFor } from "./nav.js";
import CommandPalette from "./CommandPalette.jsx";
import AccountMenu from "./AccountMenu.jsx";
import Scratchpad from "./Scratchpad.jsx";
import RolePicker from "./RolePicker.jsx";
import SessionBar from "./SessionBar.jsx";

const SunIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3L17.1 6.9M6.9 17.1l-1.6 1.6" />
  </svg>
);
const MoonIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.4 14.2A8.4 8.4 0 0 1 9.8 3.6a8.4 8.4 0 1 0 10.6 10.6Z" />
  </svg>
);

const IconBtn = ({ onClick, title, children, active }) => (
  <button className="press icon-btn" onClick={onClick} title={title} aria-label={title} data-active={active ? "1" : undefined}>
    {children}
  </button>
);

/* useSearchParams forces whatever renders it under a Suspense boundary, and
   anything inside a boundary loses its server-rendered <script> tags — which is
   how the guide and lab pages were silently dropping their structured data.
   So the boundary lives here, around the one component that needs it, instead
   of around the whole app in the layout. Page content now renders outside any
   boundary and reaches the HTML intact. */
function TargetBridge({ onTarget }) {
  const params = useSearchParams();
  useEffect(() => { onTarget(targetFromParams(params)); }, [params, onTarget]);
  return null;
}

function RoleSwitch({ role, setRole }) {
  const [open, setOpen] = useState(false);
  const r = ROLE_BY_ID[role] || ROLES[0];
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button className="press chip-btn" onClick={() => setOpen((o) => !o)} title="Switch target role" aria-expanded={open}>
        <span style={{ color: H(r.hue).fg, fontSize: "var(--fs-md)", lineHeight: 1 }}>{r.icon}</span>
        <span className="hide-sm">{r.name}</span>
        <span className="caret" data-open={open ? "1" : undefined}>▼</span>
      </button>
      {open && (
        <div className="menu anim-scale" style={{ width: 330 }}>
          <div className="label" style={{ padding: "8px 10px 6px" }}>Target role · filters everything</div>
          {ROLES.map((x) => {
            const on = x.id === role;
            return (
              <button key={x.id} className="press menu-item" data-on={on ? "1" : undefined}
                onClick={() => { setRole(x.id); setOpen(false); }}
                style={on ? { background: H(x.hue).bg, borderColor: H(x.hue).line } : undefined}>
                <span style={{ color: H(x.hue).fg, fontSize: "var(--fs-lg)", lineHeight: 1.2 }}>{x.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 650 }}>{x.name}</span>
                  <span className="mono" style={{ display: "block", color: tk.faint, fontSize: "var(--fs-micro)", marginTop: 1 }}>{x.tag}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const prog = useProgress();
  const { mode, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const surface = SURFACES.find((s) => pathname?.startsWith(s.href))?.id || "today";
  const role = prog.role || "compiler";
  /* Starts null and is filled on the client, which is exactly what happened
     before: on a statically rendered page useSearchParams has nothing to read
     during prerender either. */
  const [target, setTarget] = useState(null);

  const setRole = useCallback((r) => progressStore.setRole(r), []);
  const go = useCallback((s, t = null) => router.push(hrefFor(s, t)), [router]);

  const nav = useMemo(() => ({
    surface, go, role, setRole, target,
    openProblem: (id) => go("practice", { kind: "problem", id }),
    openGuide: (num, anchor) => go("learn", { kind: "guide", num, anchor }),
    openCompetency: (id) => go("learn", { kind: "competency", id }),
    openLab: (id) => go("labs", { kind: "lab", id }),
    openSession: (id) => go("today", { kind: "session", id }),
    openTab: (id) => go(surface, { kind: "tab", id }),
    openPalette: () => setPaletteOpen(true),
  }), [surface, go, role, setRole, target]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = SURFACES.find((x) => x.key === e.key);
      if (s) { e.preventDefault(); router.push(s.href); }
      if (e.key === "?") { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <NavCtx.Provider value={nav}>
      <Suspense fallback={null}><TargetBridge onTarget={setTarget} /></Suspense>
      <div className="shell">
        <header className="topbar">
          <Link className="press brand" href="/today" title="Home">
            <span className="brand-mark">F</span>
            <span className="hide-sm brand-name">Forge</span>
          </Link>

          <nav className="tabs" aria-label="Primary">
            {SURFACES.map((s) => {
              const on = s.id === surface;
              return (
                <Link key={s.id} className="press tab" href={s.href} data-on={on ? "1" : undefined}
                  title={`${s.hint}  ·  ${s.key}`} aria-current={on ? "page" : undefined}>
                  {s.label}
                  {on && <span className="tab-underline anim-fade" />}
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          <RoleSwitch role={role} setRole={setRole} />

          <button className="press search-btn" onClick={() => setPaletteOpen(true)} title="Search everything (⌘K)">
            <span style={{ fontSize: 13 }}>⌕</span>
            <span className="hide-sm">Search</span>
            <kbd className="mono hide-sm">⌘K</kbd>
          </button>

          <IconBtn onClick={toggle} title={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}>
            {mode === "dark" ? SunIcon : MoonIcon}
          </IconBtn>

          <AccountMenu />
        </header>

        <SessionBar />

        <div className="surface">
          <div key={pathname} className="pane surface-enter">{children}</div>
        </div>

        {paletteOpen && <CommandPalette open onClose={() => setPaletteOpen(false)} nav={nav} />}
        {/* Scratchpad reads the search params too, so it carries its own boundary
            rather than pulling one back around the page content. */}
        <Suspense fallback={null}><Scratchpad /></Suspense>
        <RolePicker />
      </div>
    </NavCtx.Provider>
  );
}
