import { useEffect, useRef } from "react";

import type { FrameResult } from "@/lib/vision/types";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}

interface Props {
  result: FrameResult | null;
  selectedId: string | null;
}

/** Draws detection boxes in frame-pixel space over the video element. */
export function DetectionOverlay({ result, selectedId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    if (canvas.width !== result.frameWidth || canvas.height !== result.frameHeight) {
      canvas.width = result.frameWidth;
      canvas.height = result.frameHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const accept = cssVar("--accept", "#9ae600");
    const suppress = cssVar("--suppress", "#8a9a90");
    const person = cssVar("--person", "#e58f3a");
    const scale = Math.max(1, result.frameWidth / 640);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.round(16 * scale)}px "DM Sans", sans-serif`;
    ctx.textBaseline = "bottom";

    for (const box of result.personBoxes) {
      ctx.setLineDash([10 * scale, 8 * scale]);
      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = person;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = person;
      ctx.fillText("person — exclusion zone", box.x + 6 * scale, box.y - 6 * scale);
    }
    ctx.setLineDash([]);

    for (const det of result.detections) {
      const rejected = Boolean(det.suppressedBy);
      ctx.globalAlpha = rejected ? 0.45 : 1;
      ctx.lineWidth = (det.id === selectedId ? 5 : 3) * scale;
      ctx.strokeStyle = rejected ? suppress : accept;
      ctx.strokeRect(det.box.x, det.box.y, det.box.w, det.box.h);

      const label = rejected
        ? `suppressed · ${(det.suppressedBy!.containment * 100).toFixed(0)}% on person`
        : det.classification
          ? `${det.classification.resin} · ${(det.score * 100).toFixed(0)}%`
          : `plastic · ${(det.score * 100).toFixed(0)}%`;

      const padding = 6 * scale;
      const width = ctx.measureText(label).width + padding * 2;
      const height = 24 * scale;
      ctx.fillStyle = rejected ? suppress : accept;
      ctx.fillRect(det.box.x, Math.max(0, det.box.y - height), width, height);
      ctx.fillStyle = "#101a14";
      ctx.fillText(label, det.box.x + padding, Math.max(height, det.box.y) - 5 * scale);
      ctx.globalAlpha = 1;
    }
  }, [result, selectedId]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
