/**
 * Action Feedback Signal Aggregation Helper (Phase 4B)
 *
 * Aggregates action feedback signals from existing SurfacedAction rows.
 * Query-only / diagnostic. Does NOT:
 *   - Create ModelUpdates
 *   - Mutate PatternClaims
 *   - Create FieldworkAssignments
 *   - Expose raw note text
 *   - Write new rows
 *
 * Safe to call from any context. No side effects.
 */

import type { FamilyKey } from "./patterns-api";
import type { ActionBucket, ActionStatus } from "./actions-api";
import prismadb from "./prismadb";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActionFeedbackSignal = "helped" | "didnt_help" | "done";

export type ActionFeedbackAggregate = {
  /** The action template identifier (e.g. "s1", "b2"). */
  templateId: string;
  /** The bucket this template belongs to. */
  bucket: ActionBucket;
  /** The linked pattern family, if any. */
  linkedFamily: FamilyKey | null;
  /** The effort level of this template. */
  effort: "Low" | "Medium" | "High";
  /** Total surfaced actions with this templateId (all statuses). */
  totalSurfaced: number;
  /** Count of actions marked "helped". */
  helped: number;
  /** Count of actions marked "didnt_help". */
  didntHelp: number;
  /** Count of actions marked "done". */
  done: number;
  /** Count of actions still "not_started". */
  notStarted: number;
  /** Whether this template has received 3+ "helped" signals. */
  repeatedHelped: boolean;
  /** Whether this template has received 3+ "didnt_help" signals. */
  repeatedDidntHelp: boolean;
  /** ISO timestamp of the most recent status update (any status). */
  lastFeedbackAt: string | null;
};

export type ActionFeedbackSummary = {
  /** Aggregates grouped by templateId. */
  byTemplate: ActionFeedbackAggregate[];
  /** Aggregates grouped by linkedFamily. */
  byFamily: ActionFamilyFeedbackAggregate[];
  /** Aggregates grouped by bucket. */
  byBucket: ActionBucketFeedbackAggregate[];
  /** Total number of actions that have received feedback (status !== "not_started"). */
  totalWithFeedback: number;
  /** Total number of actions still "not_started". */
  totalNotStarted: number;
};

export type ActionFamilyFeedbackAggregate = {
  linkedFamily: FamilyKey | null;
  totalSurfaced: number;
  helped: number;
  didntHelp: number;
  done: number;
  notStarted: number;
  repeatedHelped: boolean;
  repeatedDidntHelp: boolean;
};

export type ActionBucketFeedbackAggregate = {
  bucket: ActionBucket;
  totalSurfaced: number;
  helped: number;
  didntHelp: number;
  done: number;
  notStarted: number;
};

export type ActionTemplateRankingHint = "promote" | "suppress" | "neutral";

export type ActionTemplateRankingDiagnostic = {
  templateId: string;
  helpedCount: number;
  didntHelpCount: number;
  repeatedHelped: boolean;
  repeatedDidntHelp: boolean;
  suggestedRankingHint: ActionTemplateRankingHint;
};

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum number of same-signal outcomes before it qualifies as "repeated". */
export const REPEATED_SIGNAL_THRESHOLD = 3;

// ── Helpers ────────────────────────────────────────────────────────────────────

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toActionBucket = (value: unknown): ActionBucket | null => {
  const normalized = normalizeNonEmptyString(value);
  if (normalized !== "stabilize" && normalized !== "build") return null;
  return normalized;
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

const toEffortLevel = (value: unknown): "Low" | "Medium" | "High" | null => {
  const normalized = normalizeNonEmptyString(value);
  if (normalized !== "Low" && normalized !== "Medium" && normalized !== "High") {
    return null;
  }
  return normalized;
};

const toIsoTimestamp = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return normalizeNonEmptyString(value);
};

// ── Row parsing ────────────────────────────────────────────────────────────────

type ParsedActionRow = {
  templateId: string;
  bucket: ActionBucket;
  linkedFamily: FamilyKey | null;
  effort: "Low" | "Medium" | "High";
  status: ActionStatus;
  updatedAt: string | null;
};

/**
 * Parses a raw row from the database into a typed intermediate representation.
 * Drops rows that fail validation (malformed templateId, bucket, status, etc.).
 * Does NOT include note text in the parsed output.
 */
const parseActionRow = (raw: Record<string, unknown>): ParsedActionRow | null => {
  const templateId = normalizeNonEmptyString(raw.templateId);
  const bucket = toActionBucket(raw.bucket);
  const linkedFamily = toFamilyKey(raw.linkedFamily);
  const effort = toEffortLevel(raw.effort);
  const status = toActionStatus(raw.status);
  const updatedAt = toIsoTimestamp(raw.updatedAt);

  if (!templateId || !bucket || !effort || !status) {
    return null;
  }

  return {
    templateId,
    bucket,
    linkedFamily,
    effort,
    status,
    updatedAt,
  };
};

// ── Aggregation ────────────────────────────────────────────────────────────────

/**
 * Aggregates action feedback signals from a list of raw SurfacedAction rows.
 *
 * @param rows - Raw rows from the database (e.g. from prismadb.surfacedAction.findMany).
 * @returns A structured summary of feedback signals, grouped by template, family, and bucket.
 *
 * Safety guarantees:
 *   - Raw note text is never included in the output.
 *   - Invalid/malformed rows are silently dropped.
 *   - No side effects — pure aggregation.
 *   - No ModelUpdates, PatternClaims, or FieldworkAssignments are created.
 */
export function aggregateActionFeedback(
  rows: Record<string, unknown>[]
): ActionFeedbackSummary {
  const parsed: ParsedActionRow[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const parsedRow = parseActionRow(raw as Record<string, unknown>);
    if (parsedRow) {
      parsed.push(parsedRow);
    }
  }

  // ── By template ────────────────────────────────────────────────────────────
  const templateMap = new Map<string, ParsedActionRow[]>();
  for (const row of parsed) {
    const existing = templateMap.get(row.templateId) ?? [];
    existing.push(row);
    templateMap.set(row.templateId, existing);
  }

  const byTemplate: ActionFeedbackAggregate[] = [];
  for (const [templateId, rows] of templateMap) {
    const first = rows[0]!;
    const helped = rows.filter((r) => r.status === "helped").length;
    const didntHelp = rows.filter((r) => r.status === "didnt_help").length;
    const done = rows.filter((r) => r.status === "done").length;
    const notStarted = rows.filter((r) => r.status === "not_started").length;

    const timestamps = rows
      .map((r) => r.updatedAt)
      .filter((t): t is string => t !== null)
      .sort()
      .reverse();

    byTemplate.push({
      templateId,
      bucket: first.bucket,
      linkedFamily: first.linkedFamily,
      effort: first.effort,
      totalSurfaced: rows.length,
      helped,
      didntHelp,
      done,
      notStarted,
      repeatedHelped: helped >= REPEATED_SIGNAL_THRESHOLD,
      repeatedDidntHelp: didntHelp >= REPEATED_SIGNAL_THRESHOLD,
      lastFeedbackAt: timestamps[0] ?? null,
    });
  }

  // ── By family ──────────────────────────────────────────────────────────────
  const familyMap = new Map<string, ParsedActionRow[]>();
  for (const row of parsed) {
    const key = row.linkedFamily ?? "__none__";
    const existing = familyMap.get(key) ?? [];
    existing.push(row);
    familyMap.set(key, existing);
  }

  const byFamily: ActionFamilyFeedbackAggregate[] = [];
  for (const [key, rows] of familyMap) {
    const helped = rows.filter((r) => r.status === "helped").length;
    const didntHelp = rows.filter((r) => r.status === "didnt_help").length;
    const done = rows.filter((r) => r.status === "done").length;
    const notStarted = rows.filter((r) => r.status === "not_started").length;

    byFamily.push({
      linkedFamily: key === "__none__" ? null : (key as FamilyKey),
      totalSurfaced: rows.length,
      helped,
      didntHelp,
      done,
      notStarted,
      repeatedHelped: helped >= REPEATED_SIGNAL_THRESHOLD,
      repeatedDidntHelp: didntHelp >= REPEATED_SIGNAL_THRESHOLD,
    });
  }

  // Sort families: non-null first, then by totalSurfaced descending
  byFamily.sort((a, b) => {
    if (a.linkedFamily === null && b.linkedFamily !== null) return 1;
    if (a.linkedFamily !== null && b.linkedFamily === null) return -1;
    return b.totalSurfaced - a.totalSurfaced;
  });

  // ── By bucket ──────────────────────────────────────────────────────────────
  const bucketMap = new Map<ActionBucket, ParsedActionRow[]>();
  for (const row of parsed) {
    const existing = bucketMap.get(row.bucket) ?? [];
    existing.push(row);
    bucketMap.set(row.bucket, existing);
  }

  const byBucket: ActionBucketFeedbackAggregate[] = [];
  for (const [bucket, rows] of bucketMap) {
    byBucket.push({
      bucket,
      totalSurfaced: rows.length,
      helped: rows.filter((r) => r.status === "helped").length,
      didntHelp: rows.filter((r) => r.status === "didnt_help").length,
      done: rows.filter((r) => r.status === "done").length,
      notStarted: rows.filter((r) => r.status === "not_started").length,
    });
  }

  // Sort buckets: stabilize first, then build
  byBucket.sort((a, b) => {
    if (a.bucket === "stabilize" && b.bucket === "build") return -1;
    if (a.bucket === "build" && b.bucket === "stabilize") return 1;
    return 0;
  });

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalWithFeedback = parsed.filter(
    (r) => r.status !== "not_started"
  ).length;
  const totalNotStarted = parsed.filter(
    (r) => r.status === "not_started"
  ).length;

  return {
    byTemplate,
    byFamily,
    byBucket,
    totalWithFeedback,
    totalNotStarted,
  };
}

function resolveTemplateRankingHint(
  aggregate: Pick<ActionFeedbackAggregate, "repeatedHelped" | "repeatedDidntHelp">
): ActionTemplateRankingHint {
  if (aggregate.repeatedHelped && !aggregate.repeatedDidntHelp) {
    return "promote";
  }
  if (aggregate.repeatedDidntHelp && !aggregate.repeatedHelped) {
    return "suppress";
  }
  return "neutral";
}

/**
 * Converts template aggregates into diagnostics-only ranking hints.
 *
 * This helper is intentionally read-only and does not affect live action
 * generation. It is safe to use for experimentation and telemetry.
 */
export function buildActionTemplateRankingDiagnostics(
  summary: ActionFeedbackSummary
): ActionTemplateRankingDiagnostic[] {
  return summary.byTemplate
    .map((aggregate) => ({
      templateId: aggregate.templateId,
      helpedCount: aggregate.helped,
      didntHelpCount: aggregate.didntHelp,
      repeatedHelped: aggregate.repeatedHelped,
      repeatedDidntHelp: aggregate.repeatedDidntHelp,
      suggestedRankingHint: resolveTemplateRankingHint(aggregate),
    }))
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}

type ActionFeedbackDiagnosticsDb = {
  surfacedAction: {
    findMany(args: {
      where: { userId: string };
      select: {
        templateId: true;
        bucket: true;
        linkedFamily: true;
        effort: true;
        status: true;
        updatedAt: true;
      };
    }): Promise<Record<string, unknown>[]>;
  };
};

/**
 * Loads diagnostics-only ranking hints for a user's surfaced actions.
 *
 * This helper is query-only and intentionally does not:
 * - affect live action ordering
 * - expose raw note text or raw evidence
 * - create ModelUpdates / mutate PatternClaims / create Fieldwork
 * - write any database rows
 */
export async function loadActionRankingDiagnosticsForUser({
  userId,
  db = prismadb as unknown as ActionFeedbackDiagnosticsDb,
}: {
  userId: string;
  db?: ActionFeedbackDiagnosticsDb;
}): Promise<ActionTemplateRankingDiagnostic[]> {
  const normalizedUserId = normalizeNonEmptyString(userId);
  if (!normalizedUserId) {
    return [];
  }

  const rows = await db.surfacedAction.findMany({
    where: { userId: normalizedUserId },
    select: {
      templateId: true,
      bucket: true,
      linkedFamily: true,
      effort: true,
      status: true,
      updatedAt: true,
    },
  });

  return buildActionTemplateRankingDiagnostics(aggregateActionFeedback(rows));
}
