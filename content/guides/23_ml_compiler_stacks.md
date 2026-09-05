<!--
category: ML Compilers & GPU Systems
tags: PyTorch 2.0, Triton, MLIR, Mojo, XLA, AI Compilers
difficulty: Advanced
readTime: 45 min
-->

> [!IMPORTANT]
> **TL;DR — what you must remember:** Modern ML compilers lower a high-level graph to fused hardware kernels through a stack of IRs: **TF → XLA** (HLO), **PyTorch 2.0** (Dynamo → AOTAutograd → Inductor), **Triton** (block-level Python → PTX), and **MLIR** (the dialect-based meta-framework everything is converging on). The shared idea is **progressive lowering**, with **operator fusion** and **tiling** as the dominant performance wins.

## TensorFlow / XLA Pipeline

**The problem TF solves:** Python is too slow for production ML. You need to compile compute graphs to hardware.

**End-to-end:**
1. User writes Python using tf.keras or tf.function
2. `@tf.function` traces the Python code → produces a **computation graph** (dataflow graph of ops)
3. Graph is passed to **XLA (Accelerated Linear Algebra)** compiler
4. XLA represents computation in **HLO (High Level Operations)** IR — ops like dot, convolution, reduce
5. XLA runs optimization passes on HLO: op fusion, layout assignment (NCHW vs NHWC), buffer assignment
6. XLA lowers HLO → backend-specific code: LLVM IR for CPU, PTX for GPU, TPU assembly for TPU
7. For GPU: LLVM IR → NVPTX → PTX → SASS

**Key insight for interviews:** XLA's big contribution was **op fusion** — instead of launching a separate GPU kernel for every op (relu, then add, then multiply), fuse them into one kernel. Eliminates kernel launch overhead and intermediate memory round-trips. This is where most of the performance comes from.

**XLA's weakness:** It's a closed system, hard to extend, limited operator coverage. This is why the field moved toward more modular approaches.

---

## PyTorch 2.0 Compile Stack — Most Important for Qualcomm

This is what Rishabh told you to study. Here it is precisely.

**The problem PyTorch 2.0 solves:** PyTorch 1.x was eager mode only — every op executed immediately in Python. Fast for debugging, slow for production.

**End-to-end pipeline:**

**Stage 1 — TorchDynamo (Graph Capture)**
- Hooks into Python bytecode at the CPython level
- Intercepts Python execution and traces PyTorch operations
- Produces an **FX Graph** — a directed acyclic graph of PyTorch ops
- Key innovation: handles Python control flow (if/else, loops) by "guarding" — if the control flow condition changes, it retraces
- This is hard because Python is dynamic. TorchScript (the old approach) required you to annotate your code. Dynamo works on arbitrary Python.

**Stage 2 — AOT Autograd**
- Takes the FX graph (forward pass)
- Traces through the backward pass too (autograd graph)
- Produces a joint forward+backward graph
- This lets the compiler optimize both forward and backward together

**Stage 3 — TorchInductor (Code Generation)**
- The default backend for torch.compile
- Takes the FX graph
- Generates optimized code
- For CPU: generates C++ with OpenMP
- For GPU: generates **Triton kernels** (not CUDA directly — Triton as an intermediate)
- Key optimizations: operator fusion, memory layout optimization, persistent kernels

**Stage 4 — Triton (GPU Kernel Generation)**
- TorchInductor emits Triton Python code
- Triton compiles that → LLVM IR → PTX → SASS

**The key call:**
```python
model = torch.compile(model)  # That's it. Everything above happens automatically.
```

**What torch.export does (different from torch.compile):**
- torch.compile: dynamic, traces at runtime, good for training
- torch.export: fully static export for deployment, produces a portable FX graph with no Python runtime dependency, used for edge deployment

---

## Triton — The Most Important One for Both Interviews

**What problem Triton solves:**
- Writing high-performance CUDA kernels requires expert knowledge of memory hierarchies, warp scheduling, tensor cores
- Triton lets you write high-performance GPU kernels in Python with tile-based abstractions — the compiler handles the hardware details

**The core idea — tile-based programming:**
- Instead of thinking about individual threads (CUDA style), you think about **tiles** (blocks of data)
- You write operations on tiles: load a tile from memory, compute on it, store it back
- Triton compiler decides: how to map tiles to warps, how to use shared memory, how to issue async memory loads

**End-to-end pipeline:**
1. You write a Triton kernel in Python using `@triton.jit`
2. Triton frontend parses it → **Triton IR** (high level, tile operations)
3. Triton IR → **TritonGPU IR** (tile operations with explicit GPU resources: warps, shared memory layout)
4. TritonGPU IR → **LLVM IR** (via MLIR lowering chain)
5. LLVM IR → **PTX** (via NVPTX backend)
6. PTX → **SASS** (by PTXAS)

**Why Triton IR → TritonGPU IR is the interesting step:**
- This is where the compiler decides: how many warps per tile, what shared memory layout to use, when to insert `__syncthreads()`, how to pipeline memory loads with compute
- This is where most of Triton's performance comes from
- Bad decisions here = poor occupancy, bank conflicts, pipeline stalls

**Simple blocked matmul in Triton — what you need to know:**
```python
@triton.jit
def matmul_kernel(A, B, C, M, N, K, BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr):
    pid_m = tl.program_id(0)  # which tile row
    pid_n = tl.program_id(1)  # which tile col
    # load BLOCK_M x BLOCK_K tile of A
    # load BLOCK_K x BLOCK_N tile of B
    # accumulate dot product
    # store BLOCK_M x BLOCK_N tile to C
```
- `tl.program_id` = which tile this kernel instance handles (analogous to blockIdx in CUDA)
- Each kernel instance handles one output tile
- The compiler handles: shared memory staging, async prefetch, warp tiling within the block

**Triton vs CUDA:**
- CUDA: you control threads explicitly, shared memory explicitly, synchronization explicitly
- Triton: you control tiles, compiler handles thread/warp/shared memory mapping
- Triton is ~80-90% of hand-tuned CUDA performance with ~10% of the code complexity

---

## Mojo & Modular Platform — The New Entry

**What problem Mojo solves:**
- Python is the language of ML but it's slow. C++ is fast but painful. You currently need both (PyTorch: Python frontend, C++ backend).
- Mojo is designed to be a single language that spans the full stack — as easy as Python, as fast as C++/CUDA.

**Key language features relevant to compilers:**
- `@parameter` — compile-time metaprogramming, like C++ templates but cleaner
- `@always_inline` — explicit inlining control
- SIMD type is a first-class language primitive — `SIMD[DType.float32, 8]` is a vector of 8 floats
- `fn` vs `def` — `fn` is strict (no dynamic typing, must declare types), `def` is Python-compatible
- Memory ownership: borrow checker concepts (owned, borrowed, inout) — closer to Rust than Python

### The Mojo Compilation Pipeline — Under the Hood

Unlike Triton, which is heavily coupled to the GPU execution model, Mojo uses a more general **Modular IR (Mojo IR)** based on MLIR.

1.  **Mojo AST → Mojo IR**: High-level representations of Mojo-specific constructs (lifetimes, borrowing, `@parameter`).
2.  **K-IR (Kernel IR)**: A Modular-specific MLIR dialect that handles aggressive loop tiling, fusion, and memory management. This is where "tiling" (like Triton) happens, but it can target any hardware.
3.  **Lowering to LLVM IR**: Standard MLIR lowering passes, but with Modular's custom optimizations for SIMD and hardware acceleration.
4.  **MAX Engine & ASIC Dialects**: MAX acts as a graph compiler that talks to these kernels. It's hardware-agnostic because it lowers to a set of universal "ASIC dialects" which then get specialized for NVIDIA (NVPTX), AMD (AMDGCN), or custom TPUs (like Qualcomm’s AI Engine).

**How it differs from Triton:** 
Triton is "Tile-Centric" — you write the tile logic. Mojo is "Language-Centric" — you write code, and the compiler *automates* the tiling and parallelization across diverse backends (CPU, GPU, etc.) using its tiered MLIR stack.

**The Modular platform / MAX:**
- MAX (Modular Accelerated Execution) is their inference engine
- Takes models (PyTorch, ONNX, etc.) → compiles to optimized code for CPU, GPU, or custom hardware
- Uses Mojo as the kernel language — you write custom ops in Mojo, MAX compiles them
- The compiler stack: model graph → Modular IR (MLIR-based) → hardware-specific codegen

**End-to-end inference pipeline with Mojo/MAX:**
1. Load model (ONNX or PyTorch)
2. MAX graph compiler optimizes: op fusion, memory planning, layout transforms
3. Mojo kernels are compiled for target hardware (uses LLVM/MLIR underneath)
4. Runtime executes the optimized plan

**Why it matters vs existing options:**
- vs PyTorch: MAX claims significantly faster inference (2-40x depending on workload) because the compiler can optimize across op boundaries that PyTorch can't
- vs TensorRT: more flexible, hardware-agnostic (not NVIDIA-only)
- vs Triton: Mojo is a full language, Triton is domain-specific for GPU kernels
- The bet: if ML code eventually needs to be written once and run everywhere efficiently, Mojo + MAX is the answer

**What you should know for Qualcomm specifically:**
- Qualcomm's MLIR-based compiler maps Triton kernels to Hexagon DSP
- The lowering chain is exactly what Mojo/MAX also does — model graph → MLIR dialects → target ISA
- The concepts are the same, just the target is Hexagon instead of CUDA

---

## MLIR — The Unifying Infrastructure

Everything above (Triton, TF/XLA's next gen, Mojo, Qualcomm's compiler) converges on MLIR. You need this cold.

**What MLIR is:**
- Multi-Level Intermediate Representation
- A framework for building compilers, not a compiler itself
- Key idea: instead of one IR with one abstraction level, you have **dialects** — each dialect is an IR for a specific abstraction level

**Key dialects to know:**

| Dialect | Abstraction Level | What it represents |
|---|---|---|
| `linalg` | High | Named compute ops (matmul, conv) on tensors |
| `affine` | Medium-high | Loop nests with affine bounds, polyhedral model |
| `scf` | Medium | Structured control flow (for, if, while) |
| `vector` | Medium | SIMD vector operations |
| `gpu` | Medium-low | GPU thread hierarchy (block, thread, barrier) |
| `nvgpu` | Low | NVIDIA-specific ops (tensor core wmma) |
| `llvm` | Low | Direct LLVM IR representation |

**The lowering chain for an ML op on GPU:**
```
linalg.matmul
    → affine loops (loop tiling)
    → scf loops (lower affine)
    → vector ops (vectorization)
    → gpu.launch (map to GPU threads)
    → nvgpu.wmma (use tensor cores)
    → llvm dialect
    → LLVM IR → PTX
```

**Why this matters for Qualcomm:**
- Their ML compiler does exactly this but targets Hexagon instead of NVIDIA
- The dialects and lowering passes are the same concept
- `nvgpu` is replaced by Hexagon-specific dialect

**Polyhedral model (comes up in MLIR affine dialect questions):**
- Represents loop nests as geometric objects (polyhedra) in iteration space
- Enables: legal loop transformations (tiling, fusion, interchange, skewing)
- Affine dialect in MLIR is based on this model
- Key insight: affine maps (`affine_map`) describe memory access patterns mathematically, allowing the compiler to prove legality of transformations

---

## Probable Qualcomm Round 2 Questions From These Topics

**On PyTorch compile stack:**
- **torch.compile**: JIT (Just-In-Time) compilation. It traces at runtime, handles dynamic Python via "Guards", and uses Inductor/Triton to generate code. It still depends on the Python runtime.
- **torch.export**: AOT (Ahead-Of-Time) transformation. It produces a fully static, portable FX Graph that has **zero** Python runtime dependency. Used for edge deployment (e.g., mobile apps, embedded devices) where Python isn't available.

**Q: Walk me through the 4 stages of `torch.compile`.**
1.  **TorchDynamo (Capture)**: Uses PEP 523 bytecode hooks to intercept Python execution and trace PyTorch ops into an **FX Graph**. It handles control flow via "Guards".
2.  **AOTAutograd (Differentiation)**: Takes the forward FX graph, traces through the backward pass using Proxy Tensors, and produces a **Joint Forward-Backward Graph**.
3.  **TorchInductor (Lowering/Fusion)**: The backend compiler. It lowers FX ops to Inductor IR, identifies **Fusion** opportunities (horizontal and vertical), and performs tiling.
4.  **Codegen (Generating Kernels)**: Generates **Triton Python code** for GPUs or C++/OpenMP for CPUs.

**Q: Why does TorchInductor emit Triton kernels instead of CUDA directly?**
-   **Abstraction**: Triton provides a higher-level, tile-based programming model that is easier for a compiler to target than raw CUDA threads/warps.
-   **Portability**: Triton can target both NVIDIA and AMD (and potentially other vendor) GPUs from the same IR.
-   **Optimization**: Triton's compiler handles "expert-level" optimizations like memory swizzling, shared memory allocation, and warp scheduling, which Inductor doesn't have to re-implement.

**On Triton:**
**Q: What abstraction does Triton provide over CUDA?**
-   **Tile-Centric (Triton)** vs **Thread-Centric (CUDA)**. In CUDA, you manage individual threads and their index manually. In Triton, you operate on 2D **Tiles** (blocks of data).
-   The Triton compiler automatically handles **shared memory orchestration**, warp-level synchronization, and instruction pipelining, which must be hand-coded in CUDA.

**Q: How does Triton lower to PTX? What are the stages?**
1.  **Triton Python**: The user-written `@triton.jit` code.
2.  **Triton IR**: High-level representations of tile operations (load tile, dot tile).
3.  **TritonGPU IR**: Tile operations mapped to explicit hardware resources (warps, shared memory layouts). This is where memory swizzling happens.
4.  **LLVM IR**: Lowering Triton-specific constructs into standard LLVM instructions.
5.  **NVPTX Backend**: Standard LLVM backend generates **PTX** (Parallel Thread Execution).

**Q: What is `tl.program_id`? How does it map to CUDA concepts?**
-   It is the identifier for the specific instance (or "grid point") of the kernel running. 
-   It maps directly to CUDA's `blockIdx`.
-   Example: `pid = tl.program_id(0)` identifies which row-tile of a matrix this instance is responsible for.

**Q: How does Triton decide shared memory layout for a tile?**
-   The Triton compiler analyzes the **TritonGPU IR** access patterns. 
-   It automatically calculates an optimal shared memory layout to avoid **Bank Conflicts**.
-   It inserts "swizzling" logic into the memory load/store instructions so that physical thread indices don't all hit the same memory bank simultaneously.

**Q: What does Triton *not* give you that raw CUDA does?**
-   **Fine-grained warp control**: You can't manually call `__shfl_sync` or explicit warp-level primitives.
-   **Host-side control**: Triton doesn't handle CPU-side management (streams, events); it only cares about the kernel.
-   **Manual shared memory pointers**: You can't perform pointer arithmetic inside shared memory yourself; the compiler manages it for safety.

**On MLIR:**
**Q: What is a dialect? Why does MLIR use dialects instead of one IR?**
-   A **Dialect** is a group of related operations and types for a specific domain (e.g., `linalg` for tensors, `affine` for loops).
-   MLIR uses dialects because one single IR cannot represent a program efficiently at all levels.
-   By using dialects, MLIR enables **Progressive Lowering**: moving from high-level "intent" (Linalg) to medium-level "loops" (SCF/Affine) to low-level "hardware" (LLVM) in manageable, reusable steps.

**Q: What is the `linalg` dialect? What does it preserve that LLVM IR loses?**
-   `linalg` represents high-level operations like Matmul, Convolution, and Pointwise ops on **Tensors**.
-   It preserves **Structural Metadata** (shapes, strides, dataflow intent).
-   LLVM IR is just "pointers and jumps." By the time you reach LLVM, a Matmul has been destroyed into triple-nested loops, making it nearly impossible for the compiler to "re-discover" that it was a Matmul to perform high-level fusion.

**Q: What is an affine map? Give an example.**
-   An **Affine Map** is a mathematical formula that describes a coordinate transformation (e.g., mapping a loop index to a memory offset).
-   **Example**: `(d0, d1) -> (d0 * 128 + d1)`.
-   This tells the compiler exactly how a 2D matrix access maps to a 1D linear buffer. This math allows the compiler to prove that a loop transformation (like **Tiling**) is mathematically legal.

**Q: What is progressive lowering? Why is it better than one-shot lowering?**
-   **Progressive Lowering**: Converting from IR-A to IR-B, then IR-B to IR-C, instead of going straight from A to C.
-   **Why it's better**:
    1.  **Complexity**: It's easier to verify a small transform than a giant "one-shot" lowering.
    2.  **Reusability**: Many different high-level dialects (Triton, ONNX, Mojo) can all lower into the *same* medium-level dialects (SCF/Affine), allowing us to share the same loop-optimization code across all of them.

**On Mojo (if they ask):**
**Q: What problem is Mojo solving that Python doesn't?**
-   **Performance**: Python is interpreted and slow; Mojo is compiled via LLVM and achieves C/C++ performance.
-   **Hardware Portability**: Mojo is built on MLIR, allowing it to target CPUs, GPUs, and custom ASICs (like Qualcomm's AI Engine) from a single language.
-   **Deployment**: Mojo produces a single standalone binary, unlike Python which requires a heavy environment and interpreter.

**Q: How does Mojo achieve C-level performance?**
1.  **Static Typing**: Unlike Python's dynamic typing which requires runtime lookup.
2.  **Zero-Cost Abstractions**: Metaprogramming (`@parameter`) and lifetimes happen at compile time.
3.  **No GIL**: Mojo is designed for massive parallelism from day one.
4.  **MLIR Backend**: Direct access to hardware-level optimizations (SIMD, Tiling) through the MLIR stack.

**Q: What is the `SIMD` type in Mojo?**
-   A first-class language primitive representing a hardware vector.
-   `SIMD[DType.float32, 8]` represents an 8-wide float32 vector, which the compiler maps directly to AVX or NEON instructions.

**On vectorization (a commonly probed topic — expect follow-ups):**
**Q: What is loop vectorization? What conditions must hold for it to be legal?**
-   **Loop Vectorization**: Turning multiple scalar loop iterations into a single SIMD instruction.
-   **Legality Conditions**:
    1.  **Independence**: No loop-carried dependencies (iteration 1 cannot depend on a write in iteration 0).
    2.  **Trip Count**: Must be calculable (doesn't have to be a constant, but must be fixed before entering the loop).
    3.  **Memory Access**: Pointers must not alias in a way that creates a dependency.

**Q: What is the SLP vectorizer in LLVM vs the loop vectorizer?**
-   **Loop Vectorizer**: Operates on loops. Packs elements from across different iterations (Vertical).
-   **SLP (Superword Level Parallelism)**: Operates on straight-line code. Packs multiple identical scalar instructions *within* a single iteration/basic-block (Horizontal).

**Q: What blocks vectorization?**
1.  **Aliasing**: Uncertainty about pointer overlap (the #1 blocker).
2.  **Non-Unit Stride**: Scopes like `p[i*10]` are much harder to vectorize than `p[i]`.
3.  **Control Flow**: Complex `if/else` that cannot be simplified to `masking` or `cmov`.
4.  **Function Calls**: External calls unless they are inlined or have SIMD variants available.

**Q: How does the compiler check for aliasing before vectorizing?**
-   **Static Analysis**: Proving non-overlap through pointer provenance.
-   **`__restrict__`**: Programmer-provided guarantee.
-   **Runtime Checks**: The compiler creates a "Versioned Loop." If the pointers overlap at runtime, it runs the scalar loop. If they don't, it jumps to the fast vectorized loop.

---

## Simple Triton Kernel You Should Know Cold

Vector addition — the "hello world" of Triton:

```python
import triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    output = x + y
    tl.store(output_ptr + offsets, output, mask=mask)
```

Know every line:
- `tl.program_id(axis=0)` — which tile this instance handles
- `tl.arange(0, BLOCK_SIZE)` — indices within the tile
- `mask` — boundary condition (last tile may be partial)
- `tl.load` with mask — safe load, out-of-bounds get 0
- `tl.store` with mask — safe store

This is the pattern. Blocked matmul extends this with two program_ids and an accumulation loop over K.

---

# PART 3 — Code Examples: The Full Stack

### 1. PyTorch 2.0 — TorchDynamo & Inductor
How to trace a model and see the generated Triton code.

```python
import torch

def fn(x, y):
    a = torch.sin(x)
    b = torch.cos(y)
    return a + b

# 1. Compile the function
compiled_fn = torch.compile(fn)

# 2. To see what Inductor generates, set:
# TORCH_COMPILE_DEBUG=1 python script.py
# This will dump the generated Triton/C++ code in `torch_compile_debug` folder.
```

### 2. TensorFlow — XLA (JIT Compilation)
Forcing XLA and inspecting the HLO (High-Level Operations) IR.

```python
import tensorflow as tf

@tf.function(jit_compile=True)
def xla_fn(x, y):
    return tf.nn.relu(x + y)

# XLA will fuse the 'add' and 'relu' into a single kernel.
# You can see the HLO IR by setting:
# TF_XLA_FLAGS="--tf_xla_visualize_hlo_graph" python script.py
```

### 3. Triton — Blocked Matrix Multiplication
The "Golden Standard" for Triton kernels.

```python
@triton.jit
def matmul_kernel(
    a_ptr, b_ptr, c_ptr,
    M, N, K,
    stride_am, stride_ak,
    stride_bk, stride_bn,
    stride_cm, stride_cn,
    BLOCK_SIZE_M: tl.constexpr, BLOCK_SIZE_N: tl.constexpr, BLOCK_SIZE_K: tl.constexpr,
    GROUP_SIZE_M: tl.constexpr,
):
    # 1. Map to 2D grid
    pid = tl.program_id(0)
    # L2 Cache Optimization: Grouping blocks to improve re-use of A/B
    num_pid_m = tl.cdiv(M, BLOCK_SIZE_M)
    num_pid_n = tl.cdiv(N, BLOCK_SIZE_N)
    # ... (indexing logic) ...

    # 2. Iterate through K-dimension in blocks
    accumulator = tl.zeros((BLOCK_SIZE_M, BLOCK_SIZE_N), dtype=tl.float32)
    for k in range(0, tl.cdiv(K, BLOCK_SIZE_K)):
        # Load tiles
        a_tile = tl.load(a_ptr + offsets_am[:, None] * stride_am + (k * BLOCK_SIZE_K + offsets_k[None, :]) * stride_ak)
        b_tile = tl.load(b_ptr + (k * BLOCK_SIZE_K + offsets_k[:, None]) * stride_bk + offsets_bn[None, :] * stride_bn)
        # Dot product
        accumulator += tl.dot(a_tile, b_tile)

    # 3. Store back to C
    tl.store(c_ptr + offsets_cm[:, None] * stride_cm + offsets_cn[None, :] * stride_cn, accumulator)
```

### 4. Mojo — SIMD & Metaprogramming
Using `@parameter` for compile-time optimization.

```python
from memory import UnsafePointer
from algorithm import vectorize

fn sum_simd[width: Int](ptr: UnsafePointer[Float32], size: Int) -> Float32:
    var sum = SIMD[DType.float32, width](0)
    
    # Mojo's 'vectorize' automatically handles loop tail
    @parameter
    fn closure[simd_width: Int](offset: Int):
        sum += ptr.load[width = simd_width](offset)
        
    vectorize[width, closure](size)
    return sum.reduce_add()

# Usage: sum_simd[8](my_ptr, 1024) -> Uses AVX (8 floats) at compile time
```

---

