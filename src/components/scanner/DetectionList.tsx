import { Ban, ScanLine } from "lucide-react";

import { RESIN_LABELS, SEVERITY_LABELS } from "@/lib/rules/recommendations";
import { cn } from "@/lib/utils";
import type { Detection } from "@/lib/vision/types";

interface Props {
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DetectionList({ detections, selectedId, onSelect }: Props) {
  if (detections.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        No plastic items detected in the current frame.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {detections.map((det) => {
        const rejected = Boolean(det.suppressedBy);
        return (
          <li key={det.id}>
            <button
              type="button"
              onClick={() => onSelect(det.id)}
              disabled={rejected}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-left transition-colors",
                !rejected && "hover:border-accept/60",
                rejected && "opacity-55",
                det.id === selectedId && "border-accept bg-accept/10",
              )}
            >
              {rejected ? (
                <Ban className="size-4 shrink-0 text-suppress" />
              ) : (
                <ScanLine className="size-4 shrink-0 text-accept" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {rejected
                    ? "Suppressed — overlaps a person"
                    : det.classification
                      ? RESIN_LABELS[det.classification.resin]
                      : "Plastic item"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {rejected
                    ? `${((det.suppressedBy?.containment ?? 0) * 100).toFixed(0)}% inside person box`
                    : det.classification
                      ? SEVERITY_LABELS[det.classification.severity]
                      : "Awaiting classification"}
                </span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {(det.score * 100).toFixed(0)}%
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
