"use client";

/**
 * PatternClaimCard — canonical claim card template (P2-03, P2-04, P2-05, P2-06)
 *
 * One card shape used by all five family sections.
 * Visually distinguishes all four claim states: candidate, active, paused, dismissed.
 * Shows strength as a qualitative label (no numeric score). P2-06
 * Embeds PatternReceiptList for progressive disclosure of evidence. P2-05
 */

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternClaimView } from "@/lib/patterns-api";
import { STRENGTH_LABELS, EVIDENCE_LIMITED, evidenceScopeLabel, EARLY_SIGNAL_QUALIFIER } from "@/lib/trust-copy";
import { PATTERN_STATUS_LABELS } from "@/lib/trust-language";
import { PatternReceiptList } from "./PatternReceiptList";
import { PatternClaimControls } from "./PatternClaimControls";
import { PatternActionSlot } from "./PatternActionSlot";

// ── State visual config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PatternClaimView["status"],
  {
    borderClass: string;
    badgeClass: string;
    label: string;
    wrapperClass?: string;
  }
> = {
  candidate: {
    borderClass: "border-border/40",
    badgeClass: "bg-muted text-muted-foreground",
    label: PATTERN_STATUS_LABELS.candidate,
  },
  active: {
    borderClass: "border-primary/30",
    badgeClass: "bg-primary/10 text-primary",
    label: PATTERN_STATUS_LABELS.active,
  },
  paused: {
    borderClass: "border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: PATTERN_STATUS_LABELS.paused,
  },
  dismissed: {
    borderClass: "border-border/20",
    badgeClass: "bg-muted/50 text-muted-foreground/50",
    label: PATTERN_STATUS_LABELS.dismissed,
    wrapperClass: "opacity-50",
  },
};

const STRENGTH_BAR_CLASS: Record<PatternClaimView["strengthLevel"], string> = {
  tentative: "bg-muted-foreground/30 w-1/3",
  developing: "bg-primary/50 w-2/3",
  established: "bg-primary w-full",
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  claim: PatternClaimView;
};

export function PatternClaimCard({ claim }: Props) {
  const config = STATUS_CONFIG[claim.status];
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 transition-colors",
        config.borderClass,
        config.wrapperClass
      )}
    >
      {/* Header: summary + status badge */}
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            claim.status === "dismissed" && "line-through"
          )}
        >
          {claim.summary}
        </p>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            config.badgeClass
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Strength + scope row — P2-06 qualitative only */}
      {claim.status !== "dismissed" && (
        <div className="mt-2.5 flex items-center gap-3">
          {/* Qualitative strength bar */}
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  STRENGTH_BAR_CLASS[claim.strengthLevel]
                )}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {STRENGTH_LABELS[claim.strengthLevel] ?? claim.strengthLevel}
            </span>
          </div>

          {/* Scope — sample size context, P2-06 */}
          <span className="text-[11px] text-muted-foreground/70">
            {claim.evidenceCount === 0 || claim.sessionCount <= 1
              ? EVIDENCE_LIMITED
              : evidenceScopeLabel(claim.evidenceCount, claim.sessionCount)}
          </span>
        </div>
      )}

      {/* Low-data qualifier — P2-06 locked language */}
      {claim.status !== "dismissed" &&
        (claim.strengthLevel === "tentative" || claim.sessionCount <= 1) && (
          <p className="mt-2 text-[11px] text-muted-foreground/60 italic">
            {EARLY_SIGNAL_QUALIFIER}
          </p>
        )}

      {/* Inline evidence receipts — P2-05 progressive disclosure */}
      {claim.status !== "dismissed" && (
        <PatternReceiptList
          receipts={claim.receipts}
          evidenceCount={claim.evidenceCount}
        />
      )}

      {/* Expanded review surface — P2-08 */}
      {claim.status !== "dismissed" && (
        <>
          <button
            type="button"
            onClick={() => setReviewOpen((v) => !v)}
            className={cn(
              "mt-2.5 flex items-center gap-1 text-[11px] transition-colors",
              reviewOpen
                ? "text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>{reviewOpen ? "Close review" : "Review this claim"}</span>
          </button>

          {reviewOpen && (
            <div className="space-y-1">
              {/* P2.5-02 — one next step slot */}
              <PatternActionSlot claim={claim} />
              {/* P2-07 correction/refinement controls */}
              <PatternClaimControls claimId={claim.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
