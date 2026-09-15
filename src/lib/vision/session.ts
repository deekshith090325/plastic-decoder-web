import type * as Ort from "onnxruntime-web";

// Served from this app's own origin by the ort-wasm-local Vite plugin,
// never from a public CDN — the demo must make no external connections.
const jsepWasmUrl = "/ort/ort-wasm-simd-threaded.jsep.wasm";
const baseWasmUrl = "/ort/ort-wasm-simd-threaded.wasm";

export type OrtModule = typeof Ort;

let ortPromise: Promise<OrtModule> | null = null;

/** Loads onnxruntime-web lazily (browser only) with locally served wasm. */
export function getOrt(): Promise<OrtModule> {
  ortPromise ??= import("onnxruntime-web").then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: hasWebGPU() ? jsepWasmUrl : baseWasmUrl };
    // Multi-threading needs cross-origin isolation; ORT falls back to a single
    // thread on its own when that is unavailable.
    ort.env.wasm.numThreads = crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 1)
      : 1;
    ort.env.wasm.simd = true;
    ort.env.logLevel = "error";
    return ort;
  });
  return ortPromise;
}

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** One session per model URL per tab. */
const sessions = new Map<string, Promise<Ort.InferenceSession>>();

export function loadSession(url: string): Promise<Ort.InferenceSession> {
  const existing = sessions.get(url);
  if (existing) return existing;

  const created = (async () => {
    const ort = await getOrt();
    try {
      if (hasWebGPU()) {
        return await ort.InferenceSession.create(url, {
          executionProviders: ["webgpu"],
          graphOptimizationLevel: "all",
        });
      }
    } catch {
      // fall through to wasm
    }
    return await ort.InferenceSession.create(url, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  })();

  sessions.set(url, created);
  created.catch(() => sessions.delete(url));
  return created;
}

/** One dummy inference so the first real frame is not paying warmup cost. */
export async function warmup(
  session: Ort.InferenceSession,
  shape: readonly number[],
): Promise<void> {
  const ort = await getOrt();
  const size = shape.reduce((a, b) => a * b, 1);
  const input = session.inputNames[0];
  if (!input) return;
  const tensor = new ort.Tensor("float32", new Float32Array(size), shape as number[]);
  await session.run({ [input]: tensor });
}
