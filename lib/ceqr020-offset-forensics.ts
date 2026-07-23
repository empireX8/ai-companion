/**
 * CEQR-020 — offline offset forensic helpers.
 *
 * Deterministic matrix probes for frozen CEQR-019 ASCII sources.
 * Must NOT be imported by production routes or message-send paths.
 * Must NOT call live providers.
 */

import { createHash } from "crypto";

import {
  bindExactEvidenceClaimFromOffsets,
  validateLexicalBoundaryIntegrity,
} from "./orvek-intelligence-kernel/evidence-validation";
import {
  enumerateValidLexicalBoundaries,
  isValidLexicalBoundaryOffset,
} from "./orvek-intelligence-kernel/lexical-boundary-catalog";
import { LIVE_SYNTHETIC_CASES } from "./contradiction-live-provider-referee-proof";
import type { LiveSyntheticCase } from "./contradiction-live-provider-referee-proof";

export const CEQR_020_SLICE_ID =
  "CONTRADICTION-LIVE-EVIDENCE-OFFSET-FORENSIC-REPAIR-001" as const;
export const CEQR_020_CAMPAIGN_SLICE = "CEQR-020" as const;

export type CharCategory =
  | "edge"
  | "L"
  | "N"
  | "Z"
  | "P"
  | "M"
  | "other";

export type OffsetMatrixProbeResult = {
  probeId: string;
  caseId: string;
  side: "A" | "B";
  sourceText: string;
  sourceLengthUtf16: number;
  sourceLengthCodePoints: number;
  utf16EqualsCodePoints: boolean;
  startOffset: number;
  endOffset: number;
  selectedSpanLength: number;
  categoryBeforeEnd: CharCategory;
  categoryAtEnd: CharCategory;
  authoritativeSlice: string;
  validatorOk: boolean;
  validationCode: string | null;
  validationMessage: string | null;
  bindOk: boolean;
  bindCode: string | null;
};

function categoryOfCodePoint(ch: string | null): CharCategory {
  if (ch == null) return "edge";
  if (/^\p{L}$/u.test(ch)) return "L";
  if (/^\p{N}$/u.test(ch)) return "N";
  if (/^\s$/u.test(ch)) return "Z";
  if (/^\p{P}$/u.test(ch)) return "P";
  if (/^\p{M}$/u.test(ch)) return "M";
  return "other";
}

function charBefore(text: string, offset: number): string | null {
  if (offset <= 0 || offset > text.length) return null;
  return text[offset - 1] ?? null;
}

function charAt(text: string, offset: number): string | null {
  if (offset < 0 || offset >= text.length) return null;
  return text[offset] ?? null;
}

function finalWordBounds(text: string): {
  wordStart: number;
  wordEndExclusive: number;
  punctLen: number;
} {
  const match = text.match(/(\w+)([.!?]?)$/);
  if (!match) {
    return { wordStart: 0, wordEndExclusive: text.length, punctLen: 0 };
  }
  const word = match[1]!;
  const punct = match[2] ?? "";
  const wordEndExclusive = text.length - punct.length;
  const wordStart = wordEndExclusive - word.length;
  return { wordStart, wordEndExclusive, punctLen: punct.length };
}

export function probeOffsetPair(args: {
  probeId: string;
  caseId: string;
  side: "A" | "B";
  sourceText: string;
  startOffset: number;
  endOffset: number;
}): OffsetMatrixProbeResult {
  const { sourceText, startOffset, endOffset } = args;
  const sourceLengthUtf16 = sourceText.length;
  const sourceLengthCodePoints = [...sourceText].length;
  const lexical =
    Number.isInteger(startOffset) &&
    Number.isInteger(endOffset) &&
    startOffset >= 0 &&
    endOffset > startOffset &&
    endOffset <= sourceText.length
      ? validateLexicalBoundaryIntegrity(sourceText, startOffset, endOffset)
      : null;

  const bind = bindExactEvidenceClaimFromOffsets(
    {
      sourceId: `forensic-${args.caseId}-${args.side}`,
      sessionId: "forensic",
      label: args.side,
      sourceRole: "user",
      sourceText,
    },
    { startOffset, endOffset },
  );

  const slice =
    Number.isInteger(startOffset) &&
    Number.isInteger(endOffset) &&
    startOffset >= 0 &&
    endOffset >= startOffset &&
    endOffset <= sourceText.length
      ? sourceText.slice(startOffset, endOffset)
      : "";

  return {
    probeId: args.probeId,
    caseId: args.caseId,
    side: args.side,
    sourceText,
    sourceLengthUtf16,
    sourceLengthCodePoints,
    utf16EqualsCodePoints: sourceLengthUtf16 === sourceLengthCodePoints,
    startOffset,
    endOffset,
    selectedSpanLength: endOffset - startOffset,
    categoryBeforeEnd: categoryOfCodePoint(charBefore(sourceText, endOffset)),
    categoryAtEnd: categoryOfCodePoint(charAt(sourceText, endOffset)),
    authoritativeSlice: slice,
    validatorOk: lexical ? lexical.ok : false,
    validationCode: lexical && !lexical.ok ? lexical.code : null,
    validationMessage: lexical && !lexical.ok ? lexical.message : null,
    bindOk: bind.ok,
    bindCode: bind.ok ? null : bind.code,
  };
}

export function buildCeqr019AsciiOffsetMatrix(
  cases: readonly LiveSyntheticCase[] = LIVE_SYNTHETIC_CASES,
): OffsetMatrixProbeResult[] {
  const results: OffsetMatrixProbeResult[] = [];

  for (const synthetic of cases) {
    const sides: Array<{ side: "A" | "B"; text: string }> = [
      { side: "A", text: synthetic.sideAText },
      { side: "B", text: synthetic.sideBText },
    ];
    for (const { side, text } of sides) {
      const { wordStart, wordEndExclusive } = finalWordBounds(text);
      const probes: Array<[string, number, number]> = [
        ["complete_source_incl_punct", 0, text.length],
        ["complete_sentence_excl_final_punct", 0, wordEndExclusive],
        ["end_at_source_length", 0, text.length],
        ["end_at_length_minus_1", 0, text.length - 1],
        ["end_at_length_minus_2", 0, text.length - 2],
        ["exact_final_word_end", wordStart, wordEndExclusive],
        ["one_char_inside_final_word", wordStart, wordEndExclusive - 1],
        [
          "one_char_after_final_word",
          wordStart,
          Math.min(text.length, wordEndExclusive + 1),
        ],
        ["zero_length", 5, 5],
        ["reversed", 10, 5],
        ["negative_start", -1, 5],
        ["out_of_range_end", 0, text.length + 1],
      ];

      // Historical CEQR-017 compatible truncation pattern when text matches.
      if (text === "I drink coffee in the morning.") {
        probes.push(["morni_style_truncation", 0, 27]);
      }
      if (text === "I drank several beers last night.") {
        probes.push(["ceqr017_night_truncation", 0, 30]);
      }
      if (text === "Sometimes I think about exercise.") {
        probes.push(["ceqr017_exercise_truncation", 0, 30]);
      }

      for (const [probeId, start, end] of probes) {
        results.push(
          probeOffsetPair({
            probeId,
            caseId: synthetic.id,
            side,
            sourceText: text,
            startOffset: start,
            endOffset: end,
          }),
        );
      }
    }
  }
  return results;
}

export function proveAsciiIndexUnitsMatch(
  cases: readonly LiveSyntheticCase[] = LIVE_SYNTHETIC_CASES,
): Array<{
  caseId: string;
  side: "A" | "B";
  sourceText: string;
  utf16Length: number;
  codePointLength: number;
  equal: boolean;
}> {
  const rows = [];
  for (const synthetic of cases) {
    for (const side of ["A", "B"] as const) {
      const sourceText =
        side === "A" ? synthetic.sideAText : synthetic.sideBText;
      const utf16Length = sourceText.length;
      const codePointLength = [...sourceText].length;
      rows.push({
        caseId: synthetic.id,
        side,
        sourceText,
        utf16Length,
        codePointLength,
        equal: utf16Length === codePointLength,
      });
    }
  }
  return rows;
}

export function hashSyntheticSourceText(sourceText: string): string {
  return createHash("sha256").update(sourceText, "utf8").digest("hex");
}

/**
 * Patterns that reproduce the historical lexical_boundary_integrity mid-word
 * endOffset error on CEQR-019 ASCII sources.
 */
export function patternsReproducingHistoricalLexicalError(
  matrix: OffsetMatrixProbeResult[] = buildCeqr019AsciiOffsetMatrix(),
): OffsetMatrixProbeResult[] {
  return matrix.filter(
    (row) =>
      !row.bindOk &&
      row.bindCode === "lexical_boundary_integrity" &&
      (row.validationMessage ?? "").includes("mid-word truncation"),
  );
}

export function assertCatalogExcludesMidWordOffsets(sourceText: string): {
  midWordOffsets: number[];
  catalogOffsets: number[];
} {
  const catalogOffsets = enumerateValidLexicalBoundaries(sourceText).map(
    (e) => e.offset,
  );
  const midWordOffsets: number[] = [];
  for (let i = 1; i < sourceText.length; i += 1) {
    if (!isValidLexicalBoundaryOffset(sourceText, i)) {
      midWordOffsets.push(i);
    }
  }
  return { midWordOffsets, catalogOffsets };
}
