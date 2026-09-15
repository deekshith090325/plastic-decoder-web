import { AlertTriangle, Check, CircleDashed, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EngineStatus, FrameResult, ModelProgress } from "@/lib/vision/types";

interface Props {
  progress: ModelProgress[];
  status: EngineStatus | null;
  result: FrameResult | null;
  fps: number;
}

const ICONS = {
  pending: CircleDashed,
  loading: Loader2,
  ready: Check,
  missing: X,
  error: AlertTriangle,
} as const;

export function PipelineStatus({ progress, status, result, fps }: Props) {
  return (
    <section className="panel space-y-4 p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Pipeline</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {status ? `${status.mode} · ${status.backend}` : "loading…"}
        </span>
      </header>

      <ul className="space-y-2">
        {progress.map((model) => {
          const Icon = ICONS[model.state];
          return (
            <li key={model.key} className="flex items-center gap-2 text-sm">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  model.state === "ready" && "text-accept",
                  model.state === "loading" && "animate-spin text-caution",
                  model.state === "missing" && "text-suppress",
                  model.state === "error" && "text-reject",
                  model.state === "pending" && "text-muted-foreground",
                )}
              />
              <span className="flex-1 truncate">
                {model.label}
                {model.message ? (
                  <span className="block text-xs break-words text-reject">
                    {model.message}
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {model.state}
              </span>
            </li>
          );
        })}
      </ul>

      {status?.notes.length ? (
        <div className="rounded-lg border border-caution/40 bg-caution/10 p-3 text-xs text-caution">
          {status.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>fps</dt>
          <dd>{fps.toFixed(1)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>frame</dt>
          <dd>{result ? `${result.frameWidth}×${result.frameHeight}` : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>detect</dt>
          <dd>{result ? `${result.timings.plastic.toFixed(0)}ms` : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>person</dt>
          <dd>{result ? `${result.timings.person.toFixed(0)}ms` : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>classify</dt>
          <dd>{result ? `${result.timings.classify.toFixed(0)}ms` : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>suppressed</dt>
          <dd>{result ? result.detections.filter((d) => d.suppressedBy).length : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
