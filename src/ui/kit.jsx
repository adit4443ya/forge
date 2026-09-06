"use client";
// ════════════════════════════════════════════════════════════════════
//  UI KIT — the whole vocabulary of the app, in one file.
//  Components take a semantic `hue` ("ok", "warn", "accent"…), never a color,
//  so the palette can change in carbon.js without touching a screen.
// ════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tk, hue as H, alpha, useSyntaxTheme } from "@/theme/carbon.jsx";

/* ── text ─────────────────────────────────────────────────────────── */
export const Label = ({ children, hue = "neutral", style }) => (
  <span className="label" style={{ color: hue === "neutral" ? tk.faint : H(hue).fg, ...style }}>{children}</span>
);
export const Mono = ({ children, dim, style }) => (
  <span className="mono" style={{ fontSize: "var(--fs-caption)", color: dim ? tk.faint : tk.dim, ...style }}>{children}</span>
);
export const H1 = ({ children, style }) => (
  <h1 style={{ margin: 0, fontSize: "var(--fs-3xl)", fontWeight: 700, letterSpacing: "-0.025em", color: tk.text, lineHeight: 1.15, ...style }}>{children}</h1>
);
export const H2 = ({ children, style }) => (
  <h2 style={{ margin: 0, fontSize: "var(--fs-xl)", fontWeight: 650, letterSpacing: "-0.015em", color: tk.text, ...style }}>{children}</h2>
);
export const Muted = ({ children, style }) => (
  <p style={{ margin: 0, color: tk.dim, fontSize: "var(--fs-md)", lineHeight: 1.65, ...style }}>{children}</p>
);

/* ── section: a titled block with a hairline rule ─────────────────── */
export const Section = ({ title, right, children, hue = "neutral", style, i = 0 }) => (
  <section className="anim-rise" style={{ "--i": i, marginBottom: "var(--sp-7)", ...style }}>
    {(title || right) && (
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--sp-3)", marginBottom: "var(--sp-4)", paddingBottom: "var(--sp-2)", borderBottom: `1px solid ${tk.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)" }}>
          {hue !== "neutral" && <span style={{ width: 6, height: 6, borderRadius: 2, background: H(hue).fg, transform: "translateY(-2px)" }} />}
          <span className="label" style={{ color: tk.dim }}>{title}</span>
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

/* ── surfaces ─────────────────────────────────────────────────────── */
export const Panel = ({ children, hue = "neutral", onClick, active, style, className = "", i = 0, hoverable, ...rest }) => {
  const h = H(hue);
  const interactive = !!onClick || hoverable;
  return (
    <div
      {...rest}
      className={`${interactive ? "lift " : ""}${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
      style={{
        "--i": i,
        background: active ? h.bg : tk.bg1,
        border: `1px solid ${active ? h.line : tk.line}`,
        borderRadius: "var(--r-3)",
        padding: "var(--sp-4)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onMouseOver={interactive ? (e) => { e.currentTarget.style.borderColor = h.line; e.currentTarget.style.background = active ? h.bg2 : tk.bg2; } : undefined}
      onMouseOut={interactive ? (e) => { e.currentTarget.style.borderColor = active ? h.line : tk.line; e.currentTarget.style.background = active ? h.bg : tk.bg1; } : undefined}
    >
      {children}
    </div>
  );
};

/* ── controls ─────────────────────────────────────────────────────── */
export const Button = ({ children, onClick, hue = "neutral", variant = "ghost", size = "md", disabled, title, style, full }) => {
  const h = H(hue);
  const pad = size === "lg" ? "12px 22px" : size === "sm" ? "5px 11px" : "8px 15px";
  const fs = size === "lg" ? "var(--fs-md)" : size === "sm" ? "var(--fs-xs)" : "var(--fs-sm)";
  const solid = variant === "solid";
  return (
    <button
      className="press" onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: pad, fontSize: fs, fontWeight: 600, borderRadius: "var(--r-2)",
        width: full ? "100%" : undefined,
        color: disabled ? tk.faint : solid ? tk.inverse : hue === "neutral" ? tk.dim : h.fg,
        background: disabled ? tk.bg2 : solid ? h.fg : hue === "neutral" ? tk.bg2 : h.bg,
        border: `1px solid ${disabled ? tk.line : solid ? h.fg : hue === "neutral" ? tk.line : h.line}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? .6 : 1,
        ...style,
      }}
      onMouseOver={disabled ? undefined : (e) => { if (!solid) { e.currentTarget.style.background = h.bg2; e.currentTarget.style.color = h.fg; e.currentTarget.style.borderColor = h.line; } else e.currentTarget.style.filter = "brightness(1.08)"; }}
      onMouseOut={disabled ? undefined : (e) => { if (!solid) { e.currentTarget.style.background = hue === "neutral" ? tk.bg2 : h.bg; e.currentTarget.style.color = hue === "neutral" ? tk.dim : h.fg; e.currentTarget.style.borderColor = hue === "neutral" ? tk.line : h.line; } else e.currentTarget.style.filter = "none"; }}
    >{children}</button>
  );
};

export const Tag = ({ children, hue = "neutral", solid, style, title }) => {
  const h = H(hue);
  return (
    <span className="mono" title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "2.5px 8px",
      fontSize: "var(--fs-micro)", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase",
      borderRadius: "var(--r-1)", whiteSpace: "nowrap",
      color: solid ? tk.inverse : h.fg, background: solid ? h.fg : h.bg,
      border: `1px solid ${solid ? h.fg : h.line}`, ...style,
    }}>{children}</span>
  );
};

export const Tabs = ({ items, value, onChange, style }) => (
  <div role="tablist" className="no-scrollbar" style={{ display: "flex", gap: 2, borderBottom: `1px solid ${tk.line}`, overflowX: "auto", ...style }}>
    {items.map((t) => {
      const on = t.id === value;
      return (
        <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
          className={on ? "tabline" : ""}
          style={{
            padding: "9px 14px", fontSize: "var(--fs-sm)", fontWeight: on ? 650 : 500,
            color: on ? tk.text : tk.faint, whiteSpace: "nowrap",
            transition: "color var(--dur-1) var(--ease-out)",
          }}
          onMouseOver={(e) => { if (!on) e.currentTarget.style.color = tk.dim; }}
          onMouseOut={(e) => { if (!on) e.currentTarget.style.color = tk.faint; }}>
          {t.label}
          {t.count != null && <span className="mono" style={{ marginLeft: 6, fontSize: "var(--fs-micro)", color: tk.faint }}>{t.count}</span>}
        </button>
      );
    })}
  </div>
);

/* ── data display ─────────────────────────────────────────────────── */
export function useCountUp(target, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = target;
    if (a === b) return undefined;
    let raf = 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const Stat = ({ label, value, sub, hue = "neutral", i = 0, animate = true, onClick }) => {
  const n = typeof value === "number" ? value : null;
  const shown = useCountUp(n ?? 0);
  const h = H(hue);
  return (
    <Panel hue={hue} i={i} className="anim-rise" onClick={onClick} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
      <div className="label" style={{ color: tk.faint }}>{label}</div>
      <div className="mono flash-in" key={String(value)} style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: hue === "neutral" ? tk.text : h.fg, lineHeight: 1.2, marginTop: 2 }}>
        {n != null && animate ? shown : value}
      </div>
      {sub && <div className="mono" style={{ fontSize: "var(--fs-micro)", color: tk.faint, marginTop: 2 }}>{sub}</div>}
    </Panel>
  );
};

export const Bar = ({ value, max = 1, hue = "accent", height = 4, showPct }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const h = H(hue);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1, minWidth: 60 }}>
      <div style={{ flex: 1, height, background: tk.bg3, borderRadius: "var(--r-full)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: h.fg, borderRadius: "var(--r-full)", transition: "width var(--dur-4) var(--ease-out)" }} />
      </div>
      {showPct && <span className="mono" style={{ fontSize: "var(--fs-micro)", color: tk.faint, minWidth: 30, textAlign: "right" }}>{Math.round(pct)}%</span>}
    </div>
  );
};

export const Ring = ({ value, max = 1, size = 44, stroke = 3, hue = "accent", children }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tk.bg3} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={H(hue).fg} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset var(--dur-4) var(--ease-out)" }} />
      </svg>
      <div className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "var(--fs-micro)", fontWeight: 700, color: tk.text }}>{children}</div>
    </div>
  );
};

/* ── disclosure ───────────────────────────────────────────────────── */
export const Reveal = ({ open, children }) => (
  <div className={`reveal${open ? " open" : ""}`}><div className="reveal-inner">{children}</div></div>
);

export const Accordion = ({ q, children, hue = "neutral", right, defaultOpen = false, i = 0 }) => {
  const [open, setOpen] = useState(defaultOpen);
  const h = H(hue);
  return (
    <div className="anim-riseSm" style={{ "--i": i, border: `1px solid ${open ? h.line : tk.line}`, borderRadius: "var(--r-2)", marginBottom: "var(--sp-2)", background: open ? tk.bg1 : "transparent", transition: "border-color var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out)" }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ width: "100%", display: "flex", gap: "var(--sp-3)", alignItems: "flex-start", padding: "11px 14px", textAlign: "left" }}>
        <span className="mono" style={{ color: open ? h.fg : tk.faint, fontSize: "var(--fs-sm)", lineHeight: 1.5, transform: open ? "rotate(90deg)" : "none", transition: "transform var(--dur-2) var(--ease-out)", display: "inline-block" }}>▸</span>
        <span style={{ flex: 1, color: open ? tk.text : tk.dim, fontSize: "var(--fs-base)", fontWeight: open ? 600 : 450, lineHeight: 1.5, transition: "color var(--dur-1)" }}>{q}</span>
        {right}
      </button>
      <Reveal open={open}><div style={{ padding: "0 14px 14px 37px" }}>{children}</div></Reveal>
    </div>
  );
};

/* ── code ─────────────────────────────────────────────────────────── */
export const Code = ({ children, label, hue = "neutral", style, lang = "cpp" }) => {
  const [copied, setCopied] = useState(false);
  const syn = useSyntaxTheme();
  const text = String(children ?? "");
  return (
    <div style={{ border: `1px solid ${tk.codeLine}`, borderRadius: "var(--r-2)", overflow: "hidden", background: tk.codeBg, margin: "var(--sp-3) 0", ...style }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 11px", borderBottom: `1px solid ${tk.codeLine}`, background: tk.bg1 }}>
          <Label hue={hue}>{label}</Label>
          <button className="press" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
            style={{ fontSize: "var(--fs-micro)", fontFamily: "monospace", color: copied ? tk.ok : tk.faint, letterSpacing: ".08em" }}>
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      )}
      <SyntaxHighlighter language={lang} style={syn} PreTag="div"
        customStyle={{ margin: 0, padding: "var(--sp-3) var(--sp-4)", background: "transparent", fontSize: 13, lineHeight: 1.65 }}
        codeTagProps={{ style: { fontFamily: "'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace" } }}>
        {text}
      </SyntaxHighlighter>
    </div>
  );
};

/* ── callout ──────────────────────────────────────────────────────── */
export const Note = ({ children, hue = "accent", title, style }) => {
  const h = H(hue);
  return (
    <div style={{ border: `1px solid ${tk.line}`, borderLeft: `2px solid ${h.fg}`, borderRadius: "var(--r-2)", background: tk.bg1, padding: "var(--sp-3) var(--sp-4)", margin: "var(--sp-3) 0", ...style }}>
      {title && <div className="label" style={{ color: h.fg, marginBottom: 5 }}>{title}</div>}
      <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
};

/* ── empty state ──────────────────────────────────────────────────── */
export const Empty = ({ icon = "◌", title, children, action }) => (
  <div className="anim-fade" style={{ textAlign: "center", padding: "var(--sp-8) var(--sp-4)", color: tk.faint }}>
    <div style={{ fontSize: 34, opacity: .45, marginBottom: "var(--sp-3)" }}>{icon}</div>
    {title && <div style={{ color: tk.dim, fontSize: "var(--fs-md)", fontWeight: 600, marginBottom: 6 }}>{title}</div>}
    <div style={{ fontSize: "var(--fs-sm)", maxWidth: 420, margin: "0 auto", lineHeight: 1.65 }}>{children}</div>
    {action && <div style={{ marginTop: "var(--sp-4)" }}>{action}</div>}
  </div>
);

/* ── external link ────────────────────────────────────────────────── */
export const ExtLink = ({ href, children, hue = "neutral", note }) => {
  const h = H(hue);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={note} className="press"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: "var(--fs-xs)", fontWeight: 600,
        borderRadius: "var(--r-2)", color: h.fg, background: h.bg, border: `1px solid ${h.line}`, textDecoration: "none", whiteSpace: "nowrap" }}
      onMouseOver={(e) => { e.currentTarget.style.background = h.bg2; }}
      onMouseOut={(e) => { e.currentTarget.style.background = h.bg; }}>
      {children}<span style={{ opacity: .55, fontSize: "var(--fs-micro)" }}>↗</span>
    </a>
  );
};

/* ── timer ────────────────────────────────────────────────────────── */
export const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function useTimer(totalSeconds, { autostart = false } = {}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(autostart);
  /* The budget follows its prop. Adjusting during render (rather than in an
     effect) means the first paint after a mode change already shows the new
     budget, with no intermediate frame at the old one. */
  const [total, setTotal] = useState(totalSeconds);
  const [seenTotal, setSeenTotal] = useState(totalSeconds);
  if (totalSeconds !== seenTotal) { setSeenTotal(totalSeconds); setTotal(totalSeconds); }
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return {
    elapsed, total, running,
    left: Math.max(0, total - elapsed),
    frac: total > 0 ? Math.min(1, elapsed / total) : 0,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    toggle: () => setRunning((r) => !r),
    reset: () => { setRunning(false); setElapsed(0); },
  };
}

export const TimerChip = ({ timer, hue = "accent" }) => {
  const over = timer.left === 0;
  const low = timer.frac > 0.8 && !over;
  const h = H(over ? "bad" : low ? "warn" : hue);
  return (
    <div className={over ? "blink" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "5px 12px", borderRadius: "var(--r-full)", background: h.bg, border: `1px solid ${h.line}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: h.fg, opacity: timer.running ? 1 : .35, transition: "opacity var(--dur-2)" }} className={timer.running ? "pulse" : ""} />
      <span className="mono" style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: h.fg, letterSpacing: ".04em" }}>{mmss(timer.left)}</span>
    </div>
  );
};

export { tk, alpha };
