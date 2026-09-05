<!--
category: Interview Prep & Tooling
tags: Qualcomm, SSA, Dominance, LICM, GVN, SCCP, Alias Analysis, Backend, TableGen, Register Allocation, Scheduling, RISC-V, XQCI
difficulty: Advanced
readTime: 35 min
-->

# Qualcomm Compiler Systems Interview: Deep Dive Preparation

> [!IMPORTANT]
> **TL;DR — what you must remember:** Qualcomm designs **both the silicon and the compiler**. Two targets dominate: **Hexagon DSP** (VLIW — the *compiler* is the scheduler; it bundles independent ops into packets, with HVX as the wide vector unit) and **Oryon** (a wide custom-ARM core, Snapdragon X Elite). Mobile flips the objective function: **code size and power often beat peak throughput**, so `-Os`/`-O2` frequently win over `-O3`. Expect SSA/dominance, pass internals, register allocation, **AArch64 codegen, addressing modes, and weak-memory** questions — and a top-5 upstream contributor's bar for patch quality.

This document contains highly detailed, production-grade answers to deep compiler backend and middle-end engineering questions, explicitly tailored for a Qualcomm technical interview panel (specifically involving back-end/RISC-V and LLVM Pass engineers).

---

## Part 1: Middle-End (SSA & Dominance)

### 1. Walk me through Cytron's algorithm step by step on a CFG.
**Answer:**
Cytron's algorithm produces Minimal SSA form in two phases: **φ-insertion** and **Variable Renaming**.
1. **Compute Dominator Tree & Dominance Frontiers (DF):** We first find the CFG's dominator tree. The DF of block `X` is the set of blocks where `X`'s dominance "stops" (i.e., `X` dominates a predecessor of `Y`, but does *not* strictly dominate `Y`).
2. **φ-Insertion Phase (Iterated Dominance Frontier - IDF):**
   - For a variable `v` defined in block `B`, any block in `DF(B)` needs a φ-function for `v`, because `DF(B)` is the first place where a path from `B` merges with a path from somewhere else.
   - We place a φ-function at `DF(B)`. But wait: adding a φ-function *is* a new definition of `v`! So, we must now compute the DF of the block where we just added the φ-function, and place more φ-functions there if needed. This recursive closure is the **Iterated Dominance Frontier (IDF)**.
   - We use a worklist initialized with all blocks defining `v`. We pop `B`, place φ for `v` in all `Y ∈ DF(B)`, and push `Y` to the worklist if it hasn't been processed.
3. **Variable Renaming Phase:**
   - We do a Depth-First Search (DFS) traversal over the **Dominator Tree** (not the CFG).
   - We maintain a counter and a stack for each variable `v` (e.g., `stack[v]`).
   - When we process `A = ...`, we push a new version (e.g., `A_1`) onto `stack[A]`. Uses of `A` are replaced by `top(stack[A])`.
   - We then visit all CFG successors of the block and fill in the corresponding arguments in their φ-functions.
   - We recurse to dominator tree children.
   - After returning from the DFS call for a block, we pop the definitions made in that block from the stacks.

### 2. Why does a loop header always appear in its own dominance frontier?
**Answer:**
A loop header `H` has at least two incoming edges: one from outside the loop (the pre-header) and one from inside the loop (the backedge from a latch block `L`).
Because `H` dominates `L`, and `L` has an edge to `H`, `H` dominates a predecessor of `H` (which is `L`). But `H` does *not* strictly dominate itself (by definition, strict dominance requires `A != B`). Thus, `H` satisfies the exact definition of being in `DF(H)`.
This fundamental property is why loop variables (induction variables) elegantly and automatically get φ-functions placed exactly at the loop header in SSA form.

### 3. What is the iterated dominance frontier and why do we need iteration?
**Answer:**
The Iterated Dominance Frontier (IDF) accounts for the fact that a φ-function acts as a *new definition*. 
If block `A` defines `x`, we place a φ-function in `B ∈ DF(A)`. Block `B` now defines `x` (via the φ-function). If there's another join point `C ∈ DF(B)`, `C` needs a φ-function bridging the value from `B` and some other path. The standard DF only calculates the immediate frontier. The IDF takes the transitive closure `IDF(S) = DF(S ∪ DF(S))`, ensuring φ-functions propagate through chains of control-flow merges.

### 4. How does `mem2reg` work in LLVM? What does it actually do to alloca instructions?
**Answer:**
`mem2reg` is the LLVM pass that promotes memory allocations (`alloca`) to SSA registers.
Front-ends (like Clang) emit `alloca` for all local variables, generating loads and stores. This avoids complex SSA construction in the front-end. 
`mem2reg` looks for `alloca` instructions that meet specific criteria (only accessed via direct `load` and `store`, address never taken/escaped). 
1. It analyzes where the `alloca` is stored to (defining blocks).
2. It uses Cytron's algorithm to compute the IDF for those def blocks and inserts φ-functions for the `alloca`'d value.
3. It crawls the basic blocks, tracking the "current" values of each `alloca` based on the sequence of stores and φ-functions, and replaces subsequent `load`s with direct SSA values.
4. Finally, it deletes the `alloca`, `load`, and `store` instructions. The memory-bound variable is purely virtual registers now.

### 5. When would a φ function have more than two arguments?
**Answer:**
A φ-function has exactly one argument for every incoming CFG edge to the basic block. It has >2 arguments when a block has >2 predecessors. A common example is a `switch` statement where multiple cases `break` into the same exit block, or a sequence of `if-else if-else` statements merging at a single downstream block.

### 6. What is CSSA and why is it needed before De-SSA?
**Answer:**
CSSA (Conventional SSA) is a specific flavor of SSA where all variables related by a φ-function (both the definition and all its operands) have non-overlapping, "compatible" live ranges.
When doing out-of-SSA translation (getting rid of φ-functions to generate machine code), we usually insert copies on predecessor edges. But these copies can interfere. CSSA ensures that for any φ-function `v = φ(a, b)`, `v, a, b` can be safely coalesced into the exact same physical register without conflicts. If they overlap in standard SSA, a CSSA-building pass inserts extra dummy copies to split the live ranges, resolving the "Lost Copy" and "Swap" problems before Register Allocation.

---

## Part 2: Optimization Passes

### 1. LICM (Loop Invariant Code Motion)
#### What makes an instruction loop invariant?
An instruction is loop invariant if its operands are all either constants, defined outside the loop, or themselves loop invariant. 

#### What conditions must hold before you can hoist an instruction out of a loop?
1. **Loop Invariant:** The instruction calculates the same value every iteration.
2. **Safe to Speculate/Execute:** It must not throw exceptions or trap (e.g., dividing by zero) unless the compiler can prove the execution of the loop *guarantees* it executes unconditionally.
3. **No Side Effects:** It cannot modify global state.
4. **Dominates all Exits:** (For hoisting) The instruction must dominate all exit blocks of the loop so we don't compute something that wouldn't have been computed if the loop exited early.

#### Can you hoist a load out of a loop? What about a store?
- **Load Hoisting**: Yes, but only if the memory address is loop invariant, and Alias Analysis proves no instruction *inside* the loop writes to (aliases) that memory address.
- **Store Hoisting (Sink to Exit)**: Yes, but instead of hoisting, it's called **Loop Sinking**. We load it to a register in the pre-header, modify the register in the loop, and store it once in the loop exit block. Requires proving that no other thread reads/writes the memory, and no loop code reads it unexpectedly (aliasing).

#### What is the relationship between LICM and Alias Analysis (AA)?
LICM is entirely bound by Alias Analysis. To hoist `x = load p`, the compiler asks AA: "Does any store in this loop alias `p`?". If AA returns `MayAlias` for `*q = y` inside the loop, LICM is blocked, because `p` and `q` might overlap, changing `p`'s value per iteration.

### 2. GVN (Global Value Numbering)
#### How does GVN differ from local CSE?
Local CSE (Common Subexpression Elimination) only eliminates redundancies within a single Basic Block. GVN works globally across the entire CFG using dominator trees to prove values are equivalent across branches.

#### What is a value number? How does GVN assign them?
A "value number" is a unique ID (often a hash) representing a specific computation (`Opcode + ValueNum(Op1) + ValueNum(Op2)`). If `a = x + y` gets Value #5, later when evaluating `b = x + y`, GVN sees the operands have the same value numbers, calculates the same hash #5, and replaces `b` with `a`.

#### How does GVN handle loads — what can go wrong?
GVN tries to number memory states. Using MemorySSA, GVN assigns a value number to a `load` based on the pointer and the current memory version (`MemoryUse` token). What can go wrong is **aliasing**. If an intervening opaque store occurs, GVN must pessimistically assume the memory changed, increment the memory version, and fail to optimize the redundant load.

### 3. DCE and ADCE
#### How does standard DCE work in SSA form?
In SSA, standard Dead Code Elimination is trivial O(N). Because every variable has one definition and explicit use-lists, a pass iterates over instructions: if `use_count == 0` and the instruction has no side-effects (not a volatile load, store, or call), delete it. Done.

#### What is aggressive DCE — how does it differ from standard DCE?
Standard DCE only deletes instructions whose outputs are clearly unused. But what about a dead cycle? `a = b + 1; b = a + 1;` (with no outside uses). Standard DCE sees `use_count > 0` for both and leaves them. 
**Aggressive DCE (ADCE)** works backwards. It assumes *everything* is dead initially, marks only "roots" (returns, side-effects) as live, and recursively marks their operands as live. Anything left unmarked at the end is deleted. This naturally kills dead cycles.

### 4. Constant Propagation
#### What is SCCP (Sparse Conditional Constant Propagation)?
SCCP propagates constants through a CFG while simultaneously figuring out which branches of CFG execution are actually reachable (dead branch elimination). 

#### How does SCCP differ from simple constant folding?
Simple folding just looks at `x = 2 + 3` -> `x = 5`. SCCP evaluates a branch `if (x == 5)` as True, completely skips visiting the False branch, and propagates constants assuming the False branch never executes. 

#### Why is "sparse" important — what does it mean here?
"Sparse" means it doesn't propagate values linearly block-by-block. It uses SSA def-use chains (the sparse graph) to directly jump from a definition to its uses, regardless of where they are in the CFG, skipping over instructions that don't depend on the value. This makes it incredibly fast.

### 5. Loop Optimizations
#### What is SCEV (Scalar Evolution) in LLVM?
SCEV mathematically analyzes how loop variables change. Instead of seeing `i = i + 1`, it models `i` as a polynomial or recurrence relation over loop iterations, like `{0, +, 1}` (starts at 0, adds 1 per iteration). It is used to compute exact loop trip counts and array access patterns.

#### What is loop strength reduction? Give a concrete example.
Replacing expensive operations inside a loop with cheaper ones. 
Example: `for(i=0; i<N; ++i) { a[i] = i * 4; }`
Multiplier `* 4` is expensive. Strength reduction transforms this into an accumulator using addition:
`int temp = 0; for(i=0; i<N; ++i) { a[i] = temp; temp += 4; }`

#### What conditions make loop interchange legal?
Loop interchange (swapping inner and outer loops to improve cache locality) is legal if it preserves all **data dependencies** (true, anti, and output dependencies) defined by the loop distance vectors. No iteration `(i, j)` can read/write data that was meant to be written/read by a later/earlier iteration in the original order.

#### What is loop unswitching?
Hoisting a loop-invariant conditional check *outside* the loop, and duplicating the loop body for the True and False paths. Profitable because it removes a branch from the inner loop, enabling better vectorization and software pipelining, at the cost of code size.

---

## Part 3: Alias Analysis

### What is may-alias vs must-alias vs no-alias?
- **No-Alias:** Pointers definitely point to disjoint memory. (Optimization: safe to reorder).
- **Must-Alias:** Pointers definitely point to the exact same memory location. (Optimization: we can forward values between them).
- **May-Alias:** Compiler cannot prove either. Must conservatively assume they overlap. (Optimization blocker).

### What is TBAA (Type-Based Alias Analysis)?
TBAA uses the source language's type system rules (like C++ Strict Aliasing) to prove pointers don't alias. In C++, an `int*` and a `float*` are disallowed from pointing to the same memory. LLVM generates TBAA metadata nodes on loads/stores. The TBAA pass reads this metadata; if the types are fundamentally distinct on the TBAA hierarchy tree, it returns `NoAlias`.

### Difference between flow-sensitive vs flow-insensitive AA?
- **Flow-Insensitive:** Checks if `p` and `q` *ever* alias anywhere in the entire program. (Fast, less precise).
- **Flow-Sensitive:** Takes control flow into account, knowing that `p` and `q` might alias at line 10, but after `q = new int()` at line 15, they definitely `NoAlias` at line 20. (Slower, highly precise). LLVM's basic AA is mostly flow-insensitive, augmented by MemorySSA for flow-sensitive queries.

---

## Part 4: Back-End (Instruction Selection)

### What is SelectionDAG? Walk me through how IR gets lowered to it.
SelectionDAG is a graph representation used in LLVM's backend to map generic LLVM IR to target-specific machine instructions.
1. **SelectionDAG Builder**: LLVM IR is traversed to build a Directed Acyclic Graph per Basic Block. Nodes (`SDNode`) represent operations or data, edges represent data flow and control/memory dependencies.
2. **DAG Legalization**: Ensures the DAG only uses types and operations the hardware actually supports (e.g., breaking `i64` add into two `i32` adds on a 32-bit machine).
3. **Instruction Selection**: Matches DAG sub-graphs to machine instructions using rules generated by TableGen.
4. **Scheduling**: Flattens the DAG back into a linear sequence of target `MachineInstrs`.

### What is SelectionDAG vs GlobalISel? Why was GlobalISel introduced?
SelectionDAG has a severe limitation: it works on **one Basic Block at a time**. It is massive, slow, and hard to share logic across targets.
**GlobalISel** is LLVM's newer instruction selector. It operates on the entire function (Globally) using a machine-level SSA representation (`MachineIR`). It is faster, avoids the expensive DAG building/tearing down, enables cross-block instruction matching, and is significantly easier to develop for new architectures.

### Take this IR instruction: `%x = add i32 %a, %b`. Walk me through the backend pipeline.
1. **SelectionDAGBuilder**: Creates an `ISD::ADD` node with `a` and `b` as inputs.
2. **Type/Op Legalization**: Since `i32` is legal on most modern CPUs, no changes happen.
3. **Instruction Selection**: The `ADD` node is pattern-matched against the architecture features (via TableGen). For ARM, it becomes an `ARM::ADD` MachineSDNode.
4. **Scheduling**: The DAG is flattened to linear `MachineInstr` sequence (`MachineIR`).
5. **Register Allocation**: VirtRegs (`%a, %b`) are mapped to physical register (e.g., `W0, W1`).
6. **Code Emission (MC Layer)**: The `MachineInstr` is translated to an `MCInst`, which the MC layer emits as binary bytes or assembly text.

---

## Part 5: TableGen

### What is TableGen?
TableGen is a domain-specific language specific to LLVM. It is used to describe compiler target architecture features (Registers, Instructions, Calling Conventions) in `.td` files. The `llvm-tblgen` tool parses these files and generates massive C++ arrays, enums, and switch statements at build time.

### How do vendor extensions like XQCI get added through TableGen?
To add Qualcomm's custom XQCI RISC-V instructions:
1. Define a new `Feature` flag for XQCI in the RISC-V target `.td` file.
2. Define the instruction encodings, operands, and assembly strings in an `XQCIInstrInfo.td` file.
3. Provide **Selection Patterns**: `def : Pat<(add GPR:$rs1, GPR:$rs2), (XQCI_CUSTOM_ADD GPR:$rs1, GPR:$rs2)>;` so the instruction selector knows how to map general LLVM IR to the custom instructions.

---

## Part 6: Register Allocation

### Graph Coloring Register Allocation End-to-End
1. **Liveness Analysis:** Calculate the Live Intervals for every virtual register (when it is born and when it dies).
2. **Interference Graph Construction:** Create a graph where nodes = virtual registers. Add an edge if two nodes are live at the exact same time (they interfere).
3. **Coalescing:** If `x = y` (a copy), and `x` and `y` don't have an edge in the graph, merge their nodes to eliminate the copy.
4. **Coloring (Chaitin-Briggs):** Try to assign `K` physical colors (registers) to the nodes so no adjacent nodes share a color. We simplify the graph by removing nodes with `< K` edges and pushing to a stack. 
5. **Spilling:** If it can't be colored, pick a node to "spill" to the stack memory. Insert loads/stores, recompute liveness, and try to color again.

### What is rematerialization as an alternative to spilling?
Instead of spilling a value to the stack (which costs slow memory access), if the value is trivially computable (e.g., `x = 5` or `x = get_global_address()`), the compiler just recomputes it right before it's needed again.

### What is LinearScan register allocation?
Instead of an expensive graph, LinearScan sorts all live intervals by start time and iterates linearly. It assigns registers from a free pool. If it runs out of registers, it spills the interval whose end time is furthest in the future. It's `O(N log N)`, heavily used in JIT compilers (like V8) or `O0` compilation where Graph Coloring's `O(N^2)` is too slow.

---

## Part 7: Instruction Scheduling & RISC-V

### Pre-RA vs Post-RA Scheduling
- **Pre-Register Allocation Scheduling:** Focuses on minimizing register pressure. If you pack instructions too tightly, you overlap too many live ranges and force spilling.
- **Post-Register Allocation Scheduling:** Registers are fixed. Now focuses purely on hardware latencies, avoiding pipeline stalls, and resolving hardware execution hazards.

### In-Order vs Out-Of-Order processors
- **Out-of-Order (OoO):** The CPU dynamically reschedules instructions on the fly based on data availability. The compiler's scheduler is less critical (it's mostly a hint).
- **In-Order:** The CPU executes strictly as written. A cache miss will stall the entire pipeline. The compiler's scheduler is **critical** here to manually interleave independent instructions to hide latencies. (Many embedded RISC-V cores are in-order!).

### RISC-V Calling Conventions (RV32 vs RV64)
From a compiler's view, modifying the tablegen backend:
- `RV32`: Uses `f32`/`i32` register class types (`X` and `F` registers are 32 bits wide).
- `RV64`: Uses `f64`/`i64` register class types (`X` registers are 64 bits wide). Pointers are natively 64-bit in the DAG generation. Calling Convention tables (`RISCVCallingConv.td`) adapt how arguments are packed into `a0-a7` vs passed on the stack.

---

## Part 8: AArch64, Oryon & Hexagon Specifics

Qualcomm's flagship targets are ARM-based (Oryon CPU) and the Hexagon DSP. These questions probe the ARM/AArch64 layer specifically. → For the full treatment see [AArch64 Architecture](#guide/13), [NEON & SVE Vectorization](#guide/14), and [The AArch64 Backend + Onboarding](#guide/15).

### Why is Hexagon's VLIW design "the compiler is the scheduler"?
A VLIW core has **no out-of-order hardware** — it issues a fixed *packet* of up to 4 instructions every cycle exactly as the compiler arranged them. There is no dynamic reservation station to hide a bad schedule. So the compiler must (1) find enough independent instructions (ILP) to fill each packet, (2) respect each slot's resource constraints, and (3) software-pipeline loops to overlap iterations. If the compiler packs poorly, you get NOPs and wasted issue width — the performance is *defined* by codegen quality, not silicon cleverness. This is why VLIW scheduling is one of the hardest, most valuable backend skills.

### On AArch64, your loop's pointer increment costs an extra `ADD`. What removes it and where does LLVM form it?
**Pre/post-index addressing** folds the increment into the load/store (`LDR X0, [X1], #8` post-increments `X1` by 8 for free). LLVM forms these in the `AArch64LoadStoreOptimizer` (a late MI pass) and via DAG combines that recognize the `base + offset` then `base += offset` pattern. → [AArch64 addressing modes](#guide/13/the-addressing-modes).

### Why might `CSEL` beat a branch, and when does it lose?
`CSEL Xd, Xn, Xm, cond` is a **branchless** conditional move driven by NZCV flags — it avoids a branch the predictor might mispredict (≈10–20 cycle flush on a deep Oryon pipeline). It wins for short, unpredictable, balanced conditions. It **loses** when the branch is highly predictable (then the branch is ~free and `CSEL` needlessly evaluates both sides) or when one side is expensive/side-effecting and you'd rather not compute it. → [CSEL family](#guide/13/csel-family-branchless-codegen).

### Why does mobile prefer `-Os`/`-O2` over `-O3`, concretely?
Three reasons. (1) **I-cache pressure:** `-O3`'s aggressive inlining and unrolling bloat code; on a small-icache core that causes more misses than the extra ILP saves. (2) **Power:** more instructions retired = more energy; battery life is a product metric. (3) **Diminishing returns:** `-O3`'s extra transforms (aggressive vectorization, unrolling) often don't pay off on memory-bound mobile workloads. So Qualcomm tunes the cost model and pass pipeline toward size/power, not just speed — the cost model is a *product surface*. → [The cost model](#guide/15/4-the-cost-model-is-a-product-surface).

### `-O0` on AArch64 — which instruction selector runs, and what happens on a fallback?
At `-O0` LLVM uses **GlobalISel** on AArch64 (it's the GlobalISel flagship target and faster than SelectionDAG at `-O0`). If GlobalISel hits an unsupported construct it **falls back** to SelectionDAG for that function (counted via `-global-isel-abort=0` / the `globalisel-falls-back` statistic). Part of backend work is shrinking that fallback set. → [What makes the AArch64 target special](#guide/15/part-2-what-makes-the-aarch64-target-special).

### How do C++ `seq_cst` atomics lower on Oryon, and why is the cost different from x86?
A `seq_cst` load is `LDAR`, a `seq_cst` store is `STLR`; RMWs use `LDAXR/STLXR` or, with LSE, a single `CASAL`/`LDADDAL`. Because AArch64 is **weakly ordered**, even acquire/release cost a dedicated instruction (unlike x86 where plain `MOV` already gives them) — but `seq_cst` is barely more than acquire/release on ARM, whereas on x86 the `seq_cst` store is the only one needing a fence. → [Weak memory model & atomics mapping](#guide/13/c-aarch64-mapping-you-must-know-cold).

### A kernel is 20% slower on Oryon core A than core B at identical clocks. Compiler-side investigation?
First confirm the *same* binary runs on both (rule out big.LITTLE scheduling). Then check whether the cores have different **SchedModels** / microarchitectures and whether `-mcpu` is tuned for the slow one — a mismatched scheduling model produces stalls. Use `llvm-mca` to model the hot loop on each core's model, look for resource-port pressure or latency chains, and inspect whether vectorization width or addressing-mode selection differs. → [Scheduling models](#guide/15/part-3-scheduling-models-where-cpu-tuning-lives).

### When does SVE actually help a Qualcomm workload over NEON, and what's the codegen cost?
SVE helps when trip counts are **unknown or non-multiples of the vector width** — predication removes the scalar remainder loop NEON needs, and the *same* binary scales across vector widths (vector-length-agnostic). The codegen cost is that vector types become **scalable** (`<vscale x 4 x float>`): you can't store them in structs, can't assume a compile-time size, and the cost model must reason about an unknown `vscale`. → [NEON vs SVE](#guide/14/part-2-sve-scalable-vectors-the-headline-act).
