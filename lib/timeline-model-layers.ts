import type { ModelUpdate } from "@prisma/client";

import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";

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

export function buildTimelineModelLayersRequestUrl(windowValue: string): string {
  const windowParam = encodeURIComponent(windowValue);
  return `${TIMELINE_MODEL_LAYERS_ENDPOINT}?window=${windowParam}`;
}

export function toTimelineModelLayerItem(
  row: TimelineModelLayerRecord
): TimelineModelLayerItem | null {
  return toWhatChangedListItem(row);
}
