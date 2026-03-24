"use client";

/**
 * PatternActionSlot — "one next step" slot on the claim review surface (P2.5-02)
 *
 * Rendered inside the expanded review area of PatternClaimCard.
 * Shows the current action (if any) with interaction controls.
 * Shows a gate message when the claim isn't mature enough.
 * Shows a "Suggest a step" button when ready but no action exists yet.
 *
 * P2.5-09: empty and low-signal states are handled here with honest copy.
 */

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternClaimView, PatternClaimActionView } from "@/lib/patterns-api";
import { suggestClaimAction } from "@/lib/patterns-api";
import { isActionReady, getActionGateReason } from "@/lib/pattern-claim-action";
import { ACTION_SUGGEST_IDLE, ACTION_SUGGEST_BUSY } from "@/lib/trust-copy";
import { PatternActionControls } from "./PatternActionControls";

type Props = {
  claim: PatternClaimView;
};

export function PatternActionSlot({ claim }: Props) {
  const [action, setAction] = useState<PatternClaimActionView | null>(
    claim.action
  );
  const [suggesting, setSuggesting] = useState(false);

  const ready = isActionReady(claim);
  const gateReason = ready ? null : getActionGateReason(claim);

  // P2.5-09 — dismissed claims: no slot at all
  if (claim.status === "dismissed") return null;

  // Not ready: honest gate message
  if (!ready && gateReason) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground/60 italic">
        {gateReason}
      </p>
    );
  }

  // Ready, no action yet — offer to generate one
  if (!action) {
    return (
      <div className="mt-3">
        <button
          type="button"
          disabled={suggesting}
          onClick={async () => {
            setSuggesting(true);
            const created = await suggestClaimAction(claim.id);
            setSuggesting(false);
            if (created) setAction(created);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
            "bg-primary/10 text-primary hover:bg-primary/20",
            suggesting && "opacity-50 cursor-not-allowed"
          )}
        >
          <Lightbulb className="h-3 w-3" />
          <span>{suggesting ? ACTION_SUGGEST_BUSY : ACTION_SUGGEST_IDLE}</span>
        </button>
      </div>
    );
  }

  // Active action — show prompt + controls
  return (
    <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-1.5">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
        <p className="text-xs text-foreground leading-snug">{action.prompt}</p>
      </div>

      <PatternActionControls
        action={action}
        onUpdate={(updated) => setAction(updated)}
        onDismiss={() => setAction(null)}
      />
    </div>
  );
}
