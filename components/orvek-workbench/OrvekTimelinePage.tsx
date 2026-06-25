"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { TimelineInspectorAction } from "@/components/timeline/TimelineInspectorAction";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  buildTimelineRequestUrl,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "@/lib/timeline-surface";
import {
  buildTimelineModelLayersRequestUrl,
  buildTimelineStreamItems,
  TIMELINE_ACTIVITY_EMPTY_COPY,
  TIMELINE_ACTIVITY_LOADING_COPY,
  TIMELINE_MODEL_CHANGE_CHIP,
  TIMELINE_MODEL_LAYERS_ERROR_COPY,
  TIMELINE_MODEL_LAYERS_LOADING_COPY,
  TIMELINE_PAGE_INTRO,
  toTimelineLondonDateKey,
  type TimelineModelLayerItem,
  type TimelineStreamItem,
} from "@/lib/timeline-model-layers";
import { parseSelectableObjectFromHref } from "@/lib/inspector-selection";
import {
  enrichTimelineActivityEntry,
  fetchTimelineSemanticEntries,
  modelChangeMatchesFilter,
  TIMELINE_LANE_LABELS,
  TIMELINE_SEMANTIC_FILTERS,
  timelineEntryMatchesFilter,
  type TimelineSemanticFilter,
  type TimelineSemanticLane,
} from "@/lib/timeline-semantic-layers";
import { cn } from "@/lib/utils";

import { SectionLabel } from "./OrvekPrimitives";
import { useOrvekInspector } from "./useOrvekInspector";

const TIMELINE_WINDOW = "30d";

type TimelineLaneKey = "evidence" | "action" | "decision" | "receipt";

const LANE_DOT: Record<TimelineLaneKey, string> = {
  evidence: "bg-primary",
  action: "bg-action",
  decision: "bg-foreground/60",
  receipt: "bg-muted-foreground",
};

const LANE_STRIPE: Record<TimelineLaneKey, string> = {
  evidence: "before:bg-primary",
  action: "before:bg-action",
  decision: "before:bg-foreground/50",
  receipt: "before:bg-muted-foreground/60",
};

const GROUP_HEADINGS = [
  "Today",
  "This week",
  "Last week",
  "Earlier",
  "Imported history",
] as const;

type GroupHeading = (typeof GROUP_HEADINGS)[number];

function laneFromEntry(entry: TimelineEntry): TimelineLaneKey {
  const lane = entry.lane ?? "sessions_activity";
  if (lane === "model_movement") return "evidence";
  if (lane === "decisions_actions") return "decision";
  if (lane === "fieldwork" || lane === "reports") return "action";
  if (lane === "receipts_activity") return "receipt";
  return "receipt";
}

function laneFromModelChange(): TimelineLaneKey {
  return "evidence";
}

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

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function londonDateFromKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function startOfLondonWeek(dateKey: string): string | null {
  const date = londonDateFromKey(dateKey);
  if (!date) {
    return null;
  }

  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(date);

  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const offset = weekdayIndex[weekday];
  if (offset == null) {
    return null;
  }

  const weekStart = new Date(date.getTime() - offset * 86_400_000);
  return toTimelineLondonDateKey(weekStart.toISOString());
}

function resolveTimelineGroupHeading(dateKey: string, now: Date): GroupHeading {
  if (dateKey === "invalid") {
    return "Earlier";
  }

  const todayKey = toTimelineLondonDateKey(now.toISOString());
  if (dateKey === todayKey) {
    return "Today";
  }

  const thisWeekStart = startOfLondonWeek(todayKey);
  const itemWeekStart = startOfLondonWeek(dateKey);

  if (thisWeekStart && itemWeekStart && itemWeekStart === thisWeekStart) {
    return "This week";
  }

  if (thisWeekStart) {
    const thisWeekStartDate = londonDateFromKey(thisWeekStart);
    if (thisWeekStartDate) {
      const lastWeekStart = new Date(thisWeekStartDate.getTime() - 7 * 86_400_000);
      const lastWeekStartKey = toTimelineLondonDateKey(lastWeekStart.toISOString());
      if (itemWeekStart === lastWeekStartKey) {
        return "Last week";
      }
    }
  }

  return "Earlier";
}

function isImportStreamItem(item: TimelineStreamItem): boolean {
  return item.kind === "activity" && item.entry.kind === "import";
}

function groupStreamItemsByHeading(
  items: TimelineStreamItem[],
  now: Date
): Array<{ heading: GroupHeading; items: TimelineStreamItem[] }> {
  const buckets = new Map<GroupHeading, TimelineStreamItem[]>(
    GROUP_HEADINGS.map((heading) => [heading, []])
  );

  for (const item of items) {
    if (isImportStreamItem(item)) {
      buckets.get("Imported history")!.push(item);
      continue;
    }

    const heading = resolveTimelineGroupHeading(
      toTimelineLondonDateKey(item.occurredAt),
      now
    );
    buckets.get(heading)!.push(item);
  }

  return GROUP_HEADINGS.map((heading) => ({
    heading,
    items: buckets.get(heading) ?? [],
  })).filter((group) => group.items.length > 0);
}

function streamItemSearchHaystack(item: TimelineStreamItem): string {
  if (item.kind === "model_change") {
    return [
      item.item.updateTypeLabel,
      item.item.affectedObjectTypeLabel,
      item.item.userFacingSummary,
      TIMELINE_MODEL_CHANGE_CHIP,
    ].join(" ");
  }

  const entry = item.entry;
  return [
    entry.title,
    entry.body ?? "",
    entry.chip,
    entry.sourceLabel ?? "",
    entry.lane ? TIMELINE_LANE_LABELS[entry.lane as TimelineSemanticLane] : "",
  ].join(" ");
}

function streamItemEventLabel(item: TimelineStreamItem): string {
  if (item.kind === "model_change") {
    return item.item.updateTypeLabel;
  }

  return item.entry.chip;
}

function openTimelineItem(
  item: TimelineStreamItem,
  select: ReturnType<typeof useOrvekInspector>["select"],
  setInspectorTab: ReturnType<typeof useOrvekInspector>["setInspectorTab"]
) {
  if (item.kind === "model_change") {
    const title = `${item.item.updateTypeLabel} · ${item.item.affectedObjectTypeLabel}`;
    select({
      objectType: "model_update",
      objectId: item.item.id,
      modelUpdateId: item.item.id,
      title,
      tab: "movement",
    });
    setInspectorTab("movement");
    return;
  }

  const entry = item.entry;
  if (entry.selectableObjectType && entry.selectableObjectId) {
    select({
      objectType: entry.selectableObjectType,
      objectId: entry.selectableObjectId,
      title: entry.title,
      tab: entry.selectableObjectType === "model_update" ? "movement" : "evidence",
    });
    setInspectorTab(entry.selectableObjectType === "model_update" ? "movement" : "evidence");
  }
}

function TimelineStreamRow({
  item,
  selected,
  onOpen,
}: {
  item: TimelineStreamItem;
  selected: boolean;
  onOpen: () => void;
}) {
  const laneKey =
    item.kind === "model_change" ? laneFromModelChange() : laneFromEntry(item.entry);
  const moved = item.kind === "model_change";
  const occurredAt = item.occurredAt;
  const title =
    item.kind === "model_change"
      ? `${item.item.updateTypeLabel} · ${item.item.affectedObjectTypeLabel}`
      : item.entry.title;
  const summary =
    item.kind === "model_change" ? item.item.userFacingSummary : item.entry.body;
  const eventLabel = streamItemEventLabel(item);
  const inspectorTarget =
    item.kind === "activity" && item.entry.selectableObjectType && item.entry.selectableObjectId
      ? {
          objectType: item.entry.selectableObjectType,
          objectId: item.entry.selectableObjectId,
        }
      : item.kind === "activity"
        ? parseSelectableObjectFromHref(item.entry.href)
        : null;

  const rowClassName = cn(
    "o-calm relative flex w-full gap-3 px-4 py-3 pl-5 text-left",
    "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r",
    LANE_STRIPE[laneKey],
    selected ? "bg-accent/50" : "hover:bg-accent/30"
  );

  const content = (
    <>
      <span
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", LANE_DOT[laneKey])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {eventLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {formatTime(occurredAt)} · {formatDateLabel(occurredAt)}
          </span>
          {moved ? (
            <span className="rounded-full bg-evidence-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
              moved
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[14px] font-medium leading-snug text-foreground">
          {title}
        </span>
        {summary ? (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
            {summary}
          </span>
        ) : null}
        {item.kind === "model_change" ? (
          <div className="mt-2">
            <PublicLinkedObjectContinuity
              objectType={item.item.affectedObjectType}
              objectId={item.item.affectedObjectId}
              href={item.item.affectedObjectHref}
              context="model_update"
            />
          </div>
        ) : null}
        {item.kind === "model_change" ? (
          <TimelineInspectorAction
            objectType="model_update"
            objectId={item.item.id}
            modelUpdateId={item.item.id}
            title={title}
            tab="movement"
          />
        ) : inspectorTarget ? (
          <TimelineInspectorAction
            objectType={inspectorTarget.objectType}
            objectId={inspectorTarget.objectId}
            title={title}
            tab={inspectorTarget.objectType === "model_update" ? "movement" : "evidence"}
          />
        ) : null}
      </span>
    </>
  );

  if (item.kind === "activity" && item.entry.href && !inspectorTarget) {
    return (
      <Link href={item.entry.href} className={rowClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={rowClassName}>
      {content}
    </button>
  );
}

export function OrvekTimelinePage() {
  const { select, setInspectorTab, selection } = useOrvekInspector();
  const [semanticFilter, setSemanticFilter] = useState<TimelineSemanticFilter>("all");
  const [query, setQuery] = useState("");
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
        const response = await fetch(buildTimelineRequestUrl(TIMELINE_WINDOW), {
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSemantic = async () => {
      setIsLoadingSemantic(true);
      try {
        const entries = await fetchTimelineSemanticEntries(TIMELINE_WINDOW);
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModelLayers = async () => {
      setIsLoadingModelLayers(true);
      setModelLayerError(null);

      try {
        const response = await fetch(buildTimelineModelLayersRequestUrl(TIMELINE_WINDOW), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(TIMELINE_MODEL_LAYERS_ERROR_COPY);
        }

        const nextPayload = (await response.json()) as {
          items?: TimelineModelLayerItem[];
        };
        if (!cancelled) {
          setModelLayers(Array.isArray(nextPayload.items) ? nextPayload.items : []);
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
  }, []);

  const timelineEntries = useMemo(() => {
    const activity = payload ? mapTimelineEntries(payload).map(enrichTimelineActivityEntry) : [];
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

  const groupedItems = useMemo(
    () => groupStreamItemsByHeading(streamItems, new Date()),
    [streamItems]
  );

  const isLoadingStream = isLoading || isLoadingModelLayers || isLoadingSemantic;
  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return groupedItems
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!normalizedQuery) {
            return true;
          }
          return streamItemSearchHaystack(item).toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedItems, normalizedQuery]);

  const selectedObjectId = selection?.selectedObjectId ?? null;

  function isItemSelected(item: TimelineStreamItem): boolean {
    if (!selectedObjectId) {
      return false;
    }
    if (item.kind === "model_change") {
      return selectedObjectId === item.item.id;
    }
    if (item.entry.selectableObjectId) {
      return selectedObjectId === item.entry.selectableObjectId;
    }
    return false;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Timeline</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{TIMELINE_PAGE_INTRO}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]">
        <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-4 py-4 lg:mr-1.5">
          <SectionLabel>Filter</SectionLabel>
          <ul className="mt-2 space-y-0.5">
            {TIMELINE_SEMANTIC_FILTERS.map((filter) => (
              <li key={filter.id}>
                <button
                  type="button"
                  onClick={() => setSemanticFilter(filter.id)}
                  className={cn(
                    "o-calm w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium",
                    semanticFilter === filter.id
                      ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  {filter.label}
                </button>
              </li>
            ))}
          </ul>

          <SectionLabel className="mt-5">Lanes</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            {[
              { c: "bg-primary", l: "Model / context movement" },
              { c: "bg-action", l: "Reports / fieldwork / imports" },
              { c: "bg-foreground/60", l: "Decisions" },
              { c: "bg-muted-foreground", l: "Receipts" },
            ].map((lane) => (
              <li key={lane.l} className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", lane.c)} />
                {lane.l}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="relative mb-5">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search timeline…"
                className="w-full rounded-[10px] bg-secondary/60 py-2 pl-8 pr-3 text-sm text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
              />
            </div>

            {isLoadingStream ? (
              <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                {isLoading ? TIMELINE_ACTIVITY_LOADING_COPY : TIMELINE_MODEL_LAYERS_LOADING_COPY}
              </div>
            ) : (
              <>
                {errorMessage ? (
                  <div className="o-material mb-4 rounded-[10px] p-4 text-[13px] text-destructive" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
                {modelLayerError ? (
                  <div className="o-material mb-4 rounded-[10px] p-4 text-[13px] text-destructive" role="alert">
                    {modelLayerError}
                  </div>
                ) : null}
                {visibleGroups.length > 0 ? (
                  <div className="relative pl-5">
                    <div
                      className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
                      aria-hidden
                    />
                    {visibleGroups.map((group) => (
                      <div key={group.heading} className="mb-6">
                        <div className="relative mb-2.5">
                          <span className="absolute -left-[19px] top-0.5 size-3 rounded-full border-2 border-primary bg-card shadow-[0_0_0_3px_var(--card)]" />
                          <SectionLabel>{group.heading}</SectionLabel>
                        </div>
                        <div className="o-material overflow-hidden rounded-[10px]">
                          {group.items.map((item, index) => (
                            <div
                              key={
                                item.kind === "activity"
                                  ? `activity-${item.entry.id}`
                                  : `model-${item.item.id}`
                              }
                              className={index !== 0 ? "border-t o-hairline" : undefined}
                            >
                              <TimelineStreamRow
                                item={item}
                                selected={isItemSelected(item)}
                                onOpen={() => openTimelineItem(item, select, setInspectorTab)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !errorMessage && !modelLayerError ? (
                  <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                    {TIMELINE_ACTIVITY_EMPTY_COPY}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
