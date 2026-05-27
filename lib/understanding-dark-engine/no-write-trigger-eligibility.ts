export const DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS = 30 * 1000;

export const NO_WRITE_DARK_RUN_ALLOWED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "app_user_message",
  "import_completed",
  "manual_internal",
  "journal_entry_saved",
  "quick_check_in_saved",
]);

export type NoWriteDarkRunTriggerEventType =
  | "app_user_message"
  | "import_completed"
  | "manual_internal"
  | "journal_entry_saved"
  | "quick_check_in_saved"
  | "assistant_message"
  | "system_message"
  | "action_feedback"
  | "fieldwork_completed"
  | "model_update_created"
  | "pattern_claim_changed"
  | "public_route_view"
  | "mobile_view"
  | "blocked_or_unknown"
  | "unknown";

export type NoWriteDarkRunTriggerDecision =
  | "eligible"
  | "suppressed_cooldown"
  | "mark_trailing_pending"
  | "blocked_event_type"
  | "blocked_missing_user"
  | "blocked_no_new_evidence"
  | "blocked_not_no_write_safe";

export type NoWriteDarkRunTriggerEligibilityInput = {
  userId?: string | null;
  eventType: NoWriteDarkRunTriggerEventType | string;
  now?: Date;
  lastRunAt?: Date | string | null;
  lastEvidenceAt?: Date | string | null;
  inFlight?: boolean;
  pending?: boolean;
  cooldownMs?: number;
  allowManualOverride?: boolean;
  noWriteOnly?: boolean;
};

export type NoWriteDarkRunTriggerEligibilityResult = {
  eligible: boolean;
  decision: NoWriteDarkRunTriggerDecision;
  reason: string;
  shouldMarkPending: boolean;
  cooldownRemainingMs: number;
  eventType: NoWriteDarkRunTriggerEventType;
  noWriteOnly: true;
};

function normalizeEventType(
  eventType: NoWriteDarkRunTriggerEligibilityInput["eventType"]
): NoWriteDarkRunTriggerEventType {
  switch (eventType) {
    case "app_user_message":
    case "import_completed":
    case "manual_internal":
    case "journal_entry_saved":
    case "quick_check_in_saved":
    case "assistant_message":
    case "system_message":
    case "action_feedback":
    case "fieldwork_completed":
    case "model_update_created":
    case "pattern_claim_changed":
    case "public_route_view":
    case "mobile_view":
    case "blocked_or_unknown":
    case "unknown":
      return eventType;
    default:
      return "unknown";
  }
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function cooldownRemainingMs(args: {
  now: Date;
  lastRunAt: Date | null;
  cooldownMs: number;
}): number {
  if (!args.lastRunAt) {
    return 0;
  }

  const elapsed = args.now.getTime() - args.lastRunAt.getTime();
  return Math.max(args.cooldownMs - elapsed, 0);
}

function buildResult(args: {
  eligible: boolean;
  decision: NoWriteDarkRunTriggerDecision;
  reason: string;
  shouldMarkPending: boolean;
  cooldownRemainingMs: number;
  eventType: NoWriteDarkRunTriggerEventType;
}): NoWriteDarkRunTriggerEligibilityResult {
  return {
    eligible: args.eligible,
    decision: args.decision,
    reason: args.reason,
    shouldMarkPending: args.shouldMarkPending,
    cooldownRemainingMs: args.cooldownRemainingMs,
    eventType: args.eventType,
    noWriteOnly: true,
  };
}

/**
 * Pure Phase 2F helper: determines whether a no-write dark-run may be
 * triggered for a given event without running the engine or touching storage.
 */
export function evaluateNoWriteDarkRunTriggerEligibility(
  input: NoWriteDarkRunTriggerEligibilityInput
): NoWriteDarkRunTriggerEligibilityResult {
  const eventType = normalizeEventType(input.eventType);
  const now = input.now ?? new Date();
  const cooldownMs = Math.max(input.cooldownMs ?? DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS, 0);
  const lastRunAt = parseDate(input.lastRunAt);
  const lastEvidenceAt = parseDate(input.lastEvidenceAt);
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  const manualOverride = Boolean(
    input.allowManualOverride && eventType === "manual_internal"
  );
  const inFlight = Boolean(input.inFlight);
  const shouldConsiderPending = NO_WRITE_DARK_RUN_ALLOWED_EVENT_TYPES.has(eventType);

  if (input.noWriteOnly === false) {
    return buildResult({
      eligible: false,
      decision: "blocked_not_no_write_safe",
      reason: "No-write trigger helper is restricted to no-write-only mode.",
      shouldMarkPending: false,
      cooldownRemainingMs: 0,
      eventType,
    });
  }

  if (!userId) {
    return buildResult({
      eligible: false,
      decision: "blocked_missing_user",
      reason: "Missing authenticated user id.",
      shouldMarkPending: false,
      cooldownRemainingMs: 0,
      eventType,
    });
  }

  if (!NO_WRITE_DARK_RUN_ALLOWED_EVENT_TYPES.has(eventType)) {
    return buildResult({
      eligible: false,
      decision: "blocked_event_type",
      reason: `Event type "${eventType}" is blocked for no-write trigger eligibility.`,
      shouldMarkPending: false,
      cooldownRemainingMs: 0,
      eventType,
    });
  }

  if (
    !manualOverride &&
    lastRunAt &&
    lastEvidenceAt &&
    lastEvidenceAt.getTime() <= lastRunAt.getTime()
  ) {
    return buildResult({
      eligible: false,
      decision: "blocked_no_new_evidence",
      reason: "No new evidence detected since the last no-write run.",
      shouldMarkPending: false,
      cooldownRemainingMs: cooldownRemainingMs({
        now,
        lastRunAt,
        cooldownMs,
      }),
      eventType,
    });
  }

  if (inFlight) {
    return buildResult({
      eligible: false,
      decision: "mark_trailing_pending",
      reason: "A no-write run is already in flight; mark a trailing pending run.",
      shouldMarkPending: shouldConsiderPending,
      cooldownRemainingMs: cooldownRemainingMs({
        now,
        lastRunAt,
        cooldownMs,
      }),
      eventType,
    });
  }

  const remaining = cooldownRemainingMs({
    now,
    lastRunAt,
    cooldownMs,
  });

  if (!manualOverride && remaining > 0) {
    return buildResult({
      eligible: false,
      decision: "suppressed_cooldown",
      reason: "Suppressed by no-write trigger cooldown.",
      shouldMarkPending: shouldConsiderPending,
      cooldownRemainingMs: remaining,
      eventType,
    });
  }

  return buildResult({
    eligible: true,
    decision: "eligible",
    reason: "No-write trigger is eligible.",
    shouldMarkPending: false,
    cooldownRemainingMs: 0,
    eventType,
  });
}
