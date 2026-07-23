/**
 * CEQR-020 — code-owned lexical boundary catalog.
 *
 * Enumerates UTF-16 offsets that are valid exclusive-end / inclusive-start
 * lexical boundaries for a source string. Provider transport selects indices
 * into this catalog; code maps indices to offsets and derives exactQuote.
 *
 * Mid-word offsets are structurally absent from the catalog, so a provider
 * cannot express a mid-word cut through an in-range boundary index.
 *
 * Catalog prompt footprint is strictly bounded (Architecture A): over-limit
 * sources fail closed before any provider invocation. Catalogs are never
 * silently truncated (that would change index authority).
 *
 * Source-length gates run before any catalog enumeration. Entry-count gates
 * use bounded enumeration that stops at MAX_ENTRIES+1 (sentinel only — the
 * partial catalog is never sent to a provider).
 */

import { createHash } from "crypto";
import {
  isOffsetInsideSurrogatePair,
  isUnicodeWordTokenCodePoint,
  codePointEndingBefore,
  codePointStartingAt,
  validateLexicalBoundaryIntegrity,
} from "./evidence-validation";
import type { EvidenceSpanSelection } from "./structured-output";

/**
 * Maximum UTF-16 source length accepted for boundary-index adjudication
 * (Architecture A). Over-limit sources fail closed before provider invocation
 * and before any catalog enumeration.
 */
export const LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 = 512 as const;

/**
 * Maximum catalog entries per side. Worst-case ASCII punctuation sources
 * approach length+1 entries; this cap fail-closes before provider call.
 */
export const LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES = 256 as const;

export type LexicalBoundaryCategory =
  | "source_edge"
  | "whitespace"
  | "punctuation"
  | "other_non_word"
  | "word_edge";

export type LexicalBoundaryEntry = {
  /** Index into the catalog (0 … length-1). */
  boundaryIndex: number;
  /** UTF-16 code-unit offset into sourceText. */
  offset: number;
  category: LexicalBoundaryCategory;
};

export type ResolveBoundarySelectionResult =
  | {
      ok: true;
      startOffset: number;
      endOffset: number;
      startBoundaryIndex: number;
      endBoundaryIndex: number;
    }
  | {
      /** Category A: indices cannot resolve to catalog offsets. */
      ok: false;
      resolveKind: "unresolved_indices";
      code: "invalid_boundary_index";
      message: string;
      startBoundaryIndex: number | null;
      endBoundaryIndex: number | null;
      startOffset: null;
      endOffset: null;
    }
  | {
      /**
       * Category B: indices resolved to UTF-16 offsets, but the span is
       * invalid (equal/reversed, or defence-in-depth lexical failure).
       * Offsets remain available for sanitized diagnostics.
       */
      ok: false;
      resolveKind: "resolved_invalid_span";
      code: "invalid_offsets" | "lexical_boundary_integrity";
      message: string;
      startBoundaryIndex: number;
      endBoundaryIndex: number;
      startOffset: number;
      endOffset: number;
    };

export type LexicalBoundaryCatalogComputation =
  | "computed"
  | "skipped_source_over_limit"
  | "stopped_entry_over_limit";

export type LexicalBoundarySideLimitInfo = {
  sourceLengthUtf16: number;
  /** Receipt-safe SHA-256 of the authoritative source text (UTF-8 bytes). */
  sourceSha256: string;
  /**
   * Catalog length when computed or when stopped at the MAX+1 sentinel.
   * Null when enumeration was skipped due to source-length over-limit.
   */
  catalogLength: number | null;
  catalogComputation: LexicalBoundaryCatalogComputation;
  sourceOverLimit: boolean;
  catalogOverLimit: boolean;
};

export type LexicalBoundaryCatalogLimitCheck =
  | {
      ok: true;
      sideACatalog: LexicalBoundaryEntry[];
      sideBCatalog: LexicalBoundaryEntry[];
      sideA: LexicalBoundarySideLimitInfo;
      sideB: LexicalBoundarySideLimitInfo;
    }
  | {
      ok: false;
      code: "lexical_boundary_catalog_limit_exceeded";
      message: string;
      sideA: LexicalBoundarySideLimitInfo;
      sideB: LexicalBoundarySideLimitInfo;
    };

export function hashSourceTextSha256(sourceText: string): string {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
}

/**
 * True when a single UTF-16 offset is a valid lexical boundary position
 * (source edge, or not mid-token / not inside a surrogate pair).
 */
export function isValidLexicalBoundaryOffset(
  sourceText: string,
  offset: number,
): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset > sourceText.length) {
    return false;
  }
  if (offset === 0 || offset === sourceText.length) return true;
  if (isOffsetInsideSurrogatePair(sourceText, offset)) return false;

  const before = codePointEndingBefore(sourceText, offset).codePoint;
  const after = codePointStartingAt(sourceText, offset).codePoint;
  const beforeToken = isUnicodeWordTokenCodePoint(before);
  const afterToken = isUnicodeWordTokenCodePoint(after);
  if (!beforeToken || !afterToken) return true;

  // Same mid-token cases as validateLexicalBoundaryIntegrity / inspectBoundary.
  return false;
}

export function classifyLexicalBoundaryCategory(
  sourceText: string,
  offset: number,
): LexicalBoundaryCategory {
  if (offset === 0 || offset === sourceText.length) return "source_edge";
  if (isOffsetInsideSurrogatePair(sourceText, offset)) return "other_non_word";

  const before = codePointEndingBefore(sourceText, offset).codePoint;
  const after = codePointStartingAt(sourceText, offset).codePoint;

  if (/^\s$/u.test(before) || /^\s$/u.test(after)) return "whitespace";
  if (/^\p{P}$/u.test(before) || /^\p{P}$/u.test(after)) return "punctuation";

  const beforeToken = isUnicodeWordTokenCodePoint(before);
  const afterToken = isUnicodeWordTokenCodePoint(after);
  if (beforeToken !== afterToken) return "word_edge";
  return "other_non_word";
}

/**
 * Bounded enumeration: stops once `maxEntries + 1` valid boundaries are found.
 * The MAX+1 sentinel proves over-limit; callers must never send a stopped
 * partial catalog to a provider (that would change index authority).
 */
export function enumerateValidLexicalBoundariesBounded(
  sourceText: string,
  maxEntries: number,
): {
  catalog: LexicalBoundaryEntry[];
  stoppedEarly: boolean;
} {
  const entries: LexicalBoundaryEntry[] = [];
  for (let offset = 0; offset <= sourceText.length; offset += 1) {
    if (!isValidLexicalBoundaryOffset(sourceText, offset)) continue;
    entries.push({
      boundaryIndex: entries.length,
      offset,
      category: classifyLexicalBoundaryCategory(sourceText, offset),
    });
    if (entries.length > maxEntries) {
      return { catalog: entries, stoppedEarly: true };
    }
  }
  return { catalog: entries, stoppedEarly: false };
}

/**
 * Enumerate every valid lexical boundary offset for `sourceText` in UTF-16
 * order. Empty string yields a single edge at 0.
 *
 * Prefer `enumerateValidLexicalBoundariesBounded` / limit checks for any
 * untrusted or unbounded source. This full enumeration remains for in-bound
 * fixtures and forensic helpers that already know the source is small.
 */
export function enumerateValidLexicalBoundaries(
  sourceText: string,
): LexicalBoundaryEntry[] {
  return enumerateValidLexicalBoundariesBounded(
    sourceText,
    Number.MAX_SAFE_INTEGER,
  ).catalog;
}

function sideSourceOverLimitInfo(sourceText: string): LexicalBoundarySideLimitInfo {
  return {
    sourceLengthUtf16: sourceText.length,
    sourceSha256: hashSourceTextSha256(sourceText),
    catalogLength: null,
    catalogComputation: "skipped_source_over_limit",
    sourceOverLimit: true,
    catalogOverLimit: false,
  };
}

/**
 * Fail-closed pre-provider catalog bound check (Architecture A).
 *
 * Order:
 * 1. Check UTF-16 source lengths — never enumerate an over-length source.
 * 2. Bounded-enumerate in-bound sources; stop at MAX_ENTRIES+1.
 * 3. Never truncate-and-send: over-entry returns ok:false without exposing
 *    the sentinel catalog for provider use.
 */
export function checkLexicalBoundaryCatalogLimits(args: {
  sideAText: string;
  sideBText: string;
}): LexicalBoundaryCatalogLimitCheck {
  const sideASourceOver =
    args.sideAText.length > LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16;
  const sideBSourceOver =
    args.sideBText.length > LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16;

  if (sideASourceOver || sideBSourceOver) {
    const sideA = sideASourceOver
      ? sideSourceOverLimitInfo(args.sideAText)
      : (() => {
          const bounded = enumerateValidLexicalBoundariesBounded(
            args.sideAText,
            LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
          );
          return {
            sourceLengthUtf16: args.sideAText.length,
            sourceSha256: hashSourceTextSha256(args.sideAText),
            catalogLength: bounded.catalog.length,
            catalogComputation: bounded.stoppedEarly
              ? ("stopped_entry_over_limit" as const)
              : ("computed" as const),
            sourceOverLimit: false,
            catalogOverLimit: bounded.stoppedEarly,
          };
        })();
    const sideB = sideBSourceOver
      ? sideSourceOverLimitInfo(args.sideBText)
      : (() => {
          const bounded = enumerateValidLexicalBoundariesBounded(
            args.sideBText,
            LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
          );
          return {
            sourceLengthUtf16: args.sideBText.length,
            sourceSha256: hashSourceTextSha256(args.sideBText),
            catalogLength: bounded.catalog.length,
            catalogComputation: bounded.stoppedEarly
              ? ("stopped_entry_over_limit" as const)
              : ("computed" as const),
            sourceOverLimit: false,
            catalogOverLimit: bounded.stoppedEarly,
          };
        })();

    return {
      ok: false,
      code: "lexical_boundary_catalog_limit_exceeded",
      message: [
        "lexical_boundary_catalog_limit_exceeded:",
        `maxSourceUtf16=${LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16}`,
        `maxCatalogEntries=${LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES}`,
        `sideASource=${sideA.sourceLengthUtf16}`,
        `sideACatalog=${sideA.catalogLength ?? "null"}`,
        `sideAComputation=${sideA.catalogComputation}`,
        `sideBSource=${sideB.sourceLengthUtf16}`,
        `sideBCatalog=${sideB.catalogLength ?? "null"}`,
        `sideBComputation=${sideB.catalogComputation}`,
        "Over-length sources were not enumerated; catalog was not truncated; provider was not invoked.",
      ].join(" "),
      sideA,
      sideB,
    };
  }

  const sideABounded = enumerateValidLexicalBoundariesBounded(
    args.sideAText,
    LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
  );
  const sideBBounded = enumerateValidLexicalBoundariesBounded(
    args.sideBText,
    LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
  );

  const sideA: LexicalBoundarySideLimitInfo = {
    sourceLengthUtf16: args.sideAText.length,
    sourceSha256: hashSourceTextSha256(args.sideAText),
    catalogLength: sideABounded.catalog.length,
    catalogComputation: sideABounded.stoppedEarly
      ? "stopped_entry_over_limit"
      : "computed",
    sourceOverLimit: false,
    catalogOverLimit: sideABounded.stoppedEarly,
  };
  const sideB: LexicalBoundarySideLimitInfo = {
    sourceLengthUtf16: args.sideBText.length,
    sourceSha256: hashSourceTextSha256(args.sideBText),
    catalogLength: sideBBounded.catalog.length,
    catalogComputation: sideBBounded.stoppedEarly
      ? "stopped_entry_over_limit"
      : "computed",
    sourceOverLimit: false,
    catalogOverLimit: sideBBounded.stoppedEarly,
  };

  if (sideA.catalogOverLimit || sideB.catalogOverLimit) {
    return {
      ok: false,
      code: "lexical_boundary_catalog_limit_exceeded",
      message: [
        "lexical_boundary_catalog_limit_exceeded:",
        `maxSourceUtf16=${LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16}`,
        `maxCatalogEntries=${LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES}`,
        `sideASource=${sideA.sourceLengthUtf16}`,
        `sideACatalog=${sideA.catalogLength}`,
        `sideAComputation=${sideA.catalogComputation}`,
        `sideBSource=${sideB.sourceLengthUtf16}`,
        `sideBCatalog=${sideB.catalogLength}`,
        `sideBComputation=${sideB.catalogComputation}`,
        "Entry enumeration stopped at MAX+1 sentinel; catalog was not truncated for provider use; provider was not invoked.",
      ].join(" "),
      sideA,
      sideB,
    };
  }

  return {
    ok: true,
    sideACatalog: sideABounded.catalog,
    sideBCatalog: sideBBounded.catalog,
    sideA,
    sideB,
  };
}

/**
 * Map provider boundary-index selection to UTF-16 offsets.
 * Out-of-range or non-integer indices fail closed (no clamp).
 * Category-B span failures preserve resolved offsets for diagnostics.
 *
 * Prefer passing the exact prevalidated catalog used in the prompt so prompt
 * index authority and binding index authority share one immutable instance.
 */
export function resolveBoundaryIndexSelection(
  sourceText: string,
  selection: EvidenceSpanSelection,
  catalog: readonly LexicalBoundaryEntry[] = enumerateValidLexicalBoundaries(
    sourceText,
  ),
): ResolveBoundarySelectionResult {
  const rawStart =
    typeof selection.startBoundaryIndex === "number" &&
    !Number.isNaN(selection.startBoundaryIndex)
      ? selection.startBoundaryIndex
      : null;
  const rawEnd =
    typeof selection.endBoundaryIndex === "number" &&
    !Number.isNaN(selection.endBoundaryIndex)
      ? selection.endBoundaryIndex
      : null;

  if (rawStart == null || rawEnd == null) {
    return {
      ok: false,
      resolveKind: "unresolved_indices",
      code: "invalid_boundary_index",
      message:
        "Boundary indices must be numbers (indices into the code-owned lexical boundary catalog).",
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset: null,
      endOffset: null,
    };
  }

  if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) {
    return {
      ok: false,
      resolveKind: "unresolved_indices",
      code: "invalid_boundary_index",
      message:
        "Boundary indices must be non-negative integers into the code-owned lexical boundary catalog.",
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset: null,
      endOffset: null,
    };
  }

  if (rawStart < 0 || rawEnd < 0) {
    return {
      ok: false,
      resolveKind: "unresolved_indices",
      code: "invalid_boundary_index",
      message: `Invalid boundary indices: start (${rawStart}) / end (${rawEnd}) must be non-negative.`,
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset: null,
      endOffset: null,
    };
  }

  if (rawStart >= catalog.length || rawEnd >= catalog.length) {
    return {
      ok: false,
      resolveKind: "unresolved_indices",
      code: "invalid_boundary_index",
      message: `Boundary index out of range for catalog length ${catalog.length} (start=${rawStart}, end=${rawEnd}).`,
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset: null,
      endOffset: null,
    };
  }

  const startOffset = catalog[rawStart]!.offset;
  const endOffset = catalog[rawEnd]!.offset;

  if (endOffset <= startOffset) {
    return {
      ok: false,
      resolveKind: "resolved_invalid_span",
      code: "invalid_offsets",
      message: `Invalid resolved offsets: end (${endOffset}) must be greater than start (${startOffset}).`,
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset,
      endOffset,
    };
  }

  // Defence in depth — catalog membership already implies lexical validity.
  const lexical = validateLexicalBoundaryIntegrity(
    sourceText,
    startOffset,
    endOffset,
  );
  if (!lexical.ok) {
    return {
      ok: false,
      resolveKind: "resolved_invalid_span",
      code: "lexical_boundary_integrity",
      message: lexical.message,
      startBoundaryIndex: rawStart,
      endBoundaryIndex: rawEnd,
      startOffset,
      endOffset,
    };
  }

  return {
    ok: true,
    startOffset,
    endOffset,
    startBoundaryIndex: rawStart,
    endBoundaryIndex: rawEnd,
  };
}

/**
 * Build a transport selection for known-good UTF-16 offsets (tests / fixtures).
 * Returns null when either offset is not a catalog member (e.g. mid-word).
 */
export function boundarySelectionForOffsets(
  sourceText: string,
  startOffset: number,
  endOffset: number,
  catalog: readonly LexicalBoundaryEntry[] = enumerateValidLexicalBoundaries(
    sourceText,
  ),
): EvidenceSpanSelection | null {
  const startBoundaryIndex = catalog.findIndex((e) => e.offset === startOffset);
  const endBoundaryIndex = catalog.findIndex((e) => e.offset === endOffset);
  if (startBoundaryIndex < 0 || endBoundaryIndex < 0) return null;
  return { startBoundaryIndex, endBoundaryIndex };
}

/** Full-source transport selection (first → last catalog entry). */
export function boundarySelectionForFullSource(
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[] = enumerateValidLexicalBoundaries(
    sourceText,
  ),
): EvidenceSpanSelection {
  if (catalog.length < 2) {
    // Empty source: only edge 0 — cannot form a non-empty span.
    return { startBoundaryIndex: 0, endBoundaryIndex: 0 };
  }
  return {
    startBoundaryIndex: 0,
    endBoundaryIndex: catalog.length - 1,
  };
}

/**
 * Prompt-facing catalog lines for a pre-validated in-bound catalog.
 * Requires an explicit catalog argument — never enumerates by default.
 */
export function formatLexicalBoundaryCatalogForPrompt(
  sideLabel: "A" | "B",
  sourceText: string,
  catalog: readonly LexicalBoundaryEntry[],
): string {
  if (
    sourceText.length > LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 ||
    catalog.length > LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES
  ) {
    throw new Error(
      "formatLexicalBoundaryCatalogForPrompt refused over-limit catalog; checkLexicalBoundaryCatalogLimits must fail closed first.",
    );
  }
  const lines = catalog.map(
    (entry) =>
      `  [${entry.boundaryIndex}] offset=${entry.offset} category=${entry.category}`,
  );
  return [
    `Side ${sideLabel} lexical boundary catalog (code-owned; UTF-16 offsets; select indices only):`,
    `  sourceTextLengthUtf16=${sourceText.length}`,
    `  catalogLength=${catalog.length}`,
    ...lines,
  ].join("\n");
}
