/** Axis-aligned box in source-image pixel space. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RESINS = ["PET", "PE-HD", "PP", "PS"] as const;
export type Resin = (typeof RESINS)[number];

export const SEVERITIES = [
  "clean_or_light",
  "moderate_dirt_synth",
  "high_dirt_synth",
] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Classification {
  resin: Resin;
  resinConfidence: number;
  severity: Severity;
  severityConfidence: number;
}

export interface Detection {
  id: string;
  box: Box;
  score: number;
  /** Set when a person box overlapped this detection enough to reject it. */
  suppressedBy?: { personIndex: number; containment: number };
  classification?: Classification;
}

export interface FrameResult {
  detections: Detection[];
  personBoxes: Box[];
  timings: {
    total: number;
    plastic: number;
    person: number;
    classify: number;
  };
  frameWidth: number;
  frameHeight: number;
}

export interface PipelineSettings {
  plasticConfidence: number;
  personConfidence: number;
  nmsIou: number;
  /** Fraction of a plastic box that may overlap a person before it is rejected. */
  containmentThreshold: number;
  /** Person boxes are grown by this fraction before the overlap test. */
  personDilation: number;
  /** Run the person detector every Nth frame (1 = every frame). */
  personEveryNFrames: number;
  personFilterEnabled: boolean;
}

export const DEFAULT_SETTINGS: PipelineSettings = {
  plasticConfidence: 0.35,
  personConfidence: 0.5,
  nmsIou: 0.5,
  containmentThreshold: 0.55,
  personDilation: 0.05,
  personEveryNFrames: 1,
  personFilterEnabled: true,
};

export type EngineMode = "onnx" | "simulated";

export interface EngineStatus {
  mode: EngineMode;
  backend: string;
  notes: string[];
}

export interface Engine {
  status: EngineStatus;
  run(
    source: HTMLVideoElement | HTMLCanvasElement,
    settings: PipelineSettings,
    frameIndex: number,
  ): Promise<FrameResult>;
  dispose(): void;
}

export interface ModelProgress {
  key: string;
  label: string;
  state: "pending" | "loading" | "ready" | "missing" | "error";
  message?: string;
}
