import { useCallback, useEffect, useRef, useState } from "react";

import { loadEngine } from "@/lib/vision/engine";
import type {
  Engine,
  EngineStatus,
  FrameResult,
  ModelProgress,
  PipelineSettings,
} from "@/lib/vision/types";

interface Options {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  running: boolean;
  settings: PipelineSettings;
  /** Minimum gap between inference passes, in ms. */
  minInterval?: number;
}

export function usePipeline({ videoRef, running, settings, minInterval = 80 }: Options) {
  const engineRef = useRef<Engine | null>(null);
  const settingsRef = useRef(settings);
  const frameIndex = useRef(0);
  const [progress, setProgress] = useState<ModelProgress[]>([]);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [result, setResult] = useState<FrameResult | null>(null);
  const [fps, setFps] = useState(0);

  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    loadEngine((p) => {
      if (!cancelled) setProgress(p);
    }).then((engine) => {
      if (cancelled) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      setStatus(engine.status);
    });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let active = true;
    let raf = 0;
    let last = 0;
    let smoothed = 0;

    const tick = async () => {
      if (!active) return;
      const engine = engineRef.current;
      const video = videoRef.current;
      const now = performance.now();
      if (engine && video && video.readyState >= 2 && now - last >= minInterval) {
        last = now;
        try {
          const next = await engine.run(video, settingsRef.current, frameIndex.current++);
          if (!active) return;
          setResult(next);
          const instant = 1000 / Math.max(1, next.timings.total);
          smoothed = smoothed ? smoothed * 0.8 + instant * 0.2 : instant;
          setFps(Math.min(1000 / minInterval, smoothed));
        } catch (error) {
          console.error("Pipeline frame failed", error);
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    raf = requestAnimationFrame(() => void tick());
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, [running, videoRef, minInterval]);

  const reset = useCallback(() => setResult(null), []);

  return { progress, status, result, fps, reset };
}
