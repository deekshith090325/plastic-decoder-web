import { clampBox, nms } from "./geometry";
import { unletterbox, type LetterboxInfo } from "./preprocess";
import type { Box } from "./types";

export interface RawDetection {
  box: Box;
  score: number;
  classId: number;
}

interface TensorLike {
  data: Float32Array | Uint8Array | Int32Array | Uint16Array | Float64Array;
  dims: readonly number[];
}

/**
 * Decodes a raw YOLOv8 export (no NMS baked in).
 * Accepts both common layouts: [1, 4+nc, N] and [1, N, 4+nc].
 */
export function decodeYolo(
  tensor: TensorLike,
  options: {
    letterbox: LetterboxInfo;
    sourceWidth: number;
    sourceHeight: number;
    confidence: number;
    iouThreshold: number;
    classFilter?: number;
  },
): RawDetection[] {
  const data = tensor.data as ArrayLike<number>;
  const dims = tensor.dims;
  if (dims.length !== 3) return [];

  const d1 = dims[1] ?? 0;
  const d2 = dims[2] ?? 0;
  // The attribute axis (4 + numClasses) is the small one.
  const channelsFirst = d1 <= d2;
  const attrs = channelsFirst ? d1 : d2;
  const count = channelsFirst ? d2 : d1;
  const numClasses = attrs - 4;
  if (numClasses < 1) return [];

  const at = (attr: number, i: number): number =>
    channelsFirst ? (data[attr * count + i] ?? 0) : (data[i * attrs + attr] ?? 0);

  const candidates: RawDetection[] = [];
  for (let i = 0; i < count; i++) {
    let bestClass = 0;
    let bestScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = at(4 + c, i);
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestScore < options.confidence) continue;
    if (options.classFilter !== undefined && bestClass !== options.classFilter) continue;

    const cx = at(0, i);
    const cy = at(1, i);
    const w = at(2, i);
    const h = at(3, i);
    const mapped = unletterbox(
      { x: cx - w / 2, y: cy - h / 2, w, h },
      options.letterbox,
    );
    candidates.push({
      box: clampBox(mapped, options.sourceWidth, options.sourceHeight),
      score: bestScore,
      classId: bestClass,
    });
  }

  return nms(candidates, options.iouThreshold);
}
