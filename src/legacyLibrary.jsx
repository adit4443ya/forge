"use client";
import { useState, createContext, useContext } from "react";
import HftModule from "@/modules/hft.jsx";
import QuantProbModule from "@/modules/quant_prob.jsx";
import QuantMicroModule from "@/modules/quant_micro.jsx";
import MocksModule from "@/modules/mocks.jsx";
import ReviewToggle from "@/ReviewToggle.jsx";

// Cross-tab navigation: lets any component jump to a Library guide, a Prep
// module, or a DSA problem (used by deep-dive links and global search).
export const NavCtx = createContext(null);

/* ══════════════════════════════════════════════════════════════════════════
   LEGACY Q&A LIBRARY.

   This file is no longer a screen. The shell in src/shell/ owns navigation and
   src/screens/ owns every surface. What survives here is `content`: ~190 rapid
   recall Q&A blocks and the small components they are written with (S, Q, Card,
   G, B, P). Learn's "Rapid recall" tab renders them, grouped by the competency
   they serve rather than by topic, and the theme shim in src/theme.jsx re-points
   their inline colors at Carbon.

   New material should be written as a screen or a guide, not added here.
   ══════════════════════════════════════════════════════════════════════════ */

// Theme-aware tokens: every tk.* value is a CSS var switched by data-theme.
// alpha(c, hexAlpha) produces the translucent tints the old hex-suffix
// concatenation used to, which cannot work on var() strings.
import { tk, alpha } from "./theme.jsx";
export { tk, alpha };

/* ─── shared components ─── */
export const C=({code,title})=>(
  <div style={{margin:"16px 0", borderRadius: 8, overflow: "hidden", border: `1px solid ${tk.border}`, boxShadow: tk.shadowMd}}>
    {title&&<div style={{background:tk.codeTitleBg,borderBottom:`1px solid ${tk.border}`,padding:"8px 16px",fontSize:"var(--fs-xs)",color:tk.textDim,fontFamily:tk.mono,letterSpacing:.5, display:"flex", alignItems:"center"}}><span style={{marginRight:8,color:tk.accent}}>■</span>{title}</div>}
    <pre style={{background:tk.codeBg,padding:"16px 20px",fontSize:"var(--fs-code)",lineHeight:1.7,overflowX:"auto",color:tk.codeText,fontFamily:tk.mono,margin:0,whiteSpace:"pre"}}>{code}</pre>
  </div>
);

export const Card=({title, children, icon, color=tk.accent, highlighted=false}) => (
  <div style={{
    background: highlighted ? `${alpha(color,"0A")}` : tk.bg2,
    border: `1px solid ${highlighted ? alpha(color,"80") : tk.border}`,
    borderRadius: 8,
    padding: "16px 20px",
    margin: "12px 0",
    boxShadow: highlighted ? `0 4px 20px ${alpha(color,"15")}` : tk.shadowSm,
    transition: "all 0.2s ease"
  }}>
    {(title || icon) && <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
      {icon && <span style={{fontSize:"var(--fs-lg)", color}}>{icon}</span>}
      {title && <h4 style={{margin:0, color: highlighted ? color : tk.textBright, fontSize:"var(--fs-lg)", fontFamily:tk.sans, fontWeight:600}}>{title}</h4>}
    </div>}
    <div style={{color: tk.text, fontSize:"var(--fs-base)", lineHeight:1.75, fontFamily:tk.sans}}>
      {children}
    </div>
  </div>
);

const Diagram=({children, title, horizontal=false}) => (
  <figure style={{
    background: tk.diagramBg,
    backgroundImage: `radial-gradient(${tk.diagramDot} 1px, transparent 1px)`,
    backgroundSize: "18px 18px",
    border: `1px solid ${tk.border}`,
    borderRadius: 12,
    padding: "26px 24px",
    margin: "22px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 18,
    boxShadow: tk.shadowSm
  }}>
    {title && <figcaption style={{display:"flex", alignItems:"center", gap:8, color: tk.textDim, fontFamily: tk.mono, fontSize:"var(--fs-xs)", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 999, padding: "4px 14px", boxShadow: tk.shadowSm}}>
      <span style={{width:6, height:6, borderRadius:"50%", background: tk.accent, flexShrink:0}}/>{title}
    </figcaption>}
    <div style={{display: "flex", flexDirection: horizontal ? "row" : "column", gap: 12, width: "100%", alignItems: "center", justifyContent: "center", flexWrap: horizontal ? "wrap" : "nowrap"}}>
      {children}
    </div>
  </figure>
);

const Node=({label, desc, color=tk.accent}) => (
  <div style={{
    backgroundColor: tk.nodeBg,
    backgroundImage: `linear-gradient(180deg, ${alpha(color,"14")}, transparent 70%)`,
    border: `1px solid ${alpha(color,"45")}`,
    borderRadius: 10,
    padding: desc ? "13px 20px 12px" : "12px 20px",
    textAlign: "center",
    minWidth: 160,
    boxShadow: tk.shadowSm,
    position: "relative",
    overflow: "hidden"
  }}>
    <div style={{position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${alpha(color,"AA")}, transparent)`}}/>
    <div style={{color: tk.textBright, fontFamily: tk.mono, fontSize:"var(--fs-md)", fontWeight: 700, letterSpacing: ".01em"}}>{label}</div>
    {desc && <div style={{color: tk.textDim, fontSize:"var(--fs-sm)", fontFamily: tk.sans, marginTop: 5, lineHeight: 1.45}}>{desc}</div>}
  </div>
);

// SVG chevron arrowheads — crisper than the old unicode ▼ / ▶ glyphs.
const ArrowHead=({vertical})=>(
  <svg width={vertical?14:9} height={vertical?9:14} viewBox={vertical?"0 0 14 9":"0 0 9 14"} style={{display:"block", flexShrink:0, marginTop:vertical?-1:0, marginLeft:vertical?0:-1}} aria-hidden="true">
    {vertical
      ? <path d="M2 1.5 L7 7 L12 1.5" fill="none" stroke={tk.connector} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      : <path d="M1.5 2 L7 7 L1.5 12" fill="none" stroke={tk.connector} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
);

const Arrow=({label, vertical=true}) => {
  const line = vertical
    ? (h)=><div style={{width:2, height:h, borderRadius:2, background:`linear-gradient(180deg, ${alpha(tk.connector,"66")}, ${tk.connector})`}}/>
    : (w)=><div style={{height:2, width:w, borderRadius:2, background:`linear-gradient(90deg, ${alpha(tk.connector,"66")}, ${tk.connector})`}}/>;
  return (
    <div style={{display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 5}}>
      {line(label?14:20)}
      {label && <div style={{fontSize:"var(--fs-xs)", fontFamily: tk.mono, fontWeight: 600, background: tk.bg2, padding: "3px 11px", borderRadius: 999, color: tk.accent, border:`1px solid ${alpha(tk.accent,"38")}`, boxShadow: tk.shadowSm, whiteSpace:"nowrap"}}>{label}</div>}
      {label && line(14)}
      <ArrowHead vertical={vertical}/>
    </div>
  );
};

export const S=({title,children,c=tk.accent})=>(
  <div style={{marginBottom:40}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20, borderBottom:`1px solid ${tk.border}`, paddingBottom: 12}}>
      <div style={{width:4,height:24,background:c,borderRadius:2,boxShadow:`0 0 12px ${alpha(c,"40")}`}}/>
      <h3 style={{color: tk.textBright, fontFamily:tk.sans, fontSize:"var(--fs-xl)", fontWeight:700, letterSpacing:"0.02em", margin:0}}>{title}</h3>
    </div>
    {children}
  </div>
);

export const Q=({q,a,d="medium",code,deep})=>{
  const[o,setO]=useState(false);
  const nav=useContext(NavCtx);
  const cl={easy:tk.cyan,medium:tk.amber,hard:tk.rose,must:tk.violet};
  const lb={easy:"EASY",medium:"MED",hard:"HARD",must:"MUST"};
  return(
    <div style={{border:`1px solid ${o?alpha(cl[d],"60"):tk.border}`,borderRadius:8,marginBottom:10,overflow:"hidden",transition:"all .2s ease",boxShadow:o?`0 4px 12px ${alpha(cl[d],"10")}`:tk.shadowSm}}>
      <div onClick={()=>setO(!o)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:12,background:o?tk.bg3:tk.bg2,transition:"background .15s"}}>
        <span style={{fontSize:"var(--fs-caption)",padding:"4px 8px",borderRadius:4,background:alpha(cl[d],"22"),color:cl[d],fontFamily:tk.mono,flexShrink:0,marginTop:2,fontWeight:800,letterSpacing:".06em"}}>{lb[d]}</span>
        <span style={{color:o?tk.textBright:tk.text,fontFamily:tk.sans,fontSize:"var(--fs-base)",fontWeight:o?600:400,flex:1,lineHeight:1.5,transition:"color .15s"}}>{q}</span>
        <span style={{color:cl[d],flexShrink:0,fontSize:"var(--fs-lg)",fontFamily:tk.mono,opacity:.7,transform:o?"rotate(90deg)":"none",transition:"transform .2s"}}>▸</span>
      </div>
      {o&&<div style={{padding:"18px 20px 24px",borderTop:`1px solid ${tk.border}`,background:tk.bg}}>
        <div style={{color:tk.textDim,fontSize:"var(--fs-base)",lineHeight:1.8,fontFamily:tk.sans,whiteSpace:"pre-wrap"}}>{a}</div>
        {code&&<C code={code}/>}
        <ReviewToggle q={q} a={a}/>
        {deep&&nav&&(
          <button onClick={()=>nav.goToGuide(deep.g,deep.a)}
            style={{marginTop:14,display:"inline-flex",alignItems:"center",gap:7,background:alpha(tk.emerald,"12"),
              border:`1px solid ${alpha(tk.emerald,"40")}`,borderRadius:6,color:tk.emerald,cursor:"pointer",
              padding:"7px 12px",fontSize:"var(--fs-sm)",fontFamily:tk.sans,fontWeight:600,transition:"all .15s"}}
            onMouseOver={e=>{e.currentTarget.style.background=alpha(tk.emerald,"22");}}
            onMouseOut={e=>{e.currentTarget.style.background=alpha(tk.emerald,"12");}}>
            <span style={{fontFamily:tk.mono,fontSize:"var(--fs-caption)",opacity:.8}}>LEARN ↗</span>
            deep dive in {deep.t}
          </button>
        )}
      </div>}
    </div>
  );
};

export const B=({type="info",children})=>{
  const s={info:{bg:tk.calloutInfo,b:tk.blue,i:"ℹ"},warn:{bg:tk.calloutWarn,b:tk.amber,i:"⚠"},tip:{bg:tk.calloutTip,b:tk.emerald,i:"✦"},danger:{bg:tk.calloutDanger,b:tk.red,i:"▲"},interview:{bg:tk.calloutInterview,b:tk.violet,i:"◎"}}[type];
  return(
    <div style={{background:s.bg,border:`1px solid ${alpha(s.b,"40")}`,borderLeft:`4px solid ${s.b}`,borderRadius:6,padding:"16px 20px",margin:"16px 0",fontSize:"var(--fs-base)",color:tk.text,fontFamily:tk.sans,lineHeight:1.7}}>
      <span style={{marginRight:12,color:s.b,fontSize:"var(--fs-lg)"}}>{s.i}</span>{children}
    </div>
  );
};

export const P=({children})=><p style={{color:tk.text,lineHeight:1.8,fontSize:"var(--fs-lg)",fontFamily:tk.sans,marginBottom:16,margin:"0 0 16px"}}>{children}</p>;

/* ─── Three-tab mental model: LEARN → REVISE → PRACTICE ─── */
export const TabBanner=({mode,setMode})=>{
  const steps=[
    {key:"library", verb:"LEARN",    tab:"Library", color:tk.emerald},
    {key:"compiler",verb:"REVISE",   tab:"Prep",    color:tk.accent},
    {key:"dsa",     verb:"PRACTICE", tab:"DSA",     color:tk.violet},
  ];
  const taglines={
    library:"Deep first-pass understanding — read a concept here, then revise it in Prep and drill it in DSA.",
    compiler:"Rapid recall + Q&A for the night before. Already learned it in Library? Lock it in here, then practice in DSA.",
    dsa:"Apply it under pressure — 97 curated problems. Revise the concepts in Prep, or learn the theory in Library.",
  };
  const active=steps.find(s=>s.key===mode)||steps[1];
  return(
    <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",
      background:`linear-gradient(135deg, ${alpha(active.color,"0E")}, transparent)`,
      border:`1px solid ${alpha(active.color,"33")}`,borderLeft:`3px solid ${active.color}`,
      borderRadius:8,padding:"9px 16px",margin:"0 0 22px"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
        {steps.map((s,i)=>{
          const isActive=s.key===mode;
          return(
            <div key={s.key} style={{display:"flex",alignItems:"center",gap:7}}>
              <button onClick={()=>!isActive&&setMode(s.key)} title={isActive?undefined:`Go to ${s.tab}`}
                style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,
                  cursor:isActive?"default":"pointer",transition:"all .15s",
                  background:isActive?alpha(s.color,"22"):"transparent",
                  border:`1px solid ${isActive?alpha(s.color,"88"):tk.border}`,
                  color:isActive?s.color:tk.textDim,fontFamily:tk.mono,fontSize:"var(--fs-xs)",fontWeight:800,letterSpacing:".06em"}}
                onMouseOver={e=>{if(!isActive){e.currentTarget.style.borderColor=alpha(s.color,"66");e.currentTarget.style.color=s.color;}}}
                onMouseOut={e=>{if(!isActive){e.currentTarget.style.borderColor=tk.border;e.currentTarget.style.color=tk.textDim;}}}>
                <span>{s.verb}</span>
                <span style={{opacity:.6,fontSize:"var(--fs-caption)",fontWeight:600}}>{s.tab}</span>
              </button>
              {i<steps.length-1&&<span style={{color:tk.border,fontSize:"var(--fs-sm)"}}>→</span>}
            </div>
          );
        })}
      </div>
      <div style={{color:tk.textDim,fontSize:"var(--fs-sm)",fontFamily:tk.sans,lineHeight:1.5,flex:1,minWidth:240}}>
        {taglines[mode]}
      </div>
    </div>
  );
};

export const G=({items,children,cols=1,gap=12})=>(
  <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:gap,margin:"12px 0"}}>
    {children ? children : (items && items.map((it,i)=>(
      <div key={i} style={{background:tk.bg2,border:`1px solid ${tk.border}`,borderRadius:8,padding:"16px 20px",boxShadow:tk.shadowSm}}>
        <div style={{color:tk.cyan,fontFamily:tk.mono,fontSize:"var(--fs-md)",fontWeight:700,marginBottom:8,letterSpacing:".02em"}}>{it.t}</div>
        <div style={{color:tk.textDim,fontSize:"var(--fs-base)",lineHeight:1.6,fontFamily:tk.sans}}>{it.d}</div>
      </div>
    )))}
  </div>
);

const RQA=({items})=>items.map((it,i)=>(
  <div key={i} style={{background:tk.bg2,border:`1px solid ${tk.border}`,borderRadius:8,padding:"16px 20px",marginBottom:12,boxShadow:tk.shadowSm}}>
    <div style={{color:tk.amber,fontFamily:tk.sans,fontSize:"var(--fs-base)",marginBottom:8,fontWeight:600}}>Q: {it.q}</div>
    <div style={{color:tk.text,fontSize:"var(--fs-base)",lineHeight:1.75,fontFamily:tk.sans}}>A: {it.a}</div>
  </div>
));

const Table=({headers,rows})=>(
  <div style={{overflowX:"auto",margin:"20px 0", borderRadius:8, border:`1px solid ${tk.border}`}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-md)",fontFamily:tk.sans}}>
      <thead style={{background:tk.bg2}}><tr>{headers.map((h,i)=><th key={i} style={{textAlign:"left",padding:"12px 16px",borderBottom:`1px solid ${tk.borderLight}`,color:tk.textBright,fontFamily:tk.mono,fontSize:"var(--fs-xs)",fontWeight:700,letterSpacing:".05em",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row,i)=><tr key={i} style={{background:i%2?tk.bg:tk.bgAlt, transition:"background 0.1s", cursor: "default"}} onMouseOver={(e)=>e.currentTarget.style.background=tk.bg3} onMouseOut={(e)=>e.currentTarget.style.background=i%2?tk.bg:tk.bgAlt}>{row.map((cell,j)=><td key={j} style={{padding:"12px 16px",borderBottom:`1px solid ${tk.border}`,color:tk.text,verticalAlign:"top",lineHeight:1.6}}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

/* ─── navigation groups ─── */
export const GROUPS=[
  {label:"STRATEGY",items:[
    {id:"assess",label:"Dashboard & Roadmap",icon:"◎"},
    {id:"review",label:"Review Queue",icon:"↻"},
    {id:"mocks",label:"Mock Interviews",icon:"⏱"},
  ]},
  {label:"COMPILER CORE",items:[
    {id:"ssa",label:"SSA & Phi Nodes",icon:"φ"},
    {id:"llvm",label:"LLVM IR Deep Dive",icon:"◆"},
    {id:"passes",label:"Pass Manager & Passes",icon:"⟳"},
    {id:"pipeline",label:"Full Pipeline",icon:"▸"},
    {id:"isel",label:"Instruction Selection",icon:"⊞"},
    {id:"regalloc",label:"Register Allocation",icon:"▦"},
  ]},
  {label:"OPTIMIZATIONS",items:[
    {id:"opts",label:"Loop & Scalar Opts",icon:"↻"},
    {id:"vec",label:"Vectorization & SIMD",icon:"⋮⋮"},
    {id:"dataflow",label:"Dataflow Analysis",icon:"∇"},
    {id:"alias",label:"Alias Analysis",icon:"⊕"},
  ]},
  {label:"C++ DEEP DIVE",items:[
    {id:"cpp_obj",label:"Object Model & OOP",icon:"◫"},
    {id:"cpp_tpl",label:"Templates & Metaprog",icon:"⟨T⟩"},
    {id:"cpp_mem",label:"Memory, Move & RAII",icon:"→"},
    {id:"cpp_con",label:"Concurrency & Atomics",icon:"⇉"},
    {id:"cpp_misc",label:"STL, Storage & ODR",icon:"λ"},
  ]},
  {label:"SYSTEMS",items:[
    {id:"arch",label:"Architecture & Cache",icon:"⚙"},
    {id:"arm",label:"ARM / AArch64",icon:"∑"},
    {id:"link",label:"Linking & ABI",icon:"⟷"},
    {id:"test",label:"Testing & Debugging",icon:"✓"},
  ]},
  {label:"GPU & ML STACK",items:[
    {id:"cuda",label:"CUDA & GPU Model",icon:"⊗"},
    {id:"triton",label:"Triton & Block Model",icon:"▲"},
    {id:"mlir",label:"MLIR & AI Workloads",icon:"Ⓜ"},
    {id:"pytorch",label:"PyTorch & torch.compile",icon:"⊜"},
    {id:"mojo",label:"Mojo & MAX Platform",icon:"⋄"},
  ]},
  {label:"HFT & QUANT",items:[
    {id:"hft",label:"HFT / Low-latency SWE",icon:"⚡"},
    {id:"quant_prob",label:"Probability Under Pressure",icon:"⚄"},
    {id:"quant_micro",label:"Market Microstructure",icon:"⇅"},
  ]},
  {label:"INTERVIEW",items:[
    {id:"resume",label:"Present Your Background",icon:"▤"},
    {id:"mock",label:"120+ Mock Questions",icon:"?"},
    {id:"fullmock",label:"Full Mock Interview",icon:"▶"},
    {id:"behav",label:"Behavioral Prep",icon:"◉"},
  ]},
];

/* ─── home command-center helpers (clickable navigation) ─── */
export const NavTile=({title,sub,meta,color=tk.accent,onClick})=>(
  <button onClick={onClick} style={{textAlign:"left",cursor:"pointer",background:tk.bg2,font:"inherit",
    border:`1px solid ${tk.border}`,borderLeft:`3px solid ${color}`,borderRadius:10,padding:"15px 18px",
    display:"flex",flexDirection:"column",gap:6,transition:"all .15s",width:"100%"}}
    onMouseOver={e=>{e.currentTarget.style.background=tk.bg3;e.currentTarget.style.borderColor=color;e.currentTarget.style.borderLeftColor=color;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseOut={e=>{e.currentTarget.style.background=tk.bg2;e.currentTarget.style.borderColor=tk.border;e.currentTarget.style.borderLeftColor=color;e.currentTarget.style.transform="none";}}>
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8}}>
      <span style={{color:tk.textBright,fontWeight:700,fontSize:"var(--fs-lg)",fontFamily:tk.sans}}>{title}</span>
      {meta&&<span style={{color,fontFamily:tk.mono,fontSize:"var(--fs-caption)",fontWeight:700,flexShrink:0,letterSpacing:".04em"}}>{meta}</span>}
    </div>
    {sub&&<span style={{color:tk.textDim,fontSize:"var(--fs-md)",lineHeight:1.55,fontFamily:tk.sans}}>{sub}</span>}
  </button>
);

export const Chip=({children,color=tk.accent,onClick,title})=>(
  <button onClick={onClick} title={title} style={{cursor:"pointer",background:alpha(color,"14"),font:"inherit",
    border:`1px solid ${alpha(color,"3a")}`,borderRadius:6,color,fontFamily:tk.mono,fontSize:"var(--fs-xs)",fontWeight:600,
    padding:"4px 9px",transition:"all .12s",whiteSpace:"nowrap"}}
    onMouseOver={e=>{e.currentTarget.style.background=alpha(color,"28");e.currentTarget.style.borderColor=alpha(color,"77");}}
    onMouseOut={e=>{e.currentTarget.style.background=alpha(color,"14");e.currentTarget.style.borderColor=alpha(color,"3a");}}>
    {children}
  </button>
);

/* ══════════════════════════════════════════════════════════════
   CONTENT
   ══════════════════════════════════════════════════════════════ */
export const content={

/* ── COMMAND CENTER (home) ── */
mocks:()=><MocksModule/>,

/* ── SSA ── */
ssa:()=>(
<div>
  <S title="1. Why SSA Exists">
    <Card title="The Dataflow Problem" icon="O(N²)" color={tk.red}>
      Before SSA, figuring out which assignment of <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>x</code> reaches a given use required expensive iterative dataflow analysis on the Control Flow Graph (CFG). 
      <br/><br/>
      SSA solves this with one uncompromising rule: <strong>every variable is assigned exactly once</strong>. Every use can trace back to exactly one definition.
    </Card>
    
    <Diagram title="Def-Use Chains: Non-SSA vs SSA" horizontal>
      <div style={{flex:1, minWidth:250, display:"flex", flexDirection:"column", alignItems:"center"}}>
        <div style={{color:tk.textDim, marginBottom:8, fontFamily:tk.mono, fontSize:"var(--fs-sm)", letterSpacing:1}}>NON-SSA (Ambiguous)</div>
        <Node label="x = 5" color={tk.red}/>
        <Arrow />
        <Node label="if (cond) { x = x+1 } else { x = x*2 }" color={tk.amber}/>
        <Arrow />
        <Node label="y = x" desc="Which 'x' is this? Requires analysis" color={tk.red}/>
      </div>
      <div style={{flex:1, minWidth:250, display:"flex", flexDirection:"column", alignItems:"center"}}>
        <div style={{color:tk.textDim, marginBottom:8, fontFamily:tk.mono, fontSize:"var(--fs-sm)", letterSpacing:1}}>SSA (Exact, O(1))</div>
        <Node label="x₁ = 5" color={tk.accent}/>
        <Arrow />
        <Node label="if (cond) { x₂ = x₁+1 } else { x₃ = x₁*2 }" color={tk.amber}/>
        <Arrow />
        <Node label="x₄ = φ(x₂, x₃)" desc="Unique explicitly merged definition" color={tk.accent}/>
        <Arrow />
        <Node label="y₁ = x₄" desc="Trivial O(1) lookup" color={tk.accent}/>
      </div>
    </Diagram>

    <G items={[
      {t:"O(1) Def-Use Chains", d:"Each use has exactly ONE def. Just follow the SSA string/pointer. No O(n) searching."},
      {t:"Sparse Propagation", d:"Analyses travel along direct def→use edges, dropping the need to traverse every sequential statement."},
      {t:"Enables Core Passes", d:"GVN, SCCP, LICM, DCE, and copy propagation are purely structural and trivial under SSA."},
      {t:"LLVM Identity", d:"LLVM IR is universally in SSA form. Every llvm::Value mathematically has exactly one definition point."}
    ]} cols={2}/>
    
    <B type="interview">Your elevator pitch for SSA: "SSA makes def-use chains trivial. Non-SSA requires iterative reaching-definitions analysis. SSA collapses this to a single def per name, making every optimization cheaper and more precise."</B>
  </S>

  <S title="2. Phi Nodes — Conceptual Models">
    <Card title="The Phi Node Rulebook" icon="φ">
      <strong>1. Origin-aware:</strong> "My evaluated value strictly depends on WHICH predecessor block we just came from."<br/>
      <strong>2. Location:</strong> Must appear exclusively at the TOP of a basic block (before any computational instructions).<br/>
      <strong>3. Mapping:</strong> Exactly one operand required per incoming CFG predecessor block.<br/>
      <strong>4. Destruction:</strong> They are infinite-parallel constructs, not actual CPU instructions. They are eliminated before codegen via <i>Critical Edge Splitting</i> and replaced with move operations.
    </Card>

    <Diagram title="Loop SSA: The Most Important Case (Cytron's Nemesis)">
      <Node label="[entry]" desc="i₀ = 0, sum₀ = 0" color={tk.textDim} />
      <Arrow label="fallthrough" />
      <Node label="[header]" desc="i₁ = φ(i₀:entry, i₂:latch) | sum₁ = φ(sum₀:entry, sum₂:latch)" color={tk.accent} />
      <Arrow label="br i1 (i₁ < n)" />
      <Node label="[body]" desc="sum₂ = sum₁ + a[i₁] | i₂ = i₁ + 1" color={tk.amber} />
      <Arrow label="back-edge (latch)" />
      <div style={{color:tk.textDim, fontSize:"var(--fs-sm)", marginTop:-8, fontStyle:"italic"}}>...loops back to [header]...</div>
    </Diagram>
  </S>

  <S title="3. Dominance & Dominance Frontiers">
    <G items={[
      {t:"Dominance (A dom B)", d:"Every path from entry to B MUST pass through A. A completely guards execution of B."},
      {t:"Immediate Dominator (idom)", d:"The closest strict dominator. Forms the backbone of the efficient Dominator Tree."},
      {t:"Dominance Frontier, DF(X)", d:"The boundary where X's dominance ends. Where X dominates a predecessor of Y, but not Y itself. This is exactly where φ nodes are needed!"}
    ]} cols={3}/>
    <B type="tip">A crucial structural insight: Loop back-edges naturally create Dominance Frontiers returning to the loop header. That's why loop variables always need accumulating phis at the header, not just at the loop exit!</B>
  </S>

  <S title="4. SSA Construction (Cytron's Algorithm)">
    <Card title="Phase 1: Phi Placement (Iterated Dominance Frontier)" color={tk.violet}>
      <ol style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li>Gather the set of all blocks that compute a physical definition for variable V. Put them in a <code>Worklist</code>.</li>
        <li>For each block B in the worklist, rationally compute its Dominance Frontier, <code>DF(B)</code>.</li>
        <li>For every block Y in <code>DF(B)</code>: Insert a phi node at the top of Y.</li>
        <li><strong>Crucial step (Iterated DF):</strong> Emitting a phi node at Y is technically a <em>new definition</em> of V! Add Y to the Worklist so its own DF can be evaluated. Repeat until fixed point.</li>
      </ol>
    </Card>

    <Card title="Phase 2: Renaming Values (Dominator Tree DFS)" color={tk.blue}>
      Maintain a stack of active physical names (subscripts) for each source variable.
      <ul style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li>Visit block: Generate fresh names for defs, push to stack. Use stack top for all subsequent internal uses.</li>
        <li>For every successor block in the CFG: fill in their phi nodes using our stack top (this correctly binds the incoming edge).</li>
        <li>Recursively visit children strictly following the dominator tree structure.</li>
        <li>Pop the stack upon exit to cleanly restore the namespace state for sibling branches.</li>
      </ul>
    </Card>
  </S>

  <S title="5. SSA Destruction (De-SSA)">
    <G items={[
      {t:"The Goal", d:"Modern CPUs don't have 'phi' instructions. De-SSA replaces phis with physical `COPY` instructions in predecessor blocks."},
      {t:"Conventional SSA (CSSA)", d:"A 'clean' SSA where no two versions of the same original variable interfere. Trivial to destroy."},
      {t:"Transformed SSA (TSSA)", d:"Optimizations like GVN/CopyProp create 'messy' SSA where different versions of different variables are merged. Requires interference analysis before destruction."}
    ]} cols={3}/>

    <Diagram title="Phi Elimination & Critical Edge Splitting" horizontal={true}>
      <div style={{display:"flex", flexDirection:"column", gap:10}}>
        <Node label="Block A" sub="br cond, B, C" color={tk.blue} />
        <div style={{display:"flex", gap:40}}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
            <Arrow label="Critical Edge!" color={tk.red} />
            <Node label="New Block E" sub="x_phi = x_A" color={tk.accent} />
            <Arrow />
            <Node label="Block B" sub="x = phi(x_A, x_C)" color={tk.violet} />
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
             <Arrow label="Safe" />
             <Node label="Block C" />
          </div>
        </div>
      </div>
    </Diagram>

    <Card title="The Hidden Complexity: Lost Copy Problem" color={tk.orange}>
      If optimizations are too aggressive, a simple copy replacement might overwrite a value that's still needed by another phi node in the same block. Modern compilers use <strong>Interference Graphs</strong> during De-SSA to detect these cycles and insert temporary registers or perform parallel copies to ensure mathematical correctness.
    </Card>
  </S>

  <S title="6. MemorySSA & LCSSA Extensions">
    <G items={[
      {t:"LCSSA (Loop Closed SSA)", d:"Inserts a phi node at every loop EXIT for values defined inside the loop. This ensures that any 'external' use of a loop value goes through a well-defined boundary, simplifying vectorization, LICM, and loop unrolling."},
      {t:"MemorySSA", d:"Provides SSA representation for memory operations. MemoryDef (stores), MemoryUse (loads), and MemoryPhi (merges). Makes identifying clobbering stores O(1) instead of traversing the whole block."},
      {t:"mem2reg vs SROA", d:"mem2reg promotes basic stack allocations to SSA form, but fails if address escapes or is manipulated via GEP. SROA (Scalar Replacement of Aggregates) is far more powerful, splitting structs into individual SSA scalars."}
    ]}/>
  </S>

  <S title="SSA Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is the key property of SSA and why does it matter?" a={"Every variable defined exactly once. This gives O(1) def-use chains: each use has exactly one def you can trace directly. No need for reaching-definitions dataflow.\n\nEnables: constant propagation, DCE, GVN, SCCP, LICM — all simpler and more precise because each value has a unique unambiguous name.\n\nLLVM IR is entirely SSA. Every llvm::Value is an SSA value with one definition."}/>
    <Q d="easy" q="What are the three rules for phi nodes?" a={"(1) Phi nodes only appear at the TOP of a basic block, before any non-phi instruction.\n(2) One operand per predecessor block — phi selects based on which predecessor we came from.\n(3) Phi nodes are eliminated before code generation, replaced with copies at predecessor ends (with critical edge splitting to handle ambiguity)."}/>
    <Q d="easy" q="What is dominance? What does 'A idom B' mean?" a={"A dominates B if every path from the entry block to B passes through A. Every block dominates itself.\n\nA strictly dominates B if A dominates B and A ≠ B.\n\nidom(B) = the immediate dominator = the closest strict dominator (the lowest ancestor in the dominator tree). Every block except entry has exactly one idom."}/>
    <Q d="medium" q="What is the dominance frontier and why do phis go there?" a={"DF(X) = set of blocks Y where X dominates a predecessor of Y but does NOT strictly dominate Y.\n\nIntuition: DF(X) is the boundary of X's dominance — the first places you can reach where X's definition might not be the latest one. A variable defined in X needs a phi at every block in its IDF to merge with other possible definitions.\n\nFormal: DF(X) = {Y : ∃ pred P of Y such that X dom P and X does not strictly dom Y}"}/>
    <Q d="medium" q="What is a critical edge and why must we split it?" a={"A critical edge A→B exists when A has 2+ successors AND B has 2+ predecessors.\n\nProblem: During SSA destruction (phi elimination), we need to insert copies 'on the edge from A to B'. But A's end already branches to other blocks, and B's start is also reached from other blocks.\n\nSolution: Insert an empty basic block E on the edge: A→E→B. Copies go in E. This is mandatory before phi elimination. LLVM's CriticalEdgeSplitter pass handles this."}/>
    <Q d="medium" q="Explain LCSSA. Why does LLVM maintain it?" a={"Loop Closed SSA: for every value V defined inside a loop, every USE of V outside the loop is through a phi node at the loop exit.\n\nWhy: Loop transforms (unrolling, versioning, LICM) frequently remove loop iterations or restructure them. LCSSA ensures that any 'external' use of a loop value goes through a well-defined exit phi, making it safe to restructure the loop interior without breaking external uses."}/>
    <Q d="hard" q="Trace Cytron's algorithm on a loop: header H, body B defines x, exit E." a={"PHASE 1 — Phi placement:\n  x defined in B. Worklist={B}.\n  DF(B) = {H} (B is pred of H via back-edge, B doesn't dominate H because entry→H exists).\n  Add H. DF(H) = {} (H is the loop header, dominates everything inside).\n  IDF = {H} → place phi at H: x = φ(x₀:entry, x₂:B)\n\nPHASE 2 — Rename:\n  Visit entry: push x₀ (original/init def).\n  Visit H: phi → fresh x₁, push x₁.\n    Succ B: fill phi 'from H' with... wait, that's wrong. B defines x.\n  Visit B: uses of x → replaced with x₁ (stack top).\n    x defined → fresh x₂, push x₂.\n    Succ H (back-edge): fill H's phi 'from B' with x₂. Pop x₂.\n  Visit E (exit): uses x → x₁ from H's phi. (LCSSA phi created if needed.)\n  Pop x₁ from H.\n\nResult: H's phi is x₁ = φ(x₀:entry, x₂:B). Loop body uses x₁, produces x₂."}/>
    <Q d="hard" q="What is MemorySSA and how does it accelerate LICM?" a={"MemorySSA provides an SSA representation for memory operations:\n• MemoryDef: each store creates a MemoryDef (like a def in regular SSA)\n• MemoryUse: each load links to the MemoryDef it reads from\n• MemoryPhi: at control flow joins, merges MemoryDefs from different paths\n\nTraditional LICM: to hoist a load, must prove no aliasing store on any path. Requires walking all reachable instructions.\n\nWith MemorySSA: the load's MemoryUse points directly to the clobbering MemoryDef (or MemoryPhi). If that def is OUTSIDE the loop (dominates loop header), the load is hoistable — one O(1) check instead of full loop traversal."}/>
    <Q d="hard" q="What is SCCP and why is it more powerful than simple constant propagation?" a={"Sparse Conditional Constant Propagation. Three improvements over basic CP:\n\n1. SPARSE: propagates along SSA def-use edges only, not all statements. O(uses) not O(all instructions).\n\n2. CONDITIONAL: models control flow. If a branch condition is constant → marks one successor EXECUTABLE, other DEAD → doesn't propagate through dead branches → discovers more constants.\n\n3. LATTICE: TOP (not yet analyzed) → constant c → BOTTOM (non-constant). Conservative: once BOTTOM, stays BOTTOM.\n\nCombined: can discover that a function returning '42' makes an entire if-else dead, exposing further constant propagation opportunities that simple CP misses."}/>
  </S>
</div>
),

/* ── LLVM IR ── */
llvm:()=>(
<div>
  <S title="1. LLVM Architecture">
    <Diagram title="The LLVM Compilation Pipeline" horizontal>
      <Node label="Source" desc="C/C++, Rust, Julia" color={tk.textDim} />
      <Arrow label="Frontend" vertical={false} />
      <Node label="LLVM IR" desc="The Universal Language" color={tk.accent} />
      <Arrow label="Optimizer (Passes)" vertical={false} />
      <Node label="LLVM IR" desc="Optimized IR form" color={tk.violet} />
      <Arrow label="Backend (LLC)" vertical={false} />
      <Node label="Machine Code" desc="PTX, x86, ARM" color={tk.orange} />
    </Diagram>
    
    <Card title="The LLVM IR Object Hierarchy" color={tk.blue}>
      LLVM IR is fundamentally a strictly-typed C++ object hierarchy in memory.
      <br/><br/>
      <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>Module</code> contains <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>Function</code>s.<br/>
      <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>Function</code> contains <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>BasicBlock</code>s.<br/>
      <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>BasicBlock</code> contains <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>Instruction</code>s.<br/>
      <hr style={{borderColor:tk.border, margin:"8px 0"}}/>
      <strong>Crucial Concept:</strong> Every <code style={{color:tk.orange}}>Instruction</code> mathematically IS a <code style={{color:tk.orange}}>Value</code>. Any instruction that computes a result can be passed as an operand to other instructions.
    </Card>
  </S>

  <S title="2. Complete IR Instruction Reference">
    <G items={[
      {t:"Types", d:"i1, i8, i32, i64 (integers). float, double (IEEE 754). <4 x float> (SIMD vector). ptr (opaque pointers, LLVM 15+)."},
      {t:"Arithmetic & Flags", d:"add, sub, mul, sdiv/udiv. Flags matter: 'nsw' (no signed wrap) → overflow is poison → optimizer assumes no wrap, enabling aggressive loop widening."},
      {t:"Memory (Load/Store)", d:"alloca (stack allocations), store (write), load (read). Clang emits memory ops for all local variables, which mem2reg later converts to SSA."},
      {t:"Pointers (GEP)", d:"getelementptr computes an ADDRESS. It NEVER loads memory. It is purely mathematical pointer arithmetic."}
    ]} cols={2}/>
    <Card title="Control Flow & Casts" color={tk.amber}>
      <strong>Transitions:</strong> <code style={{color:tk.text}}>br</code> (branch), <code style={{color:tk.text}}>switch</code>, <code style={{color:tk.text}}>ret</code> (return). <code style={{color:tk.text}}>unreachable</code> tells the optimizer the execution path is impossible (a UB trap).<br/>
      <strong>Dataflow:</strong> <code style={{color:tk.text}}>phi</code> merges SSA values at join points. <code style={{color:tk.text}}>select</code> is a branchless ternary operator (like CSEL/CMOV).<br/>
      <strong>Casts:</strong> <code style={{color:tk.text}}>zext</code> (zero-extend), <code style={{color:tk.text}}>sext</code> (sign-extend), <code style={{color:tk.text}}>trunc</code> (truncate), <code style={{color:tk.text}}>bitcast</code> (raw bit reinterpretation).
    </Card>
    <B type="danger">GEP NEVER loads memory. This is the #1 misconception. "getelementptr" = "Get Element POINTER" = pure address computation. GEP + load = two separate operations. An interviewer who says "GEP loads" is wrong.</B>
  </S>

  <S title="3. Metadata, Attributes & TBAA">
    <G items={[
      {t:"Instruction Attributes", d: "nounwind (no exceptions thrown), readonly (pure read, CSE eligible), willreturn (guaranteed to not infinite loop). Optimizer aggressively prunes based on these."},
      {t:"TBAA (Type-Based Alias Analysis)", d: "C's strict aliasing rule: int* and float* CANNOT point to the same memory. LLVM encodes this as metadata. Different TBAA tags = NoAlias = optimizer can reorder memory instructions!"}
    ]} cols={2} />
    <Card title="Worked Example: Lowering __rdtsc() through ClangIR" icon="⚙️" color={tk.accent}>
      A merged ClangIR contribution added codegen for <code>__rdtsc()</code>. The lowering chain:<br/>
      <ol style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li>Clang AST translates the builtin to CIR: <code style={{color:tk.cyan}}>cir.call_llvm_intrinsic "x86.rdtsc"</code></li>
        <li>CIR lowers to LLVM IR: <code style={{color:tk.cyan}}>@llvm.x86.rdtsc() : i64</code></li>
        <li>SelectionDAG (Backend) translates the LLVM Intrinsic into hardware <code style={{color:tk.cyan}}>RDTSC</code>.</li>
        <li>For <code style={{color:tk.cyan}}>__rdtscp</code>, IR extracts the struct fields and emits the auxiliary processor ID.</li>
      </ol>
    </Card>
  </S>

  <S title="4. Intrinsics & The Lowering Chain">
    <G items={[
      {t:"@llvm.memcpy / memset", d:"Often stripped out and replaced with inline SIMD vector instructions by the backend if size is known."},
      {t:"@llvm.sadd.with.overflow", d:"Returns {result, i1 overflow_bit}. Allows hardware overflow flags to be utilized safely without UB exceptions."},
      {t:"@llvm.assume(cond)", d:"Does nothing at runtime, but feeds the optimizer mathematical truths (e.g. alignment constraints) for loop vectorization."}
    ]} cols={3}/>
  </S>

  <S title="LLVM IR Practice Questions" c={tk.amber}>
    <Q d="easy" q="What are the three forms of LLVM IR?" a={"Textual (.ll): human-readable, can be emitted with -emit-llvm -S\nBitcode (.bc): binary serialized form, used for LTO\nIn-memory C++ objects: what the optimizer actually works with\n\nAll three are semantically equivalent. You can round-trip between them."}/>
    <Q d="easy" q="What does GEP do? What does it NOT do?" a={"GEP (GetElementPtr) computes an ADDRESS — pointer arithmetic. It NEVER loads memory.\n\n%ptr = getelementptr i32, ptr %arr, i64 3   → gives &arr[3]\n\nTo actually read the value you need a LOAD afterwards:\n%val = load i32, ptr %ptr\n\nCommon misconception: 'GEP accesses memory.' FALSE. GEP is pure mathematical pointer computation."}/>
    <Q d="easy" q="What does 'add nsw' mean? Why does it matter for optimization?" a={"nsw = No Signed Wrap. If the addition overflows, the result is POISON.\n\nThis tells the optimizer: 'assume this addition does not overflow.' Enables:\n• SCEV to compute loop trip counts without modular arithmetic\n• Induction variable widening (i32 → i64 for 64-bit addressing)\n• Loop vectorization (need to know trip count fits)\n• Strength reduction (i*N where N is constant)"}/>
    <Q d="medium" q="What is 'select' and how is it different from 'phi'?" a={"phi: SSA merge at a control flow join point. Multiple predecessor blocks each supply a value based on which block was actually executed.\n\nselect i1 %cond, i32 %a, i32 %b: branchless conditional — like a ternary operator. No control flow at all. Maps to CSEL on AArch64, CMOV on x86.\n\nWhen to use select: when both branches are cheap and branch prediction would be poor. The compiler's if-conversion pass converts suitable if-else to select."}/>
    <Q d="medium" q="Worked example: how does a builtin like __rdtsc() get lowered through ClangIR end-to-end?" a={"Context: ClangIR (CIR) inserts an MLIR-based dialect between Clang AST and LLVM IR, enabling higher-level analysis.\n\nThe flow (from a merged CIR contribution that added __rdtsc/__rdtscp codegen):\n1. CIRGenBuiltinX86.cpp: recognize the __rdtsc/__rdtscp builtins from the AST\n2. Emit cir.call_llvm_intrinsic 'x86.rdtsc' → returns i64 in CIR\n3. For rdtscp: returns struct{i64,i32}. Use ExtractMemberOp for each field. Store processor_id to the aux argument.\n4. CIR-to-LLVM lowering: cir.call_llvm_intrinsic → @llvm.x86.rdtsc()\n5. Testing: triple FileCheck — CHECK-CIR, CHECK-LLVM, CHECK-OGCG (old-codegen parity)\n\nIn review, two things surfaced:\n• Remove hardcoded alignment (the framework computes it)\n• Fix test-file prefix conventions\n\nGeneral lesson: in large codebases, trust existing infrastructure for cross-cutting concerns rather than hand-rolling them."}/>
    <Q d="medium" q="What is the difference between 'unreachable' and a dead block?" a={"unreachable: a terminator instruction that explicitly marks the current point as UB if reached. The optimizer uses this as license to assume this path CANNOT occur, enabling aggressive pruning.\n\nDead block: a basic block with no predecessors (unreachable from entry). SimplifyCFG eliminates these. Different from blocks that are provably not reached but still have CFG edges."}/>
    <Q d="hard" q="How does alias analysis work in LLVM? List the main layers." a={"Alias analysis answers: 'do these two memory operations access the same location?'\nResults: NoAlias, MayAlias, MustAlias, PartialAlias.\n\nLayers (combined via chained AAResults):\n1. BasicAA: distinct allocas can't alias. GEP analysis (different struct fields). Argument attributes (noalias).\n2. TBAA: type-based. float* and int* → different TBAA types → NoAlias (strict aliasing rule).\n3. GlobalsAA: globals with internal linkage and no address taken → NoAlias with each other.\n4. SCEV-AA: loop induction variables. &a[i] vs &a[j] where |i-j| is provably non-zero → NoAlias.\n5. ScopedNoAliasAA: from restrict / __restrict__ annotations.\n\nWeak alias analysis = blocked hoisting/reordering = many missed optimizations."}/>
    <Q d="hard" q="What is the difference between function attributes and parameter attributes?" a={"Function attributes describe the entire call (readnone, nounwind, willreturn, nosync).\nParameter attributes describe individual arguments (noalias, readonly, nonnull, align(N)).\n\nKey examples:\nnounwind → optimizer can omit exception table entries for this call\nreadnone → doesn't read or write memory → pure function, can be CSE'd/DCE'd\nnoalias → (on pointer return) returned pointer doesn't alias any existing pointer\nnonnull → pointer argument is never null → optimizer can remove null checks\n\nLLVM uses these heavily for optimizing calls to standard library functions."}/>
    <Q d="hard" q="Explain LLVM's opaque pointer change. Why was it done?" a={"Pre-LLVM 15: typed pointers like i32* or float**. Every GEP carried the pointee type.\n\nProblems:\n• Type propagation added complexity throughout the optimizer\n• C-style casts between pointer types required bitcast → noise in IR\n• Languages without C's type system (Rust, Swift) generated awkward IR\n\nLLVM 15+: single opaque 'ptr' type. No more i32* vs float*. GEP requires explicit type: getelementptr i32, ptr %p, i64 %i.\n\nBenefits: simpler optimizer, fewer bitcasts, cleaner IR for non-C languages. TBAA metadata handles alias analysis (not the pointer type)."}/>
    <Q d="hard" q="What is LLVM's cost model used for?" a={"The cost model (TargetTransformInfo) estimates instruction costs for optimization decisions:\n\n1. Vectorizer: is vectorizing this loop profitable? Compares vector cost vs scalar cost.\n2. Inliner: is inlining this function worth the code size increase?\n3. Loop unroller: is unrolling by factor N worth the code size?\n4. SLP vectorizer: is bundling these stores into a vector store beneficial?\n\nThe cost model is target-specific (each backend implements TTI). Hexagon's TTI knows HVX vector costs. Wrong cost model → missed vectorization OR vector code slower than scalar (too wide vectors spill registers)."}/>
    <Q d="must" q="Explain the LLVM pass pipeline for -O2 from a high level." a={"Roughly (simplified, LLVM 16+):\n\n1. Module passes: GlobalDCE, InferFunctionAttrs\n2. Per-function: SROA, EarlyCSE, LICM (simple), SimplifyCFG, InstCombine\n3. CGSCC (inliner group): Inliner (multiple rounds with function simplification)\n4. Per-function (post-inline): SROA, InstCombine, SimplifyCFG, GVN, SCCP, InstCombine, SimplifyCFG, ADCE, LoopPass(Rotate, LICM, Unroll, LoopIdiom)\n5. LoopVectorize, SLPVectorize\n6. InstCombine, SimplifyCFG (cleanup)\n7. Backend: ISel → RegAlloc → Schedule → Emit\n\nKey: InstCombine runs 4-5 times because every other pass creates new simplification opportunities."}/>
  </S>
</div>
),

/* ── PASSES ── */
passes:()=>(
<div>
  <S title="1. Pass Manager Architecture (New PM)">
    <Card title="The Manager Hierarchy" color={tk.violet}>
      LLVM's New Pass Manager explicitly structures passes by scope:<br/>
      <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>ModulePassManager → CGSCCPassManager → FunctionPassManager → LoopPassManager</code><br/><br/>
      <strong>Analysis vs Transform:</strong><br/>
      • <strong>Analysis:</strong> Reads IR, produces logically cached results (e.g., <code style={{color:tk.text}}>DominatorTreeAnalysis</code>, <code style={{color:tk.text}}>LoopInfo</code>).<br/>
      • <strong>Transform:</strong> Modifies IR. Must explicitly return <code style={{color:tk.text}}>PreservedAnalyses</code> to tell the manager which cached computations remain valid.
    </Card>
    <B type="danger">Returning the wrong PreservedAnalyses (e.g., claiming the DominatorTree is preserved when you mutated the CFG) leads to dirty caches, which leads to silent miscompilation in downstream passes. This is the absolute #1 cause of LLVM backend bugs.</B>
  </S>

  <S title="2. mem2reg vs SROA — The Memory-to-SSA Battle">
    <G items={[
      {t:"mem2reg (The Basics)", d:"Promotes 'alloca' instructions to SSA registers. Only works if: 1) The alloca is in the entry block, 2) Its address never escapes (never passed to a function), 3) It's only used by simple load/store. If a GEP touches it, mem2reg FAILS."},
      {t:"SROA (The Titan)", d:"Scalar Replacement of Aggregates. FAR more powerful. It can split a struct alloca into individual scalars. Even if you use GEP to access a field, SROA 'shatters' the struct and promotes the pieces to SSA. It is the core of LLVM's scalar performance."}
    ]} cols={2}/>

    <Card title="Example: Why mem2reg Fails" color={tk.rose}>
      <code>struct Point {"{"} int x, y; {"}"} p;</code><br/>
      If you pass <code>&p.x</code> to a function, the address <strong>escapes</strong>. The compiler can no longer prove that a register move is safe because an external function might change the value via the pointer. <code>mem2reg</code> gives up; the value stays on the stack (slow <code>ldr/str</code>).
    </Card>
    
    <Diagram title="The Standard Pipeline Ordering" horizontal>
      <Node label="SROA" desc="Unpack Structs" color={tk.cyan} />
      <Arrow />
      <Node label="InstCombine" desc="Simplify" color={tk.amber} />
      <Arrow />
      <Node label="Inliner" desc="Merge" color={tk.red} />
      <Arrow />
      <Node label="GVN" desc="Redundancy" color={tk.violet} />
    </Diagram>

    <B type="interview"><strong>Interview Tip:</strong> If asked about memory-to-SSA, say: "Clang produces naive alloca-based IR. We rely on SROA/mem2reg to 'elevate' memory into SSA registers. SROA is the workhorse here because it handles complex C structs by shattering them into scalars."</B>
  </S>

  <S title="Pass Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is instcombine? Give 5 patterns." a={"InstCombine is the algebraic peephole optimizer — simplifies individual instructions via ~1000 pattern rules.\n\n5 key patterns:\n1. add X, 0 → X (identity)\n2. mul X, 8 → shl X, 3 (strength reduction)\n3. sub X, X → 0 (self-cancel)\n4. urem X, 16 → and X, 15 (power-of-2 mod)\n5. zext(trunc(X to i8)) to i32 → and X, 255 (masking)\n\nRuns 4-5 times because other passes (inlining, GVN, unrolling) expose new patterns."}/>
    <Q d="medium" q="What is PreservedAnalyses and why is getting it wrong catastrophic?" a={"After a transform pass, you declare which analyses are still valid. The AnalysisManager uses this to decide what needs to be recomputed.\n\nIf you incorrectly claim an analysis is preserved when it's not:\n→ Stale DominatorTree cached\n→ Next pass (LICM, GVN) uses wrong dominators\n→ Pass makes incorrect hoisting/elimination decisions\n→ Silent miscompilation — output binary is wrong\n\nNo compiler crash, no assertion — just wrong output. This is the #1 correctness concern for pass authors."}/>
    <Q d="medium" q="What is the CGSCC pass manager? Why does it exist?" a={"Call Graph Strongly Connected Components. Processes the call graph in bottom-up order (callees before callers).\n\nThe Inliner is a CGSCC pass because: to make good inlining decisions, you want callees already optimized first. CGSCC ensures that.\n\nMutually recursive functions form an SCC — they must be processed together. The inliner handles intra-SCC inlining specially.\n\nNPM (New Pass Manager) makes the CGSCC hierarchy explicit: Module → CGSCC → Function → Loop."}/>
    <Q d="hard" q="When would you write a ModulePass vs FunctionPass?" a={"FunctionPass: can answer all questions looking at one function at a time. GVN, LICM, InstCombine — all local to one function's IR.\n\nModulePass needed when:\n• Need cross-function information (GlobalDCE needs to see all uses of a global)\n• Interprocedural analysis/transform (InferFunctionAttrs, GlobalOpt)\n• LTO optimizations (entire program visible)\n• Generating new functions or modifying global variables\n\nFunctionPasses are parallelizable — can run simultaneously on different functions. ModulePasses are inherently sequential. Always prefer FunctionPass if possible."}/>
    <Q d="hard" q="How does the inliner's cost model work? Why does mobile prefer conservative inlining?" a={"The inliner computes a 'cost' for each call site:\n• Base cost: size of callee in IR instructions (weighted)\n• Discounts: constant arguments (enables further optimization), small hot functions, no-throw functions\n• Threshold: O2=225, O3=275, Os=50 units\n\nif cost < threshold → inline\n\nMobile targets prefer conservative inlining (Os-like thresholds) because:\n1. Code size → I-cache pressure. A tiny Hexagon DSP icache means large inlined code causes more misses than the call overhead saved.\n2. Battery: larger binary → more instruction fetches → more power.\n3. The benefit of cross-call optimization often doesn't justify size cost on small processors."}/>
  </S>
</div>
),

/* ── PIPELINE ── */
pipeline:()=>(
<div>
  <S title="Complete Compilation Pipeline">
    <Diagram title="The CodeGen Journey: C to Assembly" horizontal={false}>
      <Node label="Source.c" desc="Raw Code" />
      <Arrow label="PREPROCESSOR: macros, #includes" />
      <Node label="Tokens" />
      <Arrow label="LEXER & PARSER" />
      <Node label="AST (Abstract Syntax Tree)" color={tk.cyan} />
      <Arrow label="SEMA (Type checking, constexpr eval)" />
      <Node label="Clang CodeGen" desc="Emits naive alloca IR" color={tk.blue} />
      <Arrow label="SROA / mem2reg" />
      <Node label="LLVM IR (SSA Form)" color={tk.accent} />
      <Arrow label="Optimizer Passes (-O2 / -O3)" />
      <Node label="Optimized LLVM IR" color={tk.violet} />
      <Arrow label="Instruction Selection (ISel)" />
      <Node label="MachineInstrs (Virtual Regs)" color={tk.amber} />
      <Arrow label="Register Allocation" />
      <Node label="MachineInstrs (Physical Regs)" color={tk.red} />
      <Arrow label="Scheduling & Frame Lowering" />
      <Node label=".o / .s" desc="ELF/Mach-O or Assembly" color={tk.textDim} />
    </Diagram>

    <G items={[
      {t:"-O0 (Debug)", d:"No optimization (only alloca→SSA). Fastest compilation time, biggest executable. Best for accurate debugging."},
      {t:"-O1 (Basic)", d:"InstCombine, SimplifyCFG, LICM, basic unroll. Catches most low-hanging fruit and undefined behavior."},
      {t:"-O2 (Release)", d:"Adds GVN, Inliner, LoopVectorize, SLPVectorize. The sweet spot for performance vs. binary size."},
      {t:"-O3 (Aggressive)", d:"Higher inline thresholds, loop unswitching, massive unrolling. Can sometimes HURT performance due to instruction cache (i-cache) misses."},
      {t:"-Os / -Oz (Size)", d:"Optimizes for size. Essential for mobile/embedded devices (like Qualcomm DSPs) where cache pressure is the bottleneck."}
    ]} cols={2}/>

    <B type="tip">Memorize this trace. Interviewers LOVE asking you to walk through compilation of a simple function. The key insight to highlight: Clang generates naive alloca-based IR, and SROA/mem2reg elevates it to SSA. Separation of concerns — frontend stays simple, optimizer handles the complexity.</B>
  </S>

  <S title="Pipeline Practice Questions" c={tk.amber}>
    <Q d="easy" q="Why does Clang emit alloca/store/load instead of SSA directly?" a={"Simplicity and correctness. Mapping AST variables to stack allocas is trivial — every AST variable gets one alloca. All the complexity of SSA construction (dominance, phi placement) is then handled by the well-tested SROA/mem2reg passes.\n\nFrontend stays small and correct. Optimizer handles SSA. Clean separation of concerns."}/>
    <Q d="medium" q="What is the difference between -O2 and -O3? When is -O3 slower?" a={"-O2: standard production optimization. Vectorizes, inlines, unrolls within conservative thresholds.\n\n-O3: more aggressive inlining (275 vs 225 threshold), more loop unrolling, loop unswitching, more vectorization.\n\n-O3 can be SLOWER because:\n• More inlining → larger functions → more register pressure → more spills\n• More unrolling → larger code → I-cache misses\n• Extra optimization passes add compile time\n\nFor mobile targets: -Os or -O2 is often better than -O3 due to small icache on Hexagon DSP."}/>
    <Q d="hard" q="What is Profile-Guided Optimization (PGO)? How does it change the pipeline?" a={"PGO runs the binary on representative inputs, collects branch probabilities, function call frequencies, and basic block execution counts. Then recompiles using this profile.\n\nPGO changes:\n1. Branch prediction hints → better branch layout (hot path is sequential)\n2. Hot/cold function layout → hot functions packed together in .text (better iTLB)\n3. Inlining decisions → inline hot callees even below threshold; don't waste space on cold\n4. Loop unrolling → unroll hot loops more aggressively\n5. Vectorization → vectorize loops known to execute many iterations\n\nFor mobile: PGO is essential for production code. Camera/audio pipelines have very regular hot paths — PGO eliminates most dead code from the fast path."}/>
    <Q d="medium" q="Why does InstCombine run so many times in the -O2 pipeline instead of just once?" a={"InstCombine is LLVM's peephole/algebraic simplifier (x+0→x, x*2→x<<1, redundant casts, etc.). It runs 4–5 times in -O2 not because it's incomplete, but because optimization is a FIXPOINT process: each pass EXPOSES new opportunities for the others.\n\nExample chain: the Inliner pastes a callee's body in → now a constant argument flows into the body → SCCP/constant-folding collapses a branch → SimplifyCFG deletes the dead block and merges blocks → that merge brings two instructions adjacent → InstCombine can now fold them → the fold creates a trivially-true compare → and so on.\n\nSo the pipeline interleaves 'cleanup' passes (InstCombine, SimplifyCFG, EarlyCSE) between 'heavy' passes (inlining, GVN, loop opts) because the heavy passes leave behind simplifiable residue. Running InstCombine once at the start would miss everything inlining and loop transforms create later. The trade-off is compile time — that's why -O1 runs fewer rounds.\n\nInterview line: 'Compiler passes aren't a sequence, they're a convergence loop — InstCombine is the broom that sweeps up after every structural change so the next pass sees clean IR.'"}/>
    <Q d="hard" q="What is phase-ordering, and why is the 'optimal' pass order undecidable?" a={"Phase-ordering is the problem of choosing the SEQUENCE of optimization passes. It matters because passes interact non-commutatively: running A then B can produce different (and sometimes worse) code than B then A.\n\nClassic tension: inlining before vs after other passes. Inline too early and you bloat IR before simplification, blowing up compile time and register pressure; inline too late and you miss the cross-function constant propagation that would have triggered loop optimizations. Vectorization vs unrolling: unroll first and you may defeat the vectorizer's recognition of the loop; vectorize first and the leftover scalar tail still wants unrolling.\n\nWhy there's no universally optimal order: a pass can both create AND destroy opportunities for another, so the search space is enormous and input-dependent — the best order for one function is wrong for the next. There's no closed-form 'best'; LLVM's -O2 pipeline is a hand-tuned heuristic refined over years of benchmarking. Research approaches (MILEPOST, machine-learned pass orderings, autotuners like OpenTuner, and 'optimization bisection' for debugging) explore the space empirically rather than solving it. Practically: this is why -O3 isn't strictly better than -O2, and why PGO helps — profile data lets the compiler pick orderings/thresholds per hot region."} deep={{g:"02",t:"Optimization Passes"}}/>
  </S>
</div>
),

/* ── ISEL ── */
isel:()=>(
<div>
  <S title="1. SelectionDAG — IR to Machine Instructions">
    <Card title="The SelectionDAG Pipeline" color={tk.violet}>
      Operates essentially per-basic-block. Builds a Directed Acyclic Graph (DAG) of <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>SDNode</code>s.
      <ol style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>BUILD:</strong> LLVM IR → Target-independent nodes (<code>ISD::ADD</code>, <code>ISD::LOAD</code>).</li>
        <li><strong>TYPE LEGALIZE:</strong> Fix hardware-illegal types (e.g. <code>i8</code> arithmetic on AArch64 promotes to <code>i32</code>; <code>i128</code> on 32-bit expands to pairs).</li>
        <li><strong>OP LEGALIZE:</strong> Fix hardware-illegal operations (e.g. <code>sdiv</code> on a DSP without hardware divide expands to a library call).</li>
        <li><strong>DAG COMBINE:</strong> Target-specific graph optimizations. e.g. <code>(add (shl X, 2), X)</code> combined into a single ARM <code>ADD ... lsl #2</code>.</li>
        <li><strong>INSTRUCTION SELECT:</strong> Pattern-match <code>SDNode</code>s into target <code style={{color:tk.cyan, background:tk.bg, padding:"2px 6px", borderRadius:4}}>MachineSDNode</code>s using TableGen definitions.</li>
      </ol>
    </Card>
    <Card title="TableGen Patterns (.td)" color={tk.textDim}>
      Backend rules are declarative: <code style={{color:tk.amber}}>def : Pat&lt;(add i32:$a, i32:$b), (ADD_rr $a, $b)&gt;;</code><br/>
      LLVM compiles these <code>.td</code> files into massive C++ pattern-matching state machines.
    </Card>
  </S>

  <S title="2. GlobalISel — Modern Alternative">
    <G items={[
      {t:"Scope", d:"SelectionDAG is per-basic-block. GlobalISel has whole-function scope, enabling better cross-block heuristics."},
      {t:"Representation", d:"SelectionDAG uses complex SDNodes. GlobalISel uses Generic MIR (G_ADD, G_LOAD) which behaves exactly like real MachineInstrs."},
      {t:"Speed", d:"GlobalISel is significantly faster to compile (great for -O0) because it avoids the slow DAG building/tearing down process."},
      {t:"Why SelectionDAG still wins (-O2)", d:"SelectionDAG has decades of complex pattern-matching and DAG combining rules baked in. GlobalISel is still catching up on peak performance."}
    ]} cols={2}/>
    
    <Diagram title="GlobalISel Pipeline" horizontal>
      <Node label="LLVM IR" />
      <Arrow label="IR Translator" vertical={false} />
      <Node label="Generic MIR" desc="G_ADD, G_LOAD" color={tk.blue} />
      <Arrow label="Legalizer" vertical={false} />
      <Node label="Legal MIR" color={tk.cyan} />
      <Arrow label="RegBankSelect" vertical={false} />
      <Node label="Banked MIR" desc="GPR vs FPR assigned" color={tk.violet} />
      <Arrow label="Instruction Select" vertical={false} />
      <Node label="MachineInstrs" color={tk.accent} />
    </Diagram>
  </S>

  <S title="ISel Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is type legalization? Give two examples." a={"Type legalization makes IR types legal for the target hardware.\n\nExamples:\n1. i8 arithmetic on AArch64: promoted to i32. AArch64 ALU operates on 32/64-bit registers only.\n2. i128 on 64-bit target: expanded to a pair of i64 operations. Addition with carry bit.\n3. v32f32 on 256-bit AVX2: split into two v16f32 operations."}/>
    <Q d="medium" q="What is operation legalization? How does it differ from type legalization?" a={"Type legalization: fix illegal TYPES (i8 on AArch64, i128 on 32-bit)\nOperation legalization: fix illegal OPERATIONS (ops the target doesn't support)\n\nExamples:\n• sdiv on Hexagon DSP (no hardware divider) → expand to __divsi3 library call\n• f16 arithmetic on targets without f16 support → promote to f32\n• v2f64 on SSE (only up to v2f64) → legal\n• popcount on old x86 without POPCNT → expand to bit-counting sequence"}/>
    <Q d="hard" q="What is a TableGen .td file and why does it matter for a backend?" a={"TableGen (.td) files define the target's instruction set, register file, and selection patterns in a declarative DSL. llvm-tblgen generates C++ from them.\n\nContents:\n• Register definitions (which registers exist, their classes, calling convention)\n• Instruction definitions (encoding, operands, assembly, scheduling info)\n• DAG selection patterns (map IR SDNodes to instructions)\n• Scheduling models (instruction latencies, issue widths, resource constraints)\n\nOn Hexagon:\n• HexagonInstrInfo.td defines all Hexagon instructions including VLIW packets\n• HexagonInstrInfoHVX.td defines 1024-bit HVX vector instructions\n• The packet scheduler reads Hexagon scheduling models to bundle instructions\n\nUnderstanding TableGen = understanding how to ADD new instructions or OPTIMIZE selection patterns."}/>
    <Q d="hard" q="What is DAG combining and why is it done after selection?" a={"Pre-selection DAG combining: target-independent optimizations on the instruction DAG before pattern matching. E.g., fold (add (shl X,1), X) → (mul X,3).\n\nPost-selection DAG combining (MachineCombiner): target-specific combinations on MachineInstrs. E.g., combine separate multiply+add into FMA, combine adjacent vector loads into wider loads.\n\nDone in two phases because: pre-selection has more context about intent (types, semantics), while post-selection has target knowledge (which instruction combinations exist). Both are needed for peak performance."}/>
    <Q d="medium" q="On a VLIW DSP like Hexagon, what does instruction selection have to do that an out-of-order ARM core handles in hardware?" a={"On a superscalar out-of-order core (Oryon/Kryo), the hardware dynamically finds independent instructions, renames registers, and issues several per cycle — the compiler just emits a good linear stream and the core extracts parallelism at runtime.\n\nA VLIW (Very Long Instruction Word) DSP like Hexagon has NO such hardware. Instructions are grouped into PACKETS of up to 4 that issue together in ONE cycle, and it's entirely the COMPILER's job to prove they're independent and bundle them. If the compiler can't find parallelism, the slots are filled with NOPs and you waste issue width every cycle.\n\nSo on Hexagon the backend must additionally:\n• PACKETIZE — bundle independent ops while respecting per-slot constraints (some operations can only go in certain slots; loads/stores, jumps, and HVX vector ops have placement rules).\n• Respect that there's no hardware hazard detection — the schedule it emits IS the execution order; a mistake is a wrong answer, not just slow.\n• Coordinate with register allocation, since some slots can only read certain register banks (HVX vector registers vs GPRs).\n\nThis is why 'the compiler IS the scheduler' on VLIW, and it is the single best thing to be able to explain for any DSP or accelerator backend role. The same independence analysis that hardware does for free on a big ARM core is a hard compile-time optimization problem on the DSP."} deep={{g:"10",t:"VLIW Backend Deep Dive"}}/>
    <Q d="hard" q="What is the difference between SelectionDAG's per-block scope and GlobalISel's whole-function scope, and why does it matter for code quality?" a={"SelectionDAG builds a fresh DAG for EACH basic block, selects it, then throws it away and moves to the next. That block-local horizon means it cannot reason across branches: a value computed in one block and used in another is handled by 'glue'/copies at block boundaries, and optimizations like cross-block redundancy elimination or sinking a computation to the block that needs it are out of reach during selection.\n\nGlobalISel works on Generic MIR for the WHOLE function at once (IRTranslator → Legalizer → RegBankSelect → InstructionSelect). Because the representation is real MachineInstrs spanning all blocks, it can make decisions with cross-block context, integrates better with the rest of the MIR pipeline, and avoids the expensive build-up/tear-down of DAGs per block (so it's much faster to compile — great at -O0).\n\nWhy SelectionDAG still wins at -O2: two decades of hand-written TableGen patterns and DAG-combine rules give it superior peak code quality on mature targets; GlobalISel is still closing that gap. The trade-off is compile speed and cross-block reasoning (GlobalISel) vs. battle-tested pattern coverage (SelectionDAG). Several targets default to GlobalISel at -O0 and SelectionDAG at -O2/-O3 for exactly this reason."}/>
  </S>
</div>
),

/* ── REGALLOC ── */
regalloc:()=>(
<div>
  <S title="1. The Register Allocation Problem">
    <P>After instruction selection, the code acts as if it has unlimited <em>virtual registers</em>. Real hardware is limited (e.g., ~31 general-purpose on AArch64). Regalloc maps virtual to physical registers, inserting spill/reload code to the stack when forced.</P>

    <Card title="Interference Graphs & Graph Coloring" color={tk.orange}>
      <ul style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>Live Interval:</strong> The span of instructions from a variable's definition to its final use.</li>
        <li><strong>Interference:</strong> If two variables overlap in liveness, they <strong>interfere</strong> and CANNOT be assigned the same physical register.</li>
        <li><strong>Graph Coloring:</strong> A classic compiler technique (Chaitin-Briggs). Imagine each variable is a node. Intersecting variables have edges between them. Try to color the graph using <code>K</code> colors (where K = physical registers). </li>
        <li><strong>Spill Cost:</strong> If uncolorable, one variable must be spilled to the stack. The allocator picks the one with the lowest cost (execution frequency × size).</li>
      </ul>
    </Card>
  </S>

  <S title="2. LLVM's Dynamic Greedy Allocator">
    <Card title="The Greedy Algorithm (LLVM Default)" color={tk.accent}>
      LLVM doesn't use pure graph coloring. It uses a highly tuned priority-queue driven greedy algorithm:
      <ol style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>Compute Live Intervals:</strong> Calculate exactly where every virtual register is alive.</li>
        <li><strong>Prioritize:</strong> Sort variables globally by spill weight (hotness/length).</li>
        <li><strong>Assign / Evict:</strong> Try to find a free physical register. If full, try to seamlessly evict a lower-priority variable back to the queue.</li>
        <li><strong>The Secret Weapon (Split):</strong> Instead of spilling a variable entirely, <strong>split</strong> its long live interval into smaller chunks. Smaller chunks have fewer interferences and can often be assigned successfully, drastically reducing spill traffic!</li>
      </ol>
    </Card>

    <G items={[
      {t:"Rematerialization", d:"Instead of spilling to RAM and reloading, simply RECOMPUTE the value if it's cheap (like an address load). Memory latency is hundreds of cycles, ALU latency is practically zero."},
      {t:"Coalescing", d:"If `%x = copy %y` and they don't interfere, assign them the SAME physical register. The copy vanishes completely. Critical for cleaning up SSA destruction."}
    ]} cols={2}/>

    <B type="interview">Regalloc is the most hardware-intensive optimization. On VLIW architectures like Hexagon, register allocation intimately intertwines with packet scheduling — some packets simply have hardware port constraints on which register banks they can read from. Mentioning this constraint shows elite domain knowledge.</B>
  </S>

  <S title="Register Allocation Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is a live interval?" a={"The range from a virtual register's definition to its last use. During this range, the value must be in a register (or spilled to stack).\n\nTwo live intervals INTERFERE if they overlap — they cannot be assigned the same physical register.\n\nLive intervals are computed by LiveIntervals analysis using liveness dataflow (backward: a variable is live if used before redefined)."}/>
    <Q d="easy" q="What is a register spill?" a={"When there aren't enough physical registers, the allocator must free one by storing its value to the stack (spill) and reloading it when needed again (reload).\n\nSpill overhead: 2 memory ops per spill/reload pair. In a hot loop: 2 × 4 bytes × million_iterations = significant.\n\nThe allocator minimizes spills by: choosing lowest-frequency variables to spill, using rematerialization when possible, splitting live intervals to reduce scope."}/>
    <Q d="medium" q="What is the difference between Chaitin-Briggs graph coloring and linear scan?" a={"Chaitin-Briggs (graph coloring):\n• Build interference graph (edge = two live ranges overlap)\n• K-color the graph (K = physical register count)\n• If uncolorable: spill lowest-priority node, retry\n• Better quality, O(n³) time\n\nLinear scan:\n• Sort live intervals by start point\n• Greedily assign registers; evict the interval ending latest when none free\n• O(n log n), simple, used in JIT compilers (LLVM JIT, V8, HotSpot)\n\nLLVM uses NEITHER as default: the Greedy allocator is priority-based with interval splitting — combines quality of graph coloring with flexibility of linear scan."}/>
    <Q d="medium" q="What is register coalescing?" a={"Copy elimination: if you have %x = copy %y (a register-to-register copy), and %x and %y don't interfere (don't overlap in liveness), assign them the SAME physical register. The copy instruction becomes a no-op and can be deleted.\n\nCrucial for performance: after SSA destruction, many phis become copies. Without coalescing: massive copy overhead. With coalescing: most copies vanish.\n\nLLVM's RegisterCoalescer pass runs early (before regalloc) and again post-regalloc."}/>
    <Q d="hard" q="Explain interval splitting in LLVM's greedy allocator." a={"When a long live interval can't be assigned (all registers busy), splitting divides it into shorter segments.\n\nExample: %a lives [1..100], used at points 1, 45, 90.\nSplit into [1..2], [45..46], [90..100].\n\nBetween segments, %a is stored to stack (spill) and reloaded (restore).\nBenefit: three short segments have fewer interferences than one long one. Each might find a free register. Net cost: 2 spill/restore pairs (less than one complete spill that requires reload at EVERY use).\n\nThe allocator chooses split points to minimize: number of spills × their execution frequency."}/>
    <Q d="hard" q="What are callee-saved vs caller-saved registers? How does the allocator use this?" a={"Caller-saved (scratch): caller must save before call if it wants to preserve them. Callee may freely clobber.\nCallee-saved (preserved): callee must save on entry and restore on exit if it uses them.\n\nAArch64: x0-x18 caller-saved, x19-x28 callee-saved.\n\nAllocator impact:\n• Short-lived values (used only before a call): prefer caller-saved → no save/restore needed\n• Long-lived values (span across calls): prefer callee-saved → guaranteed preserved, but callee pays prologue/epilogue cost\n\nFor a function that makes many calls, callee-saved registers allow keeping live values across calls without re-spilling. LLVM's regalloc uses register class ordering to prefer caller-saved for short intervals."}/>
    <Q d="hard" q="What is two-address form and why does it matter for regalloc?" a={"Some architectures (x86) have two-address instructions: the first source is also the destination.\nADD eax, ebx  means eax = eax + ebx. You can't use 3 different registers.\n\nLLVM handles this via the TwoAddressInstructionPass, which inserts copies:\n  BEFORE: %z = ADD %x, %y\n  AFTER:  %x_copy = COPY %x;  %z = ADD %x_copy, %y  (where %z tied to %x_copy)\n\nThen coalescing tries to eliminate the copy by merging %x_copy and %z if they don't interfere.\n\nAArch64 is 3-address (ADD Rd, Rn, Rm) — no such constraint. This is why x86 regalloc is harder."}/>
  </S>
</div>
),

/* ── OPTIMIZATIONS ── */
opts:()=>(
<div>
  <S title="1. Loop Optimizations — The Core of Performance">
    <G items={[
      {t:"Loop-Invariant Code Motion (LICM)", d:"Hoists computations outside loops. Requires 3 proofs: 1) Computation is loop-invariant, 2) No aliasing stores in loop body, 3) Dominates all loop exits (or is safe to speculate). LCSSA form makes the dominance check trivial."},
      {t:"Loop Unrolling", d:"Replicates loop body N times. Reduces branch overhead, exposes ILP, and enables SLP vectorization. Tradeoff: increased code size (i-cache pressure)."},
      {t:"Loop Interchange", d:"Swaps inner and outer loops to change access order (e.g., column-major to row-major). Transforms massive cache miss rates into sequential cache hits (10-100x speedup!)."},
      {t:"Loop Tiling (Blocking)", d:"Divides iteration space into cache-sized blocks. Crucial for matrix multiplication. Reduces L1 cache misses from O(N³) to O(N³/B)."},
      {t:"Loop Rotation", d:"Transforms `while(cond){body}` into `if(cond) do{body}while(cond)`. Saves one branch per iteration and creates a preheader essential for LICM."},
      {t:"Strength Reduction", d:"Replaces expensive ops inside loops (e.g., `i * 7`) with cheaper accumulator updates (`t += 7`). Powered by ScalarEvolution (SCEV)."}
    ]} cols={2}/>
  </S>

  <S title="2. Scalar Opts + LTO + PGO">
    <Card title="Global Value Numbering (GVN)" color={tk.cyan}>
      Assigns abstract "value numbers" to expressions. If two expressions have the same number (same opcode and operand numbers), they compute the same value → eliminate the redundant one.<br/>
      Also eliminates redundant loads via <strong>MemorySSA</strong>.
    </Card>
    <Card title="Sparse Conditional Constant Propagation (SCCP)" color={tk.amber}>
      Uses a Lattice (<code style={{color:tk.text}}>TOP → Constant → BOTTOM</code>). Traces executable paths. If a branch condition evaluates to a constant, the untaken path is marked DEAD, discovering even more constants down the line.
    </Card>
    
    <Diagram title="Whole Program Transformations" horizontal={false}>
      <Node label="Inlining" desc="'The Mother of all Optimizations'" color={tk.red} />
      <Arrow label="Exposes precise context to scalar passes" />
      <Node label="ThinLTO" desc="Parallel Link-Time Opt" color={tk.violet} />
      <Arrow label="Cross-module inlining & devirtualization" />
      <Node label="PGO (Profile Guided)" desc="Data-driven layout" color={tk.accent} />
    </Diagram>
  </S>

  <S title="Optimization Practice Questions" c={tk.amber}>
    <Q d="must" q="Explain SROA in detail. How does it handle structs?" a={"SROA (Scalar Replacement of Aggregates) shatters structs into individual SSA scalars.\n\nExample:\n  struct { int a, b; } s;\n  s.a = 10;\n  return s.a;\n\nLLVM initially creates an alloca for 's'. SROA sees that 'a' and 'b' are used independently. It replaces the struct alloca with two i32 allocas, then uses mem2reg-style logic to promote them to SSA registers. Result: `return 10;`. Without SROA, the struct would stay on the stack, causing slow memory stores and loads."}/>
    <Q d="must" q="Why does mem2reg fail if an address escapes?" a={"If the address of an alloca is passed to a function or stored in a global, it 'escapes'.\n\nMechanism: The compiler can no longer guarantee that nobody else is modifying that memory. If we promoted it to a register, a call to an external function wouldn't see the update (or the external function might change the memory while we're holding an old value in a register). Safety first: if it escapes, it stays in memory."}/>
    <Q d="easy" q="What is DCE and how is it trivial in SSA form?" a={"DCE (Dead Code Elimination) removes instructions whose results are never used.\n\nIn SSA form: each value has a use-list. If use-list is EMPTY → instruction is dead → delete. This is O(1) per instruction. ADCE (Aggressive DCE) goes further by assuming everything is dead unless proven live (side effects, returns)."}/>
    <Q d="medium" q="What is GVN vs CSE?" a={"CSE (Common Subexpression Elimination) is syntactic: if `a+b` appears twice, reuse the first. GVN (Global Value Numbering) is semantic: it assigns numbers to values. It can prove that `x*2` and `x<<1` are the same value number because they are algebraically equivalent, allowing more powerful redundancy elimination."}/>
    <Q d="hard" q="When is -O3 slower than -O2?" a={"1. Code Bloat: Aggressive inlining/unrolling spills the Instruction Cache (I-cache). If the hot path doesn't fit in L1, performance craters.\n2. Register Pressure: Large unrolled loops hold too many live values, causing 'spilling' to the stack.\n3. Speculation Overhead: Moving code before branches assuming they're taken; if wrong, you've wasted cycles on dead work."}/>
  </S>
  
  <B type="tip"><strong>Optimization Tip:</strong> In HFT, we often use <code>-O3 -march=native</code> but carefully monitor binary size using <code>nm --size-sort</code> to ensure critical loops aren't being bloated out of the Lcache.</B>
</div>
),

/* ── VECTORIZATION ── */
vec:()=>(
<div>
  <S title="1. SIMD Fundamentals">
    <Card title="Vectorization Factor (VF)" color={tk.accent}>
      <strong>VF = Register Width / Element Width</strong><br/><br/>
      • <strong>AVX2 (256-bit)</strong> + f32 (32-bit): VF = 8<br/>
      • <strong>AVX-512 (512-bit)</strong> + f32: VF = 16<br/>
      • <strong>ARM Neon (128-bit)</strong> + f32: VF = 4<br/>
      • <strong>Qualcomm HVX (1024-bit)</strong> + f32: <strong>VF = 32!</strong><br/><br/>
      <span style={{color:tk.textDim}}>Missing vectorization on Hexagon wastes 31 of 32 execution slots!</span>
    </Card>
  </S>

  <S title="2. Loop Vectorization — 5 Prerequisites">
    <G items={[
      {t:"1. Countable Trip Count", d:"SCEV must be able to compute loop bounds at compile time or execution time."},
      {t:"2. No Loop-Carried Dependencies", d:"Each iteration must be independent. Exceptions exist for recognized patterns like Reductions (sum/max)."},
      {t:"3. No Memory Aliasing", d:"Pointers must not overlap. Guaranteed via `restrict`, TBAA, or automatic runtime checks."},
      {t:"4. Vectorizable Operations", d:"All ops must have SIMD equivalents. No opaque function calls or unpredictable control flow."},
      {t:"5. Profitable Cost Model", d:"The TargetTransformInfo (TTI) must predict that SIMD throughput > scalar throughput + setup overhead."}
    ]} cols={2}/>
    
    <B type="tip">If all 5 hold, the loop is vectorized. The main loop unrolls by VF. A "Remainder Loop" cleans up the final iterations (`total % VF`), unless the ISA has Predicated Execution.</B>
  </S>

  <S title="3. Neon vs SVE vs HVX">
    <G items={[
      {t:"ARM Neon", d:"Fixed 128-bit. Widely deployed. Requires remainder loops for non-aligned iteration counts."},
      {t:"ARM SVE", d:"Scalable Vector Extension (128 to 2048-bit). Uses Predicate Registers (`p0-p15`). NO REMAINDER LOOP: the last iteration just masks out inactive lanes. Same binary runs on any width hardware!"},
      {t:"Qualcomm HVX", d:"Colossal 1024-bit VLIW vectors. Features hardware scatter/gather for irregular memory access. Compiler auto-vectorization is absolutely critical here."}
    ]} cols={3}/>
  </S>

  <S title="4. Debugging Vectorization">
    <Card title="Diagnostic Flags" color={tk.orange}>
      <code style={{color:tk.text}}>-Rpass=loop-vectorize</code> → Shows what succeeded<br/>
      <code style={{color:tk.text}}>-Rpass-missed=loop-vectorize</code> → Shows EXACTLY why it failed<br/>
      <code style={{color:tk.text}}>-Rpass-analysis=loop-vectorize</code> → Detailed cost model dumping
    </Card>
    <B type="interview"><strong>Aliasing failure?</strong> Add <code>__restrict__</code>. <strong>Dependency failure?</strong> Perform Loop Fission (split the independent parts out). <strong>Unknown trips?</strong> Rewrite <code>while(ptr!=end)</code> to <code>for(i=0;i&lt;n;i++)</code>.</B>
  </S>

  <S title="Vectorization Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is SIMD? Give the vectorization factors for common ISAs." a={"SIMD = Single Instruction Multiple Data. One instruction processes multiple data elements simultaneously.\n\nVectorization factors (VF = register_width / element_size):\n• SSE + f32: 128/32 = 4\n• AVX2 + f32: 256/32 = 8\n• AVX-512 + f32: 512/32 = 16\n• ARM Neon + f32: 128/32 = 4\n• ARM SVE + f32: 128-2048/32 = 4-64 (scalable!)\n• Qualcomm HVX + f32: 1024/32 = 32!"}/>
    <Q d="easy" q="What are the 5 prerequisites for loop vectorization?" a={"1. Countable trip count (SCEV can bound the loop)\n2. No loop-carried data dependencies (each iteration independent, or recognized reduction)\n3. No memory aliasing (prove or check at runtime that pointers don't overlap)\n4. Vectorizable operations (no opaque function calls blocking vectorization)\n5. Profitable cost model (VF must give speedup after amortizing overhead)\n\nAll 5 must hold. One failure blocks vectorization (or degrades VF)."}/>
    <Q d="medium" q="How does FP reduction vectorization work? Why does it need fast-math?" a={"sum = sum + a[i] appears to have a loop-carried dependency (sum depends on previous sum).\n\nWith fast-math (-ffast-math or -fno-associative-math=false): the vectorizer creates MULTIPLE partial sums in a vector register:\n  v_sum = v_sum + a[i:i+4]  // accumulate 4 partial sums in each lane\n  ...then horizontal add at end: sum = hadd(v_sum)\n\nThis changes the ORDER of FP additions. FP addition is NOT mathematically associative (rounding errors accumulate differently). The result may differ slightly from scalar.\n\nThis is why fast-math is required: it authorizes the compiler to reorder FP operations, giving up exact reproducibility for performance."}/>
    <Q d="medium" q="How do you debug a vectorization failure?" a={"Step 1: -Rpass-missed=loop-vectorize shows the reason. Common reasons:\n  'loop not vectorized: unsafe dependent memory operations' → aliasing\n  'loop not vectorized: couldn't identify induction variable' → trip count unknown\n  'loop not vectorized: instruction cannot be vectorized' → non-vectorizable op\n  'loop not vectorized: value that could not be identified as reduction' → unknown dep\n\nStep 2: Fix based on reason:\n  Aliasing → add restrict keyword or __builtin_assume_aligned\n  Trip count → restructure loop or add hint\n  Non-vectorizable op → loop fission to isolate it\n  Unknown dep → verify it's actually safe, add pragma if so"}/>
    <Q d="hard" q="Why does SVE not need a remainder loop? How do predicates work?" a={"SVE uses predicate registers (p0-p15) with one bit per element lane. When the main loop's last iteration has fewer than VF elements, the predicate masks the inactive lanes.\n\nwhilelt p0.s, x9, x0   // p0.lane[k] = 1 if x9+k < x0 (index < n)\n\nIn the last iteration, x9+k might exceed n for some k. Those lanes get predicate bit = 0 → those lanes don't load, don't compute, don't store. No additional scalar loop needed.\n\nSame binary runs on SVE-128 (4×f32 per cycle), SVE-512 (16×f32), or SVE-2048 (64×f32). The hardware reads cntw to know its own width. This is why SVE is the future: write once, auto-adapt."}/>
    <Q d="hard" q="What is SLP vectorization and how does it differ from loop vectorization?" a={"SLP (Superword-Level Parallelism) vectorizes straight-line code, not loops.\n\nExample:\n  a[0] = b[0] + c[0];  // 4 scalar ops...\n  a[1] = b[1] + c[1];\n  a[2] = b[2] + c[2];\n  a[3] = b[3] + c[3];\n\nSLP bundles these into one vector ADD: va = vb + vc.\n\nThis typically appears AFTER loop unrolling (which replicates the body), enabling SLPVectorize to then bundle the replicated scalar ops.\n\nSLP is also key for struct-of-arrays patterns and SIMD codegen from C++ with explicit vectorizable expressions."}/>
    <Q d="hard" q="What is HVX scatter/gather and why does it matter for compilers?" a={"Scatter: write a[indices[i]] = values[i] — indices are non-contiguous.\nGather: read values[i] = a[indices[i]] — non-contiguous reads.\n\nTraditional SIMD (SSE/AVX without AVX-512): gather/scatter are very expensive (software loop or expensive intrinsics).\n\nHVX: dedicated hardware scatter/gather instructions in Q7 HVX. Multiple non-contiguous reads/writes per cycle.\n\nCompiler implication: the vectorizer can now profitably vectorize loops with non-unit-stride access patterns on Hexagon, where the same loop would remain scalar on other architectures. The TTI cost model for Hexagon must accurately reflect HVX scatter/gather costs to make correct vectorization decisions."}/>
  </S>
</div>
),

/* ── DATAFLOW ── */
dataflow:()=>(
<div>
  <S title="1. Dataflow Analysis Framework">
    <P>Dataflow analysis propagates structured facts through the CFG until convergence (fixpoint) is reached. All classic analyses follow a 4-part theoretical framework:</P>
    
    <Diagram title="The 4 Framework Components" horizontal={false}>
      <Node label="1. Direction" desc="Forward (Entry→Exit) or Backward" />
      <Node label="2. Lattice" desc="The set of facts being tracked" />
      <Node label="3. Transfer Function" desc="How instructions mutate facts (Gen/Kill)" />
      <Node label="4. Meet Operator" desc="How paths combine (Union or Intersect)" />
    </Diagram>

    <G items={[
      {t:"Reaching Definitions", d:"FORWARD, UNION (May). 'Which defs MIGHT reach here?'"},
      {t:"Liveness Analysis", d:"BACKWARD, UNION (May). 'Is this variable read before overwriting?' Critical for register allocation."},
      {t:"Available Expressions", d:"FORWARD, INTERSECT (Must). 'Is b+c already computed on ALL paths to this point?'"},
      {t:"Very Busy Expressions", d:"BACKWARD, INTERSECT (Must). 'Is this expression evaluated on ALL paths from this point?'"}
    ]} cols={2}/>
  </S>

  <S title="2. SSA Simplifies (and Replaces) Many Analyses">
    <Card title="How Static Single Assignment Changes the Game" color={tk.violet}>
      <ul style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>Reaching Definitions is ELIMINATED:</strong> In SSA, every use has exactly ONE definition. You don't need analysis, just follow the C++ <code>Value::getDef()</code> pointer.</li>
        <li><strong>Available Expressions becomes GVN:</strong> Replaced by Global Value Numbering hashes.</li>
        <li><strong>Liveness is STILL REQUIRED:</strong> SSA doesn't negate the need to know when variables die (for register allocation). We still compute backwards liveness on virtual registers.</li>
        <li><strong>Sparse vs Dense:</strong> Traditional dataflow visits every node blindly. SSA dataflow is <em>Sparse</em> — updates propagate instantly across Def→Use edges!</li>
      </ul>
    </Card>
  </S>

  <S title="Dataflow Practice Questions" c={tk.amber}>
    <Q d="easy" q="What are the four components of a dataflow analysis?" a={"(1) Direction: Forward (entry→exit) or Backward (exit→entry)\n(2) Lattice: the set of possible facts (sets of definitions, expressions, variables)\n(3) Transfer function: how each instruction modifies the facts (gen/kill for sets)\n(4) Meet operator: how facts from multiple paths combine (∪ for may, ∩ for must)"}/>
    <Q d="easy" q="What is liveness analysis? Why is it backward?" a={"A variable is LIVE at a point if its current value WILL BE USED before being overwritten on some path.\n\nBackward because liveness flows from uses back to definitions: a USE makes a variable live, a DEFINITION kills it. Information flows opposite to execution direction.\n\nUsed for: register allocation (variables live at same point → interfere → different register), dead store elimination (store to a non-live variable is dead)."}/>
    <Q d="medium" q="What is the difference between may and must analysis? Give examples." a={"MAY (union at join): fact holds on AT LEAST ONE path.\n• Reaching definitions: a definition 'reaches' a point if there EXISTS a path from definition to that point with no intervening redefinition.\n• Used for safety: 'this pointer MIGHT be null' → must check.\n\nMUST (intersection at join): fact holds on ALL paths.\n• Available expressions: 'b+c is available' means it's computed on EVERY path to this point with no operand modified.\n• Used for optimization: 'b+c definitely computed → eliminate recomputation.'\n\nBoth are CONSERVATIVE: may is conservative for safety (over-approximates danger), must is conservative for optimization (under-approximates opportunity)."}/>
    <Q d="medium" q="Why does dataflow analysis always terminate? Prove the key property." a={"Termination requires a FINITE lattice height and a MONOTONE transfer function.\n\nFinite lattice height: the lattice has no infinite ascending/descending chains. For a set lattice over N variables: ∅ ⊆ ... ⊆ full set. Height N.\n\nMonotone transfer function: once a fact enters the lattice element at a node, it can only move 'up' (toward ⊤ for ∪, toward ⊥ for ∩). Information never decreases.\n\nConsequence: each dataflow fact at each program point can change at most N times → total iterations bounded → termination.\n\nPractical: for most programs, 2-3 iterations suffice because dataflow 'flows fast' and real programs have shallow nesting depths."}/>
    <Q d="hard" q="How does SCCP use dataflow? What makes it more powerful than simple CP?" a={"SCCP (Sparse Conditional Constant Propagation) is a hybrid: constant propagation + dead branch elimination + sparse SSA propagation.\n\n1. LATTICE per value: TOP (not analyzed) → constant(c) → BOTTOM (non-constant)\n2. CONTROL FLOW LATTICE: each edge is EXECUTABLE or NOT\n3. Worklists: separate SSA worklist and CFG worklist\n\nAlgorithm:\n• Initially: entry edge executable, all values TOP\n• When edge becomes executable: evaluate transfer functions in target block\n• If result changes → propagate to uses\n• If branch condition known constant: only mark one successor executable\n\nPower: if a branch leads to dead code, values in dead code never affect the main computation. This lets SCCP discover more constants that simple CP (which propagates through dead branches) misses."}/>
  </S>
</div>
),

/* ── ALIAS ANALYSIS ── */
alias:()=>(
<div>
  <S title="1. The Alias Analysis Problem">
    <P>Alias analysis is the gatekeeper of all memory optimizations. <em>Can these two pointers refer to the same location?</em> If we don't know, we must assume they do, which immediately paralyzes instruction reordering, hoisting, and vectorization.</P>
    
    <G items={[
      {t:"NoAlias", d:"Definitely different locations. Optimizer has full freedom."},
      {t:"MayAlias", d:"Could overlap. Optimizer must conservatively serialize access."},
      {t:"MustAlias", d:"Definitely identical. Enables load forwarding / DSE."},
      {t:"PartialAlias", d:"Overlapping bytes but not exactly equal (e.g., struct fields vs whole struct)."}
    ]} cols={2}/>

    <B type="danger"><strong>Vectorization blocker:</strong> `void scale(float* a, float* b)` cannot be unconditionally vectorized, because `a[i]` and `b[i-1]` might overlap constraint. Fix: Use <code>__restrict__</code> to promise NoAlias, or rely on LLVM inserting runtime boundary checks.</B>
  </S>

  <S title="2. LLVM Alias Analysis Layers">
    <Diagram title="The AAResults Chain" horizontal={false}>
      <Node label="BasicAA" desc="Allocas, explicit GEP offsets, noalias args" color={tk.teal}/>
      <Arrow />
      <Node label="TBAA" desc="Strict C Aliasing (int* != float*)" color={tk.cyan}/>
      <Arrow />
      <Node label="GlobalsAA" desc="Static globals without address taken" color={tk.blue}/>
      <Arrow />
      <Node label="SCEV-AA" desc="Loop strides (|i-j| ≥ 1 => NoAlias)" color={tk.violet}/>
    </Diagram>

    <Card title="TBAA and the Strict Aliasing Rule" color={tk.amber}>
      Standard C++ says pointers to fundamentally different types cannot point to the same location (excluding <code>char*</code>).<br/>
      LLVM encodes this as metadata: <code style={{color:tk.text}}>!tbaa</code>.<br/>
      <hr style={{borderColor:tk.border, margin:"8px 0"}}/>
      Compiling with <code>-fno-strict-aliasing</code> strips this metadata, dropping everything back to <strong>MayAlias</strong>, which can cost 10-30% performance.
    </Card>
  </S>

  <S title="Alias Analysis Practice Questions" c={tk.amber}>
    <Q d="easy" q="What are the four possible results of an alias query?" a={"NoAlias: definitely different memory locations. Optimizer can reorder freely.\nMayAlias: unknown/possibly same. Conservatively assume they alias.\nMustAlias: definitely the same location. Useful for some optimizations.\nPartialAlias: overlapping but not identical (e.g., loading from offset within another load's range)."}/>
    <Q d="medium" q="What is the strict aliasing rule and how does TBAA implement it in LLVM?" a={"C strict aliasing: pointers to incompatible types cannot legally point to the same memory (with exception for char* and std::byte*). float* and int* CANNOT alias.\n\nLLVM implements this via !tbaa metadata attached to load/store instructions:\n  store float %v, ptr %p, !tbaa !{!\"float\", !omnipotent_char, ...}\n  load i32, ptr %q, !tbaa !{!\"int\", !omnipotent_char, ...}\n  → Different TBAA tags → NoAlias between these two accesses.\n\n-fno-strict-aliasing: removes all TBAA metadata → all memory ops MayAlias with all → 10-30% slower. Use when your code intentionally breaks aliasing rules (e.g., type punning via pointer casts)."}/>
    <Q d="hard" q="How does SCEV-AA enable vectorization of a loop with index arithmetic?" a={"For a loop like: for(int i=0; i<n; i++) a[i+K] = a[i] + 1; (where K is a loop-invariant constant)\n\nSCEV-AA queries: do a[i+K] (write) and a[j] (read) alias for any i,j in [0,n)?\n\nSCEV represents: write address = base + (i+K) * stride, read address = base + j * stride.\nIf K >= n: no read address can equal any write address → NoAlias → vectorizable!\nIf K < n: MayAlias → not safely vectorizable (or need runtime check).\n\nThis is how LLVM decides whether stencil computations can be vectorized. Without SCEV-AA, all a[i+K] writes MayAlias all a[j] reads."}/>
    <Q d="hard" q="What exactly does __restrict promise, and what is the cost of lying to the compiler?" a={"__restrict (C99 'restrict', non-standard but universal in C++) is a promise to the optimizer: 'for the lifetime of this pointer, the object it points to is accessed ONLY through this pointer (or pointers derived from it).' It is a NoAlias assertion that the compiler trusts without proof.\n\nWhat it unlocks:\n• The classic memcpy-style loop can be vectorized with NO runtime overlap check (LLVM otherwise emits a runtime 'do these ranges overlap?' branch and TWO loop versions — a vectorized one and a scalar fallback).\n• Loads can be hoisted out of loops and reused instead of re-read after every store through another pointer.\n\nThe danger: it's an UNCHECKED contract. If two restrict pointers actually DO overlap, you get undefined behavior — the compiler may keep a stale value in a register, reorder a store past a dependent load, or vectorize a loop that has a real loop-carried dependence, silently producing wrong results that only show up at -O2.\n\nNote on C++ references: a T& does NOT imply noalias. People assume references can't alias — they can. Only restrict (or a proven NoAlias from BasicAA/TBAA/SCEV) gives the optimizer that freedom."} deep={{g:"02",t:"Optimization Passes"}} code={`// Without restrict: compiler emits an overlap check + 2 loop versions
void add(float* a, float* b, float* c, int n) {
  for (int i = 0; i < n; ++i) c[i] = a[i] + b[i];
}
// With restrict: single vectorized loop, no runtime guard
void add(float* __restrict a, float* __restrict b,
         float* __restrict c, int n) {
  for (int i = 0; i < n; ++i) c[i] = a[i] + b[i];
}`}/>
  </S>
</div>
),

/* ── C++ OBJECT MODEL ── */
cpp_obj:()=>(
<div>
  <S title="1. Object Layout & vtable Architecture">
    <Card title="The Hidden Cost of Polymorphism" color={tk.violet}>
      Polymorphic classes start with an 8-byte <code>vptr</code> pointing to a <code>vtable</code> in <code>.rodata</code>. Every instance of the class shares the same vtable. The vtable contains exactly: <code>[offset-to-top, RTTI*, function pointers...]</code>.
    </Card>

    <Diagram title="vtable Memory Layout" horizontal={true}>
      <Node label="Animal Instance" sub="vptr | age | weight" color={tk.teal} />
      <Arrow label="points to" />
      <Node label="Animal vtable (in .rodata)" sub="RTTI | &Animal::speak | &Animal::eat" color={tk.orange} />
    </Diagram>
    
    <G items={[
      {t:"No Virtuals (Flat)", d:"`class Point { int x; int y; };` Layout: [x:4B][y:4B] = 8B. Absolutely zero overhead. No vptr. Trivial to copy and move."},
      {t:"Alignment & Padding", d:"Members align to their size. `char, int, char` wastes 4B padding. `int, char, char` is fully packed. Always order members largest to smallest!"},
      {t:"Multiple Inheritance", d:"`class Duck : Flyable, Swimmable` → gets TWO vptrs and two vtables. Casting to `Swimmable*` adds an offset to `this`. Method calls use a Thunk (asm trampoline)."}
    ]} cols={3}/>
  </S>

  <S title="2. The 4 Casts & Strict Aliasing">
    <G items={[
      {t:"static_cast", d:"Compile-time pointer arithmetic for known hierarchies. ZERO runtime overhead. UB if actual type is wrong."},
      {t:"dynamic_cast", d:"Walks the RTTI (type_info) tree. Safe but slow (~100ns). Returns nullptr or throws std::bad_cast on mismatch."},
      {t:"const_cast", d:"ZERO assembly overhead. Strips const/volatile. UB if used to write to memory originally declared const."},
      {t:"reinterpret_cast", d:"ZERO assembly. Blind bitwise reinterpretation. Breaks Strict Aliasing rules (TBAA) and causes UB."}
    ]} cols={2}/>
    
    <Card title="Strict Aliasing & Type Punning" color={tk.rose}>
      <strong>Strict Aliasing Rule:</strong> Pointers to different types cannot alias (except <code>char*</code>). If broken via <code>reinterpret_cast</code>, the compiler will aggressively optimize assuming they don't point to the same memory!<br/><br/>
      <em>Correct way to type-pun:</em> Use <code>std::memcpy</code> or C++20 <code>std::bit_cast</code>. The compiler will optimize away the copy completely into a register move.
    </Card>
  </S>

  <S title="3. The Virtual Destructor Rule & Devirtualization">
    <B type="danger"><strong>CRITICAL:</strong> If a class has ANY virtual function, or if it will ever be deleted via a Base pointer, its destructor MUST be virtual. Otherwise, `delete basePtr;` will ONLY call `~Base()`, leaking all resources held by the Derived class.</B>
    
    <Card title="Devirtualization" color={tk.cyan}>
      Replacing a virtual call (vtable dispatch ~15ns) with a direct call (~1ns). Enabled when the compiler can prove the exact type (e.g., local stack variable <code>Base b;</code>, or marked as <code>final</code> class/method). Enabling LTO (Link-Time Optimization) heavily boosts whole-program devirtualization.
    </Card>
  </S>

  <S title="Object Model Practice Questions" c={tk.amber}>
    <Q d="must" q="What happens when you call a virtual function from inside a constructor or destructor?" a={"It does NOT dispatch to the derived override — it calls the version for the class currently being constructed/destroyed.\n\nReason: during Base's constructor, the vptr still points to Base's vtable (the derived part doesn't exist yet — it's constructed AFTER the base). The vptr is rewritten to point at each class's vtable as construction proceeds up the hierarchy, and unwound in reverse during destruction.\n\nConsequence: a virtual call in Base() that the derived class overrides will run Base's implementation, not Derived's. Worse: a PURE virtual call from a constructor is UB (often a runtime 'pure virtual method called' abort).\n\nInterview line: 'The object isn't fully formed yet, so C++ deliberately disables dynamic dispatch to the not-yet-constructed derived layer. Never rely on virtual dispatch in ctors/dtors.'"} code={`struct Base {
  Base()         { init(); }          // calls Base::init, NOT Derived::init
  virtual void init() { puts("Base"); }
};
struct Derived : Base {
  void init() override { puts("Derived"); }
};
// Derived d;  ->  prints "Base"`}/>
    <Q d="hard" q="How does dynamic_cast actually work, and why is it ~100ns?" a={"dynamic_cast<Derived*>(basePtr) walks the RTTI graph reachable from the object's vtable.\n\nMechanics:\n1. Load the vptr from the object → reach the vtable.\n2. Just ABOVE the function-pointer array sits a pointer to the std::type_info (the __class_type_info in the Itanium ABI).\n3. The runtime (__dynamic_cast) traverses the inheritance DAG comparing type_info nodes, applying offset adjustments for each base sub-object it crosses.\n\nWhy slow: it's a pointer-chasing tree walk through .rodata (cache misses), not a single comparison. Multiple/virtual inheritance makes the graph bigger. Cross-casts and virtual bases are the worst case.\n\nFaster alternatives: a virtual kind() method returning an enum, static_cast when the type is known, or a visitor pattern. dynamic_cast is correctness insurance, not a hot-path tool."}/>
    <Q d="hard" q="What is the Empty Base Optimization (EBO) and why does it matter?" a={"A C++ object must have size ≥ 1 byte so distinct objects get distinct addresses. But a base CLASS sub-object is exempt: if a base is empty (no non-static data members), the compiler may give it ZERO size when embedded in a derived class.\n\nWhy it matters: stateless policy/allocator/comparator types are everywhere in the STL. std::vector storing an empty allocator, or a tuple/compressed_pair of (T, empty_deleter), pays no size penalty thanks to EBO.\n\nWithout EBO: struct Foo { EmptyAllocator a; int x; }; would be 8 bytes (1 for a + 3 padding + 4 for x). With EBO via inheritance, a contributes 0 → Foo is 4 bytes.\n\nC++20 added [[no_unique_address]] so you get the same saving for a MEMBER without needing inheritance. This is how libc++/libstdc++ implement compressed pairs."}/>
    <Q d="medium" q="What is object slicing and how do you prevent it?" a={"Slicing: assigning or copying a Derived object into a Base-typed VALUE drops ('slices off') the derived part — only the Base sub-object is copied, and the vptr becomes Base's.\n\nBase b = derived;  // copies only the Base portion; b.virtualCall() -> Base version\nvoid f(Base b);    // pass-by-value slices the argument\n\nIt's silent and compiles cleanly, which is what makes it dangerous (polymorphism is lost).\n\nPrevention:\n1. Pass/store polymorphic types by reference or pointer (Base&, Base*, smart pointers), never by value.\n2. Make the base non-copyable (delete copy ctor/assignment) and use a virtual clone() for deep copies.\n3. C++ containers of polymorphic objects must hold pointers (vector<unique_ptr<Base>>), not values."}/>
    <Q d="medium" q="In multiple inheritance, what are 'offset-to-top' and a thunk?" a={"A class with multiple bases has multiple sub-objects laid out sequentially, each with its own vptr. Casting a Derived* to the SECOND base's pointer adds a non-zero offset to 'this'.\n\noffset-to-top: a field stored at the head of each vtable giving the distance from this sub-object back to the start of the complete (most-derived) object. dynamic_cast and delete (which needs the full object's address) use it.\n\nthunk: when you call a virtual function through the second base's pointer, the entry in that base's vtable doesn't point straight at the override. It points at a tiny trampoline that first does 'this -= offset' to recover the full-object pointer, then jumps to the real implementation. That adjustment stub is the thunk.\n\nNet effect: virtual dispatch through a secondary base costs one extra pointer adjustment. Single inheritance has zero thunks."}/>
  </S>
</div>
),

/* ── C++ TEMPLATES ── */
cpp_tpl:()=>(
<div>
  <S title="1. Template Instantiation & SFINAE">
    <Card title="The Code Bloat Risk" color={tk.orange}>
      Templates are not code, they are <em>blueprints</em>. <code>std::vector&lt;int&gt;</code> and <code>std::vector&lt;float&gt;</code> generate completely separate machine code. 50 template parameter types = 50 copies of the function in the binary. This destroys the instruction cache.<br/><br/>
      <strong>Mitigation:</strong> Use <code>extern template class ...</code> to explicitly tell the compiler the instantiation exists in another Translation Unit (TU), vastly speeding up compile times and linking.
    </Card>

    <G items={[
      {t:"SFINAE", d:"Substitution Failure Is Not An Error. If substituting template args creates invalid C++ in the IMMEDIATE CONTEXT (return type/params), the compiler silently drops the overload."},
      {t:"C++17 `if constexpr`", d:"Evaluated at compile time. The discarded branch is physically NOT instantiated. Massively cleaner than SFINAE. Useful for deep metaprogramming."},
      {t:"C++20 Concepts", d:"Replaces SFINAE entirely with logical constraints: `template <typename T> requires std::integral<T>`. Superior compile times and heavily readable error messages."}
    ]} cols={3}/>
  </S>

  <S title="2. CRTP & Compile-Time Polymorphism">
    <Diagram title="CRTP Pattern" horizontal={true}>
      <Node label="Base<Derived>" sub="template" color={tk.teal} />
      <Arrow label="static_cast" />
      <Node label="Derived" sub="implements method()" color={tk.violet} />
    </Diagram>
    
    <Card title="Why LLVM uses CRTP Everywhere" color={tk.blue}>
      <code>struct Derived : Base&lt;Derived&gt;</code> allows the Base class to call Derived methods via <code>static_cast&lt;Derived*&gt;(this)-&gt;method()</code>.<br/><br/>
      This achieves <strong>Static Polymorphism</strong>. It provides interface enforcement and mixin behaviors with ZERO vtable overhead. Used extensively throughout LLVM (e.g., <code>InstVisitor</code>, <code>PassInfoMixin</code>) because vtable dispatches inside hot compiler passes are too slow.
    </Card>
    
    <G items={[
      {t:"Type Traits (`<type_traits>`)", d:"Compile-time introspection. `std::is_trivially_copyable<T>` optimizes containers to use `memcpy` instead of loops."},
      {t:"constexpr vs consteval", d:"`constexpr` functions MAY execute at compile time. `consteval` (C++20) MUST execute at compile time or fail to compile."},
      {t:"Fold Expressions", d:"C++17: `(... + args)` applies the operator to a variadic template pack automatically. Replaces recursive templates."}
    ]} cols={3}/>
  </S>

  <S title="Templates & Metaprogramming Practice Questions" c={tk.amber}>
    <Q d="medium" q="What is the difference between SFINAE, if constexpr, and Concepts? When do you reach for each?" a={"All three pick behavior based on a type, but they operate at different levels:\n\nSFINAE (C++98+): controls OVERLOAD SET MEMBERSHIP. A substitution failure in a function's signature (template args, return type, default args — the 'immediate context') silently removes that overload instead of erroring. Used via std::enable_if_t<cond, T>. Powerful but produces unreadable errors and bloats overload sets.\n\nif constexpr (C++17): controls BRANCHES INSIDE ONE function. The false branch is not instantiated, so you can have type-dependent code in a single body without separate overloads. Replaces most tag-dispatch and a lot of SFINAE.\n\nConcepts (C++20): named, composable CONSTRAINTS on template parameters (template<std::integral T> or requires-clauses). They do what SFINAE did but readably, give first-class error messages ('constraint not satisfied'), and participate in overload resolution with subsumption (more-constrained wins).\n\nReach order today: Concepts to constrain an interface → if constexpr to branch within an implementation → SFINAE only when maintaining pre-C++20 code."}/>
    <Q d="hard" q="CRTP vs virtual functions: what's the real trade-off, and where does CRTP break down?" a={"CRTP (Curiously Recurring Template Pattern): Derived inherits from Base<Derived>, so Base can call static_cast<Derived*>(this)->impl() and bind to the override at COMPILE time.\n\nWins vs virtual:\n• Zero vtable: no vptr in the object (saves 8 bytes), no indirect call (~1ns vs ~15ns dispatch), and the call is INLINEABLE — the optimizer can see through it, which virtual dispatch usually blocks. This is why LLVM uses it in hot passes (InstVisitor, PassInfoMixin) and HFT uses it on the tick path.\n\nWhere it breaks down:\n1. No runtime polymorphism. Base<Derived> for different Deriveds are UNRELATED types — you cannot store them in one container (no vector<Base*>) or choose the type at runtime. If the concrete type is only known at runtime, you need virtual (or std::variant for a closed set).\n2. Code bloat: each Derived instantiates its own copy of Base's code (icache cost), the opposite of a shared vtable.\n3. Interface is duck-typed: if Derived forgets impl(), you get a deep template error, not a clean 'missing override'.\n\nSummary: CRTP = static polymorphism (compile-time known type, speed); virtual = dynamic polymorphism (runtime-chosen type, flexibility, heterogeneous containers)."}/>
    <Q d="medium" q="Why do templates cause code bloat, and how do you control it?" a={"A template is a blueprint, not code. Each distinct set of template arguments triggers a separate INSTANTIATION — vector<int> and vector<float> compile to entirely separate machine code. N type arguments → up to N copies of every member function in the binary, which bloats .text and thrashes the instruction cache.\n\nControls:\n1. extern template (C++11): 'extern template class std::vector<int>;' in headers + one explicit instantiation in a .cpp tells every other TU not to instantiate — cuts compile time and duplicate code.\n2. Type-erase the cold parts: factor type-independent logic into a non-template base or a function taking void*/std::span, and keep only a thin typed wrapper templated. (How std::function and many PIMPL designs limit bloat.)\n3. Hoist type-independent code out of the template body so it isn't duplicated per instantiation.\n4. Prefer if constexpr over many small overloads when it reduces the number of distinct symbols.\n\nThe linker DOES de-duplicate identical template instantiations across TUs (COMDAT folding / ICF at link time), so the bloat is mostly about DISTINCT instantiations and compile time, not naive per-TU duplication."}/>
  </S>
</div>
),

/* ── C++ MEMORY & MOVE ── */
cpp_mem:()=>(
<div>
  <S title="1. Smart Pointers — The Architecture of Ownership">
    <G items={[
      {t:"unique_ptr<T>", d:"Zero-overhead (8 bytes). Singular ownership. Memory freed exactly when the scope ends. Replaces manual `delete`. Non-copyable, only movable."},
      {t:"shared_ptr<T>", d:"16 bytes: [T* ptr | ControlBlock*]. Reference-counted ownership. Control block is heap-allocated and atomic. Flexible but has overhead."},
      {t:"weak_ptr<T>", d:"No ownership. Observes a `shared_ptr` without incrementing strong-ref. used to break reference cycles and check if an object is still alive via `.lock()`."}
    ]} cols={3}/>

    <Diagram title="shared_ptr Control Block Layout" horizontal={true}>
      <Node label="shared_ptr Instance" sub="[T* ptr][CB*]" color={tk.teal} />
      <Arrow label="points to" />
      <Node label="Control Block (Heap)" sub="strong_cnt | weak_cnt | deleter | alloc" color={tk.orange} />
    </Diagram>

    <Card title="make_shared<T> vs shared_ptr<new T>" color={tk.blue}>
      <strong>make_shared:</strong> Performs ONE allocation for both the control block and the object. Better cache locality and exception-safe.<br/>
      <strong>shared_ptr(new T):</strong> Two separate allocations. Slower. Control block can be freed while object stays in memory (if weak_ptrs exist).
    </Card>
  </S>

  <S title="2. Move Semantics & Value Categories">
    <G items={[
      {t:"Lvalue", d:"Has identity (name), can take address. Persistent variable."},
      {t:"PRvalue", d:"No identity, temporary object. Dies at the end of statement."},
      {t:"Xvalue", d:"Identity + marked for move (e.g. `std::move(x)`)."}
    ]} cols={3}/>

    <Card title="The Move Constructor" color={tk.violet}>
      <code style={{color:tk.textBright}}>Buffer(Buffer&& o) noexcept : data(o.data) {"{"} o.data = nullptr; {"}"}</code><br/><br/>
      Must be <strong>noexcept</strong> for <code>std::vector</code> to use move instead of copy during reallocation. Assembly is just 3-4 register moves (O(1)) vs O(N) for deep copy.
    </Card>

    <Card title="RVO vs NRVO (Return Value Optimization)" color={tk.rose}>
      <strong>RVO (C++17 Mandatory):</strong> Direct construction in the caller's stack slot for prvalues. Zero copies or moves.<br/>
      <strong>NRVO (Named):</strong> Same for local variables. <em>Pro-Tip:</em> NEVER <code>return std::move(x);</code> — it disables NRVO and forces a slower move!
    </Card>
  </S>

  <S title="3. RAII & Custom Deleters">
    <G items={[
      {t:"RAII Pattern", d:"Constructor ACQUIRES, Destructor RELEASES. Foundation of exception-safe C++."},
      {t:"Perfect Forwarding", d:"`std::forward<T>(arg)` preserves lvalue/rvalue-ness of template arguments. Essential for factory functions like `make_unique`."},
      {t:"Custom Deleters", d:"`unique_ptr` deleters are part of the type (EBO → zero cost). `shared_ptr` deleters are type-erased (stored in control block)."}
    ]} cols={3}/>
  </S>

  <S title="Memory & Move Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is RAII? Give three examples." a={"RAII (Resource Acquisition Is Initialization): resource lifetime tied to object lifetime. Constructor acquires, destructor releases. Even during stack unwinding from exceptions.\n\nExamples:\n1. unique_ptr<T>: destructor calls delete. Manages heap memory.\n2. std::lock_guard<mutex>: destructor calls unlock(). Manages mutex ownership.\n3. std::fstream: destructor calls fclose(). Manages file handle.\n\nReason RAII is fundamental: in C++, exceptions can skip goto-style cleanup code. RAII guarantees cleanup via destructors, which always run on stack unwind."}/>
    <Q d="easy" q="What does std::move ACTUALLY do? What doesn't it do?" a={"std::move is JUST a cast to T&&. It does NOTHING at runtime by itself.\n\nstd::move(x) = static_cast<T&&>(x)\n\nThe actual 'moving' happens in the MOVE CONSTRUCTOR/ASSIGNMENT that receives the T&& argument — that code steals the resources and nullifies the source.\n\nAfter std::move(x): x is in a 'valid but unspecified' state. Can be destroyed or reassigned. Cannot be used in any other way safely (the value was stolen)."}/>
    <Q d="medium" q="make_shared vs unique_ptr then convert to shared_ptr — what's the difference?" a={"make_shared<T>(args): ONE allocation for control block + T object together.\n  Pros: faster (one malloc), better cache locality (obj+refcount adjacent), exception-safe.\n  Con: object memory not freed until last weak_ptr dies (shares block with control).\n\nshared_ptr<T>(new T): TWO allocations. Control block separate from T.\n  Pro: object freed when strong_count hits 0 (even if weak_ptrs exist).\n  Con: two allocations, worse cache, exception-unsafe (new T might succeed but control block alloc fails → leak).\n\nIn practice: almost always prefer make_shared."}/>
    <Q d="medium" q="Why must move constructors be noexcept for vector efficiency?" a={"std::vector grows by reallocating and moving (or copying) elements to a new buffer.\n\nWith noexcept move ctor: vector reallocation MOVES elements. Fast, O(n) pointer operations.\nWithout noexcept: vector must COPY elements during reallocation.\n\nWhy? If the move throws midway, the original buffer is partially destroyed → unrecoverable state. But if we copy, the original buffer is intact → can roll back → strong exception guarantee maintained.\n\nstd::move_if_noexcept does this check. Make ALL your move constructors noexcept."}/>
    <Q d="hard" q="What is RVO vs NRVO? When does NRVO fail?" a={"RVO (prvalue): when a function returns a prvalue (temporary), C++17 guarantees the object is constructed directly in the caller's return slot. Zero copies. MANDATORY since C++17.\n\nNRVO (named): when a function returns a named local variable via a single return path, the compiler may construct it directly in the caller's return slot. Not guaranteed, but universally implemented.\n\nNRVO FAILS when:\n1. Multiple return paths return different named variables\n2. Returning a function PARAMETER (not a local)\n3. Exception handling with different catch-path variables\n4. You write 'return std::move(x)' — defeats NRVO, forces a move instead of elision!\n\nBottom line: just 'return x;' — trust the compiler. Never add std::move on a return value."}/>
    <Q d="hard" q="What is a dangling reference in modern C++? Give a subtle example." a={"A dangling reference refers to memory whose lifetime has ended. Classic: returning reference to local. Modern subtle cases:\n\n1. Range-for over temporary:\n  for (auto& x : func_returning_vector()) // DANGLING! Vector destroyed after first ;\n  // Fix: auto vec = func(); for (auto& x : vec)\n\n2. std::string_view over temporary:\n  std::string_view sv = std::string(\"hello\");  // string destroyed, sv dangles!\n  // Fix: store the string: std::string s = \"hello\"; std::string_view sv = s;\n\n3. Structured binding to map element then erase:\n  auto& [k, v] = *m.begin(); m.erase(m.begin()); // v is now dangling!\n\nModern C++ makes these subtle because implicit conversions and range-for hide the temporaries."}/>
    <Q d="hard" q="What are the five value categories, and why was the glvalue/prvalue/xvalue split introduced?" a={"C++ has three PRIMARY categories and two composite ones:\n\nPrimary:\n• lvalue — has identity, cannot be implicitly moved from (a named variable, *ptr, a[i]).\n• prvalue ('pure rvalue') — a value with no identity yet: a literal, or the result of a function returning by value. Since C++17 a prvalue is NOT an object — it's a recipe that materializes an object only when needed (this is what powers guaranteed copy elision).\n• xvalue ('eXpiring value') — has identity AND is movable: the result of std::move(x) or a function returning T&&.\n\nComposite:\n• glvalue = lvalue ∪ xvalue (anything with identity / an address).\n• rvalue = prvalue ∪ xvalue (anything you may move from).\n\nWhy the split: pre-C++11 only had lvalue/rvalue. Move semantics needed a category that has identity but is safe to cannibalize (xvalue), distinct from fresh temporaries (prvalue). C++17 then redefined prvalue as 'not yet an object' so that 'T x = f();' provably constructs in place — copy elision became mandatory, not an optimization."}/>
    <Q d="hard" q="What is the difference between std::move and std::forward? When is each correct?" a={"Both are zero-code casts; the difference is what they cast. std::move(x) UNCONDITIONALLY casts to T&& — use it when you're done with a concrete lvalue and want to move from it.\n\nstd::forward<T>(x) CONDITIONALLY preserves value category and is correct ONLY inside a template taking a forwarding reference T&& (deduced T), to pass an argument onward as the same lvalue/rvalue the caller supplied (perfect forwarding). The gotcha that ties it together: a named rvalue-reference parameter is itself an LVALUE inside the function — which is exactly why you still need move/forward to pass it along, and why reference collapsing (T& && → T&, T&& && → T&&) makes forward work."} deep={{g:"05",t:"C++ Advanced Guide"}} code={`template <class T>
void wrapper(T&& arg) {                 // forwarding reference (T deduced)
    callee(std::forward<T>(arg));       // preserve lvalue/rvalue-ness
}
struct Widget {
    std::string name;
    Widget(std::string n) : name(std::move(n)) {}   // n is a concrete lvalue → move
};`}/>
  </S>
</div>
),

/* ── C++ CONCURRENCY ── */
cpp_con:()=>(
<div>
  <S title="1. Memory Model & Reordering">
    <Card title="Why Hardware Reorders Memory" color={tk.orange}>
      CPUs reorder memory operations to hide latency. On <strong>x86 (TSO - Total Store Order)</strong>, stores are never reordered with other stores, but loads can be reordered with older stores. On <strong>ARM (Weak Model)</strong>, almost any reordering is legal: Store→Store, Load→Load, etc. If you want strong ordering on ARM, you MUST use explicit barriers.
    </Card>

    <Diagram title="The Acquire-Release Fix" horizontal={false}>
      <Node label="Producer: data = 42;" desc="Plain write" color={tk.blue} />
      <Arrow label="memory_order_release" />
      <Node label="Producer: ready.store(true)" desc="Publishes all prior writes" color={tk.violet} />
      <Arrow label="Thread switch" />
      <Node label="Consumer: ready.load(acquire)" desc="Subscribes to all prior writes" color={tk.cyan} />
      <Arrow label="Happens-Before Edge" />
      <Node label="Consumer: read(data)" desc="Guaranteed to see 42!" color={tk.accent} />
    </Diagram>
  </S>

  <S title="2. The 4 Memory Orders">
    <G items={[
      {t:"Relaxed", d:"No ordering guarantees, only atomicity. Ideal for stats counters (`hits++`). Virtually free on all architectures."},
      {t:"Acquire & Release", d:"`Acquire` prevents reads from moving before it. `Release` prevents writes from moving after it. Together, they create a 'happens-before' sync spanning threads. Free on x86, very cheap on ARM (`ldar`/`stlr`)."},
      {t:"Acq_Rel", d:"Combines Acquire and Release for Read-Modify-Write operations like `fetch_add` or `compare_exchange`."},
      {t:"Seq_Cst (Sequential Consistency)", d:"The default. Imposes a total, global ordering across all threads. The safest but slowest option. Requires heavy `mfence` or `dmb` instructions (~20-40 cycles). Avoid in tight loops on ARM."}
    ]} cols={2}/>
  </S>

  <S title="3. False Sharing & Lock-Free Patterns">
    <Card title="False Sharing" color={tk.red}>
      If Thread 1 writes to <code>counterA</code> and Thread 2 writes to <code>counterB</code>, but both counters reside on the same 64-byte <strong>Cache Line</strong>, the threads will repeatedly invalidate each other's L1 cache. This degrades performance by 100x. Fix by using <code>alignas(64)</code> to force each counter onto its own cache line.
    </Card>
    
    <B type="tip"><strong>Lock-Free Queue (Ring Buffer):</strong> The classic pattern uses an array with separate <code>head</code> and <code>tail</code> atomic indices (padded to avoid false sharing). The producer writes data, then updates <code>tail</code> with <code>release</code>. The consumer reads <code>tail</code> with <code>acquire</code>, then reads the data.</B>
  </S>

  <S title="Concurrency Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is a data race? How do you fix it?" a={"A data race: two or more threads access the same memory location, at least one writes, with no synchronization between them. In C++: data race = undefined behavior.\n\nFixes:\n1. Mutex: std::mutex + std::lock_guard (mutual exclusion)\n2. Atomic: std::atomic<T> (lock-free for simple types)\n3. Ordering: ensure one thread always finishes before the other (join, barrier)\n4. Immutability: make the data const — reads don't cause races with other reads"}/>
    <Q d="easy" q="What does volatile do in C++? Why is it NOT sufficient for thread safety?" a={"volatile: tells the compiler 'this variable can change externally — don't optimize reads/writes.' Prevents: caching in register, dead-store elimination, reordering relative to OTHER volatile accesses.\n\nNOT sufficient for threads because:\n1. Hardware can still reorder (volatile has no memory barrier semantics)\n2. Compiler can reorder non-volatile accesses around volatile ones\n3. On multicore: each core has its own store buffer — volatile doesn't flush it\n\nUse volatile for: hardware registers, signal handlers, setjmp. Use std::atomic for thread communication."}/>
    <Q d="medium" q="Acquire-release pattern with example." a={"Producer-consumer pattern:\n\nProducer thread:\n  data = 42;                                     // (1) write data\n  ready.store(true, std::memory_order_release);   // (2) RELEASE: publishes (1)\n\nConsumer thread:\n  while (!ready.load(std::memory_order_acquire)); // (3) ACQUIRE: subscribes to (2)\n  assert(data == 42);                             // (4) guaranteed to see (1)\n\nWhy it works: release (2) 'happens-before' acquire (3) in the C++ memory model. Everything before the release is visible after the acquire.\n\nCost: x86: free (TSO). ARM: stlr + ldar (1-2 extra cycles each). Much cheaper than seq_cst (mfence/dmb)."}/>
    <Q d="hard" q="What is ABA problem in lock-free programming?" a={"ABA problem with compare_exchange:\n\nThread 1: reads value A from location X.\nThread 2: changes X: A→B→A (back to A).\nThread 1: compare_exchange(A, new_value) succeeds — but the object is NOT the same A!\n\nExample: lock-free stack. Thread 1 reads top=A, preempted. Thread 2 pops A, pops B, pushes A (different allocation). Thread 1's CAS succeeds but next ptr might point to freed memory.\n\nFixes:\n1. Tagged pointer: pack version counter into high bits of pointer. Every modification increments counter. CAS checks BOTH pointer and counter.\n2. Hazard pointers: mark pointers as 'in use' before dereferencing.\n3. Epoch-based reclamation: defer memory reclamation to safe epoch boundaries."}/>
    <Q d="hard" q="What is the cost of seq_cst vs acquire-release on ARM vs x86?" a={"memory_order_seq_cst:\n  x86: loads are free (TSO). Stores need mfence before (serialize all pending stores) = ~20 cycles.\n  ARM: loads need dmb ish (data memory barrier) = ~20-40 cycles on typical ARM core.\n\nmemory_order_acquire/release:\n  x86: both are FREE. TSO model provides acquire semantics for loads and release for stores by default.\n  ARM: ldar for acquire loads, stlr for release stores = 1-5 cycles overhead each.\n\nOn an ARM core such as Kryo:\n  seq_cst is expensive. In a tight loop with atomic ops: use acquire/release wherever possible.\n  Example: ring buffer (push uses release, pop uses acquire) → near-zero overhead on x86, ~2-5% overhead on ARM vs unconstrained."}/>
    <Q d="hard" q="compare_exchange_weak vs compare_exchange_strong — when do you use each?" a={"Both atomically do: if (*this == expected) { *this = desired; return true; } else { expected = *this; return false; }\n\nThe difference is SPURIOUS failure:\n• _weak may fail even when *this == expected (returns false, leaves value unchanged). This happens because on LL/SC architectures (ARM, RISC-V) the load-linked/store-conditional pair can be broken by an interrupt, context switch, or even a nearby cache event — the SC fails for reasons unrelated to the value.\n• _strong loops internally to mask those spurious failures, so it only returns false on a real value mismatch.\n\nRule of thumb:\n• In a retry LOOP (the usual case): use _weak. You're already looping on failure, so a spurious failure just costs one extra cheap iteration — and _weak compiles to a single LL/SC pair (no hidden inner loop). This is the faster choice on ARM.\n• When you CANNOT loop (a one-shot CAS where you must distinguish 'value differed' from 'try again'): use _strong.\n\nOn x86 both lower to the same lock cmpxchg, so the distinction only costs you on ARM/RISC-V — which is exactly the mobile and embedded world."} code={`// canonical lock-free push with weak CAS in a loop
void push(Node* n) {
  n->next = head.load(std::memory_order_relaxed);
  while (!head.compare_exchange_weak(
            n->next, n,
            std::memory_order_release,   // success ordering
            std::memory_order_relaxed))  // failure ordering
  { /* n->next was refreshed by the failed CAS; just retry */ }
}`}/>
    <Q d="medium" q="Why is std::shared_ptr's control block atomic but the pointee is NOT thread-safe?" a={"shared_ptr makes exactly ONE guarantee: the reference COUNT is atomic. Multiple threads can copy/destroy shared_ptr instances pointing to the same object concurrently, and the refcount won't be corrupted (it uses fetch_add/fetch_sub — increment can be relaxed, the final decrement-to-zero needs acquire to order the destructor after all other releases).\n\nWhat it does NOT protect:\n1. The pointed-to OBJECT. Two threads calling non-const methods on *sp is a data race — you still need your own mutex.\n2. The shared_ptr VARIABLE itself. Reassigning the SAME shared_ptr object from two threads (sp = a; in one, sp = b; in another) is a race on the control-block pointer. Use atomic<shared_ptr<T>> (C++20) or std::atomic_store for that.\n\nCost note: the atomic refcount is why copying a shared_ptr isn't free — each copy is an atomic RMW. In hot loops, pass by const& to avoid touching the refcount. make_shared fuses the control block and object into one allocation (one cache line, one malloc)."}/>
  </S>
</div>
),

/* ── C++ MISC ── */
cpp_misc:()=>(
<div>
  <S title="1. Linkage, ODR, and Storage">
    <G items={[
      {t:"Storage Classes", d:"`automatic` (stack), `static` (bss/data, program lifetime), `thread_local` (TLS segment, 1 per thread), `dynamic` (heap, manual new/delete)."},
      {t:"The Const Family", d:"`const` (runtime immutable), `constexpr` (may eval at compile time), `consteval` (MUST eval at compile time), `constinit` (initialized at compile time -> prevents static init fiasco)."},
      {t:"One Definition Rule (ODR)", d:"Every class, inline func, and variable must have exactly ONE definition across the whole program. ODR violations yield Undefined Behavior, often silent link-time corruption."},
      {t:"Static vs Dynamic Libs", d:"`.a` (static) is archived code physically copied into the linker output. `.so`/`.dll` (dynamic) uses position-independent code (PIC) and resolves at runtime via PLT/GOT."}
    ]} cols={2}/>
  </S>

  <S title="2. STL & LLVM Infrastructure">
    <Card title="Key STL Internals" color={tk.blue}>
      <ul style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>std::vector:</strong> Contiguous memory. 2x growth factor. Moves items on realloc <em>ONLY</em> if their move constructor is <code>noexcept</code> (otherwise it falls back to expensive copying for exception safety).</li>
        <li><strong>std::string:</strong> Built with SSO (Small String Optimization). Strings under ~22 chars are stored directly in the object itself (no heap allocation).</li>
        <li><strong>std::string_view:</strong> A non-owning pointer + length wrapper. Fast, but dangerous (dangling references).</li>
      </ul>
    </Card>

    <Diagram title="LLVM's Custom Data Structures" horizontal={false}>
      <Node label="DenseMap" desc="Open addressing, inline keys/values. Very fast, strictly beats unordered_map." color={tk.accent} />
      <Node label="SmallVector<T, N>" desc="N elements pre-allocated inline. Falls to heap only if capacity > N." color={tk.teal} />
      <Node label="StringRef" desc="LLVM's battle-tested equivalent of string_view." color={tk.violet} />
    </Diagram>
  </S>

  <S title="STL & Misc Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is SSO (Small String Optimization)?" a={"For short strings (≤~22 chars for libstdc++, 15 for MSVC), the string object stores the data INLINE — no heap allocation.\n\nImplementation: the string object has a union: either a pointer+size+capacity (large mode) or an inline buffer (small mode). A discriminator bit distinguishes them.\n\nBenefits: no malloc/free for short strings (10-50× faster construction), better cache locality (data adjacent to string metadata), copy is just memcpy of fixed-size object."}/>
    <Q d="medium" q="What is the static initialization order fiasco? How to fix it?" a={"Static local variables in different translation units: initialization order is UNDEFINED across TUs.\n\nIf global A (in a.cpp) is initialized using global B (in b.cpp), B might not be initialized yet → UB.\n\nFixes:\n1. Function-local static: wrap in a function. Guaranteed initialized on first call.\n  int& get_global() { static int x = 42; return x; }\n2. constinit: ensures compile-time initialization (no runtime dependency)\n3. Design: avoid cross-TU global dependencies entirely"}/>
    <Q d="hard" q="When does vector reallocation copy instead of move?" a={"vector push_back triggers reallocation when size == capacity. It needs to move all elements to the new buffer.\n\nIf element's move ctor is noexcept: use move. O(1) per element.\nIf element's move ctor might throw: use COPY (for strong exception guarantee).\n\nWhy? If move throws midway: elements partially moved, partially not → inconsistent state → unrecoverable. But if copying: original buffer intact → can abort and maintain consistency.\n\nstd::move_if_noexcept implements this check. This is the whole reason noexcept on move matters so much for containers."}/>
    <Q d="medium" q="Which STL containers invalidate iterators/references on insertion and erasure? Why does it matter?" a={"You must know this cold — it's the source of countless UB bugs:\n\nstd::vector: insertion past capacity invalidates ALL iterators/pointers/references (reallocation). erase invalidates everything from the erased element onward (elements shift left).\nstd::deque: insertion at either end invalidates iterators but NOT references; insertion in the middle invalidates both.\nstd::list / forward_list: NEVER invalidates other nodes — only the erased node's own iterators. Splice is O(1) and pointer-stable.\nstd::map/set (RB-tree): insertion never invalidates anything; erase invalidates only the erased node. References to other elements stay valid.\nstd::unordered_map/set: REHASH (on insertion crossing max_load_factor) invalidates all ITERATORS but NOT references/pointers to elements (the nodes themselves don't move). erase invalidates only the erased element.\n\nWhy it matters: holding an iterator/reference across a mutation that invalidates it is UB. Node-based containers (list/map) give pointer stability — that's often why you pick them over vector even when vector is faster, e.g., when other structures hold references to the elements."}/>
    <Q d="hard" q="What exactly is an ODR violation, and why is it often silent and dangerous?" a={"The One Definition Rule: every entity needs exactly one definition program-wide; inline functions, templates, and class types may repeat across translation units but every definition must be token-for-token IDENTICAL.\n\nThe dangerous case is silent: two different struct layouts with the SAME name in two .cpp files (an extra member, or different -DFLAG) each compile fine, then the linker picks one arbitrarily via COMDAT folding → memory corruption. It's UB with NO diagnostic required (the standard calls it IFNDR), because the compiler only sees one TU at a time. Defend with a single source of truth in headers, inline on header-defined free functions, and one consistent set of ABI-affecting build flags."} deep={{g:"16",t:"C++ Code Lab"}}/>
  </S>
</div>
),

/* ── ARCHITECTURE ── */
arch:()=>(
<div>
  <S title="1. Memory Hierarchy — Real Numbers">
    <P>The 200× latency gap between L1 cache and DRAM is the single most important number in systems programming. Every loop optimization, tiling strategy, and data structure choice exists because of this gap.</P>
    <Table headers={["Level","Size","Latency","Bandwidth","Line/Page"]} rows={[
      ["L1 Data","32-48 KB","~4 cycles (1.2 ns)","~1 TB/s","64 bytes"],
      ["L1 Instr","32-48 KB","~4 cycles","~1 TB/s","64 bytes"],
      ["L2 Cache","256 KB-1 MB","~12 cycles (3.6 ns)","~400 GB/s","64 bytes"],
      ["L3 Cache","8-64 MB","~40 cycles (12 ns)","~200 GB/s","64 bytes"],
      ["DRAM","8-128 GB","~200 cycles (60 ns)","~50 GB/s","64 bytes"],
      ["HBM (GPU)","16-80 GB","~400 cycles","~2-3.5 TB/s","128 bytes"],
      ["NVMe SSD","256 GB-8 TB","~10 μs","~7 GB/s","4 KB page"],
    ]}/>
    <Card title="Cache Math Every Compiler Engineer Must Know" color={tk.blue}>
      <strong>Cache line = 64 bytes = 16 int32s = 16 float32s</strong><br/><br/>
      <strong>Stride-1 access (row-major):</strong> Miss rate = 1/16 = 6.25%. Hardware prefetcher easily detects the linear pattern → near-zero effective misses.<br/>
      <strong>Column-major access:</strong> For a 1024x1024 matrix, stride = 4KB. Each access hits a DIFFERENT cache line. L3 cache (32MB) holds 8192 rows. For N &gt; 8192, every access is a DRAM miss!
    </Card>
    <B type="tip"><strong>Tiling (Blocking):</strong> A <code>B×B</code> tile's working set (<code>B² × sizeof(element)</code>) must fit in L1/L2. For B=64 and float32, the tile is 16KB, which easily fits in a 32KB L1 cache. This reduces cache misses for matrix multiplication from O(N³) to O(N³/B²).</B>
  </S>

  <S title="2. Roofline Model & Performance Analysis">
    <Card title="Is your code COMPUTE-BOUND or MEMORY-BOUND?" color={tk.teal}>
      <strong>Operational Intensity (OI) = FLOPs / bytes_transferred_to_memory</strong><br/>
      Ridge Point = Peak_Compute / Peak_BW.<br/><br/>
      If <strong>OI &lt; Ridge Point</strong>: MEMORY-BOUND. Bandwidth is the bottleneck. Optimize data movement, fusion, or tiling.<br/>
      If <strong>OI &gt; Ridge Point</strong>: COMPUTE-BOUND. Arithmetic is the bottleneck. Optimize SIMD width, ILP, FMA, or precision.
    </Card>
    
    <G items={[
      {t:"Vector Add (a[i]+b[i]=c[i])", d:"FLOPs = N. Bytes = 12N. OI ≈ 0.08. ALWAYS memory-bound. No amount of SIMD helps if bandwidth is saturated. Fix: loop fusion."},
      {t:"Dense MatMul NxN", d:"FLOPs = 2N³. Bytes = 12N². OI = N/6. For N=1024, OI=170. Heavily COMPUTE-BOUND. Hardware is used efficiently."}
    ]} cols={2}/>
  </S>

  <S title="3. Pipeline Hazards & Branch Prediction">
    <Diagram title="Modern CPU Pipeline (14-20 stages)" horizontal={true}>
      <Node label="Fetch" />
      <Arrow />
      <Node label="Decode" />
      <Arrow />
      <Node label="Rename" />
      <Arrow />
      <Node label="Issue" />
      <Arrow />
      <Node label="Execute" color={tk.accent} />
      <Arrow />
      <Node label="Retire" />
    </Diagram>

    <G items={[
      {t:"Data Hazard (RAW)", d:"Read After Write: `add r1, r2, r3` followed by `add r4, r1, r5`. The 2nd instruction stalls waiting for `r1`. Fix: CPU forwarding/bypass, or Compiler instruction scheduling."},
      {t:"Control Hazard", d:"Branch outcome is unknown for 12-16 cycles. Misprediction flushes the entire pipeline. Fix: `__builtin_expect`, if-conversion (`csel`/`cmov`), or loop unrolling."},
      {t:"Structural Hazard", d:"E.g., Only one divide unit. Two consecutive divides stall. Compiler schedules independent ops in between."}
    ]} cols={3}/>
  </S>

  <S title="Architecture Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is a cache line? Why does it matter for data structure design?" a={"A cache line is the unit of transfer between cache levels — typically 64 bytes. When you access one byte, the entire 64-byte cache line is loaded into cache.\n\nImplications for data structures:\n1. Hot fields together: if fields a and b are always accessed together, put them in the same struct (adjacent in memory = same cache line).\n2. False sharing: two threads writing to adjacent (same cache line) fields → performance disaster. Fix: pad or alignas(64) to separate.\n3. Cache-friendly iteration: iterate contiguous arrays (each cache line load gives 16 free int32 reads)."}/>
    <Q d="medium" q="What is the Roofline model? How do you use it?" a={"Roofline plots achievable performance (GFLOPs) vs Operational Intensity (FLOPs/byte).\n\nOI = FLOPs / bytes transferred to/from memory.\n\nRoofline has two constraints:\n1. Bandwidth bound: performance ≤ OI × peak_bandwidth\n2. Compute bound: performance ≤ peak_compute\n\nRidge point: where the two lines meet = minimum OI for compute-bound operation.\n\nUsage:\n1. Measure your kernel's OI (use hardware counters or estimate)\n2. If OI < ridge point → memory-bound → optimize data movement, not compute\n3. If OI > ridge point → compute-bound → optimize arithmetic (SIMD, FMA, lower precision)"}/>
    <Q d="medium" q="What is branch misprediction cost? How does the compiler mitigate it?" a={"Branch misprediction: the CPU fetched/decoded wrong instructions. Must flush 12-20 stages. Cost: 12-20 cycles penalty.\n\nPipeline width: modern CPUs may have wasted up to 6 instructions/cycle × 16 cycles = 96 wasted instruction-issue slots.\n\nCompiler mitigations:\n1. __builtin_expect(expr, 0/1): hints branch direction for better code layout\n2. If-conversion: convert if-else to conditional move (CSEL/cmov) — no branch at all\n3. Loop unrolling: fewer branches in hot loops\n4. PGO: profile-driven layout puts hot path sequential (no branch needed for fall-through)\n5. Profile-guided inlining: inline hot paths to eliminate call branches"}/>
    <Q d="hard" q="What is VLIW and how does it change the compiler's job?" a={"VLIW (Very Long Instruction Word): the instruction word encodes multiple independent operations that execute in parallel. On Hexagon: a 'packet' contains up to 4 instructions executing simultaneously.\n\nKey difference from superscalar OOO:\n• Superscalar OOO: hardware dynamically finds independent instructions to execute in parallel at runtime.\n• VLIW: compiler statically identifies independent instructions and bundles them. NO OOO hardware.\n\nWhy Qualcomm uses VLIW for Hexagon DSP:\n• No OOO hardware = simpler, smaller chip = less power = fits in mobile SoC\n• Battery life critical for always-on DSP (audio, sensors, camera)\n• Compiler does the scheduling work offline (once at compile time, not at runtime per cycle)\n• 4 slots/packet × high clock → significant parallel throughput\n\nImplication: Hexagon's compiler IS the performance. Wrong scheduling = 4× performance loss."}/>
    <Q d="hard" q="What is software pipelining? How does it relate to VLIW?" a={"Software pipelining: overlap multiple loop iterations to expose instruction-level parallelism across iteration boundaries.\n\nNormal loop body (3-stage):  [fetch A] [compute] [store]\n  iter1: F  C  S\n  iter2:       F  C  S    ← couldn't overlap with iter1's compute!\n\nSoftware pipelined:\n  iter1:    F1\n  iter2:    F2  C1\n  iter3:    F3  C2  S1    ← 3 operations per cycle (steady state)\n  ...\n\nFor VLIW (Hexagon): software pipelining fills packet slots with operations from different iterations. The LLVM MachinePipeliner implements this for Hexagon.\n\nResult: 3× throughput improvement for perfectly software-pipelined loops. Critical for DSP audio/image processing kernels."}/>
    <Q d="hard" q="Why does x86 (TSO) still reorder memory, and what is a store buffer?" a={"x86's Total Store Order permits exactly ONE reordering — a later load can pass an earlier store to a different address — because of the per-core store buffer that holds committed stores before they drain to coherent memory.\n\nThat StoreLoad reorder is the classic Dekker/store-buffer litmus test (both threads read 0), which is why a seq_cst store needs an MFENCE to drain the buffer. ARM's weak model is looser still — StoreStore, LoadLoad, and LoadStore can all reorder — so you need explicit DMB/LDAR/STLR, not just a StoreLoad fence. (Aside: this is also why 'volatile' is not a sync tool — it never drains the buffer.)"} deep={{g:"07",a:"part-5-why-weak-memory-models-matter",t:"Memory Models & Concurrency"}}/>
  </S>
</div>
),

/* ── ARM ── */
arm:()=>(
<div>
  <S title="1. AArch64 Complete Register Reference">
    <G items={[
      {t:"x0-x7", d:"Arguments and Return values. Caller-saved."},
      {t:"x8", d:"Indirect result location (`sret` pointer). Special use."},
      {t:"x9-x15", d:"Scratch/Temporaries. Caller-saved."},
      {t:"x19-x28", d:"Callee-saved inside the function prologue. Must be preserved."},
      {t:"x29 (FP)", d:"Frame Pointer. Used for stack unwinding/debugging."},
      {t:"x30 (LR)", d:"Link Register. Stores the return address automatically set by `bl`."},
      {t:"SP", d:"Stack Pointer. MUST BE 16-byte aligned at all call boundaries."},
      {t:"XZR / WZR", d:"Zero register. Reads as 0, writes are discarded. Does not consume a physical register."},
      {t:"v0-v31", d:"128-bit FP/SIMD Registers. `v8-v15` are callee-saved (lower 64 bits only)."}
    ]} cols={3}/>
  </S>

  <S title="2. Key Instructions & Calling Convention">
    <Card title="The Power of the Barrel Shifter" color={tk.cyan}>
      AArch64 has a barrel shifter built directly into the ALU. You can shift an operand for FREE as part of an arithmetic instruction.<br/>
      <code style={{color:tk.text}}>add x0, x1, x2, lsl #3</code>  →  <code>x0 = x1 + x2*8</code> in ONE instruction!<br/>
      This eliminates separate shift instructions for array indexing, heavily boosting performance over x86.
    </Card>
    
    <G items={[
      {t:"Branchless Execution", d:"`csel x0, x1, x2, eq` assigns `x1` to `x0` if the EQ flag is set, else `x2`. Equivalent to LLVM Select. Prevents costly control hazards."},
      {t:"Load/Store Pair", d:"`ldp x0, x1, [sp]` and `stp x0, x1, [sp, #-16]!` efficiently load or store two registers at once. Essential for prologues/epilogues."},
      {t:"Control Flow", d:"`bl` calls a function (saves PC to x30). `blr x8` does dynamic dispatch (vtable). `ret` returns to x30. `cbz x0, label` is a fast combined compare-and-branch-if-zero."}
    ]} cols={3}/>
  </S>

  <S title="3. Memory Barriers on ARM">
    <Card title="AArch64 Weak Memory Model" color={tk.orange}>
      <code style={{color:tk.text}}>DMB ISH</code>: (Data Memory Barrier) Ensures all loads/stores BEFORE the barrier complete before any AFTER it. (~20-40 cycle cost).<br/>
      <code style={{color:tk.text}}>ISB</code>: (Instruction Sync Barrier) Flushes the instruction pipeline. Critical for JIT compilers setting up new executable code.<br/>
      <code style={{color:tk.text}}>LDAR / STLR</code>: Single-instruction atomic Load-Acquire and Store-Release. Far more efficient than using a raw `load` followed by a `DMB`.
    </Card>
  </S>

  <S title="ARM Practice Questions" c={tk.amber}>
    <Q d="easy" q="How does function return work in AArch64?" a={"x30 (LR, Link Register) holds the return address.\n\nOn a function call:\n  bl target    // saves PC+4 into x30, then jumps to target\n  blr xN       // indirect: saves PC+4 into x30, jumps to address in xN\n\nOn return:\n  ret          // branches to address in x30\n\nCallee-saved: if the callee calls other functions (not a leaf), it must save x30 (and x29) on the stack in the prologue and restore in the epilogue."}/>
    <Q d="easy" q="What is the barrel shifter in AArch64? Give an example." a={"AArch64 has a barrel shifter built into the ALU — you can shift one operand for FREE as part of any arithmetic or logical instruction.\n\nadd x0, x1, x2, lsl #3   = x0 = x1 + x2*8 in ONE instruction!\n\nThis eliminates separate shift instructions for array indexing (base + index*sizeof). Critical for RISC performance — in x86 you need a separate SHL or use LEA."}/>
    <Q d="medium" q="Walk through virtual dispatch in AArch64 assembly." a={"For: Animal* a = new Dog(); a->speak();\n\n// a is in x0 (first argument = 'this')\nldr x8, [x0]          // load vptr: first 8 bytes of Dog object\nldr x8, [x8, #16]     // index vtable: skip 8B offset-to-top + 8B RTTI* = slot at offset 16\nblr x8                // indirect call: jumps to Dog::speak\n\nTotal: 2 loads + 1 indirect branch. ~10-30 cycles depending on branch predictor and cache state."}/>
    <Q d="hard" q="Why must the stack be 16-byte aligned at call boundaries?" a={"AArch64 ABI requirement: SP must be 16-byte aligned at any BL/BLR instruction.\n\nReasons:\n1. SIMD/FP instructions (LDP/STP with v registers) require 16-byte aligned memory\n2. Consistent alignment enables reliable stack unwinding (debuggers, exception handling)\n3. Some hardware platforms raise alignment exceptions for unaligned accesses\n\nImplementation: callee's prologue typically does stp x29,x30,[sp,#-16]! which allocates 16 bytes. If additional locals needed: sub sp, sp, #N where N is rounded up to 16."}/>
    <Q d="hard" q="What are LSE atomics and why did ARMv8.1 add them over the original LL/SC?" a={"The original AArch64 RMW is an LDXR/STXR (load-exclusive/store-exclusive) retry loop, which under contention can livelock and scale terribly as cores steal the line and fail each other's STXR.\n\nLSE (Large System Extensions, ARMv8.1) adds single-instruction atomics — LDADD, SWP, CAS/CASP — that need no retry loop and can execute near memory, giving far better many-core scaling. The compiler angle: clang picks LSE when the target has it (-mcpu/+lse) and otherwise falls back to LL/SC, so the SAME fetch_add lowers very differently by -march — a clean example of target-dependent codegen."} deep={{g:"13",a:"atomics-exclusives-vs-lse",t:"AArch64 Architecture"}}/>
    <Q d="hard" q="How do SVE/SVE2 scalable vectors differ from NEON, and what is 'vector-length agnostic' code?" a={"NEON is fixed-width — every vector is exactly 128 bits, baked into the binary. SVE is vector-length-agnostic (VLA): the hardware width is an implementation choice from 128–2048 bits and the SAME binary runs at any of them.\n\nInstead of hard-coding a width you use WHILELT to build a per-iteration predicate (so the loop tail is handled by predication, not a scalar remainder) and INCB to advance by 'however many lanes this chip has.' For a compiler engineer that means the vectorizer emits predicated, length-agnostic loops over scalable <vscale x N x T> types rather than picking a fixed VF — and the cost model still decides NEON vs SVE vs scalar."} deep={{g:"14",a:"part-2-sve-scalable-vectors-the-headline-act",t:"NEON & SVE Vectorization"}}/>
  </S>
</div>
),

/* ── LINKING ── */
link:()=>(
<div>
  <S title="1. Linking, ELF, ABI">
    <G items={[
      {t:"ELF Sections", d:"`.text` (machine code, read-only), `.data` (initialized globals, RW), `.bss` (zero-init globals, alloc at load), `.rodata` (consts, literals, vtables), `.got` (Global Offset Table), `.plt` (Procedure Linkage Table), `.eh_frame` (exceptions)."},
      {t:"Static vs Dynamic", d:"`.a` (Static): Clones code into the final binary. Self-contained but larger. `.so` (Dynamic): Shared across processes via PLT/GOT indirection. Smaller binaries, updatable, but adds runtime load."}
    ]} cols={2}/>

    <Card title="ABI & Name Mangling" color={tk.teal}>
      C++ supports overloading, so <code>add(int,int)</code> gets mangled to <code>_Z3addii</code> to ensure linker uniqueness. <code>extern "C"</code> disables this for C/Python interop.<br/>
      <strong>Calling Convention (Itanium ABI):</strong> Structs ≤ 16B are passed in registers. Structs &gt; 16B use <code>sret</code> (hidden first arg <code>x8</code> pointing to a pre-allocated return slot).
    </Card>

    <Card title="Position-Independent Code (PIC)" color={tk.violet}>
      Required for dynamic libraries. Code cannot assume absolute memory addresses.<br/>
      <code style={{color:tk.text}}>adrp x0, :pg_hi21:global</code> // page-relative address<br/>
      <code style={{color:tk.text}}>add x0, x0, :lo12:global</code> // low 12 bits
    </Card>
  </S>
  <S title="Linking Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is name mangling and why does C++ need it?" a={"Name mangling encodes the full signature of a C++ symbol into its linker name.\n\nadd(int,int) → _Z3addii\nvoid Foo::bar(double) const → _ZNK3Foo3barEd\n\nNeeded because C++ allows function overloading, templates, namespaces, and operator overloading — multiple functions with the same base name. Mangling gives each a unique linker symbol.\n\nextern \"C\" { void func(int); }: disables mangling. Used for C interoperability, dlsym() lookup, Python ctypes."}/>
    <Q d="medium" q="What is the difference between static and dynamic libraries?" a={"Static library (.a): archive of .o files. Linker copies needed object code into the final binary. Result: self-contained, no runtime dependencies, larger binary size, can't update library without relinking.\n\nDynamic library (.so/.dll): code stays separate. At link time: record which symbols needed. At runtime: dynamic linker resolves addresses via PLT/GOT. Multiple programs share ONE copy of the library in memory. Updatable without relinking apps. Smaller per-binary. But: startup overhead (dynamic linking), potential version conflicts."}/>
    <Q d="hard" q="What is PLT/GOT and why is it needed for dynamic linking?" a={"GOT (Global Offset Table): a table in the data segment. Each entry holds the runtime address of an external symbol.\n\nPLT (Procedure Linkage Table): stubs for each external function. First call: PLT stub → dynamic linker resolves address → fills GOT entry → calls function. Subsequent calls: PLT stub → load from GOT (now filled) → call. This is 'lazy binding' — resolve on first call.\n\nWhy needed: when compiling a .so, you don't know where other libraries will be loaded. PIC code uses PC-relative addresses to reference the GOT, which is filled at load time by the dynamic linker."}/>
    <Q d="medium" q="Why does the ORDER of libraries on the link line matter for static linking?" a={"The traditional Unix linker resolves left-to-right in a SINGLE pass and pulls object files out of a static archive (.a) ONLY to satisfy symbols that are UNDEFINED at the moment it reaches that archive.\n\nConsequence: if libfoo uses a symbol from libbar, you must write '-lfoo -lbar' (user before dependency). Reversed ('-lbar -lfoo'), when the linker scans libbar nothing needs it yet, so it takes nothing from it; then libfoo introduces the undefined symbol — but libbar is already behind us → 'undefined reference' error.\n\nThis is why a .o file always goes before the libraries it needs, and why circular dependencies between two archives require either repeating one (-lfoo -lbar -lfoo) or wrapping them in --start-group/--end-group (which loops until a fixed point).\n\nShared libraries (.so) don't have this problem as severely — the dynamic linker resolves symbols globally — but with --as-needed the order can still decide whether a .so is recorded as a dependency. Static-archive link order is a classic 'works on my machine' bug."}/>
    <Q d="hard" q="What is the strong/weak symbol model, and how do 'inline' functions avoid multiple-definition errors?" a={"ELF symbols have a BINDING: GLOBAL (strong) or WEAK. Rules the linker applies:\n1. Multiple STRONG definitions of the same symbol → link error ('multiple definition').\n2. One strong + several weak → the strong one wins, silently.\n3. Only weak definitions → the linker picks one arbitrarily (commonly the first/largest).\n\nWhere this bites: a non-inline function or a global variable DEFINED in a header becomes a strong symbol in every TU that includes it → multiple-definition error. An UNINITIALIZED global (C 'tentative definition') is emitted as COMMON/weak, which is why two 'int x;' in different TUs historically merged silently into one (a real bug; -fno-common is now default to flag it).\n\ninline / templates / vtables use VAGUE LINKAGE: the compiler emits the definition in every TU that needs it but marks each copy as a COMDAT group (a named weak group). The linker then FOLDS all identical COMDAT copies into one and discards the rest — so 'inline' in a header is legal across many TUs precisely because it's weak/COMDAT, not strong. (This is also why an ODR mismatch between those copies is silent: the linker keeps just one.)"}/>
    <Q d="hard" q="How does Link-Time Optimization (LTO) change what the linker does?" a={"Normally each .cpp is optimized in isolation and the linker just resolves symbols and concatenates machine code — it can't optimize across TU boundaries. LTO defers real codegen to link time.\n\nMechanism: with -flto the compiler writes LLVM BITCODE (IR) into the .o files instead of (or alongside) machine code. At link time the LTO plugin loads all that IR into one big module and runs the optimizer with WHOLE-PROGRAM visibility, then generates machine code.\n\nWhat it unlocks that per-TU compilation can't:\n• Cross-TU inlining (a hot function defined in a.cpp inlined into b.cpp).\n• Whole-program devirtualization (prove a virtual call has one target).\n• Cross-TU constant propagation, DCE of unused globals/functions, and better IPO/attribute inference.\n\nFlavors: 'full' LTO (one monolithic module — best results, high memory/time) vs 'thin' LTO (per-TU summary index + parallel, selective cross-module imports — nearly full-LTO quality at much lower cost; this is what large codebases like Chromium use). The trade-off is link time and memory for runtime speed and size."}/>
  </S>
</div>
),

/* ── TESTING ── */
test:()=>(
<div>
  <S title="1. Testing, Debugging & Verification">
    <G items={[
      {t:"LIT + FileCheck", d:"LLVM's integration testing. `FileCheck` reads IR/asm and verifies patterns like `CHECK: add i32`, `CHECK-NOT: mul`, ensuring your pass correctly transformed the IR."},
      {t:"Sanitizers", d:"`ASan` (Address/Buffer Overflows), `TSan` (Data Races), `UBSan` (Undefined Behavior: shift, overflow, null ptr), `MSan` (Uninitialized Reads), `LSan` (Leaks)."},
      {t:"Fuzzing", d:"`Csmith`/`YARPGen` produce random valid C++ to find compiler crashes. `libFuzzer` mutates inputs to find edge-case assertions in your IR passes."},
      {t:"Alive2", d:"SMT-based formal verification of LLVM transforms using Z3. Mathematically proves that your optimization (e.g., in InstCombine) is sound for all possible inputs and preserves all defined behavior."}
    ]} cols={2}/>

    <Card title="Debugging a Miscompile" color={tk.red}>
      <ul style={{margin:0, paddingLeft:20, lineHeight:1.8}}>
        <li><strong>Step 1:</strong> <code>opt --opt-bisect-limit=N</code> (Binary search over optimization passes to find the guilty one).</li>
        <li><strong>Step 2:</strong> <code>opt -print-before=guilty-pass -print-after=guilty-pass</code> (Isolate the buggy IR transform).</li>
        <li><strong>Step 3:</strong> Use <code>creduce</code> or <code>cvise</code> to minimize the failing C++ test case.</li>
        <li><strong>Step 4:</strong> If it's a codegen bug, use <code>llc -stop-after=instruction-select</code>.</li>
      </ul>
    </Card>
  </S>
  <S title="Testing Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is FileCheck and how do CHECK-NOT and CHECK-LABEL work?" a={"FileCheck reads your IR/asm output and verifies patterns:\n\nCHECK: text: verifies 'text' appears somewhere after previous check.\nCHECK-NEXT: immediately following line.\nCHECK-NOT: text: verifies 'text' does NOT appear between current and next CHECK.\nCHECK-LABEL: marks a new section anchor (e.g., a function definition). Resets CHECK position.\n\nExample: to verify instcombine simplified 'x + 0' to 'x':\n  ; CHECK-NOT: add\n  ; CHECK: ret i32 %x\n  Confirms no 'add' instruction remains, and result is returned."}/>
    <Q d="medium" q="What does Alive2 do? Why is it important for compiler correctness?" a={"Alive2 formally verifies LLVM transformations using SMT solving (Z3 backend).\n\nFor each optimization pattern (e.g., instcombine rule 'x + 0 → x'):\n1. Encodes original and transformed IR as SMT formulas\n2. Checks: ∀ inputs, if original is defined (no UB) → transformed produces same result\n3. Also checks: transformed preserves all defined behaviors (doesn't introduce new UB)\n\nFound multiple bugs in LLVM's instcombine where optimizations were unsound (changed behavior on edge cases). Essential for ensuring the compiler never produces wrong output."}/>
    <Q d="hard" q="How would you debug an LLVM miscompilation at -O2?" a={"Systematic approach:\n\n1. Confirm: does the problem go away at -O1? At -O0? Narrow the optimization level.\n2. opt --opt-bisect-limit=N: binary search over passes. N where bug first appears.\n3. Identify the guilty pass. Run with -print-before=pass and -print-after=pass to see the IR transformation.\n4. Minimize: cvise/creduce on the source code to get the smallest reproducer.\n5. If IR transform is wrong: write an Alive2 query to check correctness.\n6. If it's a codegen bug (passes OK but output code wrong): llc -stop-after=each-stage to isolate.\n7. File bug with minimal reproducer + expected vs actual output."}/>
    <Q d="medium" q="How does AddressSanitizer actually catch a buffer overflow, and what can it NOT catch?" a={"ASan instruments the program at COMPILE time and uses SHADOW MEMORY: every 8 application bytes map to 1 shadow byte recording how many of those 8 bytes are addressable. The shadow lives at (addr >> 3) + offset.\n\n• Around every heap/stack/global allocation it places POISONED 'redzones' (shadow marked unaddressable). Each load/store is instrumented to first check the shadow byte; touching a redzone → instant report with the exact line and a malloc/free stack trace.\n• Freed memory is QUARANTINED and poisoned, so use-after-free is caught instead of being silently reused.\n\nCosts: ~2x slowdown and ~3x memory (the shadow + redzones + quarantine).\n\nWhat ASan does NOT catch: data races (use TSan), uninitialized reads (use MSan), most integer/UB issues like signed overflow or bad shifts (use UBSan), and logic bugs. It also can miss overflows that jump clean past a redzone into another valid object. ASan, TSan, and MSan are mutually exclusive — you run separate builds. Valgrind needs no recompile but is ~20x slower and misses stack/global overflows that ASan catches."}/>
    <Q d="hard" q="How does ThreadSanitizer detect a data race that didn't actually misbehave on this run?" a={"TSan finds races that are LATENT — it doesn't need the bad interleaving to actually occur. It builds a happens-before model at runtime.\n\nMechanism: each thread carries a vector clock; every memory location stores 'shadow' metadata about the last few accesses (which thread, clock value, read vs write, size). Synchronization operations (mutex lock/unlock, atomic load/store, thread create/join) update the vector clocks to establish happens-before edges.\n\nOn every memory access TSan checks the shadow: if a prior access to the same location from a DIFFERENT thread is NOT ordered before this one by any happens-before edge, and at least one is a write → it's a data race, reported with both stacks. Because it reasons about ordering rather than timing, a race is flagged even if, on this particular run, the two threads happened not to overlap.\n\nLimits: ~5–15x slowdown and large memory; it only sees code that actually executes (no static coverage), and it can miss races guarded by ad-hoc synchronization it doesn't recognize. Build with -fsanitize=thread (separate from ASan)."}/>
  </S>
</div>
),

/* ── CUDA ── */
cuda:()=>(
<div>
  <S title="1. GPU Architecture — Massive Parallelism">
    <P>A GPU is a throughput machine: it sacrifices single-thread latency for massive parallel bandwidth. Where a CPU core has a sophisticated branch predictor and large OOO window to keep one thread fast, a GPU has thousands of simple cores that hide memory latency by switching between threads.</P>
    <G items={[
      {t:"Grid → Blocks → Warps → Threads", d:"`Grid` = millions of threads. `Block` = up to 1024 threads sharing SRAM. `Warp` = 32 threads in LOCKSTEP (SIMT, the fundamental scheduling unit). `Thread` = one program instance."},
      {t:"SM Resources (H100)", d:"Each SM has ~228KB Shared Memory, 65536 Registers (256KB), max 64 warps (2048 threads), and max 32 blocks."},
      {t:"Memory Hierarchy", d:"1. Registers (~1 cycle) \n2. Shared Memory (~5 cycles, user-managed) \n3. L2 Cache (50MB, ~100 cycles) \n4. Global HBM (80GB, ~400 cycles, ~3TB/s)."}
    ]} cols={3}/>

    <Diagram title="The GPU Compilation Pipeline (NVCC)" horizontal={true}>
      <Node label="Source (.cu)" sub="Host + Device" />
      <Arrow label="nvcc split" />
      <Node label="Device Code" sub="CUDA C++" color={tk.blue} />
      <Arrow label="Compiler" />
      <Node label="PTX" sub="Virtual ISA" color={tk.violet} />
      <Arrow label="ptxas" />
      <Node label="SASS" sub="Native Asm" color={tk.accent} />
    </Diagram>
  </S>

  <S title="2. Cardinal Rules of GPU Performance">
    <G items={[
      {t:"Rule 1: Memory Coalescing", d:"GPU memory serves 128-byte transactions. A 32-thread warp reads 1 transaction IF coalesced (`a[threadIdx.x]`). Strided or random access results in up to 32 separate transactions (32x slower). ALWAYS use Structure of Arrays (SoA), NOT Array of Structures (AoS)."},
      {t:"Rule 2: Warp Divergence", d:"If threads in a warp take different branches, the hardware executes BOTH paths serially and masks out inactive threads. Avoid `if (tid % 2 == 0)`. Target block-level divergence instead: `if (tid / 32 < threshold)` so entire warps are uniform."},
      {t:"Rule 3: Occupancy", d:"Occupancy = active_warps / max_warps. Higher occupancy hides memory latency. It is limited by Registers/Thread, Shared Memory/Block, or Block size. But higher occupancy isn't ALWAYS faster (e.g., spilling registers to local memory is worse than low occupancy)."}
    ]} cols={3}/>
  </S>

  <S title="3. Tiled Matrix Multiply">
    <Card title="Why Tile?" color={tk.blue}>
      Naive MatMul reads 2N global memory values per output = 2N³ total reads. Memory bandwidth limited!<br/>
      <strong>Tiling</strong> loads TILE×TILE blocks into shared memory. Each value is read TILE times from SRAM instead of DRAM, heavily reducing global memory traffic.
    </Card>
    <C code={`  #define TILE 32
  __global__ void matmul(float* A, float* B, float* C, int N) {
    __shared__ float As[TILE][TILE], Bs[TILE][TILE];
    int row = blockIdx.y*TILE + threadIdx.y;
    int col = blockIdx.x*TILE + threadIdx.x;
    float sum = 0.0f;
    
    for (int t = 0; t < N/TILE; t++) {
      // Collaboratively load tile of A and B into shared memory
      As[threadIdx.y][threadIdx.x] = A[row*N + t*TILE + threadIdx.x]; // coalesced!
      Bs[threadIdx.y][threadIdx.x] = B[(t*TILE + threadIdx.y)*N + col]; // coalesced!
      __syncthreads();  // wait for all threads to load their element
      
      for (int k = 0; k < TILE; k++)
        sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];  // from SRAM: ~5 cycles
      
      __syncthreads();  // wait before loading next tile
    }
    if (row < N && col < N) C[row*N + col] = sum;  // coalesced write
  }`}/>
  </S>

  <S title="CUDA Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is a warp? Why is it the fundamental scheduling unit?" a={"A warp is 32 threads that execute in lockstep on a SIMT (Single Instruction Multiple Threads) processor. All 32 threads execute the same instruction at the same time, with different data.\n\nFundamental scheduling unit because:\n• Hardware issues one instruction per cycle for one warp\n• When a warp stalls (e.g., waiting for memory), the SM switches to another ready warp — zero-cost context switch\n• Hiding latency through warp switching is the GPU's primary performance strategy"}/>
    <Q d="easy" q="What is coalesced memory access and why does it matter?" a={"Coalesced: when 32 threads in a warp access 32 consecutive memory addresses → GPU combines into ONE 128-byte transaction.\n\nUncoalesced: random or strided access → up to 32 separate transactions, 32× slower!\n\nRule of thumb: if thread T accesses element T (0-indexed) → coalesced. If thread T accesses element T*K (strided) → (k-1)/k of bandwidth wasted.\n\nPractical implication: always design kernels so threadIdx.x is the innermost index of your array access."}/>
    <Q d="medium" q="What limits GPU occupancy? Is higher always better?" a={"Occupancy = active_warps_per_SM / max_warps_per_SM. Three limiters (minimum wins):\n1. Registers/thread: 65536 regs/SM / (regs × 32 threads) = max warps from register pressure\n2. Shared memory/block: SMEM_per_SM / SMEM_per_block × warps_per_block\n3. Block size (threads/block) and max blocks/SM\n\nHigher occupancy ≠ always better:\n• If register-limited → reducing registers (might cause spills to slow 'local' memory) hurts more than low occupancy\n• For compute-bound kernels: don't need many warps to hide latency (pipeline already busy)\n• Optimal occupancy is workload-dependent. Profile, don't guess."}/>
    <Q d="hard" q="What is shared memory bank conflict? How do you avoid it?" a={"Shared memory is divided into 32 banks (for 4-byte elements). Bank = address % 32.\n\nBANK CONFLICT: if two threads in a warp access different addresses in the same bank → serialized access. N-way conflict = N sequential accesses.\n\nExample:\n  As[threadIdx.x][0] — all 32 threads access bank 0 → 32-way conflict!\n\nFix: PAD the shared memory declaration:\n  __shared__ float As[TILE][TILE+1];  // +1 padding shifts columns across banks\n  Now: As[0][0]=bank0, As[1][0]=bank1, ... → no conflict!\n\nBroadcast exception: if ALL threads access the SAME address → broadcast (no conflict). Only different addresses in same bank cause conflicts."}/>
    <Q d="hard" q="Explain the CUDA compilation pipeline." a={"Source (.cu)\n→ nvcc splits: host code (compiled by gcc/clang) + device code\n→ Device code: CUDA C++ → PTX (virtual ISA, portable across GPU generations)\n→ PTX → SASS (target-specific machine code, per-GPU-arch: sm_80, sm_90)\n→ Embedded in fatbinary (ELF with multiple SASS versions)\n→ At runtime: CUDA driver selects matching SASS for current GPU\n\nJIT compilation: if no matching SASS → driver JIT-compiles PTX → SASS at first launch (cached for subsequent runs).\n\nFor compiler engineers: Triton and torch.compile both ultimately produce PTX that goes through this same pipeline."}/>
    <Q d="hard" q="What is warp divergence? When is it acceptable?" a={"Warp divergence: threads in a warp take different branch paths → hardware executes BOTH paths, masking inactive threads.\n\nCost: if 16 threads go path A and 16 go path B → both paths execute → 50% utilization.\n\nAcceptable when:\n1. Divergence happens in cold code (not inner loop)\n2. One path is very short (e.g., boundary check: 1 warp out of 1000 diverges)\n3. Alternative (removing branch) would require more expensive data movement\n\nOptimization: restructure so entire warps take the same path:\n  BAD:  if (tid % 2 == 0)     → every warp diverges\n  GOOD: if (tid / 32 < N/2)   → entire warps take one path, no divergence"}/>
  </S>
</div>
),

/* ── TRITON ── */
triton:()=>(
<div>
  <S title="1. Triton — Block Programming Model">
    <P>Triton is a Python-based GPU programming language by OpenAI that operates at the <strong style={{color:tk.cyan}}>block level</strong> — you program operations on entire tiles/blocks of data rather than individual threads. The compiler handles thread mapping, memory coalescing, shared memory management, and scheduling automatically.</P>
    <Card title="Mental Model: CUDA vs Triton" color={tk.teal}>
      <strong>CUDA:</strong> You control EACH THREAD (`threadIdx.x`), shared memory, and `__syncthreads()`.<br/>
      <strong>Triton:</strong> You control BLOCKS of data. `tl.load`, `tl.store`, and `tl.dot` operate on tensors. No `threadIdx`, no shared memory allocations, and no manual syncs. You just express the math on blocks.
    </Card>
  </S>

  <S title="2. Triton Compilation Pipeline">
    <Diagram title="From Python to GPU SASS" horizontal={false}>
      <Node label="Python AST" desc="@triton.jit decorated block-level Python code" color={tk.blue}/>
      <Arrow label="Triton Frontend" />
      <Node label="Triton IR (MLIR)" desc="Block-level ops, shape inference, constant folding" color={tk.violet}/>
      <Arrow label="Triton IR Passes" />
      <Node label="TTGIR (Triton GPU IR)" desc="Mem Layout, Smem Allocation, Coalescing, Pipelining" color={tk.cyan}/>
      <Arrow label="LLVM Lowering" />
      <Node label="LLVM NVPTX" desc="Standard LLVM IR with GPU intrinsics → PTX" color={tk.accent}/>
      <Arrow label="ptxas" />
      <Node label="SASS" desc="Hardware specific machine code" color={tk.textDim}/>
    </Diagram>
    <Card title="What the Compiler Automates" color={tk.orange}>
      Triton's compiler does what CUDA programmers do manually: Shared memory allocation for `tl.dot`, Memory coalescing, Software pipelining (overlapping loads with compute), and Register pressure management via autotuning.
    </Card>
  </S>

  <S title="3. Autotuning & Fused Operations">
    <G items={[
      {t:"Autotuning", d:"`@triton.autotune` profiles multiple `BLOCK_M, N, K` dimensions and `num_warps` combinations. Problem sizes and GPU architectures change, so autotuning empirically finds the best configuration at runtime, achieving 90-95% of hand-tuned CUDA."},
      {t:"Block Pointers", d:"`tl.make_block_ptr` allows loading 2D matrix tiles natively without manual multi-dimensional indexing or boundary checking. The Triton compiler uses this to reason about memory layouts."},
      {t:"Flash Attention", d:"Fuses `QxK^T → softmax → xV` into ONE kernel, never materializing the huge NxN attention matrix. Triton's version is ~150 lines vs CUDA's ~500 lines, reaching 95% of CUDA performance!"}
    ]} cols={3}/>
  </S>

  <S title="4. Triton Matmul Walkthrough">
    <C code={`@triton.jit
def matmul_kernel(A, B, C, M, N, K, stride_am, stride_ak, stride_bk, stride_bn, stride_cm, stride_cn, BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr):
    pid_m, pid_n = tl.program_id(0), tl.program_id(1)

    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)

    a_ptrs = A + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = B + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn

    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, K, BLOCK_K):
        a = tl.load(a_ptrs, mask=offs_k[None, :] + k < K)
        b = tl.load(b_ptrs, mask=offs_k[:, None] + k < K)
        acc += tl.dot(a, b)
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk

    c_ptrs = C + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn
    tl.store(c_ptrs, acc, mask=(offs_m[:, None] < M) & (offs_n[None, :] < N))`}/>
  </S>

  <S title="Triton Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is the fundamental difference between CUDA and Triton programming models?" a={"CUDA: thread-level programming. You manage individual threads, shared memory, synchronization.\n\nTriton: block-level programming. You express operations on blocks/tiles of data. The compiler manages:\n• Thread-to-data mapping\n• Shared memory allocation and barriers\n• Memory coalescing\n• Register file management\n\nTriton trades low-level control for productivity. A Triton matmul is ~30 lines vs ~200 for CUDA. Performance is typically 90-95% of hand-tuned CUDA."}/>
    <Q d="easy" q="What is tl.program_id and how does it relate to CUDA's blockIdx?" a={"tl.program_id(axis) returns the index of the current 'program instance' along the given axis. It's conceptually identical to blockIdx.x/y/z in CUDA.\n\nDifference: in CUDA, you also have threadIdx within each block. In Triton, there's no threadIdx — the compiler handles intra-block thread assignment automatically.\n\ntl.program_id(0) = which block of output this program computes."}/>
    <Q d="easy" q="What does the mask parameter in tl.load do?" a={"mask is a boolean tensor the same shape as the loaded data. Elements where mask=False are not loaded (instead filled with 'other' value, default 0).\n\nPurpose: boundary handling. When the data size isn't a multiple of BLOCK_SIZE, the last block would read out of bounds. mask = offs < N prevents this.\n\nEquivalent to: if (threadIdx.x + blockIdx.x*blockDim.x < N) in CUDA, but applied per-element in the block."}/>
    <Q d="medium" q="How does Triton's compiler handle shared memory for tl.dot?" a={"When the compiler sees tl.dot(a, b) where a and b are loaded from global memory:\n\n1. Allocates shared memory buffers for both tiles\n2. Inserts barrier (__syncthreads) after loading each tile into shared memory\n3. Maps the dot product to GPU's tensor cores (if available) or FFMA sequences\n4. Software-pipelines: while computing dot on tile k, prefetches tile k+1 from global memory\n\nThis is exactly what a CUDA programmer would do manually with __shared__ arrays and __syncthreads(), but the Triton compiler does it automatically."}/>
    <Q d="medium" q="What is Triton autotuning? Why is it necessary?" a={"@triton.autotune runs a kernel with multiple configurations (different tile sizes, warp counts) and selects the fastest.\n\nNecessary because optimal configuration depends on:\n• Problem size (M, N, K for matmul)\n• GPU architecture (register count, shared memory, tensor core width)\n• L2 cache size and memory bandwidth\n• Interaction between occupancy and register pressure\n\nNo single config is optimal for all cases. Autotuning empirically finds the best one. This is a key advantage over CUDA where you must manually tune."}/>
    <Q d="medium" q="Explain the Triton compilation pipeline end-to-end." a={"1. Python AST: @triton.jit decorated function parsed\n2. Triton IR (MLIR-based): block-level operations (tl.load, tl.dot, tl.store)\n3. TTIR optimizations: type inference, CSE, constant folding\n4. TTGIR (GPU IR): lower to GPU-specific representation\n   • Memory layout assignment (how blocks map to warps)\n   • Shared memory allocation\n   • Software pipelining\n5. LLVM IR: lower to standard LLVM with NVPTX intrinsics\n6. PTX: LLVM's NVPTX backend\n7. SASS: NVIDIA's ptxas assembler → GPU machine code\n\nKey insight: steps 4-5 are where Triton's compiler does the heavy lifting that CUDA programmers do manually."}/>
    <Q d="hard" q="What is software pipelining in Triton and how does it hide memory latency?" a={"Software pipelining overlaps memory loads with computation across loop iterations.\n\nWithout pipelining:\n  for k: load_tile(k) → sync → compute(k) → sync → store\n  Problem: compute waits for load to finish (400 cycles for DRAM)\n\nWith pipelining (num_stages=3):\n  load(k=0)\n  load(k=1), compute(k=0)         ← overlap!\n  load(k=2), compute(k=1)         ← steady state: always loading + computing\n  ...\n  compute(k=last)\n\nTriton's compiler inserts this automatically via the 'num_stages' parameter in triton.Config. Each stage uses a separate shared memory buffer (double or triple buffering).\n\nThis is analogous to Hexagon's software pipeliner (MachinePipeliner) — overlapping loop iterations to fill hardware slots. Same concept, GPU context."}/>
    <Q d="hard" q="How does Triton compare to CUDA for FlashAttention?" a={"FlashAttention fuses Q×K^T → softmax → ×V into one kernel, avoiding materializing the NxN attention matrix.\n\nCUDA FlashAttention (Dao et al.):\n• ~500 lines of optimized CUDA\n• Manual shared memory management, tiling, online softmax\n• Months of development to get right\n\nTriton FlashAttention:\n• ~150 lines of Triton\n• tl.dot for matmuls, tl.exp/tl.sum for softmax\n• Autotuning finds optimal tile sizes\n• Performance: 90-95% of CUDA version\n\nTrade-off: CUDA gives 5-10% more performance for 3-4× more development effort. For most applications, Triton's productivity wins."}/>
    <Q d="hard" q="What are Triton's limitations compared to CUDA?" a={"1. Limited control: cannot directly manage shared memory layout, warp-level primitives (__shfl), or cooperative groups\n\n2. Block-level only: some algorithms need thread-level control (prefix scan variants, complex reductions)\n\n3. NVIDIA-first: Triton's AMD/Intel backends are less mature than CUDA\n\n4. Debugging: harder to debug than CUDA (no printf per thread, no cuda-gdb equivalent)\n\n5. Complex memory patterns: scatter/gather and irregular access patterns are harder to express efficiently\n\n6. No inline PTX: CUDA allows __asm__ for critical hot spots\n\n7. Tensor cores: Triton uses them automatically via tl.dot, but you can't control MMA instruction selection as precisely as in CUDA"}/>
    <Q d="hard" q="What is the role of memory layouts in Triton's compiler?" a={"Memory layouts determine how block-level tensors are distributed across GPU threads and registers.\n\nKey layouts:\n• Blocked layout: block elements split across warps in a regular tiled pattern\n• Shared layout: elements stored in shared memory with bank-conflict-free access patterns\n• Dot operand layout: elements arranged for optimal tensor core consumption\n\nThe compiler's layout assignment pass determines which layout each intermediate value uses. Layout conversions (e.g., blocked → shared for tl.dot inputs) require shared memory and barriers.\n\nOptimizing layout assignments is one of the most impactful parts of the Triton compiler — wrong layouts cause extra shared memory round-trips that kill performance."}/>
  </S>
</div>
),

/* ── MLIR ── */
mlir:()=>(
<div>
  <S title="1. What is MLIR & Why Did It Happen?">
    <Card title="The O(N × M) Compiler Problem" color={tk.amber}>
      <strong>The Old World:</strong> We have N frontends (PyTorch, TensorFlow, JAX, C++) and M backends (Nvidia, AMD, Intel, TPU, Inferentia). <br/>
      If every framework wrote a direct lowering to every hardware backend, we'd need <strong>N × M</strong> compilers. <br/><br/>
      <strong>The LLVM Solution:</strong> LLVM solved this for CPUs/GPUs by introducing a common intermediate representation (IR). N frontends → LLVM IR → M backends. Now it's <strong>N + M</strong> phase complexity.
    </Card>

    <Card title="The MLIR Solution: Dialects" color={tk.accent}>
      <strong>The Problem with LLVM IR:</strong> LLVM IR is too low-level for machine learning. It doesn't understand "tensors", "convolutions", or "loops". It only understands scalar operations, vectors, and pointers.<br/><br/>
      <strong>MLIR (Multi-Level Intermediate Representation):</strong> Instead of a single "one-size-fits-all" IR, MLIR is a meta-compiler framework. It allows you to define custom <strong>Dialects</strong> (e.g., Linalg for linear algebra, SCF for structured control flow). You progressively lower high-level concepts down to hardware instructions step-by-step.
    </Card>

    <Diagram title="Progressive Lowering in MLIR" horizontal>
      <Node label="PyTorch / JAX" desc="High-level Python" color={tk.orange}/>
      <Arrow label="Torch-MLIR" vertical={false}/>
      <Node label="Linalg Dialect" desc="Tensors, Matmuls" color={tk.violet}/>
      <Arrow label="Bufferization" vertical={false}/>
      <Node label="MemRef / SCF" desc="Loops, Memory Acc" color={tk.blue}/>
      <Arrow label="Lowering" vertical={false}/>
      <Node label="GPU / Vector" desc="Threads, SIMD" color={tk.cyan}/>
      <Arrow label="LLVM Dialect" vertical={false}/>
      <Node label="PTX / LLVM IR" desc="Hardware specific" color={tk.textDim}/>
    </Diagram>
  </S>

  <S title="2. Key MLIR Concepts">
    <G items={[
      {t:"Dialects", d:"A namespace containing custom Operations, Types, and Attributes. Anyone can create a dialect without hacking the core compiler framework."},
      {t:"Operations (Ops)", d:"Unlike LLVM's fixed instruction set, MLIR operations are completely extensible. An op could be an add `%1 = arith.addi %a, %b` or an entire loop `%res = scf.for ...`."},
      {t:"Regions & Blocks", d:"Operations can contain nested Regions (which contain Blocks of operations). This allows MLIR to cleanly model nested loops without exploding the CFG with branches, unlike LLVM IR."},
      {t:"Pattern Rewriting", d:"The core optimization engine. Developers write declarative patterns (or C++) to match specific subgraphs of operations and replace them with more efficient versions."}
    ]} cols={2}/>
    <C code={`// Example: An MLIR Operation (Linalg matmul)
%result = linalg.matmul 
    ins(%A, %B : tensor<128x128xf32>, tensor<128x128xf32>)
    outs(%C : tensor<128x128xf32>) -> tensor<128x128xf32>
// Notice the types: It natively understands Tensors!
// No pointers, no loops yet. Pure mathematical intent.`} title="MLIR Linalg Dialect" />
  </S>

  <S title="3. The GPU Compilation Pipeline">
    <P>How does a high-level matrix multiplication actually reach the GPU in a modern stack via MLIR?</P>
    <Card title="1. High-Level Operations (Linalg / TOSA)" color={tk.blue}>
      Starts as a pure mathematical operation. Optimization at this level: Operator Fusion, Shape Inference, Algebraic simplification.
    </Card>
    <Card title="2. Structured Control Flow (SCF) & Memory (MemRef)" color={tk.cyan}>
      Tensors (value semantics) are allocated into MemRefs (pointer semantics) during <strong>Bufferization</strong>. The matmul is expanded into `scf.for` loops. Optimization: Loop tiling, unrolling, vectorization.
    </Card>
    <Card title="3. GPU Dialect Thread Mapping" color={tk.accent}>
      Outer loops are mapped to GPU blocks (`gpu.block_id`). Inner loops are mapped to GPU threads (`gpu.thread_id`). Optimization: Shared memory promotion, coalescing.
    </Card>
    <Card title="4. NVVM / ROCDL Dialects" color={tk.violet}>
      Hardware-specific intrinsics. The code is lowered into the LLVM dialect and then to vendor-specific intermediate codes (PTX or AMDGCN) using LLVM's backend.
    </Card>
  </S>

  <S title="MLIR Practice Questions" c={tk.amber}>
    <Q d="easy" q="Why did Google build MLIR instead of just extending LLVM IR?" a={"LLVM IR is designed for C/C++ style imperative languages. It loses high-level structural information (like multi-dimensional arrays or distinct nested loops) as soon as it's generated.\n\nFor Machine Learning, we need to optimize massive tensor operations mathematically before implementing them as loops. If we go straight to LLVM IR, the compiler can't easily perform high-level loop tiling across 4 dimensions because it just sees a sea of basic blocks and pointers. MLIR adds 'Progressive Lowering' to optimize at the right level of abstraction."}/>
    <Q d="medium" q="What is Bufferization?" a={"In MLIR, AI models start with value semantics (Tensors). A Tensor mathematically has no memory address; it's a pure mathematical value.\n\nHowever, hardware requires pointer semantics (MemRef). They need allocated memory buffers. Bufferization is the highly complex MLIR pass that converts Tensor operations into MemRef operations, deciding when to allocate new buffers, when to perform in-place updates, and when to copy memory to avoid destroying active values."}/>
    <Q d="medium" q="Explain how MLIR handles loops differently than LLVM IR." a={"LLVM IR handles loops purely through Control Flow Graph (CFG) branches and phi nodes. The loop structure is implicit.\n\nMLIR models loops as nested regions. The `scf.for` operation physically contains the loop body inside a region. This explicit structural representation makes loop transformations (tiling, unrolling, fusion) dramatically easier and safer to write because you don't have to reconstruct the loop via dominator trees and back-edges."}/>
    <Q d="hard" q="How do Pattern Rewriters work in MLIR?" a={"Pattern rewriting is how lowering and optimizations happen. A pattern defines a 'Match' (a structural shape of operations and attributes) and a 'Rewrite' (what to replace it with).\n\nMLIR applies these patterns greedily using a DRR (Declarative Rewrite Rules) system or C++ matching. For example, a pattern might match `linalg.matmul` and rewrite it into nested `scf.for` loops iterating over `memref`s. The greedy pattern rewriter maintains a worklist and applies transformations until a fixed point is reached."}/>
  </S>
</div>
),

/* ── PYTORCH ── */
pytorch:()=>(
<div>
  <S title="1. PyTorch Internals — Eager Mode">
    <P>PyTorch's default <strong style={{color:tk.cyan}}>eager mode</strong> executes operations immediately as Python calls them — no graph building, no compilation. This makes debugging trivial (just use pdb!) but leaves massive optimization opportunities on the table. <code style={{color:tk.cyan}}>torch.compile</code> (PyTorch 2.0+) bridges this gap.</P>
    <Card title="Eager Mode vs The Compiler" color={tk.orange}>
      <code>y = torch.relu(x @ W + b)</code><br/>
      In Eager Mode, this immediately dispatches 3 separate GPU kernels (matmul, add, relu). That's <strong>three global memory round-trips</strong>! A fused compiled kernel computes this in ONE launch without writing intermediates to DRAM.
    </Card>

    <G items={[
      {t:"Tensor Internals", d:"`.data_ptr()` (raw GPU pointer), `.shape` (logical dims), `.stride()` (step sizes per dim), `.grad_fn` (pointer to autograd Node). Calling `.transpose()` just changes the strides, the underlying storage remains the same!"},
      {t:"Autograd (Reverse-mode AD)", d:"Tape-based. Forward pass: `z = x * y` creates a `MulBackward` node. Backward pass: `z.backward()` traverses the DAG in reverse topological order, computing `local Jacobian × incoming gradient` via the chain rule."}
    ]} cols={2}/>
  </S>

  <S title="2. torch.compile — The Full Pipeline">
    <Diagram title="The Compilation Pipeline" horizontal={true}>
      <Node label="TorchDynamo" desc="Captures Python AST into FX Graph" color={tk.blue}/>
      <Arrow label="FX Graph" />
      <Node label="AOTAutograd" desc="Traces Backward Pass" color={tk.violet}/>
      <Arrow label="Joint Graph" />
      <Node label="TorchInductor" desc="Generates Triton/C++" color={tk.accent}/>
    </Diagram>

    <G items={[
      {t:"1. TorchDynamo & Graph Breaks", d:"Hooks into CPython's frame evaluation to trace ops into an FX Graph. If it hits unsupported Python (e.g., data-dependent control flow `if x.item() > 0`), it creates a 'Graph Break', splitting the graph into subgraphs with Python glue in between. Bad for performance!"},
      {t:"2. AOTAutograd", d:"Normally, PyTorch builds the autograd graph dynamically at runtime. AOTAutograd traces the backward pass ONCE ahead of time. Both forward and backward passes become static graphs ready for Inductor optimization."},
      {t:"3. TorchInductor (Code Gen)", d:"Lowers the FX Graph to Triton (GPU) or C++/OpenMP (CPU). It performs Operator Fusion, Memory Planning, and Tiling to generate highly optimized kernels."}
    ]} cols={3}/>
  </S>

  <S title="3. Operator Fusion in Inductor">
    <Card title="Fusion is the Key to Performance" color={tk.teal}>
      Unfused (Eager): 3 kernels, 6N memory round-trips.<br/>
      Fused (Inductor): 1 Triton kernel, 2N memory round-trips.<br/><br/>
      <strong>Fusion Rules:</strong><br/>
      - Pointwise + Pointwise → ALWAYS fuse.<br/>
      - Reduction + Pointwise → Fuse pointwise into reduction epilogue.<br/>
      - Matmul + Pointwise → Fuse bias/activation into matmul epilogue.
    </Card>
    
    <B type="interview"><strong>Interview Tip:</strong> <code>torch.compile</code> is the future of PyTorch performance. If asked about ML compiler stacks, walk through: "Dynamo captures the Python model as an FX graph. AOTAutograd traces both forward and backward. Inductor generates fused Triton kernels. The key optimization is operator fusion — eliminating intermediate memory traffic."</B>
  </S>

  <S title="PyTorch Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is eager mode vs compiled mode in PyTorch?" a={"Eager mode: operations execute immediately as Python calls them. Each op dispatches a separate GPU kernel. Simple to debug (pdb, print work), but slow — no cross-op optimization.\n\nCompiled mode (torch.compile): traces the model into a graph, optimizes it (fusion, memory planning), generates efficient GPU kernels. First call is slow (compilation), subsequent calls are fast.\n\nTrade-off: eager = developer productivity. Compiled = production performance. torch.compile tries to give both."}/>
    <Q d="easy" q="What is a graph break in TorchDynamo?" a={"A graph break occurs when Dynamo encounters Python code it can't trace into the FX graph — like data-dependent control flow (if tensor.item() > 0), print(), or unsupported Python constructs.\n\nEffect: Dynamo splits execution into multiple subgraphs with Python code between them. Each subgraph is independently compiled, but fusion across the break is impossible.\n\nFix: restructure code to avoid graph breaks. Use torch.where instead of if-else, avoid .item(), minimize Python iteration over tensor data."}/>
    <Q d="easy" q="What is autograd? How does it work?" a={"Autograd = automatic differentiation. PyTorch builds a computational graph during forward pass. Each operation records: what inputs it received, how to compute gradients.\n\nBackward pass: traverse graph in reverse topological order. At each node: multiply incoming gradient by local Jacobian (chain rule). Accumulate into .grad tensors.\n\nThis is reverse-mode AD (backpropagation). Efficient for many-output → one-loss functions (typical in ML). Cost: one forward + one backward pass, regardless of number of parameters."}/>
    <Q d="medium" q="What does AOTAutograd do and why is it important?" a={"AOTAutograd (Ahead-Of-Time Autograd) traces the backward pass at compile time, not runtime.\n\nNormally: autograd builds a new computation graph every forward pass (dynamic).\nAOTAutograd: traces backward once, produces a static graph for both forward and backward.\n\nBenefits:\n1. Backward pass is now a static graph → can be compiled and fused just like forward\n2. Decompositions: complex ops (batch_norm) broken into primitives → more fusion\n3. No runtime autograd overhead (graph building, Node allocation)\n\nResult: backward pass gets the same Inductor treatment → fused Triton kernels for gradients."}/>
    <Q d="medium" q="What is operator fusion? Give a concrete GPU performance example." a={"Fusion: merging multiple operations into one GPU kernel.\n\nExample: y = relu(x @ W + b)\nUnfused: 3 kernels: matmul, add, relu. Each writes to and reads from global memory (HBM).\nFused: matmul writes to registers → add bias in registers → relu in registers → write final result.\n\nPerformance difference:\n  Unfused: 3 kernel launches + 4×N×M memory round-trips (intermediate tensors)\n  Fused: 1 kernel + 2×N×M memory (input + output only)\n  \nFor a 1024×1024 tensor at fp32: unfused writes 16MB of intermediates, fused writes 0.\nReal-world: 2-4× speedup for transformer inference from fusion alone."}/>
    <Q d="medium" q="What is TorchInductor's code generation strategy?" a={"Inductor takes the optimized FX graph and generates code:\n\nFor GPU:\n1. Identify fusible operation groups (connected pointwise chains, reductions)\n2. Generate Triton kernels for each fused group\n3. For matmuls: call optimized libraries (cuBLAS, CUTLASS) or generate Triton matmul\n4. Generate a Python wrapper that manages tensor allocation and kernel launches\n\nFor CPU:\n1. Generate C++ with OpenMP parallelization\n2. Use vectorization hints for SIMD\n3. Call MKL/oneDNN for optimized matmuls\n\nThe generated code is cached (by input shapes + dtypes) for reuse."}/>
    <Q d="hard" q="What is torch.compile's reduce-overhead mode? What are CUDA graphs?" a={"reduce-overhead mode uses CUDA graphs to minimize kernel launch overhead.\n\nCUDA Graph: records a sequence of kernel launches, then replays the entire sequence with ONE CPU-side call.\n\nNormal execution: each kernel launch goes through: Python → C++ dispatcher → CUDA driver → GPU. ~5-10μs per launch.\n\nWith CUDA graph: entire sequence recorded once. Replay: ~1μs total for ALL kernels. 10-100× less launch overhead.\n\nRestrictions:\n• All inputs must have the same shapes (no dynamic shapes)\n• Cannot use CPU-GPU synchronization inside the graph\n• Memory addresses are fixed (no reallocation)\n\nBest for: inference with fixed batch size, repetitive training loops."}/>
    <Q d="hard" q="How does torch.compile differ from TorchScript (torch.jit)?" a={"TorchScript (torch.jit.script/trace): older approach. Converts Python to a restricted TorchScript IR.\n• Requires code to be TorchScript-compatible (limited Python subset)\n• No operator fusion across ops (just captures the graph)\n• Difficult to maintain and debug\n\ntorch.compile: newer (PyTorch 2.0+). Uses TorchDynamo + AOTAutograd + Inductor.\n• Traces actual Python execution (handles more Python constructs)\n• Full operator fusion via Inductor\n• Falls back gracefully (graph breaks instead of errors)\n• Makes backward pass static (AOTAutograd)\n\ntorch.compile is strictly more powerful and is the recommended approach. TorchScript is being deprecated."}/>
    <Q d="hard" q="What are decompositions in AOTAutograd and why do they matter?" a={"Decompositions break complex operations into simpler primitives.\n\nExample: LayerNorm(x) decomposes into:\n  mean = x.mean(dim=-1, keepdim=True)\n  var = ((x - mean) ** 2).mean(dim=-1, keepdim=True)\n  x_norm = (x - mean) / sqrt(var + eps)\n  return x_norm * gamma + beta\n\nWhy: LayerNorm as a single op → one opaque kernel call (can't fuse with surrounding ops).\nDecomposed: mean, subtract, square, divide, multiply, add → all pointwise/reduction → can be FUSED with surrounding operations.\n\nResult: instead of [separate kernel for LayerNorm] + [separate kernel for residual add], Inductor generates ONE fused kernel for [LayerNorm + residual + dropout]. Fewer memory round-trips."}/>
    <Q d="hard" q="What is the difference between torch.compile backends?" a={"torch.compile(model, backend='...') supports multiple backends:\n\n'inductor' (default): generates Triton/C++ code. Best general performance.\n'aot_eager': AOTAutograd + eager execution. For debugging (verifies graph capture works).\n'cudagraphs': wraps eager execution in CUDA graphs. Less optimization than Inductor.\n\nCustom backends (via torch._dynamo.register_backend):\n• TensorRT: NVIDIA's inference optimizer. Best for fixed-shape deployment.\n• ONNX: export to ONNX format for cross-framework deployment.\n• Custom compiler research: plug in your own FX graph → optimized code pipeline.\n\nFor production: 'inductor' with mode='max-autotune' gives best performance."}/>
  </S>
</div>
),

/* ── MOJO ── */
mojo:()=>(
<div>
  <S title="1. Mojo Language — The MLIR-Native Language">
    <P>Mojo is a new language from Modular designed to be a <strong style={{color:tk.cyan}}>superset of Python</strong> with systems-level performance. It compiles through MLIR, targeting CPUs, GPUs, and custom accelerators. Think of it as "Python meets Rust meets CUDA" with direct MLIR access.</P>
    <G items={[
      {t:"Ownership & Borrowing", d:"Rust-inspired without the GC. `owned` (takes ownership), `borrowed` (immutable ref), `inout` (mutable ref). Deterministic destruction."},
      {t:"SIMD as First-Class Type", d:"`SIMD[DType.float32, 8](1.0)`. No `__m256` intrinsics needed. The language type directly maps to hardware SIMD registers."},
      {t:"Compile-Time Metaprogramming", d:"`fn matmul[M: Int](...)`. `M` is a compile-time parameter (like C++ templates). `@parameter if M > 1024:` is evaluated at compile time, eliminating dead code branches."},
      {t:"Strict vs Dynamic", d:"`def` is dynamic Python (borrowed by default, exceptions allowed). `fn` is strict (requires types, explicit ownership, no exceptions by default)."}
    ]} cols={2}/>
  </S>

  <S title="2. MLIR Connection & Compilation">
    <Diagram title="Mojo Progressive Lowering" horizontal={true}>
      <Node label="Mojo AST" />
      <Arrow />
      <Node label="Mojo IR" color={tk.teal} />
      <Arrow label="MLIR" />
      <Node label="Affine / SCF" color={tk.violet} />
      <Arrow label="MLIR" />
      <Node label="LLVM Dialect" color={tk.blue} />
      <Arrow />
      <Node label="Machine Code" color={tk.textDim} />
    </Diagram>
    
    <Card title="Why MLIR Matters for Mojo" color={tk.accent}>
      LLVM IR is too low-level for ML (only scalars/vectors/pointers). MLIR allows <strong>multiple abstraction levels</strong>. High-level (tensor ops → tiling), Mid-level (affine loops → polyhedral opts), Low-level (LLVM dialect → hardware). Mojo programs can target ANY MLIR backend (CPU, GPU, custom accelerators).
    </Card>

    <B type="interview"><strong>Interview Tip:</strong> Connect Mojo to your ClangIR experience. "I've worked with MLIR through ClangIR (CIR)... Mojo uses the same pattern — MLIR dialects at multiple abstraction levels, lowering progressively to LLVM IR. The key insight is that MLIR enables progressive lowering with optimizations at each level."</B>
  </S>

  <S title="3. MAX Platform & Comparison Table">
    <Card title="The MAX Engine" color={tk.orange}>
      Modular's inference engine deploys ML models (PyTorch, TensorFlow, ONNX) on any hardware without needing CUDA. You can seamlessly integrate custom Mojo ops.
    </Card>
    
    <Table headers={["Feature", "CUDA", "Triton", "Mojo", "Python"]} rows={[
      ["Abstraction", "Thread", "Block", "Varies", "High"],
      ["Performance", "100%", "90-95%", "85-100%", "1-5%"],
      ["Productivity", "Low", "Medium", "High", "Highest"],
      ["Hardware", "NVIDIA only", "NV + AMD", "All (via MLIR)", "Cross-platform"],
      ["Memory Model", "Manual", "Auto", "Ownership", "Garbage Collected"]
    ]}/>
  </S>

  <S title="Mojo Practice Questions" c={tk.amber}>
    <Q d="easy" q="What is Mojo and how does it relate to Python?" a={"Mojo is a compiled language designed as a superset of Python — valid Python is (mostly) valid Mojo. It adds:\n• Static types (optional, but needed for performance)\n• Ownership model (like Rust: owned, borrowed, inout)\n• SIMD as first-class types\n• Compile-time metaprogramming (@parameter, alias)\n\nGoal: Python's usability + C++/Rust performance. A Mojo function with type annotations can be 35,000× faster than equivalent Python."}/>
    <Q d="easy" q="What is MLIR and why does it matter for Mojo?" a={"MLIR (Multi-Level IR) is an LLVM subproject for building compiler IRs at multiple abstraction levels.\n\nUnlike LLVM IR (single level, close to hardware), MLIR supports multiple 'dialects' at different abstraction levels — from high-level tensor ops down to machine instructions.\n\nMojo compiles through MLIR dialects, enabling:\n• High-level optimizations (tiling, fusion) at tensor level\n• Progressive lowering through affine → memref → LLVM\n• Hardware-agnostic: same source can target CPU, GPU, or accelerator via different MLIR backends"}/>
    <Q d="medium" q="How does Mojo's ownership model compare to C++ and Rust?" a={"Mojo's ownership is closest to Rust but with Python-like ergonomics:\n\n• owned: function takes ownership. Original variable becomes invalid (like Rust move).\n• borrowed: immutable reference (default for 'def' functions). Like const& in C++.\n• inout: mutable reference. Like T& in C++, &mut T in Rust.\n\nKey differences from Rust:\n• No borrow checker as strict as Rust's (simpler lifetime rules)\n• 'def' functions use borrowed by default (Python-like feel)\n• 'fn' functions require explicit annotations\n\nKey differences from C++:\n• No dangling references (ownership tracked at compile time)\n• No raw pointers by default\n• Deterministic destruction (like C++ RAII, unlike Rust's more complex drop semantics)"}/>
    <Q d="medium" q="What is the difference between 'fn' and 'def' in Mojo?" a={"def: Python-compatible. Dynamic typing allowed. Arguments are borrowed by default. Can raise exceptions. For prototyping and Python interop.\n\nfn: Strict mode. All types must be declared. Arguments are 'borrowed' by default but ownership explicit. Cannot raise exceptions (unless decorated with 'raises'). For performance-critical code.\n\nPractical pattern:\n  def research_prototype(model, data):  # quick iteration, Python-like\n      ...\n  fn optimized_kernel[T: DType](data: Tensor[T]) -> Tensor[T]:  # production\n      ...  # compiler can fully optimize with known types"}/>
    <Q d="medium" q="How does SIMD work as a first-class type in Mojo?" a={"In Mojo, SIMD is a built-in parameterized type:\n  var v = SIMD[DType.float32, 8](1.0)  # 8-wide f32 vector\n  var u = SIMD[DType.float32, 8](2.0)\n  var w = v * u + v  # compiles to: vfmadd or vmul+vadd instructions\n\nNo intrinsics! No _mm256_mul_ps(). The language type directly maps to hardware SIMD.\n\nWidth adapts to hardware:\n  alias simd_width = simdwidthof[DType.float32]()  # 4 on Neon, 8 on AVX2, 16 on AVX-512\n  # Write once, optimal SIMD width everywhere.\n\nThis is much cleaner than C++ intrinsics or LLVM vector types."}/>
    <Q d="hard" q="How does Mojo's compilation pipeline compare to ClangIR (CIR)?" a={"Both use the same architectural pattern: MLIR-based progressive lowering.\n\nClangIR (CIR):\n  C/C++ → Clang AST → CIR (MLIR dialect) → LLVM IR → machine code\n  CIR sits between AST and LLVM IR. Enables source-level optimizations.\n\nMojo:\n  Mojo source → Mojo IR (MLIR dialect) → [affine/scf/tensor/memref dialects] → LLVM IR → machine code\n  Mojo has MORE MLIR levels (affine loops, tensor ops) because it needs higher-level optimizations.\n\nKey similarity: both use MLIR's dialect infrastructure for type-safe IR transformations.\nKey difference: CIR is one dialect above LLVM IR. Mojo uses multiple progressive levels.\n\nIf you've worked with CIR's lowering patterns (cir.call_llvm_intrinsic and friends), that mental model transfers directly to reasoning about Mojo's compiler architecture."}/>
    <Q d="hard" q="What is MAX Engine and how does it compare to TensorRT?" a={"MAX Engine: Modular's inference engine. Deploys ML models across hardware.\n\nTensorRT (NVIDIA): optimizes and deploys models specifically on NVIDIA GPUs.\n  • Pros: best NVIDIA GPU performance, mature, production-proven\n  • Cons: NVIDIA-only, complex calibration for INT8, version compatibility issues\n\nMAX Engine:\n  • Pros: hardware-agnostic (CPU + GPU + accelerators via MLIR), simpler API, Mojo custom ops\n  • Cons: newer, smaller ecosystem, less production track record\n\nFor Qualcomm: MAX's hardware-agnostic approach is interesting because it could target Qualcomm's AI Engine/Hexagon via custom MLIR backends — without requiring CUDA."}/>
    <Q d="hard" q="What are Mojo's compile-time features? How do they compare to C++ templates?" a={"Mojo has three compile-time mechanisms:\n\n1. alias: compile-time constants (like constexpr in C++)\n   alias PI = 3.14159  # substituted at compile time\n\n2. Parameters (square brackets): like C++ template parameters\n   fn process[T: DType, N: Int](data: SIMD[T, N]):  # monomorphized per (T, N)\n\n3. @parameter if: compile-time conditional (like if constexpr in C++17)\n   @parameter\n   if N > 256: use_tiled()  # dead branch completely eliminated\n\nAdvantages over C++:\n• Much cleaner syntax (no template<typename T> boilerplate)\n• Better error messages (no SFINAE maze)\n• Integrated with the ownership system\n• @parameter for (compile-time loops) — unrolls at compile time\n\nSimilar power to C++ templates but far more readable."}/>
  </S>
</div>
),

/* ── PRESENTING YOUR BACKGROUND (worked examples) ── */
resume:()=>(
<div>
  <B type="interview">This module is a <strong>template, not a script</strong>. The structures and scaffolds are what to reuse; the projects in each <strong>Example</strong> are illustrations of the right level of specificity — swap in your own.</B>

  <S title="1. 'Tell Me About Yourself' — the 90-second structure">
    <P>Open with a tight, four-beat self-intro, then close on why this team. Keep it to ~90 seconds and rehearse it out loud until it sounds natural, not memorized.</P>
    <G items={[
      {t:"1 · One-line identity",d:"Who you are as an engineer in a sentence: your domain plus the 2–3 areas you're strongest in."},
      {t:"2 · Headline proof",d:"Your single most impressive, relevant artifact — a merged contribution, a shipped system, a measured result. Concrete beats broad."},
      {t:"3 · Supporting depth",d:"One or two more projects that show range (frontend↔backend, research↔production, breadth of stack)."},
      {t:"4 · Why this team",d:"A specific reason tied to what THIS company uniquely does — not generic praise anyone could give."},
    ]} cols={2}/>
    <Card title="Example — a compiler-engineer pitch" color={tk.accent}>
      <em>(An illustration of the four beats — substitute your own projects.)</em><br/><br/>
      "I'm a compiler engineer with experience spanning LLVM backend development, Fortran frontend work, and HPC compilation.<br/><br/>
      Most recently I landed a merged patch in LLVM upstream — adding rdtsc/rdtscp builtins to ClangIR, the new MLIR-based frontend. That meant navigating a 20-million-line codebase, MLIR dialect lowering, and community code review.<br/><br/>
      Before that I redesigned a Fortran compiler's OpenMP region IR — 13+ constructs and GPU offloading — and compiled POT3D, a 20K-line astrophysics codebase, to about 0.95× GFortran parity.<br/><br/>
      I'm drawn to teams that own both the silicon and the compiler — on a VLIW target the compiler IS the performance, because there's no out-of-order hardware to hide a bad schedule. That's the hardest, most interesting problem in compilers."
    </Card>
  </S>

  <S title="2. Walking an interviewer through an open-source contribution" c={tk.blue}>
    <B type="tip"><strong>The reusable 5-beat structure.</strong> Whatever your contribution is, narrate it as: (1) <strong>Context</strong> — what the project/subsystem is and why the change was needed. (2) <strong>What changed</strong> — the specific code path, top-down. (3) <strong>The hard part</strong> — the one genuinely tricky thing you had to understand. (4) <strong>Testing</strong> — how you proved it correct. (5) <strong>Review &amp; lesson</strong> — feedback you got and what you took from it. Keep it to ~2 minutes and let the interviewer pull the threads they care about.</B>
    <Q d="must" q="Example: walking through a ClangIR builtin contribution" a={"(A worked example of the 5-beat structure above — substitute your own contribution.)\n\nContext: ClangIR (CIR) is a new MLIR-based IR sitting between Clang AST and LLVM IR. It needed codegen for the __rdtsc()/__rdtscp() x86 builtins.\n\nWhat changed:\n1. CIRGenBuiltinX86.cpp: recognize __rdtsc/__rdtscp from the AST\n2. Emit cir.call_llvm_intrinsic for 'x86.rdtsc' returning i64 in CIR\n3. For rdtscp (returns struct{uint64_t tsc, uint32_t proc_id}): ExtractMemberOp per field, store processor_id through the aux uint32_t* argument\n4. CIR-to-LLVM lowering: cir.call_llvm_intrinsic → @llvm.x86.rdtsc()\n\nThe hard part: cir.call_llvm_intrinsic isn't a plain call — it's an MLIR op that carries the intrinsic name as a string attribute and is lowered through the CIR→LLVM dialect conversion. Getting the struct-return types right meant tracing several layers of the CIR type system.\n\nTesting: triple FileCheck — CHECK-CIR (CIR correct), CHECK-LLVM (lowering correct), CHECK-OGCG (parity with old codegen).\n\nReview & lesson: a reviewer flagged a hardcoded alignment that should come from the framework, plus test-naming conventions. The lesson — in a 20M-LOC codebase, trust existing infrastructure for cross-cutting concerns instead of hand-rolling them."}/>
    <Q d="hard" q="Follow-up they'll ask: how would you extend it to a new x86 intrinsic?" a={"Step-by-step (the same approach works for most builtins):\n1. Identify the intrinsic, e.g. __rdpmc (performance counter). Check the x86 SDM for semantics.\n2. CIRGenBuiltinX86.cpp: add a case in the switch for the builtin.\n3. Emit cir.call_llvm_intrinsic with the correct LLVM intrinsic name.\n4. Handle the return type: simple i64? a struct? Match Clang's builtin semantics.\n5. Write FileCheck tests: CHECK-CIR, CHECK-LLVM, CHECK-OGCG.\n6. Build locally: ninja check-clang-cir.\n7. Follow existing builtin patterns and coding conventions for review.\n8. If the intrinsic isn't in LLVM's table yet, add it to IntrinsicsX86.td first."}/>
  </S>

  <S title="3. Explaining a substantial project (worked examples)" c={tk.blue}>
    <B type="tip">Same shape as a PR walkthrough, one level up: <strong>what the system is → what you designed → why that design → why it matters</strong>. Lead with the design decision, not a feature list.</B>
    <Q d="must" q="Example: redesigning a compiler's OpenMP support (GSoC-style project)" a={"(Worked example — frame your own large project the same way.)\n\nWhat it was: redesigning a Fortran compiler's OpenMP support at the ASR (Abstract Semantic Representation) level — the compiler's core IR.\n\nWhat was built:\n• OMPRegion ASR node: a new IR construct for an OpenMP parallel region\n• 13+ constructs (parallel, do, sections, critical, atomic, barrier, …)\n• 8+ clause types (private, shared, firstprivate, reduction, schedule, …)\n• GPU offloading via target/teams/distribute, plus a <250-LOC emulator to test offloading without hardware\n\nKey design decision: make the region IR-level rather than a runtime-call expansion, so the compiler can analyze and optimize OpenMP regions (loop interchange, data-movement, device selection) BEFORE lowering to runtime calls — mirroring LLVM's OMPIRBuilder, one level higher.\n\nWhy it matters: scientific Fortran lives on OpenMP; representing it in the IR is what makes those optimizations possible at all."}/>
    <Q d="medium" q="Example: porting a real 20K-line codebase to a new compiler" a={"(Worked example.)\n\nProject: compiling POT3D — a 20K-line astrophysics Fortran code (solar coronal fields, MPI-parallel) — with a new Fortran compiler.\n\nWhat it took:\n• 30+ MPI wrapper functions (MPI_Send/Recv/Allreduce, …)\n• Fortran's pass-everything-by-reference calling conventions\n• Debugging real-world features: array slicing, implicit interfaces, module dependency cycles\n• ~0.95× compile-time parity with GFortran\n\nWhy it works as a story: compiling a messy real codebase — not toy examples — is the strongest evidence you can handle production code in an unfamiliar compiler."}/>
    <Q d="medium" q="Example: discussing a research result" a={"(Worked example.)\n\nA study comparing MPI vs OpenMP parallelization on RISC-V hardware (SiFive boards) for matrix and stencil workloads, published in FGCS (Elsevier).\n\nFindings:\n• OpenMP hit 3.42× over a serial baseline on 4-core RISC-V\n• MPI carried higher process-creation overhead on the simple in-order microarchitecture\n• Hybrid MPI+OpenMP won for multi-node configurations\n\nWhy it's a good hook: simpler in-order pipelines make compiler optimization matter MORE — which is exactly the argument for DSPs like Hexagon. Lead a research story with the single finding that connects to the team you're talking to."}/>
  </S>
</div>
),

/* ── 120 MOCK QUESTIONS ── */
mock:()=>(
<div>
  <S title="SSA & Compiler Theory — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What is the single static assignment property?" a={"Every variable is defined exactly once. Each use traces to exactly one definition. This enables O(1) def-use chains and simplifies most compiler analyses and optimizations."}/>
    <Q d="easy" q="What is a basic block?" a={"A maximal sequence of instructions with: one entry point (first instruction), one exit point (terminator), and no branches in the middle. Control flow only enters at the top and exits at the bottom."}/>
    <Q d="medium" q="When would a phi node have three operands?" a={"When the basic block has three predecessor blocks in the CFG. Each operand corresponds to one predecessor path. Example: a switch statement with 3 cases all flowing to the same merge block."}/>
    <Q d="medium" q="What is the relationship between dominator trees and SSA construction?" a={"Phi nodes are placed at iterated dominance frontiers of definition blocks. The renaming phase uses DFS of the dominator tree. Without the dominator tree, you cannot construct minimal SSA form."}/>
    <Q d="hard" q="What is pruned SSA form?" a={"Place phi only where the variable is LIVE at the join point (not just at every dominance frontier). Reduces phi count by 30-50%. Requires liveness analysis, but results in smaller, faster-to-optimize IR."}/>
  </S>

  <S title="LLVM IR & Passes — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What does llvm::Value represent?" a={"Every SSA value in LLVM. Instructions, arguments, constants are all Values. Each Value has a type and a use-list. The use-list makes it trivial to find all users of any value."}/>
    <Q d="easy" q="What is the difference between isa<>, cast<>, and dyn_cast<> in LLVM?" a={"isa<T>(V): returns bool, checks type. cast<T>(V): asserts type and casts (crashes if wrong). dyn_cast<T>(V): returns T* if match, nullptr if not. Use dyn_cast in if-statements."}/>
    <Q d="medium" q="Why does InstCombine run so many times in the pipeline?" a={"Each optimization pass creates new opportunities for algebraic simplification. Inlining exposes new constants. GVN eliminates redundancies exposing new patterns. InstCombine canonicalizes after each."}/>
    <Q d="medium" q="What is the difference between SROA and mem2reg?" a={"mem2reg: promotes simple alloca/load/store patterns to SSA. SROA: more powerful — splits struct allocas into per-field allocas, then promotes each. SROA subsumes mem2reg."}/>
    <Q d="hard" q="What is loop rotation and why does LICM need it?" a={"Loop rotation transforms while(c){body} into if(c) do{body}while(c). This creates a preheader block (the 'if') where LICM can safely place hoisted code. Without a preheader, LICM has nowhere to put hoisted instructions."}/>
    <Q d="hard" q="What is SelectionDAG and why is it per-basic-block?" a={"The DAG of SDNodes representing one basic block's instructions. Per-block because: scheduling within a block is simpler (no branch concerns), and basic blocks are the natural granularity for register pressure management."}/>
  </S>

  <S title="C++ — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What is the Rule of Five?" a={"If you define any of: destructor, copy constructor, copy assignment, move constructor, move assignment — you should define ALL FIVE. Compiler-generated defaults may be wrong for resource-managing classes."}/>
    <Q d="easy" q="What is a lambda in C++? How does it work internally?" a={"A lambda is syntactic sugar for an anonymous class with operator(). Captures become member variables. [=] copies values, [&] takes references. The compiler generates a unique closure type."}/>
    <Q d="medium" q="What is std::optional and when should you use it?" a={"std::optional<T> holds either a T value or nothing (nullopt). Use instead of: sentinel values (magic numbers), pointers (nullable pointers for non-owning optional), exceptions (for expected absence). Has value() and value_or(default)."}/>
    <Q d="medium" q="What is strict aliasing? What breaks it?" a={"C/C++ rule: pointers to different types cannot alias (with char* exception). Enables TBAA optimizations. Broken by: type-punning through pointer casts, union-based type punning (C++ UB, C allowed). Fix: use memcpy or std::bit_cast."}/>
    <Q d="hard" q="What is std::variant and how does the compiler implement it?" a={"Type-safe discriminated union. Stores ONE of N types + a discriminant (index of active type). sizeof = max(sizeof(types)) + alignment padding + discriminant. std::visit dispatches to correct handler via jump table."}/>
    <Q d="hard" q="What are coroutines in C++20? How do they relate to compilers?" a={"Coroutines are functions that can suspend and resume. State is saved in a coroutine frame (heap-allocated). The compiler transforms coroutine code into a state machine. co_await, co_yield, co_return are the keywords. Relevant: LLVM has a coroutine lowering pass."}/>
  </S>

  <S title="Backend & Architecture — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What is instruction latency vs throughput?" a={"Latency: cycles from issue to result available (how long one instruction takes). Throughput: instructions per cycle (how many can be in-flight). A multiply might have latency=3 but throughput=1/cycle (pipelined)."}/>
    <Q d="easy" q="What is a TLB miss? How expensive is it?" a={"TLB (Translation Lookaside Buffer) caches virtual→physical page mappings. Miss: walk the page table in memory (multiple DRAM accesses). Cost: 20-100+ cycles. Reduce misses: use huge pages (2MB/1GB), keep hot data on few pages."}/>
    <Q d="medium" q="What is predication and how does AArch64 use it?" a={"Predication: conditional execution without branching. AArch64: CSEL (conditional select), CSINC, CSINV. Eliminates branch misprediction penalty. Compiler's if-conversion pass transforms short if-else to predicated instructions."}/>
    <Q d="medium" q="What is register pressure and how does it affect performance?" a={"Register pressure: number of values live simultaneously. If > physical register count → spills. Spills = memory traffic = slow. High register pressure from: deep expression nesting, many live variables, aggressive inlining/unrolling."}/>
    <Q d="hard" q="What is the microarchitectural difference between ARM and x86?" a={"x86: CISC, variable-length instructions, decoded into micro-ops, complex decoder. Strong memory model (TSO).\nARM: RISC, fixed-length instructions (4 bytes), no micro-op decoding needed, simpler pipeline. Weak memory model.\nPerformance/watt: ARM wins. Peak performance: depends on implementation. x86's TSO gives 'free' acquire/release."}/>
    <Q d="hard" q="What is speculative execution and how does the compiler help?" a={"CPU executes instructions before knowing if they're needed (past branches). If prediction wrong: flush and restart. Compiler helps by: placing unlikely branches on cold paths, providing branch hints (PGO), using select/cmov for predictable short branches, marking functions with likely/unlikely attributes."}/>
  </S>

  <S title="GPU & ML — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What is a GPU SM (Streaming Multiprocessor)?" a={"An SM is the basic processing unit: has its own registers, shared memory, L1 cache, and warp schedulers. A GPU has many SMs (H100: 132 SMs). Each SM runs multiple thread blocks simultaneously."}/>
    <Q d="medium" q="What is mixed-precision training?" a={"Use float16 for forward/backward computation (2× faster, half memory), keep float32 master copy of weights for updates. Requires loss scaling to prevent gradient underflow. Gives ~2× speedup with <1% accuracy loss."}/>
    <Q d="medium" q="What is the difference between data parallelism and model parallelism?" a={"Data parallel: same model on multiple GPUs, different data. Synchronize gradients (AllReduce). Easy, scales well for batch size.\nModel parallel: split model across GPUs (different layers or tensor dimensions). Needed when model doesn't fit on one GPU. Harder to implement."}/>
    <Q d="hard" q="What is FlashAttention and why is it important?" a={"FlashAttention fuses Q×K^T, softmax, and ×V into one kernel. Avoids materializing the N×N attention matrix in HBM. Key technique: tiling + online softmax (compute softmax incrementally per tile). Result: O(N) memory instead of O(N²), 2-4× faster for long sequences."}/>
    <Q d="hard" q="What is quantization and how does it affect compiler code generation?" a={"Quantization: reduce precision from fp32 to int8/int4. 4× less memory, faster compute (int8 tensor cores). Compiler impact: need int8 arithmetic, dequantize/requantize instructions, mixed-precision code generation, and weight-packing layout optimization."}/>
  </S>

  <S title="Systems & Linking — Quick-Fire" c={tk.violet}>
    <Q d="easy" q="What is a segfault?" a={"Segmentation fault: accessing memory the process doesn't have permission for (unmapped page, read-only page). Common causes: null pointer dereference, buffer overflow, use-after-free, stack overflow."}/>
    <Q d="medium" q="What is ASLR and how does it affect debugging?" a={"Address Space Layout Randomization: randomizes base addresses of stack, heap, libraries, executable. Prevents exploit techniques that rely on known addresses. Debugging: need position-independent code (PIC), stack traces show different addresses each run."}/>
    <Q d="hard" q="What is LTO and what optimizations does it uniquely enable?" a={"Link-Time Optimization: optimize across translation unit boundaries. Uniquely enables: cross-file inlining, whole-program devirtualization (only one derived class exists?), inter-module constant propagation, global dead code elimination, whole-program alias analysis."}/>
  </S>
</div>
),

/* ── FULL MOCK INTERVIEW ── */
fullmock:()=>(
<div>
  <S title="Full Mock Interview — 60-Minute Simulation">
    <B type="danger">Practice this OUT LOUD in a quiet room. Time each section. Record on your phone and listen back critically. Reading silently is only 30% as effective as speaking.</B>
  </S>

  <S title="Round 1: Introduction (5 min)" c={tk.blue}>
    <Card title="Script" color={tk.teal}>
      <strong>INTERVIEWER:</strong> "Tell me about yourself and why you're interested in this team."<br/><br/>
      <strong>YOUR SCRIPT (90 seconds):</strong><br/>
      [Use the 'Tell Me About Yourself' script from Resume tab]<br/>
      End with one specific, checkable fact about the team's stack and why it interests you. The shape to aim for: "You own both the silicon and the compiler, and the target is VLIW — the compiler IS the scheduler there, which is one of the hardest and most interesting problems in compilers." Swap in whatever is true of the team you're actually talking to.<br/><br/>
      <strong>FOLLOW-UP:</strong> "What do you know about our compiler stack?"<br/>
      → Name the targets, the ISA features, and the upstream footprint — details you can only get by reading their upstream commits, their public docs and their job posting. The shape: "Your backend is VLIW with 4-slot packets, so scheduling is entirely static — no out-of-order hardware to recover from a bad packet. There's a 1024-bit vector extension on top of it, plus custom ARM cores, so the team spans very different codegen problems." Research this per company; a generic answer here is the single most common way to lose the round.
    </Card>
  </S>

  <S title="Round 2: Compiler Theory (15 min)" c={tk.accent}>
    <G items={[
      {t:"Q1: Explain SSA form. Why does LLVM use it?", d:"Hit: single def per variable, O(1) def-use, enables SCCP/GVN/LICM/DCE. Draw phi examples. Trace Cytron on a loop CFG."},
      {t:"Q2: Walk me through the complete compilation pipeline.", d:"Preprocessor → Lexer → Parser → Sema → Clang CodeGen (alloca) → SROA/mem2reg → Optimizer passes → ISel → RegAlloc → Schedule → Emit. Highlight: Clang emits simple alloca-based IR. SROA elevates to SSA."},
      {t:"Q3: You've contributed to an open-source project. Walk me through it.", d:"Use the 5-beat contribution walkthrough (Resume tab): context → what changed → the hard part → testing → review & lesson. Aim for ~2 minutes; mention the testing strategy and one piece of review feedback you learned from."},
      {t:"Q4: What is alias analysis? Why does it matter for vectorization?", d:"NoAlias/MayAlias/MustAlias. 5 layers. Without strong AA, the vectorizer must assume all pointers alias → can't vectorize anything. On HVX with 1024-bit vectors, that wastes 31 of 32 compute slots."}
    ]} cols={2}/>
  </S>

  <S title="Round 3: C++ Deep Dive (15 min)" c={tk.amber}>
    <G items={[
      {t:"Q5: Explain virtual dispatch. Draw the vtable layout.", d:"Draw: [vptr → vtable]. vtable: [offset-to-top | RTTI | func1 | func2]. AArch64 assembly: ldr x8,[x0]; ldr x8,[x8,#16]; blr x8. Cost: 2 loads + 1 indirect branch = 10-30 cycles."},
      {t:"Q6: What is move semantics? Why does noexcept matter for vector?", d:"Move: steal resources, leave source valid-but-empty. O(1). noexcept: vector uses move if noexcept, copy otherwise."},
      {t:"Q7: Explain the C++ memory model. What is acquire-release?", d:"Compiler AND CPU reorder. ARM especially (weak). release store: all prior writes visible. acquire load: sees all. Draw producer-consumer example."},
      {t:"Q8: What is CRTP? Where does LLVM use it?", d:"static polymorphism: Base<Derived>, static_cast. LLVM: PassInfoMixin, IRBuilder, InstVisitor. Zero vtable overhead."}
    ]} cols={2}/>
  </S>

  <S title="Round 4: System Design (15 min)" c={tk.cyan}>
    <G items={[
      {t:"Q9: Design a new optimization pass for LLVM.", d:"Pick: dead argument elimination. 1. Inherit from PassInfoMixin 2. Implement run(Function&, FAM&) 3. Return correct PreservedAnalyses 4. Write LIT tests with FileCheck 5. Register in PassRegistry.def"},
      {t:"Q10: A loop is not vectorizing. How do you debug it?", d:"-Rpass-missed=loop-vectorize: shows specific reason. Common fixes: add restrict, restructure trip count, loop fission. 'On HVX, missing vectorization wastes 31/32 of compute'."},
      {t:"Q11: How would you optimize compilation for a mobile target?", d:"-Os not -O3 (icache is small). Conservative inlining (threshold 50 not 225). PGO for accurate hot/cold decisions."},
      {t:"Q12: What is the Roofline model?", d:"OI = FLOPs / bytes. Ridge point = peak_compute / peak_bandwidth. Matmul: OI = N/6, compute-bound. Vector add: OI = 1/12, memory-bound."}
    ]} cols={2}/>
  </S>

  <S title="Round 5: Behavioral (10 min)" c={tk.rose}>
    <G items={[
      {t:"Q13: Tell me about a time you dealt with a hard bug.", d:"STAR shape (example): a module dependency cycle causing an internal compiler error. Traced the IR dump, found the circular import, implemented lazy resolution. Use your own hardest-bug story."},
      {t:"Q14: How do you handle code review disagreements?", d:"STAR shape (example): a reviewer flagged a hardcoded alignment on a contribution. Traced the framework code, found they were right. Lesson: trust infrastructure in large codebases. Use your own example."},
      {t:"Q15: Why this company specifically?", d:"Three pillars, each backed by something checkable: (1) what they uniquely own (silicon + compiler, an exchange gateway, a runtime). (2) The technical property that follows from it (VLIW ⇒ the compiler IS the performance). (3) Their open-source or public footprint, and how you'd contribute to it."}
    ]} cols={2}/>
  </S>
</div>
),

/* ── BEHAVIORAL PREP ── */
behav:()=>(
<div>
  <S title="1. STAR Format — Master Template">
    <P>Every behavioral answer must follow STAR format. Keep to 90 seconds. Practice until it feels natural, not rehearsed.</P>
    <G items={[
      {t:"S — SITUATION", d:"Context. 1-2 sentences. When, where, what project. (15 sec)"},
      {t:"T — TASK", d:"Your responsibility. What needed to be done. (10 sec)"},
      {t:"A — ACTION", d:"What YOU did (not the team). Specific technical steps. (45 sec)"},
      {t:"R — RESULT", d:"Measurable outcome. Numbers. Impact. (20 sec)"}
    ]} cols={4}/>
    <B type="tip"><strong>TEMPLATE:</strong> "When I was working on [PROJECT] at [CONTEXT], we needed to [TASK]. I specifically [ACTION 1], [ACTION 2], and [ACTION 3]. The result was [QUANTIFIED OUTCOME]."</B>
  </S>

  <S title="2. STAR in Action — Worked Examples" c={tk.blue}>
    <B type="tip">These four are <strong>illustrations of the STAR shape</strong>, not stories to claim — they show the level of specificity and the measurable result to aim for. Build one of each type from your own experience.</B>
    <G items={[
      {t:"Hardest Bug (example)",d:"SITUATION: compiling a 20K-line Fortran codebase with a new compiler. TASK: fix an internal compiler error on module compilation. ACTION: traced the IR dump, identified a circular module dependency, implemented lazy module resolution. RESULT: unblocked the full build, contributed the fix upstream."},
      {t:"Code Review (example)",d:"SITUATION: a contribution adding rdtsc builtins. TASK: address reviewer feedback. ACTION: a reviewer flagged a hardcoded alignment; traced the framework code, confirmed it should come from TargetDataLayout. RESULT: cleaner code, learned to trust framework infrastructure."},
      {t:"Tight Deadline (example)",d:"SITUATION: a GSoC midterm for compiler OpenMP support. TASK: implement 8 clause types in 3 weeks. ACTION: prioritized by usage frequency, test-driven with LIT tests, tracked progress daily. RESULT: 13 constructs + 8 clauses merged before the deadline with full coverage."},
      {t:"Leadership (example)",d:"SITUATION: an MPI vs OpenMP study on RISC-V. TASK: lead a 3-person team. ACTION: built a benchmarking CI pipeline, designed the experiment matrix, wrote the analysis scripts. RESULT: published (HiPC + FGCS Elsevier), 3.42× speedup finding."},
    ]} cols={2}/>
  </S>

  <S title="3. Common Behavioral Questions" c={tk.amber}>
    <B type="interview">The answers below are <strong>example answers</strong> — they model the structure and the level of specificity to aim for. The projects referenced are illustrations; substitute your own.</B>
    <Q d="must" q="Why this company?" a={"There is no generic answer here — the whole test is whether you did the reading. Build three pillars, each one checkable:\n\n1. What they uniquely own. The strongest version is a place where two layers meet under one roof: silicon and the compiler, the matching engine and the network stack, the runtime and the language. Say why that combination produces problems you can't work on elsewhere.\n\n2. The technical consequence of #1. Make it concrete and falsifiable. Example shape: 'the target is VLIW, so there's no out-of-order hardware to hide a bad schedule — packetization is the performance, not a tuning knob.' If you can't state a consequence, you haven't done the reading yet.\n\n3. Your overlap with their public footprint. Their upstream commits, their published papers, their engineering blog, their open-source projects. If you've contributed to something they maintain, this is where it goes.\n\nHow to research it in 30 minutes: read the actual job posting line by line, search their org on GitHub and skim the last few months of commits, read two engineering blog posts, and find one conference talk by someone on the team."}/>
    <Q d="must" q="What's your greatest strength?" a={"(Example.) Navigating very large, complex codebases quickly and contributing meaningfully. LLVM is 20M+ lines — going from zero familiarity to a merged patch in weeks. A 20K-line legacy Fortran code — compiling it with a brand-new compiler. The throughline: being comfortable as the person who reads the code nobody else wants to read.\n\nThis is directly relevant to compiler engineering, where you're ALWAYS working in massive, under-documented codebases. Frame your own version around a concrete 'I got productive fast in something huge' story."}/>
    <Q d="must" q="What's a weakness you're working on?" a={"I sometimes spend too long trying to understand something deeply before asking for help. In the LLVM PR, I spent two days understanding CIR's type system when a 30-minute conversation with the maintainer would have answered my questions.\n\nI'm actively improving: I now timebox deep dives to 2 hours, then reach out. In the GSoC project, I established weekly sync calls instead of only reaching out when stuck."}/>
    <Q d="medium" q="Tell me about a time you failed." a={"Early in the POT3D project, I assumed Fortran's COMPLEX type would work identically to LFortran's implementation. I wrote 500 lines of MPI wrappers using that assumption. When testing, all COMPLEX-type communications produced wrong results.\n\nRoot cause: Fortran COMPLEX is {real, imaginary} interleaved, but my wrapper was using separate real arrays.\n\nLesson: verify assumptions with tests FIRST, especially when bridging between different compilers' representations. I now always prototype with test cases before committing."}/>
    <Q d="medium" q="How do you stay current with compiler technology?" a={"Four channels:\n1. LLVM Discourse + weekly patches: I follow the CIR and backend discussions\n2. Conference talks: LLVM Dev Meeting, CGO, PLDI proceedings\n3. Papers: recent work on MLIR, Triton compiler, torch.compile internals\n4. By building: contributing to LLVM and LFortran forces me to learn the latest APIs\n\nContributing code teaches me 10× faster than just reading about it."}/>
    <Q d="medium" q="How do you handle working with different skill levels?" a={"In my research group, I worked with students ranging from freshman to PhD candidates.\n\nApproach: I pair on specific tasks rather than just answering questions. For the RISC-V benchmarking, I set up the infrastructure so less experienced members could contribute by running experiments.\n\nResult: everyone contributed to the paper. The freshman learned MPI through guided experiments. The PhD student handled analysis with my data infrastructure."}/>
    <Q d="hard" q="Where do you see yourself in 5 years?" a={"(Example.) Becoming the engineer other compiler engineers come to for complex backend interactions or subtle miscompilations.\n\nSpecifically: deep expertise in VLIW scheduling and vector compiler technology — the problems at the heart of Hexagon and HVX.\n\nLong-term: contributing to LLVM upstream on behalf of the company, shaping the tools the whole industry depends on. Anchor your own answer to a direction the team actually works in."}/>
  </S>
</div>
),

/* ── HFT OPTIMIZATION PLAYBOOK ── */
hft:()=><HftModule/>,

/* ── QUANT TRACK ── */
quant_prob:()=><QuantProbModule/>,
quant_micro:()=><QuantMicroModule/>,

}; /* ══ END content ══ */

/* ══════════════════════════════════════════════════════════════
   GLOBAL SEARCH (⌘K) — Library headers + Prep Q&A + DSA problems
   ══════════════════════════════════════════════════════════════ */
