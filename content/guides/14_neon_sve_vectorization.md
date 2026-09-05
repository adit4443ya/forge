<!--
category: ARM & AArch64 Backend
tags: NEON, SVE, SVE2, Vectorization, Scalable Vectors, vscale, Predication, SIMD, Loop Vectorizer
difficulty: Advanced
readTime: 40 min
-->

# NEON & SVE: ARM Vectorization for the LLVM Backend Engineer

> [!IMPORTANT]
> **TL;DR — what you must remember:** **NEON** is fixed-width 128-bit SIMD (you hardcode "4 floats"); **SVE** is **vector-length-agnostic** — the *same binary* runs at any 128–2048-bit width, with **predication** replacing the scalar remainder loop. LLVM models this with scalable **`<vscale x N x T>`** types. The headline interview point: SVE moves vector width from **compile time to run time**, which ripples through the type system and codegen.

You already know loop/SLP/auto-vectorization in the abstract (Guide 02), and a classic interview exercise is using Godbolt to *make* a loop vectorize — e.g. replacing an `if`-condition with a ternary so the vectorizer can prove legality. This guide is the ARM-specific layer: how NEON and SVE actually work, and — critically — how LLVM models **scalable vectors**, which is the single most distinctive thing about vectorizing for modern ARM.

---

# PART 1 — NEON (Advanced SIMD): THE FIXED-WIDTH BASELINE

## The Model

NEON = 32 × **128-bit** registers `V0–V31`, interpreted through *arrangement specifiers*:

```asm
V0.16B   sixteen  8-bit lanes
V0.8H    eight   16-bit lanes
V0.4S    four    32-bit lanes
V0.2D    two     64-bit lanes
```

```asm
fadd v0.4s, v1.4s, v2.4s      // 4 parallel float adds
fmla v0.4s, v1.4s, v2.4s      // fused multiply-accumulate: v0 += v1*v2
sdot v0.4s, v1.16b, v2.16b    // dot product (v8.2): 4×(4×i8·i8) → i32 accum
ld1  {v0.4s}, [x0], #16        // structure load with post-increment
ld2  {v0.4s, v1.4s}, [x0]      // DE-INTERLEAVING load: even lanes→v0, odd→v1
```

`LD2/LD3/LD4` deserve attention: they load interleaved data (like RGB pixels or complex numbers) directly into separate registers — LLVM's `InterleavedAccessPass` recognizes strided access groups and forms these. *"How would you vectorize a loop over an array of structs?"* → interleaved loads.

## NEON in LLVM IR

Fixed vectors, exactly as you know them:

```llvm
%sum = fadd <4 x float> %a, %b
; selected to FADDv4f32 → "fadd v0.4s, v1.4s, v2.4s"
```

The Loop Vectorizer picks VF=4 for f32 (128-bit / 32-bit), the cost model (`AArch64TTIImpl`) prices the operations, and ISel patterns in `AArch64InstrInfo.td` / `AArch64InstrFormats.td` do the matching. Nothing exotic — NEON is "SSE done cleanly."

**NEON's limitation:** the width is **frozen at 128 bits in the ISA**. New silicon can't get wider vectors without new instructions. That's the problem SVE exists to solve.

---

# PART 2 — SVE: SCALABLE VECTORS (The Headline Act)

## The Core Idea

SVE registers `Z0–Z31` have an implementation-defined width: **any multiple of 128 bits, from 128 to 2048**. One binary runs on all of them — *Vector-Length Agnostic (VLA)* code. The program never hardcodes the width; it asks the hardware.

```
Z register:  [ 128 × N bits ]   N chosen by the silicon (Neoverse V1: 256, A64FX: 512)
P0–P15:      predicate registers — ONE BIT PER BYTE of Z width
FFR:         first-fault register (for speculative loads)
```

`Z0`'s low 128 bits **alias `V0`** — NEON and SVE share state.

## Predication Replaces Loop Tails

The classic vectorization headache — "what about the last `n % VF` iterations?" — disappears. SVE loops use a **governing predicate**:

```asm
// for (i = 0; i < n; i++) c[i] = a[i] + b[i];
        mov     x9, xzr                  // i = 0
        whilelt p0.s, x9, x8             // p0[lane] = (i+lane < n)
.Lloop:
        ld1w    {z0.s}, p0/z, [x0, x9, lsl #2]   // load WHERE p0 set, else zero
        ld1w    {z1.s}, p0/z, [x1, x9, lsl #2]
        fadd    z0.s, p0/m, z0.s, z1.s            // add WHERE p0 set (merging)
        st1w    {z0.s}, p0, [x2, x9, lsl #2]      // store only active lanes
        incw    x9                        // i += (VL in words) — VL-agnostic!
        whilelt p0.s, x9, x8              // recompute predicate
        b.first .Lloop                    // loop while any lane active
```

Key reads: `WHILELT` builds the predicate from the induction variable vs trip count; the **final iteration is just a partially-true predicate** — no scalar epilogue, no remainder loop. `INCW` increments by however many 32-bit lanes this machine has. `p0/z` = zeroing predication, `p0/m` = merging.

## The Rest of the SVE Toolbox

- **Gather/scatter:** `ld1w {z0.s}, p0/z, [x0, z1.s, sxtw #2]` — vector of indices → vector of loads. Unlocks vectorizing indirect accesses `a[idx[i]]`.
- **First-faulting loads (`ldff1w` + FFR):** speculatively load past where you're sure is valid (e.g. `strlen`-style loops); faulting lanes just clear FFR bits instead of trapping.
- **Horizontal reductions:** `faddv s0, p0, z1.s` — predicate-aware reduce-to-scalar.
- **`PTRUE`, `CNTW/CNTB`:** materialize all-true predicates; read the runtime VL.
- **SVE2 (ARMv9 baseline):** extends SVE from HPC-flavored to general-purpose — integer multiply-high, bit-permute, NEON-parity DSP ops, string/match instructions (`MATCH/NMATCH`). If the core is ARMv9, you have SVE2.

---

# PART 3 — HOW LLVM MODELS SCALABLE VECTORS

This is the part that makes you valuable on day one, because it's where ARM's ISA design leaks into core LLVM IR design.

## `<vscale x N x T>`

```llvm
<4 x float>            ; fixed: exactly 4 floats (NEON)
<vscale x 4 x float>   ; scalable: (vscale × 4) floats (SVE)
```

`vscale` is a **runtime constant**: (register width)/128. On a 256-bit SVE machine, `vscale = 2`, so `<vscale x 4 x float>` holds 8 floats. The IR is the same binary IR on every machine.

Consequences that ripple through the whole compiler:

1. **`getelementptr` and sizes:** `sizeof(<vscale x 4 x i32>)` is not a compile-time integer. `TypeSize` in LLVM is a *(known-minimum, scalable-flag)* pair, and code that calls `getFixedValue()` on a scalable type **asserts**. Half the early SVE work in LLVM was hunting code that assumed sizes are integers.
2. **`llvm.vscale.i64`** intrinsic reads the multiplier; induction-variable updates become `i += 4 * vscale`.
3. **Stack frames:** spilling a Z register needs a *scalable* stack slot — frame layout gains a separate scalable region addressed via `ADDVL`-style arithmetic.
4. **Constants:** you can't write a literal `<vscale x 4 x i32>` full of arbitrary values — only splats (`splat (i32 1)`) and step vectors (`llvm.stepvector`) make sense.

## Predication in IR

The vectorizer's tail-folding mode expresses the SVE pattern directly:

```llvm
%mask = call <vscale x 4 x i1> @llvm.get.active.lane.mask.nxv4i1.i64(i64 %i, i64 %n)
%a = call <vscale x 4 x float> @llvm.masked.load.nxv4f32(..., <vscale x 4 x i1> %mask, ...)
...
call void @llvm.masked.store.nxv4f32(..., <vscale x 4 x i1> %mask)
```

`get.active.lane.mask` ⇄ `WHILELT`. Masked load/store ⇄ `LD1W/ST1W` with predicate. The mapping is almost 1:1 — which makes `-emit-llvm` + `llc` diffing a genuinely effective way to learn the backend.

## Driving It

```bash
clang -O3 -target aarch64-linux-gnu -march=armv8-a+sve \
      -mllvm -prefer-predicate-over-epilogue=predicate-dont-vectorize \
      -S vec.c                       # force tail-folded SVE loops

llc -mattr=+sve -aarch64-sve-vector-bits-min=256 ...   # fixed-VL tuning mode
```

`-msve-vector-bits=256` (the `arm_sve_vector_bits` attribute) lets users *opt in* to a fixed VL for performance/layout — the compiler then legalizes fixed `<8 x float>` onto SVE. Know that this mode exists; teams get asked for it by HPC customers.

## Cost Model Reality

The Loop Vectorizer asks `AArch64TTIImpl` whether scalable vectorization beats fixed NEON for each loop. Inputs: instruction costs per `SchedModel`, gather/scatter penalties, predicate overhead, trip-count knowledge. On cores with 128-bit SVE (where `vscale=1`), NEON sometimes still wins — *"when would you choose NEON over SVE on an SVE-capable core?"* is a sharp interview question. Answer: short fixed-trip-count loops, heavy shuffle/permute patterns NEON encodes more cheaply, or when predication overhead outweighs the eliminated epilogue.

---

# PART 4 — INTRINSICS (ACLE) — THE USER-FACING SURFACE

Your team also owns what *users* write. ACLE SVE intrinsics look like:

```c
#include <arm_sve.h>
void add(float *c, const float *a, const float *b, int64_t n) {
  for (int64_t i = 0; i < n; i += svcntw()) {        // svcntw() = lanes per VL
    svbool_t pg = svwhilelt_b32(i, n);
    svfloat32_t va = svld1(pg, a + i);
    svfloat32_t vb = svld1(pg, b + i);
    svst1(pg, c + i, svadd_x(pg, va, vb));
  }
}
```

`svfloat32_t` is a **sizeless type** — illegal as a struct member or `sizeof` operand; Clang enforces special type rules for it. These intrinsics lower to `llvm.aarch64.sve.*` and select essentially 1:1 to instructions.

---

# PART 5 — Q&A DRILL

### Q: NEON loop processes 4 floats/iteration. What's the SVE equivalent of "4"?
There isn't one at compile time — it's `svcntw()` / `CNTW` / `4 × vscale`, a runtime value. Induction updates use `INCW` or `i += 4*vscale`. That's the whole point of VLA.

### Q: How does SVE eliminate the scalar remainder loop?
The governing predicate computed by `WHILELT` is partially true on the final iteration; loads/stores/arithmetic execute only on active lanes. The "remainder" is just the last predicated iteration. In IR: tail folding via `get.active.lane.mask` + masked memory ops.

### Q: What breaks in a compiler when vector types stop having compile-time sizes?
Everything that assumed `TypeSize` is an integer: struct layout, stack slot allocation, GEP folding, SROA, memcpy lowering, constant folding of whole-vector constants. LLVM threads a `(MinSize, Scalable)` pair through all of it; scalable stack objects live in a dedicated frame region.

### Q: Why can't you put an `svfloat32_t` in a struct?
Sizeless type — its size is unknown at compile time, so layout, `sizeof`, and array-of are all ill-formed. Clang implements dedicated sizeless-type semantics for SVE ACLE types.

### Q: A loop does `sum += a[idx[i]]`. NEON vs SVE story?
NEON: no gather — vectorizer must scalarize the loads (usually not profitable). SVE: `LD1W` gather with a vector of indices makes it vectorizable; cost model decides if the gather throughput is worth it. Then the reduction itself becomes `FADDV` (or an in-loop vector accumulator with a final horizontal reduce).

### Q: `vscale_range(1,16)` function attribute — what is it for?
Tells the optimizer min/max possible `vscale` so it can bound trip counts, fold comparisons, and size stack objects. `-msve-vector-bits=N` pins it exactly (`vscale_range(N/128, N/128)`), unlocking fixed-width reasoning on scalable types.
