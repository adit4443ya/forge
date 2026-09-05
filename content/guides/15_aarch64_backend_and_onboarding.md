<!--
category: ARM & AArch64 Backend
tags: AArch64 Backend, GlobalISel, TableGen, SchedModel, llvm-mca, lit, Onboarding, Qualcomm, First 90 Days
difficulty: Advanced
readTime: 45 min
-->

# The AArch64 Backend in LLVM + Your First 90 Days on the ARM Team

> [!IMPORTANT]
> **TL;DR — what you must remember:** The AArch64 backend (`llvm/lib/Target/AArch64/`) is LLVM's **GlobalISel flagship**: TableGen describes instructions, the **NZCV flag register must be scheduled around**, **SchedModels** encode per-core CPU tuning, and **TTI cost models** are a product surface. The daily loop is `edit → llc → update_llc_test_checks → FileCheck`. Onboarding = read codegen tests until you know the house style.

Guide 03 gave you the target-independent backend pipeline. This guide is the **AArch64-specific layer**: where the code lives, what makes this target unusual, the workflow tools you'll use daily at Qualcomm, and a concrete week-by-week ramp-up plan so you walk in on July 7th already knowing the terrain.

---

# PART 1 — GEOGRAPHY OF `llvm/lib/Target/AArch64/`

Clone llvm-project and live in this directory. The files you'll touch most:

```
AArch64.td                    Target definition: features, CPUs, includes everything
AArch64ISelLowering.cpp       ~25k lines. Custom DAG lowering: setOperationAction
                              tables, LowerOperation, performDAGCombine. THE file.
AArch64ISelDAGToDAG.cpp       Manual SelectionDAG matching for what TableGen can't
AArch64InstrInfo.td           Instruction definitions + selection patterns
AArch64InstrFormats.td        Encoding/format classes the defs are built from
AArch64SVEInstrInfo.td        SVE instruction defs (separate, large)
AArch64RegisterInfo.td        Register classes: GPR32/64, GPR64sp, FPR, ZPR, PPR
AArch64CallingConvention.td   AAPCS64 encoded as CCIf<> rules
AArch64FrameLowering.cpp      Prologue/epilogue, scalable stack regions, PAC/BTI
AArch64TargetTransformInfo.*  THE COST MODEL — what the vectorizer/unroller asks
AArch64Subtarget.*            Per-CPU feature wiring
AArch64SchedNeoverseV2.td,
AArch64SchedOryon.td, ...     Per-core scheduling models (Oryon = Qualcomm's core!)
GISel/                        GlobalISel: CallLowering, LegalizerInfo,
                              RegisterBankInfo, InstructionSelector
AArch64LoadStoreOptimizer.cpp Post-RA LDP/STP formation, pre/post-index recovery
AArch64ConditionalCompares.cpp  CCMP chain formation
MCTargetDesc/                 Assembler/encoder layer (MCInst → bytes)
```

**Fact worth knowing on day 1:** `AArch64SchedOryon.td` exists upstream — Qualcomm's own Oryon core has a public scheduling model. Reading it before joining is the single most team-relevant prep you can do.

## TableGen in Two Minutes of Truth

Most instructions are *not* selected by C++ — they're matched by patterns:

```tablegen
def : Pat<(add GPR64:$Rn, GPR64:$Rm), (ADDXrr GPR64:$Rn, GPR64:$Rm)>;
def : Pat<(AArch64csel GPR32:$tval, GPR32:$fval, (i32 imm:$cc), NZCV),
          (CSELWr GPR32:$tval, GPR32:$fval, imm:$cc)>;
```

`llvm-tblgen` compiles these into the generated matcher (`AArch64GenDAGISel.inc`). When ISel "mysteriously" picks an instruction, the answer is a `Pat<>` somewhere. Debug with:

```bash
llc -debug-only=isel test.ll 2>&1 | less     # watch DAG → MachineInstr decisions
```

---

# PART 2 — WHAT MAKES THE AArch64 TARGET SPECIAL

## 1. It's the GlobalISel Flagship

AArch64 was the **first production GlobalISel target** — at `-O0`, GlobalISel (not FastISel) is the default selector, and `-O2` coverage keeps expanding. You will see both pipelines in test files. The GISel flow recap, with AArch64 file names:

```
LLVM IR
  → IRTranslator        (generic MachineIR, gMIR)         GISel/AArch64CallLowering.cpp
  → Legalizer           (make ops legal per type)         GISel/AArch64LegalizerInfo.cpp
  → RegBankSelect       (GPR bank vs FPR bank decision)   GISel/AArch64RegisterBankInfo.cpp
  → InstructionSelect   (gMIR → real AArch64 instrs)      GISel/AArch64InstructionSelector.cpp
```

Flags you'll use constantly: `-global-isel`, `-global-isel-abort=2` (fall back to SDAG and warn), `-stop-after=irtranslator` to inspect gMIR. *Interview/team question: "Why does RegBankSelect exist on AArch64?"* → because an i64 value can live in either GPR (X) or FPR (D) banks; cross-bank copies are expensive, so a dedicated phase optimizes the assignment — something SelectionDAG never modeled explicitly.

## 2. Flags Are a Register You Must Schedule Around

NZCV is modeled as a physical register. `ADDS/SUBS/CMP` def it, `B.cc/CSEL/CCMP` use it. The scheduler can't reorder a flag-setter across a flag-user — when codegen looks "weirdly serialized," check NZCV dependencies first. `AArch64ConditionOptimizer` and `AArch64ConditionalCompares` exist precisely to restructure flag usage.

## 3. Late Target Passes That Define "ARM-flavored" Code

Run `llc -mtriple=aarch64 -debug-pass=Structure` once and read the list. The stars:

- **AArch64LoadStoreOptimizer** (post-RA): merges adjacent `LDR/STR` → `LDP/STP`, folds increments into pre/post-index forms. The pass that makes ARM epilogues pretty.
- **MachineCombiner** with AArch64 patterns: e.g., reassociates `(fadd (fmul a,b), c)` → `FMADD` when the SchedModel says latency improves.
- **AArch64PromoteConstant / ExpandImm**: constant materialization strategy (MOVZ/MOVK chains vs literal-pool loads).
- **Branch relaxation**: conditional branches reach ±1 MB; the pass inverts + inserts unconditional branches when targets are too far. (Classic "why did my huge function's branches change shape?")
- **PAC/BTI insertion** in frame lowering when `-mbranch-protection=standard`.

## 4. The Cost Model Is a Product Surface

`AArch64TargetTransformInfo` answers the mid-end's questions: vector op costs, gather/scatter viability, unroll factors, `getMinVectorRegisterBitWidth`. Qualcomm cares because **mis-priced costs = lost benchmarks on Snapdragon**. A very plausible early task: "this loop vectorizes on Neoverse but not on Oryon — find out why" → answer lives in TTI + SchedModel interplay.

---

# PART 3 — SCHEDULING MODELS: WHERE CPU TUNING LIVES

Each core gets a `MachineSchedModel`: issue width, per-instruction latencies, functional-unit throughput:

```tablegen
def OryonModel : SchedMachineModel {
  let IssueWidth = 8;            // µops/cycle the core can issue
  let MicroOpBufferSize = ...;   // ROB-ish size → how OOO the scheduler assumes
  let LoadLatency = 4;
  ...
}
def : WriteRes<WriteIMul, [ORYONI0]> { let Latency = 3; }
```

The pre-RA MachineScheduler and `MachineCombiner` consume this; **llvm-mca** simulates it:

```bash
llvm-mca -mtriple=aarch64 -mcpu=oryon-1 kernel.s     # throughput/bottleneck report
llvm-mca -mcpu=neoverse-v2 -timeline kernel.s        # cycle-by-cycle pipe view
```

Comparing `llvm-mca` output across `-mcpu=` values for the same assembly is the fastest way to *feel* what a scheduling model does — and it's a tool your team uses to validate model changes. Tuning a SchedModel against real Snapdragon measurements is bread-and-butter ARM-team work.

---

# PART 4 — THE DAILY WORKFLOW (Learn Before Day 1)

## Build Lean

```bash
cmake -G Ninja ../llvm \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLVM_ENABLE_ASSERTIONS=ON \        # non-negotiable for development
  -DLLVM_TARGETS_TO_BUILD="AArch64" \  # 10x faster than all-targets builds
  -DLLVM_ENABLE_PROJECTS="clang" \
  -DLLVM_USE_LINKER=lld -DLLVM_CCACHE_BUILD=ON
ninja llc opt clang llvm-mca
```

## The Test Loop You'll Run 50× a Day

```bash
# Codegen tests live here — read 10 of them and you know the house style:
ls llvm/test/CodeGen/AArch64/

# Run one:
build/bin/llvm-lit -v llvm/test/CodeGen/AArch64/sve-fixed-length-fp-arith.ll

# Auto-generate CHECK lines after a codegen change (the canonical workflow):
llvm/utils/update_llc_test_checks.py --llc-binary build/bin/llc \
      llvm/test/CodeGen/AArch64/my-test.ll
```

A typical backend patch = C++/TableGen change + regenerated `update_llc_test_checks` diffs. Reviewers read the **assembly diff** in tests as the real content of your patch. You already know the upstream review etiquette from your two merged PRs — same culture inside Qualcomm's ARM team, since their work flows upstream.

## Inspection Toolbox

```bash
llc -mtriple=aarch64 -mcpu=oryon-1 -O3 t.ll -o -          # final asm
llc -print-after-all t.ll 2>&1 | less                      # MIR after every pass
llc -stop-after=aarch64-ldst-opt t.ll -o t.mir             # capture MIR mid-pipeline
llc -run-pass=aarch64-ldst-opt t.mir                       # unit-test ONE pass on MIR
clang -O3 --target=aarch64-linux-gnu -mllvm -print-after=loop-vectorize ...
```

MIR round-tripping (`-stop-after` + `-run-pass`) is how backend passes get unit-tested — it will feel novel for ~a week and indispensable after.

---

# PART 5 — FIRST 90 DAYS: THE RAMP PLAN

## Before Day 1 (your remaining weeks — ~1.5 hrs/day, not more)

1. Build LLVM with the AArch64-only config above. Get `llc` running.
2. Read Guides 13 + 14 of this site until the register file, AAPCS64, CSEL/CCMP, and `vscale` feel native.
3. Godbolt drills (a proven prep method): compile small C functions at `-O2` for `armv8-a` vs `armv9-a+sve`, and *predict the assembly before looking*. Targets: struct passing (HFA!), a ternary (expect CSEL), a 64-bit constant, a reduction loop, a tail-folded SVE loop.
4. Skim `AArch64SchedOryon.td` and run `llvm-mca -mcpu=oryon-1` on one of your Godbolt outputs.
5. Read 10 random tests in `test/CodeGen/AArch64/` to absorb test style.

## Weeks 1–3: Orientation

- Build the **internal** tree, run the internal test suites, learn the CI.
- Ask your lead the three map-questions: Which CPUs do we tune for? What's our upstream-first vs downstream-patch policy? Where does perf-regression triage happen?
- Fix one tiny thing end-to-end (a test, a comment, a TableGen nit) just to traverse the full patch lifecycle internally.

## Weeks 4–8: First Real Patch

Typical starter tasks on ARM teams — be ready for any of:
- Add/adjust an ISel pattern so an op selects a better instruction (verify with `update_llc_test_checks` diff).
- Tune a SchedModel entry where llvm-mca/hardware disagree.
- Extend `AArch64LoadStoreOptimizer` for a pairing case it misses.
- Cost-model fix: a loop that should (or shouldn't) vectorize on a Snapdragon core.

For each: write the MIR/IR test **first**, make it fail, make it pass. Your reviewers think in test diffs.

## Weeks 9–12: Own Something Small

Pick one subsystem (e.g., conditional-compare formation, or SVE fixed-length lowering) and become the person who answers questions about it. Pair it with one upstream LLVM patch in the same area — your external PR cadence (2 merged already) should *continue* through employment; it compounds exactly toward the Apple/NVIDIA/Linaro doors you've mapped.

---

# PART 6 — Q&A DRILL (Team-Plausible Questions)

### Q: `-O0` on AArch64 — which instruction selector runs, and what happens on a fall-back?
GlobalISel is the default at `-O0` for AArch64. If a construct isn't supported, behavior follows `-global-isel-abort`: abort (1), or silently fall back to SelectionDAG (0), or fall back with a diagnostic (2). At higher opt levels SDAG is still the default selector upstream, with GISel coverage growing.

### Q: Your patch changed codegen and 40 AArch64 tests fail. Correct workflow?
Inspect a representative diff to confirm the new output is *intended and better/neutral*, then regenerate with `update_llc_test_checks.py` for auto-generated tests; hand-update hand-written ones with reasoning in the commit message. Never blind-regenerate — every CHECK diff is a claim you're signing.

### Q: A kernel is 20% slower on core A than core B at identical clocks. Compiler-side investigation?
`llvm-mca -mcpu=A` vs `-mcpu=B` on the hot block → compare bottleneck (dispatch? a saturated FU? latency chain?). If mca disagrees with hardware counters, suspect the SchedModel; if mca agrees, suspect codegen choices driven by the cost model (vector width, unroll, FMA formation) and check what TTI returned for each core.

### Q: Why might `CSEL` beat a branch, and when does it lose?
Wins: removes a branch misprediction risk and merges control into data flow, enabling further if-conversion/vectorization (your ternary-on-Godbolt story is the canonical demo). Loses: when one side is expensive and rarely taken — predication executes *both* inputs' dependency chains, so a highly predictable branch skipping costly work beats unconditional evaluation. The if-converter consults branch probability + cost.

### Q: What is MIR and why do backend engineers love it?
The serialized form of MachineIR (`-stop-after=… -o t.mir`). It lets you freeze the program *between* backend passes and run exactly one pass on it (`-run-pass=`), turning "debug a 90-pass pipeline" into a unit test. Most backend regression tests for late passes are `.mir` tests.

### Q: Where would you look first if AAPCS-compliant struct passing produced wrong registers?
`AArch64CallingConvention.td` (the CCIf rules) and `AArch64CallLowering.cpp`/`AArch64ISelLowering::LowerFormalArguments` — and write an IR test passing the exact aggregate, checking which registers the prologue reads. HFA classification bugs (Guide 13, Part 2) are the classic culprit.
