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

export type ActionTemplateRankingDiagnosticWithEligibility =
  ActionTemplateRankingDiagnostic & {
    eligible: boolean;
    reason: ActionRankingEligibilityReason;
    isReversible: true;
  };

export type ActionRankingEligibilityReason =
  | "promote_signal"
  | "suppress_signal"
  | "below_threshold"
  | "conflict"
  | "stale_signal"
  | "missing_recent_feedback";

export type ActionRankingEligibilityDiagnostic = Pick<
  ActionTemplateRankingDiagnostic,
  "templateId" | "helpedCount" | "didntHelpCount"
> & {
  lastFeedbackAt?: string | Date | null;
};

export type ActionRankingEligibilityOptions = {
  rollingWindowDays?: number;
  staleAfterDays?: number;
  requireRecentFeedback?: boolean;
  minimumRepeatedSignals?: number;
  now?: string | Date;
};

export type ActionRankingEligibilityResult = {
  eligible: boolean;
  reason: ActionRankingEligibilityReason;
  suggestedRankingHint: ActionTemplateRankingHint;
  isReversible: true;
};

export type ActionRankingSimulationInput = {
  actionId: string;
  templateId: string;
};

export type ActionRankingSimulationPreviewItem = {
  actionId: string;
  templateId: string;
  originalIndex: number;
  simulatedIndex: number;
  suggestedRankingHint: ActionTemplateRankingHint;
};

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum number of same-signal outcomes before it qualifies as "repeated". */
export const REPEATED_SIGNAL_THRESHOLD = 3;

export const DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS = {
  rollingWindowDays: 90,
  staleAfterDays: 120,
  requireRecentFeedback: true,
  minimumRepeatedSignals: REPEATED_SIGNAL_THRESHOLD,
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const MEDIUM_EFFORT_TEMPLATE_IDS = new Set(["b1", "b3"]);

const inferEffortFromTemplateId = (
  templateId: unknown
): "Low" | "Medium" | "High" => {
  const normalized = normalizeNonEmptyString(templateId);
  if (normalized && MEDIUM_EFFORT_TEMPLATE_IDS.has(normalized)) {
    return "Medium";
  }
  return "Low";
};

const toIsoTimestamp = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return normalizeNonEmptyString(value);
};

const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const toPositiveIntegerOrFallback = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;

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

type ActionTemplateRankingDiagnosticWithLastFeedback =
  ActionTemplateRankingDiagnostic & {
    lastFeedbackAt: string | null;
  };

function buildActionTemplateRankingDiagnosticsWithLastFeedback(
  summary: ActionFeedbackSummary
): ActionTemplateRankingDiagnosticWithLastFeedback[] {
  return summary.byTemplate
    .map((aggregate) => ({
      templateId: aggregate.templateId,
      helpedCount: aggregate.helped,
      didntHelpCount: aggregate.didntHelp,
      repeatedHelped: aggregate.repeatedHelped,
      repeatedDidntHelp: aggregate.repeatedDidntHelp,
      suggestedRankingHint: resolveTemplateRankingHint(aggregate),
      lastFeedbackAt: aggregate.lastFeedbackAt,
    }))
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}

/**
 * Applies Policy Phase F1 eligibility gating to template diagnostics.
 *
 * Behavior:
 * - eligible promote/suppress signals keep their hint
 * - conflict/below-threshold/stale/missing-recent signals become neutral
 * - returns reversible safe metadata only (eligible/reason/isReversible)
 */
export function applyActionRankingEligibilityToDiagnostics(
  diagnostics: (ActionTemplateRankingDiagnostic & {
    lastFeedbackAt?: string | Date | null;
  })[],
  options: ActionRankingEligibilityOptions = {}
): ActionTemplateRankingDiagnosticWithEligibility[] {
  return diagnostics
    .map((diagnostic) => {
      const eligibility = evaluateActionRankingEligibility(
        {
          templateId: diagnostic.templateId,
          helpedCount: diagnostic.helpedCount,
          didntHelpCount: diagnostic.didntHelpCount,
          lastFeedbackAt: diagnostic.lastFeedbackAt ?? null,
        },
        options
      );

      return {
        templateId: diagnostic.templateId,
        helpedCount: diagnostic.helpedCount,
        didntHelpCount: diagnostic.didntHelpCount,
        repeatedHelped: diagnostic.repeatedHelped,
        repeatedDidntHelp: diagnostic.repeatedDidntHelp,
        suggestedRankingHint: eligibility.suggestedRankingHint,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        isReversible: eligibility.isReversible,
      };
    })
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}

const RANKING_HINT_PRIORITY: Record<ActionTemplateRankingHint, number> = {
  promote: 0,
  neutral: 1,
  suppress: 2,
};

/**
 * Evaluates whether a template-level ranking signal is currently eligible for
 * live use under a reversible, recency-aware policy.
 *
 * This helper is pure and side-effect-free:
 * - no database reads/writes
 * - no model mutation
 * - no PatternClaim/Fieldwork side effects
 * - no raw note/evidence handling
 */
export function evaluateActionRankingEligibility(
  diagnostic: ActionRankingEligibilityDiagnostic,
  options: ActionRankingEligibilityOptions = {}
): ActionRankingEligibilityResult {
  const minimumRepeatedSignals = toPositiveIntegerOrFallback(
    options.minimumRepeatedSignals,
    DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS.minimumRepeatedSignals
  );
  const rollingWindowDays = toPositiveIntegerOrFallback(
    options.rollingWindowDays,
    DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS.rollingWindowDays
  );
  const staleAfterDays = toPositiveIntegerOrFallback(
    options.staleAfterDays,
    DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS.staleAfterDays
  );
  const requireRecentFeedback =
    options.requireRecentFeedback ??
    DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS.requireRecentFeedback;
  const now = toValidDate(options.now) ?? new Date();

  const repeatedHelped = diagnostic.helpedCount >= minimumRepeatedSignals;
  const repeatedDidntHelp = diagnostic.didntHelpCount >= minimumRepeatedSignals;

  if (repeatedHelped && repeatedDidntHelp) {
    return {
      eligible: false,
      reason: "conflict",
      suggestedRankingHint: "neutral",
      isReversible: true,
    };
  }

  if (!repeatedHelped && !repeatedDidntHelp) {
    return {
      eligible: false,
      reason: "below_threshold",
      suggestedRankingHint: "neutral",
      isReversible: true,
    };
  }

  const lastFeedbackDate = toValidDate(diagnostic.lastFeedbackAt);
  if (!lastFeedbackDate && requireRecentFeedback) {
    return {
      eligible: false,
      reason: "missing_recent_feedback",
      suggestedRankingHint: "neutral",
      isReversible: true,
    };
  }

  if (lastFeedbackDate) {
    const ageInDays = Math.max(
      0,
      (now.getTime() - lastFeedbackDate.getTime()) / MS_PER_DAY
    );

    if (ageInDays > staleAfterDays) {
      return {
        eligible: false,
        reason: "stale_signal",
        suggestedRankingHint: "neutral",
        isReversible: true,
      };
    }

    if (requireRecentFeedback && ageInDays > rollingWindowDays) {
      return {
        eligible: false,
        reason: "missing_recent_feedback",
        suggestedRankingHint: "neutral",
        isReversible: true,
      };
    }
  }

  if (repeatedHelped) {
    return {
      eligible: true,
      reason: "promote_signal",
      suggestedRankingHint: "promote",
      isReversible: true,
    };
  }

  return {
    eligible: true,
    reason: "suppress_signal",
    suggestedRankingHint: "suppress",
    isReversible: true,
  };
}

/**
 * Returns a diagnostics-only ranking simulation preview.
 *
 * The returned order is simulated only:
 * - promote templates float earlier
 * - suppress templates move later
 * - neutral/missing diagnostics preserve relative order
 *
 * This helper does not mutate live ranking, does not write to the database,
 * and does not include raw note or evidence text.
 */
export function simulateActionRankingWithDiagnostics(
  actions: ActionRankingSimulationInput[],
  diagnostics: ActionTemplateRankingDiagnostic[]
): ActionRankingSimulationPreviewItem[] {
  const hintByTemplateId = new Map<string, ActionTemplateRankingHint>();
  for (const diagnostic of diagnostics) {
    if (!hintByTemplateId.has(diagnostic.templateId)) {
      hintByTemplateId.set(
        diagnostic.templateId,
        diagnostic.suggestedRankingHint
      );
    }
  }

  const annotated = actions.map((action, originalIndex) => ({
    actionId: action.actionId,
    templateId: action.templateId,
    originalIndex,
    suggestedRankingHint:
      hintByTemplateId.get(action.templateId) ?? ("neutral" as const),
  }));

  annotated.sort((left, right) => {
    const leftPriority = RANKING_HINT_PRIORITY[left.suggestedRankingHint];
    const rightPriority = RANKING_HINT_PRIORITY[right.suggestedRankingHint];
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.originalIndex - right.originalIndex;
  });

  return annotated.map((item, simulatedIndex) => ({
    actionId: item.actionId,
    templateId: item.templateId,
    originalIndex: item.originalIndex,
    simulatedIndex,
    suggestedRankingHint: item.suggestedRankingHint,
  }));
}

type ActionFeedbackDiagnosticsDb = {
  surfacedAction: {
    findMany(args: {
      where: { userId: string };
      select: {
        templateId: true;
        bucket: true;
        linkedFamily: true;
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
      status: true,
      updatedAt: true,
    },
  });

  const rowsWithInferredEffort = rows.map((row) => ({
    ...row,
    effort: inferEffortFromTemplateId(row.templateId),
  }));

  return buildActionTemplateRankingDiagnostics(
    aggregateActionFeedback(rowsWithInferredEffort)
  );
}

/**
 * Loads eligibility-gated ranking diagnostics for debug/simulated ranking use.
 * This remains query-only and reversible; no live ranking activation.
 */
export async function loadEligibleActionRankingDiagnosticsForUser({
  userId,
  db = prismadb as unknown as ActionFeedbackDiagnosticsDb,
  options = {},
}: {
  userId: string;
  db?: ActionFeedbackDiagnosticsDb;
  options?: ActionRankingEligibilityOptions;
}): Promise<ActionTemplateRankingDiagnosticWithEligibility[]> {
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
      status: true,
      updatedAt: true,
    },
  });

  const rowsWithInferredEffort = rows.map((row) => ({
    ...row,
    effort: inferEffortFromTemplateId(row.templateId),
  }));

  const summary = aggregateActionFeedback(rowsWithInferredEffort);
  const diagnosticsWithLastFeedback =
    buildActionTemplateRankingDiagnosticsWithLastFeedback(summary);

  return applyActionRankingEligibilityToDiagnostics(
    diagnosticsWithLastFeedback,
    options
  );
}
