"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

import {
  fetchInspectorEvidenceLinks,
  fetchInspectorUserMapDetail,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "@/lib/inspector-object-api";
import {
  buildMindContextDisplayItems,
  fetchMindContextSnapshot,
  MIND_CONTEXT_EMPTY_PRIMARY,
  MIND_CONTEXT_GOVERNANCE_HREF,
  MIND_CONTEXT_SECTION_LABEL,
  type MindContextDisplayItem,
} from "@/lib/mind-context-surface";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
  type UserMapConclusionPublicApiListItem,
} from "@/lib/public-intelligence-safe-slice";
import { cn } from "@/lib/utils";
import {
  fetchYourMapConclusions,
  formatYourMapDateTime,
  groupUserMapConclusionsByStatus,
  pickInitialYourMapSelectionId,
  summarizeCentreEvidence,
  YOUR_MAP_CORRECTION_DEFERRED_COPY,
  YOUR_MAP_EMPTY_PRIMARY,
  YOUR_MAP_EMPTY_SECONDARY,
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
  type YourMapRailGroupKey,
} from "@/lib/your-map-surface";
import { fetchMapOpenQuestionsPreview } from "@/lib/your-map-preview-surface";

import { BeforeAfter, SectionLabel, TYPE_META } from "./OrvekPrimitives";
import { OrvekMapPreviewBands } from "./OrvekMapPreviewBands";
import { useOrvekInspector } from "./useOrvekInspector";

const GROUP_ICONS: Record<YourMapRailGroupKey, LucideIcon> = {
  established: CheckCircle2,
  emerging: Sparkles,
  needs_evidence: HelpCircle,
  conflicting: AlertTriangle,
  superseded: History,
};

const MAP_OBJECT_TYPE = "map-object" as const;

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

function OrvekMindContextHeader() {
  const { select, setInspectorTab } = useOrvekInspector();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<MindContextDisplayItem[]>([]);
  const [summaryCounts, setSummaryCounts] = useState({ memories: 0, patterns: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const snapshot = await fetchMindContextSnapshot();
        if (cancelled) {
          return;
        }
        setItems(buildMindContextDisplayItems(snapshot, 3));
        setSummaryCounts({
          memories: snapshot.memories.length,
          patterns: snapshot.activePatterns.length,
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="o-material mt-3 rounded-xl px-3 py-2 text-[12px] text-muted-foreground">
        Loading mind context…
      </div>
    );
  }

  if (summaryCounts.memories === 0 && summaryCounts.patterns === 0) {
    return (
      <div className="o-material mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-muted-foreground">
        <Compass className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{MIND_CONTEXT_SECTION_LABEL}</span>
        <span>·</span>
        <span>{MIND_CONTEXT_EMPTY_PRIMARY}</span>
        <Link
          href={MIND_CONTEXT_GOVERNANCE_HREF}
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
        <SectionLabel className="normal-case tracking-normal">{MIND_CONTEXT_SECTION_LABEL}</SectionLabel>
        <span className="text-[11px] text-muted-foreground">
          {summaryCounts.memories > 0
            ? `${summaryCounts.memories} memor${summaryCounts.memories === 1 ? "y" : "ies"}`
            : null}
          {summaryCounts.memories > 0 && summaryCounts.patterns > 0 ? " · " : null}
          {summaryCounts.patterns > 0
            ? `${summaryCounts.patterns} active pattern${summaryCounts.patterns === 1 ? "" : "s"}`
            : null}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.inspectorObjectId) {
                  return;
                }
                select({
                  objectType: "pattern_claim",
                  objectId: item.inspectorObjectId,
                  title: item.title,
                  sourceSurface: "map",
                  tab: "evidence",
                });
                setInspectorTab("evidence");
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

export function OrvekMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { select, setInspectorTab } = useOrvekInspector();

  const [items, setItems] = useState<UserMapConclusionPublicApiListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserMapConclusionPublicApiDetailItem | null>(null);
  const [evidence, setEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [openQuestionsCount, setOpenQuestionsCount] = useState(0);

  const groups = useMemo(() => groupUserMapConclusionsByStatus(items), [items]);
  const preferredSelectionId =
    searchParams.get("selected") ?? searchParams.get("id");

  const headerStats = useMemo(() => {
    const totalReceipts = items.reduce((sum, item) => sum + item.evidenceCount, 0);
    const evolvingCount = items.filter(
      (item) =>
        item.status === "emerging" ||
        item.status === "tentative" ||
        item.status === "hypothesis" ||
        item.status === "disputed"
    ).length;
    const hasConflicting = items.some((item) => item.status === "disputed");
    const confidenceLabel =
      items.length === 0
        ? "—"
        : hasConflicting
          ? "mixed / evolving"
          : evolvingCount > 0
            ? "evolving"
            : "settling";

    return {
      conclusions: items.length,
      receipts: totalReceipts,
      evolving: evolvingCount,
      confidenceLabel,
    };
  }, [items]);

  const syncSelectionToInspector = useCallback(
    (item: UserMapConclusionPublicApiListItem | undefined) => {
      if (!item) {
        return;
      }
      select({
        objectType: "usermap_conclusion",
        objectId: item.id,
        title: item.title,
        sourceSurface: "map",
        tab: "evidence",
      });
    },
    [select]
  );

  const openItem = useCallback(
    (id: string) => {
      setSelectedId(id);
      const item = items.find((entry) => entry.id === id);
      syncSelectionToInspector(item);

      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", id);
      router.replace(`/your-map?${params.toString()}`, { scroll: false });
    },
    [items, router, searchParams, syncSelectionToInspector]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const nextItems = await fetchYourMapConclusions();
        if (cancelled) {
          return;
        }
        setItems(nextItems);
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadError("Could not load your map.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const questions = await fetchMapOpenQuestionsPreview();
        if (!cancelled) {
          setOpenQuestionsCount(questions.length);
        }
      } catch {
        if (!cancelled) {
          setOpenQuestionsCount(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    const initialId = pickInitialYourMapSelectionId(items, preferredSelectionId);
    setSelectedId(initialId);
    const initialItem = items.find((entry) => entry.id === initialId);
    syncSelectionToInspector(initialItem);
  }, [items, preferredSelectionId, syncSelectionToInspector]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvidence([]);
      setIsDetailLoading(false);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);

    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(selectedId),
        fetchInspectorEvidenceLinks(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(selectedId)),
      ]);

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
      setEvidence(nextEvidence);
      setIsDetailLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedListItem = items.find((entry) => entry.id === selectedId);
  const relatedItems = useMemo(() => {
    if (!selectedListItem) {
      return [];
    }
    return items
      .filter(
        (item) =>
          item.id !== selectedListItem.id &&
          (item.area === selectedListItem.area || item.status === selectedListItem.status)
      )
      .slice(0, 4);
  }, [items, selectedListItem]);
  const { preview: evidencePreview, hasMore: hasMoreEvidence } =
    summarizeCentreEvidence(evidence);

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
          {!isLoading && !loadError && items.length > 0 ? (
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
        <OrvekMindContextHeader />
      </div>

      {!isLoading && !loadError && items.length > 0 ? <OrvekMapPreviewBands /> : null}

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
      ) : items.length === 0 ? (
        <div className="px-6 lg:px-8">
          <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <SectionLabel>Current understandings</SectionLabel>
            <p className="mt-3">{YOUR_MAP_EMPTY_PRIMARY}</p>
            <p className="text-muted-foreground/80">{YOUR_MAP_EMPTY_SECONDARY}</p>
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
                      const moved =
                        item.status === "emerging" ||
                        item.status === "superseded" ||
                        item.status === "disputed";
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openItem(item.id)}
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
                            {moved ? (
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
                Select a conclusion from the list to inspect current understanding and evidence.
              </div>
            ) : isDetailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <div className="mx-auto max-w-2xl text-[13px] text-muted-foreground">
                This conclusion is not available through the public projection.
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
                    {formatUserMapArea(detail.area)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatYourMapDateTime(detail.updatedAt)}
                  </span>
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
                  <p className="text-muted-foreground">{YOUR_MAP_EVIDENCE_BREADTH_INTRO}</p>
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

                {detail.status === "superseded" ? (
                  <DetailBlock label="How this moved">
                    <BeforeAfter
                      before={selectedListItem?.summary ?? null}
                      after={detail.summary}
                    />
                  </DetailBlock>
                ) : null}

                {detail.status === "disputed" ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="o-material rounded-[10px] p-3.5">
                      <SectionLabel className="text-primary">Supporting evidence</SectionLabel>
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        {evidencePreview.length > 0
                          ? `${evidencePreview.length} linked signal${evidencePreview.length === 1 ? "" : "s"} in inspector.`
                          : PUBLIC_EVIDENCE_FALLBACK_COPY}
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
                          onClick={() => openItem(related.id)}
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
                              {formatUserMapArea(related.area)}
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

                {evidencePreview.length > 0 && detail.status !== "disputed" ? (
                  <DetailBlock label="Supporting evidence">
                    <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                      {evidencePreview.map((link) => (
                        <Link
                          key={`${link.sourceObjectHref}-${link.createdAt}`}
                          href={link.sourceObjectHref}
                          className="o-calm block px-3 py-2 text-[13px] text-foreground hover:bg-accent/40"
                        >
                          <span className="text-[11px] text-muted-foreground">
                            {link.evidenceSummaryLabel}
                          </span>
                          <span className="mt-0.5 block font-medium">{link.sourceTypeLabel}</span>
                        </Link>
                      ))}
                    </div>
                    {hasMoreEvidence ? (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Open the inspector Evidence tab for the full linked-evidence list.
                      </p>
                    ) : null}
                  </DetailBlock>
                ) : (
                  <DetailBlock label="Supporting evidence">
                    <p className="text-[13px] text-muted-foreground">{PUBLIC_EVIDENCE_FALLBACK_COPY}</p>
                  </DetailBlock>
                )}

                <DetailBlock label="Confidence">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[13px] font-medium text-secondary-foreground">
                    {formatUserMapConfidenceLevel(detail.confidenceLevel)} ·{" "}
                    {formatUserMapStatus(detail.status)}
                  </span>
                </DetailBlock>

                <button
                  type="button"
                  onClick={() => {
                    select({
                      objectType: "usermap_conclusion",
                      objectId: detail.id,
                      title: detail.title,
                      sourceSurface: "map",
                      tab: "evidence",
                    });
                    setInspectorTab("evidence");
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                >
                  <GitCompareArrows className="size-3.5" aria-hidden />
                  Full receipts & movement in inspector
                </button>

                <div className="mt-6 rounded-2xl bg-secondary/40 px-4 py-4">
                  <SectionLabel>Correct the model</SectionLabel>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    {YOUR_MAP_CORRECTION_DEFERRED_COPY}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
