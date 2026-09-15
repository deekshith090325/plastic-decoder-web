# Contamination-Aware Plastic Sorting Demo — Architecture Plan

Fully client-side: webcam → plastic detection → person exclusion → resin + contamination classification → rule-based recommendation card. No backend, no external API calls.

## 1. Pages and components

Single working page at `/` (the demo), plus a short `/about` explaining the pipeline and model provenance.

```text
/  (routes/index.tsx)
├── CameraStage        webcam <video> + overlay <canvas>, capture loop
├── DetectionOverlay   boxes: accepted (resin colour), suppressed (dimmed)
├── PipelineStatus     model load progress, FPS, backend (webgpu/wasm), warnings
├── DetectionList      one row per accepted detection, selectable
└── RecommendationCard resin, severity, confidence, action / route / reuse
```

Supporting modules (plain TS, no React):
- `src/lib/vision/session.ts` — ONNX session creation, caching, warmup
- `src/lib/vision/yolo.ts` — letterbox preprocess, output decode, NMS
- `src/lib/vision/classify.ts` — crop → 224×224 → normalize → softmax
- `src/lib/vision/pipeline.ts` — orchestrates one frame end-to-end
- `src/lib/rules/recommendations.ts` — the 12-row Stage 3 table
- `src/hooks/useCamera.ts`, `src/hooks/usePipeline.ts`

Keep all inference off React state: the frame loop writes into a ref, and only publishes a settled result (detections + classifications) to state at a throttled rate. Re-rendering React per frame will tank it.

## 2. onnxruntime-web integration

- `onnxruntime-web` as a dependency; models as static files in `public/models/` (`plastic-yolov8s.onnx`, `person-yolov8n.onnx`, `resin-resnet18.onnx`, `contam-resnet18.onnx`).
- Everything browser-only. ORT touches `WebAssembly`, `navigator.gpu`, workers — so it must never be imported at module scope in a route file. Import it dynamically inside `useEffect`, and render the camera component via `React.lazy` behind `<ClientOnly>`.
- Backend order: try `webgpu`, fall back to `wasm` with `numThreads = navigator.hardwareConcurrency` and SIMD. Surface the active backend in `PipelineStatus` — wasm-only devices will be several times slower and the UI should say so rather than look broken.
- Set `ort.env.wasm.wasmPaths` to a copied-in local path under `public/` (the default pulls from a CDN — that is an external call and must be removed).
- Loading/caching: a module-level `Map<string, Promise<InferenceSession>>` so each model is created once per tab. Across reloads, the browser HTTP cache handles the `.onnx` bytes if we serve them with long-lived cache headers; optionally add a Cache Storage layer keyed by filename+version for offline reuse. Load models sequentially with a visible progress list, and run one dummy inference per model to warm up before enabling the Start button.
- Size discipline: YOLOv8s fp32 is ~45 MB. Recommend INT8/fp16 exports for all four; otherwise first load on a phone is painful.

## 3. Person-exclusion filter

Both detectors run on the *same* letterboxed frame tensor so coordinates share a space (otherwise scale bugs are the #1 source of wrong suppression).

1. Run plastic detector → boxes `P` (conf ≥ 0.35, class-agnostic NMS at IoU 0.5).
2. Run person detector → boxes `H` (class 0 only, conf ≥ 0.5).
3. Suppress `p ∈ P` if for any `h ∈ H`: `overlap(p, h) ≥ τ` where
   `overlap = area(p ∩ h) / area(p)` — **containment ratio, not IoU**. A small bottle inside a large person box has near-zero IoU but containment ≈ 1.0, which is exactly the case we need to kill.
4. Optional second signal for held items: dilate person boxes by a small margin (~5%) before the test, so items just at the hand edge are caught.
5. Keep suppressed boxes in the result object with a `suppressedBy` field and draw them dimmed — this makes the filter demoable and debuggable, which matters a lot for a demo of exactly this feature.

Thresholds (`τ`, person confidence, dilation) exposed in a small dev panel. They will need tuning against real footage; treat the first numbers as placeholders.

Perf: run the person model on every frame at first; if too slow, run it every Nth frame and reuse the last person boxes, since people move slower than the frame rate.

## 4. Stage 3 rule table

```ts
export type Resin = "PET" | "PE-HD" | "PP" | "PS";
export type Severity = "clean_or_light" | "moderate_dirt_synth" | "high_dirt_synth";

export interface Recommendation {
  action: string;        // disposal action
  route: string;         // recycling route
  reuse: string;         // reuse suggestion
  tone: "recycle" | "prep" | "reject"; // drives card styling token
}

export const RECOMMENDATIONS: Record<Resin, Record<Severity, Recommendation>> = { /* 12 entries */ };

export const getRecommendation = (r: Resin, s: Severity): Recommendation =>
  RECOMMENDATIONS[r][s];
```

Nested `Record` (not an array) so TypeScript enforces all 12 cells exist — a missing combination becomes a compile error rather than an undefined card. Class index → label maps live next to the table so ONNX output ordering has one source of truth.

## 5. Straightforward vs. iterative

Straightforward: page layout, rule table and card, webcam capture, box overlay drawing, session caching, the exclusion geometry itself.

Expect iteration:
- YOLOv8 output decoding — layout differs by export settings (NMS baked in or not, `[1,5,8400]` vs transposed). Needs the actual `.onnx` to confirm.
- Preprocessing parity with training (letterbox padding colour, BGR/RGB, ImageNet normalization for the ResNets). Mismatches give confident nonsense, not errors.
- Performance tuning: resolution, frame skipping, backend fallbacks, running four models per frame.
- Threshold tuning for suppression.
- Crop policy for classifiers: padding around the box, aspect handling, minimum crop size.

## 6. Where this fights Lovable's normal patterns

- **SSR**: this template server-renders. ORT and webcam code must be strictly client-only (dynamic import + `ClientOnly`), or the build/SSR breaks.
- **No backend is the hard constraint**: ORT's default wasm path is a CDN fetch; must be pinned locally.
- **Large static assets**: tens of MB of `.onnx` in `public/` is far outside the usual asset profile. Publishing and first-load times will be noticeably slower; quantized exports strongly recommended.
- **Per-frame work vs. React**: the render-on-state-change model must be bypassed with refs + `requestAnimationFrame`.
- **Models don't exist in the repo yet.** Until the four `.onnx` files are dropped into `public/models/`, I can build the full pipeline with a mock inference layer behind the same interface and swap it out — no code changes outside one module.

## Open questions

1. Are the exports quantized, and is NMS baked into the YOLO graph?
2. Which person detector — YOLOv8n-COCO filtered to class 0, or something smaller?
3. Do you want continuous live analysis, or capture-a-frame-then-analyse (much cheaper, often better for a demo)?
4. Should suppressed detections be visible (recommended) or hidden?
