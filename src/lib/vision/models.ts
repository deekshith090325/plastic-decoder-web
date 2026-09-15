import { RESINS, SEVERITIES, type Resin, type Severity } from "./types";

export interface ModelSpec {
  key: "plastic" | "person" | "resin" | "contamination";
  label: string;
  url: string;
  inputSize: number;
}

/** The four exported models, served as static files from public/models. */
export const MODEL_SPECS: ModelSpec[] = [
  {
    key: "plastic",
    label: "Plastic detector (YOLOv8s INT8)",
    url: "/models/plastic-yolov8s-int8.onnx",
    inputSize: 640,
  },
  {
    key: "person",
    label: "Person detector (YOLOv8n COCO INT8)",
    url: "/models/person-yolov8n-int8.onnx",
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

/**
 * Output index -> label. Single source of truth for the classifier heads;
 * the order must match the training-time class order exactly.
 */
export const RESIN_CLASSES: readonly Resin[] = RESINS; // ['PET','PE-HD','PP','PS']
export const SEVERITY_CLASSES: readonly Severity[] = SEVERITIES; // ['clean_or_light','moderate_dirt_synth','high_dirt_synth']

/** COCO class index for "person" in an off-the-shelf YOLOv8 export. */
export const COCO_PERSON_CLASS = 0;
