<!--
category: Interview Prep & Tooling
tags: LLVM, Clang, opt, llc, FileCheck, lit, GDB, perf
difficulty: Intermediate
readTime: 25 min
-->

# LLVM Developer Tooling: Commands Reference

> [!IMPORTANT]
> **TL;DR — what you must remember:** Know the loop cold — `clang -emit-llvm -S` to get IR, `opt -passes=...` to run/inspect passes, `llc` to lower IR to target asm, `llvm-mc` for assembly, and `-print-after-all` / `-mllvm` to watch the pipeline. **FileCheck** is how every codegen test is written, driven by `lit`. These commands *are* your day-one debugging workflow.

Everything an LLVM compiler engineer uses day-to-day. Organized by workflow stage. These are the exact commands that interviewers expect you to know cold.

---

# PART 1 — BUILDING LLVM

## Minimal Debug Build (fastest iteration for development)
```bash
cmake -S llvm -B build \
  -DCMAKE_BUILD_TYPE=Debug \
  -DLLVM_TARGETS_TO_BUILD="X86;AArch64;RISCV" \
  -DLLVM_ENABLE_PROJECTS="clang;lld" \
  -DLLVM_USE_LINKER=lld \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++ \
  -GNinja

ninja -C build -j$(nproc)
```

**Key flags explained:**
| Flag | Why you use it |
|---|---|
| `-DLLVM_TARGETS_TO_BUILD` | Compile only needed targets → 5x faster build |
| `-DLLVM_USE_LINKER=lld` | Use lld instead of ld → 3-4x faster link step |
| `-GNinja` | Ninja is faster than Make for incremental builds |
| `Debug` | Enables assertions, debug info in LLVM itself |

## Release Build (for benchmarking compiler performance)
```bash
cmake -S llvm -B build-release \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLVM_TARGETS_TO_BUILD="X86;AArch64;RISCV" \
  -DLLVM_ENABLE_PROJECTS="clang" \
  -DLLVM_ENABLE_ASSERTIONS=ON \   # Keep assertions even in Release
  -GNinja

ninja -C build-release clang opt llc
```

## Build Just One Tool (saves time)
```bash
ninja -C build opt          # build only opt
ninja -C build llc          # build only llc
ninja -C build FileCheck    # build only FileCheck
ninja -C build check-llvm   # run all llvm tests
```

---

# PART 2 — CLANG: EMITTING IR AND CONTROLLING COMPILATION

## Emit LLVM IR (Unoptimized)
```bash
clang -O0 -emit-llvm -S foo.c -o foo.ll      # Emit human-readable .ll (text IR)
clang -O0 -emit-llvm    foo.c -o foo.bc      # Emit binary bitcode .bc
```

## Emit LLVM IR at Various Optimization Levels
```bash
clang -O1 -emit-llvm -S foo.c -o foo_O1.ll
clang -O2 -emit-llvm -S foo.c -o foo_O2.ll
clang -O3 -emit-llvm -S foo.c -o foo_O3.ll
```
**Interview tip:** Comparing O0 vs O2 IR is how you demonstrate "this pass transformed the IR this way."

## Emit Assembly
```bash
clang -O2 -S foo.c -o foo.s               # Target assembly (not IR)
clang -O2 -S -march=armv8-a foo.c         # Cross-compile to AArch64
```

## Inspect compiler passes being run
```bash
clang -O2 -mllvm -print-pipeline-passes foo.c  # Print the exact pass pipeline
clang -O2 -Rpass=licm foo.c                     # Remarx: show when LICM fires
clang -O2 -Rpass-missed=vectorize foo.c         # Show when vectorizer FAILS
clang -O2 -Rpass-analysis=loop-vectorize foo.c  # Why vectorizer made a choice
```

## Address Sanitizer / UBSan (day-to-day debugging)
```bash
clang -fsanitize=address -g foo.c -o foo_asan
clang -fsanitize=undefined -g foo.c -o foo_ubsan
clang -fsanitize=thread -g foo.c -o foo_tsan
clang -fsanitize=memory -g foo.c -o foo_msan   # Uninitialized memory
```

---

# PART 3 — OPT: THE IR OPTIMIZER

`opt` is the primary tool for testing individual LLVM passes on IR.

## Basic pass invocation
```bash
# New Pass Manager (NPM) — current default
opt -passes='mem2reg' foo.ll -S -o foo_ssa.ll

# Run a pipeline
opt -passes='mem2reg,gvn,dce' foo.ll -S -o out.ll

# Run the full O2 pipeline
opt -O2 foo.ll -S -o out.ll
```

## Printing IR (inspect before/after a pass)
```bash
# Print IR before and after each pass
opt -passes='gvn' -print-before-all -print-after-all foo.ll -S -o /dev/null

# Print IR before a specific pass
opt -passes='gvn' -print-before=gvn foo.ll -S -o /dev/null

# Print IR after a specific pass
opt -passes='licm' -print-after=licm foo.ll -S -o /dev/null
```

## Printing Pass Statistics
```bash
opt -passes='mem2reg,gvn,licm' -stats foo.ll -S -o out.ll
# Output: shows how many instructions were eliminated, hoisted, etc.
```

## Inspect MemorySSA
```bash
opt -passes='print<memoryssa>' -disable-output foo.ll
```

## Inspect Dominator Tree
```bash
opt -passes='print<domtree>' -disable-output foo.ll
```

## Inspect Loop Info
```bash
opt -passes='print<loops>' -disable-output foo.ll
```

## Inspect Scalar Evolution (SCEV)
```bash
opt -passes='print<scalar-evolution>' -disable-output foo.ll
```

## Inspect Alias Analysis
```bash
opt -passes='print<aa-eval>' -disable-output foo.ll 2>&1
```

## Verify IR
```bash
opt -passes='verify' foo.ll -S -o /dev/null    # Runs LLVM IR verifier
```

## Run and Show Changed IR Only
```bash
opt -passes='gvn' -S foo.ll | diff foo.ll -    # Show what GVN changed
```

## Check if optimization fires
```bash
opt -passes='loop-vectorize' -debug-only=loop-vectorize foo.ll -S -o out.ll 2>&1
# Prints verbose debug output for the loop vectorizer
```

---

# PART 4 — LLC: IR TO MACHINE CODE

`llc` takes LLVM IR and produces assembly or object files. It's the backend.

## Basic Usage
```bash
llc foo.ll -o foo.s                    # Emit assembly
llc foo.ll -filetype=obj -o foo.o      # Emit object file
```

## Target-specific compilation
```bash
llc -mtriple=aarch64-linux-gnu foo.ll -o foo_arm.s
llc -mtriple=riscv64-linux-gnu -mattr=+m,+a,+f,+d foo.ll -o foo_riscv.s
llc -mtriple=x86_64-linux-gnu foo.ll -o foo_x86.s
```

## Control Optimization Level
```bash
llc -O0 foo.ll -o foo.s   # No optimization (good for debugging RA)
llc -O2 foo.ll -o foo.s   # Full backend optimization
```

## Use GlobalISel instead of SelectionDAG
```bash
llc -global-isel foo.ll -o foo.s
```

## Print SelectionDAG (extremely useful for backend debugging)
```bash
llc -view-dag-combine1-dags foo.ll    # View DAG before combining
llc -view-isel-dags foo.ll            # View DAG at instruction selection time
llc -view-sched-dags foo.ll           # View DAG at scheduling time
# These open Graphviz windows — requires graphviz installed
```

## Print MachineIR at each stage
```bash
llc -print-machineinstrs foo.ll       # Print MachineIR after every pass
llc -print-before=greedy foo.ll       # Print MachineIR before greedy RA
llc -print-after=greedy foo.ll        # Print MachineIR after greedy RA
```

## Dump register allocator output
```bash
llc -regalloc=greedy -debug-only=regalloc foo.ll 2>&1 | head -200
llc -regalloc=basic   # Use basic RA (simpler, slower code quality)
llc -regalloc=fast    # Use fast RA (O0, fastest compile time)
```

## Verify Machine IR
```bash
llc -verify-machineinstrs foo.ll -o foo.s
```

---

# PART 5 — llvm-dis AND llvm-as: BITCODE CONVERSION

```bash
# Binary bitcode (.bc) → Human-readable text (.ll)
llvm-dis foo.bc -o foo.ll

# Text IR (.ll) → Binary bitcode (.bc)
llvm-as foo.ll -o foo.bc

# Read bitcode directly
llvm-dis < foo.bc | less
```

---

# PART 6 — FileCheck: TESTING IR TRANSFORMATIONS

FileCheck is LLVM's pattern-matching tool used in every regression test. It reads a file with special `CHECK:` comments and validates output against them.

## Basic FileCheck test structure
```llvm
; RUN: opt -passes='mem2reg' %s -S | FileCheck %s

define i32 @foo() {
entry:
  %x = alloca i32
  store i32 5, ptr %x
  %val = load i32, ptr %x
  ret i32 %val
}

; CHECK-LABEL: @foo
; CHECK-NOT: alloca          ; mem2reg must have removed the alloca
; CHECK-NOT: store
; CHECK-NOT: load
; CHECK: ret i32 5           ; constant must have propagated
```

## FileCheck directives

| Directive | Meaning |
|---|---|
| `CHECK:` | Match this pattern somewhere after the previous CHECK |
| `CHECK-NEXT:` | Must match the **immediately next line** |
| `CHECK-SAME:` | Must be on the **same line** as the previous CHECK |
| `CHECK-NOT:` | This pattern must **NOT** appear |
| `CHECK-LABEL:` | Match and use as anchor (resets position for subsequent CHECKs) |
| `CHECK-DAG:` | Matches can appear in **any order** (useful for unordered ops) |
| `CHECK-COUNT-N:` | Pattern must appear exactly N times |
| `CHECK-EMPTY:` | Next line must be empty |

## Variable capture in FileCheck
```
; CHECK: %[[REG:[0-9]+]] = add       ; capture the register number
; CHECK: store i32 %[[REG]]          ; refer back to the captured value
```

## Running FileCheck directly
```bash
opt -passes='gvn' foo.ll -S | FileCheck foo.ll
# If no output: all checks passed
# If failure: shows exactly which check failed and what the output was
```

## FileCheck with multiple RUN lines
```llvm
; RUN: opt -passes='mem2reg' %s -S | FileCheck %s --check-prefix=SSA
; RUN: opt -passes='gvn' %s -S | FileCheck %s --check-prefix=GVN

; SSA: phi
; GVN-NOT: phi
```

---

# PART 7 — LIT: LLVM INTEGRATED TESTER

`lit` is the test runner for LLVM. It discovers and runs tests in the `test/` directory.

## Basic test running
```bash
# Run all LLVM tests
llvm-lit build/test/

# Run a specific test file
llvm-lit build/test/Transforms/GVN/basic.ll

# Run tests matching a pattern
llvm-lit build/test/Transforms/

# Run with verbose output (see test commands)
llvm-lit -v build/test/Transforms/GVN/basic.ll

# Run with extra verbose (show all output, even passing tests)
llvm-lit -a build/test/Transforms/LICM/
```

## Parallel test execution
```bash
llvm-lit -j8 build/test/             # 8 parallel workers
llvm-lit -j$(nproc) build/test/      # Use all cores
```

## Filtering by test result
```bash
llvm-lit --filter='GVN' build/test/Transforms/  # Run tests whose name contains GVN
llvm-lit --xfail-not build/test/                # Don't allow expected failures to pass
```

## How a lit test file works
```llvm
; This is a .ll test file
; RUN: opt -passes='licm' %s -S | FileCheck %s
; RUN: opt -passes='licm' %s -S | FileCheck %s --check-prefix=NOLICM

; The %s expands to the filename of this test
; FileCheck reads this same file for CHECK directives
```

## Running LLVM's test suite for a specific component
```bash
ninja -C build check-llvm-transforms        # Just optimizer tests
ninja -C build check-llvm-codegen          # Just codegen tests
ninja -C build check-llvm-analysis         # Just analysis tests
ninja -C build check-clang                 # Clang tests
ninja -C build check-all                   # Everything
```

---

# PART 8 — DEBUGGING LLVM PASSES

## Print debug output for a specific pass
```bash
# -debug-only requires a Debug build
opt -passes='licm' -debug-only=licm foo.ll -S -o /dev/null 2>&1
opt -passes='loop-vectorize' -debug-only=loop-vectorize foo.ll -S 2>&1
opt -passes='gvn' -debug-only=gvn foo.ll -S 2>&1
```

## Crash debugging: bisecting passes
```bash
# If a crash occurs in opt, bisect to find culprit pass
opt -O2 foo.ll -S -o out.ll    # crashes!

# Use bugpoint (legacy) or reduce-crashes.py
llvm/utils/bugpoint foo.ll -opt-pass-bug -opt-args "-O2"
# bugpoint will narrow down which pass causes the crash
```

## llvm-reduce: minimize crash reproducers
```bash
# Takes a crashing .ll and minimizes it
llvm-reduce --test=my_crash_test.sh foo.ll
# Outputs minimized.ll — smallest IR that still crashes
```

## Checking for IR validity
```bash
opt -passes='verify' -verify-each foo.ll -S -o /dev/null
# -verify-each runs the verifier after every single pass in the pipeline
# Catches passes that produce invalid IR
```

## Using GDB/LLDB with LLVM
```bash
# Build with Debug symbols (default Debug build has them)
gdb --args opt -passes='gvn' foo.ll -S

# Set breakpoints on specific passes
(gdb) break GVN::run
(gdb) run

# Useful LLVM GDB helpers (in llvm/utils/gdb-scripts/)
source llvm/utils/gdb-scripts/prettyprinters.py
# Now you can print APInt, Value, Type etc. nicely
```

---

# PART 9 — INSPECTING OBJECT FILES AND LINKING

## Disassemble compiled object
```bash
llvm-objdump -d foo.o                    # Disassemble
llvm-objdump -d --source foo.o           # Mix source + assembly
llvm-objdump -d -M intel foo.o           # x86 Intel syntax
```

## Inspect symbols
```bash
llvm-nm foo.o                            # List symbols
llvm-nm --demangle foo.o                 # Demangle C++ names
llvm-readelf -a foo.o                    # Full ELF headers + sections
llvm-readobj --all foo.o                 # LLVM-style object dump
```

## Inspect debug info
```bash
llvm-dwarfdump foo.o                     # Dump DWARF debug info
llvm-dwarfdump --statistics foo.o       # Debug info quality metrics
```

## Link Time Optimization (LTO)
```bash
# Full LTO
clang -O2 -flto foo.c bar.c -o prog

# ThinLTO (scalable)
clang -O2 -flto=thin foo.c bar.c -o prog

# Check if LTO bitcode is in objects
llvm-nm foo.bc | grep -c "^"   # LTO uses bitcode in .o files
```

## Inspect IR in an LTO bitcode file
```bash
clang -O2 -flto -c foo.c -o foo.lto.o
llvm-dis foo.lto.o -o foo.ll   # Extract bitcode and disassemble
```

---

# PART 10 — PERFORMANCE PROFILING

## PGO: Profile Guided Optimization
```bash
# Step 1: Instrument build
clang -fprofile-generate foo.c -o foo_instr

# Step 2: Run with representative workload
./foo_instr

# Step 3: Merge profiles
llvm-profdata merge -output=foo.profdata default_*.profraw

# Step 4: Rebuild with profile data
clang -O2 -fprofile-use=foo.profdata foo.c -o foo_pgo
```

## Perf + LLVM (Linux)
```bash
perf record -g ./foo            # Record call graph
perf report                     # Inspect hotspots interactively
perf annotate                   # Assembly-level hotspot view
```

## opt-viewer: Optimization Remarks as HTML
```bash
clang -O2 -fsave-optimization-record=yaml foo.c -o foo
opt-viewer.py foo.opt.yaml      # Opens HTML view of all opt decisions
```

---

# PART 11 — MISCELLANEOUS ESSENTIAL TOOLS

## llvm-stress: Generate random IR for fuzzing/testing
```bash
llvm-stress -size=100 | opt -O2 -S   # Generate random IR, run through optimizer
```

## llvm-mca: Machine Code Analyzer (instruction throughput)
```bash
llvm-mca -mcpu=cortex-a55 foo.s      # Analyze pipeline throughput
llvm-mca -mcpu=znver3 foo.s -resource-pressure  # Show port pressure
```

## alive2: Formal Verification of IR Transformations
```bash
# Checks if an optimization is correct (uses Z3 SMT solver)
alive-tv before.ll after.ll
# If output is "Transformation seems to be correct!" — your pass is sound
# If "Incorrect!" — your optimization is unsound (miscompile found!)
```

## llvm-diff: Compare two IR files
```bash
llvm-diff before.ll after.ll    # Semantic-aware diff of two IR files
```

## scan-build: Static Analysis
```bash
scan-build clang -O2 foo.c      # Clang static analyzer
scan-build ninja -C build       # Analyze whole LLVM build
```

## clang-tidy: Linting
```bash
clang-tidy foo.cpp -- -std=c++17    # Run all checks
clang-tidy -checks='readability-*' foo.cpp --
```

---

# PART 12 — QUICK CHEATSHEET FOR INTERVIEWS

```bash
# "Show me the IR before and after optimization X"
clang -O0 -emit-llvm -S foo.c -o before.ll
opt -passes='X' before.ll -S -o after.ll
diff before.ll after.ll

# "Debug why a pass isn't firing"
opt -passes='licm' -debug-only=licm -stats foo.ll -S -o /dev/null 2>&1

# "How do I check if my new FileCheck test passes?"
llvm-lit -v test/Transforms/MyPass/my_test.ll

# "How do I run just the codegen tests for RISC-V?"
ninja -C build check-llvm-codegen-riscv

# "How do I verify I didn't break anything?"
ninja -C build check-llvm

# "How do I find which pass breaks my IR?"
opt -O2 -verify-each foo.ll -S -o /dev/null

# "How do I see the SelectionDAG for my function?"
llc -view-isel-dags foo.ll

# "How do I inspect MemorySSA?"
opt -passes='print<memoryssa>' -disable-output foo.ll

# "How do I check formal correctness of my transform?"
alive-tv before.ll after.ll

# "How do I minimize a crashing IR?"
llvm-reduce --test=crash.sh input.ll
```

---

# PART 13 — INTERVIEW Q&A ON TOOLING

**Q: What is the difference between `opt` and `llc`?**
`opt` is the **middle-end** tool — it runs analysis and transformation passes on LLVM IR and outputs LLVM IR. `llc` is the **backend** tool — it takes LLVM IR and runs the code generation pipeline (ISel, RA, scheduling) to produce assembly or machine code.

**Q: What is FileCheck and why does LLVM use it instead of golden files?**
FileCheck is a pattern matcher that checks command output against embedded `CHECK:` annotations in the test file itself. Golden files would require storing and maintaining expected outputs separately. FileCheck patterns are more robust: they match key parts of IR (`CHECK: add`) without being brittle to register numbering or other irrelevant differences.

**Q: How do you add a regression test for a new optimization pass?**
1. Create a `.ll` file in `test/Transforms/MyPass/`
2. Add a `; RUN: opt -passes='my-pass' %s -S | FileCheck %s` line
3. Add `; CHECK:` directives verifying the expected transformation
4. Run `llvm-lit -v test/Transforms/MyPass/my_test.ll`

**Q: What is `lit` and how does it work?**
`lit` (LLVM Integrated Tester) discovers test files, reads their `RUN:` lines (which are shell commands), executes them, and checks exit codes. A test passes if all `RUN:` commands succeed (exit 0). `FileCheck` is the most common program in a `RUN:` line, but any command can be used.

**Q: How do you debug a crash in a new pass?**
1. First try `opt -verify-each` to find where the IR becomes invalid
2. Run with `-debug-only=my-pass` to get verbose pass output
3. If it still crashes inside a C++ function, use `gdb --args opt ...` and set breakpoints
4. Use `llvm-reduce` to minimize the crashing IR to a tiny reproducer

**Q: What is `alive2` and when would you use it?**
`alive2` formally verifies that an IR transformation is semantics-preserving using the Z3 SMT solver. You'd run it to prove your optimization pass doesn't introduce miscompilations. If `alive-tv before.ll after.ll` says "Incorrect!", your pass is unsound and needs fixing.

**Q: What is `llvm-mca` used for?**
`llvm-mca` (Machine Code Analyzer) statically analyzes a loop or sequence of assembly instructions and predicts throughput, resource pressure (which execution ports are bottlenecks), and instruction latencies using the target's scheduling model. It's used to tune hot loops for specific microarchitectures without running profile experiments.
