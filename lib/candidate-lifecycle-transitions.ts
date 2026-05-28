/**
 * candidate-lifecycle-transitions.ts
 *
 * Phase 2K — Candidate lifecycle transition policy/helpers for UserMapConclusion.
 *
 * Defines safe lifecycle semantics before building promotion/rejection workflows.
 *
 * Null semantics:
 *   null means legacy/pre-lifecycle/not lifecycle-managed.
 *   Transitions from null are forbidden — an explicit initial status must be set first.
 *
 * Allowed transitions (from Phase 2I audit §4.1):
 *   proposed → held_for_more_evidence
 *   proposed → rejected
 *   proposed → expired
 *   held_for_more_evidence → proposed
 *   held_for_more_evidence → rejected
 *   held_for_more_evidence → expired
 *   held_for_more_evidence → promoted
 *   rejected → proposed              (only via new candidate cycle)
 *   promoted → superseded
 *   expired → proposed               (only via new candidate cycle)
 *
 * Forbidden transitions:
 *   promoted → proposed              (can't un-promote)
 *   promoted → rejected              (can't reject after promotion)
 *   promoted → expired               (promoted is terminal except for supersession)
 *   superseded → *                   (terminal state)
 *   rejected → held_for_more_evidence
 *   rejected → promoted
 *   rejected → expired
 *   expired → held_for_more_evidence
 *   expired → promoted
 *   expired → rejected
 *   null → *                         (must set initial status explicitly)
 */

import { CandidateLifecycleStatus } from "@prisma/client";

/**
 * Result of a lifecycle transition attempt.
 */
export type LifecycleTransitionResult =
  | { allowed: true; nextStatus: CandidateLifecycleStatus }
  | { allowed: false; reason: string };

/**
 * All allowed transitions keyed by `fromStatus → Set<toStatus>`.
 */
const ALLOWED_TRANSITIONS: Record<
  CandidateLifecycleStatus,
  Set<CandidateLifecycleStatus>
> = {
  [CandidateLifecycleStatus.proposed]: new Set([
    CandidateLifecycleStatus.held_for_more_evidence,
    CandidateLifecycleStatus.rejected,
    CandidateLifecycleStatus.expired,
  ]),
  [CandidateLifecycleStatus.held_for_more_evidence]: new Set([
    CandidateLifecycleStatus.proposed,
    CandidateLifecycleStatus.rejected,
    CandidateLifecycleStatus.expired,
    CandidateLifecycleStatus.promoted,
  ]),
  [CandidateLifecycleStatus.rejected]: new Set([
    CandidateLifecycleStatus.proposed,
  ]),
  [CandidateLifecycleStatus.promoted]: new Set([
    CandidateLifecycleStatus.superseded,
  ]),
  [CandidateLifecycleStatus.superseded]: new Set([]),
  [CandidateLifecycleStatus.expired]: new Set([
    CandidateLifecycleStatus.proposed,
  ]),
};

/**
 * Human-readable descriptions for each status.
 */
const STATUS_LABELS: Record<CandidateLifecycleStatus, string> = {
  [CandidateLifecycleStatus.proposed]: "proposed",
  [CandidateLifecycleStatus.held_for_more_evidence]: "held for more evidence",
  [CandidateLifecycleStatus.rejected]: "rejected",
  [CandidateLifecycleStatus.promoted]: "promoted",
  [CandidateLifecycleStatus.superseded]: "superseded",
  [CandidateLifecycleStatus.expired]: "expired",
};

/**
 * Check whether a lifecycle transition is allowed.
 *
 * @param from - The current status (must not be null — null means legacy/pre-lifecycle)
 * @param to - The desired next status
 * @returns A LifecycleTransitionResult indicating whether the transition is allowed
 */
export function canTransition(
  from: CandidateLifecycleStatus | null,
  to: CandidateLifecycleStatus
): LifecycleTransitionResult {
  if (from === null) {
    return {
      allowed: false,
      reason:
        "Cannot transition from null. null means legacy/pre-lifecycle/not lifecycle-managed. " +
        "Set an explicit initial status (e.g. proposed) before transitioning.",
    };
  }

  const allowed = ALLOWED_TRANSITIONS[from];

  if (!allowed) {
    return {
      allowed: false,
      reason: `Unknown source status: ${from}`,
    };
  }

  if (allowed.has(to)) {
    return { allowed: true, nextStatus: to };
  }

  return {
    allowed: false,
    reason: `Transition from '${STATUS_LABELS[from]}' to '${STATUS_LABELS[to]}' is not allowed.`,
  };
}

/**
 * Attempt a lifecycle transition. Returns the new status if allowed, or throws if forbidden.
 *
 * @param from - The current status (must not be null)
 * @param to - The desired next status
 * @returns The new CandidateLifecycleStatus if the transition is allowed
 * @throws {Error} If the transition is forbidden
 */
export function transitionOrThrow(
  from: CandidateLifecycleStatus | null,
  to: CandidateLifecycleStatus
): CandidateLifecycleStatus {
  const result = canTransition(from, to);

  if (!result.allowed) {
    throw new Error(result.reason);
  }

  return result.nextStatus;
}

/**
 * Get all allowed next statuses from a given status.
 *
 * @param status - The current status (null returns empty set)
 * @returns A Set of allowed next CandidateLifecycleStatus values
 */
export function getAllowedNextStatuses(
  status: CandidateLifecycleStatus | null
): Set<CandidateLifecycleStatus> {
  if (status === null) {
    return new Set();
  }

  return new Set(ALLOWED_TRANSITIONS[status] ?? []);
}

/**
 * Check whether a status is a terminal state (no further transitions allowed).
 */
export function isTerminalStatus(
  status: CandidateLifecycleStatus | null
): boolean {
  if (status === null) {
    return false;
  }

  return ALLOWED_TRANSITIONS[status]?.size === 0;
}

/**
 * Check whether a status is a "dead end" that can only restart via a new candidate cycle.
 * These are: rejected, expired, superseded.
 */
export function isDeadEndStatus(
  status: CandidateLifecycleStatus | null
): boolean {
  if (status === null) {
    return false;
  }

  // These can only transition to proposed (new candidate cycle)
  return (
    status === CandidateLifecycleStatus.rejected ||
    status === CandidateLifecycleStatus.expired ||
    status === CandidateLifecycleStatus.superseded
  );
}
