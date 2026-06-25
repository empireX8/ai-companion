"use client";

import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { V0WhatChangedViewProps } from "@/lib/orvek-adapters/what-changed";
import { useOrvekData } from "@/lib/orvek-v0/data-provider";
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers";

import { SectionLabel } from "@/components/orvek-v0/primitives";
import { cn } from "@/lib/utils";

export type V0WhatChangedViewHandlers = {
  onMovementSelect: (id: string, title: string) => void;
};

function BeforeAfter({
  before,
  after,
  compact,
}: {
  before?: string | null;
  after?: string | null;
  compact?: boolean;
}) {
  if (!before && !after) return null;
  return (
    <div className={cn("space-y-1.5", compact ? "mt-1.5" : "mt-2")}>
      {before ? (
        <div className="rounded-[9px] bg-muted/70 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Before
          </p>
          <p className="mt-0.5 text-[13px] text-foreground">{before}</p>
        </div>
      ) : null}
      {after ? (
        <div className="rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">After</p>
          <p className="mt-0.5 text-[13px] text-foreground">{after}</p>
        </div>
      ) : null}
    </div>
  );
}

function EarlierMovementCard({
  item,
  onSelect,
}: {
  item: V0WhatChangedViewProps["earlier"][number];
  onSelect: V0WhatChangedViewHandlers["onMovementSelect"];
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id, item.title)}
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

function WhatChangedBody({
  view,
  onMovementSelect,
}: {
  view: V0WhatChangedViewProps;
  onMovementSelect: V0WhatChangedViewHandlers["onMovementSelect"];
}) {
  const hasItems = Boolean(view.primary) || view.earlier.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="orvek-v0-what-changed-page">
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
              {view.primary ? (
                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
                    <SectionLabel>{view.primarySectionLabel}</SectionLabel>
                  </div>
                  <p className="mb-3 text-[12px] text-muted-foreground">
                    {view.primarySectionIntro}
                  </p>
                  <section className="o-float overflow-hidden rounded-2xl">
                    <div className="bg-action-muted/40 px-5 py-3 ring-1 ring-inset ring-action/15">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                        {view.primary.title}
                      </span>
                    </div>
                    <div className="space-y-5 p-5">
                      <section>
                        <SectionLabel>{view.whatChangedLabel}</SectionLabel>
                        <p className="mt-2 text-[15px] font-medium leading-snug text-foreground">
                          {view.primary.title}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Recorded {view.primary.recordedAt}
                        </div>
                      </section>
                      <section>
                        <SectionLabel>{view.whyLabel}</SectionLabel>
                        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                          {view.primary.summary}
                        </p>
                      </section>
                      <section>
                        <PublicLinkedObjectContinuity
                          objectType={view.primary.affectedObjectType}
                          objectId={view.primary.affectedObjectId}
                          href={view.primary.affectedObjectHref}
                          context="model_update"
                          linkClassName="text-[13px] font-medium text-primary hover:underline"
                          containerClassName="text-[13px] text-muted-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => onMovementSelect(view.primary!.id, view.primary!.title)}
                          className="o-calm mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                        >
                          Open in inspector
                        </button>
                      </section>
                      {view.evidenceItems.length > 0 ? (
                        <section>
                          <SectionLabel>{view.evidenceLabel}</SectionLabel>
                          <p className="mb-3 text-[12px] text-muted-foreground">
                            {view.evidenceIntro}
                          </p>
                          <div className="space-y-2">
                            {view.evidenceItems.map((evidence) => (
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
                        <SectionLabel>{view.reentryLabel}</SectionLabel>
                        <p className="mb-3 text-[12px] text-muted-foreground">{view.reentryIntro}</p>
                        <div className="flex flex-wrap gap-2">
                          {view.reentryLinks.map((link) => (
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
                      <EarlierMovementCard
                        key={item.id}
                        item={item}
                        onSelect={onMovementSelect}
                      />
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

export function WhatChangedPage() {
  const { whatChanged } = useOrvekData();
  const pageHandlers = useOrvekPageHandlers().whatChanged;

  if (!whatChanged || !pageHandlers) {
    return (
      <div className="px-6 py-6" data-testid="orvek-v0-what-changed-page">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <WhatChangedBody view={whatChanged} onMovementSelect={pageHandlers.onMovementSelect} />
  );
}
