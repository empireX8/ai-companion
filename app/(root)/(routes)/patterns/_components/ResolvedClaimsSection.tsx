"use client";

/**
 * ResolvedClaimsSection — secondary surface for paused and dismissed claims (P2-10)
 *
 * Sits below the five main family sections on the /patterns page.
 * Collapsed by default. Does not mix with the active/candidate claim dashboard.
 * Dismissed claims retain the strikethrough visual treatment.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternClaimView, PatternFamilySection } from "@/lib/patterns-api";
import { PATTERN_FAMILY_SECTIONS } from "@/lib/patterns-api";
import { RESOLVED_SECTION_HEADING, resolvedSectionSummary } from "@/lib/trust-copy";
import { PATTERN_STATUS_LABELS } from "@/lib/trust-language";

type Props = {
  sections: PatternFamilySection[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectResolved(sections: PatternFamilySection[]): PatternClaimView[] {
  return sections.flatMap((s) =>
    s.claims.filter((c) => c.status === "paused" || c.status === "dismissed")
  );
}

function sectionLabelFor(patternType: PatternClaimView["patternType"]): string {
  return (
    PATTERN_FAMILY_SECTIONS.find((s) => s.familyKey === patternType)?.sectionLabel ??
    patternType
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResolvedClaimRow({ claim }: { claim: PatternClaimView }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        claim.status === "dismissed"
          ? "border-border/20 bg-muted/20 opacity-60"
          : "border-border/40 bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm leading-snug text-foreground/80",
            claim.status === "dismissed" && "line-through"
          )}
        >
          {claim.summary}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            claim.status === "paused"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted/50 text-muted-foreground/50"
          )}
        >
          {claim.status === "paused" ? PATTERN_STATUS_LABELS.paused : PATTERN_STATUS_LABELS.dismissed}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/60">
        {sectionLabelFor(claim.patternType)}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ResolvedClaimsSection({ sections }: Props) {
  const [open, setOpen] = useState(false);

  const resolved = collectResolved(sections);
  const pausedCount = resolved.filter((c) => c.status === "paused").length;
  const dismissedCount = resolved.filter((c) => c.status === "dismissed").length;

  if (resolved.length === 0) return null;

  const summary = resolvedSectionSummary(pausedCount, dismissedCount);

  return (
    <section className="border-t border-border/30 pt-6">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {RESOLVED_SECTION_HEADING}
          </h2>
          <p className="text-[11px] text-muted-foreground/60">{summary}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded list */}
      {open && (
        <div className="mt-4 space-y-2">
          {resolved.map((claim) => (
            <ResolvedClaimRow key={claim.id} claim={claim} />
          ))}
        </div>
      )}
    </section>
  );
}
