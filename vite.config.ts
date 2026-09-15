// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { createReadStream, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);

/** The onnxruntime-web wasm binaries we serve from our own origin at /ort/. */
const ORT_WASM = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.wasm",
];

function ortDistDir(): string {
  return path.join(path.dirname(require.resolve("onnxruntime-web/package.json")), "dist");
}

/**
 * onnxruntime-web defaults to fetching its wasm binary from a public CDN.
 * This app must make no external requests, so the binaries are served from
 * this app instead: via dev middleware, and copied into the client build.
 */
function ortWasmPlugin(): Plugin {
  return {
    name: "ort-wasm-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split("?")[0]?.replace(/^\/ort\//, "");
        if (!req.url?.startsWith("/ort/") || !name || !ORT_WASM.includes(name)) {
          return next();
        }
        const file = path.join(ortDistDir(), name);
        if (!existsSync(file)) return next();
        res.setHeader("Content-Type", "application/wasm");
        res.setHeader("Cache-Control", "max-age=31536000, immutable");
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      // Client bundle only — the server bundle has no use for these.
      if (this.environment?.name !== "client" || !options.dir) return;
      const target = path.join(options.dir, "ort");
      mkdirSync(target, { recursive: true });
      for (const name of ORT_WASM) {
        const file = path.join(ortDistDir(), name);
        if (existsSync(file)) copyFileSync(file, path.join(target, name));
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [ortWasmPlugin()],
  },
});
