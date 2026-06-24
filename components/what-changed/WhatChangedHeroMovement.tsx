import Link from "next/link";

import { SectionLabel } from "@/components/AppShell";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { PublicEvidenceContinuityItem } from "@/lib/public-evidence-continuity";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import {
  formatWhatChangedDateTime,
  toWhatChangedMovementTitle,
  WHAT_CHANGED_EVIDENCE_INTRO,
  WHAT_CHANGED_EVIDENCE_LABEL,
  WHAT_CHANGED_REENTRY_INTRO,
  WHAT_CHANGED_REENTRY_LABEL,
  WHAT_CHANGED_REENTRY_LINKS,
  WHAT_CHANGED_WHAT_CHANGED_LABEL,
  WHAT_CHANGED_WHY_LABEL,
} from "@/lib/what-changed-surface";

import { WhatChangedInspectorButton } from "./WhatChangedInspectorButton";

export function WhatChangedHeroMovement({
  item,
  evidenceItems,
}: {
  item: WhatChangedListItem;
  evidenceItems: PublicEvidenceContinuityItem[];
}) {
  return (
    <article
      className="ml-raised overflow-hidden rounded-2xl"
      data-testid="what-changed-primary-movement"
    >
      <div
        className="px-5 py-2.5"
        style={{
          backgroundColor: "color-mix(in oklab, var(--ml-action-muted) 50%, transparent)",
        }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ml-action-foreground)]">
          {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
        </span>
      </div>
      <div className="space-y-5 p-5">
        <section>
          <SectionLabel>{WHAT_CHANGED_WHAT_CHANGED_LABEL}</SectionLabel>
          <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">
            {toWhatChangedMovementTitle(item)}
          </p>
          <div className="label-meta mt-2">
            Recorded {formatWhatChangedDateTime(item.createdAt)}
          </div>
        </section>

        <section>
          <SectionLabel>{WHAT_CHANGED_WHY_LABEL}</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {item.userFacingSummary}
          </p>
        </section>

        <section>
          <PublicLinkedObjectContinuity
            objectType={item.affectedObjectType}
            objectId={item.affectedObjectId}
            href={item.affectedObjectHref}
            context="model_update"
          />
          <WhatChangedInspectorButton item={item} />
        </section>

        {evidenceItems.length > 0 ? (
          <section>
            <SectionLabel>{WHAT_CHANGED_EVIDENCE_LABEL}</SectionLabel>
            <p className="mb-3 text-[12px] text-muted-foreground">{WHAT_CHANGED_EVIDENCE_INTRO}</p>
            <div className="space-y-2">
              {evidenceItems.map((evidence) => (
                <article
                  key={`${evidence.id}-${evidence.createdAt}`}
                  className="ml-material rounded-xl p-4 text-[13px]"
                >
                  <div className="label-meta text-cyan/70">{evidence.evidenceSummaryLabel}</div>
                  {evidence.href ? (
                    <Link href={evidence.href} className="text-cyan hover:underline">
                      {evidence.sourceTypeLabel}
                    </Link>
                  ) : (
                    <span>{evidence.sourceTypeLabel}</span>
                  )}
                  <div className="label-meta mt-1 text-meta">
                    Linked {formatWhatChangedDateTime(evidence.createdAt)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionLabel>{WHAT_CHANGED_REENTRY_LABEL}</SectionLabel>
          <p className="mb-3 text-[12px] text-muted-foreground">{WHAT_CHANGED_REENTRY_INTRO}</p>
          <div className="flex flex-wrap gap-2">
            {WHAT_CHANGED_REENTRY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="ml-calm ml-material rounded-lg px-3 py-2 text-[12px] font-medium hover:bg-white/[0.03]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
