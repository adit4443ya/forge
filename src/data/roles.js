// ════════════════════════════════════════════════════════════════════
//  ROLE MODEL — the spine of the retargeting.
//
//  The site is no longer organised by company or by topic dump. It is
//  organised by ROLE, and inside a role by COMPETENCY, where a competency is
//  something the job actually asks you to do on a Tuesday afternoon.
//
//  Each competency carries:
//    doing     what the work looks like when you have it
//    signal    what an interviewer asks to find out whether you do
//    level     foundation | working | expert  (the order to build it in)
//    guides    Library guide numbers
//    modules   Prep Q&A module ids
//    labs      lab ids from labs.json (prefix match: "perf-" takes the track)
//    sections  DSA section names that train the same muscle
//
//  This is what the Learn screen renders, what Today draws a session from,
//  and what Progress scores you against.
// ════════════════════════════════════════════════════════════════════

export const ROLES = [
  {
    id: "compiler",
    name: "Compiler Engineer",
    tag: "LLVM · IR · backends · codegen",
    icon: "⚙",
    hue: "accent",
    reality:
      "You own a stage of a pipeline that turns text into machine code, inside a codebase of millions of lines that thousands of people depend on being correct. Most days are not writing new optimizations. They are reducing a bug report to twelve lines, bisecting which pass broke it, reading IR before and after, writing the FileCheck test that would have caught it, and defending the patch in review.",
    day: [
      "Triage a report: reproduce, reduce with llvm-reduce or creduce, bisect the pass with -opt-bisect-limit",
      "Read IR at three stages and say which transformation was wrong",
      "Write or fix a pass; keep the analyses it preserves honest",
      "Write lit + FileCheck tests that pin the behaviour, not the output",
      "Check a change did not regress compile time or code quality on a benchmark",
      "Read someone else's patch and ask the question that finds the missing case",
    ],
    competencies: [
      { id: "c-ir", name: "Read and reason about IR", level: "foundation",
        doing: "You can look at unoptimized and optimized IR for the same function and narrate what each pass did and why it was legal.",
        signal: "Walk me from C to optimized IR for this loop. What blocked the transformation?",
        guides: ["01", "02", "11"], modules: ["ssa", "llvm", "passes"], labs: ["ir-", "xl-"], sections: [] },
      { id: "c-debug", name: "Debug a miscompile", level: "working",
        doing: "You separate UB in the input from a genuine optimizer bug, then bisect to the pass and produce a minimal reproducer.",
        signal: "It works at -O0 and breaks at -O2. What is your first command, and your second?",
        guides: ["11", "21"], modules: ["test"], labs: ["debug-", "xl-04"], sections: [] },
      { id: "c-backend", name: "Backend: selection, allocation, scheduling", level: "working",
        doing: "You can follow a value from IR through instruction selection into a register and out to the encoded instruction, and explain a spill.",
        signal: "Why did this get spilled? What would a different scheduling model change?",
        guides: ["03", "04", "13", "15"], modules: ["isel", "regalloc", "pipeline"], labs: ["aarch64-01"], sections: [] },
      { id: "c-vec", name: "Vectorization and cost models", level: "expert",
        doing: "You read the vectorizer's own remarks, know the five legality conditions, and can make a loop vectorize without lying to the compiler.",
        signal: "This loop did not vectorize. Prove why, then make it, then prove it was worth it.",
        guides: ["02", "14"], modules: ["vec", "alias", "dataflow"], labs: ["codegen-02", "aarch64-02"], sections: [] },
      { id: "c-arch", name: "Target architecture depth", level: "expert",
        doing: "You know one ISA well enough to predict codegen, and you can validate a runtime-dispatched kernel across feature levels.",
        signal: "Same source, x86 and AArch64. What differs and why? How would you dispatch safely?",
        guides: ["13", "14", "15", "19"], modules: ["arm", "arch"], labs: ["aarch64-"], sections: [] },
      { id: "c-scale", name: "Work in a huge codebase", level: "working",
        doing: "You find the code that matters in a tree you have never seen, using the build system rather than guessing.",
        signal: "Here is a repo you do not know. Where is this behaviour implemented, and how do you rebuild just that?",
        guides: ["21"], modules: ["link"], labs: ["bigcode-"], sections: [] },
    ],
  },
  {
    id: "systems",
    name: "Systems / Performance Engineer",
    tag: "perf · cache · kernel · profiling",
    icon: "▤",
    hue: "ok",
    reality:
      "Someone hands you a program that is too slow and no idea why. Your value is that you do not guess. You build a repeatable measurement, find the bottleneck with evidence, name the mechanism, change one thing, and prove the change with numbers a sceptic would accept. Half the job is refusing to accept a plausible story without a counter behind it.",
    day: [
      "Turn a vague complaint into a repeatable workload with a known noise floor",
      "Profile it, get from wall time to a source line through inlining and stripped libraries",
      "Classify the bottleneck: branches, memory, dependency chain, ports, syscalls, waiting",
      "Change one thing; measure ABAB; keep the counters that explain it",
      "Write the result so a reviewer believes it, including the residual",
      "Say no to an optimization that the measurement does not support",
    ],
    competencies: [
      { id: "s-measure", name: "Measurement discipline", level: "foundation",
        doing: "You pin, warm up, repeat, and report percentiles. You know this machine's noise floor before you claim anything.",
        signal: "How do you know your 8% improvement is real?",
        guides: ["20"], modules: ["arch"], labs: ["perf-01", "perf-04"], sections: [] },
      { id: "s-profile", name: "Profiling to a line", level: "foundation",
        doing: "perf record to hot symbol to hot line, through inlining, mangling and missing symbols.",
        signal: "The hot function in the profile is main. Now what?",
        guides: ["20", "21"], modules: ["test"], labs: ["perf-02", "perf-03", "bigcode-04"], sections: [] },
      { id: "s-memory", name: "Memory hierarchy", level: "working",
        doing: "You reason in cache lines and pages, know when the prefetcher hides your misses, and pick layouts on evidence.",
        signal: "Why is this loop bound by memory when the counters show almost no misses?",
        guides: ["19"], modules: ["arch"], labs: ["cache-"], sections: [] },
      { id: "s-uarch", name: "Microarchitecture", level: "working",
        doing: "You can say whether a loop is latency-bound, throughput-bound, branch-bound or memory-bound, and prove it.",
        signal: "Here is a loop and its counters. What binds it, and what would you change?",
        guides: ["19"], modules: ["arch", "vec"], labs: ["codegen-03", "codegen-04", "perf-02"], sections: [] },
      { id: "s-kernel", name: "OS behaviour and tails", level: "expert",
        doing: "You attribute p99.9 to page faults, preemption, interrupts or frequency, with the counter for each.",
        signal: "p50 is fine and p99.9 is 100x. Walk me through it.",
        guides: ["17"], modules: ["arch"], labs: ["perf-05", "systems-"], sections: [] },
      { id: "s-prove", name: "Turn a finding into a decision", level: "expert",
        doing: "You choose the cheapest lever that removes the mechanism and can defend not doing the expensive one.",
        signal: "You found it. Which of the six levers do you pull, and what do you tell the team you are not doing?",
        guides: ["20"], modules: [], labs: ["capstone-"], sections: [] },
    ],
  },
  {
    id: "hft",
    name: "HFT / Low-Latency Engineer",
    tag: "tick-to-trade · C++ · microstructure",
    icon: "⚡",
    hue: "warn",
    reality:
      "A packet arrives and a decision has to leave the box before anyone else's. The budget is hundreds of nanoseconds, so nothing on the hot path may allocate, block, lock, or call the kernel. You spend your days shaving a path you have instrumented at every stage, arguing about data layout, and being certain about memory ordering because the bug you cannot reproduce costs money every day it survives. The loop also asks you to reason about probability out loud and to know enough market structure to understand what the code is for.",
    day: [
      "Read the per-stage latency histograms from last night and pick the worst tail",
      "Instrument another stage; timestamps in a preallocated ring, never a log line",
      "Redesign a structure so a lookup is one cache line instead of four",
      "Argue an acquire/release pair with a colleague, then write the litmus test",
      "Tune a box: isolate cores, pin threads, pre-fault memory, route interrupts away",
      "Read an exchange spec and write a parser that never copies and never allocates",
    ],
    competencies: [
      { id: "h-cpp", name: "C++ that survives the hot path", level: "foundation",
        doing: "Lifetimes, layout, no hidden allocation, and you know what each abstraction compiles to.",
        signal: "What does this std::function cost, and what would you write instead?",
        guides: ["05", "06", "16"], modules: ["cpp_obj", "cpp_tpl", "cpp_mem", "cpp_misc"], labs: ["codegen-01", "codegen-05"], sections: [] },
      { id: "h-latency", name: "Latency thinking", level: "foundation",
        doing: "You budget in nanoseconds, report p99.9, and know the cost of every boundary you cross.",
        signal: "Walk me through tick-to-trade and where each microsecond goes.",
        guides: ["17", "18"], modules: ["hft"], labs: ["perf-05", "systems-02", "systems-03"], sections: [] },
      { id: "h-conc", name: "Concurrency without locks", level: "working",
        doing: "You write an SPSC queue with the right orders, prove it with a sanitizer, and know why seq_cst exists.",
        signal: "Which orders, and what breaks with a second producer?",
        guides: ["07", "19"], modules: ["cpp_con"], labs: ["concurrency-"], sections: [] },
      { id: "h-data", name: "Data structures for the hot path", level: "working",
        doing: "Direct-indexed levels, intrusive lists, pools, ring buffers. You reject a std::map for a reason with a number.",
        signal: "Design a limit order book. Why not a tree?",
        guides: ["22"], modules: ["hft"], labs: ["cache-", "systems-01"], sections: ["HFT Structures", "Design", "Intervals"] },
      { id: "h-net", name: "Networking and the kernel boundary", level: "expert",
        doing: "Multicast feeds, gap recovery, busy-poll versus bypass, and timestamps that prove where time went.",
        signal: "Your feed handler sees gaps. Walk through recovery. Then: is the network slow or are you?",
        guides: ["18", "17"], modules: ["hft"], labs: ["systems-03", "systems-04", "systems-05"], sections: [] },
      { id: "h-box", name: "Own the machine", level: "expert",
        doing: "Isolation, IRQ affinity, huge pages, governors, and knowing which of these you actually need.",
        signal: "Here is a stock box. What do you change, in what order, and how do you prove each one worked?",
        guides: ["17"], modules: [], labs: ["perf-05", "cache-06"], sections: [] },
      { id: "h-prob", name: "Probability under pressure", level: "working",
        doing: "Expectation, conditioning, symmetry, linearity. You reach for the right tool in ninety seconds and say why.",
        signal: "Coins, dice, urns, random walks, expected waiting times — derived out loud, not recited.",
        guides: [], modules: ["quant_prob"], labs: [], sections: ["Randomized", "Math"] },
      { id: "h-micro", name: "Market microstructure", level: "working",
        doing: "The book, order types, queue position, adverse selection, and why latency has economic value.",
        signal: "Why does a market maker care about queue position?",
        guides: ["18", "22"], modules: ["quant_micro"], labs: [], sections: ["HFT Structures"] },
      { id: "h-num", name: "Numerical care and reproducibility", level: "expert",
        doing: "Floating-point error, reassociation, seeded randomness, deterministic parallel reductions.",
        signal: "Two implementations disagree in the seventh digit. Which is right, and does it matter?",
        guides: ["02", "19"], modules: ["cpp_con"], labs: ["codegen-02", "cache-03", "concurrency-01"], sections: [] },
    ],
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));
export const LEVELS = ["foundation", "working", "expert"];
export const LEVEL_META = {
  foundation: { label: "Foundation", note: "You cannot skip these. Everything else assumes them." },
  working:    { label: "Working",    note: "What the job asks for on an ordinary day." },
  expert:     { label: "Expert",     note: "What separates a hire from a strong hire." },
};

export const allCompetencies = () => ROLES.flatMap((r) => r.competencies.map((c) => ({ ...c, role: r.id, roleName: r.name })));
export const competenciesForRole = (roleId) => (ROLE_BY_ID[roleId]?.competencies || []);
/* A lab id matches a competency if the competency lists it exactly or lists its prefix. */
export const labMatches = (comp, labId) => (comp.labs || []).some((p) => labId === p || labId.startsWith(p));
