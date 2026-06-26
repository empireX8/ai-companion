"use client";

import { Activity } from "lucide-react";

export type ProductionMapHeaderProps = {
  confidenceLabel: string;
  receiptsLabel: string;
  openQuestionsLabel: string;
  isLoading?: boolean;
  loadError?: string | null;
  emptyCopy?: string;
  showEmptyCopy?: boolean;
};

/**
 * Production Map header — markup matches `.reference/v0-orvek-workbench/components/orvek/pages/map.tsx`.
 * Lives in orvek-workbench so production layout can diverge without touching the reference route.
 */
export function ProductionMapHeader({
  confidenceLabel,
  receiptsLabel,
  openQuestionsLabel,
  loadError,
  emptyCopy,
  showEmptyCopy,
}: ProductionMapHeaderProps) {
  return (
    <div className="px-6 pt-5 pb-4 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Map</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What Orvek currently understands — evidence-backed and correctable.
          </p>
        </div>
        <div className="flex items-baseline justify-end gap-6 whitespace-nowrap text-sm">
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-muted-foreground xl:min-w-[185.5625px]">
            <Activity className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-medium tabular-nums text-foreground">{confidenceLabel}</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap xl:min-w-[79.1875px]">
            <span className="font-medium tabular-nums text-foreground">{receiptsLabel}</span>
            <span className="text-muted-foreground">receipts</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap xl:min-w-[108.125px]">
            <span className="font-medium tabular-nums text-foreground">{openQuestionsLabel}</span>
            <span className="text-muted-foreground">open questions</span>
          </span>
        </div>
      </div>
      {loadError ? <p className="mt-2 text-[13px] text-destructive">{loadError}</p> : null}
      {showEmptyCopy ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{emptyCopy}</p>
      ) : null}
    </div>
  );
}
