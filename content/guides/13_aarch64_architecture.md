<!--
category: ARM & AArch64 Backend
tags: AArch64, ARM, ISA, AAPCS64, Registers, Calling Convention, Memory Model, Atomics, CSEL
difficulty: Advanced
readTime: 45 min
-->

# AArch64 Architecture: The Compiler Engineer's Deep Dive

> [!IMPORTANT]
> **TL;DR — what you must remember:** AArch64 is a clean RISC ISA: **31 GPRs** (W=32 / X=64, writing W zeroes the top half), **AAPCS64** passes args in X0–X7, **addressing modes** fold pointer arithmetic (pre/post-index = free increments), and the **NZCV flags** drive branchless **CSEL/CCMP**. Its sharpest edge is the **weak memory model** — acquire/release map to **LDAR/STLR**, and you reach for **DMB / LSE atomics** exactly where x86 would be implicitly ordered.

You are joining the **ARM LLVM team at Qualcomm**. Everything you generate, optimize, and debug will target this ISA. This guide covers AArch64 the way a backend engineer needs it — registers, calling convention, addressing modes, conditional execution, and the weak memory model — with the LLVM mapping at every step.

---

# PART 1 — THE REGISTER FILE

## General Purpose Registers

AArch64 has **31 general-purpose 64-bit registers**: `X0`–`X30`. Each has a 32-bit view: `W0`–`W30`. Writing to a `W` register **zeroes the upper 32 bits** of the corresponding `X` register (unlike x86, where writing `AX` preserves upper bits of `RAX` — this design eliminates partial-register stalls).

```
X0–X7    Argument / result registers
X8       Indirect result register (struct return pointer)
X9–X15   Caller-saved temporaries
X16, X17 IP0/IP1 — intra-procedure-call scratch (linker veneers may clobber!)
X18      Platform register (reserved on some OSes — never allocate on those)
X19–X28  Callee-saved
X29      FP (frame pointer)
X30      LR (link register — BL writes return address here)
SP       Stack pointer (NOT a GPR; must stay 16-byte aligned on access)
XZR/WZR  Zero register — reads as 0, writes are discarded
PC       Not directly readable/writable (unlike AArch32)
```

**Interview-critical detail:** `XZR` and `SP` share encoding 31. Which one is meant depends on the instruction. `ADD X0, X1, XZR` is a move; `ADD X0, SP, #16` computes a stack address. The decoder disambiguates by instruction class. RegisterInfo in LLVM models this with separate register classes (`GPR64`, `GPR64sp`).

## SIMD & FP Registers

32 × 128-bit vector registers `V0`–`V31`, with scalar views:
```
B0 (8-bit) ⊂ H0 (16-bit) ⊂ S0 (32-bit) ⊂ D0 (64-bit) ⊂ Q0 (128-bit) = V0
```
`V0`–`V7` pass FP/vector arguments; `V8`–`V15` are callee-saved **only in the low 64 bits** (a classic codegen bug source — spilling logic must know this).

## System Registers Relevant to Codegen

- `NZCV` — condition flags: **N**egative, **Z**ero, **C**arry, o**V**erflow. Set only by flag-setting instructions (`ADDS`, `SUBS`, `CMP`, `ANDS`...). Plain `ADD` does **not** touch flags — the compiler chooses flag-setting variants only when needed (this is why LLVM has separate `ADDWrr` vs `ADDSWrr` instruction definitions).
- `FPCR/FPSR` — FP control (rounding mode) and status.

---

# PART 2 — AAPCS64: THE CALLING CONVENTION

The **Procedure Call Standard for the Arm 64-bit Architecture** governs every function boundary your compiler emits.

## Argument Passing

1. Integer/pointer args → `X0`–`X7` in order.
2. FP/SIMD args → `V0`–`V7`.
3. More than 8 of either class → spilled to stack (caller allocates).
4. Aggregates ≤ 16 bytes → passed in up to two X registers.
5. Larger aggregates → caller copies to memory, passes **pointer** in next X register.
6. HFA (Homogeneous Floating-point Aggregate, e.g. `struct {float a,b,c,d;}`) → up to 4 elements passed in consecutive V registers. *This is a frequent ABI interview question.*

## Returns

- Integer/pointer → `X0` (and `X1` for 128-bit).
- FP/vector → `V0`.
- Large struct → caller passes a hidden pointer in **`X8`**; callee writes the result through it. (`X8` is the *indirect result register* — note it is **not** `X0`, unlike x86-64's RDI convention.)

## Stack Rules

- `SP` must be **16-byte aligned** at every access via SP. Hardware traps on misalignment (configurable). LLVM's frame lowering guarantees this.
- Typical prologue:

```asm
stp x29, x30, [sp, #-16]!   // push FP, LR; pre-index writeback
mov x29, sp                  // establish frame pointer
```

- Typical epilogue:

```asm
ldp x29, x30, [sp], #16     // pop FP, LR; post-index writeback
ret                          // branch to X30
```

**LLVM mapping:** `AArch64FrameLowering.cpp` emits these. Callee-saved spill/restore uses `STP/LDP` pairs aggressively — the `AArch64LoadStoreOptimizer` pass later merges adjacent `LDR/STR` into `LDP/STP` (one of the most ARM-characteristic late passes; expect to read or touch it).

---

# PART 3 — ADDRESSING MODES & LOAD/STORE

AArch64 is a strict **load/store architecture**: no instruction reads memory and computes in one step (no x86-style `add rax, [mem]`). This shapes instruction selection fundamentally — every memory operand becomes an explicit load.

## The Addressing Modes

```asm
ldr x0, [x1]              // base
ldr x0, [x1, #16]         // base + scaled unsigned 12-bit immediate
ldur x0, [x1, #-4]        // base + UNscaled signed 9-bit imm ("u" = unscaled)
ldr x0, [x1, x2]          // base + register
ldr x0, [x1, x2, lsl #3]  // base + (register << log2(size)) — array indexing!
ldr x0, [x1, w2, sxtw #3] // base + sign-extended 32-bit index, scaled
ldr x0, [x1, #8]!         // PRE-index:  x1 += 8, then load [x1]
ldr x0, [x1], #8          // POST-index: load [x1], then x1 += 8
```

Pre/post-index modes give **free pointer increments** — ideal for loop induction. LLVM's ISel forms them via `ISD::PRE_INC`/`POST_INC` indexed loads, and `AArch64LoadStoreOptimizer` recovers more after RA.

## Pair Instructions

`LDP/STP` move two registers in one instruction (must be same size, consecutive addressable). They dominate prologues, memcpy expansion, and struct copies. Knowing when the optimizer **can't** pair (volatile, misaligned, different sizes) is a practical debugging skill.

## Immediates Are Weird (and TableGen knows)

- Arithmetic imm: 12-bit, optionally `LSL #12`. So `ADD X0, X1, #4096` is legal, `#4097` is not — the compiler must materialize via `MOV` + register add.
- Logical imm: encoded as bitmask patterns (`N:immr:imms`) — only **repeating bit patterns** are encodable. `AND X0, X1, #0xFF00FF00FF00FF00` ✓ encodable; `#0x1234` ✗.
- `MOVZ/MOVK/MOVN` build arbitrary 64-bit constants 16 bits at a time. A worst-case constant costs 4 instructions; the constant-materialization logic in `AArch64ExpandImm.cpp` finds the minimal sequence. *"How does AArch64 materialize a 64-bit constant?" is a classic question.*

---

# PART 4 — BRANCHES, FLAGS, AND CONDITIONAL EXECUTION

## Compare & Branch

```asm
cmp x0, x1        // alias of SUBS XZR, X0, X1 — sets NZCV, discards result
b.eq .Ltarget     // branch if Z set
cbz  x0, .Lzero   // compare-and-branch-zero: NO flags involved
cbnz x0, .Lnz
tbz  x0, #5, .L   // test single bit, branch if zero — great for flag words
```

Condition codes: `EQ NE CS/HS CC/LO MI PL VS VC HI LS GE LT GT LE AL`. Signed comparisons use N,V (`GE` = N==V); unsigned use C,Z (`HI` = C∧¬Z). Backend engineers must read these fluently when staring at `-debug` ISel dumps.

## CSEL Family — Branchless Codegen

This is the AArch64 answer to your **Godbolt ternary-vectorization story** from the Qualcomm interview:

```asm
csel  x0, x1, x2, ge   // x0 = (ge) ? x1 : x2
csinc x0, x1, x2, ne   // x0 = ne ? x1 : x2+1   → builds CSET, CINC aliases
csinv / csneg          // select with invert / negate
ccmp  x0, x1, #0, eq   // CONDITIONAL compare: chains &&/|| without branches
```

`CCMP` is how LLVM lowers `if (a == 0 && b > 5)` into a single flag-chain with no intermediate branch — see `AArch64ConditionalCompares.cpp` (a target-specific pass that builds CCMP chains). Removing branches removes branch-prediction misses **and unblocks if-conversion and vectorization** — the exact effect you produced manually with the ternary operator.

---

# PART 5 — THE WEAK MEMORY MODEL (ARM's Sharpest Edge)

x86 is TSO (total store order); **AArch64 is weakly ordered**. Loads and stores to *different* addresses may be observed out of program order by other cores. The compiler and the programmer must say what ordering they need.

## The Tools

```asm
dmb ish          // Data Memory Barrier (inner shareable) — orders memory ops
dsb ish          // Data Synchronization Barrier — stronger, waits for completion
isb              // Instruction Synchronization Barrier — flush pipeline

ldar x0, [x1]    // Load-Acquire  — no later access moves before it
stlr x0, [x1]    // Store-Release — no earlier access moves after it
```

`LDAR/STLR` give **acquire/release semantics in one instruction** — this is why C++ `std::atomic` with `memory_order_acquire/release` is *cheap* on AArch64 (no separate fence), while `seq_cst` may still need stronger sequences.

## Atomics: Exclusives vs LSE

```asm
// Classic ARMv8.0: load-linked / store-conditional loop
.Lretry:
ldaxr  w0, [x2]       // load-acquire exclusive
add    w0, w0, #1
stlxr  w1, w0, [x2]   // store-release exclusive; w1 = 0 on success
cbnz   w1, .Lretry

// ARMv8.1 LSE (Large System Extensions): single instruction
ldaddal w1, w0, [x2]  // atomic add, acquire+release
cas / swp / ldset / ldclr ...
```

**LLVM mapping:** with `-mattr=+lse` (or `-mcpu=` of any modern core), `AtomicExpand` + ISel emit LSE instructions; otherwise an LL/SC loop is generated. `outline-atomics` (the default for many Linux targets) calls runtime helpers that pick LSE at runtime — a question your team can and will ask: *"What does `-moutline-atomics` do and why does it exist?"* (Answer: one binary that's fast on v8.1+ hardware and correct on v8.0.)

## C++ → AArch64 Mapping You Must Know Cold

| C++ | AArch64 |
|---|---|
| `load(relaxed)` | `LDR` |
| `load(acquire)` | `LDAR` |
| `store(release)` | `STLR` |
| `load(seq_cst)` | `LDAR` |
| `store(seq_cst)` | `STLR` (+ the LDAR/STLR pairing rule makes SC work) |
| `atomic_thread_fence(seq_cst)` | `DMB ISH` |

---

# PART 6 — ARMv8.x / ARMv9 FEATURE LANDSCAPE

Your team supports a *matrix* of cores. Features are gated by `-march=`/`-mcpu=`/`-mattr=` and modeled as **SubtargetFeatures** in `AArch64.td`:

- **v8.1** — LSE atomics, RDMA (SQRDMLAH)
- **v8.2** — FP16 arithmetic, dot product (`SDOT/UDOT` — matters for ML kernels)
- **v8.3** — **Pointer Authentication** (`PACIASP/AUTIASP` — sign LR in prologue, authenticate in epilogue; security hardening codegen)
- **v8.5** — **BTI** (Branch Target Identification — landing pads for indirect branches) + **MTE** (Memory Tagging)
- **v9.0** — **SVE2 baseline**, plus everything above

`PACIASP`/`BTI` insertion happens in frame lowering / dedicated passes — if you diff `-mbranch-protection=standard` output on Godbolt you'll see them immediately. Qualcomm's Snapdragon (Oryon/Kryo cores) and ARM Cortex/Neoverse lines differ in scheduling models and feature sets — which is exactly why per-CPU `SchedModel` files exist (Part 3 of Guide 15).

---

# PART 7 — Q&A DRILL

### Q: Why does writing W0 zero the top of X0? Why is that a *good* ISA decision?
Eliminates false dependencies on the old upper bits. On x86, writing `AX` merges into `RAX`, creating a partial-register dependency that stalls out-of-order engines or costs merge µops. AArch64's zeroing means every 32-bit op starts a fresh dependency chain — simpler renaming, and the compiler can freely use W-form instructions for `int` math.

### Q: `ADD X0, X1, #5000` — legal?
No single instruction: 5000 > 4095 and isn't `imm12 << 12`-representable. Compiler emits `MOV W2, #5000; ADD X0, X1, X2` or `ADD X0, X1, #4096; ADD X0, X0, #904`. The ISel/`AArch64ExpandImm` logic picks the cheaper form.

### Q: What's the difference between `DMB` and `DSB`?
`DMB` orders *memory accesses* relative to each other (other instructions may still proceed). `DSB` blocks **all** further execution until outstanding memory accesses complete — needed around cache/TLB maintenance, not normal synchronization. Compilers emit `DMB`; `DSB` is mostly kernel/firmware territory.

### Q: Your loop's pointer increment costs an extra `ADD`. What addressing feature removes it, and where in LLVM does it get formed?
Post-index addressing (`ldr x0, [x1], #8`). Formed either during ISel via indexed load/store nodes, or after RA by `AArch64LoadStoreOptimizer` merging the `LDR` and the `ADD`.

### Q: Why is `memory_order_acquire` nearly free on AArch64 but a fence on some other architectures?
Because the ISA has *dedicated* acquire/release loads and stores (`LDAR/STLR`) — ordering is attached to the access itself instead of a separate barrier instruction, so the core can implement it efficiently in the load/store unit.

### Q: A struct of four floats is passed to a function. Registers used?
It's an HFA → `S0, S1, S2, S3` (four consecutive FP registers), not GPRs, not memory. Break the homogeneity (add an `int`) and it falls back to the GPR/X-register rules.
