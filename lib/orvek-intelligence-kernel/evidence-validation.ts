/**
 * Exact evidence span validation (deterministic).
 *
 * Offset semantics:
 * - zero-based
 * - start inclusive
 * - end exclusive
 * - measured against the exact supplied source text for the claimed sourceId
 */

import type { ExactEvidenceClaim, KernelSourceUnit } from "./types";

export type SpanValidationFailureCode =
  | "source_id_mismatch"
  | "cross_side_source"
  | "invalid_offsets"
  | "empty_quote"
  | "fabricated_quote";

export type SpanValidationResult =
  | { ok: true }
  | { ok: false; code: SpanValidationFailureCode; message: string };

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Validate a model-proposed exact evidence claim against a single source unit.
 */
export function validateExactEvidenceClaim(
  claim: ExactEvidenceClaim,
  source: KernelSourceUnit,
): SpanValidationResult {
  if (claim.sourceId !== source.sourceId) {
    return {
      ok: false,
      code: "source_id_mismatch",
      message: `Evidence claim sourceId "${claim.sourceId}" does not match source "${source.sourceId}".`,
    };
  }

  if (!isNonNegativeInteger(claim.startOffset) || !isNonNegativeInteger(claim.endOffset)) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: "Offsets must be non-negative integers (zero-based, start inclusive, end exclusive).",
    };
  }

  if (claim.endOffset < claim.startOffset) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: `Invalid offsets: end (${claim.endOffset}) is before start (${claim.startOffset}).`,
    };
  }

  if (claim.endOffset > source.sourceText.length) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: `End offset ${claim.endOffset} exceeds source text length ${source.sourceText.length}.`,
    };
  }

  const quote = claim.exactQuote;
  if (typeof quote !== "string" || quote.length === 0) {
    return {
      ok: false,
      code: "empty_quote",
      message: "Exact quote must be a non-empty string.",
    };
  }

  const sliced = source.sourceText.slice(claim.startOffset, claim.endOffset);
  if (sliced !== quote) {
    return {
      ok: false,
      code: "fabricated_quote",
      message:
        "Exact quote does not equal sourceText.slice(startOffset, endOffset); quote appears fabricated or mismatched.",
    };
  }

  return { ok: true };
}

/**
 * Validate dual-side claims: Side A must point at source A, Side B at source B.
 * Cross-pointing is rejected.
 */
export function validateDualSideEvidenceClaims(args: {
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
  sourceA: KernelSourceUnit;
  sourceB: KernelSourceUnit;
}): SpanValidationResult {
  if (args.claimA.sourceId === args.sourceB.sourceId) {
    return {
      ok: false,
      code: "cross_side_source",
      message: "Side A evidence claim must not point at the Side B source.",
    };
  }
  if (args.claimB.sourceId === args.sourceA.sourceId) {
    return {
      ok: false,
      code: "cross_side_source",
      message: "Side B evidence claim must not point at the Side A source.",
    };
  }

  const a = validateExactEvidenceClaim(args.claimA, args.sourceA);
  if (!a.ok) return a;

  const b = validateExactEvidenceClaim(args.claimB, args.sourceB);
  if (!b.ok) return b;

  return { ok: true };
}

/** Helper for tests and callers: build a valid claim for a substring. */
export function claimForSubstring(
  source: KernelSourceUnit,
  exactQuote: string,
): ExactEvidenceClaim | null {
  const startOffset = source.sourceText.indexOf(exactQuote);
  if (startOffset < 0) return null;
  return {
    sourceId: source.sourceId,
    exactQuote,
    startOffset,
    endOffset: startOffset + exactQuote.length,
  };
}
