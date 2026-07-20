/**
 * Versioned kernel contracts and shared constants (CEQR-001).
 */

export const KERNEL_CONTRACT_VERSION = "orvek-intelligence-kernel-v1" as const;

export const CONTRADICTION_ADJUDICATION_SCHEMA_VERSION =
  "contradiction-adjudication-schema-v1" as const;

/**
 * CEQR-003: prompt wording materially strengthened for context/qualifier
 * preservation. Schema shape unchanged (v1); kernel I/O unchanged (v1).
 */
export const CONTRADICTION_ADJUDICATION_PROMPT_VERSION =
  "contradiction-adjudication-prompt-v2" as const;

/** First proof object through the shared kernel. */
export const KERNEL_FIRST_PROOF_OBJECT = "ContradictionNode" as const;

export const CONTRADICTION_CLASSIFICATIONS = [
  "clear_contradiction",
  "plausible_unresolved_tension",
  "compatible_states",
  "insufficient_or_misaligned_context",
] as const;

export type ContradictionClassification =
  (typeof CONTRADICTION_CLASSIFICATIONS)[number];

export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

/**
 * Semantic classifications that must never be treated as ContradictionNode
 * eligibility by themselves. Persistence remains outside CEQR-001.
 */
export const NON_CONTRADICTION_NODE_CLASSIFICATIONS: readonly ContradictionClassification[] =
  [
    "plausible_unresolved_tension",
    "compatible_states",
    "insufficient_or_misaligned_context",
  ] as const;
