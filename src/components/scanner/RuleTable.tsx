import {
  RECOMMENDATIONS,
  RESIN_LABELS,
  SEVERITY_LABELS,
} from "@/lib/rules/recommendations";
import { cn } from "@/lib/utils";
import { RESINS, SEVERITIES } from "@/lib/vision/types";

const TONE_CELL = {
  recycle: "border-accept/40 bg-accept/5",
  prep: "border-caution/40 bg-caution/5",
  reject: "border-reject/40 bg-reject/5",
} as const;

/** The Stage 3 lookup, rendered in full: 4 resins x 3 severities. */
export function RuleTable() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {RESINS.flatMap((resin) =>
        SEVERITIES.map((severity) => {
          const rec = RECOMMENDATIONS[resin][severity];
          return (
            <article
              key={`${resin}-${severity}`}
              className={cn("rounded-xl border p-4", TONE_CELL[rec.tone])}
            >
              <h3 className="text-sm font-semibold">{RESIN_LABELS[resin]}</h3>
              <p className="text-xs text-muted-foreground">{SEVERITY_LABELS[severity]}</p>
              <p className="mt-3 text-sm">{rec.action}</p>
              <p className="mt-2 text-xs text-muted-foreground">{rec.route}</p>
              <p className="mt-1 text-xs text-muted-foreground italic">{rec.reuse}</p>
            </article>
          );
        }),
      )}
    </div>
  );
}
