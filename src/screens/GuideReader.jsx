"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tk, hue as H, useSyntaxTheme } from "@/theme/carbon.jsx";
import { Mono, Label } from "@/ui/kit.jsx";
import { useProgress, progressStore } from "@/lib/progress/store.js";

/* The reader. It receives one fully-loaded guide from a server component, so
   the markdown for the other twenty-two never reaches the browser. */
const headingId = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* Never JSON.stringify a React node: react-markdown attaches an AST node whose
   DOM references are circular, which throws and blanks the screen. */
function textOf(node) {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && node.props) return textOf(node.props.children);
  return "";
}

export default function GuideReader({ guide, anchor = null }) {
  const prog = useProgress();
  const readKey = `read:guide:${guide.num}`;
  const isRead = !!prog.bookmarks?.[readKey];
  const syn = useSyntaxTheme();
  const ref = useRef(null);
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState("");

  /* The anchor arrives as the URL hash (palette heading links), or as a prop. */
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    const want = anchor || (typeof window !== "undefined" ? decodeURIComponent(window.location.hash.slice(1)) : "");
    if (!want) return undefined;
    const id = setTimeout(() => {
      ref.current?.querySelector(`[id="${CSS.escape(want)}"]`)?.scrollIntoView({ block: "start" });
    }, 80);
    return () => clearTimeout(id);
  }, [guide.num, anchor]);

  const onScroll = (e) => {
    const el = e.currentTarget, max = el.scrollHeight - el.clientHeight;
    setPct(max > 0 ? (el.scrollTop / max) * 100 : 0);
    const top = el.getBoundingClientRect().top;
    const hs = Array.from(el.querySelectorAll("h2[id],h3[id]"));
    let cur = "";
    for (let i = hs.length - 1; i >= 0; i--) if (hs[i].getBoundingClientRect().top - top <= 90) { cur = hs[i].id; break; }
    setActive(cur);
  };

  const md = useMemo(() => ({
    h2: ({ children }) => <h2 id={headingId(String(children))}>{children}</h2>,
    h3: ({ children }) => <h3 id={headingId(String(children))}>{children}</h3>,
    code({ inline, className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className || "")?.[1];
      if (inline || !lang) return <code className={className} {...props}>{children}</code>;
      return (
        <SyntaxHighlighter style={syn} language={lang} PreTag="div"
          customStyle={{ margin: 0, padding: "14px 16px", background: tk.codeBg, fontSize: 13, lineHeight: 1.65, borderRadius: "var(--r-2)" }}>
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    },
    blockquote({ children }) {
      /* Never JSON.stringify a React node: react-markdown attaches an AST node
         whose DOM references are circular, which throws and blanks the screen. */
      const txt = textOf(children);
      const kind = /\[!IMPORTANT\]/.test(txt) ? "accent" : /\[!WARNING\]|\[!CAUTION\]/.test(txt) ? "bad" : /\[!TIP\]/.test(txt) ? "ok" : /\[!NOTE\]/.test(txt) ? "info" : null;
      if (!kind) return <blockquote>{children}</blockquote>;
      return <div className="callout" style={{ borderLeftColor: H(kind).fg, background: H(kind).bg }}>{children}</div>;
    },
  }), [syn]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${tk.line}`, background: tk.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "10px var(--sp-5)" }}>
          <Link href="/learn?tab=guides" className="press btn-sm">← Library</Link>
          <Mono>Guide {guide.num}</Mono>
          <div style={{ flex: 1 }} />
          {guide.readTime && <Mono dim>{guide.readTime}</Mono>}
          <button className="press lab-done" data-done={isRead ? "1" : undefined}
            onClick={() => progressStore.toggleBookmark(readKey)}>
            {isRead ? "✓ read" : "mark read"}
          </button>
        </div>
        <div style={{ height: 2, background: tk.bg3 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: tk.accent, transition: "width .1s linear" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", flex: 1, minHeight: 0 }}>
        <div ref={ref} onScroll={onScroll} style={{ overflowY: "auto", padding: "var(--sp-6) var(--sp-6) var(--sp-8)" }}>
          <div className="prose anim-fade" style={{ margin: "0 auto" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{guide.body}</ReactMarkdown>
          </div>
        </div>
        <aside className="hide-sm" style={{ borderLeft: `1px solid ${tk.line}`, overflowY: "auto", padding: "var(--sp-4) var(--sp-3)" }}>
          <Label style={{ display: "block", marginBottom: "var(--sp-2)" }}>On this page</Label>
          {guide.headings.map((h, i) => {
            const id = headingId(h.text), on = id === active;
            return (
              <button key={i} onClick={() => ref.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="truncate press"
                style={{ display: "block", width: "100%", textAlign: "left", padding: "4px 8px", paddingLeft: h.level === 3 ? 20 : 8,
                  fontSize: "var(--fs-xs)", color: on ? tk.accent : tk.faint, borderLeft: `2px solid ${on ? tk.accent : "transparent"}`,
                  background: on ? tk.accentBg : "transparent", borderRadius: "0 var(--r-1) var(--r-1) 0" }}>
                {h.text}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
