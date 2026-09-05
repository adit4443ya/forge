<!--
category: LLVM & Compiler Infrastructure
tags: Pass Manager, AnalysisManager, Middle-End, SSA, Alias Analysis, Cytron
difficulty: Advanced
readTime: 30 min
-->

# LLVM Deep Dive: Pass Infrastructure & The New Pass Manager (NPM)

> [!IMPORTANT]
> **TL;DR — what you must remember:** The New Pass Manager replaces the legacy one with **value-semantics passes**, **explicit analysis dependencies** via `AnalysisManager`, and **proxies** that thread module/function/loop analyses across IR-unit boundaries. Analyses are cached and invalidated precisely; pipelines are composed declaratively (`-passes=...`). The reason NPM exists: cheaper analysis reuse and faster pipelines than the legacy manager's implicit, re-computed dependencies.

---

# 1. The Core Architecture: Two Managers, One Pipeline

LLVM's transformation and analysis logic is built on two primary engines:

1.  **`PassManager<IRUnitT>`**: The **executor**. It holds a sequence of passes and runs them one by one on a given IR unit (Module, Function, etc.).
2.  **`AnalysisManager<IRUnitT>`**: The **state provider**. It runs analysis passes, caches the results, and hands them to transformation passes when requested.

### The IR Units (`IRUnitT`)
The Pass Manager is templated over the IR unit it operates on. The most common are:
- `Module`: The entire translation unit.
- `Function`: A single function.
- `Loop`: A single loop within a function.
- `CGSCC`: Call Graph Strongly Connected Components.

---

# 2. What exactly is in a `PassManager`?

Think of a `PassManager` as a **composite pass**. It implements the same interface as a single pass (`run()` method), but its implementation iterates through a `std::vector` of "Pass Concepts."

### Internal Mechanics:
- **`PassConcept`**: An internal polymorphic wrapper (Type Erasure) that allows the `PassManager` to store different types of passes in the same container.
- **The `run()` method**: When you call `MPM.run(Module, AM)`, it:
    1.  Loops through each pass.
    2.  Asks the `AnalysisManager` for any required analyses.
    3.  Runs the pass's `run()` method.
    4.  Updates the set of "preserved analyses" based on the pass's return value.

---

# 3. AnalysisManager: The Intelligent Cache

The `AnalysisManager` (AM) is much more than a list. It is a sophisticated cache that ensures an analysis (like `DominatorTree`) is only computed when absolutely necessary.

### How it works:
1.  **Query**: A pass calls `AM.getResult<MyAnalysis>(IR)`.
2.  **Check Cache**: AM checks if `MyAnalysis` has already been run on this `IR` unit and if the result is still valid.
3.  **Compute/Return**: 
    - If valid, it returns the cached pointer.
    - If not, it runs the `MyAnalysis::run()` method, stores the result, and returns it.

---

# 4. The `PreservedAnalyses` Catastrophe

This is the #1 correctness concern for LLVM developers.

When a Transformation Pass finishes, it returns a `PreservedAnalyses` object. This tells the `PassManager` which analyses are still "valid" (i.e., the pass didn't change the IR in a way that breaks the analysis).

### Why "Catastrophic"?
If you **incorrectly claim** an analysis is preserved when it's not:

1.  **Stale Data**: The `AnalysisManager` keeps the old, now-incorrect analysis result in its cache.
2.  **Downstream Errors**: The next pass in the pipeline (e.g., GVN or LICM) asks for that analysis.
3.  **Silent Miscompilation**: The next pass uses the **wrong** information (e.g., a `DominatorTree` that says Block A dominates Block B, even though you just added a branch that bypasses A).
4.  **The Result**: The pass makes a perfectly "logical" transformation based on garbage data, resulting in a binary that runs but produces the wrong output.

> [!CAUTION]
> **No Crash, No Assertion.** The compiler finishes successfully. The only way you find out is when your production code starts returning `4` instead of `5`.

---

# 5. Adding New Passes: The Implementation Pipeline

To add a new pass, you typically follow these steps:

### A. The Function Pass (The Workhorse)
Most optimizations happen at the function level.

```cpp
#include "llvm/IR/PassManager.h"
#include "llvm/Analysis/DominatorTree.h"

class MyFunctionPass : public PassInfoMixin<MyFunctionPass> {
public:
  PreservedAnalyses run(Function &F, FunctionAnalysisManager &AM) {
    // 1. Request an analysis
    auto &DT = AM.getResult<DominatorTreeAnalysis>(F);

    bool Changed = false;
    // ... perform transformations using DT ...

    if (!Changed)
      return PreservedAnalyses::all(); // Everything is still valid

    // 2. Be honest about what we broke
    PreservedAnalyses PA;
    PA.preserve<DominatorTreeAnalysis>(); // We kept the DT valid
    // Everything else is invalidated by default
    return PA;
  }
};
```

### B. The Module Pass (Global Scope)
Used for IPO (Interprocedural Optimization) or global analysis.

```cpp
class MyModulePass : public PassInfoMixin<MyModulePass> {
public:
  PreservedAnalyses run(Module &M, ModuleAnalysisManager &AM) {
    // Accessing function-level analyses from a module pass:
    auto &FAM = AM.getResult<FunctionAnalysisManagerModuleProxy>(M).getManager();
    
    for (auto &F : M) {
      if (F.isDeclaration()) continue;
      auto &DT = FAM.getResult<DominatorTreeAnalysis>(F);
      // ... analyze ...
    }
    return PreservedAnalyses::all();
  }
};
```

### C. The Loop Pass (The Specialist)
Requires a `LoopAnalysisManager`.

```cpp
class MyLoopPass : public PassInfoMixin<MyLoopPass> {
public:
  PreservedAnalyses run(Loop &L, LoopAnalysisManager &AM,
                        LoopStandardAnalysisResults &AR, LPMUpdater &U) {
    // LoopStandardAnalysisResults (AR) provides DT, LI, SE, etc. easily
    DominatorTree &DT = AR.DT;
    
    // ... loop optimizations ...
    return PreservedAnalyses::all();
  }
};
```

---

# 6. Wiring It All Together: The Pass Pipeline

You don't just "run" a pass; you add it to a pipeline via `PassBuilder`.

### The Registration Flow:
1.  **Register Analyses**: Inform the `PassBuilder` about your custom analyses.
2.  **Parse Pipeline**: Use a string representation (like `-passes='my-pass'`) to build the pipeline.

```cpp
// In your Tool or Plugin:
PassBuilder PB(TM);

// 1. Register Analysis Managers
ModuleAnalysisManager MAM;
FunctionAnalysisManager FAM;
LoopAnalysisManager LAM;
CGSCCAnalysisManager CGAM;

// 2. Register Proxies (The "Glue" between managers)
PB.registerModuleAnalyses(MAM);
PB.registerCGSCCAnalyses(CGAM);
PB.registerFunctionAnalyses(FAM);
PB.registerLoopAnalyses(LAM);
PB.crossRegisterProxies(LAM, FAM, CGAM, MAM);

// 3. Create the Pass Manager
ModulePassManager MPM;
FunctionPassManager FPM;

// Add passes
FPM.addPass(MyFunctionPass());
MPM.addPass(createModuleToFunctionPassAdaptor(std::move(FPM)));

// 4. Run!
MPM.run(MyModule, MAM);
```

---

# 7. Summary Checklist for Pass Authors

- [ ] **Interface**: Inherit from `PassInfoMixin`.
- [ ] **Analyses**: Use `AM.getResult<T>(IR)` to get data.
- [ ] **Preservation**: ALWAYS return `PreservedAnalyses::all()` if no changes were made.
- [ ] **Updates**: If you change the CFG, update or invalidate the `DominatorTree`.
- [ ] **Registration**: Ensure your pass is registered with the `PassBuilder` if you want to use it via `opt`.


---

# APPENDIX — MIDDLE-END INTERVIEW Q&A

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
- **Load Hoisting**: Yes, but only if the memory address is loop invariant, and Alien Analysis proves no instruction *inside* the loop writes to (aliases) that memory address.
- **Store Hoisting (Sink to Exit)**: Yes, but instead of hoisting, it's called **Loop Sinking**. We load it to a register in the pre-header, modify the register in the loop, and store it once in the loop exit block. Requires proving that no other thread reads/writes the memory, and no loop code reads it unexpectedly (aliasing).

#### What is the relationship between LICM and Alias Analysis (AA)?
Licm is entirely bound by Alias Analysis. To hoist `x = load p`, the compiler asks AA: "Does any store in this loop alias `p`?". If AA returns `MayAlias` for `*q = y` inside the loop, LICM is blocked, because `p` and `q` might overlap, changing `p`'s value per iteration.

### 2. GVN (Global Value Numbering)
#### How does GVN differ from local CSE?
Local CSE (Common Subexpression Elimination) only eliminates redundancies within a single Basic Block. GVN works globally across the entire CFG using dominator trees to prove values are equivalent across branches.

#### What is a value number? How does GVN assign them?
A "value number" is a unique ID (often a hash) representing a specific computation (`Opcode + ValueNum(Op1) + ValueNum(Op2)`). If `a = x + y` gets Value #5, later when evaluating `b = x + y`, GVN sees the operands have the same value numbers, calculates the same hash #5, and replaces `b` with `a`.

#### How does GVN handle loads — what can go wrong?
GVN tries to number memory states. Using MemorySSA, GVN assigns a value number to a `load` based on the pointer and the current memory version (`MemoryUse` token). What can go wrong is **aliasing**. If of an intervening opaque store occurs, GVN must pessimistically assume the memory changed, increment the memory version, and fail to optimize the redundant load.

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
