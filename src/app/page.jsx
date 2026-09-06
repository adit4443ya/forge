import Link from "next/link";
import { STATS } from "@/data/generated/stats.js";
import { ROLES } from "@/data/roles.js";
import { CLOUD_ENABLED } from "@/lib/supabase/config";

export const metadata = {
  title: "Forge — practice that behaves like the interview",
  description:
    `${STATS.problems} problems behind timed hint gates, ${STATS.labs} labs you run on your own machine, ` +
    `and ${STATS.guides} long-form guides. For engineers targeting compiler, systems, HFT and quant roles.`,
};

const FEATURES = [
  {
    k: "01", t: "Hints arrive on a clock, not on demand",
    d: "Every problem hides its pattern, its approach and its solution behind gates that open on a timer you choose. Drill opens them early, Study opens everything, Mock opens nothing until the budget is spent. The pattern label is treated as a spoiler, because naming the pattern is most of the answer.",
  },
  {
    k: "02", t: "The pattern is hidden in the list too",
    d: "A bank that labels every problem \"DP — Knapsack\" has already told you what to do. Here the list shows tier and status; you meet the problem before you meet its category, which is the only way the practice resembles the interview.",
  },
  {
    k: "03", t: "Labs walk you through, step by step",
    d: `${STATS.labs} labs across ${STATS.tracks} tracks — perf counters, cache behaviour, codegen, concurrency, syscalls, AArch64 and SVE. Each opens as a guided session: what it teaches, the build line, then ${STATS.labSteps} steps with the command to copy and the output that step produced on the machine that wrote the lab, so you compare against a real number instead of guessing. It is finished when you can write what it showed on YOUR machine and what surprised you.`,
  },
  {
    k: "04", t: "Organised by what the job asks of you",
    d: "Not by company folklore. Four roles, each with the day it actually involves and its competencies sorted into foundation, working and expert. Problems, labs, guides and recall questions hang off those competencies.",
  },
  {
    k: "05", t: "Rapid fire, and estimation",
    d: `${STATS.rapid} mechanism questions across C++ internals, systems, architecture, compilers, probability and microstructure — one at a time, nothing else on screen: commit out loud, reveal, then see the follow-up where most people come apart. Plus ${STATS.estimates} estimation questions that make you write your chain of assumptions before showing you a worked one, ${STATS.cppConcepts} C++ concepts with the mechanism and the follow-ups, and ${STATS.patterns} patterns each linked to the problems that need it.`,
  },
  {
    k: "06", t: "Your progress is yours",
    d: CLOUD_ENABLED
      ? "Everything works signed out, saved in your browser. Sign in with Google and it follows you between devices, merged rather than overwritten, so a session on your laptop never erases one from your phone."
      : "Everything is saved in your browser and works with no account at all. Export a JSON backup at any time and import it anywhere.",
  },
];

const NUMBERS = [
  { n: STATS.problems, l: "problems, each tiered and timed" },
  { n: STATS.labs, l: `guided labs · ${STATS.labSteps} steps you actually run` },
  { n: STATS.guides, l: `long-form guides · ${Math.round(STATS.guideWords / 1000)}k words` },
  { n: STATS.rapid + STATS.questions + STATS.estimates, l: "recall, rapid-fire and estimation" },
  { n: STATS.patterns, l: "patterns, each linked to the problems that need it" },
];

export default function Landing() {
  return (
    <main className="lp">
      <header className="lp-nav">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span className="brand-name">Forge</span>
        </div>
        <nav className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#roles">Roles</a>
          <a href="#stack">Open source</a>
        </nav>
        <Link className="lp-cta-sm press" href="/today">Open the app →</Link>
      </header>

      <section className="lp-hero">
        <div className="lp-eyebrow">
          <span className="lp-dot" />
          compiler · systems · high-frequency trading · quant
        </div>
        <h1>
          Practice that behaves<br />like the interview.
        </h1>
        <p className="lp-lede">
          Most preparation sites hand you the pattern, the approach and the solution on one page and
          call it studying. You leave knowing you <em>could</em> have solved it. Forge makes you sit
          with the problem first — hints unlock on a clock, the pattern stays hidden, and what you
          reveal is recorded against the attempt.
        </p>
        <div className="lp-actions">
          <Link className="lp-cta press" href="/today">Start a session</Link>
          <Link className="lp-cta-ghost press" href="/practice">Browse {STATS.problems} problems</Link>
        </div>
        <div className="lp-note">
          Free and open. No account needed — progress saves in your browser.
          {CLOUD_ENABLED && " Sign in only if you want it on more than one device."}
        </div>
      </section>

      <section className="lp-numbers">
        {NUMBERS.map((x) => (
          <div key={x.l} className="lp-number">
            <div className="lp-number-n">{x.n}</div>
            <div className="lp-number-l">{x.l}</div>
          </div>
        ))}
      </section>

      <section id="how" className="lp-section">
        <h2 className="lp-h2">What makes it different</h2>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <article key={f.k} className="lp-feature">
              <div className="lp-feature-k">{f.k}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roles" className="lp-section">
        <h2 className="lp-h2">Four roles, in depth</h2>
        <p className="lp-sub">
          Pick one and every surface re-sorts around it: which problems matter, which labs to run,
          which guides to read, which questions you must answer without preparation.
        </p>
        <div className="lp-roles">
          {ROLES.map((r) => (
            <article key={r.id} className="lp-role" data-hue={r.hue}>
              <div className="lp-role-head">
                <span className="lp-role-icon">{r.icon}</span>
                <div>
                  <h3>{r.name}</h3>
                  <div className="lp-role-tag">{r.tag}</div>
                </div>
              </div>
              <p>{r.reality}</p>
              <ul>
                {r.day.slice(0, 3).map((d) => <li key={d}>{d}</li>)}
              </ul>
              <div className="lp-role-foot">{r.competencies.length} competencies</div>
            </article>
          ))}
        </div>
      </section>

      <section id="stack" className="lp-section lp-stack">
        <h2 className="lp-h2">Run it yourself</h2>
        <p className="lp-sub">
          Next.js and React, with Supabase for Google sign-in and Postgres when you want it — and
          fully functional without it. Clone, <code>npm install</code>, <code>npm run dev</code>.
        </p>
        <div className="lp-stack-grid">
          <div><span className="mono">Next.js · React</span><small>App Router, server-rendered guides</small></div>
          <div><span className="mono">Supabase</span><small>Google OAuth, Postgres, row-level security</small></div>
          <div><span className="mono">localStorage</span><small>works with no backend at all</small></div>
          <div><span className="mono">CRDT merge</span><small>devices join, never overwrite</small></div>
        </div>
      </section>

      <footer className="lp-foot">
        <div>
          <span className="brand-mark">F</span>
          <span>Forge</span>
        </div>
        <div className="lp-foot-links">
          <Link href="/today">Today</Link>
          <Link href="/practice">Practice</Link>
          <Link href="/learn">Learn</Link>
          <Link href="/labs">Labs</Link>
        </div>
        <div className="mono lp-foot-note">Content last built {STATS.generatedAt}</div>
      </footer>
    </main>
  );
}
