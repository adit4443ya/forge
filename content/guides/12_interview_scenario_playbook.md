<!--
category: Interview Prep & Tooling
tags: Scenarios, Playbook, Debugging, Optimization, Profiling, LLVM Pass
difficulty: Advanced
readTime: 25 min
-->

# The Systems Interview Scenario Playbook

> [!IMPORTANT]
> **TL;DR — what you must remember:** Systems interviews reward a **structured spoken process**: restate the problem, state assumptions, reason from invariants, narrate trade-offs out loud. Treat *"why is this slow?"*, *"is this code correct?"*, and *"design X"* as scripts you can walk through. The real skill being graded is clear technical communication under uncertainty — not trivia recall.

In senior systems interviews, you won't just be asked "what is vectorization?" You'll be given a snippet and asked: **"How do you make this 10x faster?"**

---

## Scenario 1: The Matrix Multiply (The Classic)
**Situation**: "You have a $1024 \times 1024$ matrix multiplication that is running slowly. Cache misses are high."

*   **Your Answer**: "I would apply **Loop Tiling (Blocking)**."
*   **Why**: "A $1024 \times 1024$ matrix doesn't fit in L1 cache. By processing the matrix in $32 \times 32$ or $64 \times 64$ tiles, I ensure that the sub-matrices stay in L1 cache for the duration of the computation, radically reducing DRAM traffic."
*   **Bonus Points**: Mention **FMA (Fused Multiply-Add)** and **Loop Interchange** for the inner-most loop to ensure unit-stride access.

---

## Scenario 2: The Branching Sum (The Predictability Trap)
**Situation**: "You're summing an array: `if (arr[i] > threshold) sum += arr[i]`. The data is random. How do you optimize?"

*   **Your Answer**: "I would use **If-Conversion** to make it branchless, or use **Masked SIMD**."
*   **Why**: "With random data, the branch predictor will fail 50% of the time, causing expensive pipeline flushes. By replacing the branch with a `cmov` (conditional move) or a SIMD mask, the CPU executes a deterministic chain of instructions with zero mispredictions."
*   **Interview Tip**: If they say the data is **sorted**, pivot! Say: "If it's sorted, I'll keep the branch. The CPU will predict it correctly 99% of the time, which is faster than calculating both paths."

---

## Scenario 3: The Particle System (AoS vs SoA)
**Situation**: "You have an array of particles: `struct P { float x,y,z,w; } particles[N];`. You need to update all X coordinates. What's the problem?"

*   **Your Answer**: "The data layout is **Array of Structures (AoS)**, which is terrible for SIMD."
*   **Why**: "To load X coordinates, the CPU must perform a **Strided Load** (skip Y, Z, W). This prevents efficient contiguous SIMD loads. I would refactor to **Structure of Arrays (SoA)**: `float x[N], y[N], z[N], w[N];`."
*   **The Kill Shot**: "SoA enables unit-stride 256-bit loads, allowing us to process 8 particles in a single instruction instead of 1."

---

## Scenario 4: The Pointer Chaser (Linked Lists)
**Situation**: "Can you vectorize a loop that traverses a `std::list` or a linked list?"

*   **Your Answer**: "**No**, not effectively."
*   **Why**: "Vectorization requires **spatial locality** and a predictable **trip count**. Linked list nodes are scattered in memory (pointer chasing), so we can't load them into a SIMD register contiguously. The 'trip count' is also unknown until we hit `nullptr`."
*   **Solution**: "If performance is critical, I'd migrate the data to a `std::vector` (Contiguous Memory) to enable the Loop Vectorizer."

---

## Scenario 5: The "Instruction Soup" (Big Loop Body)
**Situation**: "You have a loop with 200 lines of code inside. You want to vectorize it."

*   **Your Answer**: "I would first apply **Loop Fission (Loop Splitting)**."
*   **Why**: "A 200-line loop body is too complex for the vectorizer's dependency analysis. By splitting it into 3-4 smaller loops, I can isolate the 'math-heavy' parts that *can* be vectorized, while leaving the complex control flow in a scalar loop."

---

## Scenario 6: The Invisible Bottleneck (I/O vs Compute)
**Situation**: "You've vectorized your math, but the program isn't any faster. Why?"

*   **Your Answer**: "The program is likely **Memory Bound** or **I/O Bound**, not Compute Bound."
*   **Why**: "If the CPU is waiting 300 cycles for data from DRAM, making the addition take 1 cycle instead of 4 won't change the total time. I would look at **Prefetching** or **Memory Alignment** to saturate the memory bus instead of the ALU."

---

# 🚀 FINAL INTERVIEW KILLER TIPS

1.  **"It Depends"**: Always start with "It depends on the hardware and the data distribution." Interviewers love engineers who don't assume.
2.  **The Reciprocal Scale**: More Unrolling = More Speed BUT More Register Pressure. More Inlining = Fewer Calls BUT More iCache Pressure. Mention this trade-off constantly.
3.  **The "Safety" Check**: Always mention **Aliasing**. "I'd use `__restrict__` here because the compiler might be afraid that `A` and `B` overlap, which would block vectorization."
4.  **Profile First**: "I wouldn't optimize any of this until I've run `perf` or `google-benchmark` to identify the actual bottleneck."
5.  **Alignment is King**: Mention that SIMD works best on 32-byte or 64-byte aligned boundaries. `alignas(64)` is your friend.
---

## Scenario 7: Debugging a Silent Miscompile
**Situation**: "Your compiler is generating a binary that runs without crashing, but the math output is wrong. How do you find the bug?"

*   **Your Answer**: "I would use **Differential Testing** combined with a **Delta Debugger (like C-Reduce)**."
*   **Why**: "First, I confirm the bug by compiling the exact same source with GCC or Clang `-O0`. If `-O0` is correct and `-O3` is wrong, it's an optimization bug. I then use `opt-bisect` in LLVM to turn off passes one by one until the bug disappears. This isolates the exact pass causing the miscompile. Finally, I run C-Reduce to shrink the 10,000-line source file into a 10-line minimal reproducible example to fix the pass logic."

---

## Scenario 8: Profiling a Hot Loop
**Situation**: "A critical financial loop is taking 2 microseconds instead of the expected 500 nanoseconds. How do you profile it?"

*   **Your Answer**: "I would use **Hardware Performance Counters (PMUs)** via `perf` or Intel VTune."
*   **Why**: "Software instrumentation adds overhead that perturbs the microsecond-level timings. I would run `perf record -e cycles,instructions,cache-misses,branch-misses` on the binary. I'd then use `perf annotate` to map the hardware stalls directly back to the assembly instructions. If I see a high IPC (Instructions Per Cycle) but low performance, I check for branch mispredictions. If I see low IPC, I check for L1 cache misses or data dependency stalls."

---

## Scenario 9: Designing a Custom LLVM Pass
**Situation**: "We need a compiler feature that automatically detects and prevents integer overflow in a specific math library. How do you design this pass?"

*   **Your Answer**: "I would write an **LLVM IR Function Pass** that replaces standard arithmetic with intrinsic overflow checks."
*   **Why**: "At the IR level, I would iterate over all instructions. For every `add`, `sub`, or `mul` instruction in the target library, I would replace it with the LLVM intrinsic `@llvm.sadd.with.overflow`. I would then insert a conditional branch based on the overflow bit: if it overflows, branch to an error-handling block; otherwise, continue. I would use the New Pass Manager (`PassInfoMixin`) and ensure I update the `DominatorTree` since I am modifying the Control Flow Graph."
