"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { OccurrenceDots } from "@/components/Visuals";
import { ArrowRight } from "lucide-react";

import {
  TIMELINE_WINDOWS,
  type TimelineWindow,
} from "@/lib/timeline-aggregation";
import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInStateTag,
} from "@/lib/quick-check-ins";
import {
  buildTimelineRequestUrl,
  hasEnoughCheckInsForRhythm,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "@/lib/timeline-surface";
import {
  buildTimelineModelLayersRequestUrl,
  buildTimelineStreamItems,
  groupTimelineStreamByDate,
  TIMELINE_ACTIVITY_EMPTY_COPY,
  TIMELINE_ACTIVITY_LOADING_COPY,
  TIMELINE_ACTIVITY_SECTION_INTRO,
  TIMELINE_ACTIVITY_SECTION_LABEL,
  TIMELINE_MODEL_CHANGE_CHIP,
  TIMELINE_MODEL_LAYERS_ERROR_COPY,
  TIMELINE_MODEL_LAYERS_LOADING_COPY,
  TIMELINE_PAGE_META,
  TIMELINE_SIGNALS_SECTION_LABEL,
  toTimelineLondonDateKey,
  type TimelineModelLayerItem,
} from "@/lib/timeline-model-layers";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import { useInspector } from "@/components/inspector/InspectorContext";
import { parseSelectableObjectFromHref } from "@/lib/inspector-selection";
import {
  enrichTimelineActivityEntry,
  fetchTimelineSemanticEntries,
  modelChangeMatchesFilter,
  TIMELINE_LANE_LABELS,
  TIMELINE_SEMANTIC_FILTERS,
  timelineEntryMatchesFilter,
  type TimelineSemanticFilter,
} from "@/lib/timeline-semantic-layers";
import { cn } from "@/lib/utils";

const STATE_DISPLAY_LABELS: Record<QuickCheckInStateTag, string> = {
  stable: "Calm",
  stressed: "Anxious",
  overloaded: "Overwhelmed",
  flat: "Numb",
  energized: "Energized",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function formatRecentLabel(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const deltaMs = Math.max(0, Date.now() - date.getTime());
  const deltaMinutes = Math.floor(deltaMs / 60_000);

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 48) {
    return `${deltaHours}h`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d`;
}

function stateLabel(stateTag: QuickCheckInStateTag | null): string {
  if (!stateTag) {
    return "Check-in";
  }

  return STATE_DISPLAY_LABELS[stateTag] ?? QUICK_CHECK_IN_STATE_LABELS[stateTag];
}

function ActivityStreamEntry({ entry }: { entry: TimelineEntry }) {
  const { selectObject } = useInspector();
  const lane = entry.lane ?? "sessions_activity";
  const isMovementLane = lane === "model_movement";
  const laneLabel =
    entry.lane && entry.lane in TIMELINE_LANE_LABELS
      ? TIMELINE_LANE_LABELS[entry.lane]
      : entry.chip;

  const handleSelect = () => {
    if (entry.selectableObjectType && entry.selectableObjectId) {
      selectObject({
        objectType: entry.selectableObjectType,
        objectId: entry.selectableObjectId,
        title: entry.title,
        sourceSurface: "timeline",
        tab: entry.selectableObjectType === "model_update" ? "movement" : "evidence",
      });
      return;
    }

    const parsed = parseSelectableObjectFromHref(entry.href);
    if (!parsed) {
      return;
    }
    selectObject({
      ...parsed,
      title: entry.title,
      sourceSurface: "timeline",
      tab: "evidence",
    });
  };

  const content = (
    <>
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          isMovementLane ? "bg-cyan/80" : "bg-muted-foreground"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {formatTime(entry.occurredAt)}
          </span>
          <span className="text-[14px] font-medium text-[hsl(216_11%_82%)]">{entry.title}</span>
          <span className="rounded-full bg-cyan/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan/80">
            {entry.chip}
          </span>
          <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {laneLabel}
          </span>
        </span>
        {entry.body ? (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
            {entry.body}
          </span>
        ) : null}
        {entry.sourceLabel ? (
          <span className="label-meta text-meta mt-1 block">{entry.sourceLabel}</span>
        ) : null}
        {!entry.href ? (
          <span className="label-meta text-meta mt-1 block">{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</span>
        ) : null}
      </span>
    </>
  );

  return (
    <div className={cn(entry.weight === "low" && "opacity-60")}>
      {entry.href || entry.selectableObjectId ? (
        <button
          type="button"
          onClick={() => {
            handleSelect();
          }}
          className={cn(
            "ml-calm relative flex w-full gap-3 py-3 pl-5 text-left hover:bg-white/[0.02]",
            "before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[3px] before:rounded-r",
            isMovementLane ? "before:bg-cyan/80" : "before:bg-white/25"
          )}
        >
          {content}
        </button>
      ) : (
        <div
          className={cn(
            "ml-calm relative flex w-full gap-3 py-3 pl-5 text-left",
            "before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[3px] before:rounded-r",
            isMovementLane ? "before:bg-cyan/80" : "before:bg-white/25"
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

function ModelChangeStreamEntry({ item }: { item: TimelineModelLayerItem }) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
          sourceSurface: "timeline",
          tab: "movement",
        });
      }}
      className="ml-calm relative flex w-full gap-3 py-3 pl-5 text-left before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[3px] before:rounded-r before:bg-cyan/80 hover:bg-white/[0.02]"
    >
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan/80" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {formatTime(item.createdAt)}
          </span>
          <span className="text-[14px] font-medium text-[hsl(216_11%_82%)]">
            {item.updateTypeLabel}
          </span>
          <span className="rounded-full bg-cyan/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan/80">
            {TIMELINE_MODEL_CHANGE_CHIP}
          </span>
        </span>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {item.userFacingSummary}
        </p>
        <div className="mt-2">
          <PublicLinkedObjectContinuity
            objectType={item.affectedObjectType}
            objectId={item.affectedObjectId}
            href={item.affectedObjectHref}
            context="model_update"
          />
        </div>
      </span>
    </button>
  );
}

export default function TimelineSurface() {
  const [windowValue, setWindowValue] = useState<TimelineWindow>("30d");
  const [semanticFilter, setSemanticFilter] = useState<TimelineSemanticFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<TimelineResponse | null>(null);
  const [semanticEntries, setSemanticEntries] = useState<TimelineEntry[]>([]);
  const [isLoadingSemantic, setIsLoadingSemantic] = useState(true);
  const [modelLayers, setModelLayers] = useState<TimelineModelLayerItem[]>([]);
  const [isLoadingModelLayers, setIsLoadingModelLayers] = useState(true);
  const [modelLayerError, setModelLayerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTimeline = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(buildTimelineRequestUrl(windowValue), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load timeline.");
        }

        const nextPayload = (await response.json()) as TimelineResponse;
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : "Could not load timeline."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [windowValue]);

  useEffect(() => {
    let cancelled = false;

    const loadSemantic = async () => {
      setIsLoadingSemantic(true);
      try {
        const entries = await fetchTimelineSemanticEntries(windowValue);
        if (!cancelled) {
          setSemanticEntries(entries);
        }
      } catch {
        if (!cancelled) {
          setSemanticEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemantic(false);
        }
      }
    };

    void loadSemantic();

    return () => {
      cancelled = true;
    };
  }, [windowValue]);

  useEffect(() => {
    let cancelled = false;

    const loadModelLayers = async () => {
      setIsLoadingModelLayers(true);
      setModelLayerError(null);

      try {
        const response = await fetch(
          buildTimelineModelLayersRequestUrl(windowValue),
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }

        const nextPayload = (await response.json()) as {
          items?: TimelineModelLayerItem[];
        };
        if (!cancelled) {
          setModelLayers(
            Array.isArray(nextPayload.items) ? nextPayload.items : []
          );
        }
      } catch {
        if (!cancelled) {
          setModelLayers([]);
          setModelLayerError(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModelLayers(false);
        }
      }
    };

    void loadModelLayers();

    return () => {
      cancelled = true;
    };
  }, [windowValue]);

  const timelineEntries = useMemo(() => {
    const activity = payload
      ? mapTimelineEntries(payload).map(enrichTimelineActivityEntry)
      : [];
    return [...activity, ...semanticEntries];
  }, [payload, semanticEntries]);

  const streamItems = useMemo(() => {
    const items = buildTimelineStreamItems({
      activity: timelineEntries,
      modelLayers,
    });
    if (semanticFilter === "all") {
      return items;
    }
    return items.filter((item) => {
      if (item.kind === "model_change") {
        return modelChangeMatchesFilter(semanticFilter);
      }
      return timelineEntryMatchesFilter(item.entry, semanticFilter);
    });
  }, [timelineEntries, modelLayers, semanticFilter]);

  const rhythms = payload?.stateSummary.rhythms ?? null;
  const repeatedSignals = payload?.stateSummary.repeatedSignals ?? null;

  const groupedActivity = useMemo(
    () => groupTimelineStreamByDate(streamItems, new Date()),
    [streamItems]
  );

  const possibleLinks = (repeatedSignals?.repeatedPairs ?? []).slice(0, 4).map((pair) => ({
    event: QUICK_CHECK_IN_EVENT_LABELS[pair.eventTag],
    state: stateLabel(pair.stateTag),
    count: pair.count,
  }));

  const topStateChips = (rhythms?.topStateTags ?? []).map((item) => ({
    label: stateLabel(item.tag),
    count: item.count,
  }));
  const topEventChips = (rhythms?.topEventTags ?? []).map((item) => ({
    label: QUICK_CHECK_IN_EVENT_LABELS[item.tag],
    count: item.count,
  }));
  const totalCheckIns = payload?.stateSummary.totalCheckIns ?? 0;
  const rhythmReady = hasEnoughCheckInsForRhythm(totalCheckIns);
  const checkInDayCount = useMemo(() => {
    const checkIns = payload?.checkIns ?? [];
    const dayKeys = new Set(
      checkIns
        .map((item) => toTimelineLondonDateKey(item.createdAt))
        .filter((item) => item !== "invalid")
    );
    return dayKeys.size;
  }, [payload?.checkIns]);

  const isLoadingActivityStream = isLoading || isLoadingModelLayers || isLoadingSemantic;
  const hasStreamItems = streamItems.length > 0;
  const showActivityEmptyState =
    !hasStreamItems && !errorMessage && !modelLayerError;

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Timeline"
        meta={TIMELINE_PAGE_META}
        compact
        right={
          <div className="ml-segmented">
            {TIMELINE_WINDOWS.map((windowKey) => (
              <button
                key={windowKey}
                onClick={() => setWindowValue(windowKey)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-medium",
                  windowValue === windowKey ? "ml-segment-active" : "ml-segment-inactive"
                )}
              >
                {windowKey}
              </button>
            ))}
          </div>
        }
      />

      <section className="ml-material mb-8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-meta mb-1">Recent rhythms</div>
            <div className="text-[15px]">Check-in cadence · last {windowValue}</div>
            <div className="label-meta text-meta mt-1">Based on check-ins in this window.</div>
          </div>
          <div className="flex gap-4 text-right">
            <Stat label="Check-in days" value={String(checkInDayCount)} />
            <Stat label="Last check-in" value={formatRecentLabel(rhythms?.lastCheckInAt ?? null)} />
          </div>
        </div>
        {!rhythmReady ? (
          <div className="card-standard p-4 text-[13px] text-meta mt-4">Not enough check-ins to show a rhythm yet.</div>
        ) : (
          <div className="space-y-3 mt-4">
            <div className="flex gap-2 flex-wrap">
              {topStateChips.length > 0 ? (
                topStateChips.map((chip) => (
                  <span key={chip.label} className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                    {chip.label} <span className="text-cyan/70">×{chip.count}</span>
                  </span>
                ))
              ) : (
                <span className="label-meta text-meta">No check-ins in this window yet.</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {topEventChips.length > 0 ? (
                topEventChips.map((chip) => (
                  <span key={chip.label} className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                    {chip.label} <span className="text-cyan/70">×{chip.count}</span>
                  </span>
                ))
              ) : (
                <span className="label-meta text-meta">No repeated events in this window yet.</span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionLabel>{TIMELINE_SIGNALS_SECTION_LABEL}</SectionLabel>
        <div className="label-meta text-meta mb-4">
          Recurring state/event pairings and ranked signals from check-ins in this window.
        </div>

        <div className="mb-6">
          <div className="label-meta mb-3">Possible links</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {possibleLinks.length > 0 ? (
              possibleLinks.map((link, index) => (
                <div key={`${link.event}-${link.state}-${index}`} className="card-surfaced p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 card-standard px-3 py-2 text-[13px]">{link.event}</div>
                    <ArrowRight className="h-4 w-4 text-cyan" strokeWidth={1.5} />
                    <div className="flex-1 card-standard px-3 py-2 text-[13px]">{link.state}</div>
                  </div>
                  <div className="label-meta mt-3">Appeared together {link.count} times</div>
                </div>
              ))
            ) : (
              <div className="card-standard p-4 text-[13px] text-meta md:col-span-2">
                No recurring state/event links yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="label-meta mb-3">Repeated signals</div>
          <div className="card-standard divide-y divide-white/[0.05]">
            {(repeatedSignals?.rankedItems ?? []).length > 0 ? (
              (repeatedSignals?.rankedItems ?? []).map((signal, index) => {
                const text = signal.kind === "state"
                  ? stateLabel(signal.tag)
                  : signal.kind === "event"
                    ? QUICK_CHECK_IN_EVENT_LABELS[signal.tag]
                    : `${stateLabel(signal.stateTag)} + ${QUICK_CHECK_IN_EVENT_LABELS[signal.eventTag]}`;

                const marks = Array.from({ length: Math.min(14, signal.count) }, (_, markIndex) =>
                  Math.min(13, markIndex * 2)
                );

                return (
                  <div key={`${signal.kind}-${index}`} className="w-full p-4 flex items-center gap-4 text-left">
                    <div className="flex-1 text-[14px]">{text}</div>
                    <OccurrenceDots count={14} marks={marks} />
                    <div className="label-meta w-8 text-right">×{signal.count}</div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-[13px] text-meta">No repeated signals in this window yet.</div>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>{TIMELINE_ACTIVITY_SECTION_LABEL}</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{TIMELINE_ACTIVITY_SECTION_INTRO}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {TIMELINE_SEMANTIC_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSemanticFilter(filter.id)}
              className={cn(
                "ml-calm rounded-full px-3 py-1 text-[11px] font-medium",
                semanticFilter === filter.id
                  ? "bg-cyan/15 text-cyan"
                  : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {isLoadingActivityStream ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            {isLoading ? TIMELINE_ACTIVITY_LOADING_COPY : TIMELINE_MODEL_LAYERS_LOADING_COPY}
          </div>
        ) : (
          <>
            {errorMessage ? (
              <div
                className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)] mb-4"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}
            {modelLayerError ? (
              <div
                className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)] mb-4"
                role="alert"
              >
                {modelLayerError}
              </div>
            ) : null}
            {hasStreamItems ? (
              <div className="relative pl-5">
                <div
                  className="absolute bottom-2 left-[5px] top-2 w-px bg-white/10"
                  aria-hidden
                />
                <div className="space-y-6">
                {groupedActivity.map((group) => (
                  <div key={group.date}>
                    <div className="relative mb-2.5">
                      <span className="absolute -left-[19px] top-0.5 size-3 rounded-full border-2 border-cyan/70 bg-card shadow-[0_0_0_3px_var(--card)]" />
                      <SectionLabel>{group.date}</SectionLabel>
                    </div>
                    <div className="ml-material overflow-hidden rounded-xl divide-y ml-hairline">
                      {group.items.map((item) => (
                        <div
                          key={
                            item.kind === "activity"
                              ? `activity-${item.entry.id}`
                              : `model-${item.item.id}`
                          }
                        >
                          {item.kind === "activity" ? (
                            <ActivityStreamEntry entry={item.entry} />
                          ) : (
                            <ModelChangeStreamEntry item={item.item} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : showActivityEmptyState ? (
              <div className="ml-material rounded-xl p-4 text-[13px] text-muted-foreground">
                {TIMELINE_ACTIVITY_EMPTY_COPY}
              </div>
            ) : null}
          </>
        )}
      </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-meta">{label}</div>
      <div className="font-mono text-[15px] mt-0.5">{value}</div>
    </div>
  );
}
