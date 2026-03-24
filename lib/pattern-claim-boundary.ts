/**
 * PatternClaim / ProfileArtifact Boundary (P5-01)
 *
 * Authoritative typed boundary document.
 *
 * PatternClaim  — detected behavioral/cognitive patterns accumulated over time.
 *                 These are the V1 core surface; sourced from DerivationRun.
 * ProfileArtifact — atomic self-statements extracted from message text (legacy).
 *                   Pre-V1, feeds derivation as input signal, not output.
 *
 * Rules:
 *  1. PatternClaim types and ProfileArtifact types are disjoint.
 *  2. Bootstrap order: profile_artifact phase must precede pattern_claim phase
 *     within any single DerivationRun pass.
 *  3. Never query PatternClaims and ProfileArtifacts in the same UI component.
 */

// ── Locked enum values ────────────────────────────────────────────────────────
// Changing these values requires a schema migration + build gate update.

export const PATTERN_TYPE_VALUES = [
  "trigger_condition",
  "inner_critic",
  "repetitive_loop",
  "contradiction_drift",
  "recovery_stabilizer",
] as const;

export type PatternTypeValue = (typeof PATTERN_TYPE_VALUES)[number];

export const PATTERN_CLAIM_STATUS_VALUES = [
  "candidate",
  "active",
  "paused",
  "dismissed",
] as const;

export type PatternClaimStatusValue = (typeof PATTERN_CLAIM_STATUS_VALUES)[number];

export const STRENGTH_LEVEL_VALUES = [
  "tentative",
  "developing",
  "established",
] as const;

export type StrengthLevelValue = (typeof STRENGTH_LEVEL_VALUES)[number];

// ── Strength advancement thresholds ──────────────────────────────────────────
// Deterministic promotion logic (P3-06 rule, enforced here as typed config)

export const STRENGTH_ADVANCEMENT_THRESHOLDS: Record<
  StrengthLevelValue,
  { evidenceRequired: number; minSessionSpread: number }
> = {
  tentative:   { evidenceRequired: 1,  minSessionSpread: 1 },
  developing:  { evidenceRequired: 3,  minSessionSpread: 2 },
  established: { evidenceRequired: 7,  minSessionSpread: 3 },
};

export function nextStrengthLevel(
  current: StrengthLevelValue
): StrengthLevelValue | null {
  const idx = STRENGTH_LEVEL_VALUES.indexOf(current);
  if (idx === -1 || idx === STRENGTH_LEVEL_VALUES.length - 1) return null;
  return STRENGTH_LEVEL_VALUES[idx + 1]!;
}

// ── Ownership constants ───────────────────────────────────────────────────────

/** Pattern types owned by PatternClaim (V1 surface). */
export const PATTERN_CLAIM_OWNS = new Set<string>(PATTERN_TYPE_VALUES);

/** Types owned by ProfileArtifact (legacy surface). */
export const PROFILE_ARTIFACT_OWNS = new Set([
  "BELIEF",
  "VALUE",
  "GOAL",
  "FEAR",
  "IDENTITY",
  "TRAIT",
  "HABIT",
  "TOPIC",
  "RELATIONSHIP_PATTERN",
  "EMOTIONAL_PATTERN",
  "COGNITIVE_PATTERN",
] as const);

// ── Bootstrap order ───────────────────────────────────────────────────────────
// Within a single derivation pass, profile_artifact extraction runs first so
// pattern detection can use ProfileArtifact signals as input features.

export const BOOTSTRAP_ORDER = ["profile_artifact", "pattern_claim"] as const;
export type BootstrapPhase = (typeof BOOTSTRAP_ORDER)[number];

export function assertBootstrapOrder(
  a: BootstrapPhase,
  b: BootstrapPhase
): void {
  const idxA = BOOTSTRAP_ORDER.indexOf(a);
  const idxB = BOOTSTRAP_ORDER.indexOf(b);
  if (idxA >= idxB) {
    throw new Error(
      `Bootstrap order violation: "${a}" must run before "${b}".`
    );
  }
}
