"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  GitCompareArrows,
  HelpCircle,
  History,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { V0MapViewProps, YourMapRailGroupKey } from "@/lib/orvek-adapters/map";
import { cn } from "@/lib/utils";

import { BeforeAfter, SectionLabel, TYPE_META } from "../OrvekPrimitives";

const GROUP_ICONS: Record<YourMapRailGroupKey, LucideIcon> = {
  established: CheckCircle2,
  emerging: Sparkles,
  needs_evidence: HelpCircle,
  conflicting: AlertTriangle,
  superseded: History,
};

const MAP_OBJECT_TYPE = "map-object" as const;

export type V0MapViewHandlers = {
  onSelectItem: (id: string) => void;
  onOpenInspector: () => void;
  onMindContextChip: (inspectorObjectId: string, title: string) => void;
  onMovementRow: (id: string) => void;
  onOpenQuestionRow: (id: string) => void;
};

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-6 w-2/3 animate-pulse rounded bg-muted/60" />
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
      <div className="h-32 animate-pulse rounded-lg bg-muted/40" />
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function PreviewSectionShell({
  label,
  intro,
  viewAllHref,
  isLoading,
  isEmpty,
  emptyCopy,
  icon: Icon,
  children,
  testId,
}: {
  label: string;
  intro: string;
  viewAllHref: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyCopy: string;
  icon: LucideIcon;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section className="o-material rounded-2xl p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Icon className="size-3.5 text-primary" aria-hidden />
            <SectionLabel>{label}</SectionLabel>
          </div>
          <p className="text-[12px] text-muted-foreground">{intro}</p>
        </div>
        {!isLoading && !isEmpty ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="mt-3">
        {isLoading ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : isEmpty ? (
          <p className="text-[13px] text-muted-foreground">{emptyCopy}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function MindContextHeader({
  mindContext,
  onMindContextChip,
}: {
  mindContext: V0MapViewProps["mindContext"];
  onMindContextChip: V0MapViewHandlers["onMindContextChip"];
}) {
  if (mindContext.isLoading) {
    return (
      <div className="o-material mt-3 rounded-xl px-3 py-2 text-[12px] text-muted-foreground">
        Loading mind context…
      </div>
    );
  }

  if (mindContext.summaryCounts.memories === 0 && mindContext.summaryCounts.patterns === 0) {
    return (
      <div className="o-material mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-muted-foreground">
        <Compass className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{mindContext.sectionLabel}</span>
        <span>·</span>
        <span>{mindContext.emptyPrimary}</span>
        <Link
          href={mindContext.governanceHref}
          className="ml-auto text-[11px] font-medium text-primary hover:underline"
        >
          Open Context
        </Link>
      </div>
    );
  }

  return (
    <div className="o-material mt-3 rounded-xl px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Compass className="size-3.5 shrink-0 text-primary" aria-hidden />
        <SectionLabel className="normal-case tracking-normal">{mindContext.sectionLabel}</SectionLabel>
        <span className="text-[11px] text-muted-foreground">
          {mindContext.memoriesLabel}
          {mindContext.memoriesLabel && mindContext.patternsLabel ? " · " : null}
          {mindContext.patternsLabel}
        </span>
      </div>
      {mindContext.items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mindContext.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.inspectorObjectId) {
                  return;
                }
                onMindContextChip(item.inspectorObjectId, item.title);
              }}
              className="o-calm max-w-[220px] truncate rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/60"
              title={item.title}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function V0MapView({
  data,
  handlers,
}: {
  data: V0MapViewProps;
  handlers: V0MapViewHandlers;
}) {
  const {
    isLoading,
    loadError,
    emptyPrimary,
    emptySecondary,
    showPreviewBands,
    groups,
    selectedId,
    isDetailLoading,
    detail,
    selectPromptCopy,
    detailUnavailableCopy,
    evidence,
    headerStats,
    openQuestionsCount,
    mindContext,
    movementPreview,
    openQuestionsPreview,
    relatedItems,
    correctionDeferredCopy,
  } = data;

  const { onSelectItem, onOpenInspector, onMindContextChip, onMovementRow, onOpenQuestionRow } =
    handlers;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="orvek-map-page">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Map</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              What Orvek currently understands — evidence-backed and correctable.
            </p>
          </div>
          {headerStats ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="size-3.5 text-primary" aria-hidden />
                Confidence{" "}
                <span className="font-medium text-foreground">{headerStats.confidenceLabel}</span>
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{headerStats.receipts}</span> receipts
              </span>
              {openQuestionsCount > 0 ? (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{openQuestionsCount}</span> open
                  question{openQuestionsCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <MindContextHeader mindContext={mindContext} onMindContextChip={onMindContextChip} />
      </div>

      {showPreviewBands ? (
        <div
          className="mb-4 grid gap-4 px-6 lg:grid-cols-2 lg:px-8"
          data-testid="orvek-map-preview-bands"
        >
          <PreviewSectionShell
            label={movementPreview.sectionLabel}
            intro={movementPreview.sectionIntro}
            viewAllHref={movementPreview.viewAllHref}
            isLoading={movementPreview.isLoading}
            isEmpty={movementPreview.items.length === 0}
            emptyCopy={movementPreview.emptyCopy}
            icon={GitCompareArrows}
            testId="orvek-map-movement-preview"
          >
            <div className="space-y-2">
              {movementPreview.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMovementRow(item.id)}
                  className="o-calm o-material w-full rounded-[10px] px-3 py-2.5 text-left hover:bg-accent/40"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {item.updateTypeLabel}
                  </div>
                  <p className="mt-1 text-[13px] font-medium leading-snug text-foreground line-clamp-2">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">{item.meta}</div>
                </button>
              ))}
            </div>
          </PreviewSectionShell>

          <PreviewSectionShell
            label={openQuestionsPreview.sectionLabel}
            intro={openQuestionsPreview.sectionIntro}
            viewAllHref={openQuestionsPreview.viewAllHref}
            isLoading={openQuestionsPreview.isLoading}
            isEmpty={openQuestionsPreview.items.length === 0}
            emptyCopy={openQuestionsPreview.emptyCopy}
            icon={HelpCircle}
            testId="orvek-map-open-questions-preview"
          >
            <div className="space-y-2">
              {openQuestionsPreview.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenQuestionRow(item.id)}
                  className="o-calm o-material block w-full rounded-[10px] px-3 py-2.5 text-left hover:bg-accent/40"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-action-foreground">
                    Open question
                  </div>
                  <p className="mt-1 text-[13px] font-medium leading-snug text-foreground line-clamp-2">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                    {item.organizingQuestion}
                  </p>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">{item.meta}</div>
                </button>
              ))}
            </div>
          </PreviewSectionShell>
        </div>
      ) : null}

      {isLoading ? (
        <div className="px-6 lg:px-8">
          <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
            Loading your map…
          </div>
        </div>
      ) : loadError ? (
        <div className="px-6 lg:px-8">
          <div className="o-material rounded-2xl p-5 text-[13px] text-[hsl(12_80%_64%)]">
            {loadError}
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="px-6 lg:px-8">
          <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <SectionLabel>Current understandings</SectionLabel>
            <p className="mt-3">{emptyPrimary}</p>
            <p className="text-muted-foreground/80">{emptySecondary}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
          <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5">
            {groups.map((group) => {
              const CatIcon = GROUP_ICONS[group.key];
              return (
                <div key={group.key} className="mb-4">
                  <div className="flex items-center gap-1.5 px-2">
                    <CatIcon className="size-3.5 text-muted-foreground" aria-hidden />
                    <SectionLabel>{group.label}</SectionLabel>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {group.items.map((item) => {
                      const active = selectedId === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onSelectItem(item.id)}
                            className={cn(
                              "o-calm flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] leading-snug",
                              active
                                ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                                : "text-foreground hover:bg-card/60"
                            )}
                          >
                            {active ? (
                              <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            {item.recentlyMoved ? (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-action"
                                title="Recently moved"
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-6 lg:px-8">
            {!selectedId ? (
              <div className="mx-auto max-w-2xl text-[13px] text-muted-foreground">
                {selectPromptCopy}
              </div>
            ) : isDetailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <div className="mx-auto max-w-2xl text-[13px] text-muted-foreground">
                {detailUnavailableCopy}
              </div>
            ) : (
              <div className="mx-auto max-w-2xl">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                      "bg-evidence-muted text-primary"
                    )}
                  >
                    {(() => {
                      const Icon = TYPE_META[MAP_OBJECT_TYPE].icon;
                      return <Icon className="size-3" aria-hidden />;
                    })()}
                    {detail.areaLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">Updated {detail.updatedAt}</span>
                </div>

                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground text-balance">
                  {detail.title}
                </h2>

                {detail.summary ? (
                  <div className="mt-4 rounded-lg border-l-2 border-primary bg-evidence-muted/40 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Current understanding
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                      {detail.summary}
                    </p>
                  </div>
                ) : null}

                <DetailBlock label="Why Orvek thinks this">
                  <p className="text-muted-foreground">{evidence.breadthIntro}</p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="o-material rounded-[9px] px-3 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Linked receipts
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {detail.evidenceCount}
                      </dd>
                    </div>
                    <div className="o-material rounded-[9px] px-3 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Source diversity
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {detail.sourceDiversity}
                      </dd>
                    </div>
                    <div className="o-material rounded-[9px] px-3 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Time spread
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {detail.timeSpreadDays} days
                      </dd>
                    </div>
                  </dl>
                </DetailBlock>

                {detail.showBeforeAfter ? (
                  <DetailBlock label="How this moved">
                    <BeforeAfter before={detail.beforeSummary} after={detail.afterSummary} />
                  </DetailBlock>
                ) : null}

                {detail.isDisputed ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="o-material rounded-[10px] p-3.5">
                      <SectionLabel className="text-primary">Supporting evidence</SectionLabel>
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        {evidence.preview.length > 0
                          ? `${evidence.preview.length} linked signal${evidence.preview.length === 1 ? "" : "s"} in inspector.`
                          : evidence.fallbackCopy}
                      </p>
                    </div>
                    <div className="o-material rounded-[10px] p-3.5">
                      <SectionLabel className="text-destructive/80">Conflicting signal</SectionLabel>
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        This conclusion is marked as disputed — conflicting signals may be present in
                        linked evidence.
                      </p>
                    </div>
                  </div>
                ) : null}

                {relatedItems.length > 0 ? (
                  <DetailBlock label="Related across the model">
                    <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                      {relatedItems.map((related) => (
                        <button
                          key={related.id}
                          type="button"
                          onClick={() => onSelectItem(related.id)}
                          className="o-calm group flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/40"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-secondary text-primary">
                            <Compass className="size-3.5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {related.title}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {related.areaLabel}
                            </span>
                          </span>
                          <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            Open
                          </span>
                        </button>
                      ))}
                    </div>
                  </DetailBlock>
                ) : null}

                {evidence.preview.length > 0 && !detail.isDisputed ? (
                  <DetailBlock label="Supporting evidence">
                    <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                      {evidence.preview.map((link) => (
                        <Link
                          key={link.key}
                          href={link.href}
                          className="o-calm block px-3 py-2 text-[13px] text-foreground hover:bg-accent/40"
                        >
                          <span className="text-[11px] text-muted-foreground">
                            {link.evidenceSummaryLabel}
                          </span>
                          <span className="mt-0.5 block font-medium">{link.sourceTypeLabel}</span>
                        </Link>
                      ))}
                    </div>
                    {evidence.hasMore ? (
                      <p className="mt-2 text-[12px] text-muted-foreground">{evidence.inspectorHint}</p>
                    ) : null}
                  </DetailBlock>
                ) : (
                  <DetailBlock label="Supporting evidence">
                    <p className="text-[13px] text-muted-foreground">{evidence.fallbackCopy}</p>
                  </DetailBlock>
                )}

                <DetailBlock label="Confidence">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[13px] font-medium text-secondary-foreground">
                    {detail.confidenceLabel} · {detail.statusLabel}
                  </span>
                </DetailBlock>

                <button
                  type="button"
                  onClick={onOpenInspector}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                >
                  <GitCompareArrows className="size-3.5" aria-hidden />
                  Full receipts & movement in inspector
                </button>

                <div className="mt-6 rounded-2xl bg-secondary/40 px-4 py-4">
                  <SectionLabel>Correct the model</SectionLabel>
                  <p className="mt-2 text-[13px] text-muted-foreground">{correctionDeferredCopy}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
