/**
 * Phase 0 production-safety containment for the known unsafe Explore
 * fixed-semantics movement pathway.
 *
 * Lexical VERIFIED+INFERRED overlap alone must not create or publish
 * model movement. Conversation-specific semantic adjudication belongs
 * to a later delivery; until then movement fails closed.
 */

/** Exact rationale written by the legacy fixed-semantics pathway. */
export const UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE =
  "Grounded Explore conversation cites owned verified and inferred evidence for a reviewable model movement.";

/** Exact user-facing summary written by the legacy fixed-semantics pathway. */
export const UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY =
  "Possible model movement from Explore: evening stop-point signal after meetings.";

/**
 * Stable afterSummary shape from the legacy pathway.
 * Title may be empty or contain any characters (including newlines);
 * the surrounding fixed prefix/suffix does not.
 */
export const UNSAFE_FIXED_EXPLORE_MOVEMENT_AFTER_SUMMARY_PATTERN =
  /^Explore evidence suggests refining: [\s\S]* with stop-point sensitivity after meetings\.$/;

/** Explicit publish/create block code for callers and tests. */
export const EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS =
  "blocked_unsafe_fixed_semantics" as const;

export type ExploreMovementBlockedUnsafeFixedSemantics =
  typeof EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS;

/**
 * Deterministic detection of the known unsafe legacy fixed-semantics signature.
 * All three fields must match; partial overlap alone does not block.
 */
export function matchesUnsafeFixedExploreMovementSignature(args: {
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
}): boolean {
  return (
    args.rationale === UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE &&
    args.userFacingSummary ===
      UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY &&
    UNSAFE_FIXED_EXPLORE_MOVEMENT_AFTER_SUMMARY_PATTERN.test(args.afterSummary)
  );
}
