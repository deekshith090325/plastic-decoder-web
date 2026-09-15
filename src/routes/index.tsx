import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { RuleTable } from "@/components/scanner/RuleTable";

const ScannerStage = lazy(() => import("@/components/scanner/ScannerStage"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PolySort — Contamination-Aware Plastic Sorting Demo" },
      {
        name: "description",
        content:
          "Live in-browser demo: detects plastic items, excludes people from the frame, then classifies resin type and contamination to recommend a disposal route.",
      },
      { property: "og:title", content: "PolySort — Contamination-Aware Plastic Sorting" },
      {
        property: "og:description",
        content:
          "Webcam plastic detection with person exclusion, resin and contamination classification, and a 12-row disposal rule table. Runs entirely in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function StageSkeleton() {
  return (
    <div className="panel flex h-96 items-center justify-center text-sm text-muted-foreground">
      Preparing the in-browser pipeline…
    </div>
  );
}

function Index() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-accept uppercase">
            On-device pipeline · no server
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
            Contamination-aware <span className="text-signal">plastic sorting</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Point a camera at an item. A plastic detector finds it, a person detector
            vetoes anything overlapping a human, and two classifiers read resin type and
            contamination level to produce a disposal recommendation.
          </p>
        </div>
        <Link
          to="/about"
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accept/60"
        >
          How the pipeline works
        </Link>
      </header>

      <ClientOnly fallback={<StageSkeleton />}>
        <Suspense fallback={<StageSkeleton />}>
          <ScannerStage />
        </Suspense>
      </ClientOnly>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Stage 3 — disposal rule table</h2>
        <p className="mt-2 mb-6 max-w-2xl text-sm text-muted-foreground">
          Every (resin, contamination) pair maps to exactly one row: a disposal action, a
          recycling route and a reuse suggestion.
        </p>
        <RuleTable />
      </section>
    </main>
  );
}
