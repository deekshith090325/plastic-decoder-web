# PolySort

A browser-based demo of contamination-aware plastic waste sorting. Point a webcam at a
plastic item and the app identifies it, judges how dirty it is, and shows the matching
disposal, recycling and reuse recommendation.

Everything runs client-side. Four ONNX models are executed in the browser with
onnxruntime-web (WebGPU where available, otherwise multi-threaded WebAssembly SIMD) —
there is no inference server, and no camera frame ever leaves the device.

## Pipeline

1. **Frame capture** — webcam frame letterboxed to 640×640 with grey padding.
2. **Plastic detection** — single-class YOLOv8s (INT8), confidence 0.35, class-agnostic
   NMS at IoU 0.5.
3. **Person exclusion** — a COCO YOLOv8n detector runs on the same letterboxed tensor and
   keeps only the "person" class. A plastic box is suppressed when the share of its own
   area inside a (5% dilated) person box reaches the containment threshold. Containment,
   not IoU: a held bottle barely overlaps a full-body box by IoU but sits almost entirely
   inside it. Suppressed boxes stay in the result and are drawn dimmed.
4. **Dual classification** — each accepted crop is resized to 224×224, ImageNet-normalized
   and passed to two ResNet18 heads: resin type (PET / PE-HD / PP / PS) and contamination
   severity (clean_or_light / moderate_dirt_synth / high_dirt_synth).
5. **Recommendation** — the (resin, severity) pair indexes a 12-row rule table returning a
   decision class, action, recycling route and reuse suggestion.

## Layout

- `src/lib/vision/` — session loading and caching, letterbox preprocessing, YOLO decoding,
  NMS and containment geometry, the frame engine.
- `src/lib/rules/recommendations.ts` — the 12-row Stage 3 table, typed so every
  resin × severity cell must exist.
- `src/components/scanner/` — camera stage, overlay, detection list, recommendation card,
  pipeline status and threshold controls.
- `public/models/` — the four exported `.onnx` files.

## Development

```sh
npm i
npm run dev
```

Built with [Lovable](https://lovable.dev). Live app: https://plastic-decoder-web.lovable.app
