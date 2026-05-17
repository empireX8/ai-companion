import {
  FieldworkStatus,
  InvestigationStatus,
  UnderstandingLinkTargetType,
  type FieldworkAssignment,
  type Investigation,
} from "@prisma/client";

export const ACTIVE_QUESTION_VISIBLE_STATUSES: InvestigationStatus[] = [
  "open",
  "gathering_evidence",
  "testing",
  "resolving",
  "reopened",
];

export const WATCH_FOR_VISIBLE_STATUSES: FieldworkStatus[] = [
  "assigned",
  "active",
];

type InvestigationListRecord = Pick<
  Investigation,
  "id" | "title" | "organizingQuestion" | "status" | "seedType" | "priority" | "updatedAt"
>;

type InvestigationDetailRecord = Pick<
  Investigation,
  | "id"
  | "title"
  | "organizingQuestion"
  | "status"
  | "seedType"
  | "priority"
  | "createdAt"
  | "updatedAt"
  | "resolutionSummary"
  | "resolvedAt"
  | "resolvedIntoUserMapConclusionId"
  | "reopenReason"
  | "competingTheories"
  | "evidenceNeeded"
>;

type FieldworkListRecord = Pick<
  FieldworkAssignment,
  | "id"
  | "prompt"
  | "reason"
  | "status"
  | "linkedObjectType"
  | "linkedObjectId"
  | "priority"
  | "updatedAt"
>;

function toNonEmptyId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function formatInvestigationStatus(status: InvestigationStatus): string {
  return toTitleCase(status);
}

export function formatInvestigationSeedType(seedType: Investigation["seedType"]): string {
  return toTitleCase(seedType);
}

export function formatFieldworkStatus(status: FieldworkStatus): string {
  return toTitleCase(status);
}

export function formatLinkedObjectType(type: UnderstandingLinkTargetType): string {
  return toTitleCase(type);
}

export function buildActiveQuestionDetailHref(id: string | null | undefined): string | null {
  const safeId = toNonEmptyId(id);
  return safeId ? `/active-questions/${safeId}` : null;
}

export function buildWatchForDetailHref(id: string | null | undefined): string | null {
  const safeId = toNonEmptyId(id);
  return safeId ? `/watch-for/${safeId}` : null;
}

export function buildLinkedObjectHref(input: {
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectId: string | null | undefined;
}): string | null {
  const safeId = toNonEmptyId(input.linkedObjectId);
  if (!safeId) {
    return null;
  }

  if (input.linkedObjectType === "investigation") {
    return buildActiveQuestionDetailHref(safeId);
  }
  if (input.linkedObjectType === "fieldwork_assignment") {
    return buildWatchForDetailHref(safeId);
  }
  if (input.linkedObjectType === "pattern_claim") {
    return `/patterns/${safeId}`;
  }
  if (input.linkedObjectType === "contradiction_node") {
    return `/contradictions/${safeId}`;
  }

  return null;
}

export type ActiveQuestionListItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  status: InvestigationStatus;
  statusLabel: string;
  seedTypeLabel: string;
  priority: number | null;
  updatedAt: string;
  detailHref: string;
};

export type ActiveQuestionDetailItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  statusLabel: string;
  seedTypeLabel: string;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  reopenReason: string | null;
  resolvedConclusionId: string | null;
  competingTheories: string[];
  evidenceNeeded: string[];
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function toActiveQuestionListItem(
  row: InvestigationListRecord
): ActiveQuestionListItem | null {
  const safeId = toNonEmptyId(row.id);
  const detailHref = buildActiveQuestionDetailHref(safeId);
  if (!safeId || !detailHref) {
    return null;
  }

  return {
    id: safeId,
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    status: row.status,
    statusLabel: formatInvestigationStatus(row.status),
    seedTypeLabel: formatInvestigationSeedType(row.seedType),
    priority: row.priority ?? null,
    updatedAt: row.updatedAt.toISOString(),
    detailHref,
  };
}

export function toActiveQuestionDetailItem(
  row: InvestigationDetailRecord
): ActiveQuestionDetailItem | null {
  const safeId = toNonEmptyId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    statusLabel: formatInvestigationStatus(row.status),
    seedTypeLabel: formatInvestigationSeedType(row.seedType),
    priority: row.priority ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionSummary: row.resolutionSummary ?? null,
    reopenReason: row.reopenReason ?? null,
    resolvedConclusionId: toNonEmptyId(row.resolvedIntoUserMapConclusionId),
    competingTheories: toStringArray(row.competingTheories),
    evidenceNeeded: toStringArray(row.evidenceNeeded),
  };
}

export type WatchForListItem = {
  id: string;
  prompt: string;
  reason: string;
  statusLabel: string;
  linkedObjectType: UnderstandingLinkTargetType;
  linkedObjectTypeLabel: string;
  linkedObjectId: string | null;
  linkedObjectHref: string | null;
  priority: number | null;
  updatedAt: string;
  detailHref: string;
};

export function toWatchForListItem(row: FieldworkListRecord): WatchForListItem | null {
  const safeId = toNonEmptyId(row.id);
  const detailHref = buildWatchForDetailHref(safeId);
  if (!safeId || !detailHref) {
    return null;
  }

  const safeLinkedObjectId = toNonEmptyId(row.linkedObjectId);

  return {
    id: safeId,
    prompt: row.prompt,
    reason: row.reason,
    statusLabel: formatFieldworkStatus(row.status),
    linkedObjectType: row.linkedObjectType,
    linkedObjectTypeLabel: formatLinkedObjectType(row.linkedObjectType),
    linkedObjectId: safeLinkedObjectId,
    linkedObjectHref: buildLinkedObjectHref({
      linkedObjectType: row.linkedObjectType,
      linkedObjectId: safeLinkedObjectId,
    }),
    priority: row.priority ?? null,
    updatedAt: row.updatedAt.toISOString(),
    detailHref,
  };
}

