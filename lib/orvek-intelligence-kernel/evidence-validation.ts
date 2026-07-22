/**
 * Exact evidence span validation + deterministic binding
 * (CEQR-001 + CEQR-016 + CEQR-018).
 *
 * Offset semantics:
 * - zero-based
 * - start inclusive
 * - end exclusive
 * - measured against the exact supplied source text for the authoritative side
 * - offsets remain UTF-16 code-unit indices (String.prototype.slice compatible)
 *
 * CEQR-016 authority:
 * - sourceId is copied from the authoritative KernelSourceUnit
 * - exactQuote is derived as sourceText.slice(startOffset, endOffset)
 * - provider-authored sourceId / exactQuote are never consulted
 * - invalid offsets fail closed (no clamp, fuzzy match, search, or full-source fallback)
 *
 * CEQR-018 lexical boundary integrity (not complete semantic adequacy):
 * - code-point-aware: resolves complete Unicode code points at each boundary
 * - rejects offsets inside UTF-16 surrogate pairs
 * - rejects mid-token cuts through letters, numbers, or combining marks
 * - combining-mark policy: marks stay attached to the adjacent base token;
 *   a boundary between base (L|N) and mark (M), or inside an M sequence, fails
 * - does not claim the selected span is propositionally sufficient
 */

import type { EvidenceSpanSelection } from "./structured-output";
import type { ExactEvidenceClaim, KernelSourceUnit } from "./types";

export type SpanValidationFailureCode =
  | "source_id_mismatch"
  | "cross_side_source"
  | "invalid_offsets"
  | "empty_quote"
  | "fabricated_quote"
  | "lexical_boundary_integrity";

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

function isHighSurrogateUnit(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogateUnit(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

/**
 * True when a UTF-16 offset falls between the high and low surrogates of a
 * single astral-plane code point.
 */
export function isOffsetInsideSurrogatePair(
  sourceText: string,
  offset: number,
): boolean {
  if (offset <= 0 || offset >= sourceText.length) return false;
  return (
    isHighSurrogateUnit(sourceText.charCodeAt(offset - 1)) &&
    isLowSurrogateUnit(sourceText.charCodeAt(offset))
  );
}

/**
 * Complete code point that begins at UTF-16 `offset` (must not lie inside a
 * surrogate pair — callers fail closed first).
 */
export function codePointStartingAt(
  sourceText: string,
  offset: number,
): { codePoint: string; endOffset: number } {
  const lead = sourceText.charCodeAt(offset);
  if (
    isHighSurrogateUnit(lead) &&
    offset + 1 < sourceText.length &&
    isLowSurrogateUnit(sourceText.charCodeAt(offset + 1))
  ) {
    return {
      codePoint: sourceText.slice(offset, offset + 2),
      endOffset: offset + 2,
    };
  }
  return {
    codePoint: sourceText.slice(offset, offset + 1),
    endOffset: offset + 1,
  };
}

/**
 * Complete code point that ends immediately before UTF-16 `offset`.
 */
export function codePointEndingBefore(
  sourceText: string,
  offset: number,
): { codePoint: string; startOffset: number } {
  const trail = sourceText.charCodeAt(offset - 1);
  if (
    isLowSurrogateUnit(trail) &&
    offset >= 2 &&
    isHighSurrogateUnit(sourceText.charCodeAt(offset - 2))
  ) {
    return {
      codePoint: sourceText.slice(offset - 2, offset),
      startOffset: offset - 2,
    };
  }
  return {
    codePoint: sourceText.slice(offset - 1, offset),
    startOffset: offset - 1,
  };
}

/**
 * Unicode letter or number on a complete code point (BMP or astral).
 * ASCII-only `[A-Za-z0-9]` is intentionally not used.
 */
export function isUnicodeAlphanumericWordChar(codePoint: string): boolean {
  if (codePoint.length === 0) return false;
  // First code point only when given a longer string.
  const first = codePointStartingAt(codePoint, 0).codePoint;
  return /^\p{L}$|^\p{N}$/u.test(first);
}

/**
 * Extended word-token code point for lexical boundary integrity:
 * letters, numbers, and combining marks (`\p{M}`).
 *
 * Combining-mark policy: marks remain attached to the adjacent base token, so
 * (L|N)–M and M–M boundaries are mid-token and fail closed.
 */
export function isUnicodeWordTokenCodePoint(codePoint: string): boolean {
  if (codePoint.length === 0) return false;
  const first = codePointStartingAt(codePoint, 0).codePoint;
  return /^\p{L}$|^\p{N}$|^\p{M}$/u.test(first);
}

export type LexicalBoundaryIntegrityResult =
  | { ok: true }
  | { ok: false; code: "lexical_boundary_integrity"; message: string };

const LEXICAL_ADEQUACY_DISCLAIMER =
  "This gate proves lexical boundary integrity only — not complete semantic proposition support.";

function failLexical(message: string): LexicalBoundaryIntegrityResult {
  return {
    ok: false,
    code: "lexical_boundary_integrity",
    message: `lexical_boundary_integrity: ${message} ${LEXICAL_ADEQUACY_DISCLAIMER}`,
  };
}

/**
 * Inspect one UTF-16 boundary. Source edges (0 / length) are always accepted.
 */
function inspectBoundary(
  sourceText: string,
  offset: number,
  role: "startOffset" | "endOffset",
): LexicalBoundaryIntegrityResult | null {
  if (offset === 0 || offset === sourceText.length) {
    return null;
  }

  if (isOffsetInsideSurrogatePair(sourceText, offset)) {
    return failLexical(
      `${role} falls inside a UTF-16 surrogate pair (astral-plane code point must not be split).`,
    );
  }

  const before = codePointEndingBefore(sourceText, offset).codePoint;
  const after = codePointStartingAt(sourceText, offset).codePoint;
  const beforeToken = isUnicodeWordTokenCodePoint(before);
  const afterToken = isUnicodeWordTokenCodePoint(after);

  if (!beforeToken || !afterToken) {
    return null;
  }

  const beforeMark = /^\p{M}$/u.test(before);
  const afterMark = /^\p{M}$/u.test(after);

  if (!beforeMark && afterMark) {
    return failLexical(
      `${role} falls between a Unicode letter/number base and a combining mark (marks remain attached to the base token).`,
    );
  }
  if (beforeMark && afterMark) {
    return failLexical(
      `${role} falls inside a Unicode combining-mark sequence.`,
    );
  }
  if (beforeMark && !afterMark) {
    return failLexical(
      `${role} falls between a combining mark and a following word-token code point (marks remain attached to the base token).`,
    );
  }

  return failLexical(
    `${role} falls inside a Unicode alphanumeric word (mid-word ${
      role === "startOffset" ? "start" : "truncation"
    }).`,
  );
}

/**
 * Reject obvious mid-word lexical truncation, surrogate-pair splitting, and the
 * documented combining-mark boundary cases.
 *
 * Do not claim full grapheme segmentation.
 *
 * Offsets are UTF-16 code-unit indices; classification uses complete Unicode
 * code points (including astral-plane letters/numbers) and a deliberate
 * combining-mark attachment rule. Lexical integrity ≠ semantic adequacy.
 *
 * Valid boundaries: source start/end, whitespace, punctuation, or other
 * non-word-token edges. No clamping, fuzzy match, search, or fallback.
 *
 * Preconditions: start/end already known to be in-range integers with
 * end > start (caller enforces range gates first).
 */
export function validateLexicalBoundaryIntegrity(
  sourceText: string,
  startOffset: number,
  endOffset: number,
): LexicalBoundaryIntegrityResult {
  const startFail = inspectBoundary(sourceText, startOffset, "startOffset");
  if (startFail) return startFail;

  const endFail = inspectBoundary(sourceText, endOffset, "endOffset");
  if (endFail) return endFail;

  return { ok: true };
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

  const lexical = validateLexicalBoundaryIntegrity(
    source.sourceText,
    selection.startOffset,
    selection.endOffset,
  );
  if (!lexical.ok) {
    return {
      ok: false,
      code: lexical.code,
      message: lexical.message,
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

  const lexical = validateLexicalBoundaryIntegrity(
    source.sourceText,
    claim.startOffset,
    claim.endOffset,
  );
  if (!lexical.ok) {
    return {
      ok: false,
      code: lexical.code,
      message: lexical.message,
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
