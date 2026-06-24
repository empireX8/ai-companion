import type { ModelUpdate } from "@prisma/client";

import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";
import type { TimelineEntry } from "./timeline-surface";
import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

type TimelineModelLayerRecord = Pick<
  ModelUpdate,
  | "id"
  | "updateType"
  | "affectedObjectType"
  | "affectedObjectId"
  | "userFacingSummary"
  | "createdAt"
>;

export type TimelineModelLayerItem = WhatChangedListItem;

export const TIMELINE_MODEL_LAYERS_ENDPOINT = "/api/timeline/model-layers";
export const TIMELINE_MODEL_LAYERS_LIMIT = 20;

export const TIMELINE_DISPLAY_TIMEZONE = "Europe/London";

export const TIMELINE_PAGE_META =
  `Semantic evolution — ${ORVEK_COPY.mindModelMovement}, evidence, decisions, and fieldwork over time`;

export const TIMELINE_PAGE_INTRO =
  `Timeline shows how your ${ORVEK_COPY.mindModel.toLowerCase()}, evidence, patterns, questions, decisions, and fieldwork evolved — not a generic activity feed. Movement appears when ${PRODUCT_NAME} publishes it from your signal.`;

export const TIMELINE_REENTRY_LINKS = [
  { href: "/", label: "Today" },
  { href: "/your-map", label: "Your Map" },
  { href: "/what-changed", label: "What Changed" },
  { href: "/watch-for", label: "Fieldwork" },
  { href: "/actions", label: "Decisions" },
] as const;

export const TIMELINE_RHYTHMS_SECTION_LABEL = "Check-in rhythms";
export const TIMELINE_RHYTHMS_SECTION_INTRO =
  "Cadence and recurring state/event pairings from check-ins in this window — signal context, not a calendar.";
export const TIMELINE_RHYTHMS_EMPTY_COPY =
  "Not enough check-ins to show a rhythm yet.";
export const TIMELINE_RHYTHMS_NO_STATES_COPY =
  "No check-ins in this window yet.";
export const TIMELINE_RHYTHMS_NO_EVENTS_COPY =
  "No repeated events in this window yet.";

export const TIMELINE_SIGNALS_SECTION_LABEL = "Signals in this window";
export const TIMELINE_SIGNALS_SECTION_INTRO =
  "Recurring pairings and ranked signals from check-ins — possible links to notice, not conclusions.";
export const TIMELINE_SIGNALS_POSSIBLE_LINKS_LABEL = "Possible links";
export const TIMELINE_SIGNALS_REPEATED_LABEL = "Repeated signals";
export const TIMELINE_SIGNALS_NO_LINKS_COPY =
  "No recurring state/event links yet.";
export const TIMELINE_SIGNALS_NO_SIGNALS_COPY =
  "No repeated signals in this window yet.";

export const TIMELINE_ACTIVITY_SECTION_LABEL = "Evolution stream";
export const TIMELINE_ACTIVITY_SECTION_INTRO =
  `Published ${ORVEK_COPY.mindModelMovement.toLowerCase()}, decisions, fieldwork, evidence, and sessions — grouped by day.`;
export const TIMELINE_MODEL_CHANGE_CHIP = ORVEK_COPY.mindModelMovement;
export const TIMELINE_ACTIVITY_LOADING_COPY =
  "Loading evolution stream for this window…";
export const TIMELINE_ACTIVITY_EMPTY_COPY =
  `No published evolution in this window yet. Capture in journal, Explore, or Fieldwork — ${ORVEK_COPY.mindModelMovement.toLowerCase()} appears when ${PRODUCT_NAME} publishes it.`;
export const TIMELINE_MODEL_LAYERS_LOADING_COPY =
  `Loading ${ORVEK_COPY.mindModelMovement.toLowerCase()} for this window…`;
export const TIMELINE_MODEL_LAYERS_ERROR_COPY =
  `Could not load ${ORVEK_COPY.mindModelMovement.toLowerCase()}.`;

export type TimelineStreamItem =
  | { kind: "activity"; occurredAt: string; entry: TimelineEntry }
  | { kind: "model_change"; occurredAt: string; item: TimelineModelLayerItem };

const londonDatePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMELINE_DISPLAY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toTimelineLondonDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "invalid";
  }

  const parts = londonDatePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "invalid";
  }

  return `${year}-${month}-${day}`;
}

export function formatTimelineLondonDateLabel(dateKey: string, now: Date): string {
  const todayKey = toTimelineLondonDateKey(now.toISOString());
  const yesterdayKey = toTimelineLondonDateKey(
    new Date(now.getTime() - 86_400_000).toISOString()
  );

  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === yesterdayKey) {
    return "Yesterday";
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return "Unknown day";
  }

  const nowYear = Number(todayKey.split("-")[0]);
  const labelDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMELINE_DISPLAY_TIMEZONE,
    month: "short",
    day: "numeric",
    ...(year !== nowYear ? { year: "numeric" } : {}),
  }).format(labelDate);
}

export function groupTimelineStreamByDate(
  items: TimelineStreamItem[],
  now: Date
): Array<{ date: string; items: TimelineStreamItem[] }> {
  const grouped = new Map<string, TimelineStreamItem[]>();

  for (const item of items) {
    const key = toTimelineLondonDateKey(item.occurredAt);
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([dateKey, streamItems]) => ({
      date: formatTimelineLondonDateLabel(dateKey, now),
      items: streamItems.sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
      ),
    }));
}

export function buildTimelineStreamItems(input: {
  activity: TimelineEntry[];
  modelLayers: TimelineModelLayerItem[];
}): TimelineStreamItem[] {
  const activityItems: TimelineStreamItem[] = input.activity.map((entry) => ({
    kind: "activity",
    occurredAt: entry.occurredAt,
    entry,
  }));
  const modelItems: TimelineStreamItem[] = input.modelLayers.map((item) => ({
    kind: "model_change",
    occurredAt: item.createdAt,
    item,
  }));

  return [...activityItems, ...modelItems].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );
}

export function buildTimelineModelLayersRequestUrl(windowValue: string): string {
  const windowParam = encodeURIComponent(windowValue);
  return `${TIMELINE_MODEL_LAYERS_ENDPOINT}?window=${windowParam}`;
}

export function toTimelineModelLayerItem(
  row: TimelineModelLayerRecord
): TimelineModelLayerItem | null {
  return toWhatChangedListItem(row);
}
