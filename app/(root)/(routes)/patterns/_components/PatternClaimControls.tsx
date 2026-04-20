"use client";

/**
 * PatternClaimControls — correction and refinement controls (P2-07)
 *
 * Seven locked labels, two-phase UI:
 *   Phase 1 (idle):   "Looks right" | "Not quite" | "Add context" | "Pause this claim"
 *   Phase 2 (refine): revealed after "Not quite" → "Wrong condition" | "Wrong outcome" | "Missing context"
 *
 * UI-only stubs in Slice 6. Backend mutations handled in Packet 2.5.
 * Do NOT wire API calls here — that is out of scope for this slice.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CLAIM_CONTROL_PRIMARY,
  CLAIM_CONTROL_CONTEXT,
  CLAIM_CONTROL_REFINEMENT,
  CLAIM_CONTROL_REFINE_PROMPT,
} from "@/lib/trust-copy";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "refine";

type Props = {
  claimId: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PatternClaimControls({ claimId }: Props) {
  void claimId;
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<string | null>(null);

  const handlePrimary = (key: string) => {
    if (key === "not_quite") {
      setPhase("refine");
      setSelected(key);
    } else {
      setSelected((prev) => (prev === key ? null : key));
      setPhase("idle");
    }
  };

  const handleContextAction = (key: string) => {
    setSelected((prev) => (prev === key ? null : key));
  };

  const handleRefinement = (key: string) => {
    setSelected((prev) => (prev === key ? null : key));
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
      {/* Primary feedback + context actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CLAIM_CONTROL_PRIMARY.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => handlePrimary(action.key)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              selected === action.key
                ? action.variant === "positive"
                  ? "bg-primary/20 text-primary"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {action.label}
          </button>
        ))}

        <span className="text-muted-foreground/30 text-[11px]">·</span>

        {CLAIM_CONTROL_CONTEXT.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => handleContextAction(action.key)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              selected === action.key
                ? "bg-muted text-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Refinement row — revealed after "Not quite" */}
      {phase === "refine" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60 mr-0.5">{CLAIM_CONTROL_REFINE_PROMPT}</span>
          {CLAIM_CONTROL_REFINEMENT.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => handleRefinement(action.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                selected === action.key
                  ? "bg-muted text-foreground ring-1 ring-border"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
