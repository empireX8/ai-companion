import type { ModelUpdate } from "@prisma/client";

import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";
import type { TimelineEntry } from "./timeline-surface";

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

export const TIMELINE_PAGE_META =
  "Rhythms, signals, activity, and model changes in this window";
export const TIMELINE_SIGNALS_SECTION_LABEL = "Signals in this window";
export const TIMELINE_ACTIVITY_SECTION_LABEL = "Activity & changes";
export const TIMELINE_ACTIVITY_SECTION_INTRO =
  "Connected activity and meaningful model changes, grouped by day.";
export const TIMELINE_MODEL_CHANGE_CHIP = "Model change";
export const TIMELINE_ACTIVITY_LOADING_COPY = "Loading activity and model changes…";
export const TIMELINE_ACTIVITY_EMPTY_COPY =
  "No activity or model changes in this window yet.";
export const TIMELINE_MODEL_LAYERS_LOADING_COPY =
  "Loading model changes for this window…";

export type TimelineStreamItem =
  | { kind: "activity"; occurredAt: string; entry: TimelineEntry }
  | { kind: "model_change"; occurredAt: string; item: TimelineModelLayerItem };

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
