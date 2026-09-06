"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTargetChange } from "@/ui/hooks.js";
import { tk, hue as H } from "@/theme/carbon.jsx";
import { Section, Panel, Button, Tag, Label, Mono, H1, H2, Muted, Tabs, Accordion, Note, Empty, Bar, ExtLink } from "@/ui/kit.jsx";
import { useNav } from "@/shell/nav.js";
import CoverageMap from "./CoverageMap.jsx";
import { useProgress } from "@/lib/progress/store.js";
import { ROLE_BY_ID, LEVELS, LEVEL_META } from "@/data/roles.js";
import { dueCards, stats as reviewStats, preview, rate, removeCard, allCards, describeInterval, RATINGS } from "@/lib/review.js";
import LABS from "@/data/labs.json";
import { content as LEGACY, GROUPS as LEGACY_GROUPS, NavCtx as LegacyNavCtx } from "@/legacyLibrary.jsx";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN — three ways in, one library.
     Competencies  what the role asks for, and every asset that builds it
     Guides        the long-form reading
     Review        the spaced-repetition queue
   ══════════════════════════════════════════════════════════════════════════ */

import { GUIDES, guideByNum } from "@/data/generated/guides.js";

/* ── the reader ───────────────────────────────────────────────────── */


/* ── competencies ─────────────────────────────────────────────────── */
function CompetencyTab({ role, focusId }) {
  const nav = useNav();
  const prog = useProgress();
  const [open, setOpen] = useState(focusId || null);
  const [seenFocus, setSeenFocus] = useState(focusId || null);
  if (focusId && focusId !== seenFocus) { setSeenFocus(focusId); setOpen(focusId); }

  return (
    <div className="pane-pad pane-narrow">
      <div className="anim-rise">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ color: H(role.hue).fg, fontSize: "var(--fs-xl)" }}>{role.icon}</span>
          <H1>{role.name}</H1>
        </div>
        <Muted style={{ maxWidth: "70ch" }}>{role.reality}</Muted>
      </div>

      <CoverageMap role={role} />

      <Section title="What the day actually looks like" i={1} hue={role.hue} style={{ marginTop: "var(--sp-6)" }}>
        <div style={{ display: "grid", gap: 0 }}>
          {role.day.map((d, i) => (
            <div key={i} className="anim-slide" style={{ "--i": i, display: "flex", gap: 12, alignItems: "baseline", padding: "9px 0", borderTop: i ? `1px solid ${tk.line}` : "none" }}>
              <Mono dim style={{ minWidth: 18 }}>{String(i + 1).padStart(2, "0")}</Mono>
              <span style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.65 }}>{d}</span>
            </div>
          ))}
        </div>
      </Section>

      {LEVELS.map((lvl, li) => {
        const comps = role.competencies.filter((c) => c.level === lvl);
        if (!comps.length) return null;
        return (
          <Section key={lvl} i={2 + li} title={LEVEL_META[lvl].label} hue={lvl === "foundation" ? "ok" : lvl === "working" ? "accent" : "bad"}
            right={<Mono dim>{LEVEL_META[lvl].note}</Mono>}>
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              {comps.map((c, i) => {
                const on = open === c.id;
                const labs = LABS.labs.filter((l) => (c.labs || []).some((p) => l.id === p || l.id.startsWith(p)));
                const done = labs.filter((l) => prog.labs[l.id]).length;
                return (
                  <Panel key={c.id} i={i} hue={on ? role.hue : "neutral"} active={on} onClick={() => setOpen(on ? null : c.id)} style={{ padding: "var(--sp-4)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ color: tk.text, fontWeight: 650, fontSize: "var(--fs-md)" }}>{c.name}</span>
                      <div style={{ flex: 1 }} />
                      {labs.length > 0 && <Mono dim>{done}/{labs.length} labs</Mono>}
                      {labs.length > 0 && <div style={{ width: 60 }}><Bar value={done} max={labs.length} hue={done === labs.length ? "ok" : role.hue} /></div>}
                    </div>
                    <div style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.7, marginTop: 6 }}>{c.doing}</div>
                    <div className={`reveal${on ? " open" : ""}`}><div className="reveal-inner">
                      <div style={{ paddingTop: "var(--sp-4)" }}>
                        <Note hue={role.hue} title="how it is tested">{c.signal}</Note>
                        <div style={{ display: "grid", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
                          {c.guides?.length > 0 && (
                            <div>
                              <Label style={{ display: "block", marginBottom: 6 }}>Read</Label>
                              <div className="row">{c.guides.map((n) => {
                                const g = guideByNum(n);
                                return g ? <Button key={n} size="sm" hue="info" onClick={(e) => { e.stopPropagation(); nav.openGuide(n); }}>{n} · {g.title.split(":")[0]}</Button> : null;
                              })}</div>
                            </div>
                          )}
                          {labs.length > 0 && (
                            <div>
                              <Label style={{ display: "block", marginBottom: 6 }}>Prove it</Label>
                              <div className="row">{labs.map((l) => (
                                <Button key={l.id} size="sm" hue={prog.labs[l.id] ? "ok" : "neutral"} onClick={(e) => { e.stopPropagation(); nav.openLab(l.id); }}>
                                  {prog.labs[l.id] ? "✓ " : ""}{l.id}
                                </Button>
                              ))}</div>
                            </div>
                          )}
                          {c.sections?.length > 0 && (
                            <div>
                              <Label style={{ display: "block", marginBottom: 6 }}>Drill</Label>
                              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                                {c.sections.map((s) => (
                                  <button key={s} className="press sec-chip"
                                    onClick={(e) => { e.stopPropagation(); nav.go("practice", { kind: "section", id: s }); }}>
                                    {s} <span style={{ opacity: .6 }}>→</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div></div>
                  </Panel>
                );
              })}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

/* ── review ───────────────────────────────────────────────────────── */
function ReviewTab() {
  const prog = useProgress();
  const nav = useNav();
  const [shown, setShown] = useState(false);
  const [skipped, setSkipped] = useState([]);
  void prog;
  const now = new Date();
  const due = dueCards(now).filter((e) => !skipped.includes(e.id));
  const cur = due[0];
  const st = reviewStats(now);
  const iv = cur ? preview(cur, now) : null;

  return (
    <div className="pane-pad pane-narrow">
      <H1>Review</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)" }}>
        Ten minutes at the start of every coding session. Answer out loud before revealing, then rate what actually happened.
        The scheduler pushes what you know out to weeks and brings what you missed back tomorrow.
      </Muted>
      <div className="grid-auto" style={{ marginBottom: "var(--sp-6)" }}>
        {[["due now", st.due, st.due ? "warn" : "neutral"], ["cards", st.total, "accent"], ["in review state", st.byState.review, "ok"], ["learning", st.byState.learning + st.byState.relearning, "info"]].map(([l, v, h], i) => (
          <Panel key={l} i={i} hue={h} style={{ padding: "var(--sp-3)" }}>
            <Label hue={h}>{l}</Label>
            <div className="mono" style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: tk.text }}>{v}</div>
          </Panel>
        ))}
      </div>

      {!cur ? (
        <Empty icon="✓" title={st.total === 0 ? "No cards yet" : "All caught up"}>
          {st.total === 0
            ? "Open any answer in a guide or module and press “review queue”. Every DSA attempt you log also schedules its problem automatically."
            : "Nothing is due. Come back when the scheduler says so, or add more cards."}
        </Empty>
      ) : (
        <Panel hue="accent" active style={{ padding: "var(--sp-5)" }}>
          <div className="row" style={{ marginBottom: "var(--sp-3)" }}>
            <Tag hue="accent">{cur.kind}</Tag>
            {cur.module && <Mono dim>{cur.module}</Mono>}
            <div style={{ flex: 1 }} />
            <Mono dim>{(cur.history || []).length} reviews · stability {Number(cur.card.stability || 0).toFixed(1)}d</Mono>
          </div>
          <div style={{ color: tk.text, fontSize: "var(--fs-xl)", fontWeight: 650, lineHeight: 1.45, marginBottom: "var(--sp-4)" }}>{cur.question || cur.title}</div>
          {cur.kind === "dsa" && <Note hue="warn">Solve it again now, under the clock, before you rate it.</Note>}
          {cur.kind === "q" && !shown && <Button hue="accent" onClick={() => setShown(true)}>Reveal answer</Button>}
          {cur.kind === "q" && shown && (
            <div className="anim-riseSm" style={{ color: tk.dim, fontSize: "var(--fs-sm)", lineHeight: 1.8, whiteSpace: "pre-wrap",
              background: tk.bg, border: `1px solid ${tk.line}`, borderRadius: "var(--r-2)", padding: "var(--sp-4)" }}>
              {cur.answer || "(no answer stored on this card)"}
            </div>
          )}
          <div className="row" style={{ marginTop: "var(--sp-4)" }}>
            {RATINGS.map((r) => (
              <Button key={r.key} hue={r.key === "again" ? "bad" : r.key === "hard" ? "warn" : r.key === "good" ? "ok" : "info"}
                title={r.hint} onClick={() => { rate(cur.id, r.key, new Date()); setShown(false); }}>
                {r.label} <Mono dim style={{ marginLeft: 4 }}>{iv[r.key]}</Mono>
              </Button>
            ))}
            <div style={{ flex: 1 }} />
            {cur.kind === "dsa" && <Button size="sm" onClick={() => nav.openProblem(Number(cur.ref))}>open problem</Button>}
            <Button size="sm" onClick={() => { setSkipped([...skipped, cur.id]); setShown(false); }}>skip</Button>
          </div>
          <Mono dim style={{ display: "block", marginTop: "var(--sp-3)" }}>{due.length} due in this queue</Mono>
        </Panel>
      )}

      {st.total > 0 && (
        <Section title="All cards" i={1} style={{ marginTop: "var(--sp-7)" }}>
          {Object.values(allCards()).sort((a, b) => new Date(a.card.due) - new Date(b.card.due)).slice(0, 60).map((e, i) => (
            <div key={e.id} className="anim-slide" style={{ "--i": Math.min(i, 12), display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: i ? `1px solid ${tk.line}` : "none", fontSize: "var(--fs-sm)" }}>
              <Tag hue={e.kind === "dsa" ? "warn" : "accent"}>{e.kind}</Tag>
              <span className="truncate" style={{ flex: 1, color: tk.dim }}>{e.question || e.title}</span>
              <Mono dim>{new Date(e.card.due) <= now ? "due" : describeInterval(now, new Date(e.card.due))}</Mono>
              <button className="press" onClick={() => removeCard(e.id)} style={{ fontSize: "var(--fs-micro)", color: tk.faint, textDecoration: "underline" }}>remove</button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

/* ── guide library ────────────────────────────────────────────────── */
function GuidesTab({ onOpen }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = GUIDES.filter((g) => !needle || g.title.toLowerCase().includes(needle) || (g.tags || "").toLowerCase().includes(needle) || g.headings.some((h) => h.text.toLowerCase().includes(needle)));
    const by = {};
    list.forEach((g) => { const k = g.category || "Other"; (by[k] = by[k] || []).push(g); });
    return by;
  }, [q]);

  return (
    <div className="pane-pad pane-narrow">
      <H1>Library</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-4)" }}>
        {GUIDES.length} long-form guides. Read one section at a time and stop to explain it out loud; that is what turns reading into recall.
      </Muted>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, tags and section headings…"
        style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--r-2)", border: `1px solid ${tk.line}`, background: tk.bg1, color: tk.text, fontSize: "var(--fs-sm)", marginBottom: "var(--sp-5)" }} />
      {Object.entries(groups).map(([cat, list], gi) => (
        <Section key={cat} title={cat} i={gi}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            {list.map((g, i) => (
              <Panel key={g.num} i={i} onClick={() => onOpen(g.num)} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <Mono style={{ color: tk.accent, fontWeight: 700 }}>{g.num}</Mono>
                  <span style={{ color: tk.text, fontWeight: 600, fontSize: "var(--fs-sm)", flex: 1, minWidth: 0 }}>{g.title}</span>
                  {g.readTime && <Mono dim>{g.readTime}</Mono>}
                  <Mono dim>{g.headings.length} sections</Mono>
                </div>
              </Panel>
            ))}
          </div>
        </Section>
      ))}
      {Object.keys(groups).length === 0 && <Empty icon="⌕" title="Nothing matches">Try a shorter search.</Empty>}
    </div>
  );
}

/* ── legacy Q&A modules, re-presented through the role lens ───────── */
const MODULE_LABEL = {};
LEGACY_GROUPS.forEach((g) => g.items.forEach((it) => { MODULE_LABEL[it.id] = it.label; }));

function ModulesTab({ role, focusModule }) {
  const nav = useNav();
  const [openId, setOpenId] = useState(focusModule || null);
  const [showAll, setShowAll] = useState(false);
  const [seenFocus, setSeenFocus] = useState(focusModule || null);
  if (focusModule && focusModule !== seenFocus) { setSeenFocus(focusModule); setOpenId(focusModule); }

  /* App.jsx's legacy screens reach navigation through their own context. */
  const legacyNav = useMemo(() => ({
    goToGuide: (num, anchor) => nav.openGuide(num, anchor),
    goToModule: (id) => setOpenId(id),
    goToDsa: (tab, id) => (id != null ? nav.openProblem(id) : nav.go("practice")),
    setMode: () => {},
  }), [nav]);

  const forRole = role.competencies.flatMap((c) => (c.modules || []).map((m) => ({ m, c })));
  const roleIds = new Set(forRole.map((x) => x.m));
  const rest = Object.keys(LEGACY).filter((id) => !roleIds.has(id) && MODULE_LABEL[id] && !["assess", "review", "mocks"].includes(id));

  if (openId && LEGACY[openId]) {
    const Body = LEGACY[openId];
    return (
      <div className="pane-pad pane-narrow">
        <div className="row anim-rise" style={{ marginBottom: "var(--sp-4)" }}>
          <Button size="sm" onClick={() => setOpenId(null)}>← Modules</Button>
          <Mono>{MODULE_LABEL[openId] || openId}</Mono>
        </div>
        <div className="anim-fade">
          <LegacyNavCtx.Provider value={legacyNav}><Body /></LegacyNavCtx.Provider>
        </div>
      </div>
    );
  }

  return (
    <div className="pane-pad pane-narrow">
      <H1>Rapid recall</H1>
      <Muted style={{ marginTop: 8, marginBottom: "var(--sp-5)", maxWidth: "70ch" }}>
        Short question-and-answer blocks for the things you must be able to say out loud without preparation. Grouped by the
        competency they serve for <span style={{ color: H(role.hue).fg }}>{role.name}</span>, not by topic. Any answer can go into the
        review queue with one click.
      </Muted>

      {role.competencies.filter((c) => (c.modules || []).length).map((c, ci) => (
        <Section key={c.id} i={ci} title={c.name} hue={role.hue} right={<Mono dim>{c.level}</Mono>}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            {(c.modules || []).filter((m) => LEGACY[m]).map((m, i) => (
              <Panel key={m} i={i} onClick={() => setOpenId(m)} style={{ padding: "var(--sp-3) var(--sp-4)" }}>
                <div className="row" style={{ gap: 10 }}>
                  <span style={{ color: tk.text, fontSize: "var(--fs-sm)", fontWeight: 600, flex: 1 }}>{MODULE_LABEL[m] || m}</span>
                  <Mono dim>{m}</Mono>
                  <span style={{ color: tk.faint }}>→</span>
                </div>
              </Panel>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Other topics" i={9} right={<Button size="sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "hide" : `show ${rest.length}`}</Button>}>
        <Muted style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--sp-3)" }}>
          Not on the critical path for this role. Useful if you are switching tracks or the team you are talking to owns this area.
        </Muted>
        {showAll && (
          <div style={{ display: "grid", gap: 2 }}>
            {rest.map((m, i) => (
              <button key={m} onClick={() => setOpenId(m)} className="anim-slide"
                style={{ "--i": Math.min(i, 12), display: "flex", gap: 10, alignItems: "baseline", width: "100%", textAlign: "left",
                  padding: "8px 4px", borderTop: i ? `1px solid ${tk.line}` : "none" }}>
                <span style={{ color: tk.dim, fontSize: "var(--fs-sm)", flex: 1 }}>{MODULE_LABEL[m]}</span>
                <Mono dim>{m}</Mono>
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export default function Learn({ role, target }) {
  const nav = useNav();
  const router = useRouter();
  const [tab, setTab] = useState(() => (target?.kind === "tab" ? target.id : "competencies"));
  /* Same as Practice: the tab is navigation and belongs in the URL. */
  const goTab = useCallback((id) => {
    setTab(id);
    router.push(id === "competencies" ? "/learn" : `/learn?tab=${id}`, { scroll: false });
  }, [router]);
  const [focusComp, setFocusComp] = useState(null);
  const [focusModule, setFocusModule] = useState(null);

  useTargetChange(target, (t) => {
    if (t.kind === "tab") setTab(t.id);
    // Guides moved to their own route; keep older links and bookmarks working.
    if (t.kind === "guide") nav.openGuide(t.num, t.anchor);
    if (t.kind === "review") setTab("review");
    if (t.kind === "competency") { setTab("competencies"); setFocusComp(t.id); }
    if (t.kind === "module") { setTab("modules"); setFocusModule(t.id); }
  });

  const rs = reviewStats();
  const tabs = [
    { id: "competencies", label: "Competencies", count: role.competencies.length },
    { id: "modules", label: "Rapid recall", count: Object.keys(LEGACY).length - 3 },
    { id: "guides", label: "Guides", count: GUIDES.length },
    { id: "review", label: "Review", count: rs.due || undefined },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "0 var(--sp-5)", background: tk.bg, borderBottom: `1px solid ${tk.line}` }}>
        <Tabs items={tabs} value={tab} onChange={goTab} style={{ border: "none" }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {tab === "competencies" && <CompetencyTab role={role} focusId={focusComp} />}
        {tab === "modules" && <ModulesTab role={role} focusModule={focusModule} />}
        {tab === "guides" && <GuidesTab onOpen={(n) => nav.openGuide(n)} />}
        {tab === "review" && <ReviewTab />}
      </div>
    </div>
  );
}

