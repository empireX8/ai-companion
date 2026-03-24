"use client";

/**
 * PatternActionControls — lightweight interaction controls (P2.5-05)
 * Includes inline post-action reflection capture (P2.5-06)
 *
 * State machine:
 *   pending    → "I'll try this" (→ in_progress) | "Not now" (→ skipped)
 *   in_progress → "Done" (→ completed + reflection) | "Didn't work" (→ abandoned)
 *   completed   → summary display
 *   skipped     → "Try again" re-suggests
 *   abandoned   → "Try again" re-suggests
 *
 * No planner UI, no due dates, no streaks.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PatternClaimActionView } from "@/lib/patterns-api";
import { updateClaimAction } from "@/lib/patterns-api";
import {
  ACTION_STEP_COMPLETED,
  ACTION_STEP_SKIPPED,
  ACTION_STEP_ABANDONED,
  ACTION_TRY_DIFFERENT,
  ACTION_ILL_TRY_THIS,
  ACTION_NOT_NOW,
  ACTION_DONE,
  ACTION_DIDNT_WORK,
} from "@/lib/trust-copy";
import { ReflectionCapture } from "./ReflectionCapture";

type Props = {
  action: PatternClaimActionView;
  onUpdate: (updated: PatternClaimActionView) => void;
  onDismiss: () => void; // called after skipped/abandoned + user wants a new step
};

export function PatternActionControls({ action, onUpdate, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  const patch = async (
    status: PatternClaimActionView["status"],
    outcomeSignal?: "helpful" | "not_helpful" | "unclear"
  ) => {
    setBusy(true);
    const updated = await updateClaimAction(action.id, { status, outcomeSignal });
    setBusy(false);
    if (updated) onUpdate(updated);
  };

  // Completed — show reflection prompt (P2.5-06) or summary
  if (action.status === "completed") {
    if (showReflection || !action.reflectionNote) {
      return (
        <ReflectionCapture
          actionId={action.id}
          existingNote={action.reflectionNote}
          onSaved={(updated) => {
            onUpdate(updated);
            setShowReflection(false);
          }}
        />
      );
    }
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-primary/70 font-medium">{ACTION_STEP_COMPLETED}</p>
        {action.reflectionNote && (
          <p className="text-[11px] text-muted-foreground italic line-clamp-2">
            &ldquo;{action.reflectionNote}&rdquo;
          </p>
        )}
      </div>
    );
  }

  // Skipped or abandoned — offer to try again
  if (action.status === "skipped" || action.status === "abandoned") {
    return (
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-muted-foreground/70">
          {action.status === "skipped" ? ACTION_STEP_SKIPPED : ACTION_STEP_ABANDONED}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] text-primary hover:underline"
        >
          {ACTION_TRY_DIFFERENT}
        </button>
      </div>
    );
  }

  // Pending
  if (action.status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => patch("in_progress")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            "bg-primary/15 text-primary hover:bg-primary/25",
            busy && "opacity-50 cursor-not-allowed"
          )}
        >
          {ACTION_ILL_TRY_THIS}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => patch("skipped")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            busy && "opacity-50 cursor-not-allowed"
          )}
        >
          {ACTION_NOT_NOW}
        </button>
      </div>
    );
  }

  // In progress
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void patch("completed", "helpful");
          setShowReflection(true);
        }}
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
          "bg-primary/15 text-primary hover:bg-primary/25",
          busy && "opacity-50 cursor-not-allowed"
        )}
      >
        {ACTION_DONE}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => patch("abandoned", "not_helpful")}
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
          "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          busy && "opacity-50 cursor-not-allowed"
        )}
      >
        {ACTION_DIDNT_WORK}
      </button>
    </div>
  );
}
