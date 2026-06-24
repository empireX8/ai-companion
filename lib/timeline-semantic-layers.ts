import type { InspectorSelectableObjectType } from "./inspector-selection";
import type { SurfacedActionView } from "./actions-api";
import type { ActiveQuestionItem } from "./active-questions";
import type { WatchForItem } from "./watch-for";
import { getWindowStartDate, resolveTimelineWindow, type TimelineWindow } from "./timeline-aggregation";
import type { TimelineEntry } from "./timeline-surface";

export type TimelineSemanticLane =
  | "model_movement"
  | "decisions_actions"
  | "fieldwork"
  | "reports"
  | "sessions_activity"
  | "receipts_activity";

export type TimelineSemanticEventKind =
  | "model_update"
  | "check_in"
  | "journal"
  | "explore_session"
  | "journal_chat"
  | "import"
  | "fieldwork"
  | "investigation"
  | "action_update";

export type TimelineSemanticFilter =
  | "all"
  | "model_movement"
  | "evidence_receipts"
  | "decisions_actions"
  | "fieldwork"
  | "reports_imports"
  | "sessions_activity";

export const TIMELINE_SEMANTIC_FILTERS: {
  id: TimelineSemanticFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "model_movement", label: "Model movement" },
  { id: "evidence_receipts", label: "Evidence / receipts" },
  { id: "decisions_actions", label: "Actions / decisions" },
  { id: "fieldwork", label: "Fieldwork / watch-for" },
  { id: "reports_imports", label: "Reports / imports" },
  { id: "sessions_activity", label: "Sessions / activity" },
];

export const TIMELINE_LANE_LABELS: Record<TimelineSemanticLane, string> = {
  model_movement: "Model movement",
  decisions_actions: "Decisions",
  fieldwork: "Fieldwork",
  reports: "Reports",
  sessions_activity: "Sessions",
  receipts_activity: "Receipts",
};

export const TIMELINE_SEMANTIC_ENDPOINTS = {
  watchFor: "/api/watch-for",
  activeQuestions: "/api/active-questions",
  actions: "/api/actions",
} as const;

function isWithinWindow(iso: string, windowStart: Date): boolean {
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time >= windowStart.getTime();
}

function actionStatusLabel(status: SurfacedActionView["status"]): string {
  if (status === "done") return "Done";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return "Not started";
}

export function mapWatchForToTimelineEntries(
  items: WatchForItem[],
  windowStart: Date
): TimelineEntry[] {
  return items
    .filter((item) => isWithinWindow(item.updatedAt, windowStart))
    .map((item) => ({
      id: `fieldwork-${item.id}`,
      occurredAt: item.updatedAt,
      chip: "Fieldwork",
      title: item.prompt,
      body: item.reason,
      href: `/watch-for/${item.id}`,
      kind: "fieldwork" as const,
      lane: "fieldwork" as const,
      sourceLabel: item.statusLabel,
      selectableObjectType: null,
      selectableObjectId: null,
    }));
}

export function mapInvestigationsToTimelineEntries(
  items: ActiveQuestionItem[],
  windowStart: Date
): TimelineEntry[] {
  return items
    .filter((item) => isWithinWindow(item.updatedAt, windowStart))
    .map((item) => ({
      id: `investigation-${item.id}`,
      occurredAt: item.updatedAt,
      chip: "Investigation",
      title: item.title,
      body: item.organizingQuestion,
      href: `/active-questions/${item.id}`,
      kind: "investigation" as const,
      lane: "fieldwork" as const,
      sourceLabel: item.statusLabel,
      selectableObjectType: null,
      selectableObjectId: null,
    }));
}

export function mapActionsToTimelineEntries(
  actions: SurfacedActionView[],
  windowStart: Date
): TimelineEntry[] {
  return actions
    .filter(
      (action) =>
        isWithinWindow(action.updatedAt, windowStart) && action.status !== "not_started"
    )
    .map((action) => ({
      id: `action-${action.id}`,
      occurredAt: action.updatedAt,
      chip: "Decision",
      title: action.title,
      body: action.whySuggested,
      href: "/actions",
      kind: "action_update" as const,
      lane: "decisions_actions" as const,
      sourceLabel: actionStatusLabel(action.status),
      selectableObjectType: action.linkedClaimId
        ? ("pattern_claim" as InspectorSelectableObjectType)
        : null,
      selectableObjectId: action.linkedClaimId,
    }));
}

export function enrichTimelineActivityEntry(entry: TimelineEntry): TimelineEntry {
  if (entry.kind) {
    return entry;
  }

  switch (entry.chip) {
    case "Check-in":
      return {
        ...entry,
        kind: "check_in",
        lane: "sessions_activity",
        sourceLabel: "Check-in",
      };
    case "Journal":
      return {
        ...entry,
        kind: "journal",
        lane: "receipts_activity",
        sourceLabel: "Journal",
      };
    case "Explore":
      return {
        ...entry,
        kind: "explore_session",
        lane: "sessions_activity",
        sourceLabel: "Explore session",
      };
    case "Journal Chat":
      return {
        ...entry,
        kind: "journal_chat",
        lane: "sessions_activity",
        sourceLabel: "Journal chat",
      };
    case "Imported":
      return {
        ...entry,
        kind: "import",
        lane: "reports",
        sourceLabel: "Import",
      };
    default:
      return {
        ...entry,
        kind: "check_in",
        lane: "sessions_activity",
        sourceLabel: entry.chip,
      };
  }
}

export function timelineEntryMatchesFilter(
  entry: TimelineEntry,
  filter: TimelineSemanticFilter
): boolean {
  if (filter === "all") {
    return true;
  }

  const lane = entry.lane ?? "sessions_activity";
  const kind = entry.kind;

  switch (filter) {
    case "model_movement":
      return false;
    case "evidence_receipts":
      return lane === "receipts_activity" || kind === "journal";
    case "decisions_actions":
      return lane === "decisions_actions";
    case "fieldwork":
      return lane === "fieldwork";
    case "reports_imports":
      return lane === "reports" || kind === "import";
    case "sessions_activity":
      return lane === "sessions_activity";
    default:
      return true;
  }
}

export function modelChangeMatchesFilter(
  filter: TimelineSemanticFilter
): boolean {
  return filter === "all" || filter === "model_movement";
}

export async function fetchTimelineSemanticEntries(
  windowValue: TimelineWindow
): Promise<TimelineEntry[]> {
  const windowStart = getWindowStartDate(windowValue, new Date());

  try {
    const [watchForResult, investigationsResult, actionsResult] = await Promise.allSettled([
      fetch(TIMELINE_SEMANTIC_ENDPOINTS.watchFor, { method: "GET", cache: "no-store" }),
      fetch(TIMELINE_SEMANTIC_ENDPOINTS.activeQuestions, {
        method: "GET",
        cache: "no-store",
      }),
      fetch(TIMELINE_SEMANTIC_ENDPOINTS.actions, { method: "GET", cache: "no-store" }),
    ]);

    const watchForItems =
      watchForResult.status === "fulfilled" && watchForResult.value.ok
        ? (((await watchForResult.value.json()) as { items?: WatchForItem[] }).items ??
          [])
        : [];

    const investigationItems =
      investigationsResult.status === "fulfilled" && investigationsResult.value.ok
        ? (((await investigationsResult.value.json()) as { items?: ActiveQuestionItem[] })
            .items ?? [])
        : [];

    let actionItems: SurfacedActionView[] = [];
    if (actionsResult.status === "fulfilled" && actionsResult.value.ok) {
      const payload = (await actionsResult.value.json()) as {
        stabilizeNow?: SurfacedActionView[];
        buildForward?: SurfacedActionView[];
      };
      actionItems = [
        ...(payload.stabilizeNow ?? []),
        ...(payload.buildForward ?? []),
      ];
    }

    return [
      ...mapWatchForToTimelineEntries(watchForItems, windowStart),
      ...mapInvestigationsToTimelineEntries(investigationItems, windowStart),
      ...mapActionsToTimelineEntries(actionItems, windowStart),
    ];
  } catch {
    return [];
  }
}

export function resolveTimelineWindowFromParam(value: string): TimelineWindow {
  return resolveTimelineWindow(value);
}
