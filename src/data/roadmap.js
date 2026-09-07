// ════════════════════════════════════════════════════════════════════
//  Roadmap — the 26-week core plan with an optional extension to 52 weeks.
//  Sized for 3 fixed sessions a week (about 4.5 h) plus an optional weekend
//  block. Phases reference lab TRACKS (labs.json), DSA TIERS (dsaCurriculum)
//  and Library GUIDES by number. Guides not yet written are listed under
//  `plannedGuides` so the dashboard can show them without dead links.
// ════════════════════════════════════════════════════════════════════

export const SESSION_TEMPLATE = [
  { id: "A", name: "Coding",  minutes: 100, what: "10 min review queue → two timed problems (25 + 35 min) → 15 min mistake log. Out loud, no AI." },
  { id: "B", name: "Lab",     minutes: 100, what: "One runnable lab from the current track. Leave a 5-line evidence note (claim, evidence, surprise)." },
  { id: "C", name: "Depth",   minutes: 70,  what: "One guide section → ten flash questions spoken aloud → one C++ / systems drill." },
  { id: "D", name: "Weekend (optional)", minutes: 150, what: "Capstone one week, full timed mock the next. Skip it in a bad week without guilt." },
];

// All planned guides have been written (17-22); kept for the dashboard's chip renderer.
export const PLANNED_GUIDES = {};

export const PHASES = [
  {
    id: 0, name: "Foundation", weeks: [1, 1],
    goal: "Tooling and measurement discipline; DSA data cleaned; progress tracking live.",
    tracks: ["perf"], dsaTiers: [0], guides: ["11", "16"],
    milestone: "All five perf labs reproduced with your own numbers and evidence notes.",
  },
  {
    id: 1, name: "Measure and fluency", weeks: [2, 7],
    goal: "Cache/data-layout labs; timed DSA on tier 0–1; C++ fundamentals drilled until automatic.",
    tracks: ["cache"], dsaTiers: [0, 1], guides: ["05", "07", "16"],
    milestone: "Tier 1 solved twice under time; cache track done; HFT module questions answered out loud without notes.",
  },
  {
    id: 2, name: "Codegen and concurrency", weeks: [8, 13],
    goal: "Read and steer -O2 codegen; lock-free SPSC that passes TSan and a stress test; HFT-specific depth (Linux, networking, x86).",
    tracks: ["codegen", "concurrency"], dsaTiers: [1, 2], guides: ["02", "14", "17", "18", "19"],
    milestone: "First full generalist coding mock; SPSC queue measured and explained; tier 2 started.",
  },
  {
    id: 3, name: "Systems and Arm", weeks: [14, 19],
    goal: "Syscalls, networking and IO labs; AArch64 cross-compile + emulation; unfamiliar-codebase playbooks; capstone 1.",
    tracks: ["systems", "aarch64", "bigcode"], dsaTiers: [2, 3], guides: ["13", "15", "20", "21", "22"],
    milestone: "Capstone 1 write-up published (public code only); system design drills done; tier 2 solid.",
  },
  {
    id: 4, name: "Interview loop", weeks: [20, 26],
    goal: "Weekly mocks alternating generalist SWE and HFT formats; capstone 2; stories rewritten for both targets; applications.",
    tracks: ["capstones"], dsaTiers: [2, 3], guides: ["12", "20", "22"],
    milestone: "Four full mocks scored; capstone 2 done; HFT applications around month 4, Google around month 5.",
  },
  {
    id: 5, name: "Extension (optional, to 12 months)", weeks: [27, 52],
    goal: "Depth without deadlines: MPSC/lock-free beyond SPSC, SME under emulation or on real hardware, deeper capstones, second FSRS pass over everything.",
    tracks: ["concurrency", "aarch64", "capstones"], dsaTiers: [3], guides: [],
    milestone: "You can open any large C++ codebase and produce a measured, proven performance change in a day.",
  },
];

export const PATHS = [
  { id: "hft", name: "HFT / low-latency software engineer", color: "orange",
    why: "C++ depth, Linux, CPU performance, networking, clean algorithms in long collaborative sessions. Evidence: HRT, Optiver, Graviton postings; Jane Street's own prep page.",
    guides: ["17", "18", "19", "07", "22"], modules: ["hft", "arch", "cpp_mem", "cpp_con", "link", "mocks"], dsa: ["problems", "cpp"], tracks: ["perf", "cache", "concurrency", "systems"] },
  { id: "google", name: "Generalist SWE / compiler team", color: "accent",
    why: "Generalist loop: timed coding, one design round at mid level, behavioral. Role knowledge is a tie-breaker, coding fluency is the gate.",
    guides: ["01", "02", "03", "22", "12"], modules: ["ssa", "llvm", "passes", "pipeline", "behav", "mocks", "review"], dsa: ["problems", "patterns"], tracks: ["perf", "codegen"] },
  { id: "perfeng", name: "Performance engineer in a huge codebase", color: "emerald",
    why: "Find the bottleneck, map it to code, decide what is responsible, fix it, prove it. This is the capstone skill the labs build toward.",
    guides: ["20", "21", "19", "02", "14"], modules: ["vec", "arch", "arm", "test"], dsa: ["bughunt"], tracks: ["perf", "cache", "codegen", "bigcode", "capstones"] },
  { id: "llvm", name: "LLVM fundamentals crash course", color: "cyan",
    why: "The compiler spine end-to-end: SSA → IR → passes → pipeline, with the tooling to inspect each stage.",
    guides: ["01", "02", "03", "04", "11"], modules: ["ssa", "llvm", "passes", "pipeline", "isel", "regalloc"], dsa: ["patterns"], tracks: ["ir", "cross_level"] },
];

export function phaseForWeek(week) {
  if (week == null) return null;
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[PHASES.length - 1];
}
