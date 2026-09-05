<!--
category: ML Compilers & GPU Systems
tags: NVIDIA, Verification, Fuzzing, Alive2, Testing, PTX, Compute-Sanitizer
difficulty: Advanced
readTime: 30 min
-->

# PART 1 — NVIDIA Compiler Verification Engineer: Role Reframe

> [!IMPORTANT]
> **TL;DR — what you must remember:** Compiler verification answers *"is the compiler correct?"*, not *"write a pass."* The toolbox: **differential / fuzz testing** (Csmith, random IR), **translation validation** (Alive2 proving InstCombine peepholes), **sanitizers** (compute-sanitizer for GPU), and **shrinking** failures with `creduce` / `bugpoint`. You're paid to break the compiler methodically and file minimal, reproducible bugs.

## What This Role Actually Is

Compiler verification is NOT writing compiler passes. It's answering the hardest question in compilers: **"Is this compiler correct?"**

You're responsible for:
- Finding bugs the compiler introduces (wrong code generation, silent miscompiles)
- Building test infrastructure and coverage frameworks
- Differential testing — running same program on multiple compilers/backends and comparing outputs
- Formal or semi-formal verification of specific transforms
- Fuzzing compiler pipelines
- Stress testing edge cases in codegen, register allocation, vectorization

This is actually a sophisticated role. A bad compiler verification engineer just runs test suites. A great one **thinks like an adversary** — where would this compiler generate wrong code and how would I catch it before it ships to millions of GPUs?

---

## How Swapnil's GPU Compiler Background Affects Tomorrow

He's screening you from a GPU compiler perspective even for a verification role — because at NVIDIA, verification engineers for the compiler need to deeply understand what the compiler is doing to know where it could go wrong.

So: your OpenMP offloading knowledge, CUDA execution model, LLVM pipeline understanding — all still fully relevant. The angle shifts slightly:

Instead of "how do you build this" it becomes "how do you break this and prove it's broken."

---

## Role-Specific Questions to Expect

**Q: How would you verify that a compiler optimization is semantics-preserving?**

Key answer framework:
- Define what "semantics-preserving" means for the optimization: same observable outputs for all valid inputs
- Write targeted test cases that exercise the exact conditions the optimization triggers on
- Differential testing: compile same source with optimization on vs off, compare outputs
- For GPU code: numerical outputs can differ due to floating point reordering — need to decide on tolerance
- For more rigorous verification: alive2 (LLVM's formal verification tool for IR transforms) proves equivalence using SMT solving
- Mutation testing: mutate the IR slightly and check that your test suite catches the regression

**Q: How would you find a miscompile — where the compiler generates wrong code silently?**

This is the hardest problem in compiler verification:
- Silent miscompiles produce wrong answers, not crashes — no signal
- Approach 1: Differential testing across compilers (gcc vs clang vs nvcc for same kernel)
- Approach 2: Fuzzing with tools like csmith, yarpgen — generate random valid programs, compare outputs
- Approach 3: Reduce known-bad programs with creduce/cvise to minimal reproducer
- Approach 4: Inject assertions into generated code — check intermediate values against reference
- For GPU specifically: run same kernel on CPU emulator, compare against GPU output

**Q: What is alive2 and how does it work?**

- Formal verification tool for LLVM IR transformations
- Takes source IR and target IR (before and after optimization pass)
- Uses Z3 SMT solver to prove: for all inputs, if source is defined, target produces the same result
- Catches cases where optimization is unsound — valid under most inputs but wrong under specific conditions (undefined behavior, overflow, etc.)
- Limitation: doesn't scale to full programs, works on individual passes/functions

**Q: How would you build a regression test suite for OpenMP target offloading?**

Candidates with an OpenMP/GPU-offloading background map naturally onto this question — knowing the construct space first-hand helps:
- If you've worked on OpenMP target offloading infrastructure, you already know the exact construct space to enumerate
- Test dimensions: every construct (target, teams, distribute, parallel for, simd), every clause (num_teams, num_threads, map variants), every combination
- Edge cases: nested parallelism, device data lifetime across multiple target regions, async offloading (nowait + taskwait)
- Correctness vs performance: functional tests (right answer) + performance regression tests (right speedup)
- Data mapping verification: write tests that specifically probe map(to:) vs map(from:) vs map(tofrom:) behavior — these are historically buggy

**Q: What's the difference between a compiler bug and a hardware bug? How do you distinguish them?**

- Run same compiled binary on multiple GPU generations — if wrong on all, likely compiler
- Run same source with different optimization levels (-O0 vs -O3) — if only wrong at -O3, likely optimization bug
- Inspect generated PTX directly — if PTX looks wrong, compiler bug confirmed
- Use cuda-gdb or compute-sanitizer to inspect runtime behavior
- Check if bug reproduces on CPU path — isolates GPU-specific codegen
- Check if bug is data-dependent — may indicate race condition or memory issue, not compiler

**Q: What is fuzzing a compiler? What tools exist?**

- Fuzzing: automatically generate huge volumes of random valid programs, run through compiler, look for crashes or wrong outputs
- csmith: generates random C programs that are valid and well-defined (avoids UB deliberately)
- yarpgen: similar, more focused on vectorization testing
- spirv-fuzz: fuzzes SPIR-V shaders (relevant for GPU compiler testing)
- For OpenMP specifically: no great off-the-shelf fuzzer — this is actually an open research problem
- You could propose: extending csmith with OpenMP directives, or building a template-based fuzzer that generates valid OpenMP target regions

**Q: How would you test register allocation correctness on a GPU backend?**

- Register allocation bugs are subtle — they cause wrong values in registers but may not always crash
- Approach: write functions that use exactly N local variables, force the compiler to spill, check that spilled/restored values are correct
- Stress test: functions with very high register pressure (many live variables simultaneously)
- Check: does output change when you artificially lower the register budget (--maxrregcount in nvcc)?
- Differential: same function with different register constraints, outputs must match

**Q: What is compute-sanitizer and when would you use it in compiler verification?**

- NVIDIA's runtime analysis tool (successor to cuda-memcheck)
- Modes: memcheck (out of bounds, misaligned), racecheck (shared memory races), initcheck (uninitialized memory), synccheck (invalid barrier usage)
- In compiler verification: use racecheck to find if compiler-generated synchronization is wrong, use memcheck to find if compiler generates incorrect memory addresses
- Critical for verifying OpenMP target offloading correctness — barriers and data movement are common bug sources

**Q: Beyond functional correctness, how do you verify performance in an HFT environment?**

- **Roofline Analysis**: Verify if the kernel is compute-bound or memory-bound. If the compiler makes a choice that moves a kernel from compute-bound to memory-bound (e.g., poor tiling), that's a performance bug.
- **Latency Jitter Analysis**: In HFT, the *average* latency is less important than the *tail* (99th percentile). Verify that the compiler produces deterministic code. Check if small changes in source code (like adding a `printf` or a dummy op) cause the compiler to drop vectorization or change register allocation significantly.
- **Cycle-Accurate Simulation**: Use tools like NVIDIA's Nsight Compute or internal cycle-accurate simulators to verify that the instruction mix generated by the compiler matches the expected hardware execution profile.

**Q: What is Metamorphic Testing in compilers?**

- A technique where you apply "semantics-preserving" mutations to the input source and verify the output doesn't change meaningfully.
- Example: Reordering independent instructions or adding redundant `if(true)` guards.
- If the compiler produces wildly different (or slower) code for a metamorphic variant, it indicates a brittle optimization pass.

---
