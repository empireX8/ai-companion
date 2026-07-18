/**
 * Canonical Map global-summary contract.
 * These are model-evaluation measures (from the import/source summary),
 * not a count of densograph OrvekObject rows of type receipt / active-question.
 */

export const CANONICAL_REFERENCE_MAP_HEADER = {
  confidenceLabel: "mixed / evolving",
  /** Matches frozen reference Map header + imp-1 reportSummary receipt total. */
  receiptsLabel: "243",
  /** Matches frozen reference Map header + imp-1 reportSummary question total. */
  openQuestionsLabel: "7",
} as const;

export type CanonicalReferenceMapHeader = typeof CANONICAL_REFERENCE_MAP_HEADER;
