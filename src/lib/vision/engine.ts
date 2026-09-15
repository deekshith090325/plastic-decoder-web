import { clampBox, containment, dilate } from "./geometry";
import {
  COCO_PERSON_CLASS,
  MODEL_SPECS,
  RESIN_CLASSES,
  SEVERITY_CLASSES,
  type ModelSpec,
} from "./models";
import {
  argmax,
  createCanvas,
  drawCrop,
  drawLetterbox,
  softmax,
  toClassifierTensor,
  toDetectorTensor,
} from "./preprocess";
import { getOrt, hasWebGPU, loadSession, modelExists, warmup } from "./session";
import { decodeYolo, type RawDetection } from "./yolo";
import type {
  Box,
  Classification,
  Detection,
  Engine,
  FrameResult,
  ModelProgress,
  PipelineSettings,
} from "./types";

/**
 * Stage 2: reject plastic boxes that sit on or inside a person.
 * Uses containment (intersection / plastic area), not IoU — a held bottle has
 * almost no IoU with the person box but is almost fully contained by it.
 */
export function applyPersonExclusion(
  plastic: Detection[],
  people: Box[],
  settings: PipelineSettings,
): void {
  if (!settings.personFilterEnabled) return;
  const grown = people.map((p) => dilate(p, settings.personDilation));
  for (const det of plastic) {
    let worst = 0;
    let index = -1;
    grown.forEach((person, i) => {
      const c = containment(det.box, person);
      if (c > worst) {
        worst = c;
        index = i;
      }
    });
    if (index >= 0 && worst >= settings.containmentThreshold) {
      det.suppressedBy = { personIndex: index, containment: worst };
    }
  }
}

function sourceSize(source: HTMLVideoElement | HTMLCanvasElement) {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  return { width, height };
}

/* ------------------------------------------------------------------ */
/* ONNX engine                                                         */
/* ------------------------------------------------------------------ */

class OnnxEngine implements Engine {
  status: Engine["status"];
  private detCanvas = createCanvas(640);
  private clsCanvas = createCanvas(224);
  private frameCanvas = createCanvas(1);
  private cachedPeople: Box[] = [];

  constructor(
    private sessions: Record<ModelSpec["key"], Awaited<ReturnType<typeof loadSession>>>,
    backend: string,
  ) {
    this.status = { mode: "onnx", backend, notes: [] };
  }

  private async runSession(
    key: ModelSpec["key"],
    input: Float32Array,
    shape: number[],
  ) {
    const ort = await getOrt();
    const session = this.sessions[key];
    const inputName = session.inputNames[0]!;
    const outputName = session.outputNames[0]!;
    const feeds = { [inputName]: new ort.Tensor("float32", input, shape) };
    const result = await session.run(feeds);
    return result[outputName]!;
  }

  async run(
    source: HTMLVideoElement | HTMLCanvasElement,
    settings: PipelineSettings,
    frameIndex: number,
  ): Promise<FrameResult> {
    const started = performance.now();
    const { width, height } = sourceSize(source);
    if (!width || !height) {
      return emptyResult(width, height);
    }

    // Keep a full-resolution still of the frame for crops.
    if (this.frameCanvas.canvas.width !== width) {
      this.frameCanvas.canvas.width = width;
      this.frameCanvas.canvas.height = height;
    }
    this.frameCanvas.ctx.drawImage(source, 0, 0, width, height);

    const letterbox = drawLetterbox(this.detCanvas.ctx, source, width, height, 640);
    const imageData = this.detCanvas.ctx.getImageData(0, 0, 640, 640);
    const tensor = toDetectorTensor(imageData, 640);

    const plasticStart = performance.now();
    const plasticOut = await this.runSession("plastic", tensor, [1, 3, 640, 640]);
    const plasticRaw = decodeYolo(plasticOut, {
      letterbox,
      sourceWidth: width,
      sourceHeight: height,
      confidence: settings.plasticConfidence,
      iouThreshold: settings.nmsIou,
    });
    const plasticMs = performance.now() - plasticStart;

    const personStart = performance.now();
    const shouldRunPerson =
      settings.personFilterEnabled &&
      frameIndex % Math.max(1, settings.personEveryNFrames) === 0;
    if (shouldRunPerson) {
      const personOut = await this.runSession("person", tensor, [1, 3, 640, 640]);
      this.cachedPeople = decodeYolo(personOut, {
        letterbox,
        sourceWidth: width,
        sourceHeight: height,
        confidence: settings.personConfidence,
        iouThreshold: settings.nmsIou,
        classFilter: COCO_PERSON_CLASS,
      }).map((d: RawDetection) => d.box);
    }
    const personMs = performance.now() - personStart;

    const detections: Detection[] = plasticRaw.map((d, i) => ({
      id: `${frameIndex}-${i}`,
      box: d.box,
      score: d.score,
    }));
    applyPersonExclusion(detections, this.cachedPeople, settings);

    const classifyStart = performance.now();
    for (const det of detections) {
      if (det.suppressedBy) continue;
      drawCrop(
        this.clsCanvas.ctx,
        this.frameCanvas.canvas,
        det.box,
        width,
        height,
        224,
      );
      const crop = toClassifierTensor(
        this.clsCanvas.ctx.getImageData(0, 0, 224, 224),
        224,
      );
      const resinOut = await this.runSession("resin", crop, [1, 3, 224, 224]);
      const contamOut = await this.runSession("contamination", crop, [1, 3, 224, 224]);
      const resinProbs = softmax(Array.from(resinOut.data as Float32Array));
      const sevProbs = softmax(Array.from(contamOut.data as Float32Array));
      const ri = argmax(resinProbs);
      const si = argmax(sevProbs);
      det.classification = {
        resin: RESIN_CLASSES[ri] ?? "PET",
        resinConfidence: resinProbs[ri] ?? 0,
        severity: SEVERITY_CLASSES[si] ?? "clean_or_light",
        severityConfidence: sevProbs[si] ?? 0,
      };
    }
    const classifyMs = performance.now() - classifyStart;

    return {
      detections,
      personBoxes: settings.personFilterEnabled ? this.cachedPeople : [],
      timings: {
        total: performance.now() - started,
        plastic: plasticMs,
        person: personMs,
        classify: classifyMs,
      },
      frameWidth: width,
      frameHeight: height,
    };
  }

  dispose(): void {
    this.cachedPeople = [];
  }
}

/* ------------------------------------------------------------------ */
/* Simulated engine (used until the .onnx files are added)             */
/* ------------------------------------------------------------------ */

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

class SimulatedEngine implements Engine {
  status: Engine["status"] = {
    mode: "simulated",
    backend: "none",
    notes: [
      "No .onnx files found in /models — running the full pipeline with simulated inference.",
      "Drop the four exported models into public/models to switch to real inference.",
    ],
  };

  async run(
    source: HTMLVideoElement | HTMLCanvasElement,
    settings: PipelineSettings,
    frameIndex: number,
  ): Promise<FrameResult> {
    const started = performance.now();
    const { width, height } = sourceSize(source);
    if (!width || !height) return emptyResult(width, height);

    const t = frameIndex / 60;
    const detections: Detection[] = [];
    const itemCount = 2;
    for (let i = 0; i < itemCount; i++) {
      const phase = t * 0.5 + i * 2.1;
      const bw = width * (0.16 + 0.03 * Math.sin(phase * 1.3));
      const bh = height * (0.32 + 0.05 * Math.cos(phase * 0.9));
      const cx = width * (0.32 + 0.18 * Math.sin(phase) + i * 0.3);
      const cy = height * (0.5 + 0.12 * Math.cos(phase * 0.7));
      const slot = Math.floor(t / 6) + i * 3;
      detections.push({
        id: `sim-${i}-${Math.floor(t / 6)}`,
        box: clampBox({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }, width, height),
        score: 0.62 + 0.25 * hash01(slot),
        classification: simulatedClassification(slot),
      });
    }

    // A simulated person sweeps through the frame periodically so the
    // exclusion filter is visible without a real person detector.
    const cycle = (t % 18) / 18;
    const people: Box[] = [];
    if (cycle > 0.35) {
      const pw = width * 0.45;
      const px = width * (0.05 + (cycle - 0.35) * 1.1);
      people.push(
        clampBox({ x: px, y: height * 0.05, w: pw, h: height * 0.95 }, width, height),
      );
    }

    applyPersonExclusion(detections, people, settings);
    for (const det of detections) {
      if (det.suppressedBy) delete det.classification;
    }

    return {
      detections,
      personBoxes: settings.personFilterEnabled ? people : [],
      timings: {
        total: performance.now() - started,
        plastic: 0,
        person: 0,
        classify: 0,
      },
      frameWidth: width,
      frameHeight: height,
    };
  }

  dispose(): void {}
}

function simulatedClassification(slot: number): Classification {
  const ri = Math.floor(hash01(slot) * RESIN_CLASSES.length) % RESIN_CLASSES.length;
  const si =
    Math.floor(hash01(slot + 99) * SEVERITY_CLASSES.length) % SEVERITY_CLASSES.length;
  return {
    resin: RESIN_CLASSES[ri]!,
    resinConfidence: 0.7 + 0.28 * hash01(slot + 7),
    severity: SEVERITY_CLASSES[si]!,
    severityConfidence: 0.65 + 0.3 * hash01(slot + 13),
  };
}

function emptyResult(width: number, height: number): FrameResult {
  return {
    detections: [],
    personBoxes: [],
    timings: { total: 0, plastic: 0, person: 0, classify: 0 },
    frameWidth: width,
    frameHeight: height,
  };
}

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

export async function loadEngine(
  onProgress: (progress: ModelProgress[]) => void,
): Promise<Engine> {
  const progress: ModelProgress[] = MODEL_SPECS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    state: "pending",
  }));
  const publish = () => onProgress(progress.map((p) => ({ ...p })));
  publish();

  const availability = await Promise.all(MODEL_SPECS.map((s) => modelExists(s.url)));
  if (availability.some((ok) => !ok)) {
    MODEL_SPECS.forEach((spec, i) => {
      progress[i] = {
        key: spec.key,
        label: spec.label,
        state: availability[i] ? "pending" : "missing",
        message: availability[i] ? "Waiting for the other models" : "File not found",
      };
    });
    publish();
    return new SimulatedEngine();
  }

  const sessions: Partial<Record<ModelSpec["key"], Awaited<ReturnType<typeof loadSession>>>> =
    {};
  for (let i = 0; i < MODEL_SPECS.length; i++) {
    const spec = MODEL_SPECS[i]!;
    progress[i] = { key: spec.key, label: spec.label, state: "loading" };
    publish();
    try {
      const session = await loadSession(spec.url);
      await warmup(session, [1, 3, spec.inputSize, spec.inputSize]);
      sessions[spec.key] = session;
      progress[i] = { key: spec.key, label: spec.label, state: "ready" };
    } catch (error) {
      progress[i] = {
        key: spec.key,
        label: spec.label,
        state: "error",
        message: error instanceof Error ? error.message : "Failed to load",
      };
      publish();
      return new SimulatedEngine();
    }
    publish();
  }

  return new OnnxEngine(
    sessions as Record<ModelSpec["key"], Awaited<ReturnType<typeof loadSession>>>,
    hasWebGPU() ? "webgpu" : "wasm",
  );
}
