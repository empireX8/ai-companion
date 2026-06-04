import { FieldworkStatus, type FieldworkAssignment } from "@prisma/client";

import {
  WATCH_FOR_VISIBLE_STATUSES,
  formatFieldworkStatus,
} from "./public-intelligence-safe-slice";
import { toNonEmptyPublicId } from "./public-continuity-registry";

type WatchForRecord = Pick<
  FieldworkAssignment,
  | "id"
  | "prompt"
  | "reason"
  | "status"
  | "linkedObjectType"
  | "linkedObjectId"
  | "createdAt"
  | "updatedAt"
>;

type WatchForDetailRecord = Pick<
  FieldworkAssignment,
  | "id"
  | "prompt"
  | "reason"
  | "status"
  | "linkedObjectType"
  | "linkedObjectId"
  | "createdAt"
  | "updatedAt"
>;

export type WatchForItem = {
  id: string;
  prompt: string;
  reason: string;
  status: FieldworkStatus;
  statusLabel: string;
  linkedObjectType: string;
  linkedObjectId: string | null;
  linkedObjectHref: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchForDetailItem = {
  id: string;
  prompt: string;
  reason: string;
  status: FieldworkStatus;
  statusLabel: string;
  linkedObjectType: string;
  linkedObjectId: string | null;
  linkedObjectHref: string | null;
  createdAt: string;
  updatedAt: string;
};

export {
  buildPublicWatchForWhere,
  isPublicWatchForCandidateLifecycle,
  PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY,
} from "./fieldwork-public-visibility";

export const WATCH_FOR_ENDPOINT = "/api/watch-for";
export const WATCH_FOR_LIMIT = 20;
export const WATCH_FOR_SAFE_VISIBLE_STATUSES = WATCH_FOR_VISIBLE_STATUSES;

export function toWatchForItem(row: WatchForRecord): WatchForItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    prompt: row.prompt,
    reason: row.reason,
    status: row.status,
    statusLabel: formatFieldworkStatus(row.status),
    linkedObjectType: row.linkedObjectType,
    linkedObjectId: toNonEmptyPublicId(row.linkedObjectId),
    linkedObjectHref: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWatchForDetailItem(
  row: WatchForDetailRecord
): WatchForDetailItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    prompt: row.prompt,
    reason: row.reason,
    status: row.status,
    statusLabel: formatFieldworkStatus(row.status),
    linkedObjectType: row.linkedObjectType,
    linkedObjectId: toNonEmptyPublicId(row.linkedObjectId),
    linkedObjectHref: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
