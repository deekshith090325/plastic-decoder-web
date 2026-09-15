import { Camera, CameraOff, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DetectionList } from "@/components/scanner/DetectionList";
import { DetectionOverlay } from "@/components/scanner/DetectionOverlay";
import { PipelineStatus } from "@/components/scanner/PipelineStatus";
import { RecommendationCard } from "@/components/scanner/RecommendationCard";
import { SettingsPanel } from "@/components/scanner/SettingsPanel";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/useCamera";
import { usePipeline } from "@/hooks/usePipeline";
import { DEFAULT_SETTINGS, type PipelineSettings } from "@/lib/vision/types";

export default function ScannerStage() {
  const { videoRef, state, error, start, stop } = useCamera();
  const [settings, setSettings] = useState<PipelineSettings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    progress,
    status,
    result,
    fps,
    error: engineError,
    ready,
  } = usePipeline({ videoRef, running: state === "live" && !paused, settings });

  const detections = result?.detections ?? [];
  const accepted = useMemo(
    () => detections.filter((d) => !d.suppressedBy),
    [detections],
  );

  // Keep a sensible selection as frames come and go.
  useEffect(() => {
    if (accepted.length === 0) return;
    if (!accepted.some((d) => d.id === selectedId)) {
      setSelectedId(accepted[0]!.id);
    }
  }, [accepted, selectedId]);

  const selected = detections.find((d) => d.id === selectedId) ?? accepted[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="panel stage-backdrop relative overflow-hidden">
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
              className="block w-full bg-black/60"
              style={{ aspectRatio: "16 / 9", objectFit: "contain" }}
            />
            <DetectionOverlay result={result} selectedId={selectedId} />
            {state !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 px-6 text-center">
                <Camera className="size-10 text-accept" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {error ??
                    "Everything runs in this browser tab. Nothing from your camera is uploaded."}
                </p>
                <Button onClick={() => void start()} disabled={state === "starting"}>
                  {state === "starting" ? "Starting camera…" : "Start camera"}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPaused((p) => !p)}
              disabled={state !== "live"}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "Resume" : "Freeze frame"}
            </Button>
            <Button variant="ghost" size="sm" onClick={stop} disabled={state !== "live"}>
              <CameraOff className="size-4" />
              Stop camera
            </Button>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {accepted.length} accepted ·{" "}
              {detections.length - accepted.length} suppressed
            </span>
          </div>
        </div>

        <RecommendationCard detection={selected} />
      </div>

      <div className="space-y-6">
        <PipelineStatus progress={progress} status={status} result={result} fps={fps} />
        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Detections</h2>
          <DetectionList
            detections={detections}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
        <SettingsPanel settings={settings} onChange={setSettings} />
      </div>
    </div>
  );
}
