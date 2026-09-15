import { containment, dilate } from "./geometry";
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
import { getOrt, hasWebGPU, loadSession, runInference, warmup } from "./session";
import { decodeYolo, type RawDetection } from "./yolo";
import type {
  Box,
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

type Sessions = Record<ModelSpec["key"], Awaited<ReturnType<typeof loadSession>>>;

class OnnxEngine implements Engine {
  status: Engine["status"];
  private detCanvas = createCanvas(640);
  private clsCanvas = createCanvas(224);
  private frameCanvas = createCanvas(1);
  private cachedPeople: Box[] = [];

  constructor(
    private sessions: Sessions,
    backend: string,
  ) {
    this.status = { mode: "onnx", backend, notes: [] };
  }

  private async runSession(key: ModelSpec["key"], input: Float32Array, shape: number[]) {
    const ort = await getOrt();
    const session = this.sessions[key];
    const inputName = session.inputNames[0]!;
    const outputName = session.outputNames[0]!;
    const feeds = { [inputName]: new ort.Tensor("float32", input, shape) };
    const result = await runInference(session, feeds);
    return result[outputName]!;
  }

  async run(
    source: HTMLVideoElement | HTMLCanvasElement,
    settings: PipelineSettings,
    frameIndex: number,
  ): Promise<FrameResult> {
    const started = performance.now();
    const { width, height } = sourceSize(source);
    if (!width || !height) return emptyResult(width, height);

    // Keep a full-resolution still of the frame for crops.
    if (this.frameCanvas.canvas.width !== width) {
      this.frameCanvas.canvas.width = width;
      this.frameCanvas.canvas.height = height;
    }
    this.frameCanvas.ctx.drawImage(source, 0, 0, width, height);

    // Both detectors consume this one letterboxed tensor, so their boxes
    // live in the same coordinate space.
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
      drawCrop(this.clsCanvas.ctx, this.frameCanvas.canvas, det.box, width, height, 224);
      const crop = toClassifierTensor(
        this.clsCanvas.ctx.getImageData(0, 0, 224, 224),
        224,
      );
      const resinOut = await this.runSession("resin", crop, [1, 3, 224, 224]);
      const contamOut = await this.runSession("contamination", crop, [1, 3, 224, 224]);
      // Class order is fixed by training: RESIN_CLASSES / SEVERITY_CLASSES.
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

function emptyResult(width: number, height: number): FrameResult {
  return {
    detections: [],
    personBoxes: [],
    timings: { total: 0, plastic: 0, person: 0, classify: 0 },
    frameWidth: width,
    frameHeight: height,
  };
}

/**
 * Loads every model once, warms each one up with a dummy inference, and only
 * then hands back a usable engine. Rejects if any model fails to load.
 */
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

  const sessions: Partial<Sessions> = {};
  for (let i = 0; i < MODEL_SPECS.length; i++) {
    const spec = MODEL_SPECS[i]!;
    progress[i] = { key: spec.key, label: spec.label, state: "loading" };
    publish();
    try {
      const session = await loadSession(spec.url);
      await warmup(session, [1, 3, spec.inputSize, spec.inputSize]);
      sessions[spec.key] = session;
      progress[i] = { key: spec.key, label: spec.label, state: "ready" };
      publish();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      progress[i] = { key: spec.key, label: spec.label, state: "error", message };
      publish();
      throw new Error(`${spec.label}: ${message}`);
    }
  }

  return new OnnxEngine(sessions as Sessions, hasWebGPU() ? "webgpu" : "wasm");
}
