import type { Resin, Severity } from "@/lib/vision/types";

export type DecisionClass = "Recycle_after_clean" | "Prefer_reuse" | "Dispose";

export interface Recommendation {
  /** Stage 3 column 1: the decision class for this (resin, severity) pair. */
  decision: DecisionClass;
  /** Stage 3 column 2: what to do with the item right now. */
  action: string;
  /** Stage 3 column 3: where the material should go. */
  route: string;
  /** Practical reuse idea shown alongside the decision. */
  reuse: string;
  /** Drives card styling via design tokens. */
  tone: "recycle" | "prep" | "reject";
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  clean_or_light: "Clean / light soiling",
  moderate_dirt_synth: "Moderate contamination",
  high_dirt_synth: "Heavy contamination",
};

export const RESIN_LABELS: Record<Resin, string> = {
  PET: "PET (1)",
  "PE-HD": "HDPE (2)",
  PP: "PP (5)",
  PS: "PS (6)",
};

export const DECISION_LABELS: Record<DecisionClass, string> = {
  Recycle_after_clean: "Recycle after clean",
  Prefer_reuse: "Prefer reuse",
  Dispose: "Dispose",
};

const TONE_BY_DECISION: Record<DecisionClass, Recommendation["tone"]> = {
  Recycle_after_clean: "recycle",
  Prefer_reuse: "prep",
  Dispose: "reject",
};

function row(
  decision: DecisionClass,
  action: string,
  route: string,
  reuse: string,
): Recommendation {
  return { decision, action, route, reuse, tone: TONE_BY_DECISION[decision] };
}

/**
 * Stage 3 lookup: 4 resins x 3 severities = 12 rows.
 * Nested Record (rather than an array) so TypeScript enforces every cell.
 */
export const RECOMMENDATIONS: Record<Resin, Record<Severity, Recommendation>> = {
  PET: {
    clean_or_light: row(
      "Recycle_after_clean",
      "Recycle (rinse first if residue visible)",
      "Mechanical (bottle-to-bottle/fiber)",
      "Refill for non-potable use, or use as a seedling cloche.",
    ),
    moderate_dirt_synth: row(
      "Recycle_after_clean",
      "Recycle if cleaned; otherwise divert",
      "Wash-then-mechanical / glycolysis",
      "Cut down into a desk organiser or storage scoop.",
    ),
    high_dirt_synth: row(
      "Dispose",
      "Dispose",
      "Cement-kiln co-processing / road-bitumen mix",
      "Not recommended for reuse in this condition.",
    ),
  },
  "PE-HD": {
    clean_or_light: row(
      "Recycle_after_clean",
      "Recycle (rinse first if residue visible)",
      "Mechanical (bottle-to-bottle/downcycled)",
      "Sturdy enough as a workshop container or plant pot.",
    ),
    moderate_dirt_synth: row(
      "Recycle_after_clean",
      "Recycle if cleaned; otherwise divert",
      "Wash-then-mechanical / pyrolysis",
      "Cut into a scoop, funnel or tool caddy.",
    ),
    high_dirt_synth: row(
      "Dispose",
      "Dispose",
      "Cement-kiln / road-construction mix",
      "Not recommended for reuse in this condition.",
    ),
  },
  PP: {
    clean_or_light: row(
      "Recycle_after_clean",
      "Recycle where collection exists, else reuse",
      "Mechanical",
      "Excellent lunch or pantry container — PP is heat tolerant.",
    ),
    moderate_dirt_synth: row(
      "Prefer_reuse",
      "Prefer reuse over recycling",
      "Wash-then-mechanical (marginal) / pyrolysis",
      "Use for paint, screws or garage storage rather than food.",
    ),
    high_dirt_synth: row(
      "Dispose",
      "Dispose",
      "Cement-kiln / road-construction mix",
      "Not recommended for reuse in this condition.",
    ),
  },
  PS: {
    clean_or_light: row(
      "Prefer_reuse",
      "Recycle only if buyer + non-SUP confirmed, else reuse/dispose",
      "Mechanical (rarely available)",
      "Reuse as a drawer divider or protective packing insert.",
    ),
    moderate_dirt_synth: row(
      "Dispose",
      "Dispose",
      "Cement-kiln co-processing",
      "Not recommended for reuse in this condition.",
    ),
    high_dirt_synth: row(
      "Dispose",
      "Dispose",
      "Cement-kiln / waste-to-energy",
      "Not recommended for reuse in this condition.",
    ),
  },
};

export function getRecommendation(resin: Resin, severity: Severity): Recommendation {
  return RECOMMENDATIONS[resin][severity];
}
