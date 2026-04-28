/**
 * Pattern Governance Artifact (P5-03)
 *
 * Authoritative source-of-truth for:
 *  1. V1 receipt model reuse map — which existing model shape receipts follow
 *  2. PatternClaim / ProfileArtifact UI separation rule
 *
 * This file is a governance artifact, not a runtime module.
 * Changing it requires updating pattern-build-gates.test.ts.
 */

// ── Receipt Reuse Map ─────────────────────────────────────────────────────────
//
// Decision: PatternClaimEvidence mirrors ContradictionEvidence.
// It does NOT introduce a third evidence concept.
//
// ContradictionEvidence shape:
//   id, nodeId (→ claimId), source, sessionId, messageId, quote, createdAt
//
// PatternClaimEvidence shape:
//   id, claimId, source, sessionId, messageId, journalEntryId, quote, createdAt
//
// EvidenceSpan is NOT used for PatternClaim receipts.
// EvidenceSpan is char-level span provenance for DerivationArtifacts only.

export const V1_RECEIPT_MODEL = "PatternClaimEvidence" as const;
export const V1_RECEIPT_MIRRORS = "ContradictionEvidence" as const;

export const V1_RECEIPT_REQUIRED_FIELDS = [
  "claimId",    // PatternClaim reference
  "source",     // provenance: "derivation" | "user_input"
  "sessionId",  // session/date reference (nullable)
  "messageId",  // message/entry reference (nullable)
  "journalEntryId", // journal-entry reference (nullable)
  "quote",      // extracted quote (nullable)
] as const;

export type V1ReceiptRequiredField = (typeof V1_RECEIPT_REQUIRED_FIELDS)[number];

// ── UI Separation Guard ───────────────────────────────────────────────────────
//
// PatternClaim → V1 core surface (pattern detection, trust building)
// ProfileArtifact → legacy surface (beliefs, values, goals — pre-V1)
//
// These two must never be queried together in a single UI component.
// Use the UIDomainGuard type at component boundaries to enforce this.

export type PatternClaimDomain = "pattern_claim";
export type ProfileArtifactDomain = "profile_artifact";

// Discriminated union: a component may serve one domain or the other, never both.
export type UIDomainGuard =
  | { domain: PatternClaimDomain; includesProfileArtifacts: false }
  | { domain: ProfileArtifactDomain; includesPatternClaims: false };

/**
 * Assert that a given domain assignment is valid.
 * Throws at runtime if a component attempts to mix both domains.
 */
export function assertSingleDomain(guard: UIDomainGuard): void {
  if (
    guard.domain === "pattern_claim" &&
    "includesProfileArtifacts" in guard &&
    guard.includesProfileArtifacts !== false
  ) {
    throw new Error(
      "UIDomainGuard violation: PatternClaim domain must not include ProfileArtifacts."
    );
  }
  if (
    guard.domain === "profile_artifact" &&
    "includesPatternClaims" in guard &&
    guard.includesPatternClaims !== false
  ) {
    throw new Error(
      "UIDomainGuard violation: ProfileArtifact domain must not include PatternClaims."
    );
  }
}

// ── Model proliferation guard ─────────────────────────────────────────────────
// Enumerate all allowed evidence model names. Adding a new name here requires
// a governance review — the intent is to keep the count at 2 reused models.

export const ALLOWED_EVIDENCE_MODELS = [
  "ContradictionEvidence", // for ContradictionNode receipts
  "PatternClaimEvidence",  // for PatternClaim receipts (mirrors ContradictionEvidence)
  "EvidenceSpan",          // for DerivationArtifact char-level provenance only
] as const;

export type AllowedEvidenceModel = (typeof ALLOWED_EVIDENCE_MODELS)[number];
