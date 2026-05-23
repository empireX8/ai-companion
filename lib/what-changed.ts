import type { ModelUpdate } from "@prisma/client";

import { toNonEmptyPublicId } from "./public-continuity-registry";

type WhatChangedRecord = Pick<
  ModelUpdate,
  | "id"
  | "updateType"
  | "affectedObjectType"
  | "affectedObjectId"
  | "userFacingSummary"
  | "createdAt"
>;

export type WhatChangedItem = {
  id: string;
  userFacingSummary: string;
  updateType: WhatChangedRecord["updateType"];
  affectedObjectType: WhatChangedRecord["affectedObjectType"];
  affectedObjectId: string | null;
  affectedObjectHref: string | null;
  createdAt: string;
};

export const WHAT_CHANGED_ENDPOINT = "/api/what-changed";
export const WHAT_CHANGED_LIMIT = 20;

export function toWhatChangedItem(
  row: WhatChangedRecord
): WhatChangedItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    userFacingSummary: row.userFacingSummary,
    updateType: row.updateType,
    affectedObjectType: row.affectedObjectType,
    affectedObjectId: toNonEmptyPublicId(row.affectedObjectId),
    affectedObjectHref: null,
    createdAt: row.createdAt.toISOString(),
  };
}
