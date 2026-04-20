"use client";

/**
 * PatternSection — one of the five locked family sections (P2-02)
 *
 * Renders a section header + description + list of PatternClaimCards.
 * Empty state shown when no claims exist for the family.
 */

import type { PatternFamilySection } from "@/lib/patterns-api";
import { SECTION_EMPTY_PRIMARY, SECTION_EMPTY_SECONDARY, candidateQualifier } from "@/lib/trust-copy";
import { PatternClaimCard } from "./PatternClaimCard";
import { PatternContradictionFamilyCard } from "./PatternContradictionFamilyCard";

type Props = {
  section: PatternFamilySection;
};

export function PatternSection({ section }: Props) {
  // Dismissed and paused claims are excluded from the main dashboard.
  // Paused/dismissed surface is handled in P2-10.
  const visibleClaims = section.claims.filter(
    (c) => c.status === "candidate" || c.status === "active"
  );
  const contradictionItems =
    section.familyKey === "contradiction_drift"
      ? section.contradictionItems ?? []
      : [];
  const hasContradictionItems = contradictionItems.length > 0;
  const hasRenderableContent = visibleClaims.length > 0 || hasContradictionItems;

  // P2-09 — distinguish empty, candidate-only, and mixed/active states
  const hasActive = visibleClaims.some((c) => c.status === "active");
  const candidateOnly = visibleClaims.length > 0 && !hasActive;

  return (
    <section aria-labelledby={`section-${section.familyKey}`} className="space-y-3">
      {/* Section header */}
      <div className="space-y-0.5">
        <h2
          id={`section-${section.familyKey}`}
          className="text-sm font-semibold text-foreground"
        >
          {section.sectionLabel}
        </h2>
        <p className="text-xs text-muted-foreground">{section.description}</p>
      </div>

      {/* P2-09 empty state */}
      {!hasRenderableContent && (
        <div className="rounded-lg border border-dashed border-border/40 px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            {SECTION_EMPTY_PRIMARY}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">
            {SECTION_EMPTY_SECONDARY}
          </p>
        </div>
      )}

      {/* P2-09 candidate-only qualifier */}
      {candidateOnly && (
        <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 italic">
          {candidateQualifier(visibleClaims.length)}
        </p>
      )}

      {/* Claims */}
      {hasContradictionItems ? (
        <PatternContradictionFamilyCard
          items={contradictionItems}
          claims={visibleClaims}
        />
      ) : (
        visibleClaims.length > 0 && (
          <div className="space-y-2">
            {visibleClaims.map((claim) => (
              <PatternClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )
      )}
    </section>
  );
}
