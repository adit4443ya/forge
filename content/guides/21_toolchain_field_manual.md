<!--
category: Compiler Engineering & Tooling
tags: clang, opt, llc, llvm-mca, llvm-objdump, llvm-nm, llvm-symbolizer, readelf, objdump, perf, simpleperf, CMake, Ninja, Soong, Compile Database, opt-bisect, print-after, Remarks, Cross Compilation, Field Manual
difficulty: Advanced
readTime: 40 min
-->

# Toolchain Field Manual: the question first, then the command

> [!IMPORTANT]
> **TL;DR — what you must remember:** Every stage of the pipeline can be stopped, dumped and diffed: **preprocessed source** (`-E`), **AST** (`-ast-dump`), **unoptimized IR** (`-O0 -emit-llvm`), **optimized IR** (`-O2 -emit-llvm`, `-print-after`, `-print-changed`), **machine IR** (`llc -print-after-isel`), **assembly** (`-S`), **object** (`-c`), **binary** (`readelf`/`nm`/`objdump`), **running process** (`perf`). The skill is knowing *which stage answers which question*; this manual is organized by question. Universal ideas are marked; commands were verified on this machine (clang/LLVM 21, `perf` 6.18) unless marked "not run here" (Android).

Companion guides: [11](#guide/11) is the LLVM-developer command reference (building LLVM, FileCheck, TableGen); this one is for using the toolchain on *someone else's* code. Runnable versions of most rows live in the lab (`ir/`, `cross_level/`, `perf/`, `codegen/`, `bigcode/`).

---

# PART 1 — THE PIPELINE MAP

```
 x.c ──(-E)──► preprocessed ──(parse/Sema: -fsyntax-only, -ast-dump)──► AST ──(CodeGen: -O0 -emit-llvm)──► IR
     IR ──(opt / clang -O2: -print-after=…, -print-changed, -Rpass…)──► optimized IR ──(llc: ISel, RA, sched: -print-after-isel…)──► MIR
     MIR ──(-S)──► asm ──(-c)──► .o ──(ld/lld: -Wl,-Map, -Wl,--trace)──► binary ──(readelf, nm, objdump, llvm-dwarfdump)──► process ──(perf, gdb, strace)
```

Stop at any arrow:

| Stage | Command | Use it when |
|---|---|---|
| preprocessed | `clang -E x.c \| less`; `-E -dM` for the macro set | "which header defines this?", "what does `-march=native` predefine?" |
| syntax / AST | `clang -fsyntax-only x.cpp`; `clang -Xclang -ast-dump -fsyntax-only x.cpp` | template and overload questions; what the front end really parsed |
| IR before optimization | `clang -O0 -S -emit-llvm x.c -o x.ll` | debugging semantics, writing a pass test (`ir/lesson1`) |
| IR after optimization | `clang -O2 -S -emit-llvm x.c -o x.ll`; `opt -O2 x.ll -S` | what survived; did the loop vectorize; aliasing decisions |
| per-pass IR | `clang -O2 -mllvm -print-after=loop-vectorize x.c -c -o /dev/null`; `-mllvm -print-changed` | which pass broke or fixed it |
| machine IR | `llc -O2 -print-after-isel x.ll -o /dev/null`; `-print-after=greedy` (register allocation) | backend questions: selection, spills, scheduling |
| assembly | `clang -O2 -S x.c` (add `-fno-asynchronous-unwind-tables` for readability); `llc x.ll -o x.s` | reading the loop (`codegen/01`) |
| object | `clang -c`; `llvm-objdump -d x.o`; `llvm-readelf -S x.o` | relocations, sections, what the linker will see |
| link | `-Wl,-Map,out.map`; `-Wl,--trace`; `-Wl,--why-extract=why.csv` (lld) | "where did this symbol come from", "why is this archive member linked" |
| binary | `readelf -h/-d/-S/-s/-n/-p`; `nm`, `nm -D`, `c++filt`; `llvm-dwarfdump`; `size` | `bigcode/02`, `bigcode/03` |
| process | `perf stat/record/report/annotate`; `gdb`; `strace -c`; `ltrace -c` | `perf/*`, `systems/*` |
| driver | `clang -### …` (print the cc1/linker commands), `clang -v`, `-print-search-dirs`, `-print-resource-dir` | "what is clang actually running?" |

---

# PART 2 — QUESTIONS → COMMANDS

## "Did this loop vectorize, and if not, why?"
```
clang -O2 -c x.c -Rpass=loop-vectorize -Rpass-missed=loop-vectorize -Rpass-analysis=loop-vectorize
clang -O2 -S -emit-llvm x.c -o - | grep -E '<[0-9]+ x (float|i32)>|vscale'         # vector types in IR
clang -O2 -S x.c -o - | grep -cE 'xmm|ymm|zmm'                                        # x86; for AArch64: 'v[0-9]+\.|z[0-9]+\.'
```
Remarks name the reason (aliasing, FP reduction, dependence, early exit, cost model): `codegen/02`. `-Rpass=.*` shows every transformation; `-fsave-optimization-record` writes YAML for `opt-viewer`.

## "Which pass changed (or broke) this?"
```
clang -O2 -mllvm -print-changed -c x.c -o /dev/null 2>&1 | less              # IR only when it changes, per pass
clang -O2 -mllvm -print-after=instcombine -mllvm -filter-print-funcs=hot -c x.c -o /dev/null
clang -O2 -mllvm -print-pipeline-passes -c x.c -o /dev/null                  # the exact pass pipeline string
opt -passes='default<O2>' x.ll -S -o out.ll                                  # run the O2 pipeline on IR
opt -passes='loop-vectorize' -S x.ll                                         # one pass
clang -O2 -mllvm -opt-bisect-limit=250 -c x.c ...                            # BISECT: passes after #250 are skipped; binary-search a miscompile
```
`-opt-bisect-limit` is the single most valuable flag for "the optimizer broke my program": find the largest N that still works, and the pass at N+1 is the culprit. `opt -passes=verify` checks well-formedness only (`ir/lesson2`: VALID yet wrong).

## "What does this function compile to, and how expensive is the loop body?"
```
clang -O2 -S -fno-asynchronous-unwind-tables x.c -o x.s
awk '/^fn:/{on=1} on&&/\.Lfunc_end/{on=0} on' x.s | grep -vE '^\s*\.(cfi|p2align|type|size)'   # one function
tools/asmdiff.sh x.c fn "-O2" "-O2 -march=native"                                            # two flag sets + llvm-mca
llvm-mca -mcpu=alderlake x.s              # or -mtriple=aarch64 -mcpu=neoverse-v2; regions via "# LLVM-MCA-BEGIN name"
llvm-mca -timeline -iterations=3 x.s      # who waits for whom (codegen/03)
```

## "Why is this symbol undefined / duplicated / from the wrong library?"
```
nm -C --undefined-only x.o | grep sym          nm -C --defined-only lib.a | grep sym
clang ... -Wl,--trace                          # which files the linker actually loads
clang ... -fuse-ld=lld -Wl,--why-extract=why.csv    # why each archive member was pulled in
clang ... -Wl,-Map,out.map                     # every symbol's final address and origin
readelf -d bin | grep NEEDED; ldd bin          # runtime dependencies (ldd runs the loader; readelf is safer)
LD_DEBUG=libs ./bin                            # loader search at run time; LD_DEBUG=bindings for symbol resolution
```
Link order matters for static archives (an archive is scanned once, when reached); `-Wl,--start-group … --end-group` or listing dependencies after dependents fixes "undefined reference" that "should" resolve.

## "What kind of binary is this, and how was it built?"
`bigcode/02` and `bigcode/03`, in one table:
```
file -L bin                          readelf -h bin | grep Type        # PIE (DYN) vs EXEC
readelf -p .comment bin              # compiler(s) that produced the objects
llvm-dwarfdump --debug-info bin | grep -m1 DW_AT_producer     # flags per CU if -g (and -grecord-command-line)
readelf -p .GCC.command.line obj     # with -frecord-command-line
readelf -n bin | grep -A1 "Build ID"; readelf -p .gnu_debuglink bin      # debug info handle
objdump -d bin | grep -cE 'vfmadd|vpgather|zmm'                          # ISA actually used
```

## "Where does the time go?" (the perf ladder)
```
perf stat -e cycles:u,instructions:u,branches:u,branch-misses:u,L1-dcache-load-misses:u,LLC-load-misses:u,dTLB-load-misses:u ./bin
perf record -F 4000 -o p.data ./bin;  perf report -i p.data --stdio --no-children --sort dso,sym
perf report --sort srcline;  perf annotate -l -s SYM;  perf record --call-graph dwarf; perf report --inline -G
perf report --stdio --sort dso | awk '/cpu_core/{on=1} on'     # hybrid CPUs: the P-core section
perf script -F ip,sym | sort | uniq -c | sort -rn | head        # raw addresses to symbolize by hand
llvm-symbolizer --obj=bin.debug --inlining --demangle 0xADDR    # address -> inlined frames -> line
perf buildid-cache -l / -r FILE / -a FILE                      # perf's private symbol cache
```
Pin first (`tools/pin.sh`), bypass ccache when profiling a compiler (`bigcode/04`), and know that unprivileged `perf` counts user space only (`:u`).

## "Why does this file take so long to compile?"
```
clang++ -ftime-trace -ftime-trace-granularity=200 -c x.cpp        # Chrome-trace JSON next to the object
jq -r '.traceEvents[] | select(.ph=="X") | "\(.dur/1000|floor) \(.name) \(.args.detail // "")"' x.json | sort -rn | head
clang++ -ftime-report -c x.cpp                                     # per-pass table on stderr
ninja -t commands target | tail -1                                 # reproduce one TU from a Ninja build (bigcode/01)
```

## "How do I build / rebuild just this piece?"
```
ninja -t targets | grep NAME;  ninja -t query NAME;  ninja -t commands OBJ | tail -1;  ninja -t deps OBJ;  ninja -d explain NAME
jq '.[] | select(.file|endswith("/X.cpp")) | .command' compile_commands.json
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++
cmake --build build --target NAME -v
```

## "How do I target another architecture from this laptop?"
```
clang --target=aarch64-linux-gnu -march=armv9-a+sve2 -S x.c -o -           # assembly needs no sysroot
source tools/a64.sh; a64cc -O2 x.c -o x_a64; a64run -cpu max ./x_a64        # link + run under qemu (aarch64 track)
llc -mtriple=aarch64 -mcpu=help; clang --target=aarch64-linux-gnu -### -c x.c    # what features a -mcpu implies
```

## "Reduce this crash / miscompile to something I can report"
```
llvm-reduce --test=./crashes.sh x.ll                # shrink IR while a predicate stays true
creduce ./crashes.sh x.cpp                          # same for source (external tool)
clang -O2 -mllvm -opt-bisect-limit=N …              # find the pass
opt -passes=verify -disable-output x.ll             # is the IR even well-formed?
clang -fsanitize=address,undefined; -fsanitize=thread    # is it UB, not a miscompile? (debug_lab tracks 0 and concurrency)
```

---

# PART 3 — opt AND llc: THE FLAGS THAT MATTER

| Flag | What it does |
|---|---|
| `opt -passes='a,b,c'` / `-passes='default<O3>'` / `-passes='function(instcombine),cgscc(inline)'` | new pass manager pipeline syntax; nest by IR unit |
| `-print-after=PASS`, `-print-before=PASS`, `-print-after-all`, `-print-changed[=quiet\|diff]` | IR dumps; `-filter-print-funcs=f` limits to one function |
| `-print-pipeline-passes` | the full pipeline string for an `-O` level |
| `-debug-only=loop-vectorize` (debug builds of LLVM) | a pass's internal chatter |
| `-stats` | per-pass counters ("N instructions combined") |
| `-time-passes` | per-pass time inside opt |
| `-opt-bisect-limit=N` | run only the first N passes: bisect miscompiles |
| `-mllvm -X` (via clang) | pass any of the above through the clang driver |
| `llc -mtriple= -mcpu= -mattr=+sve,+lse` | target selection |
| `llc -print-after-isel`, `-print-after=greedy`, `-print-machineinstrs` | machine IR after selection / register allocation |
| `llc -debug-pass=Structure` (legacy PM in the backend) | the codegen pass list |
| `llc -O0/-O1/-O2`; `-fast-isel`, `-global-isel` | selector choice |
| `-Rpass=`, `-Rpass-missed=`, `-Rpass-analysis=` (clang) | optimization remarks by pass name regex |
| `-fsave-optimization-record` (clang) | YAML remarks for `opt-viewer.py` |
| `-fno-inline-functions`, `-fno-unroll-loops`, `-fno-vectorize`, `-ffp-contract=off` | isolate one transformation's effect (`codegen/02`, `codegen/05`) |

---

# PART 4 — BINARY TOOLS, GNU AND LLVM FLAVOURS

| Task | GNU | LLVM |
|---|---|---|
| headers, sections, dynamic, notes, string dump | `readelf -h/-S/-d/-n/-p SEC` | `llvm-readelf`, `llvm-readobj --all` |
| symbols | `nm [-C] [-D] [--defined-only]` | `llvm-nm` |
| disassemble | `objdump -d --no-show-raw-insn`, `-S` (with source), `-C` | `llvm-objdump -d --symbolize-operands`, `-l` (lines), `--disassemble-symbols=fn` |
| sizes | `size` | `llvm-size` |
| DWARF | `readelf --debug-dump=info` | `llvm-dwarfdump --debug-info/--debug-line`, `--verify` |
| address → line | `addr2line -Cfi -e bin ADDR` | `llvm-symbolizer --obj=bin --inlining --demangle ADDR` |
| strip / extract debug | `strip`, `objcopy --only-keep-debug`, `--add-gnu-debuglink` | `llvm-strip`, `llvm-objcopy` (same flags) |
| archives | `ar t/x/r` | `llvm-ar` |
| demangle | `c++filt` | `llvm-cxxfilt` |
| profiles | — | `llvm-profdata merge/show`, `llvm-cov` (coverage, PGO) |
| static throughput model | — | `llvm-mca` |
| bloat | `bloaty` (not installed here) | `llvm-size -A`, `llvm-nm --size-sort` |

The LLVM tools accept the GNU spellings for the common flags; use whichever is installed and pin the version when outputs must match (this lab's `ir/` README says why).

---

# PART 5 — ANDROID: SOONG AND simpleperf (not run on this machine)

The same questions, Android's tools. Universal ideas; exact flags from the AOSP documentation.

- **Build**: `source build/envsetup.sh; lunch <product>; m <module>` (`mm` for the current directory, `mmm path`). Soong generates `out/soong/build.ninja` and `out/combined-<product>.ninja`: **everything in Part 2's Ninja section applies**: `ninja -f out/combined-<product>.ninja -t query <target>`, `-t commands`, `-t deps`. Module definitions are `Android.bp` (Blueprint); `cflags`, `arch: { arm64: { … } }` blocks and `-march` come from the module and the product's toolchain config. The compile database: `SOONG_GEN_COMPDB=1` produces `out/soong/development/ide/compdb/compile_commands.json`.
- **Binaries**: unstripped copies live in `out/target/product/<device>/symbols/…` mirroring the device paths; the device gets stripped ones. Symbolize with those: `llvm-symbolizer --obj=out/…/symbols/system/lib64/libfoo.so`, or `simpleperf report --symfs out/target/product/<device>/symbols`.
- **Profile**: `adb shell simpleperf record -e cpu-clock --call-graph fp -p PID --duration 10 -o /data/local/tmp/perf.data` (use `--call-graph dwarf` when frame pointers are missing; `-e cpu-cycles` needs the PMU exposed), `adb pull`, then `simpleperf report -i perf.data --sort dso,symbol` or `report_html.py` for a flame view; `app_profiler.py` wraps the whole thing for an app. `simpleperf stat` is `perf stat`. Kernel-side work needs root on the device.
- **Cross reading**: the objects are AArch64: everything in the `aarch64/` track (reading, NEON/SVE remarks, LSE/outline atomics, dispatch) transfers directly; `-march`/`-mcpu` come from the product's config (`ninja -t commands` shows them).
- **Traps**: profiling a 32-bit vs 64-bit process; stripped system libraries without `symbols/`; `cpu-clock` sampling on cores that go idle; big-little scheduling moving the thread (pin with `taskset` on the device, as `perf/01` does here).

---

# PART 6 — BUILD SYSTEMS, ONE MAP

| System | "what builds X" | "exact command for one file" | "why did it rebuild" | compile database |
|---|---|---|---|---|
| CMake + Ninja | `ninja -t query X` | `ninja -t commands OBJ \| tail -1` | `ninja -d explain X` | `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON` |
| Soong (Android) | `ninja -f out/combined-*.ninja -t query` | same | same | `SOONG_GEN_COMPDB=1` |
| Bazel | `bazel query 'deps(//x)'` | `bazel aquery //x` | `bazel build --explain=log` | `bazel run @hedron_compile_commands//:refresh_all` (community) |
| Make | `make -p` (database), `make -n X` | `make -n X` | `make -d` | `bear -- make` |
| Meson | `ninja -t …` (Meson emits Ninja) | same | same | generated by default |

---

# PART 7 — Q&A DRILL

### Q: The optimized binary misbehaves; -O0 works. What is your first command?
`-fsanitize=address,undefined` at -O2: most "optimizer bugs" are UB (`cross_level/opt_levels`: the optimizer deleted a null store into `unreachable`). If sanitizers are clean, `-mllvm -opt-bisect-limit=N` to find the pass, then `-print-changed` around it, then `llvm-reduce`.

### Q: A loop is 3x slower after upgrading the compiler. How do you find out why?
Same source, both compilers: `-S` and diff the loop body (`tools/asmdiff.sh` shape), `-Rpass-missed=loop-vectorize` on both, `llvm-mca` on both bodies, `perf stat` counters on both binaries. The remarks usually name it; the asm diff proves it.

### Q: How do you find which pass a specific IR instruction came from?
`-mllvm -print-changed` and search for the instruction's first appearance, or `-print-after-all` with `-filter-print-funcs`; debug-info-based: `opt -passes=debugify` gives every instruction a line (`ir/lesson1`).

### Q: You get "undefined reference" for a symbol that `nm` says is defined in a static library on the link line.
Link order: the archive was scanned before the object that needed it. Move it after, or `--start-group/--end-group`, or `-Wl,--trace` and `--why-extract` to see the linker's decisions.

### Q: A profile shows addresses instead of names in a vendor `.so`. Options?
`readelf -p .gnu_debuglink`, build-id + debuginfod, the vendor's debug package, or `symbols/` in an Android tree; `nm -D` shows exported names at least; `llvm-symbolizer --obj=file.debug`. If none exist, `perf annotate` still shows the instructions, and hot loops are recognizable.

### Q: What does `clang -###` tell you that `-v` does not?
The exact cc1 and linker command lines *without running them*: implied `-target-cpu`/`-target-feature`, default `-fpie`/`-ffp-contract`, the resource dir, the sysroot, the crt files. It is how `codegen/02`'s FMA surprise is explained (`-ffp-contract=on` is implied) and how a cross-compile setup is debugged.

---

## Sources

- Clang: *Clang command line argument reference*; *Remarks* (`-Rpass`); *`-ftime-trace`* documentation; `clang -help` on this machine.
- LLVM: *Using the New Pass Manager* / `opt -passes` syntax; *LLVM Command Guide* (`llc`, `opt`, `llvm-mca`, `llvm-symbolizer`, `llvm-objdump`, `llvm-readelf`, `llvm-dwarfdump`, `llvm-reduce`); *OptBisect* documentation.
- Binutils manuals (`readelf`, `objdump`, `nm`, `objcopy`); `perf` man pages; Ninja manual (`-t` tools, `-d explain`).
- AOSP documentation: *Soong build system*, *simpleperf* README and `report_html.py`/`app_profiler.py` docs. (Android sections are not executed on the lab machine.)
- Lab labs: `ir/`, `cross_level/`, `perf/03`, `codegen/*`, `bigcode/*`, `aarch64/*`.
