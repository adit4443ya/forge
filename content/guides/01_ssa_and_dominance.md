<!--
category: LLVM & Compiler Infrastructure
tags: SSA, Dominance, Phi Functions, Cytron, MemorySSA, De-SSA
difficulty: Advanced
readTime: 45 min
-->

# SSA Construction & Destruction: Complete Deep Dive

> [!IMPORTANT]
> **TL;DR — what you must remember:** SSA gives every value exactly one definition, so every use has one unambiguous reaching def — collapsing O(N²) dataflow into O(1) def-use lookups. φ-nodes reconcile values where control flow merges; they go at the **iterated dominance frontier** (Cytron's algorithm) and are destroyed during register allocation by inserting copies (mind the lost-copy and swap problems). Dominance is the backbone: A dominates B if *every* path to B passes through A.

---

# PART 1 — WHY SSA EXISTS

## The Core Problem SSA Solves

Consider this simple code:

```cpp
x = 1;
x = 2;
y = x + 1;
```

Without SSA, the compiler asks: **which definition of x does `y = x + 1` use?** It has to do expensive dataflow analysis to figure this out. For large programs with complex control flow, this becomes computationally expensive and imprecise.

SSA (Static Single Assignment) solves this by enforcing one rule:

> **Every variable is defined exactly once.**

After SSA transformation:
```
x1 = 1;
x2 = 2;
y1 = x2 + 1;
```

Now the question "which definition does y use?" has a trivial answer — it's right there in the variable name. `y1 = x2 + 1` uses `x2` by definition.

This makes almost every compiler analysis and optimization drastically simpler and faster.

---

## What SSA Enables

| Optimization | Why SSA Helps |
|---|---|
| Constant propagation | If x1 = 5, replace all uses of x1 with 5 trivially |
| Dead code elimination | If x1 has no uses, the definition is dead |
| Common subexpression elimination | Two instructions producing same value are identical |
| Register allocation | SSA variables are natural candidates for registers |
| Loop optimizations | Induction variable analysis is trivial |
| Alias analysis | Def-use chains are explicit |

---

## The Problem SSA Hits at Join Points

Now consider:

```cpp
if (condition)
    x = 1;
else
    x = 2;
y = x + 1;
```

After SSA renaming:
```
if (condition)
    x1 = 1;
else
    x2 = 2;
y1 = ??? + 1;   // which version of x?
```

At the join point after the if-else, we have two possible definitions of x. SSA needs a way to say "whichever one was live on the path we came from." This is exactly what the **φ (phi) function** solves.

```
if (condition)
    x1 = 1;
else
    x2 = 2;
x3 = φ(x1, x2);   // x3 = x1 if we came from true branch, x2 if false branch
y1 = x3 + 1;
```

The φ function is not a real instruction — it's a compiler fiction. It says: "at this join point, select the value that was live on the incoming control flow edge." During code generation (de-SSA), φ functions are replaced by actual move instructions or register assignments.

> → **Deep dive:** when a φ merges two values guarded by a condition, the backend often skips the moves entirely and emits a *branchless conditional select* instead. See the AArch64 [CSEL / CCMP family](#guide/13/csel-family-branchless-codegen) — and when it beats a real branch.

---

# PART 2 — BUILDING BLOCKS BEFORE CYTRON'S ALGORITHM

Before understanding Cytron's algorithm, you need three concepts cold.

---

## 2.1 — Control Flow Graph (CFG)

A CFG represents a program as a graph where:
- **Nodes** = basic blocks (maximal sequences of instructions with no branches inside)
- **Edges** = possible control flow transfers between blocks

Example program:
```cpp
// Block 1
x = input();
if (x > 0)
    // Block 2
    y = x * 2;
else
    // Block 3
    y = x * -1;
// Block 4
return y;
```

CFG:
```
        [B1: x = input(); if x > 0]
               /              \
    [B2: y = x*2]      [B3: y = x*-1]
               \              /
              [B4: return y]
```

**Key terms:**
- **Predecessor** of B: blocks with edges TO B
- **Successor** of B: blocks with edges FROM B
- **Entry block**: the unique start node
- **Exit block**: the unique end node

---

## 2.2 — Dominance

**Definition:** Block A **dominates** block B (written A dom B) if **every path** from the entry to B must pass through A.

**Key properties:**
- Every block dominates itself
- The entry block dominates every block
- Dominance is transitive: if A dom B and B dom C, then A dom C
- Dominance is unique: every block (except entry) has exactly one **immediate dominator** (idom) — the closest dominator

**Example CFG:**

```
        Entry
          |
         [1]
        /   \
      [2]   [3]
        \   /
         [4]
          |
         [5]
```

Dominance relationships:
- Entry dom {1,2,3,4,5} — must pass through entry
- 1 dom {2,3,4,5} — must pass through 1
- 4 dom {5} — only path to 5 goes through 4
- 2 does NOT dom 4 — can reach 4 via 3 without going through 2
- 3 does NOT dom 4 — can reach 4 via 2 without going through 3

Immediate dominators:
- idom(2) = 1
- idom(3) = 1
- idom(4) = 1
- idom(5) = 4

---

## 2.3 — Dominator Tree

The immediate dominator relationships form a tree:

```
        Entry
          |
         [1]
       / | \
     [2][3][4]
            |
           [5]
```

This tree is the **dominator tree**. It's a fundamental data structure — Cytron's algorithm is built entirely on it.

**How to compute dominators (Cooper's simple algorithm):**

The classic textbook uses iterative dataflow. Cooper's algorithm (used in practice):

```
dom(entry) = {entry}
for all other nodes n:
    dom(n) = {all nodes}  // pessimistic start

repeat until no change:
    for each node n in CFG order:
        dom(n) = {n} ∪ (∩ dom(p) for all predecessors p of n)
```

LLVM uses a more efficient algorithm based on the **Lengauer-Tarjan** algorithm (O(n α(n)) — nearly linear).

---

## 2.4 — Dominance Frontier

This is the most critical concept for SSA construction.

**Definition:** The dominance frontier of block A (DF(A)) is the set of blocks B such that:
- A dominates a **predecessor** of B
- A does **not** strictly dominate B itself

Intuitively: DF(A) is the set of blocks where A's dominance "ends." These are exactly the places where φ functions are needed for variables defined in A.

**Why:** If you define a variable in block A, and that definition reaches some block B via one path but not another path, then B is where you need a φ function. That's exactly the definition of DF(A).

**Example — computing DF:**

```
        [1]
       /   \
     [2]   [3]
    /   \     \
  [4]   [5]   [6]
    \   /     /
     [7]-----
```

Let's compute DF for each node:

DF(1): 1 dominates everything. No block has 1 as dominator of a predecessor but not itself dominated by 1. DF(1) = {}

DF(2): 2 dominates {4,5,7} (through left side). 
- Does 2 dom a predecessor of 7? Yes (2→4→7 and 2→5→7). Does 2 strictly dom 7? No (can reach 7 via 3→6→7). So 7 ∈ DF(2).
- DF(2) = {7}

DF(3): 3 dominates {6}. 3 dominates a predecessor of 7 (6). Does 3 strictly dom 7? No. So 7 ∈ DF(3).
- DF(3) = {7}

DF(4): 4 dominates nothing beyond itself. 4 dominates predecessor of 7. Does 4 dom 7? No.
- DF(4) = {7}

DF(5): same reasoning.
- DF(5) = {7}

DF(6): DF(6) = {7}

DF(7): DF(7) = {}

**Key insight:** Block 7 is in almost everyone's dominance frontier — because it's the join point where multiple paths converge. This is exactly where φ functions are needed.

---

# PART 3 — CYTRON'S ALGORITHM

Cytron et al. (1991) is THE foundational SSA construction paper. The algorithm has two phases:

1. **φ-function placement** — where to insert φ functions
2. **Variable renaming** — rename variables to satisfy single-assignment

---

## Phase 1 — φ-Function Placement

**The key insight:** A φ function for variable v is needed at block B if and only if B is in the dominance frontier of some block that defines v.

**The Loop Header Superpower:** A loop header `H` inherently dominates its latch block `L`. Because `L` has a backedge to `H`, `H` strictly dominates a predecessor of itself, placing `H` inside its own Dominance Frontier `DF(H)`. This guarantees that loop induction variables beautifully require φ-functions exactly at the loop header.

**But there's a subtlety:** inserting a φ function at B is itself a definition of v. So B now defines v, and we need to check DF(B) too. This is exactly what the **Iterated Dominance Frontier (IDF)** calculates. It recursively guarantees that chains of control-flow merges all get properly bridged by φ-functions.

**Side Note: How LLVM builds SSA (`mem2reg`)**
The frontend (Clang) avoids complex SSA math by dumping all local variables to memory via `alloca`. The middle-end pass `mem2reg` looks for `alloca`s that never escape. It computes the IDF for the blocks containing stores to those addresses, inserts the necessary φ-functions, replacing later loads with SSA virtual registers, and deletes the `alloca`/`load`/`store` instructions.

**Algorithm:**


```
For each variable v:
    WorkList = {all blocks that define v}
    HasAlready = {} (blocks where φ already placed)
    
    while WorkList is not empty:
        pick block B from WorkList
        for each block Y in DF(B):
            if Y not in HasAlready:
                insert φ function for v at top of Y
                add Y to HasAlready
                if Y not already in WorkList:
                    add Y to WorkList  // Y now defines v (via φ), so check DF(Y)
```

---

## Phase 1 Worked Example

**Program:**
```cpp
B1: x = 5;
    if (cond) goto B2 else goto B3;
B2: x = x + 1;
    goto B4;
B3: x = x * 2;
    goto B4;
B4: y = x;
    return y;
```

**CFG:**
```
    [B1]
   /    \
[B2]   [B3]
   \    /
    [B4]
```

**Dominance tree:**
```
    B1
   / | \
 B2 B3  B4
```

B1 dominates all. B4 is in DF(B2) and DF(B3) because:
- B2 dominates a predecessor of B4 (itself), but doesn't strictly dominate B4
- Same for B3

**Definitions of x:**
- B1 defines x
- B2 defines x
- B3 defines x

**WorkList** = {B1, B2, B3}

**Iteration 1:**
- Process B1: DF(B1) = {} → nothing
- Process B2: DF(B2) = {B4} → place φ for x at B4. Add B4 to HasAlready. B4 not in WorkList, add it.
- Process B3: DF(B3) = {B4} → B4 already in HasAlready, skip.
- Process B4 (newly added): DF(B4) = {} → nothing

**Result:** φ function for x placed at B4.

**Program after φ placement:**
```
B1: x = 5;
    if (cond) goto B2 else goto B3;
B2: x = x + 1;
    goto B4;
B3: x = x * 2;
    goto B4;
B4: x = φ(x, x);   ← φ function placed here
    y = x;
    return y;
```

---

## Phase 2 — Variable Renaming

After placing φ functions, rename every definition and use to give each a unique subscript. This is done via a **DFS traversal of the dominator tree**, maintaining a stack of current versions for each variable.

**Algorithm:**

```
For each variable v:
    counter[v] = 0
    stack[v] = []

rename(block B):
    for each instruction in B (including φ functions):
        // First: rename uses (except in φ functions — their uses are renamed when processing predecessors)
        for each use of variable v in instruction:
            replace v with top of stack[v]
        
        // Then: rename definitions
        for each definition of variable v:
            counter[v]++
            push counter[v] onto stack[v]
            replace definition with v_counter[v]
    
    // Process successors: fill in φ function arguments
    for each successor S of B:
        for each φ function at top of S for variable v:
            replace the appropriate φ argument with top of stack[v]
    
    // Recurse on dominator tree children
    for each child C of B in dominator tree:
        rename(C)
    
    // Pop all definitions made in this block
    for each definition made in B:
        pop stack[v]
```

---

## Phase 2 Worked Example — Renaming

Using the same program after φ placement:

```
B1: x = 5
B2: x = x + 1
B3: x = x * 2
B4: x = φ(x_from_B2, x_from_B3)
    y = x
```

Start: counter[x] = 0, stack[x] = []

**Process B1:**
- `x = 5` → definition of x
  - counter[x] = 1, push 1, stack[x] = [1]
  - rename: `x1 = 5`
- Fill φ arguments in successors: B2 and B3 have no φ. B4's φ: set first argument (from B1? No — B4 is not direct successor of B1 in this CFG)

Actually let me use the correct CFG edges: B1→B2, B1→B3, B2→B4, B3→B4.

**Dominator tree:**
```
    B1
   /|\
 B2 B3 B4
```

**DFS on dominator tree:** B1 → B2 → B4 → B3 (backtrack up to B1 then down to B3)

---

**Step 1 — Process B1:**
```
Instruction: x = 5
Uses: none
Definition: x → counter[x]++ = 1, stack[x] = [1], rename to x1
Result: x1 = 5

Fill φ arguments in B1's CFG successors (B2, B3):
- Neither B2 nor B3 has φ functions
```

State: stack[x] = [1]

---

**Step 2 — Process B2 (child of B1 in dominator tree):**
```
Instruction: x = x + 1
Uses: x → top of stack[x] = x1, replace → x = x1 + 1
Definition: x → counter[x]++ = 2, stack[x] = [1,2], rename to x2
Result: x2 = x1 + 1

Fill φ arguments in B2's CFG successors (B4):
- B4 has φ: x = φ(?, ?)
- B2→B4 edge: set the argument corresponding to B2 = top of stack[x] = x2
- φ becomes: x = φ(x2, ?)
```

State: stack[x] = [1, 2]

---

**Step 3 — Process B4 (child of B1 in dominator tree, but visited via B2's edge):**

Wait — important clarification. We process B4 as a child of B1 in the **dominator tree** (B1 is idom of B4), but B4's φ arguments get filled when we process B4's CFG predecessors (B2 and B3).

```
Instruction: x = φ(x2, ?)   ← uses renamed when predecessors were processed
Definition: x → counter[x]++ = 3, stack[x] = [1,2,3], rename to x3
Result: x3 = φ(x2, ?)

Instruction: y = x
Uses: x → top of stack[x] = x3 → y = x3
Definition: y → counter[y]++ = 1, stack[y] = [1]
Result: y1 = x3
```

State: stack[x] = [1, 2, 3], stack[y] = [1]

Pop B4's definitions: stack[x] = [1, 2], stack[y] = []

---

**Step 4 — Backtrack to B1, process B3:**

Pop B2's definitions first: stack[x] = [1]

```
Instruction: x = x * 2
Uses: x → top of stack[x] = x1, replace → x = x1 * 2
Definition: x → counter[x]++ = 4, stack[x] = [1,4], rename to x4
Result: x4 = x1 * 2

Fill φ arguments in B3's CFG successors (B4):
- B4's φ: set argument corresponding to B3 = top of stack[x] = x4
- φ becomes: x3 = φ(x2, x4)  ← now complete!
```

---

**Final SSA Form:**
```
B1: x1 = 5
    if (cond) goto B2 else goto B3

B2: x2 = x1 + 1
    goto B4

B3: x4 = x1 * 2
    goto B4

B4: x3 = φ(x2, x4)
    y1 = x3
    return y1
```

This is valid SSA: every variable defined exactly once, φ functions at join points, def-use chains are explicit.

---

## Larger Example — Loop

```cpp
B1: i = 0;
    goto B2;
B2: if (i < N) goto B3 else goto B4;
B3: A[i] = i * 2;
    i = i + 1;
    goto B2;
B4: return;
```

**CFG:**
```
[B1] → [B2] ⇄ [B3]
              ↓
            [B4]
```

B2 has a **back edge** from B3 (loop).

**Dominance:**
- B1 dom {B1,B2,B3,B4}
- B2 dom {B2,B3,B4}
- B3 dom {B3}
- B4 dom {B4}

**Dominator tree:**
```
    B1
     |
    B2
   /  \
 B3   B4
```

**Dominance frontiers:**
- DF(B1) = {}
- DF(B2) = {B2} ← B2 is in its OWN frontier! (because B3 is a predecessor of B2, and B2 dominates B3, but B2 doesn't strictly dominate itself)
- DF(B3) = {B2}
- DF(B4) = {}

**This is the loop φ pattern:** When a variable is defined in a loop body (B3 defines i) and also before the loop (B1 defines i), a φ function is needed at the loop header (B2) — which is in its own dominance frontier.

**Definitions of i:** B1, B3

WorkList = {B1, B3}

- Process B1: DF(B1) = {} → nothing
- Process B3: DF(B3) = {B2} → place φ for i at B2. Add B2 to WorkList.
- Process B2: DF(B2) = {B2} → B2 already in HasAlready → skip.

**φ placement result:**
```
B2: i = φ(i_from_B1, i_from_B3)   ← loop φ
```

**After full renaming:**
```
B1: i1 = 0
    goto B2

B2: i2 = φ(i1, i3)    ← i2 is either initial value or loop-updated value
    if (i2 < N) goto B3 else goto B4

B3: A[i2] = i2 * 2
    i3 = i2 + 1
    goto B2

B4: return
```

**This is the canonical loop φ pattern.** Every loop induction variable in SSA form has exactly this shape:
```
loop_header: iv = φ(initial_value, updated_value)
```

The optimizer immediately recognizes this as an induction variable and can do:
- Strength reduction (replace iv*4 with a running pointer)
- Loop bounds analysis
- Vectorization (iv increments by 1, predictable)

---

# PART 4 — PRUNED SSA AND SEMI-PRUNED SSA

Minimal SSA (what Cytron's algorithm produces) can place φ functions that are never actually used — at join points for variables that aren't live there. Two refinements:

**Semi-pruned SSA:**
Only insert φ for variable v at block B if v is **live at entry of some block** (i.e., v has uses somewhere, not just in its defining block). Simple and cheap to compute. LLVM uses this.

**Pruned SSA:**
Only insert φ where v is actually live — full liveness analysis required. Fewer φ functions but more expensive to construct. Produces the minimal φ-function set.

**Why it matters:** Fewer φ functions = simpler IR = faster optimization passes. For large programs this makes a meaningful difference in compile time.

---

# PART 5 — DE-SSA (SSA DESTRUCTION)

After all optimizations are done in SSA form, the compiler must generate actual machine code. Machine code has no φ functions — registers just hold values. The process of eliminating φ functions is called **de-SSA** or **SSA destruction**.

---

## The Naïve Approach — Insert Copies

The simplest de-SSA: for each φ function `v3 = φ(v1, v2)`, insert a copy on each incoming edge:

```
// SSA
B2: x2 = x1 + 1 → goto B4
B3: x4 = x1 * 2 → goto B4
B4: x3 = φ(x2, x4)

// After naïve copy insertion
B2: x2 = x1 + 1
    x3 = x2        ← copy inserted on B2→B4 edge
    goto B4
B3: x4 = x1 * 2
    x3 = x4        ← copy inserted on B3→B4 edge
    goto B4
B4: (φ removed, x3 already has right value)
```

This is correct but wastes registers and adds copy instructions. The goal of de-SSA is to eliminate as many copies as possible — ideally all of them — through **coalescing**.

---

## The Real Problem — The Lost Copy Problem

Consider:

```
B1: a1 = x1
    goto B2

B2: x2 = φ(x1, a1)
    a2 = x2
    goto B2    ← self loop
```

Naïve copy insertion:
```
B1: a1 = x1
    x2 = x1    ← copy for φ from B1 side
    goto B2

B2: // x2 is live
    a2 = x2
    x2 = a1    ← copy for φ from B2 side (loop back edge)
    goto B2
```

But wait — on the loop back edge, we copy `a1` into `x2`. But `a2 = x2` happens BEFORE the copy. So we need to save x2 before overwriting it. This ordering dependency is the **lost copy problem**.

The issue: φ functions are evaluated **simultaneously** at the start of a block, not sequentially. All φ functions in a block read their inputs before any writes the outputs. Naïve sequential copy insertion violates this.

---

## Solving the Lost Copy Problem — Parallel Copies

The solution: treat all copies from φ functions in a block as a **parallel copy** — all reads happen before all writes.

```
// Parallel copy semantics
(x3, y3) = (x2, y2)   // reads x2 and y2, then writes x3 and y3 simultaneously
```

Sequential copies can implement parallel copies using a **swap** when there's a cycle:

**Simple case (no cycle):**
```
// Parallel: (a=b, b=c)
// Sequential (resolve by dependency order):
a = b
b = c  // b read before being overwritten — correct
```

**Cycle case:**
```
// Parallel: (a=b, b=a)   ← swap!
// Sequential with temp:
temp = a
a = b
b = temp
```

**Longer cycle:**
```
// Parallel: (a=b, b=c, c=a)
temp = a
a = b
b = c
c = temp
```

The algorithm for sequentializing parallel copies:
1. Build a graph where each copy `dst = src` is a directed edge src→dst
2. Find all connected components
3. Components without cycles: process in topological order
4. Components with cycles: break cycle with a temporary, then topological order

---

## Register Allocation and Coalescing

The real de-SSA in production compilers is intertwined with **register allocation**. The goal is not just to eliminate φ functions but to assign SSA variables to physical registers such that φ-related variables can share the same register — eliminating the copy entirely.

**Coalescing:** if `x2` and `x3` are assigned the same physical register, then the copy `x3 = x2` is a no-op and disappears.

**The constraint:** two SSA variables can be coalesced (share a register) if their **live ranges don't overlap** — they're never simultaneously live.

**The interference graph:**
- Nodes: SSA variables
- Edges: two variables interfere if they are simultaneously live at some program point
- Register allocation = graph coloring (assign colors = registers, no two adjacent nodes same color)

**φ-related coalescing:**
- `x3 = φ(x2, x4)` wants x2, x3, x4 to all get the same register
- This is possible only if x2 and x4 don't interfere with each other or with other uses of x3's register

**CSSA (Conventional SSA) to the Rescue:**
To elegantly solve overlapping live-ranges of φ-function arguments before De-SSA, compilers convert the IR into **CSSA**. CSSA enforces a strict rule: all variables tied to a φ-function must have compatible, non-interfering live ranges. If they do interfere, CSSA inserts dummy copies to split their lifespans, guaranteeing safe coalescing during register allocation.

---

## Complete De-SSA Example End-to-End

**SSA Form (from our earlier example):**
```
B1: x1 = 5
    if (cond) goto B2 else goto B3

B2: x2 = x1 + 1
    goto B4

B3: x4 = x1 * 2
    goto B4

B4: x3 = φ(x2, x4)
    y1 = x3
    return y1
```

**Step 1 — Liveness Analysis:**

Live variables at each point (backwards analysis):
```
B4 entry: {x2 or x4} (one of them, depending on path)
B4: after φ: x3 live, x2/x4 dead
    after y1=x3: y1 live, x3 dead
    return: nothing

B2 exit: x2 live (needed for φ in B4)
B2 entry: x1 live (needed for x2 = x1+1)

B3 exit: x4 live (needed for φ in B4)
B3 entry: x1 live (needed for x4 = x1*2)

B1 exit: x1 live
B1 entry: nothing (x1 just defined)
```

**Step 2 — Interference Graph:**
```
x1 interferes with: nothing (dies before x2/x4 are used in B4)
x2 interferes with: x4? 
    - x2 is live on edge B2→B4
    - x4 is live on edge B3→B4
    - These are different paths — x2 and x4 are NEVER simultaneously live
    - So x2 and x4 do NOT interfere!
x3 interferes with: nothing else live at same time
y1 interferes with: nothing else
```

**Step 3 — Coalescing:**

Since x2 and x4 don't interfere, and x3 = φ(x2, x4):
- Assign x2, x3, x4 all to the same register, say **R1**
- Assign x1 to **R2**
- Assign y1 to **R1** (doesn't interfere with anything else at that point)

**Step 4 — Final Code (φ eliminated, copies eliminated):**
```
B1: R2 = 5
    if (cond) goto B2 else goto B3

B2: R1 = R2 + 1     // x2 → R1
    goto B4

B3: R1 = R2 * 2     // x4 → R1 (same register!)
    goto B4

B4:                  // φ completely eliminated — R1 already has right value!
    R1 = R1        // y1 = x3 (no-op, coalesced)
    return R1
```

---

# PART 6 — SSA VS. MEMORYSSA: THE MODERN PARADIGM

Answering the common question: **"Is basic SSA dead now that we have MemorySSA?"**
The answer is **No**. They serve completely different masters.

| Feature | Standard SSA (Virtual Registers) | MemorySSA (The Heap/Stack Shadow) |
| :--- | :--- | :--- |
| **Target** | **Values** (ints, floats, pointers) | **Memory States** (What the memory looks like) |
| **Logic** | Defines a name for a result. | Defines a version of the entire memory. |
| **Complexity** | Trivial O(1) def-use walk. | Eliminates expensive O(N^2) Alias Analysis. |
| **Example** | `x1 = a + b` | `MemoryDef(1) = Store(ptr, value, MemoryDef(0))` |

### 6.1 — Why SSA isn't enough for Memory
Standard SSA requires a **Unique Name**. But in memory, we have **Aliasing**:
```cpp
*p = 10;
*q = 20;
val = *p; // What is val?
```
SSA can't rename `*p` to `p1` and `p2` easily because we don't know if `p == q`. If `p == q`, then `val` is 20. If not, `val` is 10. 

### 6.2 — How MemorySSA fixes this
MemorySSA treats every store as a **Definition of the entire memory state**.
- **`MemoryDef(ID)`**: A store or a function call that *might* change memory.
- **`MemoryUse(ID)`**: A load that *might* read a specific state.
- **`MemoryPhi`**: A join point where multiple memory versions merge.

**LLVM MemorySSA Example:**
```llvm
; MemoryService(0) is the initial heap state
1 = MemoryDef(0)  ; store i32 10, i32* %p
2 = MemoryDef(1)  ; store i32 20, i32* %q
3 = MemoryUse(2)  ; %val = load i32, i32* %p
```
If Alias Analysis proves `p` and `q` don't alias, MemorySSA can instantly optimize the `MemoryUse(2)` to point back to `MemoryDef(1)`, or even skip straight to `0` for the original value.

### 6.3 — The "Killer App": EarlyCSE & GVN
Without MemorySSA, the **Global Value Numbering (GVN)** pass has to walk backwards through every instruction in every block to check for potential aliases. 
With MemorySSA, GVN just looks at the `MemoryUse` ID. If the ID hasn't changed since the last load, the memory is guaranteed to be unchanged.

### 6.4 — Summary: The Two-Layer Stack
1.  **Lower Layer: SSA**. Manages your registers, math, and dataflow.
2.  **Upper Layer: MemorySSA**. Manages your `memcpy`, `load`, `store`, and `call` dependencies.

Modern compilers (LLVM 12+) use **both simultaneously**. You don't "switch" to MemorySSA; you use SSA for your math and query MemorySSA to safely optimize your loads and stores. 

The φ function generated **zero copies** in the final code. This is the ideal outcome of de-SSA with coalescing.

---

## When Coalescing Fails — Copy Must Stay

```
B1: x1 = x2 + 1
    goto B2

// Loop back edge — x1 feeds back into x2's φ
B2: x2 = φ(x_init, x1)
    ...
    goto B2
```

Interference check: x1 and x2 are simultaneously live (x1 is live at B2's entry because it feeds the φ, and x2 is live throughout the loop body). They INTERFERE.

They cannot share a register. The copy `x2 = x1` must be emitted:
```
B1: R1 = R2 + 1     // x1 in R1
    R2 = R1          // copy: x2 gets x1's value for next iteration
    goto B2
B2: ...use R2...     // x2 in R2
```

This is unavoidable. The copy is real work the hardware must do.

---

# PART 7 — TIPS & QnA

## Tips

**Tip 1:** When drawing dominator trees in an interview, always verify by asking: "can I reach this block without going through the supposed dominator?" If yes, it's not a dominator.

**Tip 2:** The loop φ pattern `iv = φ(init, updated)` is the most common φ you'll encounter in practice. Recognize it instantly.

**Tip 3:** φ functions with only one argument are useless and should be eliminated immediately — they mean there's only one predecessor, so no actual merge happens.

**Tip 4:** De-SSA without register allocation first is wasteful. Good compilers integrate them. LLVM does register allocation on SSA-like form (with virtual registers) and resolves φ functions as part of register allocation (the "phi elimination" pass in LLVM runs after register allocation).

**Tip 5:** In LLVM IR, φ nodes look like:
```llvm
%x3 = phi i32 [ %x2, %B2 ], [ %x4, %B3 ]
```
The syntax explicitly encodes: "the value from %B2 is %x2, the value from %B3 is %x4."

---

## QnA

**Q: Why must φ functions be at the top of a basic block?**

Because φ functions represent the merge of values at the join point — before any computation in the block. They conceptually execute simultaneously when control reaches the block, before any other instruction. Placing them mid-block would change semantics — other instructions in the block would see the pre-φ values.

---

**Q: Can a φ function have more than two arguments?**

Yes — one argument per incoming control flow edge. A block with 4 predecessors has φ functions with 4 arguments. This commonly happens at switch statement merge points.

```llvm
%x = phi i32 [ %x1, %case1 ], [ %x2, %case2 ], [ %x3, %case3 ], [ %x4, %default ]
```

---

**Q: What is the complexity of Cytron's algorithm?**

φ-placement: O(|edges| × |variables|) in the worst case, but in practice nearly linear because most variables have few definitions.

Renaming: O(|nodes| + |edges|) — single DFS of the dominator tree.

Overall: roughly linear in program size for typical programs.

---

**Q: Does SSA handle pointers and memory correctly?**

No — SSA only applies to **scalar variables**. Memory (arrays, heap-allocated data, pointer-accessed memory) is NOT in SSA form in standard LLVM IR. Memory is modeled with `load`/`store` instructions, and alias analysis determines dependencies.

LLVM's `mem2reg` pass promotes memory locations to SSA variables where possible — this is what converts `alloca`-based variables (stack slots) into SSA values.

---

**Q: What is mem2reg in LLVM and how does it relate to SSA?**

When Clang compiles C code, it initially represents every local variable as an `alloca` (stack allocation) with loads and stores. This is simpler to generate but is not SSA.

`mem2reg` runs Cytron's algorithm on the allocas that don't have their address taken (non-address-taken locals) and promotes them to SSA virtual registers. After mem2reg, the IR is in proper SSA form and all subsequent optimization passes work on it.

---

**Q: What is CSSA (Conventional SSA) and why does de-SSA need it?**

CSSA (Conventional SSA): an SSA form where φ-related variables (the φ and all its arguments) can be assigned the same register without any conflicts.

Standard SSA from Cytron's algorithm is not always conventional — there can be interference among φ-related variables. Before de-SSA via coalescing, the compiler must first convert to CSSA by inserting copies to break interferences. Then coalescing eliminates as many of those copies as possible.

The pipeline: SSA → CSSA (insert copies to resolve interferences) → coalesce (eliminate redundant copies) → final code

---

**Q: In the loop example, why is B2 in its own dominance frontier?**

Because dominance frontier is defined as blocks where you dominate a predecessor but don't strictly dominate the block itself. B2 has a predecessor B3 (back edge). B2 dominates B3. But B2 doesn't strictly dominate B2 (a block doesn't strictly dominate itself by definition). Therefore B2 ∈ DF(B2).

This is the general rule: **loop headers are always in their own dominance frontier**, which is why loop header variables always get φ functions.

---

**Q: What happens to φ functions during constant propagation?**

If all arguments of a φ are the same constant:
```
x3 = φ(5, 5)   →   x3 = 5   (φ eliminated, constant propagated)
```

If one argument dominates all paths:
```
// If B3 is unreachable (dead code), φ has only one real argument
x3 = φ(x2, x4_dead)   →   x3 = x2   (φ eliminated)
```

This is called **φ simplification** and is a standard cleanup pass after constant propagation or dead code elimination.

---

**Q: What is the difference between SSA and CPS (Continuation Passing Style)?**

They are theoretically equivalent — Appel (1998) showed SSA is a form of CPS. In CPS, every function takes a "continuation" (what to do next) as an argument. φ functions correspond to parameters of "join continuations."

Practical difference: SSA is used in imperative compiler IRs (LLVM), CPS is used in functional language compilers (SML/NJ, some Scheme compilers). MLIR's region-based IR bridges these worlds.

---

**Q: If a variable is defined in only one block and used only in that block, does it get a φ function?**

No. Cytron's algorithm only places φ functions at blocks in the dominance frontier of defining blocks. If the variable is defined in B1 and all uses are dominated by B1 (i.e., no use is reachable without going through B1), then no block is in DF(B1) relative to this variable's uses. No φ needed.

This is the common case for most temporary variables — they're local to one basic block and never need φ functions.

---

# PART 8 — MEMORY SSA (DEEP DIVE)

Standard SSA (Static Single Assignment) is perfect for registers and scalars, but it fundamentally breaks when it hits **Memory**. 

### The Problem: Why Scalar SSA Fails for Memory
1.  **Aliasing**: `*p = 5` and `*q = 10` might modify the same memory location, or different ones. We don't know at compile time.
2.  **State**: Memory is a single, massive, shared state. You can't just call it `mem1`, `mem2` for every single byte.
3.  **Function Calls**: A call to `printf()` or `free()` has "side effects" on memory that aren't captured by scalar def-use chains.

**Memory SSA** solves this by creating a "virtual" SSA form for the entire memory state.

---

## 7.1 — The Three Pillars of Memory SSA

Instead of versioning variables (`x1`, `x2`), Memory SSA versions the **Memory State** itself.

### 1. MemoryDef
Any instruction that **might modify** memory (Store, `memset`, or a function call) creates a `MemoryDef`. It defines a new version of the memory state.
*   **syntax**: `1 = MemoryDef(0)` — *This instruction takes memory state 0 and produces state 1.*

### 2. MemoryUse
Any instruction that **might read** memory (Load, functional call) has a `MemoryUse`. It points to the version of memory it depends on.
*   **syntax**: `MemoryUse(1)` — *This load reads from the memory state defined by version 1.*

### 3. MemoryPhi
Just like scalar Phi, `MemoryPhi` merges memory versions at CFG join points.
*   **syntax**: `3 = MemoryPhi(1, 2)` — *Memory state 3 is either 1 or 2, depending on the incoming path.*

---

## 7.2 — Memory SSA in Action (LLVM Style)

Consider this C code:
```c
*p = 5;       // Store 1
if (cond) {
    *p = 10;  // Store 2
}
return *p;    // Load
```

**Memory SSA Representation (Simplified):**
```llvm
B1:
  1 = MemoryDef(liveOnEntry)
  store i32 5, i32* %p          ; Def 1

B2:
  2 = MemoryDef(1)
  store i32 10, i32* %p         ; Def 2

B3:
  3 = MemoryPhi(1, 2)           ; Merge memory states
  MemoryUse(3)
  %val = load i32, i32* %p      ; Use memory state 3
```

---

## 7.3 — Why Memory SSA is "The High-Performance Choice"

Before Memory SSA, a compiler pass (like Dead Store Elimination) had to manually scan backwards through instructions and ask the Alias Analyzer at every single step: *"Does this instruction touch the same memory as my store?"* This was **O(N^2)** and slow.

**With Memory SSA:**
-   **Instant Link**: A `Load` is directly linked to the `MemoryDef` that reaches it.
-   **Clobbering Analysis**: To see if a store is "dead" (overwritten), you just check the `MemoryDef` chain. If the next `MemoryDef` completely overwrites the same location, the first one is dead. No scanning required.
-   **Optimizer Speed**: Passes like GVN (Global Value Numbering) and LICM (Loop Invariant Code Motion) become significantly faster because they can skip hundreds of non-memory instructions in a single jump.

---

## FAQ: Is Memory SSA "Minimal"?
Not exactly. Memory SSA is usually **"Semi-Pruned"**. It doesn't track every individual memory location (that would be impossible); it tracks the "impact" on the memory state as a whole. Modern LLVM uses Memory SSA as the primary way to handle almost all memory-related optimizations.

---

# PART 9 — WHERE SSA WINS vs WHERE MEMORYSSA WINS

The most important interview insight: **SSA and MemorySSA solve fundamentally different problems**. Scalar SSA tracks *values in registers*. MemorySSA tracks *what version of memory is visible at a given point*. You need both because neither alone is sufficient.

---

## Where Scalar SSA Wins (Optimizations Over Register Values)

### 1. Constant Propagation / SCCP
**How SSA enables it:** In SSA, every variable has exactly one definition. If `%x = i32 5`, then every use of `%x` in the entire function is trivially replaceable with `5` — just follow the def-use chains. Without SSA, you'd need expensive dataflow equations to prove `%x` still has value `5` at each use site.

```llvm
; SSA: one definition → immediate propagation
%x = add i32 2, 3        ; %x is exactly 5, always
%y = mul i32 %x, 4       ; → trivially becomes mul i32 5, 4 → 20
; Zero scanning required
```

### 2. Dead Code Elimination (DCE)
**How SSA enables it:** Dead code has zero uses. In SSA, every def has an explicit use-list. If `%r.use_count == 0` and the instruction has no side effects, it's dead. O(1) check per instruction.

Without SSA: You must do backward flow analysis to prove a value is never live — that requires scanning successor blocks, which is O(N).

```llvm
%dead = add i32 %a, %b    ; use_count == 0 in SSA → instantly deleted
```

### 3. Aggressive DCE (killing dead cycles)
**How SSA enables it:** ADCE marks only "roots" (returns, stores, volatile ops) as live, then traverses their def-use chains backward. Any `%r` not reachable from a root through the def-use chain is dead. The explicit SSA graph makes this trivially O(N).

### 4. Global Value Numbering (GVN)
**How SSA enables it:** Since each `%x` is defined once, `hash(opcode + val_num(%a) + val_num(%b))` uniquely identifies the value produced. Two identical expressions anywhere in the function get the same value number, enabling O(1) redundancy detection.

```llvm
%t1 = add i32 %a, %b   ; value number #5
...
%t2 = add i32 %a, %b   ; → same hash → immediately replaced with %t1
; No scanning required; SSA def-use links prove %a and %b haven't changed
```

### 5. Register Allocation
**How SSA enables it:** Live intervals are computed directly from SSA def/use points — no iterative dataflow needed. `LiveInterval(v) = [def_point(v), last_use_point(v)]`. This O(N) computation only works because SSA guarantees a single def.

### 6. Induction Variable Analysis (SCEV)
**How SSA enables it:** SCEV recognizes the canonical loop φ-pattern `{init, +, stride}` directly from SSA form. The loop header φ-function `%i = phi [%i.init, entry], [%i.next, latch]` is the exact structural form that SCEV needs to model `%i` as a polynomial recurrence.

---

## Where MemorySSA Wins (Optimizations Over Memory State)

### 1. LICM (Loop Invariant Code Motion) — Hoisting Loads
**How MemorySSA enables it:** To hoist `%v = load ptr %p` out of a loop, LICM must prove no store inside the loop aliases `%p`. Without MemorySSA, LICM scans *every instruction* in the loop body and asks AliasAnalysis: "Does this alias %p?" — O(N) per hoist candidate.

With MemorySSA, the `MemoryUse` node for the load directly links to the reaching `MemoryDef`. LICM just walks the MemoryDef chain: if the reaching def is from *before* the loop (i.e., `liveOnEntry` or a MemoryDef outside the loop), the load is safe to hoist — **no instruction scanning required**.

```llvm
; Loop with a loop-invariant load:
loop:
  MemoryUse(→ Def_outside_loop)      ; ← MemorySSA instantly shows this load
  %v = load i32, ptr %p              ;   has no clobbering def inside the loop
  %s = add i32 %s, %v
; LICM hoists %v before the loop with one MemorySSA pointer traversal
```

### 2. Dead Store Elimination (DSE)
**How MemorySSA enables it:** A store is dead if no load ever reads the value it wrote. With MemorySSA, each store is a `MemoryDef` in a versioned chain. DSE walks forward in the `MemoryDef` chain: if the next `MemoryDef` for the same address is another store (completely overwriting), the first store is dead. **One pointer hop** instead of O(N) instruction scanning.

```
1 = MemoryDef(liveOnEntry)    ; store i32 5, ptr %p   ← DEAD
2 = MemoryDef(1)              ; store i32 7, ptr %p   ← overwrites entirely
MemoryUse(2)                  ; load  ptr %p           → sees value 7
```
DSE sees: MemoryDef(1) is the immediate dominator of MemoryDef(2), they alias, def(2) completely covers def(1) → def(1) deleted.

### 3. GVN — Load Forwarding / Redundant Load Elimination
**How MemorySSA enables it:** GVN can eliminate a redundant load if the same memory version is available. Without MemorySSA, GVN must reason about all instructions between two loads to decide if memory changed — O(N). With MemorySSA, GVN compares `MemoryUse` tokens: if both loads have the same reaching `MemoryDef`, the memory is identical and the second load is redundant.

```llvm
1 = MemoryDef(liveOnEntry)
store i32 10, ptr %p

MemoryUse(1)
%a = load i32, ptr %p   ; ← first load, reads MemoryDef(1)

; some pure arithmetic — no MemoryDef in between

MemoryUse(1)
%b = load i32, ptr %p   ; ← same MemoryDef(1) → identical value → replace %b with %a
```

### 4. Alias-Aware CSE
**How MemorySSA enables it:** Two loads can be CSE'd only if no intervening store aliases either address. MemorySSA's linear MemoryDef chain makes this check O(1) per candidate pair — just check if the two MemoryUse nodes reference the same MemoryDef version.

---

## The Critical Distinction (Interview Gold)

| Property | Scalar SSA | MemorySSA |
|---|---|---|
| **Tracks** | Register values (`%x = ...`) | Memory state versions (`1 = MemoryDef(...)`) |
| **φ-nodes at** | CFG join points for variables | CFG join points for memory state (`MemoryPhi`) |
| **One definition?** | Yes — every variable defined once | No — memory is a *single shared mutable resource* |
| **Key benefit** | Explicit def-use chains for values | Versioned memory state for load/store reasoning |
| **Used by** | DCE, GVN, CP, SCEV, RegAlloc | LICM, DSE, GVN-load, alias-aware CSE |
| **Complexity without** | O(N) dataflow per query | O(N²) scan per memory query |
| **Complexity with** | O(1) def-use traversal | O(1) MemoryDef chain traversal |

**The key insight to say in an interview:**

> "Scalar SSA makes value-def relationships explicit — every use knows its exact definition, enabling O(1) reasoning about values. MemorySSA layers a parallel SSA form on top of memory as a whole, making clobbering relationships between loads and stores explicit. Without MemorySSA, every memory optimization degenerates to O(N²) because you'd scan every instruction looking for potential aliases. Together, they form the complete picture: SSA handles scalars, MemorySSA handles the heap."