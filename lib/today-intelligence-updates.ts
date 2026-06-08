import type { ModelUpdate } from "@prisma/client";

import {
  toWhatChangedListItem,
  type WhatChangedListItem,
} from "./public-intelligence-safe-slice";

type TodayIntelligenceUpdateRecord = Pick<
  ModelUpdate,
  | "id"
  | "updateType"
  | "affectedObjectType"
  | "affectedObjectId"
  | "userFacingSummary"
  | "createdAt"
>;

export type TodayIntelligenceUpdateItem = WhatChangedListItem;

export const TODAY_INTELLIGENCE_UPDATES_ENDPOINT =
  "/api/today/intelligence-updates";
export const TODAY_INTELLIGENCE_UPDATES_LIMIT = 3;

export const TODAY_CHANGES_SUBSECTION_LABEL = "Recent changes";
export const TODAY_CHANGES_EMPTY_COPY =
  "No meaningful changes in the recent window yet.";
export const TODAY_CHANGES_VIEW_ALL_HREF = "/what-changed";

export function toTodayIntelligenceUpdateItem(
  row: TodayIntelligenceUpdateRecord
): TodayIntelligenceUpdateItem | null {
  return toWhatChangedListItem(row);
}
