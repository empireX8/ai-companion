import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";

export type MapPageHeaderStatsProps = {
  confidenceLabel: string;
  receiptsLabel: string;
  openQuestionsLabel: string;
  className?: string;
};

/** Header stats row — markup matches `.reference/v0-orvek-workbench/components/orvek/pages/map.tsx`. */
export function MapPageHeaderStats({
  confidenceLabel,
  receiptsLabel,
  openQuestionsLabel,
  className,
}: MapPageHeaderStatsProps) {
  return (
    <div className={cn("flex items-center gap-4 text-sm", className)}>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Activity className="size-3.5 text-primary" aria-hidden />
        Confidence <span className="font-medium text-foreground">{confidenceLabel}</span>
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{receiptsLabel}</span> receipts
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{openQuestionsLabel}</span> open questions
      </span>
    </div>
  );
}
