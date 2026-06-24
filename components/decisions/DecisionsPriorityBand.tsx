"use client";

import { SectionLabel } from "@/components/AppShell";
import type { ActionPrioritySnapshot } from "@/lib/actions-api";
import {
  DECISIONS_PRIORITY_SECTION_INTRO,
  DECISIONS_PRIORITY_SECTION_LABEL,
} from "@/lib/decisions-surface";

export function DecisionsPriorityBand({
  snapshot,
}: {
  snapshot: ActionPrioritySnapshot;
}) {
  if (!snapshot.hasData || snapshot.featured.length === 0) {
    return null;
  }

  return (
    <section
      className="ml-material mb-5 rounded-2xl p-5"
      data-testid="decisions-priority-band"
    >
      <SectionLabel>{DECISIONS_PRIORITY_SECTION_LABEL}</SectionLabel>
      <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
        {DECISIONS_PRIORITY_SECTION_INTRO}
      </p>
      <ul className="space-y-2">
        {snapshot.featured.map((claim) => (
          <li
            key={claim.id}
            className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-[13px] text-muted-foreground"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-cyan/70">
              {claim.patternType.replace(/_/g, " ")}
            </span>
            <p className="mt-1 font-medium text-foreground">{claim.summary}</p>
          </li>
        ))}
      </ul>
      {snapshot.totalActive > snapshot.featured.length ? (
        <p className="label-meta mt-3">
          {snapshot.totalActive} active pattern{snapshot.totalActive === 1 ? "" : "s"} in scope
        </p>
      ) : null}
    </section>
  );
}
