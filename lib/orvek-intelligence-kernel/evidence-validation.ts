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

import type { ExactEvidenceClaim, KernelSourceUnit } from "./types";
import type { EvidenceSpanSelection } from "./structured-output";

export type SpanValidationFailureCode =
  | "source_id_mismatch"
  | "cross_side_source"
  | "invalid_offsets"
  | "invalid_boundary_index"
  | "empty_quote"
  | "fabricated_quote"
  | "lexical_boundary_integrity"
  | "lexical_boundary_catalog_limit_exceeded";

export type SpanValidationResult =
  | { ok: true }
  | { ok: false; code: SpanValidationFailureCode; message: string };

export type BindEvidenceClaimResult =
  | { ok: true; claim: ExactEvidenceClaim }
  | { ok: false; code: SpanValidationFailureCode; message: string };

export type EvidenceSideBindDiagnostic = {
  side: "A" | "B";
  startBoundaryIndex: number | null;
  endBoundaryIndex: number | null;
  startOffset: number | null;
  endOffset: number | null;
  selectedSpanLength: number | null;
  sourceLengthUtf16: number;
  sourceLengthCodePoints: number;
  validationCode: SpanValidationFailureCode | null;
  validationOk: boolean;
  boundaryCategoryBeforeStart: string | null;
  boundaryCategoryAtStart: string | null;
  boundaryCategoryBeforeEnd: string | null;
  boundaryCategoryAtEnd: string | null;
  splitsSurrogateAtStart: boolean | null;
  splitsSurrogateAtEnd: boolean | null;
  endOffsetInsideAlphanumericWord: boolean | null;
  startOffsetInsideAlphanumericWord: boolean | null;
  exactQuoteWouldEqualAuthoritativeSlice: boolean | null;
};

export type BindDualSideEvidenceClaimsResult =
  | {
      ok: true;
      claimA: ExactEvidenceClaim;
      claimB: ExactEvidenceClaim;
      sideDiagnostics: [EvidenceSideBindDiagnostic, EvidenceSideBindDiagnostic];
    }
  | {
      ok: false;
      code: SpanValidationFailureCode;
      message: string;
      /** Per-side attempts — both sides are always evaluated. */
      sideDiagnostics: [EvidenceSideBindDiagnostic, EvidenceSideBindDiagnostic];
      /** Labeled per-side error strings (Side A: … / Side B: …). */
      sideErrors: string[];
    };

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
 * Independent single-offset lexical inspection for sanitized diagnostics.
 * Does not depend on the other span endpoint or a fail-first pair result.
 */
export type LexicalOffsetInspection = {
  inRange: boolean;
  isSourceEdge: boolean;
  splitsSurrogate: boolean;
  previousCodePoint: string | null;
  followingCodePoint: string | null;
  previousIsWordToken: boolean | null;
  followingIsWordToken: boolean | null;
  /** Mid-token: both adjacent code points are word tokens (L/N/M). */
  insideUnicodeWordToken: boolean;
  /** True when the boundary fails the combining-mark attachment rule. */
  combiningMarkBoundaryFailure: boolean;
  /**
   * True when the boundary is a mid-word alphanumeric cut (both sides L/N,
   * not a combining-mark-specific failure).
   */
  insideAlphanumericWord: boolean;
  category: string | null;
};

export function inspectLexicalOffsetIndependently(
  sourceText: string,
  offset: number,
): LexicalOffsetInspection {
  const inRange =
    Number.isInteger(offset) && offset >= 0 && offset <= sourceText.length;
  if (!inRange) {
    return {
      inRange: false,
      isSourceEdge: false,
      splitsSurrogate: false,
      previousCodePoint: null,
      followingCodePoint: null,
      previousIsWordToken: null,
      followingIsWordToken: null,
      insideUnicodeWordToken: false,
      combiningMarkBoundaryFailure: false,
      insideAlphanumericWord: false,
      category: null,
    };
  }

  const isSourceEdge = offset === 0 || offset === sourceText.length;
  const splitsSurrogate = isOffsetInsideSurrogatePair(sourceText, offset);

  if (isSourceEdge) {
    return {
      inRange: true,
      isSourceEdge: true,
      splitsSurrogate: false,
      previousCodePoint: null,
      followingCodePoint: null,
      previousIsWordToken: null,
      followingIsWordToken: null,
      insideUnicodeWordToken: false,
      combiningMarkBoundaryFailure: false,
      insideAlphanumericWord: false,
      category: "source_edge",
    };
  }

  if (splitsSurrogate) {
    return {
      inRange: true,
      isSourceEdge: false,
      splitsSurrogate: true,
      previousCodePoint: null,
      followingCodePoint: null,
      previousIsWordToken: null,
      followingIsWordToken: null,
      insideUnicodeWordToken: false,
      combiningMarkBoundaryFailure: false,
      insideAlphanumericWord: false,
      category: "surrogate_split",
    };
  }

  const previousCodePoint = codePointEndingBefore(sourceText, offset).codePoint;
  const followingCodePoint = codePointStartingAt(sourceText, offset).codePoint;
  const previousIsWordToken = isUnicodeWordTokenCodePoint(previousCodePoint);
  const followingIsWordToken = isUnicodeWordTokenCodePoint(followingCodePoint);
  const insideUnicodeWordToken = previousIsWordToken && followingIsWordToken;

  const beforeMark = /^\p{M}$/u.test(previousCodePoint);
  const afterMark = /^\p{M}$/u.test(followingCodePoint);
  const combiningMarkBoundaryFailure =
    insideUnicodeWordToken &&
    ((!beforeMark && afterMark) ||
      (beforeMark && afterMark) ||
      (beforeMark && !afterMark));

  // Mid-word alphanumeric: both adjacent complete code points are L or N.
  const insideAlphanumericWord =
    /^\p{L}$|^\p{N}$/u.test(previousCodePoint) &&
    /^\p{L}$|^\p{N}$/u.test(followingCodePoint);

  return {
    inRange: true,
    isSourceEdge: false,
    splitsSurrogate: false,
    previousCodePoint,
    followingCodePoint,
    previousIsWordToken,
    followingIsWordToken,
    insideUnicodeWordToken,
    combiningMarkBoundaryFailure,
    insideAlphanumericWord,
    category: categoryAtBoundary(sourceText, offset),
  };
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
 * Offset-pair shape used by the low-level binder and defensive validators.
 * Distinct from the provider transport EvidenceSpanSelection (boundary indices).
 */
export type EvidenceOffsetPair = {
  startOffset: number;
  endOffset: number;
};

function categoryAtBoundary(
  sourceText: string,
  offset: number,
): string | null {
  if (!Number.isInteger(offset) || offset < 0 || offset > sourceText.length) {
    return null;
  }
  if (offset === 0 || offset === sourceText.length) return "source_edge";
  if (isOffsetInsideSurrogatePair(sourceText, offset)) return "surrogate_split";
  const before = codePointEndingBefore(sourceText, offset).codePoint;
  const after = codePointStartingAt(sourceText, offset).codePoint;
  if (/^\s$/u.test(before) || /^\s$/u.test(after)) return "whitespace";
  if (/^\p{P}$/u.test(before) || /^\p{P}$/u.test(after)) return "punctuation";
  if (
    isUnicodeWordTokenCodePoint(before) &&
    isUnicodeWordTokenCodePoint(after)
  ) {
    return "inside_word_token";
  }
  if (
    isUnicodeWordTokenCodePoint(before) !== isUnicodeWordTokenCodePoint(after)
  ) {
    return "word_edge";
  }
  return "other";
}

function categoryBeforeBoundary(
  sourceText: string,
  offset: number,
): string | null {
  if (!Number.isInteger(offset) || offset <= 0 || offset > sourceText.length) {
    return offset === 0 ? "source_edge" : null;
  }
  if (isOffsetInsideSurrogatePair(sourceText, offset)) return "surrogate_split";
  const before = codePointEndingBefore(sourceText, offset).codePoint;
  if (/^\s$/u.test(before)) return "whitespace";
  if (/^\p{P}$/u.test(before)) return "punctuation";
  if (isUnicodeWordTokenCodePoint(before)) return "word_token";
  return "other";
}

/**
 * Build sanitized per-side bind diagnostics without retaining quote text.
 */
export function buildEvidenceSideBindDiagnostic(args: {
  side: "A" | "B";
  source: KernelSourceUnit;
  selection: EvidenceSpanSelection;
  bind: BindEvidenceClaimResult;
  resolved: EvidenceOffsetPair | null;
}): EvidenceSideBindDiagnostic {
  const { source, selection, bind, resolved } = args;
  const startOffset = resolved?.startOffset ?? null;
  const endOffset = resolved?.endOffset ?? null;
  const sourceLengthUtf16 = source.sourceText.length;
  const sourceLengthCodePoints = [...source.sourceText].length;

  let endOffsetInsideAlphanumericWord: boolean | null = null;
  let startOffsetInsideAlphanumericWord: boolean | null = null;
  if (startOffset != null) {
    startOffsetInsideAlphanumericWord = inspectLexicalOffsetIndependently(
      source.sourceText,
      startOffset,
    ).insideAlphanumericWord;
  }
  if (endOffset != null) {
    endOffsetInsideAlphanumericWord = inspectLexicalOffsetIndependently(
      source.sourceText,
      endOffset,
    ).insideAlphanumericWord;
  }

  let exactQuoteWouldEqualAuthoritativeSlice: boolean | null = null;
  if (bind.ok) {
    exactQuoteWouldEqualAuthoritativeSlice = true;
  } else if (startOffset != null && endOffset != null && endOffset > startOffset) {
    // Would equal by construction if binding succeeded; when bind fails before
    // slice authority, still true that code would derive slice (not provider quote).
    exactQuoteWouldEqualAuthoritativeSlice = true;
  }

  return {
    side: args.side,
    startBoundaryIndex:
      typeof selection.startBoundaryIndex === "number"
        ? selection.startBoundaryIndex
        : null,
    endBoundaryIndex:
      typeof selection.endBoundaryIndex === "number"
        ? selection.endBoundaryIndex
        : null,
    startOffset,
    endOffset,
    selectedSpanLength:
      startOffset != null && endOffset != null ? endOffset - startOffset : null,
    sourceLengthUtf16,
    sourceLengthCodePoints,
    validationCode: bind.ok ? null : bind.code,
    validationOk: bind.ok,
    boundaryCategoryBeforeStart:
      startOffset != null
        ? categoryBeforeBoundary(source.sourceText, startOffset)
        : null,
    boundaryCategoryAtStart:
      startOffset != null
        ? categoryAtBoundary(source.sourceText, startOffset)
        : null,
    boundaryCategoryBeforeEnd:
      endOffset != null
        ? categoryBeforeBoundary(source.sourceText, endOffset)
        : null,
    boundaryCategoryAtEnd:
      endOffset != null
        ? categoryAtBoundary(source.sourceText, endOffset)
        : null,
    splitsSurrogateAtStart:
      startOffset != null
        ? isOffsetInsideSurrogatePair(source.sourceText, startOffset)
        : null,
    splitsSurrogateAtEnd:
      endOffset != null
        ? isOffsetInsideSurrogatePair(source.sourceText, endOffset)
        : null,
    endOffsetInsideAlphanumericWord,
    startOffsetInsideAlphanumericWord,
    exactQuoteWouldEqualAuthoritativeSlice,
  };
}

/**
 * Deterministically bind a domain ExactEvidenceClaim from authoritative source
 * text and resolved UTF-16 offsets. Does not read provider sourceId/exactQuote.
 * Used by the boundary-index binder and by offline forensic / regression tests.
 */
export function bindExactEvidenceClaimFromOffsets(
  source: KernelSourceUnit,
  selection: EvidenceOffsetPair,
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
