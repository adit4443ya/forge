"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const ref = useRef(null);

  /* Shown to anyone who has never actively chosen, including existing users:
     the default role was assigned, not picked, and it now decides what four
     surfaces show. Suppressing it for anyone with progress meant the people
     most affected by the default were the ones never asked. */
  const hidden = !!prog.prefs?.rolePicked || dismissed;

  const close = useCallback(() => {
    progressStore.setPref("rolePicked", true);
    setDismissed(true);
  }, []);

  const pick = (id) => { progressStore.setRole(id); close(); };

  /* Without this a keyboard user tabs through the page BEHIND the modal and
     never reaches a role card — 67 presses and no way out. Escape closes,
     Tab cycles inside, and focus lands on the first card on open. */
  useEffect(() => {
    if (hidden) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const focusable = () => [...el.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((n) => !n.disabled && n.offsetParent !== null);
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [hidden, close]);

  if (hidden) return null;

  return (
    <div className="rp-scrim anim-fade" role="presentation">
      <div className="rp anim-rise" ref={ref} role="dialog" aria-modal="true" aria-labelledby="rp-title">
        <div className="rp-head">
          <h2 id="rp-title">Which role are you preparing for?</h2>
          <p>
            It decides which problems come first, which drills open, which labs you see and how the
            Learn surface is organised. Change it any time from the switch in the top bar, or press
            Escape to look around first.
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

        <button className="press rp-skip" onClick={close}>
          Not sure yet — show me everything
        </button>
      </div>
    </div>
  );
}
