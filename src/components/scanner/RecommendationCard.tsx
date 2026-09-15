import { ArrowRight, Recycle, Repeat2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DECISION_LABELS,
  RESIN_LABELS,
  SEVERITY_LABELS,
  getRecommendation,
} from "@/lib/rules/recommendations";
import { cn } from "@/lib/utils";
import type { Detection } from "@/lib/vision/types";

const TONE_STYLES = {
  recycle: "border-accept/50 bg-accept/10",
  prep: "border-caution/50 bg-caution/10",
  reject: "border-reject/50 bg-reject/10",
} as const;

const TONE_BADGE = {
  recycle: "bg-accept text-accept-foreground",
  prep: "bg-caution text-caution-foreground",
  reject: "bg-reject text-reject-foreground",
} as const;


export function RecommendationCard({ detection }: { detection: Detection | null }) {
  if (!detection || !detection.classification) {
    return (
      <div className="panel flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
        <Recycle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select an accepted detection to see its disposal recommendation.
        </p>
      </div>
    );
  }

  const { resin, severity, resinConfidence, severityConfidence } = detection.classification;
  const rec = getRecommendation(resin, severity);

  return (
    <article className={cn("panel space-y-5 p-6", TONE_STYLES[rec.tone])}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold">{RESIN_LABELS[resin]}</h3>
          <p className="text-sm text-muted-foreground">{SEVERITY_LABELS[severity]}</p>
        </div>
        <Badge className={cn("rounded-full px-3 py-1", TONE_BADGE[rec.tone])}>
          {DECISION_LABELS[rec.decision]}
        </Badge>
      </header>

      <dl className="space-y-4 text-sm">
        <div className="flex gap-3">
          <Trash2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="font-medium">Disposal action</dt>
            <dd className="text-muted-foreground">{rec.action}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="font-medium">Recycling route</dt>
            <dd className="text-muted-foreground">{rec.route}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Repeat2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <dt className="font-medium">Reuse suggestion</dt>
            <dd className="text-muted-foreground">{rec.reuse}</dd>
          </div>
        </div>
      </dl>

      <footer className="flex gap-6 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
        <span>resin {(resinConfidence * 100).toFixed(1)}%</span>
        <span>severity {(severityConfidence * 100).toFixed(1)}%</span>
        <span>detector {(detection.score * 100).toFixed(1)}%</span>
      </footer>
    </article>
  );
}
