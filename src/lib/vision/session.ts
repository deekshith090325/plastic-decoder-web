import type * as Ort from "onnxruntime-web";

import jsepWasm from "@/assets/ort/ort-wasm-simd-threaded.jsep.wasm.asset.json";
import baseWasm from "@/assets/ort/ort-wasm-simd-threaded.wasm.asset.json";

export type OrtModule = typeof Ort;

let ortPromise: Promise<OrtModule> | null = null;

/**
 * Loads onnxruntime-web lazily (browser only) and pins its wasm binary to
 * our own CDN copy — the library default fetches it from a public CDN,
 * which this app must not do.
 */
export function getOrt(): Promise<OrtModule> {
  ortPromise ??= import("onnxruntime-web").then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: hasWebGPU() ? jsepWasm.url : baseWasm.url };
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
    ort.env.logLevel = "error";
    return ort;
  });
  return ortPromise;
}

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

const sessions = new Map<string, Promise<Ort.InferenceSession>>();

/** One session per model URL per tab. */
export function loadSession(url: string): Promise<Ort.InferenceSession> {
  const existing = sessions.get(url);
  if (existing) return existing;

  const created = (async () => {
    const ort = await getOrt();
    const providers = hasWebGPU() ? ["webgpu", "wasm"] : ["wasm"];
    try {
      return await ort.InferenceSession.create(url, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
      });
    } catch {
      return await ort.InferenceSession.create(url, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    }
  })();

  sessions.set(url, created);
  created.catch(() => sessions.delete(url));
  return created;
}

/** Cheap existence probe so the app can fall back to simulation. */
export async function modelExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

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
