import { InvestigationStatus, type Investigation } from "@prisma/client";

import {
  ACTIVE_QUESTION_VISIBLE_STATUSES,
  formatInvestigationStatus,
} from "./public-intelligence-safe-slice";
import { toNonEmptyPublicId } from "./public-continuity-registry";

type ActiveQuestionRecord = Pick<
  Investigation,
  | "id"
  | "title"
  | "organizingQuestion"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

type ActiveQuestionDetailRecord = Pick<
  Investigation,
  | "id"
  | "title"
  | "organizingQuestion"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "resolvedIntoUserMapConclusionId"
>;

export type ActiveQuestionItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  status: InvestigationStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type ActiveQuestionDetailItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  status: InvestigationStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  resolvedIntoUserMapConclusionId: string | null;
  resolvedIntoUserMapConclusionHref: string | null;
};

export const ACTIVE_QUESTIONS_ENDPOINT = "/api/active-questions";
export const ACTIVE_QUESTIONS_LIMIT = 20;
export const ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES =
  ACTIVE_QUESTION_VISIBLE_STATUSES;

export {
  buildPublicActiveInvestigationWhere,
  PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_INVESTIGATION_VISIBILITY,
} from "./investigation-public-visibility";

export function toActiveQuestionItem(
  row: ActiveQuestionRecord
): ActiveQuestionItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    status: row.status,
    statusLabel: formatInvestigationStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toActiveQuestionDetailItem(
  row: ActiveQuestionDetailRecord
): ActiveQuestionDetailItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    status: row.status,
    statusLabel: formatInvestigationStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedIntoUserMapConclusionId: toNonEmptyPublicId(
      row.resolvedIntoUserMapConclusionId
    ),
    resolvedIntoUserMapConclusionHref: null,
  };
}
