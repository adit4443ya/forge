"use client";
import { tk, alpha } from "@/theme.jsx";
import { useProgress } from "@/lib/progress/store.js";
import { addCard, removeCard, hasCard, cardId, hashText } from "@/lib/review.js";

/* "+ review queue" button shown inside an expanded Q&A item. The card stores the
   question and answer text so the Review module can show them without the module. */
export default function ReviewToggle({ q, a, module = "" }) {
  useProgress();                                   // re-render when the store changes
  const ref = hashText(q);
  const id = cardId("q", ref);
  const on = hasCard(id);
  const color = on ? tk.green : tk.textDim;
  return (
    <button onClick={(e) => { e.stopPropagation(); if (on) removeCard(id); else addCard({ kind: "q", ref, question: q, answer: typeof a === "string" ? a : "", module }); }}
      title={on ? "Remove from the spaced-repetition queue" : "Add to the spaced-repetition queue (Review module)"}
      style={{ marginTop: 14, marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", font: "inherit",
        background: alpha(color, "12"), border: `1px solid ${alpha(color, "40")}`, borderRadius: 6, color, padding: "7px 12px",
        fontSize: "var(--fs-sm)", fontFamily: tk.sans, fontWeight: 600 }}>
      <span style={{ fontFamily: tk.mono, fontSize: "var(--fs-caption)", opacity: .8 }}>{on ? "✓" : "+"}</span> {on ? "in review queue" : "review queue"}
    </button>
  );
}
