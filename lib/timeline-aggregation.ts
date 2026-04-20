/**
 * Timeline aggregation helpers — deterministic, count-based only.
 *
 * No forecasts. No cycle-length claims. No confidence scores.
 * All outputs are direct summaries of what is present in the data.
 */

import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInEventTag,
  type QuickCheckInStateTag,
  type QuickCheckInView,
} from "./quick-check-ins";

// ── Time windows ──────────────────────────────────────────────────────────────

export const TIMELINE_WINDOWS = ["14d", "30d", "90d"] as const;
export type TimelineWindow = (typeof TIMELINE_WINDOWS)[number];
export const TIMELINE_DEFAULT_WINDOW: TimelineWindow = "30d";

const WINDOW_DAYS: Record<TimelineWindow, number> = {
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

export function isTimelineWindow(value: string | null | undefined): value is TimelineWindow {
  return (
    typeof value === "string" &&
    (TIMELINE_WINDOWS as readonly string[]).includes(value)
  );
}

export function resolveTimelineWindow(
  value: string | null | undefined
): TimelineWindow {
  return isTimelineWindow(value) ? value : TIMELINE_DEFAULT_WINDOW;
}

export function resolveTimelineWindowSearchParam(
  value: string | string[] | null | undefined
): TimelineWindow {
  return resolveTimelineWindow(typeof value === "string" ? value : undefined);
}

/**
 * Returns the UTC-midnight start date for the given window relative to `now`.
 * Midnight in UTC keeps server-side DB queries predictable.
 */
export function getWindowStartDate(window: TimelineWindow, now: Date): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS[window]);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── Rhythms ───────────────────────────────────────────────────────────────────

export type TagCount<T extends string> = { tag: T; count: number };

export type StateEventPair = {
  stateTag: QuickCheckInStateTag;
  eventTag: QuickCheckInEventTag;
  count: number;
};

export type TimelineRhythms = {
  totalCount: number;
  topStateTags: TagCount<QuickCheckInStateTag>[];
  topEventTags: TagCount<QuickCheckInEventTag>[];
  lastCheckInAt: string | null;
};

/**
 * Summarise what is present in the check-in list.
 * Top-3 state tags and top-3 event tags by frequency, descending.
 * `lastCheckInAt` is the ISO timestamp of the most-recent item (list is
 * expected to arrive newest-first from the API).
 */
export function computeRhythms(checkIns: QuickCheckInView[]): TimelineRhythms {
  if (checkIns.length === 0) {
    return {
      totalCount: 0,
      topStateTags: [],
      topEventTags: [],
      lastCheckInAt: null,
    };
  }

  const stateCounts = new Map<QuickCheckInStateTag, number>();
  const eventCounts = new Map<QuickCheckInEventTag, number>();

  for (const ci of checkIns) {
    if (ci.stateTag) {
      stateCounts.set(ci.stateTag, (stateCounts.get(ci.stateTag) ?? 0) + 1);
    }
    for (const tag of ci.eventTags) {
      eventCounts.set(tag, (eventCounts.get(tag) ?? 0) + 1);
    }
  }

  const topStateTags: TagCount<QuickCheckInStateTag>[] = [
    ...stateCounts.entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => ({ tag, count }));

  const topEventTags: TagCount<QuickCheckInEventTag>[] = [
    ...eventCounts.entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalCount: checkIns.length,
    topStateTags,
    topEventTags,
    lastCheckInAt: checkIns[0]?.createdAt ?? null,
  };
}

// ── Repeated signals ──────────────────────────────────────────────────────────

export type RepeatedSignals = {
  repeatedStateTags: TagCount<QuickCheckInStateTag>[];
  repeatedEventTags: TagCount<QuickCheckInEventTag>[];
  repeatedPairs: StateEventPair[];
  rankedItems: RepeatedSignalItem[];
};

export type RepeatedSignalItem =
  | {
      kind: "state";
      tag: QuickCheckInStateTag;
      count: number;
      lastSeenAt: string;
    }
  | {
      kind: "event";
      tag: QuickCheckInEventTag;
      count: number;
      lastSeenAt: string;
    }
  | {
      kind: "pair";
      stateTag: QuickCheckInStateTag;
      eventTag: QuickCheckInEventTag;
      count: number;
      lastSeenAt: string;
    };

type RepeatedStat = {
  count: number;
  lastSeenAt: string;
};

const MAX_REPEATED_STATES = 3;
const MAX_REPEATED_EVENTS = 3;
const MAX_REPEATED_PAIRS = 5;
export const MAX_RANKED_REPEATED_ITEMS = 6;

function compareIsoDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function compareTagEntries(
  left: [string, RepeatedStat],
  right: [string, RepeatedStat],
  labels: Record<string, string>
): number {
  if (right[1].count !== left[1].count) {
    return right[1].count - left[1].count;
  }

  const recencyCompare = compareIsoDesc(left[1].lastSeenAt, right[1].lastSeenAt);
  if (recencyCompare !== 0) {
    return recencyCompare;
  }

  const readabilityCompare = labels[left[0]]!.length - labels[right[0]]!.length;
  if (readabilityCompare !== 0) {
    return readabilityCompare;
  }

  return labels[left[0]]!.localeCompare(labels[right[0]]!);
}

function pairReadability(stateTag: string, eventTag: string): number {
  return (
    QUICK_CHECK_IN_STATE_LABELS[stateTag as QuickCheckInStateTag].length +
    QUICK_CHECK_IN_EVENT_LABELS[eventTag as QuickCheckInEventTag].length +
    1
  );
}

function comparePairEntries(
  left: [string, RepeatedStat],
  right: [string, RepeatedStat]
): number {
  if (right[1].count !== left[1].count) {
    return right[1].count - left[1].count;
  }

  const recencyCompare = compareIsoDesc(left[1].lastSeenAt, right[1].lastSeenAt);
  if (recencyCompare !== 0) {
    return recencyCompare;
  }

  const [leftState, leftEvent] = left[0].split(":");
  const [rightState, rightEvent] = right[0].split(":");
  const readabilityCompare =
    pairReadability(leftState!, leftEvent!) - pairReadability(rightState!, rightEvent!);
  if (readabilityCompare !== 0) {
    return readabilityCompare;
  }

  return left[0].localeCompare(right[0]);
}

function repeatedItemReadability(item: RepeatedSignalItem): number {
  if (item.kind === "state") {
    return QUICK_CHECK_IN_STATE_LABELS[item.tag].length;
  }
  if (item.kind === "event") {
    return QUICK_CHECK_IN_EVENT_LABELS[item.tag].length;
  }
  return pairReadability(item.stateTag, item.eventTag);
}

function repeatedItemKindWeight(item: RepeatedSignalItem): number {
  return item.kind === "pair" ? 2 : 1;
}

function repeatedItemKey(item: RepeatedSignalItem): string {
  if (item.kind === "state") {
    return `state:${item.tag}`;
  }
  if (item.kind === "event") {
    return `event:${item.tag}`;
  }
  return `pair:${item.stateTag}:${item.eventTag}`;
}

function compareRepeatedItems(
  left: RepeatedSignalItem,
  right: RepeatedSignalItem
): number {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  const recencyCompare = compareIsoDesc(left.lastSeenAt, right.lastSeenAt);
  if (recencyCompare !== 0) {
    return recencyCompare;
  }

  const kindDelta = repeatedItemKindWeight(left) - repeatedItemKindWeight(right);
  if (kindDelta !== 0) {
    return kindDelta;
  }

  const readabilityCompare = repeatedItemReadability(left) - repeatedItemReadability(right);
  if (readabilityCompare !== 0) {
    return readabilityCompare;
  }

  return repeatedItemKey(left).localeCompare(repeatedItemKey(right));
}

/**
 * Return state tags, event tags, and state+event pairs that appear at least
 * twice in the window. Sorted by count descending. No inference, no cycle
 * claims — just counts.
 */
export function computeRepeatedSignals(
  checkIns: QuickCheckInView[]
): RepeatedSignals {
  const stateStats = new Map<QuickCheckInStateTag, RepeatedStat>();
  const eventStats = new Map<QuickCheckInEventTag, RepeatedStat>();
  const pairStats = new Map<string, RepeatedStat>();

  for (const ci of checkIns) {
    if (ci.stateTag) {
      const currentState = stateStats.get(ci.stateTag);
      stateStats.set(ci.stateTag, {
        count: (currentState?.count ?? 0) + 1,
        lastSeenAt:
          currentState && compareIsoDesc(currentState.lastSeenAt, ci.createdAt) < 0
            ? currentState.lastSeenAt
            : ci.createdAt,
      });
    }

    for (const eventTag of ci.eventTags) {
      const currentEvent = eventStats.get(eventTag);
      eventStats.set(eventTag, {
        count: (currentEvent?.count ?? 0) + 1,
        lastSeenAt:
          currentEvent && compareIsoDesc(currentEvent.lastSeenAt, ci.createdAt) < 0
            ? currentEvent.lastSeenAt
            : ci.createdAt,
      });
    }

    if (!ci.stateTag || ci.eventTags.length === 0) continue;
    for (const eventTag of ci.eventTags) {
      const key = `${ci.stateTag}:${eventTag}`;
      const currentPair = pairStats.get(key);
      pairStats.set(key, {
        count: (currentPair?.count ?? 0) + 1,
        lastSeenAt:
          currentPair && compareIsoDesc(currentPair.lastSeenAt, ci.createdAt) < 0
            ? currentPair.lastSeenAt
            : ci.createdAt,
      });
    }
  }

  const repeatedStateTags: TagCount<QuickCheckInStateTag>[] = [...stateStats.entries()]
    .filter(([, stat]) => stat.count >= 2)
    .sort((a, b) => compareTagEntries(a, b, QUICK_CHECK_IN_STATE_LABELS))
    .slice(0, MAX_REPEATED_STATES)
    .map(([tag, stat]) => ({ tag, count: stat.count }));

  const repeatedEventTags: TagCount<QuickCheckInEventTag>[] = [...eventStats.entries()]
    .filter(([, stat]) => stat.count >= 2)
    .sort((a, b) => compareTagEntries(a, b, QUICK_CHECK_IN_EVENT_LABELS))
    .slice(0, MAX_REPEATED_EVENTS)
    .map(([tag, stat]) => ({ tag, count: stat.count }));

  const repeatedPairs: StateEventPair[] = [...pairStats.entries()]
    .filter(([, stat]) => stat.count >= 2)
    .sort(comparePairEntries)
    .slice(0, MAX_REPEATED_PAIRS)
    .map(([key, stat]) => {
      const colonIdx = key.indexOf(":");
      const stateTag = key.slice(0, colonIdx) as QuickCheckInStateTag;
      const eventTag = key.slice(colonIdx + 1) as QuickCheckInEventTag;
      return { stateTag, eventTag, count: stat.count };
    });

  const rankedItems: RepeatedSignalItem[] = [
    ...[...stateStats.entries()]
      .filter(([, stat]) => stat.count >= 2)
      .map(([tag, stat]) => ({
        kind: "state" as const,
        tag,
        count: stat.count,
        lastSeenAt: stat.lastSeenAt,
      })),
    ...[...eventStats.entries()]
      .filter(([, stat]) => stat.count >= 2)
      .map(([tag, stat]) => ({
        kind: "event" as const,
        tag,
        count: stat.count,
        lastSeenAt: stat.lastSeenAt,
      })),
    ...[...pairStats.entries()]
      .filter(([, stat]) => stat.count >= 2)
      .map(([key, stat]) => {
        const colonIdx = key.indexOf(":");
        return {
          kind: "pair" as const,
          stateTag: key.slice(0, colonIdx) as QuickCheckInStateTag,
          eventTag: key.slice(colonIdx + 1) as QuickCheckInEventTag,
          count: stat.count,
          lastSeenAt: stat.lastSeenAt,
        };
      }),
  ].sort(compareRepeatedItems).slice(0, MAX_RANKED_REPEATED_ITEMS);

  return {
    repeatedStateTags,
    repeatedEventTags,
    repeatedPairs,
    rankedItems,
  };
}

// ── Imported conversation chronology ─────────────────────────────────────────

export type ImportedConversationActivityItem = {
  id: string;
  startedAt: string;
  label: string | null;
  preview: string | null;
  messageCount: number;
};

export type ImportedConversationSummary = {
  activeDayCount: number;
  sessionCount: number;
  messageCount: number;
  lastActivityAt: string | null;
};

export type ImportedConversationDateGroup = {
  dateKey: string;
  label: string;
  sessionCount: number;
  messageCount: number;
  items: ImportedConversationActivityItem[];
};

export function computeImportedConversationSummary(
  items: ImportedConversationActivityItem[]
): ImportedConversationSummary {
  if (items.length === 0) {
    return {
      activeDayCount: 0,
      sessionCount: 0,
      messageCount: 0,
      lastActivityAt: null,
    };
  }

  const activeDays = new Set<string>();
  let messageCount = 0;
  let lastActivityAt: string | null = null;

  for (const item of items) {
    activeDays.add(toLocalDateKey(new Date(item.startedAt)));
    messageCount += item.messageCount;
    if (!lastActivityAt || item.startedAt > lastActivityAt) {
      lastActivityAt = item.startedAt;
    }
  }

  return {
    activeDayCount: activeDays.size,
    sessionCount: items.length,
    messageCount,
    lastActivityAt,
  };
}

// ── Date grouping ─────────────────────────────────────────────────────────────

export type DateGroup = {
  dateKey: string; // "YYYY-MM-DD" in the viewer's local time
  label: string; // "Today" / "Yesterday" / "Apr 15"
  items: QuickCheckInView[];
};

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateGroupLabel(
  dateKey: string,
  todayKey: string,
  yesterdayKey: string,
  now: Date
): string {
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(year!, month! - 1, day!);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/**
 * Group check-ins by local date (viewer's timezone), newest group first.
 * Items within each group preserve their original order (newest-first).
 * `now` should be `new Date()` from the calling context.
 */
export function groupCheckInsByDate(
  checkIns: QuickCheckInView[],
  now: Date
): DateGroup[] {
  const todayKey = toLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const groupMap = new Map<string, QuickCheckInView[]>();
  for (const ci of checkIns) {
    const key = toLocalDateKey(new Date(ci.createdAt));
    const existing = groupMap.get(key) ?? [];
    existing.push(ci);
    groupMap.set(key, existing);
  }

  return [...groupMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatDateGroupLabel(dateKey, todayKey, yesterdayKey, now),
      items,
    }));
}

export function groupImportedConversationActivityByDate(
  items: ImportedConversationActivityItem[],
  now: Date
): ImportedConversationDateGroup[] {
  const todayKey = toLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const groupMap = new Map<string, ImportedConversationActivityItem[]>();
  for (const item of items) {
    const key = toLocalDateKey(new Date(item.startedAt));
    const existing = groupMap.get(key) ?? [];
    existing.push(item);
    groupMap.set(key, existing);
  }

  return [...groupMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, groupedItems]) => ({
      dateKey,
      label: formatDateGroupLabel(dateKey, todayKey, yesterdayKey, now),
      sessionCount: groupedItems.length,
      messageCount: groupedItems.reduce((sum, item) => sum + item.messageCount, 0),
      items: groupedItems,
    }));
}
