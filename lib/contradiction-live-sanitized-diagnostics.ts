/**
 * CEQR-012 + CEQR-020 — sanitized adjudication failure diagnostics for live
 * proof receipts.
 *
 * Records validation codes / field paths / lengths / match flags / failed
 * transport offsets (CEQR-020) only.
 * Never records raw provider object, credentials, unrestricted model text,
 * or provider-authored exactQuote as evidence authority.
 *
 * Does NOT claim live-wrapper / prompt-addendum provenance — this helper is
 * also used by the generic same-session selector.
 */

import { createHash } from "crypto";

import type { ContradictionAdjudicationResult } from "./contradiction-adjudicator";
import type { EvidenceSideBindDiagnostic } from "./orvek-intelligence-kernel/evidence-validation";
import type { KernelSourceUnit } from "./orvek-intelligence-kernel/types";

export type SanitizedAdjudicationEarliestGate =
  | "model_execution"
  | "schema_parse"
  | "deterministic_validation"
  | "abstention"
  | "semantic_accepted_referee_eligible"
  | "semantic_accepted_non_class_a"
  | "unknown";

export type EvidenceFailureSide = "sideA" | "sideB" | "both" | "unknown" | null;

export type SanitizedSideOffsetDiagnostics = {
  startBoundaryIndex: number | null;
  endBoundaryIndex: number | null;
  startOffset: number | null;
  endOffset: number | null;
  selectedSpanLength: number | null;
  sourceLengthUtf16: number | null;
  sourceLengthCodePoints: number | null;
  validationCode: string | null;
  validationOk: boolean | null;
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

export type SanitizedAdjudicationDiagnostics = {
  providerId: string | null;
  modelId: string | null;
  schemaVersion: string | null;
  promptVersion: string | null;
  parseValidationOutcome: string | null;
  adjudicationOutcome: ContradictionAdjudicationResult["outcome"] | null;
  adjudicationErrorCode: string | null;
  validationErrorCodes: string[];
  failingFieldPaths: string[];
  /**
   * Side of evidence-span failure(s). Prefers bind diagnostics; falls back to
   * message parsing. `"both"` when A and B fail. `"unknown"` when unlabelled.
   */
  evidenceFailureSide: EvidenceFailureSide;
  sourceTextLengths: {
    sideA: number | null;
    sideB: number | null;
  };
  exactQuoteMatched: {
    sideA: boolean | null;
    sideB: boolean | null;
  };
  offsetsMatched: {
    sideA: boolean | null;
    sideB: boolean | null;
  };
  /** CEQR-020: sanitized failed/resolved offset diagnostics per side. */
  sideOffsetDiagnostics: {
    sideA: SanitizedSideOffsetDiagnostics | null;
    sideB: SanitizedSideOffsetDiagnostics | null;
  };
  /** SHA-256 of authoritative source texts (not raw account text storage). */
  sourceTextHashes: {
    sideA: string | null;
    sideB: string | null;
  };
  /**
   * Stable fingerprint of the raw provider object when present on the
   * adjudication envelope — never the raw object itself.
   */
  rawProviderObjectSha256: string | null;
  earliestGate: SanitizedAdjudicationEarliestGate;
};

const KNOWN_SPAN_CODES = [
  "source_id_mismatch",
  "cross_side_source",
  "invalid_offsets",
  "invalid_boundary_index",
  "empty_quote",
  "fabricated_quote",
  "lexical_boundary_integrity",
  "lexical_boundary_catalog_limit_exceeded",
] as const;

function extractCodeFromError(error: string): string | null {
  const span = KNOWN_SPAN_CODES.find(
    (code) => error.startsWith(`${code}:`) || error.includes(`${code}:`),
  );
  if (span) return span;
  if (error.startsWith("Side A:") || error.startsWith("Side B:")) {
    const rest = error.replace(/^Side [AB]:\s*/, "");
    return extractCodeFromError(rest);
  }
  if (error.startsWith("schema_parse_failed")) return "schema_parse_failed";
  if (error.startsWith("internal_inconsistency")) return "internal_inconsistency";
  if (error.startsWith("Unsupported proposed object type")) {
    return "unsupported_proposed_object_type";
  }
  if (error.startsWith("Invalid classification")) return "invalid_classification";
  if (error.startsWith("Confidence out of range")) return "confidence_out_of_range";
  if (error.includes("qualifications is empty")) {
    return "blank_required_qualifications";
  }
  if (error.includes("normalizedProposition is empty")) {
    return "blank_required_normalized_proposition";
  }
  if (error.includes("actor is empty")) return "blank_required_actor";
  if (error.includes("subject is empty")) return "blank_required_subject";
  if (error.includes("timeframe is empty")) return "blank_required_timeframe";
  if (error.includes("modality is empty")) return "blank_required_modality";
  if (error === "contextAndScope is empty.") return "blank_required_context_and_scope";
  if (error.includes("requires two valid exact evidence spans")) {
    return "clear_contradiction_requires_valid_spans";
  }
  return null;
}

/**
 * Resolve evidence side only when the validator message explicitly names it.
 * Never default unlabelled span failures to Side A.
 */
export function resolveEvidenceFailureSide(error: string): EvidenceFailureSide {
  const code = extractCodeFromError(error);
  const isSpan =
    code != null &&
    (KNOWN_SPAN_CODES as readonly string[]).includes(code);
  if (!isSpan) return null;

  // Cross-side messages explicitly name which claim pointed wrongly.
  if (error.includes("Side A evidence claim must not point at the Side B")) {
    return "sideA";
  }
  if (error.includes("Side B evidence claim must not point at the Side A")) {
    return "sideB";
  }
  if (error.startsWith("Side A:") || /\bSide A\b/i.test(error) || error.includes("evidenceClaimA")) {
    return "sideA";
  }
  if (error.startsWith("Side B:") || /\bSide B\b/i.test(error) || error.includes("evidenceClaimB")) {
    return "sideB";
  }
  return "unknown";
}

function extractFieldPaths(error: string): string[] {
  const paths: string[] = [];
  const propSide = error.match(/Proposition ([AB]) (\w+) is empty/);
  if (propSide) {
    paths.push(`proposition${propSide[1]}.${propSide[2]}`);
  }
  if (error === "contextAndScope is empty.") {
    paths.push("contextAndScope");
  }

  const evidenceSide = resolveEvidenceFailureSide(error);
  if (evidenceSide === "sideA") {
    paths.push("evidenceClaimA");
  } else if (evidenceSide === "sideB") {
    paths.push("evidenceClaimB");
  } else if (evidenceSide === "unknown") {
    paths.push("evidenceClaim");
  }

  if (error.startsWith("internal_inconsistency")) {
    if (error.includes("bothCanSimultaneouslyBeTrue")) {
      paths.push("bothCanSimultaneouslyBeTrue");
    }
    if (error.includes("changedBeliefOverTime")) {
      paths.push("changedBeliefOverTime");
    }
    if (error.includes("intentionVersusOutcome")) {
      paths.push("intentionVersusOutcome");
    }
    if (error.includes("goalVersusObstacle")) {
      paths.push("goalVersusObstacle");
    }
    if (error.includes("emotionalOrPhysiologicalVersusReasoningStandard")) {
      paths.push("emotionalOrPhysiologicalVersusReasoningStandard");
    }
    if (error.includes("abstentionReason")) {
      paths.push("abstentionReason");
    }
  }
  return paths;
}

function deriveQuoteOffsetFlags(errors: string[]): {
  exactQuoteMatched: { sideA: boolean | null; sideB: boolean | null };
  offsetsMatched: { sideA: boolean | null; sideB: boolean | null };
  evidenceFailureSide: EvidenceFailureSide;
} {
  const exactQuoteMatched = {
    sideA: null as boolean | null,
    sideB: null as boolean | null,
  };
  const offsetsMatched = {
    sideA: null as boolean | null,
    sideB: null as boolean | null,
  };
  const sides = new Set<"sideA" | "sideB" | "unknown">();

  for (const error of errors) {
    const code = extractCodeFromError(error);
    const side = resolveEvidenceFailureSide(error);
    if (side === "sideA" || side === "sideB" || side === "unknown") {
      sides.add(side);
    }

    if (side !== "sideA" && side !== "sideB") {
      continue;
    }

    if (code === "fabricated_quote" || code === "empty_quote") {
      exactQuoteMatched[side] = false;
      offsetsMatched[side] = false;
    } else if (
      code === "invalid_offsets" ||
      code === "invalid_boundary_index" ||
      code === "lexical_boundary_integrity"
    ) {
      offsetsMatched[side] = false;
    }
  }

  let evidenceFailureSide: EvidenceFailureSide = null;
  if (sides.has("sideA") && sides.has("sideB")) {
    evidenceFailureSide = "both";
  } else if (sides.has("sideA")) {
    evidenceFailureSide = "sideA";
  } else if (sides.has("sideB")) {
    evidenceFailureSide = "sideB";
  } else if (sides.has("unknown")) {
    evidenceFailureSide = "unknown";
  }

  return { exactQuoteMatched, offsetsMatched, evidenceFailureSide };
}

function resolveEarliestGate(
  adjudication: ContradictionAdjudicationResult,
): SanitizedAdjudicationEarliestGate {
  if (adjudication.outcome === "model_failed") return "model_execution";
  if (adjudication.errorCode === "schema_parse_failed") return "schema_parse";
  if (adjudication.outcome === "validation_failed") {
    return "deterministic_validation";
  }
  if (adjudication.outcome === "abstained") return "abstention";
  if (adjudication.outcome === "semantic_accepted") {
    if (adjudication.semantic?.classification === "clear_contradiction") {
      return "semantic_accepted_referee_eligible";
    }
    return "semantic_accepted_non_class_a";
  }
  return "unknown";
}

function sanitizeSideDiagnostic(
  diag: EvidenceSideBindDiagnostic | undefined,
): SanitizedSideOffsetDiagnostics | null {
  if (!diag) return null;
  return {
    startBoundaryIndex: diag.startBoundaryIndex,
    endBoundaryIndex: diag.endBoundaryIndex,
    startOffset: diag.startOffset,
    endOffset: diag.endOffset,
    selectedSpanLength: diag.selectedSpanLength,
    sourceLengthUtf16: diag.sourceLengthUtf16,
    sourceLengthCodePoints: diag.sourceLengthCodePoints,
    validationCode: diag.validationCode,
    validationOk: diag.validationOk,
    boundaryCategoryBeforeStart: diag.boundaryCategoryBeforeStart,
    boundaryCategoryAtStart: diag.boundaryCategoryAtStart,
    boundaryCategoryBeforeEnd: diag.boundaryCategoryBeforeEnd,
    boundaryCategoryAtEnd: diag.boundaryCategoryAtEnd,
    splitsSurrogateAtStart: diag.splitsSurrogateAtStart,
    splitsSurrogateAtEnd: diag.splitsSurrogateAtEnd,
    endOffsetInsideAlphanumericWord: diag.endOffsetInsideAlphanumericWord,
    startOffsetInsideAlphanumericWord: diag.startOffsetInsideAlphanumericWord,
    exactQuoteWouldEqualAuthoritativeSlice:
      diag.exactQuoteWouldEqualAuthoritativeSlice,
  };
}

function hashSourceText(text: string | null | undefined): string | null {
  if (text == null) return null;
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Build receipt-safe diagnostics from a landed adjudication result.
 * Does not include exact quotes, propositions, rationale, or raw provider JSON.
 * Does not claim live prompt-addendum provenance.
 *
 * `rawProviderObjectSha256` is taken from the adjudication result only
 * (runtime-wired by `adjudicateContradiction`). Callers cannot inject a
 * fingerprint override as diagnostic authority.
 */
export function buildSanitizedAdjudicationDiagnostics(args: {
  adjudication: ContradictionAdjudicationResult;
  sideA?: KernelSourceUnit | null;
  sideB?: KernelSourceUnit | null;
}): SanitizedAdjudicationDiagnostics {
  const { adjudication } = args;
  const errors = adjudication.validation.errors ?? [];
  const codes = [
    ...new Set(
      errors
        .map((e) => extractCodeFromError(e))
        .filter((c): c is string => c != null),
    ),
  ];
  if (
    adjudication.errorCode != null &&
    !codes.includes(adjudication.errorCode)
  ) {
    codes.push(adjudication.errorCode);
  }
  const failingFieldPaths = [
    ...new Set(errors.flatMap((e) => extractFieldPaths(e))),
  ];
  const { exactQuoteMatched, offsetsMatched, evidenceFailureSide: fromErrors } =
    deriveQuoteOffsetFlags(errors);

  const bindDiags = adjudication.evidenceBindDiagnostics ?? [];
  const sideADiag = bindDiags.find((d) => d.side === "A");
  const sideBDiag = bindDiags.find((d) => d.side === "B");

  let evidenceFailureSide = fromErrors;
  if (sideADiag || sideBDiag) {
    const aFail = sideADiag != null && !sideADiag.validationOk;
    const bFail = sideBDiag != null && !sideBDiag.validationOk;
    if (aFail && bFail) evidenceFailureSide = "both";
    else if (aFail) evidenceFailureSide = "sideA";
    else if (bFail) evidenceFailureSide = "sideB";
  }

  // Enrich offsetsMatched from bind diagnostics.
  if (sideADiag && !sideADiag.validationOk) {
    offsetsMatched.sideA = false;
  }
  if (sideBDiag && !sideBDiag.validationOk) {
    offsetsMatched.sideB = false;
  }

  return {
    providerId: adjudication.audit.providerId,
    modelId: adjudication.audit.modelId,
    schemaVersion: adjudication.audit.schemaVersion,
    promptVersion: adjudication.audit.promptVersion,
    parseValidationOutcome: adjudication.audit.parseValidationOutcome,
    adjudicationOutcome: adjudication.outcome,
    adjudicationErrorCode: adjudication.errorCode,
    validationErrorCodes: codes,
    failingFieldPaths,
    evidenceFailureSide,
    sourceTextLengths: {
      sideA: args.sideA ? args.sideA.sourceText.length : null,
      sideB: args.sideB ? args.sideB.sourceText.length : null,
    },
    exactQuoteMatched,
    offsetsMatched,
    sideOffsetDiagnostics: {
      sideA: sanitizeSideDiagnostic(sideADiag),
      sideB: sanitizeSideDiagnostic(sideBDiag),
    },
    sourceTextHashes: {
      sideA: hashSourceText(args.sideA?.sourceText),
      sideB: hashSourceText(args.sideB?.sourceText),
    },
    rawProviderObjectSha256: adjudication.rawProviderObjectSha256,
    earliestGate: resolveEarliestGate(adjudication),
  };
}

/**
 * Prefer the first rejection summary that carries diagnostics.
 */
export function pickSanitizedDiagnosticsFromRejectionSummaries(
  summaries: Array<{
    sanitizedDiagnostics?: SanitizedAdjudicationDiagnostics | null;
  }>,
): SanitizedAdjudicationDiagnostics | null {
  for (const summary of summaries) {
    if (summary.sanitizedDiagnostics) return summary.sanitizedDiagnostics;
  }
  return null;
}

// Re-export fingerprint helpers for tests/receipts that need the canonicalizer.
export {
  fingerprintRawProviderObject,
  fingerprintRawProviderObjectSha256OrNull,
  canonicalizeJsonForFingerprint,
} from "./contradiction-provider-object-fingerprint";
