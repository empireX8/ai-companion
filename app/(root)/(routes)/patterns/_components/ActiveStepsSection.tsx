"use client";

/**
 * ActiveStepsSection — minimal cross-claim action view inside Patterns (P2.5-08)
 *
 * Renders a compact inline list of claims with pending/in_progress actions.
 * This is NOT a separate destination — it lives inside /patterns only.
 * Returns null when there are no active steps (P2.5-09).
 *
 * Data comes from the already-loaded sections prop (no extra fetch).
 */

import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternFamilySection, PatternClaimView } from "@/lib/patterns-api";
import { PATTERN_FAMILY_SECTIONS } from "@/lib/patterns-api";
import {
  ACTIVE_STEPS_HEADING,
  ACTIVE_STEPS_SUBHEADING,
  ACTIVE_STEPS_STATUS_PROGRESS,
  ACTIVE_STEPS_STATUS_PENDING,
  ACTIVE_STEPS_FROM_PREFIX,
} from "@/lib/trust-copy";

type Props = {
  sections: PatternFamilySection[];
};

type ActiveStep = {
  claim: PatternClaimView;
  sectionLabel: string;
};

function collectActiveSteps(sections: PatternFamilySection[]): ActiveStep[] {
  const steps: ActiveStep[] = [];
  for (const section of sections) {
    for (const claim of section.claims) {
      if (
        claim.action &&
        (claim.action.status === "pending" || claim.action.status === "in_progress")
      ) {
        steps.push({ claim, sectionLabel: section.sectionLabel });
      }
    }
  }
  return steps;
}

function sectionLabelFor(patternType: PatternClaimView["patternType"]): string {
  return (
    PATTERN_FAMILY_SECTIONS.find((s) => s.familyKey === patternType)?.sectionLabel ??
    patternType
  );
}

export function ActiveStepsSection({ sections }: Props) {
  const steps = collectActiveSteps(sections);

  // P2.5-09 — hide entirely when no active steps
  if (steps.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary/70" />
        <h2 className="text-sm font-semibold text-foreground">{ACTIVE_STEPS_HEADING}</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {ACTIVE_STEPS_SUBHEADING}
      </p>

      <div className="space-y-2">
        {steps.map(({ claim }) => (
          <div
            key={claim.id}
            className={cn(
              "rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs space-y-1"
            )}
          >
            {/* Family + status badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/70">
                {sectionLabelFor(claim.patternType)}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  claim.action!.status === "in_progress"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/60 text-muted-foreground"
                )}
              >
                {claim.action!.status === "in_progress" ? ACTIVE_STEPS_STATUS_PROGRESS : ACTIVE_STEPS_STATUS_PENDING}
              </span>
            </div>

            {/* Experiment prompt */}
            <p className="text-foreground/80 leading-snug line-clamp-2">
              {claim.action!.prompt}
            </p>

            {/* Claim context */}
            <p className="text-[10px] text-muted-foreground/60 italic line-clamp-1">
              {ACTIVE_STEPS_FROM_PREFIX} {claim.summary}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
