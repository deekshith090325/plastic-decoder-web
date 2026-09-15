import type { Box } from "./types";

export function area(b: Box): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

export function intersectionArea(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

export function iou(a: Box, b: Box): number {
  const inter = intersectionArea(a, b);
  const union = area(a) + area(b) - inter;
  return union <= 0 ? 0 : inter / union;
}

/**
 * Fraction of box `a` that sits inside box `b`.
 * This — not IoU — is the right signal for "is this item on/inside a person":
 * a small bottle held by a person has near-zero IoU but containment close to 1.
 */
export function containment(a: Box, b: Box): number {
  const aArea = area(a);
  return aArea <= 0 ? 0 : intersectionArea(a, b) / aArea;
}

export function dilate(b: Box, fraction: number): Box {
  const dx = b.w * fraction;
  const dy = b.h * fraction;
  return { x: b.x - dx, y: b.y - dy, w: b.w + dx * 2, h: b.h + dy * 2 };
}

export function clampBox(b: Box, width: number, height: number): Box {
  const x = Math.max(0, Math.min(b.x, width));
  const y = Math.max(0, Math.min(b.y, height));
  return {
    x,
    y,
    w: Math.max(1, Math.min(b.w, width - x)),
    h: Math.max(1, Math.min(b.h, height - y)),
  };
}

/** Greedy class-agnostic non-maximum suppression. */
export function nms<T extends { box: Box; score: number }>(
  items: T[],
  iouThreshold: number,
): T[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const kept: T[] = [];
  for (const candidate of sorted) {
    if (kept.every((k) => iou(k.box, candidate.box) < iouThreshold)) {
      kept.push(candidate);
    }
  }
  return kept;
}
