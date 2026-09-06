"use client";
import { useMemo } from "react";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Label, Mono, Muted } from "@/ui/kit.jsx";
import { useNav } from "@/shell/nav.js";
import { useProgress, isSolved } from "@/lib/progress/store.js";
import { LEVELS, LEVEL_META } from "@/data/roles.js";
import { LAB_INDEX } from "@/data/generated/labs.js";
import { ALL_PROBLEMS as PROBLEMS } from "@/dsaData.jsx";
import { RAPID } from "@/data/rapidfire.js";

/* ══════════════════════════════════════════════════════════════════════════
   COVERAGE MAP — where you are hollow.

   A progress bar tells you how much you have done. It does not tell you that
   you have read every concurrency guide and never run a single concurrency
   lab, which is the failure mode this exists to make visible. So coverage is
   split by KIND of evidence — read it, prove it, solve it, recall it — and a
   competency is only strong when all four are.
   ══════════════════════════════════════════════════════════════════════════ */

/* Rapid-fire domains that speak to the same thing a competency does. */
const DOMAIN_HINTS = {
  "c-ir": ["compiler"], "c-debug": ["compiler"], "c-backend": ["compiler", "arch"],
  "c-vec": ["compiler", "arch"], "c-arch": ["arch"], "c-scale": ["compiler", "sys"],
  "s-measure": ["sys", "arch"], "s-profile": ["sys", "arch"], "s-memory": ["arch"],
  "s-uarch": ["arch"], "s-kernel": ["sys"], "s-prove": ["sys", "compiler"],
  "h-cpp": ["cpp"], "h-latency": ["sys", "hft"], "h-conc": ["cpp", "arch"],
  "h-data": ["arch", "hft"], "h-net": ["sys", "hft"], "h-box": ["sys"],
  "h-prob": ["prob"], "h-micro": ["hft"], "h-num": ["arch", "compiler"],
};

const KINDS = [
  { id: "read",   label: "read",   hue: "info", note: "guides marked read" },
  { id: "prove",  label: "prove",  hue: "ok",   note: "labs run, with an evidence note" },
  { id: "solve",  label: "solve",  hue: "warn", note: "problems solved in its sections" },
  { id: "recall", label: "recall", hue: "accent", note: "rapid-fire questions nailed" },
];

function coverage(c, prog) {
  /* read — guides marked read */
  const guides = c.guides || [];
  const read = guides.filter((n) => prog.bookmarks?.[`read:guide:${n}`]).length;

  /* prove — labs done; an evidence note is what makes it count fully */
  const labs = LAB_INDEX.filter((l) => (c.labs || []).some((p) => l.id === p || l.id.startsWith(p)));
  const proved = labs.filter((l) => prog.labs?.[l.id]).length;
  const noted = labs.filter((l) => prog.evidence?.[l.id]?.claim).length;

  /* solve — problems in the sections this competency names */
  const probs = PROBLEMS.filter((p) => (c.sections || []).includes(p.section));
  const solved = probs.filter((p) => isSolved(prog.dsa?.[p.id])).length;

  /* recall — rapid-fire in the mapped domains, plus the Q&A modules */
  const domains = DOMAIN_HINTS[c.id] || [];
  const rapid = RAPID.filter((r) => domains.includes(r.domain));
  const nailed = rapid.filter((r) => prog.notes?.[`rapid:${r.id}`]?.text === "got").length;

  const frac = (a, b) => (b ? a / b : null);          // null = nothing to do here
  return {
    read:   { have: read,   total: guides.length, pct: frac(read, guides.length) },
    prove:  { have: noted,  total: labs.length,   pct: frac(noted, labs.length), partial: proved },
    solve:  { have: solved, total: probs.length,  pct: frac(solved, probs.length) },
    recall: { have: nailed, total: rapid.length,  pct: frac(nailed, rapid.length) },
  };
}

const score = (cov) => {
  const vals = KINDS.map((k) => cov[k.id].pct).filter((v) => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
};

function Meter({ cell, hue }) {
  if (cell.total === 0) return <div className="cm-cell cm-cell-na" title="nothing mapped here yet">—</div>;
  const pct = Math.round((cell.pct || 0) * 100);
  return (
    <div className="cm-cell" title={`${cell.have} of ${cell.total}`}>
      <div className="cm-meter">
        <span style={{ width: `${pct}%`, background: H(hue).fg }} />
      </div>
      <Mono dim>{cell.have}/{cell.total}</Mono>
    </div>
  );
}

export default function CoverageMap({ role }) {
  const prog = useProgress();
  const nav = useNav();

  const rows = useMemo(
    () => role.competencies.map((c) => {
      const cov = coverage(c, prog);
      return { c, cov, s: score(cov) };
    }),
    [role, prog]
  );

  /* The recommendation: the weakest competency at the lowest level that has
     anything left to do. Foundation before working before expert, always. */
  const next = useMemo(() => {
    for (const lvl of LEVELS) {
      const here = rows.filter((r) => r.c.level === lvl && r.s < 0.999);
      if (here.length) return here.reduce((a, b) => (a.s <= b.s ? a : b));
    }
    return null;
  }, [rows]);

  const weakestKind = next
    ? KINDS.filter((k) => next.cov[k.id].total > 0).reduce((a, b) => (next.cov[a.id].pct <= next.cov[b.id].pct ? a : b))
    : null;

  const overall = rows.length ? rows.reduce((a, r) => a + r.s, 0) / rows.length : 0;

  return (
    <div className="cm">
      <div className="cm-head">
        <div>
          <Label hue={role.hue}>coverage map</Label>
          <Muted style={{ marginTop: 6, maxWidth: "62ch", fontSize: "var(--fs-sm)" }}>
            A bar that says 40% hides which 40%. Each competency is scored separately on four kinds of
            evidence, because reading every guide and running no labs is not the same as knowing it.
          </Muted>
        </div>
        <div className="cm-overall">
          <svg viewBox="0 0 44 44" width="60" height="60" aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="none" stroke={tk.bg3} strokeWidth="4" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={H(role.hue).fg} strokeWidth="4"
              strokeLinecap="round" strokeDasharray={`${overall * 113} 113`} transform="rotate(-90 22 22)"
              style={{ transition: "stroke-dasharray var(--dur-4) var(--ease-out)" }} />
          </svg>
          <div>
            <div className="cm-overall-n">{Math.round(overall * 100)}%</div>
            <Mono dim>overall</Mono>
          </div>
        </div>
      </div>

      {next && (
        <button className="press cm-next" onClick={() => nav.openCompetency(next.c.id)}>
          <div>
            <Label hue="accent">start here</Label>
            <div className="cm-next-name">{next.c.name}</div>
            <div className="cm-next-why">
              {LEVEL_META[next.c.level].label.toLowerCase()} level
              {weakestKind && <> · weakest on <strong>{weakestKind.label}</strong> ({next.cov[weakestKind.id].have}/{next.cov[weakestKind.id].total} {weakestKind.note})</>}
            </div>
          </div>
          <span className="cm-next-go">→</span>
        </button>
      )}

      <div className="cm-legend">
        <span />
        {KINDS.map((k) => (
          <span key={k.id} className="cm-legend-item" title={k.note} style={{ color: H(k.hue).fg }}>{k.label}</span>
        ))}
      </div>

      {LEVELS.map((lvl) => {
        const here = rows.filter((r) => r.c.level === lvl);
        if (!here.length) return null;
        return (
          <div key={lvl} className="cm-group">
            <div className="cm-group-head">
              <Label hue={lvl === "foundation" ? "ok" : lvl === "working" ? "accent" : "bad"}>{LEVEL_META[lvl].label}</Label>
              <Mono dim>{LEVEL_META[lvl].note}</Mono>
            </div>
            {here.map(({ c, cov, s }) => (
              <button key={c.id} className="press cm-row" data-done={s > 0.999 ? "1" : undefined}
                onClick={() => nav.openCompetency(c.id)}>
                <span className="cm-row-name">
                  {c.name}
                  {s > 0.999 && <span className="cm-row-tick">✓</span>}
                </span>
                {KINDS.map((k) => <Meter key={k.id} cell={cov[k.id]} hue={k.hue} />)}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
