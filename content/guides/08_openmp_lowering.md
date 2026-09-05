<!--
category: LLVM & Compiler Infrastructure
tags: OpenMP, Clang, Flang, MLIR, FIR, HLFIR, OMPIRBuilder, libomp, Outlining, Fork-Join, Tasks, Data-Sharing, Reductions, Offloading
difficulty: Advanced
readTime: 70 min
-->

# OpenMP Lowering End-to-End: Clang & Flang — Complete Deep Dive

> [!IMPORTANT]
> **TL;DR — what you must remember:** OpenMP is *not* a code generator; it is a **runtime-call contract**. Both frontends — **Clang** (C/C++) and **Flang** (Fortran) — take a parallel region, **outline** its body into a separate function, and replace the directive with **calls into a runtime library (libomp)** whose functions are all named `__kmpc_*`. A `#pragma omp parallel` becomes `__kmpc_fork_call(loc, argc, microtask, captured_vars...)`; the runtime spawns a team of threads and each one calls `microtask`. **Shared** data is passed by pointer (one copy, all threads see it); **private** data is a fresh local in the outlined function; **firstprivate** copies in; **lastprivate** copies out; **reduction** gives each thread a private copy then combines them with `__kmpc_reduce`. **Tasks** package the body + its captured data into a heap `kmp_task_t` struct and hand it to `__kmpc_omp_task` for deferred execution. Clang emits these calls directly from its AST in `CGStmtOpenMP.cpp`/`CGOpenMPRuntime.cpp`; Flang lowers to the **MLIR `omp` dialect** sitting on top of **FIR/HLFIR**, and the MLIR→LLVM translation drives the shared **`OpenMPIRBuilder`** to emit the very same `__kmpc_*` calls. Two roads, one destination: **libomp**.

---

# PART 0 — TERMINOLOGY (read this first)

Every acronym and term used in this document, with its **full form**, **what it is**, and a **tiny example**. Skim it now, refer back as needed.

| Term | Full form | What it is | Example |
|---|---|---|---|
| **OpenMP** | Open Multi-Processing | A directive-based standard for shared-memory parallelism (pragmas/directives + a runtime library + environment variables). | `#pragma omp parallel for` |
| **AST** | Abstract Syntax Tree | The tree the parser builds from source; the compiler's first structured representation of the program. | `parallel` directive node holding a loop child |
| **IR** | Intermediate Representation | Any in-between form between source and machine code. | LLVM IR, FIR, MLIR |
| **LLVM IR** | (historically "Low Level Virtual Machine") | A typed, SSA-form, RISC-like instruction set that all LLVM backends consume. | `%2 = add i32 %0, %1` |
| **SSA** | Static Single Assignment | IR property: each value is assigned exactly once. (See doc 01.) | `%x1 = ...; %x2 = ...` |
| **MLIR** | Multi-Level Intermediate Representation | A framework for building IRs out of *dialects* (namespaced op sets) that can coexist and lower into each other. | `omp.parallel { ... }` |
| **Dialect** | — | A self-contained set of MLIR operations/types under one namespace. | `omp.`, `fir.`, `hlfir.`, `llvm.`, `arith.` |
| **FIR** | Fortran IR | Flang's lower-level MLIR dialect: explicit memory, references, descriptors. | `fir.alloca i32`, `fir.load` |
| **HLFIR** | High-Level Fortran IR | Flang's *higher-level* dialect that keeps Fortran semantics (assignments, array expressions) before they're broken down into FIR. | `hlfir.assign %v to %x` |
| **PFT** | Pre-FIR Tree | Flang's lowering-oriented tree built from the parse tree; what the "lowering bridge" walks. | an evaluation list per construct |
| **Outlining** | — | Extracting a region's body into a *new function* so the runtime can call it (on many threads, or later as a task). | body of `parallel` → `.omp_outlined.` |
| **Fork-Join** | — | OpenMP's execution model: one thread *forks* a team, they run in parallel, then *join* back to one. | `parallel` region |
| **Team** | — | The group of threads that execute a parallel region together. | 8 threads for `num_threads(8)` |
| **League** | — | A set of *teams* created by a `teams` construct (typically on a GPU). | one team per GPU block |
| **Task** | — | A unit of deferred work: code + its data environment, schedulable later by any thread. | `#pragma omp task` |
| **DSA** | Data-Sharing Attribute | Whether a variable is `shared`, `private`, `firstprivate`, `lastprivate`, `reduction`, etc., inside a region. | `private(i) shared(a)` |
| **ICV** | Internal Control Variable | Hidden runtime state controlling defaults (thread count, schedule, nesting). | *nthreads-var* set by `OMP_NUM_THREADS` |
| **RTL** | Run-Time Library | The library implementing the `__kmpc_*` functions: **libomp** (a.k.a. libiomp5/libgomp-compatible). | links with `-fopenmp` |
| **libomp** | LLVM OpenMP runtime | LLVM's implementation of the RTL. | `__kmpc_fork_call` lives here |
| **kmp / `__kmpc`** | "Kuck & Associates MP" (historical, Intel lineage); `c` = C interface | The naming prefix of every RTL entry point. | `__kmpc_barrier` |
| **GTID** | Global Thread ID | The runtime's integer id for the calling thread within the contention group. | obtained via `__kmpc_global_thread_num` |
| **`ident_t`** | identity / source-location struct | A small struct describing the source location & flags passed to nearly every `__kmpc_*` call. | `{i32,i32,i32,i32, i8* ";file;func;line;..."}` |
| **microtask** | — | The function-pointer type the runtime calls per thread: `void(i32* gtid, i32* bound, ...)`. | the outlined parallel body |
| **`kmp_task_t`** | kmp task struct | The heap object describing a task: a pointer to captured data + the routine to run. | allocated by `__kmpc_omp_task_alloc` |
| **OMPIRBuilder** | OpenMP IR Builder | Shared LLVM library (`llvm/lib/Frontend/OpenMP/OMPIRBuilder.cpp`) that knows how to emit each construct's IR + runtime calls. | `createParallel`, `createTask` |
| **CodeExtractor** | — | LLVM utility that lifts a set of basic blocks into a new function; OMPIRBuilder uses it for outlining. | extracts the parallel body |
| **SPMD** | Single Program Multiple Data | A GPU execution mode where all threads run the same kernel from the start (no sequential prologue). | target offload kernels |
| **SIMD** | Single Instruction Multiple Data | Vectorized execution of one instruction over a vector of data. | `#pragma omp simd` |
| **TLS** | Thread-Local Storage | Per-thread global storage. | `threadprivate` variables |
| **libomptarget** | — | The offloading runtime that launches `target` regions on devices (GPUs). | `__tgt_target_kernel` |

> [!NOTE]
> **The single most important mental model:** OpenMP lowering = *outline the body* + *call the runtime*. Everything else (data sharing, scheduling, nesting, tasks) is bookkeeping around those two moves.

---

# PART 1 — THE OPENMP EXECUTION MODEL (the "what", before the "how")

Before touching compilers, understand what the generated code is *supposed to do*.

## 1.1 Fork-Join

```
   main thread (the "initial thread")
        │
        │   sequential
        ▼
   ┌──────────────┐  #pragma omp parallel  /  !$omp parallel
   │   FORK        │  runtime spawns a TEAM of N threads
   └──────────────┘
    │   │   │   │
    ▼   ▼   ▼   ▼      all run the SAME outlined body in parallel
   T0  T1  T2  T3
    │   │   │   │
   ┌──────────────┐
   │   JOIN        │  implicit barrier; team folds back to 1 thread
   └──────────────┘
        │
        ▼
   main thread continues sequentially
```

- The thread that hit the directive is the **master/primary** of the new team (it becomes T0).
- At region exit there is an **implicit barrier** (unless `nowait` applies to a worksharing region inside).

## 1.2 The three kinds of parallelism

1. **Thread-level (teams of threads):** `parallel`, `for`/`do`, `sections`, `single`. A team of threads, work split among them.
2. **Task-level:** `task`, `taskloop`. Work packaged as objects, executed *whenever* by *whatever* thread is free. Good for irregular/recursive work.
3. **Device/accelerator + vector:** `target` (offload to GPU), `teams`/`distribute` (league of teams), `simd` (vectorize within one thread).

## 1.3 The data environment

When you enter a region, each variable gets a **data-sharing attribute (DSA)**:

| DSA | Meaning | Storage reality |
|---|---|---|
| `shared` | one instance, visible to all threads | passed **by pointer**; everyone dereferences the same address |
| `private` | each thread its own, **uninitialized** | a fresh local (`alloca`) per thread |
| `firstprivate` | private, **initialized** from the original | local + a **copy-in** at entry |
| `lastprivate` | private, and the **last iteration's value copied back** | local + a **copy-out** at exit (guarded) |
| `reduction(op:x)` | private per thread, **combined** with `op` at the end | local + a **combine** step (`__kmpc_reduce`) |
| `threadprivate` | a global that is **per-thread** | TLS / runtime cache |

## 1.4 Internal Control Variables (ICVs)

Hidden runtime knobs. You never see them as variables; the runtime reads them.

| ICV | Controls | Set by |
|---|---|---|
| *nthreads-var* | default team size | `OMP_NUM_THREADS`, `omp_set_num_threads()`, `num_threads()` clause |
| *run-sched-var* | default loop schedule | `OMP_SCHEDULE`, `schedule()` clause |
| *max-active-levels-var* | how deep nested parallelism may go | `OMP_MAX_ACTIVE_LEVELS`, `omp_set_max_active_levels()` |
| *dyn-var* | may runtime adjust thread count? | `OMP_DYNAMIC` |
| *levels-var* / *active-levels-var* | current nesting depth | runtime-maintained |

---

# PART 2 — THE BIG PICTURE (both frontends, one destination)

```
 C / C++ source                                Fortran source
      │                                              │
      ▼                                              ▼
 ┌─────────────┐                              ┌──────────────────┐
 │  Clang      │  Preprocess → Parse →        │  Flang           │  Prescan → Parse →
 │  frontend   │  Sema builds AST with        │  frontend        │  Semantics (symbols,
 │             │  OMPExecutableDirective +    │                  │  OpenMP checks) → PFT
 │             │  OMPClause + CapturedStmt    │                  │
 └─────────────┘                              └──────────────────┘
      │                                              │
      │ CodeGen (CGStmtOpenMP.cpp,                   │ Lowering bridge (flang/lib/Lower/OpenMP/*)
      │ CGOpenMPRuntime.cpp):                        │ builds MLIR:  omp.* ops  on top of
      │ OUTLINE bodies, emit __kmpc_* calls          │ HLFIR/FIR    e.g. omp.parallel { omp.wsloop }
      ▼                                              ▼
      │                                       ┌──────────────────┐
      │                                       │ HLFIR → FIR →     │  conversion passes
      │                                       │ LLVM dialect      │  (Pipelines.cpp)
      │                                       └──────────────────┘
      │                                              │
      │                                       OpenMPToLLVMIRTranslation.cpp
      │                                       drives ↓
      │     ┌───────────────────────────────────────────────────────┐
      └────▶│           LLVM  OpenMPIRBuilder  (SHARED)               │◀──── flang uses it fully;
            │  createParallel / createTask / createReductions / ...   │      clang uses it for a
            │  outlining (CodeExtractor) + __kmpc_* call emission      │      growing subset + RTL decls
            └───────────────────────────────────────────────────────┘
                                  │
                                  ▼
                       LLVM IR with calls to __kmpc_fork_call,
                       __kmpc_for_static_init_4, __kmpc_omp_task, ...
                                  │
                          opt / codegen backend
                                  │
                                  ▼
                          object file  (.o)
                                  │
                       link with  -fopenmp  ⇒  libomp.so
                                  │
                                  ▼
                          parallel executable
```

> [!IMPORTANT]
> **The genuinely shared layer is the libomp ABI** — the exact set/signatures of `__kmpc_*` functions. `OpenMPIRBuilder` is shared *infrastructure*: **Flang always** goes through it (via the MLIR translation), while **Clang** emits most constructs directly in `CGOpenMPRuntime` and uses `OMPIRBuilder` mainly to declare/look up runtime functions and for an expanding subset of constructs (e.g. under `-fopenmp-enable-irbuilder`). Different code paths, identical runtime contract.

---

# PART 3 — THE CLANG PIPELINE (C/C++) IN DEPTH

## 3.1 Source → AST: how a directive is represented

Clang's `Sema` (semantic analyzer) builds dedicated AST nodes:

- **`OMPExecutableDirective`** — base class; one subclass per directive: `OMPParallelDirective`, `OMPForDirective`, `OMPTaskDirective`, `OMPTargetDirective`, `OMPTeamsDirective`, …
- **`OMPClause`** — base for clauses: `OMPSharedClause`, `OMPPrivateClause`, `OMPFirstprivateClause`, `OMPReductionClause`, `OMPScheduleClause`, `OMPNumThreadsClause`, …
- **`CapturedStmt` + `CapturedDecl`** — the *body* of the region is wrapped in a `CapturedStmt`. This is the key trick: Sema figures out **which variables the body uses from the enclosing scope** and records them as *captures*. The `CapturedStmt` is what later becomes the outlined function, and the capture list is what becomes its arguments.

Sema also **pre-computes helper expressions** for clauses. For example, for `reduction` and `linear` it synthesizes the *init*, *combiner/update*, and *final* expressions as AST nodes, so CodeGen just emits them. (You saw this in the linear deep-dive: `C->inits()`, `C->updates()`, `C->finals()`.)

```cpp
#pragma omp parallel for reduction(+:sum) firstprivate(base)
for (int i = 0; i < n; ++i) sum += a[i] + base;
```
AST (sketch):
```
OMPParallelForDirective
 ├─ OMPReductionClause(+ : sum)         // with init(sum=0), combiner(lhs+=rhs)
 ├─ OMPFirstprivateClause(base)         // with copy-init expr
 └─ CapturedStmt                        // body; captures: sum(byref), base(byref), a, n, i
      └─ ForStmt { sum += a[i] + base; }
```

## 3.2 AST → LLVM IR: CodeGen dispatch

Per-directive emission lives in **`clang/lib/CodeGen/CGStmtOpenMP.cpp`**, dispatched by `CodeGenFunction::EmitOMP<Directive>Directive`:

- `EmitOMPParallelDirective` (line ~2098) → `emitCommonOMPParallelDirective` (~1888)
- `EmitOMPForDirective` (~4471)
- `EmitOMPTaskDirective` (~5844)
- `EmitOMPTeamsDirective`, `EmitOMPTargetDirective`, …

The runtime-facing work (emitting `__kmpc_*` calls, building the outlined function, building `kmp_task_t`, etc.) lives in **`clang/lib/CodeGen/CGOpenMPRuntime.cpp`** (host) and **`CGOpenMPRuntimeGPU.cpp`** (device).

## 3.3 Outlining (the heart of it)

`emitOutlinedFunctionPrologue` (`CGStmtOpenMP.cpp:526`) creates a new `llvm::Function` whose parameters are exactly the captured variables (plus the two runtime-required leading params). The result for a `parallel` region is the **microtask**:

```llvm
; the outlined body — note the microtask signature
define internal void @.omp_outlined.(
        ptr noalias %global_tid,    ; &gtid  (kmp_int32*)
        ptr noalias %bound_tid,     ; &bound_tid (kmp_int32*)
        ptr %sum,                   ; captured SHARED 'sum'  (by pointer)
        ptr %a, i32 %n) {
   ; ... body, but with privatization applied (see Part 6) ...
}
```

`kmpc_micro` (the runtime's expected function-pointer type) is:
```c
typedef void (*kmpc_micro)(kmp_int32 *global_tid, kmp_int32 *bound_tid, ...);
```

## 3.4 Emitting the fork

`emitParallelCall` (`CGOpenMPRuntime.cpp:1981`) builds, conceptually:

```llvm
; loc = pointer to an ident_t describing this source location
; obtained near __kmpc_global_thread_num
call void (ptr, i32, ptr, ...) @__kmpc_fork_call(
        ptr @loc,                 ; ident_t*
        i32 3,                    ; argc: how many captured args follow
        ptr @.omp_outlined.,      ; the microtask
        ptr %sum, ptr %a, i32 %n) ; captured args
```

`__kmpc_fork_call` signature:
```c
void __kmpc_fork_call(ident_t *loc, kmp_int32 argc, kmpc_micro microtask, ...);
```
The runtime grabs `N` threads from its pool, and **each thread calls `microtask(&its_gtid, &zero, sum, a, n)`**. That's the fork. The join (implicit barrier) is handled inside the runtime when `__kmpc_fork_call` returns.

> [!NOTE]
> **`ident_t`** is the ubiquitous first argument. It carries source location + flags so the runtime can produce diagnostics/OMPT events. Roughly:
> ```c
> typedef struct ident { int reserved_1; int flags; int reserved_2;
>                        int reserved_3; char const *psource; } ident_t;
> ```

## 3.5 Serialized (else) path

If the region runs serially (e.g. `if(0)`, or nesting disabled), Clang emits the **else** branch (`emitParallelCall`'s `ElseGen`): bracket with `__kmpc_serialized_parallel` / `__kmpc_end_serialized_parallel` and call the microtask **directly** with the current gtid and a zero bound-tid. Same outlined function, no new threads.

---

# PART 4 — THE FLANG PIPELINE (Fortran) IN DEPTH

## 4.1 Frontend stages (source → MLIR)

```
.f90 ──▶ Prescan ──▶ Parse ──▶ Semantics ──▶ PFT ──▶ Lowering bridge ──▶ MLIR (HLFIR/FIR + omp)
         (fixed/    (parse     (symbol        (Pre-   (flang/lib/Lower/...)
          free      tree)      table +        FIR
          form,                OpenMP         Tree)
          includes,            checks:
          OpenMP                check-omp-*.cpp)
          sentinels)
```

- **Prescan:** handles fixed/free form, continuation lines, include files, and recognizes OpenMP sentinels (`!$omp`).
- **Semantics:** builds the **symbol table** and runs OpenMP-specific checks (`flang/lib/Semantics/check-omp-*.cpp`) — e.g. legal clause combinations, DSA rules, the `linear` restrictions discussed elsewhere.
- **PFT (Pre-FIR Tree):** a lowering-friendly tree of "evaluations" the bridge walks.
- **Lowering bridge:** `flang/lib/Lower/` (OpenMP parts in `flang/lib/Lower/OpenMP/`) emits MLIR.

## 4.2 The MLIR `omp` dialect (the representation Flang targets)

Instead of immediately outlining, Flang emits **structured `omp` dialect ops with regions** sitting on top of HLFIR/FIR:

| `omp` op | Directive |
|---|---|
| `omp.parallel` | `parallel` |
| `omp.wsloop` + `omp.loop_nest` | worksharing `do` |
| `omp.simd` | `simd` |
| `omp.sections` / `omp.section` | `sections` |
| `omp.single` | `single` |
| `omp.task` / `omp.taskgroup` | `task` |
| `omp.teams` / `omp.distribute` | `teams` / `distribute` |
| `omp.target` (+ `omp.map.info`) | `target` |
| `omp.critical`, `omp.barrier`, `omp.atomic.*`, `omp.ordered` | sync |
| `omp.private`, `omp.declare_reduction` | data-sharing helpers |

Dispatch is in `flang/lib/Lower/OpenMP/OpenMP.cpp` via **`genOMPDispatch`** (line ~4016), switching on the directive to `genStandaloneParallel`→`genParallelOp` (~2727), `genTaskOp` (~3314), `genSectionsOp` (~2762), `genTeamsOp` (~3412), `genTargetOp` (~3032), etc. Clause processing is in **`ClauseProcessor.cpp`**; data sharing in **`DataSharingProcessor.cpp`**.

Example — `!$omp parallel do`:
```mlir
omp.parallel {
  omp.wsloop {
    omp.loop_nest (%i) : i32 = (%c1) to (%n) inclusive step (%c1) {
      // ... HLFIR/FIR body referencing the loop body ...
      omp.yield
    }
  }
  omp.terminator
}
```

## 4.3 MLIR → LLVM IR: conversion + translation

1. **Conversion passes** lower HLFIR → FIR → the LLVM dialect (`flang/lib/Optimizer/Passes/Pipelines.cpp`; `fir::createFIRToLLVMPass`, `CodeGen.cpp`). The `omp.*` ops survive this (they are largely preserved until the very end).
2. **Translation to LLVM IR:** `mlir/lib/Target/LLVMIR/Dialect/OpenMP/OpenMPToLLVMIRTranslation.cpp` (registered by `registerOpenMPDialectTranslation`, `flang/lib/Optimizer/Support/InitFIR.cpp:20`) walks each `omp.*` op and **calls `OpenMPIRBuilder`** to emit the outlined function + `__kmpc_*` calls.

> [!IMPORTANT]
> This is the architectural difference that explains a lot of Flang's behavior (including the `linear` quirks): **Flang's region body is fully built (as MLIR) *before* outlining happens.** Outlining is done late, by `OMPIRBuilder` (using LLVM's `CodeExtractor`), at translation time. Clang, by contrast, outlines *as it generates* and can substitute privatized variables up front. Same runtime calls; very different timing.

---

# PART 5 — THE SHARED LAYER: OMPIRBuilder + libomp ABI

## 5.1 OpenMPIRBuilder public construct builders

`llvm/lib/Frontend/OpenMP/OMPIRBuilder.cpp` exposes one builder per construct (used by Flang's translation, and increasingly by Clang):

| Builder | Emits |
|---|---|
| `createParallel` (line ~1764) | outlining + `__kmpc_fork_call` |
| `createTask` (~2661) / `createTaskloop` (~2311) / `createTaskgroup` (~2950) | `kmp_task_t` + `__kmpc_omp_task*` |
| `createSections` (~2979) / `createSingle` (~7568) | worksharing + sync |
| `createReductions` (~4877) / `createReductionsGPU` (~4532) | `__kmpc_reduce` protocol |
| `createTeams` (~11508) | league creation |
| `createBarrier` (~1222) / `createCritical` (~7671) / `createMasked` (~5054) / `createOrderedThreadsSimd` (~7752) | synchronization |
| `createCanonicalLoop` (~5479) | the loop the worksharing/`simd` machinery operates on |

`createParallel` internally uses **`CodeExtractor`** to lift the region's blocks into the outlined microtask, then wires up the `__kmpc_fork_call`.

## 5.2 The libomp call vocabulary (the contract both frontends honor)

| Runtime call | Purpose |
|---|---|
| `__kmpc_global_thread_num(loc)` | get this thread's **GTID** |
| `__kmpc_fork_call(loc, argc, microtask, ...)` | **fork** a parallel region |
| `__kmpc_fork_teams(loc, argc, microtask, ...)` | fork a **league of teams** |
| `__kmpc_serialized_parallel` / `__kmpc_end_serialized_parallel` | run a region serially |
| `__kmpc_for_static_init_4/8(...)` / `__kmpc_for_static_fini` | **static** loop scheduling |
| `__kmpc_dispatch_init_4` / `__kmpc_dispatch_next_4` / `__kmpc_dispatch_fini_4` | **dynamic/guided** scheduling |
| `__kmpc_omp_task_alloc` / `__kmpc_omp_task` | allocate + enqueue a **task** |
| `__kmpc_omp_task_with_deps` | task with **dependencies** |
| `__kmpc_omp_task_begin_if0` / `__kmpc_omp_task_complete_if0` | run an **undeferred** task inline |
| `__kmpc_taskgroup` / `__kmpc_end_taskgroup`, `__kmpc_omp_taskwait` | task synchronization |
| `__kmpc_barrier(loc, gtid)` | **barrier** |
| `__kmpc_critical[_with_hint]` / `__kmpc_end_critical` | **critical** section |
| `__kmpc_master` / `__kmpc_end_master`, `__kmpc_masked` / `__kmpc_end_masked` | **master/masked** |
| `__kmpc_reduce[_nowait]` / `__kmpc_end_reduce[_nowait]` | **reduction** combine |
| `__kmpc_push_num_threads(loc, gtid, n)` | implement `num_threads(n)` |
| `__kmpc_threadprivate_cached` | **threadprivate** access |

The function enum/definitions live in `llvm/include/llvm/Frontend/OpenMP/OMPKinds.def` (e.g. `OMPRTL___kmpc_fork_call`), and `getOrCreateRuntimeFunction` materializes the declaration.

---

# PART 6 — DATA SHARING IN DEPTH (the trickiest part)

This is where most of the real work is. Same six attributes, two implementations.

## 6.1 `shared` — one instance for everyone

- **Clang:** the variable is a **capture by reference** in the `CapturedStmt`. The outlined function receives a **pointer**; all threads dereference the same address.
- **Flang:** the variable is *not* privatized; the body simply uses its original address (which, inside the `omp.parallel` region, all threads resolve to the same storage).

```llvm
; shared 'sum' is just a pointer arg to the microtask — all threads write *sum
define internal void @.omp_outlined.(ptr %gtid, ptr %bound, ptr %sum, ...) {
  ; ... *sum updated under a reduction/critical/atomic to stay correct ...
}
```

## 6.2 `private` — fresh, uninitialized, per thread

- **Clang:** inside the outlined function, emit a **new `alloca`** for the variable and **remap** references to it via an `OMPPrivateScope` (`PrivateScope.addPrivate(VD, newAddr)`), so the body uses the local from the first instruction. Nothing is copied.
- **Flang:** the `DataSharingProcessor` creates an **`omp.private`** op (delayed privatization) or clones the host variable, and the privatized symbol becomes a **block argument** of the region. The runtime allocates one per thread.

```mlir
// Flang: delayed privatization attaches a privatizer + block arg
omp.private {type = private} @i.privatizer : i32
omp.parallel private(@i.privatizer %i -> %arg0 : !fir.ref<i32>) {
   // body uses %arg0 (the private copy)
}
```

## 6.3 `firstprivate` — private + copy-in

Private storage, **initialized from the original's value** at region entry.

- **Clang:** `alloca` + an init that reads the captured original (`EmitOMPFirstprivateClause`). For class types, the copy-constructor is called.
- **Flang:** `omp.private {type = firstprivate}` whose **`copy` region** performs the copy-in; `DataSharingProcessor::copyFirstPrivateSymbol` → `copyHostAssociateVar`.

## 6.4 `lastprivate` — private + copy-out

Private during the loop; after the loop, the value from the thread that ran the **sequentially last iteration** is **written back** to the original.

- **Clang:** after the worksharing loop, in a block guarded by "did I run the last iteration?", copy the private back to the original (`EmitOMPLastprivateClauseFinal`). The runtime's `*plast` flag from `__kmpc_for_static_init` tells the thread whether it had the last chunk.
- **Flang:** `copyLastPrivateSymbol` / `copyHostAssociateVar(..., hostIsSource=false)` at the guarded last-iteration insertion point.

## 6.5 `reduction` — private + combine

Each thread reduces into its **own** copy; at the end all copies are **combined** with the operator (`+`, `*`, `max`, user-defined, …).

The libomp **reduction protocol** (Clang: `CGOpenMPRuntime.cpp:~5362`; Flang/OMPIRBuilder: `createReductions`):

```c
// per-thread privates live in a RedList array of pointers
switch (__kmpc_reduce_nowait(loc, gtid, n, sizeof(RedList), &RedList,
                             reduce_func, &lock)) {
case 1:                         // this thread does the combine under a lock
    *shared = *shared OP *priv; // (the reduce_func body)
    __kmpc_end_reduce_nowait(loc, gtid, &lock);
    break;
case 2:                         // combine atomically (no lock needed)
    atomic: *shared OP= *priv;
    break;
default:                        // 0: nothing to do for this thread
    break;
}
```
- `reduce_func` is a generated function that, given two `RedList`s, applies the operator element-wise.
- **Flang** represents the operator as **`omp.declare_reduction`** (with `init`, `combiner`, optional `atomic` regions); the loop carries `reduction(@decl %x -> %arg : ...)` operands, and `createReductions` emits the same protocol.

## 6.6 `threadprivate` & `copyin`

- **`threadprivate(g)`** makes a *global* per-thread. Clang routes accesses through `__kmpc_threadprivate_cached` (or native TLS where available).
- **`copyin(g)`** broadcasts the master thread's `threadprivate` value to all threads at parallel entry.

## 6.7 `default(none|shared|private|firstprivate)`

Sets the *implicit* DSA for variables not explicitly listed. `default(none)` forces you to classify every variable — a common correctness aid. This is resolved during **semantics** (both frontends) before lowering.

---

# PART 7 — PARALLEL FORK/JOIN MECHANICS (zoomed in)

End-to-end for `#pragma omp parallel num_threads(4) shared(a) private(t)`:

```
1. gtid = __kmpc_global_thread_num(loc)
2. __kmpc_push_num_threads(loc, gtid, 4)          ; honor num_threads(4)
3. __kmpc_fork_call(loc, 1, @.omp_outlined., a)    ; a is shared (by ptr)
        │
        └── runtime gives the team 4 threads; each calls:
            @.omp_outlined.(&my_gtid, &zero, a) {
               %t = alloca i32          ; 'private t' — one per thread
               ... use *a (shared) and %t (private) ...
               ; implicit barrier inside runtime on return
            }
4. fork_call returns once all threads joined (implicit barrier)
```

Key facts:
- **Thread reuse:** libomp keeps a **thread pool**; "spawning" a team usually means *waking pooled threads*, not creating OS threads each time.
- **`num_threads`** is a *request*; the runtime may give fewer (subject to `dyn-var`, resource limits).
- The **bound_tid** (second microtask arg) is used for nested-region bookkeeping.

---

# PART 8 — WORKSHARING LOOPS & SCHEDULING

A `for`/`do` inside a parallel region **divides iterations among the existing team** (it does *not* fork). The split is the **schedule**.

## 8.1 Static schedule (default; compile-time-ish division)

```c
// lb/ub = this thread's lower/upper bound; computed by the runtime
__kmpc_for_static_init_4(loc, gtid, kmp_sch_static, &is_last,
                         &lb, &ub, &stride, /*incr=*/1, /*chunk=*/chunk);
for (i = lb; i <= ub; i += 1) { /* loop body */ }
__kmpc_for_static_fini(loc, gtid);
```
- **Static** = each thread's iteration range is decided once, no runtime coordination per chunk → low overhead, great for balanced loops.
- `is_last` (the `&plast` flag) tells a thread if it owns the last iteration — used for **lastprivate** copy-out.

## 8.2 Dynamic / guided (runtime hands out chunks on demand)

```c
__kmpc_dispatch_init_4(loc, gtid, kmp_sch_dynamic_chunked, lb, ub, 1, chunk);
while (__kmpc_dispatch_next_4(loc, gtid, &is_last, &lb, &ub, &stride)) {
    for (i = lb; i <= ub; i += 1) { /* body */ }
}
__kmpc_dispatch_fini_4(loc, gtid);
```
- **Dynamic** = threads grab the next chunk when they finish their current one → balances irregular work, higher overhead.
- **Guided** = like dynamic but chunk sizes shrink over time.

## 8.3 `sections` and `single`

- **`sections`:** a worksharing construct where each `section` block is given to one thread. Lowered with the sections/single runtime helpers (`createSections`, `__kmpc_*` section dispatch).
- **`single`:** exactly one thread runs the block; others skip to the implicit barrier (`createSingle` / `__kmpc_single`/`__kmpc_end_single`).

---

# PART 9 — NESTED PARALLEL REGIONS

A `parallel` inside a `parallel`. Each level is just **another `__kmpc_fork_call`** — but whether it *actually* creates new threads depends on ICVs.

```
parallel (outer)  ──fork──▶  T0 T1            ; outer team, level 1
                                │
                  each Ti hits inner "parallel":
                  __kmpc_fork_call again       ; level 2
                                │
            if (active-levels < max-active-levels-var)
                ──▶ inner team actually spawns (nested parallelism)
            else
                ──▶ runs SERIALIZED (team of 1)  ; __kmpc_serialized_parallel
```

- **Outlining nests naturally:** the inner region's body is outlined into its *own* microtask, emitted inside the outer outlined function. Captures from the outer scope flow in as args.
- **ICVs that gate it:** *max-active-levels-var* (set by `OMP_MAX_ACTIVE_LEVELS` / `omp_set_max_active_levels`; the older `nest-var`/`OMP_NESTED` is deprecated). If depth exceeds the limit, the inner region is serialized.
- **`levels-var` / `active-levels-var`** track current depth so the runtime can decide.
- **"Hot teams"** is a libomp optimization that *keeps nested teams warm* (pooled per level) to avoid repeated thread setup/teardown.

> [!NOTE]
> From the **compiler's** point of view, nesting is trivial: emit a fork inside a fork. All the "should this really spawn threads?" intelligence lives in the **runtime**, driven by ICVs. The compiler just always emits the fork (plus the serialized fallback path).

---

# PART 10 — TASK-BASED PARALLELISM

Tasks decouple *creating* work from *running* it. A task = **code + a snapshot of its data**, placed on a queue, run later by any thread.

## 10.1 The `kmp_task_t` object

Clang builds (in `CGOpenMPRuntime.cpp:~3077`) two records:
```c
typedef struct kmp_task_t {
    void              *shareds;   // pointer to the captured-shared data
    kmp_routine_entry_t routine;  // the task entry function to run
    kmp_int32          part_id;
    // ... runtime-internal fields ...
} kmp_task_t;

// firstprivates (copied by value) are appended after the task_t:
struct kmp_task_t_with_privates { kmp_task_t task_data; /* privates... */ };
```
- **`shareds`** points at shared data (so updates are visible outside) — passed **by pointer**.
- **firstprivate** task data is **copied by value** into the appended privates region (a snapshot) — because the task may run *after* the creating scope is gone.

## 10.2 Allocate, fill, enqueue

```c
// 1) allocate the task (runtime owns the memory)
kmp_task_t *task = __kmpc_omp_task_alloc(loc, gtid, flags,
                       sizeof(kmp_task_t_with_privates),
                       sizeof(shareds), &.omp_task_entry.);
// 2) copy captured data into task->shareds / privates
//    (inline copies, or a generated __task_dup_entry / cpyfn)
// 3) enqueue for deferred execution
__kmpc_omp_task(loc, gtid, task);
```

The **task entry** (`.omp_task_entry.`, the `kmp_routine_entry_t`) is a proxy that unpacks `kmp_task_t` and calls the real outlined body:
```c
kmp_int32 .omp_task_entry.(kmp_int32 gtid, kmp_task_t *tt) {
    .omp_outlined.(gtid, tt->part_id, tt->shareds, /*privates*/...);
    return 0;
}
```

## 10.3 Undeferred / `if(0)` / `final` tasks

If the task must run immediately (`if(0)`, or `final` chains), it's run **inline**:
```c
__kmpc_omp_task_begin_if0(loc, gtid, task);
.omp_task_entry.(gtid, task);              // run right here
__kmpc_omp_task_complete_if0(loc, gtid, task);
```
- **`final(expr)`:** if true, this task and all its descendants run immediately (no further deferral).
- **`mergeable`:** the runtime *may* reuse the parent's data environment.
- **`tied` (default) vs `untied`:** a tied task, once started, stays on the same thread; an untied task may migrate.

## 10.4 Dependencies

`depend(in:a) depend(out:b)` builds a `kmp_depend_info[]` (each: base address, length, in/out/inout flag) and uses:
```c
__kmpc_omp_task_with_deps(loc, gtid, task, ndeps, dep_list, 0, NULL);
```
The runtime enforces ordering: a task with `in:a` waits for prior `out:a` tasks. This builds a **task dependency graph** at runtime.

## 10.5 Task synchronization

- **`taskwait`** (`__kmpc_omp_taskwait`): wait for *child* tasks of the current task.
- **`taskgroup`** (`__kmpc_taskgroup`/`__kmpc_end_taskgroup`): wait for *all descendant* tasks created in the group.

## 10.6 `taskloop`

A loop whose iterations are chopped into **tasks** (grain-size/num-tasks control the chunking). Lowered via `createTaskloop` / task machinery rather than the worksharing `__kmpc_for_static_init` path.

---

# PART 11 — TEAMS & TARGET OFFLOADING (devices/GPUs)

## 11.1 `teams` — a league

`#pragma omp teams` creates a **league** of teams (each team is itself a group of threads). On the host it's `__kmpc_fork_teams` (analogous to `fork_call`); on a GPU each team typically maps to a thread block.

```
teams (creates a LEAGUE)
 ├─ team 0  → distribute gives it a slice of the outer loop
 │    └─ parallel for  → threads within team 0 split that slice
 ├─ team 1 ...
 └─ team K
```
`distribute` is the **worksharing-across-teams** analog of `for` (which is worksharing-across-threads). The classic GPU idiom is `target teams distribute parallel for`.

## 11.2 `target` — offload to a device

```
host                                   device (GPU)
 │  build map list (omp.map.info /      ┌────────────────────────────┐
 │  __tgt_target_kernel)                │ device outlined kernel      │
 │  move mapped data H→D                │ (compiled for the GPU arch) │
 │  launch kernel ─────────────────────▶│  runs teams/threads         │
 │  move mapped data D→H                └────────────────────────────┘
 ▼
continue
```
- The body is outlined into a **device function**, compiled into a separate **device image** embedded in the binary.
- **libomptarget** (`__tgt_target_kernel`, `__tgt_target_data_begin/end`) launches kernels and moves data per the **`map` clauses** (`to`, `from`, `tofrom`, `alloc`).
- **Clang** device codegen: `CGOpenMPRuntimeGPU.cpp` (NVPTX/AMDGPU). **Flang** uses `omp.target` + `omp.map.info` ops and the same offloading entry points.
- **SPMD vs Generic mode:** SPMD = all GPU threads run the kernel from the start (no sequential prologue) — used when the structure allows; Generic mode has a master thread coordinate, more flexible but slower.

## 11.3 `map` clause vocabulary

| map type | Direction |
|---|---|
| `map(to: x)` | copy host→device on entry |
| `map(from: x)` | copy device→host on exit |
| `map(tofrom: x)` | both (default for scalars/arrays) |
| `map(alloc: x)` | allocate on device, no copy |

---

# PART 12 — SYNCHRONIZATION CONSTRUCTS

| Construct | Meaning | Lowering |
|---|---|---|
| `barrier` | all team threads wait | `__kmpc_barrier(loc, gtid)` (OMPIRBuilder `createBarrier`) |
| `critical` | mutual exclusion (named lock) | `__kmpc_critical[_with_hint]` / `__kmpc_end_critical` |
| `atomic` | a single memory op done atomically | LLVM `atomicrmw`/`cmpxchg` where possible, else `__kmpc_atomic_*` |
| `master` / `masked` | only primary / a chosen thread runs | `__kmpc_master`/`__kmpc_masked` (+ `end`) |
| `single` | exactly one thread runs (any) | `__kmpc_single`/`__kmpc_end_single` |
| `ordered` | enforce source order inside a loop | `__kmpc_ordered`/`__kmpc_end_ordered` (or `createOrderedThreadsSimd`) |
| `flush` | memory fence | LLVM `fence` / runtime flush |

> [!NOTE]
> **`atomic` vs `critical`:** `atomic` lowers to a *hardware* atomic instruction (cheap, single location); `critical` takes a *runtime lock* (general, can guard arbitrary code). Prefer `atomic` for simple `x op= e`.

---

# PART 13 — CLANG vs FLANG: SIDE BY SIDE

| Aspect | Clang (C/C++) | Flang (Fortran) |
|---|---|---|
| Directive in AST/IR | `OMPExecutableDirective` + `OMPClause` + `CapturedStmt` | MLIR `omp.*` ops over HLFIR/FIR |
| Where bodies live before outlining | `CapturedStmt` (captures pre-computed by Sema) | `omp.*` op **regions** |
| When outlining happens | **early**, during CodeGen (Clang controls it) | **late**, by `OMPIRBuilder`/`CodeExtractor` at MLIR→LLVM translation |
| Privatization mechanism | **decl remap** (`OMPPrivateScope`) — body emitted using the private copy from the start | `omp.private` ops + **block args** (`DataSharingProcessor`), often **delayed** to translation |
| Reduction representation | generated `reduce_func` + `__kmpc_reduce` | `omp.declare_reduction` (init/combiner/atomic regions) |
| Main source files | `CGStmtOpenMP.cpp`, `CGOpenMPRuntime.cpp`, `CGOpenMPRuntimeGPU.cpp` | `flang/lib/Lower/OpenMP/*`, `OpenMPToLLVMIRTranslation.cpp` |
| Uses `OMPIRBuilder`? | partly (RTL decls + growing subset; full under `-fopenmp-enable-irbuilder`) | **yes, always** (it's the only path) |
| Runtime target | **libomp** `__kmpc_*` | **libomp** `__kmpc_*` (identical) |

---

# PART 14 — CODE MAP (where to look)

**Clang (C/C++):**
- `clang/lib/CodeGen/CGStmtOpenMP.cpp` — per-directive `EmitOMP*Directive`, outlining prologue, clause emission.
- `clang/lib/CodeGen/CGOpenMPRuntime.cpp` — `emitParallelCall`, task building, scheduling, reductions, sync (host).
- `clang/lib/CodeGen/CGOpenMPRuntimeGPU.cpp` — device (NVPTX/AMDGPU) codegen.
- `clang/lib/Sema/SemaOpenMP.cpp` — clause/DSA checking, helper-expression synthesis.

**Flang (Fortran):**
- `flang/lib/Lower/OpenMP/OpenMP.cpp` — `genOMPDispatch`, `genParallelOp`, `genTaskOp`, `genTeamsOp`, `genTargetOp`, …
- `flang/lib/Lower/OpenMP/ClauseProcessor.cpp` — clause → op operands.
- `flang/lib/Lower/OpenMP/DataSharingProcessor.cpp` — privatization / DSA.
- `flang/lib/Semantics/check-omp-*.cpp` — semantic checks.

**Shared:**
- `llvm/lib/Frontend/OpenMP/OMPIRBuilder.cpp` — `createParallel`/`createTask`/`createReductions`/…
- `llvm/include/llvm/Frontend/OpenMP/OMPKinds.def` — the `__kmpc_*` runtime function table.
- `mlir/lib/Target/LLVMIR/Dialect/OpenMP/OpenMPToLLVMIRTranslation.cpp` — `omp.*` → LLVM IR (drives `OMPIRBuilder`).

---

# PART 15 — ONE EXAMPLE, FULLY TRACED

Source (C):
```c
#pragma omp parallel for reduction(+:sum) schedule(static)
for (int i = 0; i < n; ++i) sum += a[i];
```

**Clang path:**
1. Sema builds `OMPParallelForDirective` with an `OMPReductionClause(+:sum)`, a `CapturedStmt` (captures `sum` byref, `a`, `n`), and synthesized reduction init/combiner exprs.
2. `EmitOMPParallelDirective` → `emitCommonOMPParallelDirective` outlines the body into `@.omp_outlined.(ptr gtid, ptr bound, ptr sum, ptr a, i32 n)`.
3. Inside the outlined fn: a private `%sum.red = alloca i32` initialized to `0`; the loop is set up with `__kmpc_for_static_init_4` (static) and torn down with `__kmpc_for_static_fini`; body does `%sum.red += a[i]`.
4. After the loop: the `__kmpc_reduce_nowait` switch combines each thread's `%sum.red` into the shared `*sum`.
5. `emitParallelCall` emits `__kmpc_fork_call(loc, 3, @.omp_outlined., sum, a, n)`.
6. Backend → object; link `-fopenmp` → runs on libomp.

**Flang path (`!$omp parallel do reduction(+:sum)`):**
1. Lowering emits `omp.parallel { omp.wsloop reduction(@add_red %sum -> %arg ...) { omp.loop_nest ... } }` over HLFIR/FIR, with an `omp.declare_reduction @add_red`.
2. HLFIR→FIR→LLVM-dialect passes preserve the `omp.*` ops.
3. `OpenMPToLLVMIRTranslation` walks `omp.parallel`/`omp.wsloop` and calls `OMPIRBuilder::createParallel` (outline + `__kmpc_fork_call`) and `createReductions` (`__kmpc_reduce` protocol) and the static-schedule helpers.
4. Result: **the same `__kmpc_*` calls** as the Clang path. Same libomp, same behavior.

> [!IMPORTANT]
> If you remember one diagram, remember this: **AST/parse-tree → (outline the body) → (call `__kmpc_*`) → libomp.** Clang does the outlining early and by hand; Flang does it late via MLIR + `OMPIRBuilder`. The runtime contract is identical. Everything in this document is detail hung on that skeleton.

---

# APPENDIX — QUICK REVISION CHECKLIST

- [ ] OpenMP = directives + **runtime calls** (`__kmpc_*`) + ICVs. Not magic codegen.
- [ ] `parallel` ⇒ **outline body** + `__kmpc_fork_call`; each thread runs the microtask.
- [ ] **shared** = by pointer; **private** = fresh alloca; **firstprivate** = +copy-in; **lastprivate** = +copy-out; **reduction** = per-thread copy + `__kmpc_reduce`.
- [ ] Worksharing `for` splits iterations: **static** (`for_static_init`) vs **dynamic/guided** (`dispatch_next`).
- [ ] **Nesting** = fork inside fork; whether it really spawns is an **ICV** decision (`max-active-levels-var`), handled by the runtime.
- [ ] **Tasks** = `kmp_task_t` (shareds by ptr, firstprivate copied by value) → `__kmpc_omp_task`; deps via `__kmpc_omp_task_with_deps`; sync via `taskwait`/`taskgroup`.
- [ ] **target/teams** = offload + league; data moved per `map`; via libomptarget + device images.
- [ ] **Clang** outlines early (decl remap for privates); **Flang** lowers to MLIR `omp` dialect and outlines late via **OMPIRBuilder**. Both hit **libomp**.
