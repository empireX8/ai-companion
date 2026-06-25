"use client";

import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

import { WhatChangedInspectorButton } from "@/components/what-changed/WhatChangedInspectorButton";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { PublicEvidenceContinuityItem } from "@/lib/public-evidence-continuity";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import {
  formatWhatChangedDateTime,
  toWhatChangedMovementTitle,
  WHAT_CHANGED_EARLIER_SECTION_INTRO,
  WHAT_CHANGED_EARLIER_SECTION_LABEL,
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_EMPTY_SECONDARY,
  WHAT_CHANGED_EVIDENCE_INTRO,
  WHAT_CHANGED_EVIDENCE_LABEL,
  WHAT_CHANGED_PAGE_INTRO,
  WHAT_CHANGED_PAGE_META,
  WHAT_CHANGED_PAGE_TITLE,
  WHAT_CHANGED_PRIMARY_SECTION_INTRO,
  WHAT_CHANGED_PRIMARY_SECTION_LABEL,
  WHAT_CHANGED_REENTRY_INTRO,
  WHAT_CHANGED_REENTRY_LABEL,
  WHAT_CHANGED_REENTRY_LINKS,
  WHAT_CHANGED_WHAT_CHANGED_LABEL,
  WHAT_CHANGED_WHY_LABEL,
} from "@/lib/what-changed-surface";

import { BeforeAfter, SectionLabel } from "./OrvekPrimitives";
import { useOrvekInspector } from "./useOrvekInspector";

export type OrvekWhatChangedViewProps = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
};

function EarlierMovementCard({ item }: { item: WhatChangedListItem }) {
  const { select, setInspectorTab } = useOrvekInspector();
  const title = toWhatChangedMovementTitle(item);

  return (
    <button
      type="button"
      onClick={() => {
        select({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title,
          tab: "movement",
        });
        setInspectorTab("movement");
      }}
      className="o-calm block w-full rounded-[10px] bg-card p-2.5 text-left shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatWhatChangedDateTime(item.createdAt)}
        </span>
      </div>
      <BeforeAfter after={item.userFacingSummary} compact />
      <div className="mt-2">
        <PublicLinkedObjectContinuity
          objectType={item.affectedObjectType}
          objectId={item.affectedObjectId}
          href={item.affectedObjectHref}
          context="model_update"
          linkClassName="text-[11px] font-medium text-primary hover:underline"
          containerClassName="text-[11px] text-muted-foreground"
        />
      </div>
    </button>
  );
}

function PrimaryMovementSection({
  item,
  evidenceItems,
}: {
  item: WhatChangedListItem;
  evidenceItems: PublicEvidenceContinuityItem[];
}) {
  return (
    <section className="o-material overflow-hidden rounded-2xl">
      <div className="bg-action-muted/40 px-5 py-3 ring-1 ring-inset ring-action/15">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
          {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
        </span>
      </div>
      <div className="space-y-5 p-5">
        <section>
          <SectionLabel>{WHAT_CHANGED_WHAT_CHANGED_LABEL}</SectionLabel>
          <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">
            {toWhatChangedMovementTitle(item)}
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
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
            linkClassName="text-[13px] font-medium text-primary hover:underline"
            containerClassName="text-[13px] text-muted-foreground"
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
                  className="o-sunken rounded-[10px] p-3.5 text-[13px]"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {evidence.evidenceSummaryLabel}
                  </div>
                  {evidence.href ? (
                    <Link href={evidence.href} className="text-primary hover:underline">
                      {evidence.sourceTypeLabel}
                    </Link>
                  ) : (
                    <span>{evidence.sourceTypeLabel}</span>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
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
                className="o-calm o-material rounded-lg px-3 py-2 text-[12px] font-medium hover:bg-accent/40"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function OrvekWhatChangedView({
  primary,
  earlier,
  evidenceItems,
}: OrvekWhatChangedViewProps) {
  const hasItems = Boolean(primary) || earlier.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {WHAT_CHANGED_PAGE_TITLE}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{WHAT_CHANGED_PAGE_META}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-6 max-w-2xl text-[13px] text-muted-foreground">
            {WHAT_CHANGED_PAGE_INTRO}
          </p>

          {!hasItems ? (
            <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
              <p>{WHAT_CHANGED_EMPTY_PRIMARY}</p>
              <p className="text-muted-foreground/80">{WHAT_CHANGED_EMPTY_SECONDARY}</p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="what-changed-list">
              {primary ? (
                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
                    <SectionLabel>{WHAT_CHANGED_PRIMARY_SECTION_LABEL}</SectionLabel>
                  </div>
                  <p className="mb-3 text-[12px] text-muted-foreground">
                    {WHAT_CHANGED_PRIMARY_SECTION_INTRO}
                  </p>
                  <PrimaryMovementSection item={primary} evidenceItems={evidenceItems} />
                </section>
              ) : null}

              {earlier.length > 0 ? (
                <section className="px-1">
                  <SectionLabel>{WHAT_CHANGED_EARLIER_SECTION_LABEL}</SectionLabel>
                  <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
                    {WHAT_CHANGED_EARLIER_SECTION_INTRO}
                  </p>
                  <div className="mt-2.5 space-y-2.5">
                    {earlier.map((item) => (
                      <EarlierMovementCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
