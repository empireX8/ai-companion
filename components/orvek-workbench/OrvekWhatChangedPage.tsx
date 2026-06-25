"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GitCompareArrows } from "lucide-react";

import { WhatChangedInspectorButton } from "@/components/what-changed/WhatChangedInspectorButton";
import { mapWhatChangedDataToV0Props } from "@/lib/orvek-adapters/what-changed";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { PublicEvidenceContinuityItem } from "@/lib/public-evidence-continuity";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";

import { BeforeAfter, SectionLabel } from "./OrvekPrimitives";
import { useOrvekInspector } from "./useOrvekInspector";

export type OrvekWhatChangedViewProps = {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
};

function EarlierMovementCard({
  item,
}: {
  item: ReturnType<typeof mapWhatChangedDataToV0Props>["earlier"][number];
}) {
  const { select, setInspectorTab } = useOrvekInspector();

  return (
    <button
      type="button"
      onClick={() => {
        select({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: item.title,
          tab: "movement",
        });
        setInspectorTab("movement");
      }}
      className="o-calm block w-full rounded-[10px] bg-card p-2.5 text-left shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{item.title}</span>
        <span className="text-[11px] text-muted-foreground">{item.recordedAt}</span>
      </div>
      <BeforeAfter after={item.summary} compact />
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
  inspectorItem,
  evidenceItems,
  whatChangedLabel,
  whyLabel,
  evidenceLabel,
  evidenceIntro,
  reentryLabel,
  reentryIntro,
  reentryLinks,
}: {
  item: NonNullable<ReturnType<typeof mapWhatChangedDataToV0Props>["primary"]>;
  inspectorItem: WhatChangedListItem;
  evidenceItems: ReturnType<typeof mapWhatChangedDataToV0Props>["evidenceItems"];
  whatChangedLabel: string;
  whyLabel: string;
  evidenceLabel: string;
  evidenceIntro: string;
  reentryLabel: string;
  reentryIntro: string;
  reentryLinks: ReturnType<typeof mapWhatChangedDataToV0Props>["reentryLinks"];
}) {
  const headerParts = item.title.split(" · ");

  return (
    <section className="o-float overflow-hidden rounded-2xl">
      <div className="bg-action-muted/40 px-5 py-3 ring-1 ring-inset ring-action/15">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
          {headerParts.join(" · ")}
        </span>
      </div>
      <div className="space-y-5 p-5">
        <section>
          <SectionLabel>{whatChangedLabel}</SectionLabel>
          <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">{item.title}</p>
          <div className="mt-2 text-xs text-muted-foreground">Recorded {item.recordedAt}</div>
        </section>

        <section>
          <SectionLabel>{whyLabel}</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{item.summary}</p>
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
          <WhatChangedInspectorButton item={inspectorItem} />
        </section>

        {evidenceItems.length > 0 ? (
          <section>
            <SectionLabel>{evidenceLabel}</SectionLabel>
            <p className="mb-3 text-[12px] text-muted-foreground">{evidenceIntro}</p>
            <div className="space-y-2">
              {evidenceItems.map((evidence) => (
                <article
                  key={`${evidence.id}-${evidence.linkedAt}`}
                  className="o-sunken rounded-[10px] p-3.5 text-[13px]"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {evidence.label}
                  </div>
                  {evidence.href ? (
                    <Link href={evidence.href} className="text-primary hover:underline">
                      {evidence.sourceTypeLabel}
                    </Link>
                  ) : (
                    <span>{evidence.sourceTypeLabel}</span>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Linked {evidence.linkedAt}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionLabel>{reentryLabel}</SectionLabel>
          <p className="mb-3 text-[12px] text-muted-foreground">{reentryIntro}</p>
          <div className="flex flex-wrap gap-2">
            {reentryLinks.map((link) => (
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
  const view = useMemo(
    () => mapWhatChangedDataToV0Props({ primary, earlier, evidenceItems }),
    [primary, earlier, evidenceItems]
  );

  const hasItems = Boolean(view.primary) || view.earlier.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{view.pageTitle}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{view.pageMeta}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-6 max-w-2xl text-[13px] text-muted-foreground">{view.pageIntro}</p>

          {!hasItems ? (
            <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
              <p>{view.emptyPrimary}</p>
              <p className="text-muted-foreground/80">{view.emptySecondary}</p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="what-changed-list">
              {view.primary && primary ? (
                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
                    <SectionLabel>{view.primarySectionLabel}</SectionLabel>
                  </div>
                  <p className="mb-3 text-[12px] text-muted-foreground">
                    {view.primarySectionIntro}
                  </p>
                  <PrimaryMovementSection
                    item={view.primary}
                    inspectorItem={primary}
                    evidenceItems={view.evidenceItems}
                    whatChangedLabel={view.whatChangedLabel}
                    whyLabel={view.whyLabel}
                    evidenceLabel={view.evidenceLabel}
                    evidenceIntro={view.evidenceIntro}
                    reentryLabel={view.reentryLabel}
                    reentryIntro={view.reentryIntro}
                    reentryLinks={view.reentryLinks}
                  />
                </section>
              ) : null}

              {view.earlier.length > 0 ? (
                <section className="px-1">
                  <SectionLabel>{view.earlierSectionLabel}</SectionLabel>
                  <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
                    {view.earlierSectionIntro}
                  </p>
                  <div className="mt-2.5 space-y-2.5">
                    {view.earlier.map((item) => (
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
