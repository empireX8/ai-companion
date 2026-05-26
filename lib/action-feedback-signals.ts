import type { ActionBucket, ActionStatus } from "./actions-api";
import type { FamilyKey } from "./patterns-api";

export type PolicyFeedbackSignalSourceType =
  | "surfaced_action"
  | "fieldwork_assignment";

export type PolicyFeedbackSignalCategory =
  | "action_not_started"
  | "action_done"
  | "action_helped"
  | "action_didnt_help"
  | "fieldwork_completed_with_outcome"
  | "fieldwork_completed_note_only";

export type PolicyFeedbackSignal = {
  sourceType: PolicyFeedbackSignalSourceType;
  sourceId: string;
  actionId?: string;
  templateId?: string;
  bucket?: ActionBucket;
  linkedFamily?: FamilyKey | null;
  statusOrOutcomeCategory: PolicyFeedbackSignalCategory;
  timestamp: string;
  linkedObjectType?: "surfaced_action";
  linkedObjectId?: string;
};

type FieldworkStatus = "assigned" | "active" | "completed" | "dismissed" | "expired";

type ParsedSurfacedActionSignalRow = {
  id: string;
  templateId: string;
  bucket: ActionBucket;
  linkedFamily: FamilyKey | null;
  status: ActionStatus;
  timestamp: string;
};

type ParsedCompletedFieldworkSignalRow = {
  id: string;
  actionId: string;
  timestamp: string;
  statusOrOutcomeCategory:
    | "fieldwork_completed_with_outcome"
    | "fieldwork_completed_note_only";
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoTimestamp = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
};

const toActionStatus = (value: unknown): ActionStatus | null => {
  const normalized = normalizeNonEmptyString(value);
  if (
    normalized !== "not_started" &&
    normalized !== "done" &&
    normalized !== "helped" &&
    normalized !== "didnt_help"
  ) {
    return null;
  }
  return normalized;
};

const toActionBucket = (value: unknown): ActionBucket | null => {
  const normalized = normalizeNonEmptyString(value);
  if (normalized !== "stabilize" && normalized !== "build") {
    return null;
  }
  return normalized;
};

const toFamilyKey = (value: unknown): FamilyKey | null => {
  const normalized = normalizeNonEmptyString(value);
  if (
    normalized !== "trigger_condition" &&
    normalized !== "inner_critic" &&
    normalized !== "repetitive_loop" &&
    normalized !== "contradiction_drift" &&
    normalized !== "recovery_stabilizer"
  ) {
    return null;
  }
  return normalized;
};

const toFieldworkStatus = (value: unknown): FieldworkStatus | null => {
  const normalized = normalizeNonEmptyString(value);
  if (
    normalized !== "assigned" &&
    normalized !== "active" &&
    normalized !== "completed" &&
    normalized !== "dismissed" &&
    normalized !== "expired"
  ) {
    return null;
  }
  return normalized;
};

const toActionSignalCategory = (
  status: ActionStatus
): PolicyFeedbackSignalCategory => {
  if (status === "helped") return "action_helped";
  if (status === "didnt_help") return "action_didnt_help";
  if (status === "done") return "action_done";
  return "action_not_started";
};

const parseSurfacedActionSignalRow = (
  raw: Record<string, unknown>
): ParsedSurfacedActionSignalRow | null => {
  const id = normalizeNonEmptyString(raw.id);
  const templateId = normalizeNonEmptyString(raw.templateId);
  const bucket = toActionBucket(raw.bucket);
  const status = toActionStatus(raw.status);
  const linkedFamily = toFamilyKey(raw.linkedFamily);
  const timestamp = toIsoTimestamp(raw.updatedAt) ?? toIsoTimestamp(raw.surfacedAt);

  if (!id || !templateId || !bucket || !status || !timestamp) {
    return null;
  }

  return {
    id,
    templateId,
    bucket,
    linkedFamily,
    status,
    timestamp,
  };
};

const parseCompletedFieldworkSignalRow = (
  raw: Record<string, unknown>
): ParsedCompletedFieldworkSignalRow | null => {
  const id = normalizeNonEmptyString(raw.id);
  const status = toFieldworkStatus(raw.status);
  const linkedObjectType = normalizeNonEmptyString(raw.linkedObjectType);
  const actionId = normalizeNonEmptyString(raw.linkedObjectId);
  const observationOutcome = normalizeNonEmptyString(raw.observationOutcome);
  const observationNote = normalizeNonEmptyString(raw.observationNote);
  const timestamp =
    toIsoTimestamp(raw.completedAt) ??
    toIsoTimestamp(raw.updatedAt) ??
    toIsoTimestamp(raw.createdAt);

  if (!id || status !== "completed" || linkedObjectType !== "surfaced_action") {
    return null;
  }
  if (!actionId || !timestamp) {
    return null;
  }
  if (!observationOutcome && !observationNote) {
    return null;
  }

  return {
    id,
    actionId,
    timestamp,
    statusOrOutcomeCategory: observationOutcome
      ? "fieldwork_completed_with_outcome"
      : "fieldwork_completed_note_only",
  };
};

export function normalizeSurfacedActionFeedbackSignals(
  rows: Record<string, unknown>[]
): PolicyFeedbackSignal[] {
  const signals: PolicyFeedbackSignal[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const parsed = parseSurfacedActionSignalRow(raw);
    if (!parsed) continue;

    signals.push({
      sourceType: "surfaced_action",
      sourceId: parsed.id,
      actionId: parsed.id,
      templateId: parsed.templateId,
      bucket: parsed.bucket,
      linkedFamily: parsed.linkedFamily,
      statusOrOutcomeCategory: toActionSignalCategory(parsed.status),
      timestamp: parsed.timestamp,
    });
  }

  return signals;
}

export function normalizeCompletedFieldworkFeedbackSignals(
  rows: Record<string, unknown>[]
): PolicyFeedbackSignal[] {
  const signals: PolicyFeedbackSignal[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const parsed = parseCompletedFieldworkSignalRow(raw);
    if (!parsed) continue;

    signals.push({
      sourceType: "fieldwork_assignment",
      sourceId: parsed.id,
      actionId: parsed.actionId,
      statusOrOutcomeCategory: parsed.statusOrOutcomeCategory,
      timestamp: parsed.timestamp,
      linkedObjectType: "surfaced_action",
      linkedObjectId: parsed.actionId,
    });
  }

  return signals;
}

export function buildPolicyFeedbackSignalsReadModel(args: {
  surfacedActionRows: Record<string, unknown>[];
  fieldworkAssignmentRows: Record<string, unknown>[];
}): PolicyFeedbackSignal[] {
  return [
    ...normalizeSurfacedActionFeedbackSignals(args.surfacedActionRows),
    ...normalizeCompletedFieldworkFeedbackSignals(args.fieldworkAssignmentRows),
  ];
}
