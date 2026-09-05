<!--
category: LLVM & Compiler Infrastructure
tags: Backend, ISel, SelectionDAG, GlobalISel, Register Allocation, TableGen, Scheduling
difficulty: Advanced
readTime: 40 min
-->

# LLVM Backend Deep Dive: Instruction Selection, Register Allocation & Beyond

> [!IMPORTANT]
> **TL;DR — what you must remember:** After mid-end opts, IR flows through **instruction selection** (SelectionDAG per-block vs GlobalISel whole-function), **register allocation** (live intervals → interference → greedy coloring + spill/split), then **scheduling and emission**. SelectionDAG is the mature default; GlobalISel — AArch64's flagship — is global, faster at `-O0`, and MIR-based. TableGen patterns drive most of isel. Trace one instruction end-to-end and you understand the whole backend.

This is a production-grade reference covering the LLVM backend pipeline in the depth required for a compiler backend engineering interview (Qualcomm, NVIDIA, AMD, Meta, Google). Every section includes concrete examples, internal LLVM mechanics, and targeted Q&A.

> This guide is **target-independent** — it covers the shared CodeGen machinery. For how these stages become concrete on ARM, see [AArch64 Architecture](#guide/13) (registers, addressing modes, flags, weak memory) and [The AArch64 Backend + Onboarding](#guide/15/part-2-what-makes-the-aarch64-target-special) (the actual `llvm/lib/Target/AArch64/` code, GlobalISel, scheduling models).

---

# PART 1 — THE LLVM BACKEND PIPELINE (Big Picture)

After LLVM optimizations finish, the LLVM IR is handed off to the **Target-Independent Code Generator (CodeGen)**. The pipeline is:

```
LLVM IR (Optimized)
   ↓
Instruction Selection   (SDAG or GlobalISel)
   ↓
MachineIR (MachineInstr)
   ↓
Register Allocation     (Live Intervals, Greedy Allocator)
   ↓
Pre-RA Scheduling / Post-RA Scheduling
   ↓
Prologue/Epilogue Insertion (stack frame setup)
   ↓
MC Layer (MCInst → Assembly / Binary Bytes)
```

---

# PART 2 — INSTRUCTION SELECTION: SELECTIONDAG

## What is SelectionDAG?

SelectionDAG is LLVM's classic, per-basic-block instruction selector. After optimization, each basic block of LLVM IR is lowered into a **Directed Acyclic Graph (DAG)** of `SDNode` objects representing operations and their data dependencies. The compiler then matches this DAG to target machine instructions via TableGen-generated rules.

### Why a DAG?
A DAG makes data dependencies between instructions explicit. It facilitates **pattern matching** (recognizing canonical sub-trees and replacing them with machine instructions) and **combining** (folding multiple operations into one).

---

## The SelectionDAG Pipeline — Detailed Steps

### Running Example
```c
int f(int x) {
    return (x << 2) + x;
}
```

LLVM IR:
```llvm
define i32 @f(i32 %x) {
  %shifted = shl i32 %x, 2
  %result  = add i32 %shifted, %x
  ret i32 %result
}
```

### Step 1: Build Initial DAG (SelectionDAGBuilder)
The `SelectionDAGBuilder` traverses the LLVM IR for one basic block and creates `SDNode` objects. For our example:

```
DAG (Initial):
  RET
   |
  ADD
 /   \
SHL   x
|  \
x    2
```

Nodes: `SHL(x, 2)` → `ADD(SHL_result, x)` → `RET(ADD_result)`.
At this stage, the DAG may contain **"illegal"** types or operations — types the target hardware doesn't natively support.

### Step 2: Type Legalization
The legalizer scans every node's types. If a type is not natively supported:
- **Promote**: `i8` → `i32` (widen to a supported type)
- **Expand**: `i64` on 32-bit target → split into two `i32` halves
- **Custom**: Target provides a custom lowering function

Example: On a 32-bit RISC-V target, a 64-bit add might be expanded into `ADD` + `ADDC` (add with carry).

### Step 3: Operation Legalization
Some operations may not have hardware equivalents:
- **Division on RISC-V without M extension** → lowered to a library call `__divsi3`
- **`f16` operations** → promoted to `f32`
- **Vector ops wider than HW vector width** → expanded into scalar loops

### Step 4: DAG Combining (Optimization)
The `DAGCombiner` runs algebraic rewrites on the DAG. This is where elegant simplifications happen:
```
ADD(SHL(x, 2), x)  →  // On AArch64, this matches "lsl + add" or "add lsl" pattern
```
On AArch64 specifically, `ADD(SHL(x, 2), x)` becomes `ADD x, x, LSL #2` — a single instruction! The DAG combiner + target-specific patterns expose this.

### Step 5: Target-Specific Pattern Matching (TableGen ISel)
SelectionDAG walks the DAG bottom-up, matching each subtree against TableGen-generated patterns from `XXXGenDAGISel.inc`. Each pattern maps a DAG pattern → a `MachineInstr`. Example TableGen pattern (conceptual):

```tablegen
// In AArch64InstrInfo.td
def : Pat<(add i32:$dst, (shl i32:$src, (i32 2))),
          (ADDWrs $dst, $src, 2)>;
```

The matcher finds `ADD(SHL(x, 2), x)` in the DAG, matches this pattern, and emits `ADDWrs` (add with optional-shift operand).

### Step 6: Scheduling and MachineInstr Emission
The matched DAG of target-specific nodes is topologically sorted. Instructions are emitted as `MachineInstr` objects in the `MachineFunction`. At this point, virtual registers are introduced (e.g., `%vreg0`, `%vreg1`).

---

## Key SelectionDAG Concepts

### SDNode
The atomic unit of a SelectionDAG. Every operation (add, load, store, branch) is an `SDNode`. Each SDNode has:
- An **opcode** (generic like `ISD::ADD` or target-specific like `AArch64ISD::ADDS`)
- Input **SDValues** (edges to predecessor SDNodes)
- A result **type** (or list of types for multi-output nodes)
- A **chain** operand (for memory order enforcement in memory nodes)

### `ISD::` vs Target Namespaces
- `ISD::ADD` → target-independent integer add
- `AArch64ISD::ADDS` → AArch64-specific "add + set flags"
- During ISel, all `ISD::` nodes must be matched and converted to target-specific `MachineSDNode`s.

### Node Folding (crucial for efficiency)
The DAG allows the selector to fold a load into the operand of an add:
```
Before: %t = load [addr]; %r = add %t, %x
After:  ADDrm %x, [addr]   // load-and-add fused into one instruction (x86-style)
```

---

## Q&A: SelectionDAG

**Q: What is DAG legalization and why does it happen in two phases (Type + Op)?**
Types must be legal before operations can be legalized, because illegal types mean we don't even know what registers to use. Operations on legal types can then be expanded, promoted, or custom-lowered to legal operation sequences.

**Q: Walk me through how `%x = add i32 %a, %b` becomes a machine instruction.**
1. `SelectionDAGBuilder` creates an `ISD::ADD(SDValue(a), SDValue(b))` node.
2. Type legalization: `i32` is legal on most targets → no-op.
3. Op legalization: `ISD::ADD` is legal on all targets → no-op.
4. DAG combiner may fold or simplify.
5. Pattern matcher looks in `XXXGenDAGISel.inc` for `ISD::ADD(GPR:$a, GPR:$b)` → emits `ADD Rd, Ra, Rb`.
6. Scheduler places the `MachineInstr` in the function.

**Q: What is a chain operand in SelectionDAG?**
Memory operations (loads, stores, calls) have a special "chain" input/output that enforces memory ordering. It's not a data dependency — it's a control token ensuring memory accesses are ordered correctly. Without chains, the DAG might legally reorder a write before a read of the same address.

**Q: What is the limitation of SelectionDAG?**
It operates per-basic-block. It cannot see across block boundaries, losing optimization opportunities that span multiple blocks (e.g., hoisting a common subexpression from two branches). This is the primary motivation for GlobalISel.

---

# PART 3 — INSTRUCTION SELECTION: GLOBALISEL

## Why GlobalISel Was Created

SelectionDAG has three fundamental problems:
1. **Extra IR overhead**: Building and tearing down a separate DAG representation per block is slow.
2. **Basic-block scope**: Can't make decisions using information from the wider function.
3. **Code duplication**: Different stages (SelectionDAG, FastISel, etc.) solve the same problems with duplicated code.

GlobalISel solves all three by working on the `MachineIR` (MIR) representation directly, across the *entire function*.

---

## Generic MIR (gMIR)

GlobalISel uses **Generic MIR** as its working representation. gMIR uses MachineInstr objects exactly like normal MIR, but with **Generic Opcodes** (prefixed with `G_`):

| Generic Opcode   | Meaning                       |
|-----------------|-------------------------------|
| `G_ADD`         | Integer add                   |
| `G_LOAD`        | Load from memory              |
| `G_STORE`       | Store to memory               |
| `G_SHL`         | Logical shift left            |
| `G_ICMP`        | Integer comparison            |
| `G_MERGE_VALUES`| Combine narrow regs into wide |
| `G_UNMERGE`     | Split wide reg into narrow    |

The key insight: **gMIR shares MachineIR data structures**. There's no separate DAG to build or tear down. This makes GlobalISel inherently faster to compile.

---

## GlobalISel Pipeline — Four Passes

### Our Example Again
```c
int f(int x) {
    return (x << 2) + x;
}
```

### Pass 1: `IRTranslator`
Analogous to `SelectionDAGBuilder`, but instead of building a DAG, it directly constructs gMIR. The output is a `MachineFunction` with generic opcodes:

```
%vreg0:_(s32) = COPY $w0          // incoming argument
%vreg1:_(s32) = G_CONSTANT i32 2
%vreg2:_(s32) = G_SHL %vreg0, %vreg1
%vreg3:_(s32) = G_ADD %vreg2, %vreg0
$w0 = COPY %vreg3:_(s32)
RET
```

The `_(s32)` annotation means "generic virtual register of type s32" — the register bank has not been determined yet.

### Pass 2: `Legalizer`
Unlike SelectionDAG's two-phase legalization, GlobalISel legalizes iteratively. For each instruction, the target's `LegalizerInfo` table says:
- `Legal` → leave it alone
- `Lower` → target provides a custom lowering
- `WidenScalar` → promote to wider type
- `LibCall` → replace with a library call

Example: On a target without a 16-bit shift, `G_SHL` on `s16` is widened to `s32` and a narrowing `G_TRUNC` is appended.

The legalizer uses helper instructions like `G_MERGE_VALUES` and `G_UNMERGE_VALUES` as temporaries during legalization. This process iterates until all opcodes and types are legal.

### Pass 3: `RegBankSelect`
Virtual registers in gMIR have no register bank assignment yet. This pass decides:
- Does this value belong in the `GPR` bank? `FPR` bank? `VEC` bank?

It uses a cost model to minimize cross-bank copies (e.g., moving a value from `FPR` to `GPR` may require a `FMOV` instruction).

For our example, `%vreg0`, `%vreg2`, `%vreg3` are all pure integers → all assigned to `GPR` bank.

### Pass 4: `InstructionSelect`
This is the actual PatternMatching phase, analogous to SelectionDAG's TableGen-driven matching. The `InstructionSelect` pass consumes gMIR and replaces each generic `G_*` opcode with a concrete target `MachineInstr`, completing the transition from gMIR to full MIR (no generic opcodes remaining).

For AArch64, `G_SHL` + `G_ADD` might combine into a single `ADDWrs` (add with shift), similar to SelectionDAG.

---

## SelectionDAG vs GlobalISel: Complete Comparison

| Aspect | SelectionDAG | GlobalISel |
|---|---|---|
| **Representation** | Separate per-block DAG | MachineIR (gMIR) whole function |
| **Scope** | One basic block at a time | Entire function |
| **Legalization** | Two phases (Type + Op) | Single iterative phase |
| **Speed** | Slower (DAG build/teardown overhead) | Faster compile time |
| **Maturity** | Extremely mature, many targets | Newer, growing adoption |
| **Pattern matching** | TableGen DAGISel | TableGen + custom combiners |
| **Use case** | Default for most targets | AArch64's primary selector |
| **Optimization scope** | Per-block DAG combines | Whole-function combines possible |

**Interview one-liner:**
> "SelectionDAG builds a per-block DAG, legalizes it in type/op phases, and uses TableGen patterns to emit machine instructions. GlobalISel stays in MachineIR form, legalizes iteratively, assigns register banks, and selects instructions — all over the whole function."

---

# PART 4 — TABLEGEN DEEP DIVE

## What is TableGen?

TableGen is LLVM's domain-specific language (`.td` files) for describing target architectures. `llvm-tblgen` processes these files and generates **C++ code** (lookup tables, state machines, switch statements) at build time. The generated code is used by SelectionDAG's ISel, GlobalISel's InstructionSelect, the assembler, and the disassembler.

### Key TableGen constructs:

**`RegisterClass`** — Defines a group of interchangeable registers:
```tablegen
def GPR32 : RegisterClass<"AArch64", [i32], 32,
    (add X0, X1, X2, ..., X30)>;
```
This tells the register allocator: "These registers all hold 32-bit ints and are interchangeable."

**`Instruction`** — Describes an instruction's encoding, operands, assembly string:
```tablegen
def ADDWrr : I<..., "add\t$Rd, $Rn, $Rm", []> {
    bits<5> Rd; bits<5> Rn; bits<5> Rm;
}
```

**`Pat<>` (Selection Pattern)** — Rules that drive ISel:
```tablegen
def : Pat<(add i32:$a, i32:$b), (ADDWrr $a, $b)>;
```
This says: "When the DAG contains an `i32 add` of two registers, emit `ADDWrr`."

**`SDNode`** — Describes a DAG node type that instructions can match against.

### How XQCI (Qualcomm Custom RISC-V Instructions) Would Be Added
1. Create `RISCVInstrInfoXQCI.td` defining the custom instructions with their encoding
2. Add a `SubtargetFeature` for XQCI: `"xqci"` extension
3. Write Selection Patterns linking the custom instruction to IR patterns
4. Add the new `.td` file to the CMake build
5. Ensure the assembler/disassembler know the encoding (same `.td` file drives both)

The beauty: one `.td` file drives the ISel matcher, the assembler, the disassembler, and the MC description.

---

## Q&A: TableGen

**Q: What is an `SDNode` and how does it connect to ISel patterns?**
`SDNode` is the data type representing a node in the SelectionDAG. TableGen patterns use `SDNode` types like `(add ...)`, `(load ...)` to describe the left-hand side (IR pattern) of a selection rule. The generated ISel code traverses the DAG looking for these patterns and fires the rule.

**Q: What are `Pat<>` vs instruction definitions in TableGen?**
Instruction definitions describe the instruction encoding and can embed simple patterns inside `(outs)/(ins)` and pattern fields. `Pat<>` is for more complex patterns that don't fit inside the instruction definition — especially for canonical IR patterns that map to an instruction not trivially described by the instruction definition alone.

---

# PART 5 — REGISTER ALLOCATION: COMPLETE DEEP DIVE

## The Problem

After instruction selection, all values are virtual registers (`%vreg0`, `%vreg1`, ...). There can be thousands of them. The hardware only has a fixed number of physical registers (e.g., 31 on AArch64, 32 on RISC-V). Register allocation must:
1. Assign every virtual register a physical register (or a stack slot)
2. Insert `load`/`store` instructions for values that can't stay in registers ("spills")

---

## Step 1: Compute Live Intervals

A **Live Interval** for virtual register `v` is the range of program points from its definition to its last use.

### Our Example
```c
int foo(int a, int b) {
    int x = a + b;    // line 1: defines x
    int y = x * 2;    // line 2: defines y, uses x
    int z = y + a;    // line 3: defines z, uses y, uses a
    return z + x;     // line 4: returns, uses z, uses x
}
```

LLVM IR (Post-SSA):
```llvm
%x = add i32 %a, %b
%y = mul i32 %x, 2
%z = add i32 %y, %a
%w = add i32 %z, %x
ret i32 %w
```

Live Intervals (using instruction index [start, end]):
| Virtual Reg | Defined | Last Used | Interval |
|---|---|---|---|
| `%a` | entry | line 3 | `[entry, 3]` |
| `%x` | line 1 | line 4 | `[1, 4]` |
| `%y` | line 2 | line 3 | `[2, 3]` |
| `%z` | line 3 | line 4 | `[3, 4]` |

Visual timeline:
```
Instruction:  1      2      3      4
%a:       [===================]
%x:          [=============================]
%y:                 [=========]
%z:                       [=========]
```

**At line 3**, simultaneously live: `%a`, `%x`, `%y`, `%z` — that's 4 live values simultaneously! If the hardware only has 3 free registers, something must spill.

---

## Step 2: Interference Graph

Two virtual registers **interfere** if their live intervals overlap. They cannot share a physical register.

From our example:
- `%x` and `%a` interfere (both live at line 2, 3)
- `%x` and `%y` interfere (both live at line 3)
- `%x` and `%z` interfere (both live at line 4)
- `%y` and `%z` do **not** interfere (`%y` dies at line 3, `%z` is born at line 3 — check: `%y` is killed first)
- `%a` and `%y` interfere (both live at line 3)

Interference Graph:
```
      %a
     / \
   %x   %y
    |
   %z
```

To color this graph with 3 colors (registers):
- `%a` → R1
- `%x` → R2 (must differ from `%a`)
- `%y` → R1 (doesn't interfere with `%a`)
- `%z` → R1 (doesn't interfere with `%y` or `%a`)

Done in 2 registers. Clean.

---

## Step 3: Graph Coloring (Classic Approach)

The Chaitin-Briggs algorithm:
1. Compute the interference graph
2. Identify nodes with degree `< K` (can always be colored safely) — push them on a stack
3. Repeatedly simplify: remove low-degree nodes
4. If stuck (all nodes degree `≥ K`), pick a **spill candidate**, mark it, remove from graph
5. Pop nodes from stack, assign colors (using first available color not used by neighbors)
6. If a spill candidate has no color available, **spill it** (insert load/store in MIR)

### Graph Coloring Limits
- Optimal coloring is NP-complete (graph k-coloring is NP-hard)
- Chaitin-Briggs uses the simplification heuristic to get practical near-optimal results
- The spill decision is the most consequential choice

---

## Step 4: LLVM's Greedy Register Allocator (Production Reality)

LLVM does **not** use pure graph coloring. It uses the `RegAllocGreedy` pass, which is a priority-queue-based greedy allocator with live-range splitting.

### Why Greedy Instead of Graph Coloring?
- Greedy has better compile-time (`O(N log N)` vs `O(N^2)`)
- Live-range splitting (see below) makes greedy dramatically better than basic graph coloring
- Modern allocator-scheduler interactions require more flexibility than the coloring framework provides

### Greedy Allocator Algorithm:
```
Priority Queue ordered by spill weight (higher = more important to keep in register)
   Spill weight ≈ use frequency / live-range length

While queue is not empty:
  1. Pop the highest-priority virtual register v
  2. Find a free physical register P not conflicting with v's neighbors
     - If found: assign v → P ✅
  3. If no free register:
     - Can we EVICT a lower-priority neighbor? → evict it, assign P to v, re-add evicted to queue
     - Can we SPLIT v's live range? → split it into ranges [see below]
     - Last resort: SPILL v to stack → insert loads/stores
```

### Spill Weight Example
Suppose `%x` is used 100 times in a tight inner loop (hot), and `%z` is used once outside the loop (cold). Spill weights: `%x = 100/4 = 25`, `%z = 1/2 = 0.5`. The allocator will strongly prefer spilling `%z` and keeping `%x` in a register.

---

## Step 5: Live-Range Splitting (LLVM's Superpower)

Instead of spilling an entire virtual register's live range, LLVM can **split** it. The live interval is divided into sub-ranges, each of which can be handled independently.

### Conceptual Example
```
%v1 live interval: [1, 100]  ← too long, conflicts with everything
```

After splitting:
```
%v1a: [1,  30]  - allocated to R1
%v1b: [30, 60]  - spilled to stack
%v1c: [60, 100] - allocated to R2
```

**Split points** are chosen where restoring the value into a register is cheap (e.g., outside a loop, where the value is first used in the next range).

**Result:** Instead of spilling 100 uses, we only spill during the `[30, 60]` sub-range where the register is under pressure. The other ranges stay in registers. This is the key insight that makes LLVM's allocator phenomenally effective.

### LLVM's Implementation
LLVM's live-range splitter in `RegAllocGreedy.cpp` (specifically `splitAroundRegion`) uses an `AllocationOrder` and profile-guided information to choose split points near loop boundaries, maximizing the proportion of the live range that ends up in a register.

---

## Step 6: Rematerialization

If a value is cheap to recompute, it's better to **recompute** it than spill to stack and reload.

### Examples

**Constant:**
```llvm
%c = i32 42
```
Instead of: `store %c → [stack]; load %c ← [stack]`
Do: `MOV R0, #42` — recompute at the use site.

**Global Address:**
```llvm
%ptr = global_address @g
```
Instead of spilling the pointer:
```asm
adrp x0, :got:g
ldr  x0, [x0, :got_lo12:g]  // recompute each time
```

**Why it matters:** A stack spill/reload on a modern CPU with a cold cache is 100-200 cycles. A `MOV R0, #42` is 1 cycle. Rematerialization is a massive win wherever applicable.

### LLVM's `isRematerializable()` check
In `TargetInstrInfo`, each instruction can implement `isRematerializable()`. The register allocator queries this before deciding to spill. Constants, frame index computations, and pure global address computations are typically rematerializable.

---

## Step 7: Coalescing (Eliminating Copies)

After SSA destruction, the IR has many copy instructions:
```llvm
%v2 = COPY %v1
```

If `%v1` and `%v2` don't interfere (their live ranges don't overlap), they can be **coalesced** — assigned the same physical register. This makes the COPY disappear entirely.

### Coalescing Algorithm (Briggs / Aggressive)

- **Conservative Coalescing (Briggs):** Merge two nodes A and B if the combined node would still have `< K` neighbors of degree ≥ K. This guarantees colorability is preserved. Safe but may miss opportunities.
- **Aggressive Coalescing:** Just merge regardless — may create harder-to-color graphs, but more copies eliminated.

LLVM uses a combination: `RegisterCoalescer.cpp` runs as a pre-RA pass and aggressively coalesces where safe.

### Coalescing Example
```
Before: %x1 = ADD R1, R2
        %x2 = COPY %x1    // COPY instruction
        USE %x2

After coalescing (if x1 and x2 don't interfere):
        %x1 = ADD R1, R2
        USE %x1           // COPY gone, both use R0
```

---

## Hardware Register Constraints (Critical)

Registers are not uniform across all operations. Physical hardware imposes constraints:

### Calling Convention Constraints
- Function arguments must be in specific registers: `a0-a7` on RISC-V, `x0-x7` on AArch64
- Return value must be in a specific register: `a0` / `x0`
- Caller-saved vs callee-saved distinction affects which registers can be used freely

### Tied Operands
Some instructions require the destination and a source to share the same physical register:
```
IMUL: input in EAX, output in EDX:EAX (x86)
```
The register allocator must satisfy this constraint or insert a copy before the instruction.

### Register Classes
Not all instructions accept all registers:
```
Float ops → NEON/SVE register bank
Integer ops → GPR register bank
```
If a value is the result of a float op but is needed as an integer, a cross-bank copy (`FMOV`) must be inserted.

### Implications for Scheduling
Register allocation and instruction scheduling are tightly coupled:
- Pre-RA scheduling must minimize register pressure (don't create too many simultaneous live values)
- Post-RA scheduling must respect register file access ports and pipeline hazards

---

## Complete Register Allocation Flow

```
MachineIR (virtual registers only)
   ↓
LiveAnalysis: compute def-use chains, live intervals per VReg
   ↓
RegisterCoalescer: eliminate COPY instructions by merging compatible VRegs
   ↓
RegAllocGreedy:
   - Build interference: which VRegs conflict?
   - Priority queue: sort by spill cost
   - Assign: try physical register → evict → split → spill
   - Rematerialize: recompute cheap values instead of spilling
   ↓
Prologue/Epilogue Insertion: callee-save registers pushed/popped on stack
   ↓
Post-RA scheduling: optimize for pipeline use, latency hiding
   ↓
Machine Code (all physical registers, stack slots)
```

---

## Q&A: Register Allocation

**Q: What is the difference between live range and live interval?**
A **live range** is the set of program points where a variable is live (could be disjoint — variable is live in range [1,5] and [10,15]). A **live interval** in LLVM is the union bounding interval (here [1,15]) used for quick interference checking. LLVM uses `LiveInterval` as a sorted set of `Segment` objects, enabling both representations efficiently.

**Q: What is the difference between pre-RA and post-RA scheduling?**
- **Pre-RA scheduling**: Runs before register allocation. Goal: minimize the number of simultaneously live values (register pressure). Tightly packing independent instructions can spike pressure and force spills.
- **Post-RA scheduling**: Runs after RA. Registers are fixed. Goal: reorder instructions to hide instruction latency (avoid waiting for a result), fill delay slots (VLIW), and avoid pipeline hazards.

**Q: How does LLVM decide what to spill?**
LLVM uses a **spill weight** heuristic: `spill_weight = use_frequency / interval_length`. Higher weight → higher priority → last to be spilled. Additionally, LLVM checks `isRematerializable()` and prefers to rematerialize rather than spill when possible. If two candidates have similar weights, LLVM prefers to spill from cold code (outside loops).

**Q: What is coalescing and why does register allocation need it?**
SSA Destruction introduces many `COPY` instructions (when $\phi$-function arguments get identical physical registers). Coalescing assigns the source and destination of a `COPY` to the same physical register, eliminating the copy entirely. Without it, code has many redundant register moves.

**Q: Explain conservative vs aggressive coalescing.**
- **Conservative (Briggs):** Only coalesce if the result is still guaranteed K-colorable. Mathematically safe but leaves behind some removable copies.
- **Aggressive:** Coalesce regardless of degree. May create uncolorable graphs (requiring re-splitting), but removes more copies upfront. LLVM's `RegisterCoalescer` is generally aggressive, compensated by the greedy allocator's splitting capability.

**Q: What is rematerialization?**
Instead of spilling a value to stack memory and later reloading it, if the value is cheap to recompute (constant, global address, simple arithmetic on non-modified values), the compiler inserts the computation again at the use site. Cost: `1 instruction`. Saved cost: `1 store + 1 load ≈ 100-200+ cycles (cache miss)`.

**Q: Why is register allocation considered the hardest optimization?**
Because it interacts with everything:
- **Spilling** adds memory traffic → impacts cache performance
- **Splitting** adds complexity to scheduling
- **Coalescing** interacts with CSSA and copy placement
- **Hardware constraints** (calling conventions, tied operands, register banks) reduce the degrees of freedom
- **The allocator must be fast** (compile-time must be acceptable) while being near-optimal (runtime must be fast)
- Optimal coloring is NP-complete. Every real allocator is a heuristic.

---

# PART 6 — INSTRUCTION SCHEDULING

## Why Scheduling Matters

Modern CPUs are **pipelined** — they execute multiple instructions simultaneously in different pipeline stages. Loading a value from memory takes ~5-100 cycles. If the next instruction immediately needs that value, the CPU **stalls** (waits). The scheduler's job is to **interleave independent instructions** to fill those stall cycles.

## Pre-RA Scheduling vs Post-RA Scheduling

| | Pre-RA | Post-RA |
|---|---|---|
| **Runs** | Before Register Allocation | After Register Allocation |
| **Goal** | Minimize register pressure | Hide instruction latency, avoid hazards |
| **Register state** | Virtual registers | Physical registers (fixed) |
| **Key constraint** | Too many live values → forces spill | Pipeline ports, hazards, delay slots |

## Hazard Types

- **Data Hazard (RAW):** Read-After-Write. `ADD R1, R2, R3; USE R1` — must wait for `ADD` to write `R1`.
- **Structural Hazard:** Two instructions need the same hardware unit at the same time (e.g., two memory accesses on a single-port cache).
- **Control Hazard:** A branch's target is unknown. Branch delay slot (MIPS, SPARC, some RISC-V extensions) — next instruction after branch always executes; the slot should be filled with useful work.

## List Scheduling (LLVM's Primary Algorithm)

1. Build a dependency graph (DAG) of instructions.
2. Assign a **priority** to each instruction (e.g., critical path length).
3. Maintain a **ready list** of instructions whose dependencies have been satisfied.
4. Each cycle: pick the highest-priority ready instruction and schedule it.
5. Add newly-released instructions to the ready list.

**Pre-RA List Scheduler:** Priority = minimize register pressure delta (picking instructions that release registers sooner).
**Post-RA List Scheduler:** Priority = minimize latency (picking instructions that have the most downstream dependents waiting on them).

## In-Order vs Out-of-Order Processors

- **Out-of-Order (OoO):** CPU hardware dynamically reorders instructions. The compiler's schedule is a suggestion, not a mandate. (x86, modern AArch64)
- **In-Order:** CPU executes strictly in issue order. A data dependency stall blocks the entire pipeline. The compiler's schedule is **critical** for performance. (Many embedded RISC-V cores, older ARM, Hexagon VLIW)

**VLIW (Very Long Instruction Word) — Qualcomm Hexagon:**
The compiler must pack multiple independent instructions into a single VLIW packet. There are no hardware hazard detectors. If the compiler creates a packet with a data dependency inside it, the behavior is undefined. The scheduling pass for VLIW is dramatically more complex.

---

# PART 7 — PUTTING IT ALL TOGETHER: ONE FUNCTION, FULL PIPELINE

### Source
```c
int f(int x, int y) {
    return (x << 2) + y;
}
```

### Step 1: LLVM IR (Post-Optimization)
```llvm
define i32 @f(i32 %x, i32 %y) {
  %s = shl i32 %x, 2
  %r = add i32 %s, %y
  ret i32 %r
}
```

### Step 2: SelectionDAG Build
```
DAG:
  RET
   |
  ADD(%s, %y)
  /
SHL(%x, 2)
```

### Step 3: Legalization & Combining
On AArch64, the pattern `ADD(SHL(x, 2), y)` matches:
```
ADD Rd, Rx, Ry, LSL#2  (add with left shift in operand 2)
```
Single instruction.

### Step 4: MachineInstr (post-ISel)
```
ADD_rr %vreg0(x), %vreg1(y), imm 2  // logical shift on second operand
```

### Step 5: Live Intervals
```
%vreg0 (x): [0, 4]  // used in ADD, also implicitly via shift
%vreg1 (y): [0, 4]  // used in ADD
%vreg2 (r): [4, 5]  // result, returned
```

### Step 6: Register Allocation
Calling convention: `x` in `w0`, `y` in `w1`. Result in `w0`.
RA: `%vreg0 → w0`, `%vreg1 → w1`, `%vreg2 → w0` (coalesced with return value slot)

### Step 7: Final Assembly (AArch64)
```asm
f:
  add w0, w1, w0, lsl #2  // w0 = w1 + (w0 << 2) = y + (x << 2)
  ret
```

One instruction. Register allocation, coalescing, and the SelectionDAG combiner together reduced 2 arithmetic ops + a function call overhead into a single 1-cycle instruction.

---

# Interview Cheat Sheet

| Concept | 1-Line Summary |
|---|---|
| **SelectionDAG** | Per-block DAG: build → legalize (type+op) → combine → match (TableGen) → schedule |
| **gMIR** | Generic MachineIR: `G_ADD`, `G_LOAD` etc. GlobalISel's working representation |
| **GlobalISel** | Whole-function, MIR-based pipeline: IRTranslate → Legalize → RegBankSelect → Select |
| **TableGen Pat<>** | `Pat<(add i32:$a, i32:$b), (ADDrr $a, $b)>` maps IR pattern → machine instruction |
| **Live Interval** | `[def_point, last_use_point]` for a virtual register |
| **Interference** | Two VRegs interfere iff their live intervals overlap |
| **Graph Coloring** | Assign physical registers as colors; spill if uncolorable with K colors |
| **Greedy RA** | Priority-queue-based; evict, split, rematerialize, or spill |
| **Live-Range Splitting** | Divide a long interval into sub-ranges; keep hot parts in registers |
| **Rematerialization** | Recompute cheap values instead of spilling to memory |
| **Coalescing** | Merge COPY source + dest into same physical register, eliminating the COPY |
| **Pre-RA Scheduling** | Minimize register pressure before allocation |
| **Post-RA Scheduling** | Hide latency and avoid hardware hazards after allocation |
| **VLIW (Hexagon)** | Compiler packs instructions into packets; no hardware hazard detection |

---

# APPENDIX — QUICK REFERENCE CHEAT SHEET

## 1. Instruction Selection

**SelectionDAG (Classic):** `IR → DAG Build → Type Legalize → Op Legalize → DAG Combine → Pattern Match → Schedule → MachineInstr`
- Works **per basic block** only. DAG nodes (`ISD::ADD`, `ISD::LOAD`) matched to target instructions via TableGen `Pat<>` rules.
- `DAGCombiner` folds patterns like `ADD(SHL(x,2), y)` → single `ADDWrs` on AArch64.

**GlobalISel (Modern):** `IR → IRTranslator → Legalizer → RegBankSelector → InstructionSelect → MachineInstr`
- Works on the **whole function**. Uses **gMIR** (Generic MachineIR with `G_ADD`, `G_SHL`, `G_LOAD` opcodes).
- **Legalizer**: Iteratively replaces illegal ops (no separate Type/Op phases). Uses `G_MERGE_VALUES`/`G_UNMERGE` for type splitting.
- **RegBankSelector**: Assigns virtual regs to register banks (GPR/FPR/Vec) minimizing cross-bank copies.
- **InstructionSelect**: TableGen patterns match gMIR → target `MachineInstr`.

| Aspect | SelectionDAG | GlobalISel |
|---|---|---|
| Scope | 1 basic block | Whole function |
| Representation | Dedicated per-block DAG | gMIR (MachineIR + `G_*` opcodes) |
| Legalization | Two phases (Type then Op) | Single iterative phase |
| Compile time | Slower (DAG build/teardown) | Faster |
| Default on AArch64 | Being phased out | ✅ Default |

---

## 2. TableGen (`.td` files)
- A DSL describing the target to LLVM. `llvm-tblgen` generates ISel matchers, assembler, disassembler, and MC descriptions from a single `.td` file.
- `RegisterClass`: groups interchangeable regs (e.g., `GPR32 = {w0..w30}`)
- `Pat<>`: Selection pattern: `def : Pat<(add i32:$a, i32:$b), (ADDWrr $a, $b)>;`
-  **Adding XQCI (Qualcomm Custom RISC-V Instructions):**
    1. Define a `SubtargetFeature` for XQCI in the target `.td`
    2. Define instruction encoding, operands, asm string in `RISCVInstrInfoXQCI.td`
    3. Write `Pat<>` rules mapping IR patterns → custom instructions
    4. The same `.td` file drives ISel + assembler + disassembler — no duplication

---

## 3. Register Allocation (RA)
**The problem:** Post-ISel, we have unlimited virtual registers. Hardware has ~31. RA assigns virtual → physical registers and inserts spill/reload code where registers run out.

**Key algorithm — LLVM's `RegAllocGreedy`:**
1. **Live Interval Analysis**: Compute `[def_point, last_use_point]` for every virtual register
2. **Interference**: Two VRegs interfere iff their live intervals overlap → cannot share a physical register
3. **Priority Queue**: Order VRegs by `spill_weight = use_frequency / interval_length` (higher → allocate first)
4. **Allocate**: For each VReg, try to assign a free physical register
   - If no free register → **evict** a lower-priority VReg
   - If eviction bad → **split** the live interval into sub-ranges
   - If unsplittable → **spill** (insert `store`/`load` instructions around uses)
   - If cheap to recompute → **rematerialize** (`MOV r, #42` instead of load from stack)
5. **Coalescing**: Eliminate `COPY %v1 → %v2` by merging both into the same physical register

**Key distinctions:**
- **Graph Coloring (Chaitin-Briggs) vs Greedy**: Coloring is theoretical (NP-complete). Greedy is practical (O(N log N)) with splitting.
- **Live-Range Splitting**: Split a long conflicting interval into hot (in-register) and cold (spilled) sub-ranges.
- **Rematerialization**: Instead of spilling `x = 5` to RAM, recompute it as `MOV r, #5` at the use site. ~100x faster than a cache-miss reload.

---

## 4. Instruction Scheduling

**Pre-RA Scheduling** (before Register Allocation):
- Goal: minimize **register pressure** — packing too many live values simultaneously forces spills
- Scheduler prefers instructions that release (kill) live values sooner

**Post-RA Scheduling** (after Register Allocation):
- Registers are fixed. Goal: **hide instruction latency** and avoid pipeline stalls
- Scheduler uses target-specific latency tables (e.g., "DIV takes 20 cycles")

**In-order vs Out-of-order processors:**
- **OoO (x86, modern AArch64)**: CPU reorders instructions dynamically. Compiler schedule is a hint.
- **In-order (many RISC-V cores)**: CPU executes strictly in order. A stall blocks the pipeline. **Compiler schedule is critical.**
- **VLIW (Qualcomm Hexagon)**: Compiler packs multiple independent ops into one "packet". No hardware hazard checking. Wrong packets = undefined behavior.
