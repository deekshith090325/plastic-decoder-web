import type { Resin, Severity } from "@/lib/vision/types";

export interface Recommendation {
  /** Stage 3 column 1: what to do with the item right now. */
  action: string;
  /** Stage 3 column 2: where the material should go. */
  route: string;
  /** Stage 3 column 3: a reuse idea before recycling. */
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

/**
 * Stage 3 lookup: 4 resins x 3 severities = 12 rows.
 * Nested Record (rather than an array) so TypeScript enforces every cell.
 */
export const RECOMMENDATIONS: Record<Resin, Record<Severity, Recommendation>> = {
  PET: {
    clean_or_light: {
      action: "Empty, cap off, place directly in the recycling stream.",
      route: "Bottle-to-bottle rPET — highest value food-grade loop.",
      reuse: "Refill for non-potable water, or use as a seedling cloche.",
      tone: "recycle",
    },
    moderate_dirt_synth: {
      action: "Rinse with cold water and drain before binning.",
      route: "rPET flake for fibre and strapping after wash-line cleaning.",
      reuse: "Cut down into a desk organiser or storage scoop.",
      tone: "prep",
    },
    high_dirt_synth: {
      action: "Do not place in the recycling stream — residue will taint the bale.",
      route: "General waste, or energy recovery where available.",
      reuse: "Not recommended for reuse in this condition.",
      tone: "reject",
    },
  },
  "PE-HD": {
    clean_or_light: {
      action: "Empty and recycle as-is; the label can stay on.",
      route: "Rigid HDPE regrind for pipe, crates and new bottles.",
      reuse: "Sturdy enough as a workshop container or plant pot.",
      tone: "recycle",
    },
    moderate_dirt_synth: {
      action: "Rinse out detergent or food residue, then recycle.",
      route: "Non-food-grade HDPE regrind — outdoor furniture, drainage.",
      reuse: "Cut into a scoop, funnel or tool caddy.",
      tone: "prep",
    },
    high_dirt_synth: {
      action: "Divert from recycling; chemical or oily residue contaminates the batch.",
      route: "General waste; hazardous stream if it held solvents or oil.",
      reuse: "Not recommended for reuse in this condition.",
      tone: "reject",
    },
  },
  PP: {
    clean_or_light: {
      action: "Empty, keep the lid attached, recycle.",
      route: "PP regrind for automotive parts, crates and caps.",
      reuse: "Excellent lunch or pantry container — PP is heat tolerant.",
      tone: "recycle",
    },
    moderate_dirt_synth: {
      action: "Scrape and rinse off grease before binning; dry if possible.",
      route: "Mixed PP regrind for non-food injection moulding.",
      reuse: "Use for paint, screws or garage storage rather than food.",
      tone: "prep",
    },
    high_dirt_synth: {
      action: "Keep out of the recycling stream — baked-on grease cannot be washed out.",
      route: "General waste or energy recovery.",
      reuse: "Not recommended for reuse in this condition.",
      tone: "reject",
    },
  },
  PS: {
    clean_or_light: {
      action: "Check local acceptance — many kerbside programmes reject PS.",
      route: "Specialist PS drop-off point where one exists.",
      reuse: "Reuse as a drawer divider or protective packing insert.",
      tone: "prep",
    },
    moderate_dirt_synth: {
      action: "Rinse, but expect most facilities to refuse it.",
      route: "Rarely recycled — general waste in most regions.",
      reuse: "Short-term storage tray only; PS embrittles with age.",
      tone: "prep",
    },
    high_dirt_synth: {
      action: "Dispose of in general waste — no viable recycling route.",
      route: "Landfill or energy recovery.",
      reuse: "Not recommended for reuse in this condition.",
      tone: "reject",
    },
  },
};

export function getRecommendation(resin: Resin, severity: Severity): Recommendation {
  return RECOMMENDATIONS[resin][severity];
}
