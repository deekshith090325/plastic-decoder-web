import type { Box } from "./types";

export interface LetterboxInfo {
  scale: number;
  padX: number;
  padY: number;
  size: number;
}

const PAD_GREY = "rgb(114,114,114)";

/** Ultralytics-style letterbox: preserve aspect ratio, pad with 114 grey. */
export function drawLetterbox(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  size: number,
): LetterboxInfo {
  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  const padX = (size - w) / 2;
  const padY = (size - h) / 2;
  ctx.fillStyle = PAD_GREY;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, padX, padY, w, h);
  return { scale, padX, padY, size };
}

/** Map a box from letterboxed model space back into source-image pixels. */
export function unletterbox(box: Box, info: LetterboxInfo): Box {
  return {
    x: (box.x - info.padX) / info.scale,
    y: (box.y - info.padY) / info.scale,
    w: box.w / info.scale,
    h: box.h / info.scale,
  };
}

/** RGB, 0..1, NCHW. Detector input (no ImageNet normalization). */
export function toDetectorTensor(data: ImageData, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const px = data.data;
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    out[i] = (px[p] ?? 0) / 255;
    out[plane + i] = (px[p + 1] ?? 0) / 255;
    out[plane * 2 + i] = (px[p + 2] ?? 0) / 255;
  }
  return out;
}

const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

/** RGB, ImageNet-normalized, NCHW. Classifier input (torchvision default). */
export function toClassifierTensor(data: ImageData, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const px = data.data;
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    for (let c = 0; c < 3; c++) {
      const v = (px[p + c] ?? 0) / 255;
      out[plane * c + i] = (v - IMAGENET_MEAN[c]!) / IMAGENET_STD[c]!;
    }
  }
  return out;
}

export function softmax(logits: Float32Array | number[]): number[] {
  const values = Array.from(logits);
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

export function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i] ?? -Infinity) > (values[best] ?? -Infinity)) best = i;
  }
  return best;
}

/** Draw a padded crop of `box` from `source` into a square classifier canvas. */
export function drawCrop(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: Box,
  sourceWidth: number,
  sourceHeight: number,
  size: number,
  padding = 0.08,
): void {
  const px = box.w * padding;
  const py = box.h * padding;
  const sx = Math.max(0, box.x - px);
  const sy = Math.max(0, box.y - py);
  const sw = Math.min(sourceWidth - sx, box.w + px * 2);
  const sh = Math.min(sourceHeight - sy, box.h + py * 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);
}

export function createCanvas(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { canvas, ctx };
}
