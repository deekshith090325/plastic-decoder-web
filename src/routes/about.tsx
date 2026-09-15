import { Link, createFileRoute } from "@tanstack/react-router";

import { MODEL_SPECS } from "@/lib/vision/models";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How it works — PolySort plastic sorting pipeline" },
      {
        name: "description",
        content:
          "The four-model, fully client-side pipeline behind PolySort: plastic detection, person exclusion, resin and contamination classification, and rule-based recommendations.",
      },
      { property: "og:title", content: "How the PolySort pipeline works" },
      {
        property: "og:description",
        content:
          "Four ONNX models run in the browser via onnxruntime-web: plastic detection, person exclusion, resin and contamination classification.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const STAGES = [
  {
    title: "1 — Frame capture",
    body: "A webcam frame is letterboxed to 640×640 with grey padding, matching the training-time preprocessing of the detectors.",
  },
  {
    title: "2a — Plastic detection",
    body: "A single-class YOLOv8s detector proposes plastic items. Boxes below the confidence threshold are dropped and overlapping boxes are merged with non-maximum suppression.",
  },
  {
    title: "2b — Person exclusion",
    body: "A COCO-pretrained detector runs on the same letterboxed tensor and keeps only the person class. A plastic box is rejected when the share of its own area sitting inside a person box crosses the containment threshold — containment, not IoU, because a held bottle barely overlaps the person box by IoU but is almost entirely inside it.",
  },
  {
    title: "3 — Dual classification",
    body: "Each accepted box is cropped from the full-resolution frame, resized to 224×224 and ImageNet-normalized. Two ResNet18 heads run independently: resin type (PET / PE-HD / PP / PS) and contamination severity (clean, moderate, heavy).",
  },
  {
    title: "4 — Recommendation",
    body: "The (resin, severity) pair indexes a 12-row rule table that returns a disposal action, a recycling route and a reuse suggestion.",
  },
];

function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <Link to="/" className="text-sm text-accept hover:underline">
        ← Back to the demo
      </Link>
      <h1 className="mt-6 text-4xl font-semibold">How the pipeline works</h1>
      <p className="mt-4 text-muted-foreground">
        Everything below runs inside this browser tab through onnxruntime-web. There is no
        inference server, and no frame ever leaves the device.
      </p>

      <ol className="mt-10 space-y-6">
        {STAGES.map((stage) => (
          <li key={stage.title} className="panel p-5">
            <h2 className="text-lg font-semibold">{stage.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{stage.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Adding the trained models</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Until the exported ONNX files are present the app runs the full pipeline with
          simulated inference, so the geometry, filtering and rule lookup are all
          demonstrable. Place the exports at these paths and the app switches to real
          inference automatically on the next reload:
        </p>
        <ul className="mt-4 space-y-2 font-mono text-xs">
          {MODEL_SPECS.map((spec) => (
            <li key={spec.key} className="rounded-lg border border-border p-3">
              <span className="text-accept">public{spec.url}</span>
              <span className="block text-muted-foreground">
                {spec.label} · input {spec.inputSize}×{spec.inputSize}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Export the YOLO models without baked-in NMS (the decoder here handles both the
          [1, 4+nc, N] and [1, N, 4+nc] output layouts), and prefer INT8 or FP16 exports —
          an FP32 YOLOv8s is around 45 MB to download before the first frame can be
          processed.
        </p>
      </section>
    </main>
  );
}
