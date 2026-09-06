"use client";
import { useState } from "react";
import { hue as H } from "@/theme/carbon.jsx";
import { ROLES } from "@/data/roles.js";
import { useProgress, progressStore } from "@/lib/progress/store.js";

/* ══════════════════════════════════════════════════════════════════════════
   FIRST-RUN ROLE PICKER — asked once, because the answer changes everything.

   The role sorts the problem list, picks which rapid-fire and estimation decks
   open, filters the labs, and drives the whole Learn surface. Defaulting to
   "compiler" silently and hoping someone finds the switch in the top bar wastes
   that. So it is asked once, with enough of each role's reality to answer
   honestly, and never again — it stays changeable from the top bar.
   ══════════════════════════════════════════════════════════════════════════ */

export default function RolePicker() {
  const prog = useProgress();
  const [dismissed, setDismissed] = useState(false);

  /* Only for a genuinely new visitor: no role chosen, nothing done yet. */
  const chosen = !!prog.prefs?.rolePicked;
  const started = !!prog.startDate
    || Object.keys(prog.labs || {}).length > 0
    || Object.keys(prog.dsa || {}).length > 0;
  if (chosen || started || dismissed) return null;

  const pick = (id) => {
    progressStore.setRole(id);
    progressStore.setPref("rolePicked", true);
    setDismissed(true);
  };

  return (
    <div className="rp-scrim anim-fade">
      <div className="rp anim-rise">
        <div className="rp-head">
          <h2>Which role are you preparing for?</h2>
          <p>
            It decides which problems come first, which drills open, which labs you see and how the
            Learn surface is organised. You can change it any time from the top bar.
          </p>
        </div>

        <div className="rp-grid">
          {ROLES.map((r) => (
            <button key={r.id} className="press rp-card" onClick={() => pick(r.id)}>
              <div className="rp-card-head">
                <span style={{ color: H(r.hue).fg, fontSize: 20, lineHeight: 1 }}>{r.icon}</span>
                <div>
                  <div className="rp-name">{r.name}</div>
                  <div className="rp-tag">{r.tag}</div>
                </div>
              </div>
              <p className="rp-reality">{r.reality}</p>
              <ul className="rp-day">
                {r.day.slice(0, 3).map((d) => <li key={d}>{d}</li>)}
              </ul>
              <div className="rp-foot">{r.competencies.length} competencies →</div>
            </button>
          ))}
        </div>

        <button className="press rp-skip" onClick={() => { progressStore.setPref("rolePicked", true); setDismissed(true); }}>
          Not sure yet — show me everything
        </button>
      </div>
    </div>
  );
}
