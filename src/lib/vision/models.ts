import { RESINS, SEVERITIES, type Resin, type Severity } from "./types";

export interface ModelSpec {
  key: "plastic" | "person" | "resin" | "contamination";
  label: string;
  url: string;
  inputSize: number;
}

/**
 * Drop the exported .onnx files at these paths to switch the app from
 * simulated inference to real inference. Nothing else needs to change.
 */
export const MODEL_SPECS: ModelSpec[] = [
  {
    key: "plastic",
    label: "Plastic detector (YOLOv8s)",
    url: "/models/plastic-yolov8s.onnx",
    inputSize: 640,
  },
  {
    key: "person",
    label: "Person detector (COCO)",
    url: "/models/person-yolov8n.onnx",
    inputSize: 640,
  },
  {
    key: "resin",
    label: "Resin classifier (ResNet18)",
    url: "/models/resin-resnet18.onnx",
    inputSize: 224,
  },
  {
    key: "contamination",
    label: "Contamination classifier (ResNet18)",
    url: "/models/contamination-resnet18.onnx",
    inputSize: 224,
  },
];

/** Output index -> label. Single source of truth for both engines. */
export const RESIN_CLASSES: readonly Resin[] = RESINS;
export const SEVERITY_CLASSES: readonly Severity[] = SEVERITIES;

/** COCO class index for "person" in an off-the-shelf YOLOv8 export. */
export const COCO_PERSON_CLASS = 0;
