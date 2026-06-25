import { parseSelectableObjectFromHref } from "../inspector-selection";
import type { InspectorSelectableObjectType } from "../inspector-selection";
import {
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
} from "../timeline-model-layers";
import {
  modelChangeMatchesFilter,
  TIMELINE_LANE_LABELS,
  TIMELINE_SEMANTIC_FILTERS,
  timelineEntryMatchesFilter,
  type TimelineSemanticFilter,
  type TimelineSemanticLane,
} from "../timeline-semantic-layers";
import type { TimelineEntry } from "../timeline-surface";

export type V0TimelineLaneKey = "evidence" | "action" | "decision" | "receipt";

export type V0TimelineGroupHeading =
  | "Today"
  | "This week"
  | "Last week"
  | "Earlier"
  | "Imported history";

export type V0TimelineInspectorTarget = {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  title: string;
  tab: "movement" | "evidence";
  modelUpdateId?: string | null;
};

export type V0TimelineStreamRow = {
  id: string;
  title: string;
  summary: string | null;
  eventLabel: string;
  time: string;
  date: string;
  laneKey: V0TimelineLaneKey;
  moved: boolean;
  href: string | null;
  inspectorTarget: V0TimelineInspectorTarget | null;
  selectableObjectId: string | null;
  isModelChange: boolean;
  affectedObjectType?: TimelineModelLayerItem["affectedObjectType"];
  affectedObjectId?: string | null;
  affectedObjectHref?: string | null;
};

export type V0TimelineGroup = {
  heading: V0TimelineGroupHeading;
  rows: V0TimelineStreamRow[];
};

export type V0TimelineViewProps = {
  pageIntro: string;
  filters: typeof TIMELINE_SEMANTIC_FILTERS;
  activeFilter: TimelineSemanticFilter;
  lanes: Array<{ dotClass: string; label: string }>;
  searchQuery: string;
  isLoading: boolean;
  loadingCopy: string;
  activityError: string | null;
  modelLayerError: string | null;
  emptyCopy: string;
  groups: V0TimelineGroup[];
  selectedObjectId: string | null;
};

const GROUP_HEADINGS = [
  "Today",
  "This week",
  "Last week",
  "Earlier",
  "Imported history",
] as const satisfies readonly V0TimelineGroupHeading[];

const LANE_LEGEND: V0TimelineViewProps["lanes"] = [
  { dotClass: "bg-primary", label: "Model / context movement" },
  { dotClass: "bg-action", label: "Reports / fieldwork / imports" },
  { dotClass: "bg-foreground/60", label: "Decisions" },
  { dotClass: "bg-muted-foreground", label: "Receipts" },
];

function laneFromEntry(entry: TimelineEntry): V0TimelineLaneKey {
  const lane = entry.lane ?? "sessions_activity";
  if (lane === "model_movement") return "evidence";
  if (lane === "decisions_actions") return "decision";
  if (lane === "fieldwork" || lane === "reports") return "action";
  if (lane === "receipts_activity") return "receipt";
  return "receipt";
}

function laneFromModelChange(): V0TimelineLaneKey {
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

function resolveTimelineGroupHeading(
  dateKey: string,
  now: Date
): V0TimelineGroupHeading {
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
): Array<{ heading: V0TimelineGroupHeading; items: TimelineStreamItem[] }> {
  const buckets = new Map<V0TimelineGroupHeading, TimelineStreamItem[]>(
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

function resolveInspectorTarget(item: TimelineStreamItem): V0TimelineInspectorTarget | null {
  if (item.kind === "model_change") {
    const title = `${item.item.updateTypeLabel} · ${item.item.affectedObjectTypeLabel}`;
    return {
      objectType: "model_update",
      objectId: item.item.id,
      title,
      tab: "movement",
      modelUpdateId: item.item.id,
    };
  }

  const entry = item.entry;
  if (entry.selectableObjectType && entry.selectableObjectId) {
    return {
      objectType: entry.selectableObjectType,
      objectId: entry.selectableObjectId,
      title: entry.title,
      tab: entry.selectableObjectType === "model_update" ? "movement" : "evidence",
      modelUpdateId: entry.selectableObjectType === "model_update" ? entry.selectableObjectId : null,
    };
  }

  const fromHref = parseSelectableObjectFromHref(entry.href);
  if (!fromHref) {
    return null;
  }

  return {
    objectType: fromHref.objectType,
    objectId: fromHref.objectId,
    title: entry.title,
    tab: fromHref.objectType === "model_update" ? "movement" : "evidence",
    modelUpdateId: fromHref.objectType === "model_update" ? fromHref.objectId : null,
  };
}

function mapStreamItemToRow(item: TimelineStreamItem): V0TimelineStreamRow {
  const laneKey =
    item.kind === "model_change" ? laneFromModelChange() : laneFromEntry(item.entry);
  const occurredAt = item.occurredAt;
  const title =
    item.kind === "model_change"
      ? `${item.item.updateTypeLabel} · ${item.item.affectedObjectTypeLabel}`
      : item.entry.title;
  const summary =
    item.kind === "model_change" ? item.item.userFacingSummary : item.entry.body ?? null;
  const inspectorTarget = resolveInspectorTarget(item);

  const href =
    item.kind === "activity" && item.entry.href && !inspectorTarget ? item.entry.href : null;

  return {
    id:
      item.kind === "activity" ? `activity-${item.entry.id}` : `model-${item.item.id}`,
    title,
    summary,
    eventLabel: streamItemEventLabel(item),
    time: formatTime(occurredAt),
    date: formatDateLabel(occurredAt),
    laneKey,
    moved: item.kind === "model_change",
    href,
    inspectorTarget,
    selectableObjectId:
      item.kind === "model_change"
        ? item.item.id
        : item.entry.selectableObjectId ?? inspectorTarget?.objectId ?? null,
    isModelChange: item.kind === "model_change",
    affectedObjectType:
      item.kind === "model_change" ? item.item.affectedObjectType : undefined,
    affectedObjectId: item.kind === "model_change" ? item.item.affectedObjectId : undefined,
    affectedObjectHref: item.kind === "model_change" ? item.item.affectedObjectHref : undefined,
  };
}

export type MapTimelineDataInput = {
  timelineEntries: TimelineEntry[];
  modelLayers: TimelineModelLayerItem[];
  semanticFilter: TimelineSemanticFilter;
  searchQuery: string;
  isLoadingActivity: boolean;
  isLoadingModelLayers: boolean;
  isLoadingSemantic: boolean;
  activityError: string | null;
  modelLayerError: string | null;
  selectedObjectId: string | null;
  now?: Date;
};

export function mapTimelineDataToV0Props(input: MapTimelineDataInput): V0TimelineViewProps {
  const {
    timelineEntries,
    modelLayers,
    semanticFilter,
    searchQuery,
    isLoadingActivity,
    isLoadingModelLayers,
    isLoadingSemantic,
    activityError,
    modelLayerError,
    selectedObjectId,
    now = new Date(),
  } = input;

  const streamItems = buildTimelineStreamItems({
    activity: timelineEntries,
    modelLayers,
  });

  const filteredItems =
    semanticFilter === "all"
      ? streamItems
      : streamItems.filter((item) => {
          if (item.kind === "model_change") {
            return modelChangeMatchesFilter(semanticFilter);
          }
          return timelineEntryMatchesFilter(item.entry, semanticFilter);
        });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchedItems = normalizedQuery
    ? filteredItems.filter((item) =>
        streamItemSearchHaystack(item).toLowerCase().includes(normalizedQuery)
      )
    : filteredItems;

  const grouped = groupStreamItemsByHeading(searchedItems, now);
  const isLoading = isLoadingActivity || isLoadingModelLayers || isLoadingSemantic;

  return {
    pageIntro: TIMELINE_PAGE_INTRO,
    filters: TIMELINE_SEMANTIC_FILTERS,
    activeFilter: semanticFilter,
    lanes: LANE_LEGEND,
    searchQuery,
    isLoading,
    loadingCopy: isLoadingActivity
      ? TIMELINE_ACTIVITY_LOADING_COPY
      : TIMELINE_MODEL_LAYERS_LOADING_COPY,
    activityError,
    modelLayerError,
    emptyCopy: TIMELINE_ACTIVITY_EMPTY_COPY,
    groups: grouped.map((group) => ({
      heading: group.heading,
      rows: group.items.map(mapStreamItemToRow),
    })),
    selectedObjectId,
  };
}

export function resolveTimelineOpenTarget(
  rows: V0TimelineStreamRow[],
  rowId: string
): V0TimelineInspectorTarget | null {
  return rows.find((row) => row.id === rowId)?.inspectorTarget ?? null;
}
