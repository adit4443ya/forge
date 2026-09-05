<!--
category: LLVM & Compiler Infrastructure
tags: Vectorization, SIMD, Inlining, Unrolling, LICM, GVN, PGO, LTO
difficulty: Advanced
readTime: 50 min
-->

# Deep Dive: Compiler Optimizations — Vectorization, SIMD, Inlining, Unrolling & More

> [!IMPORTANT]
> **TL;DR — what you must remember:** Every optimization is a two-part bet — it must be **legal** (preserves semantics) *and* **profitable** (the cost model says it pays). Vectorization (loop + SLP) needs independent iterations, no aliasing, and a positive verdict; **inlining is the great enabler** that exposes everything downstream; LICM, GVN, unrolling, and PGO each trade size for speed. When in doubt, reason about legality first, profitability (TTI/SchedModel) second.

---

# PART 1 — VECTORIZATION & SIMD

## What Is Vectorization Fundamentally

Normal scalar execution:
```
for i in range(8):
    C[i] = A[i] + B[i]   # 8 separate add instructions
```

Vectorized execution:
```
C[0:8] = A[0:8] + B[0:8]  # 1 SIMD instruction operating on 8 elements simultaneously
```

The hardware has special wide registers — instead of one 32-bit float, they hold 4, 8, or 16 floats simultaneously. One instruction operates on all of them at once.

This is the fundamental idea. Everything else is details about when it's legal, when it's profitable, and what blocks it.

---

## SIMD ISA Landscape — Know These Cold

| ISA | Width | Floats (fp32) | Where |
|---|---|---|---|
| SSE2 | 128-bit | 4 | x86, ancient baseline |
| AVX | 256-bit | 8 | x86, post-2011 |
| AVX2 | 256-bit | 8 | x86, adds integer SIMD |
| AVX-512 | 512-bit | 16 | x86 server, Xeon |
| NEON | 128-bit | 4 | ARM (mobile, Apple Silicon) |
| SVE/SVE2 | variable | variable | ARM (scalable, length set at runtime) |
| Hexagon HVX | 1024-bit | 32 | Qualcomm DSP |
| PTX/SASS | warp-wide | 32 (warp) | NVIDIA GPU |

**Key interview point:** SVE (Scalable Vector Extension) is architecturally different — the vector length is not fixed at compile time. The compiler generates code that works for any vector length. This is the direction ARM is pushing for HPC. Qualcomm's Hexagon HVX at 1024-bit is extremely wide — this is why their compiler team cares deeply about vectorization.

> → **Deep dive:** how vectorization actually lowers on ARM — fixed-width NEON vs vector-length-agnostic SVE, predication, and `<vscale x N x T>` types — in [NEON & SVE Vectorization](#guide/14/part-2-sve-scalable-vectors-the-headline-act).

---

## Types of Vectorization

### 1. Loop Vectorization (Auto-Vectorization)

The compiler detects that a loop's iterations are independent and rewrites it using SIMD instructions.

```cpp
// Source
for (int i = 0; i < N; i++)
    C[i] = A[i] * B[i] + D[i];

// Compiler generates (conceptually, AVX2)
for (int i = 0; i < N; i += 8) {
    __m256 a = _mm256_load_ps(&A[i]);
    __m256 b = _mm256_load_ps(&B[i]);
    __m256 d = _mm256_load_ps(&D[i]);
    __m256 result = _mm256_fmadd_ps(a, b, d);  // fused multiply-add
    _mm256_store_ps(&C[i], result);
}
// + scalar epilogue for remainder elements
```

**What LLVM's Loop Vectorizer actually does:**
1. Analyze loop: is trip count known? Are iterations independent?
2. Dependence analysis: do any array accesses alias?
3. Legality check: are all operations vectorizable?
4. Profitability check: is vectorization worth it? (considers vector width, trip count, memory access pattern)
5. Choose vectorization factor (VF): how many elements per SIMD instruction
6. Choose unroll factor (UF): how many SIMD iterations to unroll
7. Generate vector loop + scalar prologue/epilogue for non-aligned/remainder elements

> The **profitability check** (step 4) isn't a heuristic guess — it's driven by `TargetTransformInfo` (TTI) cost queries plus the target's `SchedModel`. → **Deep dive:** why the AArch64 cost model is treated as a *product surface* (and where TTI/SchedModel live in the backend) in [The AArch64 Backend + Onboarding](#guide/15/4-the-cost-model-is-a-product-surface).

---

### 2. SLP Vectorization (Superword Level Parallelism)

Loop vectorizer works on loops. SLP works on **straight-line code** — it finds independent scalar operations and packs them into vectors.

```cpp
// Source — no loop, just independent scalar ops
float x1 = a1 + b1;
float x2 = a2 + b2;
float x3 = a3 + b3;
float x4 = a4 + b4;

// SLP vectorizer packs these into one SIMD add
__m128 x = _mm_add_ps(_mm_set_ps(a4,a3,a2,a1), _mm_set_ps(b4,b3,b2,b1));
```

**When SLP fires:**
- Struct of arrays operations
- Manual unrolled code
- Compilers of languages that generate repetitive scalar code

**SLP vs Loop Vectorizer:**
- Loop vectorizer: same operation, different data, across iterations
- SLP: different operations that happen to be isomorphic, same basic block
- They are complementary — LLVM runs both

---

### 3. Auto-Vectorization with Intrinsics (Manual Assist)

When the compiler fails to auto-vectorize, you use intrinsics directly:

```cpp
#include <immintrin.h>

void add_avx(float* C, float* A, float* B, int N) {
    for (int i = 0; i < N; i += 8) {
        __m256 a = _mm256_loadu_ps(A + i);  // unaligned load
        __m256 b = _mm256_loadu_ps(B + i);
        __m256 c = _mm256_add_ps(a, b);
        _mm256_storeu_ps(C + i, c);
    }
}
```

**Common AVX2 intrinsics pattern:**
- `_mm256_load_ps` — aligned load (address must be 32-byte aligned)
- `_mm256_loadu_ps` — unaligned load (slower on some hardware)
- `_mm256_fmadd_ps(a, b, c)` — a*b+c in one instruction (FMA, critical for matmul performance)
- `_mm256_hadd_ps` — horizontal add (adjacent pairs) — useful for reductions
- `_mm256_permute_ps` — shuffle elements within vector

---

### 4. Predicated / Masked Vectorization

When loop has a conditional inside:

```cpp
for (int i = 0; i < N; i++)
    if (A[i] > 0)
        C[i] = A[i] * 2;
```

Can't simply vectorize — not all elements should be updated. Solution: compute for all elements, use a mask to select which results to write.

```cpp
// Conceptually with AVX-512 masking
__m512 a = _mm512_load_ps(A + i);
__mmask16 mask = _mm512_cmp_ps_mask(a, zero, _CMP_GT_OS);  // mask where A[i] > 0
__m512 result = _mm512_mul_ps(a, two);
_mm512_mask_store_ps(C + i, mask, result);  // only store where mask is set
```

**AVX-512 has native masking support** — this is a major reason AVX-512 matters for conditionals. AVX2 requires emulating masks with blend operations.

---

## What BLOCKS Vectorization — Critical for Interviews

### 1. Data Dependencies (Loop-Carried)

```cpp
// NOT vectorizable — each iteration depends on previous
for (int i = 1; i < N; i++)
    A[i] = A[i-1] + B[i];  // A[i] depends on A[i-1]
```

The compiler detects this via **dependence analysis**. The dependency distance is 1 — can't overlap iterations.

Exception: some reductions are still vectorizable with reassociation:
```cpp
float sum = 0;
for (int i = 0; i < N; i++)
    sum += A[i];  // reduction — vectorizable with -ffast-math (changes float order)
```

### 2. Pointer Aliasing

```cpp
void add(float* C, float* A, float* B, int N) {
    for (int i = 0; i < N; i++)
        C[i] = A[i] + B[i];
    // Compiler doesn't know: does C overlap with A or B?
    // If C == A+1, then writing C[0] affects A[1] — wrong if vectorized
}
```

Fix with `__restrict__`:
```cpp
void add(float* __restrict__ C, float* __restrict__ A, float* __restrict__ B, int N)
// Now compiler knows: no aliasing. Safe to vectorize.
```

Or with OpenMP:
```cpp
#pragma omp simd
for (int i = 0; i < N; i++)
    C[i] = A[i] + B[i];
```

### 3. Non-Unit Stride (Strided Access)

```cpp
// Unit stride — vectorizable, contiguous memory
for (int i = 0; i < N; i++)
    C[i] = A[i] + 1;

// Stride-2 — harder, requires gather/scatter
for (int i = 0; i < N; i += 2)
    C[i] = A[i] + 1;

// Struct access — worst case
struct Point { float x, y, z; };
for (int i = 0; i < N; i++)
    result[i] = points[i].x + points[i].y;  // stride-3 gather
```

**AoS vs SoA — the classic layout problem:**
```cpp
// Array of Structures (AoS) — bad for SIMD
struct Particle { float x, y, z, mass; };
Particle particles[N];  // memory: x0 y0 z0 m0 x1 y1 z1 m1 ...

// Structure of Arrays (SoA) — good for SIMD
float x[N], y[N], z[N], mass[N];  // memory: x0 x1 x2 ... y0 y1 y2 ...
```

With SoA, loading all x coordinates is a contiguous load. With AoS, it's a stride-4 gather — 4x slower on most hardware.

### 4. Function Calls Inside Loop

```cpp
for (int i = 0; i < N; i++)
    C[i] = some_function(A[i]);  // blocks vectorization unless inlined
```

If `some_function` is inlined, the loop body becomes visible and may be vectorizable. This is why **inlining and vectorization are deeply coupled** — inlining enables vectorization.

### 5. Non-Vectorizable Operations

- System calls, I/O
- Exceptions
- Virtual function calls (unknown target at compile time)
- Arbitrary function pointers

---

## Vectorization Pros & Cons by Environment

### CPU (x86/ARM)

**Pros:**
- 4-16x throughput improvement for floating point heavy loops
- FMA (fused multiply-add) is essentially free if the pattern matches
- Works automatically with -O2/-O3 + simple loop structure

**Cons:**
- AVX-512 has frequency downclocking on some Intel CPUs (AVX-512 heavy code runs at lower clock speed) — can hurt latency-sensitive workloads
- Misaligned memory access penalizes vectorization
- Requires rewriting data layouts (AoS→SoA) for complex structs
- Portability: AVX-512 code won't run on older x86 or ARM

### GPU (NVIDIA)

**The GPU already IS a SIMD machine at warp level** — 32 threads executing the same instruction is SIMT (Single Instruction Multiple Threads), which is SIMD in disguise. So "vectorization" on GPU means something different:

- The vectorizer's job is ensuring threads in a warp do the same thing (avoid divergence)
- Memory coalescing IS the GPU equivalent of SIMD unit-stride access
- Tensor cores are the extreme version — one instruction computes a 16x16x16 matrix multiply

### DSP (Qualcomm Hexagon HVX)

- 1024-bit vectors — extreme width
- The compiler must aggressively vectorize to utilize this
- Hexagon is designed for fixed-point and 8/16-bit integer ops (image/audio processing)
- Floating point is secondary — the compiler optimization story is about integer SIMD
- This is directly what Qualcomm's compiler team works on

---

# PART 2 — INLINING

## What Inlining Is

Function call overhead: push arguments to stack/registers, jump to function, execute, return, clean up. For small functions called in tight loops, this overhead dominates.

Inlining: copy the function body into the call site. Eliminate call overhead entirely.

```cpp
// Source
inline float square(float x) { return x * x; }

for (int i = 0; i < N; i++)
    C[i] = square(A[i]);

// After inlining
for (int i = 0; i < N; i++)
    C[i] = A[i] * A[i];  // now this loop is vectorizable
```

**Critical insight:** inlining is not just about removing call overhead. It's an **enabler** for all other optimizations — constant propagation, dead code elimination, vectorization, loop optimizations. This is why it's one of the most impactful passes.

---

## When LLVM Decides to Inline

LLVM uses a **cost model** — assigns a cost to inlining based on:

- Callee size (instruction count)
- Call site context (is it in a hot loop?)
- Number of call sites (inlining everywhere bloats code)
- Threshold: default ~225 "cost units" in LLVM

You can override:
```cpp
__attribute__((always_inline)) float square(float x) { return x * x; }
__attribute__((noinline)) void debug_print(int x);  // force NOT inline
```

In LLVM IR:
```
call float @square(float %x)  →  inlined if profitable
```

---

## Inlining Chain Effects — Why It Matters

```cpp
float relu(float x) { return x > 0 ? x : 0; }
float process(float* A, int i) { return relu(A[i]); }

for (int i = 0; i < N; i++)
    C[i] = process(A, i);
```

Without inlining: compiler sees a loop calling `process`, which calls `relu`. Cannot vectorize either.

With inlining (two levels): loop body becomes `C[i] = A[i] > 0 ? A[i] : 0`. Now:
- Vectorizable with masking
- Potentially foldable into a single `max(A[i], 0)` instruction

This chain — inline → expose → optimize — is the fundamental reason modern compilers inline aggressively.

---

## Inlining Pros & Cons

**Pros:**
- Eliminates call overhead (return address, stack frame setup)
- Enables interprocedural optimization (caller context propagates into callee)
- Enables constant propagation across call boundary
- Enables vectorization of loops containing function calls
- Enables dead code elimination (if caller knows some argument is always 0)

**Cons:**
- **Code bloat (icache pressure)** — if a function called in 100 places is inlined, the code size multiplies. More code = more instruction cache misses = can hurt performance
- Compile time increases
- Can hide profiling information (inlined functions disappear from profiles)
- Can cause register pressure (callee's variables now live simultaneously with caller's)

**The inlining sweet spot:**
- Small functions (< ~10 instructions): almost always beneficial
- Medium functions in hot loops: usually beneficial
- Large functions called once: beneficial (no code size increase)
- Large functions called many times: usually harmful (code bloat)

---

## Inlining in Different Environments

**CPU hot loops:**
Inline aggressively. The icache pressure is worth it for the optimization opportunities unlocked.

**GPU device code:**
CUDA inlines device functions by default. `__device__` functions are inlined unless you use `__noinline__`. On GPU, call overhead is actually more expensive than CPU (divergent function calls are especially bad). Inline everything small.

**Mobile/embedded (Qualcomm Snapdragon CPU):**
Code size matters more — instruction cache is smaller, ROM/flash may be limited. More conservative inlining. This is a real tension in compiler tuning for mobile targets.

**Recursive functions:**
Cannot inline unconditionally — infinite expansion. Compilers use heuristics (fixed recursion depth unrolling for tail calls).

---

## PGO — Profile Guided Inlining

The compiler can't know which call sites are hot at compile time without profiling. PGO (Profile Guided Optimization):

1. Compile with instrumentation: `-fprofile-generate`
2. Run representative workload — collects call frequency data
3. Recompile with profile: `-fprofile-use`
4. Now compiler knows: this call site is hit 10M times/sec, inline it. That one is hit once at startup, skip it.

This is how production compilers (Chrome, Firefox, games) are built. LLVM's PGO is mature and widely used.

---

# PART 3 — LOOP UNROLLING

## What Unrolling Is

```cpp
// Original
for (int i = 0; i < N; i++)
    C[i] = A[i] + B[i];

// Unrolled 4x
for (int i = 0; i < N; i += 4) {
    C[i+0] = A[i+0] + B[i+0];
    C[i+1] = A[i+1] + B[i+1];
    C[i+2] = A[i+2] + B[i+2];
    C[i+3] = A[i+3] + B[i+3];
}
// + epilogue for N % 4 != 0
```

**Why it helps:**
- Reduces loop overhead: branch check and increment happen once per 4 iterations instead of once per iteration
- Exposes more ILP (Instruction Level Parallelism) — out-of-order CPUs can execute the 4 independent adds in parallel
- Enables the compiler to schedule memory loads ahead of computes (software pipelining)
- Often a prerequisite for effective vectorization

---

## Unrolling and Software Pipelining Together

The real power of unrolling is enabling **software pipelining** — overlapping memory loads of future iterations with compute of current iterations:

```
Iteration i:   LOAD A[i]    LOAD B[i]    ADD    STORE C[i]
Iteration i+1:              LOAD A[i+1]  LOAD B[i+1]  ADD  STORE C[i+1]
```

Without unrolling, the loop stalls waiting for memory. With unrolling, the loads for iteration i+1 are issued while iteration i is computing. Memory latency is hidden.

This is especially critical on:
- GPU: memory latency is 400-800 cycles. Hiding it with enough in-flight loads is essential.
- Modern CPUs: memory latency ~100-200 cycles to DRAM. Out-of-order execution + unrolling hides most of it.

---

## Unrolling Pros & Cons

**Pros:**
- Reduces branch prediction pressure
- Exposes ILP to out-of-order execution units
- Enables software pipelining / memory prefetching
- Reduces loop overhead for short-trip-count loops

**Cons:**
- Code bloat — same as inlining, kills icache for large loops
- Increases register pressure — more live variables simultaneously
- Diminishing returns — 2x unroll helps a lot, 32x unroll often hurts
- Epilogue complexity — handling N % unroll_factor remainder

**Optimal unroll factor depends on:**
- Hardware: how many execution units? How deep is the pipeline?
- Loop body complexity: simple loops benefit more
- Trip count: small trip counts may not justify unrolling
- Register count: more registers = more aggressive unrolling sustainable

---

# PART 4 — OTHER KEY OPTIMIZATIONS

## Constant Propagation & Folding

```cpp
const int N = 8;
int x = N * 4;   // folded to x = 32 at compile time
int y = x + 0;   // simplified to y = x

void compute(int n) {
    if (n == 8) {          // if caller passes 8...
        for (int i = 0; i < n; i++)  // n is known: trip count = 8
            ...             // can fully unroll
    }
}
```

**SCCP (Sparse Conditional Constant Propagation)**
SCCP is the advanced, production-grade version of this. It doesn't just fold `2 + 3` into `5`. It propagates constants while actively predicting branch paths. If SCCP proves `n == 8`, it evaluates the `if (n == 8)` as `True` and entirely skips analyzing the `False` branch. It is "Sparse" because it leverages SSA def-use chains to jump directly from a constant definition to all its uses across the CFG, skipping over unrelated instructions entirely, making it blindingly fast.

---

## Dead Code Elimination (DCE)

```cpp
int compute(int x) {
    int unused = x * 5;  // never read → eliminated
    if (false) { ... }   // dead branch → eliminated
    return x + 1;
}
```

After constant propagation, many branches become statically decidable → DCE removes them. Works in SSA form — if a value has no uses (its `use_count == 0`), the instruction is dead.

**Aggressive DCE (ADCE): Solving Dead Cycles**
Standard DCE fails on dead cyclic dependencies: `a = b + 1; b = a + 1;` (with no outside uses). Both have `use_count > 0`. ADCE works backwards. It assumes *everything* is dead initially, marks only "roots" (returns, side-effects, volatile loads) as live, and recursively marks their operands as live. Anything left unmarked is purged, gracefully destroying dead cycles.

---

## Common Subexpression Elimination (CSE)

```cpp
// Source
float a = x * y + z;
float b = x * y + w;  // x*y computed twice

// After CSE
float tmp = x * y;
float a = tmp + z;
float b = tmp + w;    // x*y computed once
```

In SSA form this is trivial locally. However, CSE only checks within a single Basic Block.

**Global Value Numbering (GVN): The Global CSE**
GVN solves redundancies across the *entire program*. It assigns a unique "Value Number" (a hash) to every computation. `a = x + y` gets hash #5. When it encounters `b = x + y` anywhere in the scope, it computes the same hash #5, realizes the value already exists, and replaces `b` with `a`. Using MemorySSA, GVN even assigns value numbers to memory loads, safely eliminating redundant memory fetches if the memory hasn't been aliased or overwritten since the last load.

---

## Loop Interchange

```cpp
// Cache-unfriendly (column-major traversal of row-major array)
for (int j = 0; j < N; j++)
    for (int i = 0; i < N; i++)
        C[i][j] = A[i][j] + 1;  // stride-N access pattern

// After interchange — cache friendly
for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++)
        C[i][j] = A[i][j] + 1;  // unit stride
```

**Legality:** interchange is legal only if it doesn't change dependence direction. The polyhedral model (MLIR affine dialect) handles this rigorously.

---

## Loop Fusion & Fission

**Fusion** — merge two loops into one:
```cpp
// Before
for (int i = 0; i < N; i++) A[i] = B[i] + 1;
for (int i = 0; i < N; i++) C[i] = A[i] * 2;

// After fusion
for (int i = 0; i < N; i++) {
    A[i] = B[i] + 1;
    C[i] = A[i] * 2;  // A[i] reused from register, no memory round-trip
}
```

**Pros:** better cache reuse, fewer loop overhead iterations
**Cons:** increased register pressure, may block vectorization if combined loop is harder to analyze

**Fission** — split one loop into two (opposite of fusion):
Used when a loop body is too complex for the vectorizer — split it into vectorizable sub-loops.

---

## Loop Tiling (Blocking)

The most important optimization for cache performance in HPC:

```cpp
// Naive matmul — terrible cache behavior for large N
for (i) for (j) for (k)
    C[i][j] += A[i][k] * B[k][j];

// Tiled matmul — fits tiles in L1/L2 cache
for (i=0; i<N; i+=TILE)
  for (j=0; j<N; j+=TILE)
    for (k=0; k<N; k+=TILE)
      for (ii=i; ii<i+TILE; ii++)
        for (jj=j; jj<j+TILE; jj++)
          for (kk=k; kk<k+TILE; kk++)
            C[ii][jj] += A[ii][kk] * B[kk][jj];
```

**The insight:** choose TILE so that the A, B, C tiles all fit in L1 cache simultaneously. Then the inner 3 loops run entirely in cache — no memory traffic. This is why BLAS libraries are so fast. This is also what Triton's tile abstraction is based on.

---

## Strength Reduction

Replace expensive operations with cheaper equivalent ones:

```cpp
// Before
for (int i = 0; i < N; i++)
    A[i] = i * 5;   // multiply per iteration

// After strength reduction
int tmp = 0;
for (int i = 0; i < N; i++) {
    A[i] = tmp;
    tmp += 5;        // add per iteration (cheaper than multiply)
}
```

Also: replacing division by power-of-2 with right shift, modulo with AND (for power-of-2 divisors).

---

## Tail Call Optimization

```cpp
// Recursive — normally would overflow stack for large N
int factorial(int n, int acc) {
    if (n == 0) return acc;
    return factorial(n-1, n*acc);  // tail call — last thing function does
}

// Compiler rewrites as iteration — no stack growth
int factorial(int n, int acc) {
loop:
    if (n == 0) return acc;
    acc = n * acc;
    n = n - 1;
    goto loop;
}
```

Compilers (especially functional language compilers) rely on this heavily. LLVM has a tail call elimination pass.

---

# PART 5 — QnA Covering Edge Cases

**Q: When does -O3 make code slower than -O2?**
- Aggressive inlining bloats icache → more cache misses than saved call overhead
- AVX-512 on Intel causes frequency downclocking → lower clock speed kills latency gains
- Aggressive unrolling increases register pressure → spilling to stack, which is worse than the loop overhead it eliminated
- Vectorization of short loops where SIMD setup cost > scalar execution cost

**Q: Can the compiler vectorize a loop with a function call?**
- Only if it can inline the function first. `static inline` or LTO (Link Time Optimization) makes cross-TU inlining possible.
- If the function is in a shared library with no source visibility: no. This is why performance-critical code avoids virtual functions and function pointers in hot loops.

**Q: What is the difference between -ffast-math and standard float behavior?**
- IEEE 754 floating point is not associative: `(a+b)+c ≠ a+(b+c)` due to rounding
- Reductions (`sum += A[i]`) cannot be vectorized without reordering additions — which changes the result
- `-ffast-math` tells compiler: assume associativity, allow reordering, ignore NaN/Inf handling
- Enables vectorization of reductions, enables FMA fusion, enables algebraic simplification
- Risk: results differ numerically. For scientific computing, this can break correctness.

**Q: What is LTO and why does it matter for these optimizations?**
- Link Time Optimization: instead of compiling each .cpp to native code, compile to LLVM IR bitcode. At link time, the whole program is optimized together.
- Enables: inlining across translation unit boundaries, whole-program dead code elimination, better alias analysis
- ThinLTO: a scalable variant — doesn't need the whole program in memory at once, uses summary-based analysis

**Q: How does the compiler know a loop trip count at compile time?**
- If loop bound is a compile-time constant: trivially known
- If loop bound comes from a function argument: unknown unless PGO or the call site passes a constant that propagates
- LLVM's ScalarEvolution (SCEV) pass analyzes induction variables and computes symbolic trip counts
- SCEV is what enables vectorization for `for(int i=0; i<n; i++)` — it understands i is an induction variable and n is the trip count

**Q: Explain register pressure and its relationship to vectorization and unrolling.**
- Register pressure: number of live values at a given program point
- More unrolling = more independent computations in flight = more live values = more registers needed
- If you exceed the physical register count: compiler spills to stack — loads/stores that didn't exist before
- Spilling on GPU is even worse: spills go to local memory (off-chip), latency ~400 cycles
- Vectorization itself increases register width usage — an AVX register holding 8 floats uses 1 register slot but carries 8 values, so effective pressure is lower but absolute register consumption is the same

**Q: What is the relationship between vectorization and cache line alignment?**
- Most SIMD load/store instructions prefer or require aligned addresses (16-byte for SSE, 32-byte for AVX, 64-byte for AVX-512)
- Misaligned loads work but may be slower (crosses cache line boundary = two cache line fetches)
- Compiler generates: scalar prologue (process elements until aligned), vector main loop (aligned), scalar epilogue (remaining elements)
- You can force alignment: `alignas(32) float A[N]` or `__attribute__((aligned(32)))`
- This is why `_mm256_load_ps` (aligned) is slightly faster than `_mm256_loadu_ps` (unaligned) on older hardware

**Q: How does branch prediction interact with vectorization?**
- Vectorized loops eliminate most branches (no per-iteration branch, just one branch per BLOCK_SIZE elements)
- Remaining branches: the trip count check (are we done?) predicted very accurately by hardware
- Conditionals inside the loop: handled by masking (predicated execution) — the branch disappears, replaced by mask operations
- Net effect: vectorization improves branch prediction behavior by eliminating unpredictable inner-loop branches

**Q: What is gather/scatter and when does the compiler use it?**
- Gather: load from non-contiguous addresses into a vector register
  - `v = gather(base, [i0, i1, i2, i3])` loads base[i0], base[i1], base[i2], base[i3] into v
- Scatter: store from a vector to non-contiguous addresses
- Used when: indirect array accesses (`A[B[i]]` where B has arbitrary values), strided access, AoS layouts
- Performance: gather/scatter is significantly slower than contiguous load (4-8x) but still faster than scalar
- AVX2 has gather support (no scatter). AVX-512 has both.
- Compiler uses gather as last resort — prefers to restructure data layout

---

## The One Mental Model to Carry Into Interviews

Every optimization trades one resource for another:

| Optimization | Trades | For |
|---|---|---|
| Vectorization | Code complexity | Throughput |
| Inlining | Code size / icache | Optimization opportunities |
| Unrolling | Code size / register pressure | ILP / memory latency hiding |
| Loop tiling | Code complexity | Cache reuse |
| Fusion | Register pressure | Cache reuse / loop overhead |
| LTO | Compile time | Cross-module optimization |

When an interviewer asks "why didn't this optimize?" — think about what resource is being exhausted. Almost always it's one of: register pressure, code size, aliasing uncertainty, or dependence legality.

---

# PART 6 — ADVANCED SYSTEM & COMPILER-LEVEL OPTIMIZATIONS

## Loop Invariant Code Motion (LICM) & Scalar Promotion

**What it is:**
LICM identifies computations inside a loop that produce the exact same result on every iteration (loop-invariant) and physically hoists them out into the loop's "preheader" block. 

**Scalar Promotion** is a highly potent subset of LICM: if a loop repeatedly loads and stores to the same memory address (and that address never aliases), the compiler hoists the `load` before the loop, performs all arithmetic on an ultra-fast raw CPU register (a scalar), and pushes a single `store` exactly after the loop exits.

```cpp
// Before LICM & Promotion
for (int i = 0; i < N; i++) {
    // 1. x * y is loop invariant (neither x nor y change inside)
    // 2. sum is read/written to memory on every single iteration
    *sum += A[i] + (x * y); 
}

// After LICM & Promotion
int invariant = x * y;         // Hoisted compute out of the loop
int local_sum = *sum;          // Scalar Promotion (Memory -> Register)

for (int i = 0; i < N; i++) {
    local_sum += A[i] + invariant; // Operates entirely inside L1 / CPU Registers
}

*sum = local_sum;              // Single memory write on loop exit
```

**Pros & Cons:**
*   **Pros:** Radically reduces memory traffic (loads/stores) and instruction count. It is mathematically required to enable vectorization in complex reductions.
*   **Cons:** Hoisting values *extends their live ranges*. If the compiler hoists too many invariants, it detonates **Register Pressure**, forcing the allocator to spill values to the stack (which ironically introduces *more* memory loads than LICM originally saved).

**Constraint: Alias Analysis rules LICM**
LICM is entirely gated by Alias Analysis. To hoist `x = load p`, the compiler asks AA: "Does any store in this loop alias `p`?". If AA returns `MayAlias` for `*q = y` inside the loop, LICM is completely blocked, because `p` and `q` might point to the same memory, mutating `p`'s value dynamically per iteration.

---

## SCEV (Scalar Evolution)

**What it is:**
SCEV mathematically analyzes how loop variables change. Instead of seeing `i = i + 1`, it models `i` as a polynomial or recurrence relation over loop iterations, like `{0, +, 1}` (starts at 0, adds 1 per iteration). 

**Why it matters:**
Without SCEV, compilers cannot compute the exact trip count of loops. SCEV is the mathematical engine enabling loop vectorization, unrolling, and bounds check elimination. The optimizer queries SCEV to understand induction variables deeply.

---

## Loop Unswitching

**What it is:**
When a loop contains a conditional `if/else` statement whose condition is **loop-invariant**, the compiler duplicates the *entire loop body*, placing one copy inside the `if` and the other inside the `else`.

```cpp
// Before Unswitching
for (int i = 0; i < N; i++) {
    if (use_fast_mode) {      // Condition is invariant!
        A[i] = B[i] * 2;
    } else {
        A[i] = B[i] * 3;
    }
}

// After Unswitching
if (use_fast_mode) {
    for (int i = 0; i < N; i++) A[i] = B[i] * 2; // Clean, vectorizable loop
} else {
    for (int i = 0; i < N; i++) A[i] = B[i] * 3; // Clean, vectorizable loop
}
```

**Pros & Cons:**
*   **Pros:** Completely eradicates branch prediction checks inside the hot loop. Unswitching generates mathematically pure, straight-line loops that trip the Auto-Vectorizer immediately.
*   **Cons:** **Extreme Code Bloat.** If a loop has 3 independent boolean checks, unswitching generates $2^3 = 8$ distinct copies of the loop. This crushes the Instruction Cache (icache). LLVM strictly limits unswitching depth.

---

## If-Conversion (Predication & Branchless Code)

**What it is:**
Modern CPUs possess incredibly long pipelines (15-20 stages). A mispredicted branch flushes the entire pipeline, costing ~15-20 cycles of dead time. **If-conversion** destroys control-flow branches, replacing them enthusiastically with data-flow **conditional moves** (like x86 `cmov`). 

```cpp
// Before If-Conversion (Control Flow)
for (int i = 0; i < N; i++) {
    if (A[i] > 0)           // Branching instruction (JMP)
        result += A[i];
}

// After If-Conversion (Branchless)
for (int i = 0; i < N; i++) {
    // Both sides evaluated; final value merged via CMOV or Bitwise Mask
    int mask = -(A[i] > 0);           // 0xFFFFFFFF if true, 0x00000000 if false
    result += (A[i] & mask);          // No branch. 100% deterministic latency.
}
```

**When to Use:**
*   Use If-Conversion when data is strictly **unpredictable** (like a randomized array of values oscillating above/below zero). In this scenario, branch predictors fail 50% of the time, causing catastrophic pipeline stalls.
*   **Do NOT use** when data is highly predictable (e.g., sorted arrays). If the CPU predicts the branch 99% of the time, the branch costs 0 cycles. Conversely, If-Conversion forcefully calculates *both* paths mechanically, making it actively slower than a well-predicted branch!

---

## Memory Alias Analysis & `__restrict__` (TBAA)

**What it is:**
Alias Analysis is fundamentally the hardest problem in compiler engineering. To securely re-order loads/stores (or to vectorize arrays), the compiler must mathematically prove that two pointers do *not* point to the identical memory address. 

**Type-Based Alias Analysis (TBAA)** represents the strict rules in C++ dictating that a pointer to an `int` cannot legally alias a pointer to a `float`. If you violate this (by casting a `float*` to an `int*`), the compiler assumes they don't alias, aggressively reorders your instructions, and physically destroys the validity of your program.

```cpp
// The pointer aliasing nightmare
void multiply(float* dest, float* src, int N) {
    for (int i = 0; i < N; i++) {
        // Compiler asks: Does dest OVERLAP with src?
        // If dest == &src[1], vectorized writing will corrupt future reads!
        dest[i] = src[i] * 2.0f;
    }
}
```

**Alias Query Responses:**
- **No-Alias:** Pointers definitely point to disjoint memory. (Optimization: 100% safe to reorder, hoist, or vectorize).
- **Must-Alias:** Pointers exactly map to the identical location. (Optimization: forward/reuse values).
- **May-Alias:** The compiler cannot mathematically prove disjointness. It acts conservatively and blocks optimizations.

**Flow-Sensitive vs Flow-Insensitive AA:**
- **Flow-Insensitive:** Checks if `p` and `q` *ever* alias anywhere in the program. Fast, but imprecise.
- **Flow-Sensitive:** Follows control flow. Knows `p` and `q` might alias at line 10, but after `q = new int()` at line 15, they are fundamentally disjoint (`NoAlias`) at line 20. LLVM often uses flow-insensitive BasicAA combined seamlessly with MemorySSA to emulate precise flow-sensitivity.

**The Solution (`__restrict__`):**
C and C++ extensions provide `__restrict__` as a signed contract with the compiler. You legally promise that no other pointer dictates access to this memory block.
```cpp
void multiply(float* __restrict__ dest, float* __restrict__ src, int N);
// Compiler reaction: Absolute freedom to vectorize, unroll, and reorder.
```

---

## Jump Threading

**What it is:**
Jump Threading optimizes the Control Flow Graph (CFG) by detecting paths that evaluate the strictly identical boolean condition sequentially, physically bypassing intermediate blocks to jump directly to the final truth state.

```cpp
// Source Code
if (x > 10) {
    do_work();
}
if (x > 10) {     // Compiler identifies this is mechanically the same check!
    finish_work();
}

// After Jump Threading (CFG restructuring)
// The compiler threads the edge from block 1 natively to block 2 without the JMP!
```
In hardware, Jump Threading reduces dynamic instruction length and heavily trims false branching topologies before Register Allocation begins.

---

## Devirtualization (VTable Bypass)

**What it is:**
Virtual functions exact a painful toll: memory fetch for the `vptr`, memory fetch for the `vtable` function address, and an unpredictable indirect branch that stalls the CPU pipeline. **Devirtualization** mathematically proves the concrete type of an polymorphic object at compile time and surgically replaces the dynamic vtable lookup with a blazingly fast, direct static layout call.

```cpp
class Animal { public: virtual void speak() = 0; };
class Dog : public Animal { public: void speak() override { /* bark */ } };

void test() {
    Animal* a = new Dog();
    a->speak();  // Compiler knows definitively 'a' is a Dog.
                 // Eliminates VTable entirely -> Dog::speak() directly!
}
```
*   **LTO (Link-Time Optimization)** acts as the ultimate enabler for Devirtualization. By perceiving the entire program layout synchronously, the compiler can guarantee a specifically derived class is exactly the only instantiation matching a virtual interface, collapsing all accesses directly into static calls.

---

## Polyhedral Optimizations (ISL & MLIR Affine)

**What it is:**
Rather than blindly unrolling code using heuristics, the Polyhedral model operates using high-level integer linear programming. It maps deep, heavily-nested `for` loops explicitly as points vibrating inside an N-dimensional mathematical space (a polyhedron).

Instead of using basic "Loop Tiling" guesswork, mathematical solvers (like the Integer Set Library - ISL) reshape the spatial polyhedron explicitly. It natively discovers the ultimate mathematically optimal schedule to align memory-fetches structurally perfectly with L1/L2 Cache dimensions, maximizing spatial temporal locality.

**Adoption:** 
*   Heavy utilization internally within **MLIR (Affine Dialect)**, actively forming the absolute baseline for next-gen machine learning compilers spanning TPUs, NVIDIA Tensor Cores, and Triton DSL compilation matrices.

---

## Link-Time Optimization (Full LTO vs ThinLTO)

**What it is:**
Modern languages compile code in strictly isolated Translation Units (`.cpp` -> `.o`). During standard compilation, the optimizer cannot inline a function from `math.cpp` into `main.cpp` because it cannot "see" across file boundaries. 

**Full LTO** solves this by deferring optimization entirely. Instead of compiling to machine code, Clang emits LLVM IR Bitcode into the `.o` files. At link-time, the Linker merges *every single bitcode file* into one massive module and runs the optimization pipeline across the entire program at once, unlocking devastatingly efficient cross-module inlining.

**The Problem:** Full LTO requires loading the entire software codebase into RAM on a single thread. For massive codebases (like Chrome or AAA Games), this consumes >100GB of RAM and crashes the linker instantly.

**ThinLTO** is the modern savior. Instead of loading the entire IR, ThinLTO writes a tiny **Function Summary Index** during early compilation. At link time, the linker uses these tiny statistical summaries to statically map which functions should be imported into which modules. It then forks the backend optimization pipelines natively across $N$ parallel CPU cores, achieving 99% of Full LTO performance with zero thermal throttling or RAM crashes.

---

## Profile-Guided Optimization (PGO) & AutoFDO

**What it is:**
Static heuristics are often wrong. The compiler might guess a `for` loop executes 100 times, but at runtime, it executes 0 times. 

**PGO** fundamentally shifts compilation by relying purely on empirical telemetry. 
1. The compiler builds an **Instrumented** binary overflowing with tracking counters.
2. The user runs the binary on heavy, realistic production workloads, generating a **Profile Data Map** (`.profdata`).
3. The compiler runs the optimization pipeline a second time, reading the profile data. It aggressively rearranges Basic Blocks explicitly to ensure the statistical "Hot Path" is absolutely contiguous in memory (destroying icache misses), whilst severely penalizing cold paths.

**AutoFDO (Feedback-Directed Optimization)**: Instead of compiling a slow instrumented binary, AutoFDO uses hardware Performance Monitor Units (Linux `perf` sampling) natively inside production datacenters. It magically maps mechanical CPU pipeline stalls directly back to source lines, allowing live continuous-integration compilers to optimize daily.

---

## Indirect Call Promotion (ICP)

**What it is:**
Virtual function calls and function pointers are "Indirect Calls." They force the CPU to fetch the jump target from RAM, completely neutralizing branch predictors and devastating performance. 

When PGO data statistically reveals that an arbitrary `Animal* animal` pointer invokes `Dog::speak()` 95% of the time dynamically, **Indirect Call Promotion** kicks in. It speculatively converts the mystery pointer mathematically into a hardcoded `if` statement guarding a direct, fully-inlinable jump!

```cpp
// Before ICP
animal->speak(); // Brutal indirect jmp (Cache Miss + Pipeline Flush)

// After ICP (Derived from PGO Telemetry)
if (animal->vtable == &Dog::vtable) {
    Dog::speak(); // Devirtualized! Direct static call. Blazingly fast. Can be inlined!
} else {
    animal->speak(); // Rare Slow Path fallback
}
```

---

## Software Prefetching (`__builtin_prefetch`)

**What it is:**
Memory latency to Main RAM is ~300 CPU cycles. Modern hardware has "Spatial Prefetchers" that intelligently detect you traversing an array sequentially (`A[0]`, `A[1]`) and automatically pull `A[2]` into the L1 Cache ahead of time.

However, traversing drastically randomized structures (like massive Hash Maps or unstructured Linked Lists) completely blinds the Hardware Prefetcher. **Software Prefetching** enables the developer (or compiler) to manually emit assembly `PREFETCHT0` instructions, demanding the memory controller pull a specific pointer into L1 Cache cycles *before* the CPU actually issues the `load` command.

```cpp
// Traversing an unstructured Linked List
Node* current = head;
while (current != nullptr) {
    // Manually force L1 Cache to fetch the *next* node asynchronously 
    // while we do heavy math on the *current* node!
    if (current->next) {
        __builtin_prefetch(current->next, 0, 3); 
    }
    
    heavy_computation(current->value); // takes 200 cycles
    current = current->next; // INSTANT L1 Cache Hit! 0 latency.
}
```

---

## Machine Outlining (Code Compression)

**What it is:**
The exact opposite of Inlining. **Machine Outlining** targets raw Instruction Cache metrics (Code Size). The Outliner violently scans across the absolute final generated assembly, hunting for identical sequences of machine instructions fragmented globally across the executable.

When it detects a repeating 50-instruction blob natively in 10 different unrelated functions, it dynamically rips that blob out into a newly generated artificial "Callable Function." It then replaces the 10 call sites with a tiny 1-instruction `call` to the new blob, resulting in monolithic reductions to executable footprint. Highly utilized natively by Apple on iOS/ARM64 devices to preserve extreme battery memory lifetimes.

---

# PART 7 — QnA Covering Advanced Optimizations

**Q: If Branchless programming (If-Conversion) destroys branch mispredictions, why isn't it used mechanically everywhere?**
Because If-Conversion evaluates the arithmetic for **both** the True and the False conditions computationally before choosing the final value (via CMOV or masked bitwise AND). If the condition is 99% predictable (like an error-check `if (val == NULL)`), the CPU branch predictor guesses it instantly with $0$ cycle latency, skipping the false-path compute entirely. If-Conversion would ruthlessly force the CPU to mechanically execute the dead error-check arithmetic every single iteration.

**Q: How does LTO (Link-Time Optimization) specifically allow Devirtualization to fire?**
When compiling standard `.cpp` files linearly, the compiler cannot look past the immediate translation unit bounding box. If the compiler sees an `Animal*` passed to a function, it *has* to assume some external, unknown `.cpp` file might have subclassed it into a `Cat`. During LTO, the compiler holds every single object file in memory simultaneously. If it mathematically proves no `Cat` was ever instantiated, it securely strips the VTable mechanisms completely and binds direct static references.

**Q: Can you explain exactly why `__restrict__` guarantees better CPU vectorization?**
Vectorization loads 8 or 16 numbers at once. If `array_A` and `array_B` physically overlap by 1 byte in RAM, loading and calculating 8 variables at once mechanically destroys the data layout (Read-After-Write hazards). Because the compiler cannot prove an overlap won't happen at runtime, it refuses to vectorize. By applying `__restrict__`, you brutally override the compiler's safety checks, dictating it is legally allowed to assume the addresses are mutually exclusive.

**Q: What is the defining difference between Loop Unswitching and Loop Unrolling?**
**Unrolling** duplicates the inner *contents* of a loop exactly sequential to each other to widen the execution bounds and expose instruction-level parallelism. 
**Unswitching** rips out an internal `if(condition)` clause and shifts it totally *outside* the loop, forcefully creating two separate master loops. Unrolling scales linearly. Unswitching scales exponentially (creates $2^N$ loops), posing massive threats to the Icaches.

**Q: Why don't compilers just use Polyhedral Optimization on every loop?**
Polyhedral optimization mathematically models iterative matrices via Integer Linear Programming. Solving these matrices for massive graphs is notoriously NP-Complete. Running Polyhedral solvers globally on arbitrary standard `while()` loops crashes compilation time exponentially. Therefore, modern architectures severely isolate it only to pristine, mathematically dense `for` loops (like MLIR Affine networks and dense Tensor calculations).

**Q: Why did Full LTO absolutely destroy CI/CD build pipelines historically before ThinLTO?**
Full LTO breaks the cardinal rule of `Makefile`/`Ninja` incremental compilation. Normally, if you edit a single `.cpp` file, you only recompile that one file in 0.5 seconds, and the Linker mechanically stitches them together in 1 second. With Full LTO, editing a single file invalidates the serialized monolithic state, forcing the compiler backend to load literally gigabytes of IR into a single-threaded process and completely re-optimize the entire 10-million-line program from scratch for 45 minutes straight.

**Q: If Software Prefetching works so well on Hash Maps, why doesn't the compiler auto-insert it everywhere?**
Because Prefetching takes up extreme architectural bandwidth. Emitting a `PREFETCHT0` instruction burns an instruction slot, consumes hardware Load/Store Queues, and fundamentally saturates the DDR4 memory bus. If the compiler guesses wrong and prefetch telemetry is faulty, it crushes your data-bus downloading useless garbage into the critical L1 cache, violently evicting the actual data you currently need. It can single-handedly tank performance by 50% if abused.

**Q: What is the defining difference between Constant Folding and Constant Propagation?**
**Constant Folding** is algebraic simplification: calculating `2 + 3` into `5` physically at compile time. 
**Constant Propagation** is the act of physically transporting that `5` downward through the Data Flow graph natively into downstream variables and function calls. Compilers use *SCCP* (Sparse Conditional Constant Propagation) to do both simultaneously, aggressively weaponizing propagated constraints to kill dead-branches instantaneously.

---

# PART 8 — THE BRANCH DILEMMA: VECTORIZE VS UNROLL

When a loop contains conditional branches (if/else), it presents a unique challenge to both the vectorizer and the unroller. 

## 8.1 — Vectorizing with Branches: The "Masking" Trade-off

**Is it beneficial?**
Yes, but only if the hardware/compiler can handle the control flow efficiently.

### When it's WINNING:
1.  **Masked Support (AVX-512 / SVE)**: If the hardware has dedicated mask registers, the compiler can calculate *both* paths and use a bit-mask to choose which results to store. This is extremely fast because it replaces branches with deterministic math.
2.  **Highly Unpredictable Data**: If the branch direction is random (e.g., `if (rand() % 2)`), the branch predictor will fail 50% of the time. Vectorization (with masking) eliminates the branch entirely, replacing it with a "mask-and-blend" operation which has a fixed, low latency.
3.  **If-Conversion**: The compiler turns the branch into a `select` (LLVM IR) or `cmov` (x86). This flattens the CFG into a straight line, which the vectorizer loves.

### When it's LOSING:
1.  **Divergence (SIMD efficiency)**: If iteration 0 takes the `if` and iteration 1 takes the `else`, a 16-wide vector might only be doing "useful" work on 1 out of 16 elements at any given time. This is "SIMD efficiency" loss.
2.  **Heavy Side Effects**: You cannot easily vectorize an `if` block that contains a function call, a system call, or an operation that might fault (like `if (p) *p = 5`).

---

## 8.2 — Unrolling with Branches: The "Branch Soup" Risk

**Is it beneficial?**
Beneficial for loop overhead, but dangerous for code size and branch prediction.

### The Benefits:
1.  **Loop Overhead**: If the loop body is small, unrolling still reduces the `i++` and `i < N` overhead.
2.  **Instruction Scheduling**: Unrolling gives the compiler more instructions to "shuffle" around. It might be able to group all the `if` checks together and all the compute together to better utilize the CPU's execution ports.

### The Catastrophic Risks:
1.  **Branch Prediction Saturation**: Most CPUs have a finite "Branch Target Buffer" (BTB). If you unroll a loop with 3 branches 8 times, you now have 24 branches in a single block. This can overflow the BTB, causing the CPU to "forget" branch patterns it previously knew, leading to more mispredictions.
2.  **Control Flow Complexity**: Unrolling increases the number of basic blocks significantly. If the branches are nested, the CFG becomes a "spaghetti" mess that makes it harder for downstream passes (like Register Allocation) to do their job.

---

## 8.3 — The Grand Judgment: Which to Choose?

| Scenario | Recommendation | Why? |
|---|---|---|
| **High SIMD hardware (AVX-512)** | **Vectorize** | Masking support makes branches almost free. |
| **Random/Unpredictable Data** | **Vectorize (via Masking)** | Eliminates the 50% miss-penalty of the branch predictor. |
| **Highly Predictable Data** | **Unroll (Slightly)** | Let the hardware branch predictor do its job. It's often faster than evaluating both paths. |
| **Very Large Loop Body** | **Neither** | You'll hit Instruction Cache (icache) pressure immediately. |
| **Branches with Function Calls** | **Inline first, then Unroll** | Vectorization will likely fail legality checks. |

> [!TIP]
> **Interview Secret**: If an interviewer asks this, immediately bring up **Loop Unswitching**. If the branch is invariant (doesn't change inside the loop), you should neither vectorize nor unroll with the branch inside — you should move the branch *outside* the loop entirely.

---

# PART 9 — THE SCENARIO PLAYBOOK

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
