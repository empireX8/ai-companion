/**
 * Exact evidence span validation + deterministic binding (CEQR-001 + CEQR-016).
 *
 * Offset semantics:
 * - zero-based
 * - start inclusive
 * - end exclusive
 * - measured against the exact supplied source text for the authoritative side
 *
 * CEQR-016 authority:
 * - sourceId is copied from the authoritative KernelSourceUnit
 * - exactQuote is derived as sourceText.slice(startOffset, endOffset)
 * - provider-authored sourceId / exactQuote are never consulted
 * - invalid offsets fail closed (no clamp, fuzzy match, search, or full-source fallback)
 */

import type { EvidenceSpanSelection } from "./structured-output";
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

export type BindEvidenceClaimResult =
  | { ok: true; claim: ExactEvidenceClaim }
  | { ok: false; code: SpanValidationFailureCode; message: string };

export type BindDualSideEvidenceClaimsResult =
  | {
      ok: true;
      claimA: ExactEvidenceClaim;
      claimB: ExactEvidenceClaim;
    }
  | { ok: false; code: SpanValidationFailureCode; message: string };

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Deterministically bind a domain ExactEvidenceClaim from authoritative source
 * text and model-selected offsets. Does not read provider sourceId/exactQuote.
 */
export function bindExactEvidenceClaimFromOffsets(
  source: KernelSourceUnit,
  selection: EvidenceSpanSelection,
): BindEvidenceClaimResult {
  if (
    typeof selection.startOffset !== "number" ||
    typeof selection.endOffset !== "number" ||
    Number.isNaN(selection.startOffset) ||
    Number.isNaN(selection.endOffset)
  ) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: "Offsets must be numbers (zero-based, start inclusive, end exclusive).",
    };
  }

  if (
    !Number.isInteger(selection.startOffset) ||
    !Number.isInteger(selection.endOffset)
  ) {
    return {
      ok: false,
      code: "invalid_offsets",
      message:
        "Offsets must be non-negative integers (zero-based, start inclusive, end exclusive).",
    };
  }

  if (selection.startOffset < 0) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: `Invalid offsets: start (${selection.startOffset}) is negative.`,
    };
  }

  if (selection.endOffset <= selection.startOffset) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: `Invalid offsets: end (${selection.endOffset}) must be greater than start (${selection.startOffset}).`,
    };
  }

  if (selection.endOffset > source.sourceText.length) {
    return {
      ok: false,
      code: "invalid_offsets",
      message: `End offset ${selection.endOffset} exceeds source text length ${source.sourceText.length}.`,
    };
  }

  const exactQuote = source.sourceText.slice(
    selection.startOffset,
    selection.endOffset,
  );

  if (exactQuote.length === 0) {
    return {
      ok: false,
      code: "empty_quote",
      message: "Exact quote must be a non-empty string.",
    };
  }

  return {
    ok: true,
    claim: {
      sourceId: source.sourceId,
      exactQuote,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
    },
  };
}

/**
 * Bind ordered Side A / Side B claims from authoritative units + model offsets.
 * Side ordering is fixed by argument position; sides cannot be swapped by the model.
 */
export function bindDualSideEvidenceClaims(args: {
  selectionA: EvidenceSpanSelection;
  selectionB: EvidenceSpanSelection;
  sourceA: KernelSourceUnit;
  sourceB: KernelSourceUnit;
}): BindDualSideEvidenceClaimsResult {
  const a = bindExactEvidenceClaimFromOffsets(args.sourceA, args.selectionA);
  if (!a.ok) return a;

  const b = bindExactEvidenceClaimFromOffsets(args.sourceB, args.selectionB);
  if (!b.ok) return b;

  return { ok: true, claimA: a.claim, claimB: b.claim };
}

/**
 * Validate a domain exact evidence claim against a single source unit.
 * Defensive check for bound (or test-constructed) claims.
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
