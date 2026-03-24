/**
 * Trust-language — terminology registry and banned-language guardrails (P4-01, P4-02)
 *
 * Single source of truth for approved visible terminology in MindLab V1.
 * Imported by UI surfaces, the trust-copy module, and regression tests.
 *
 * LOCKED: Do not add terms without a Packet 4 decision.
 * LOCKED: Do not weaken the banned-language list.
 */

// ── P4-01: Terminology registry ───────────────────────────────────────────────

/** The canonical product name. Use this everywhere the product name appears. */
export const PRODUCT_NAME = "MindLab" as const;

/** Canonical visible surface names — matches V1_CORE_ROUTES + V1_SECONDARY_ROUTES. */
export const SURFACE_NAMES = {
  Chat: "Chat",
  Patterns: "Patterns",
  History: "History",
  Context: "Context",
  Import: "Import",
  Settings: "Settings",
} as const;

/** Canonical visible status labels for PatternClaim states. */
export const PATTERN_STATUS_LABELS = {
  candidate: "Candidate",
  active:    "Active",
  paused:    "Paused",
  dismissed: "Dismissed",
} as const;

/** Canonical visible strength labels — qualitative only, no numeric scores. */
export const PATTERN_STRENGTH_LABELS = {
  tentative:   "Tentative signal",
  developing:  "Developing pattern",
  established: "Established pattern",
} as const;

/** Approved terms for the action layer. */
export const ACTION_TERMS = {
  /** Use this label on the suggest-a-step button and in gate copy. */
  smallExperiment: "small experiment",
  /** Alternate action-layer label where "experiment" is too strong. */
  nextStep: "next step",
} as const;

// ── P4-02: Banned-language registry ──────────────────────────────────────────
//
// These terms are blocked from V1-visible product surfaces.
// Categories:
//   - Stale product naming (pre-V1 product names)
//   - Clinical / therapy-coded language
//   - Score / rating language
//   - Forecast / prediction language
//   - Internal ontology leakage
//   - Certainty overclaim
//
// Patterns are lowercase substrings; matching is case-insensitive.

export const BANNED_TERMS = [
  // Stale product naming
  "double app",
  "the double",

  // Clinical / therapy-coded
  "diagnos",
  "symptom",
  "patholog",
  "disorder",
  "therapy",
  "therapeutic",
  "clinical trial",
  "mental health condition",
  "psychological disorder",

  // Score / rating
  "confidence score",
  "numeric score",
  "confidence %",
  "rating score",

  // Forecast / prediction language (removed from V1 visible path)
  "save forecast",
  "your forecasts",
  "active forecasts",

  // Internal ontology leakage (DB model names / internal labels)
  "ContradictionNode",
  "ReferenceItem",
  "escalation level",
  "salience score",

  // Certainty overclaim
  "definitively proves",
  "always does this",
  "always will",
  "this proves",
] as const satisfies readonly string[];

export type BannedTerm = (typeof BANNED_TERMS)[number];

// ── P4-02: Checking utilities ─────────────────────────────────────────────────

/**
 * Returns the first banned term found in `text`, or null if none found.
 * Case-insensitive.
 */
export function containsBannedTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term.toLowerCase())) return term;
  }
  return null;
}

/**
 * Returns all banned terms found in `text`. Case-insensitive.
 */
export function findAllBannedTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return (BANNED_TERMS as readonly string[]).filter((t) =>
    lower.includes(t.toLowerCase())
  );
}

/**
 * Returns true if `text` is free of all banned terms.
 */
export function isTrustSafe(text: string): boolean {
  return containsBannedTerm(text) === null;
}
