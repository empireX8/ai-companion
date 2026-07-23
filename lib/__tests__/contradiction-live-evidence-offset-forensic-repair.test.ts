/**
 * CEQR-020 — offline live-evidence-offset forensic repair tests.
 * Deterministic only. No live provider. No account/DB/writer.
 */

import { createHash } from "crypto";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  buildContradictionAdjudicationPrompt,
} from "../contradiction-adjudicator";
import {
  CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES,
  CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256,
  CEQR_019_LIVE_ONESHOT_CLAIM_BYTES,
  CEQR_019_LIVE_ONESHOT_CLAIM_SHA256,
  CEQR_019_LIVE_PROVIDER_ATTEMPTS,
  CEQR_019_LIVE_RESULT_CLASSIFICATION,
  CEQR_019_PERMANENT_CLAIM_BYTES,
  CEQR_019_PERMANENT_CLAIM_SHA256,
  CEQR_019_SLICE_ID,
  CEQR_019_SYNTHETIC_CASES,
} from "../contradiction-controlled-live-semantic-reproof";
import {
  CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION,
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  createOpenAiContradictionLiveAdapters,
} from "../contradiction-live-provider-adapters";
import {
  buildSanitizedAdjudicationDiagnostics,
  fingerprintRawProviderObject,
} from "../contradiction-live-sanitized-diagnostics";
import {
  selectSameSessionContradictionPair,
  type SideACandidate,
} from "../contradiction-same-session-selection";
import {
  assertCatalogExcludesMidWordOffsets,
  buildCeqr019AsciiOffsetMatrix,
  CEQR_020_CAMPAIGN_SLICE,
  CEQR_020_SLICE_ID,
  patternsReproducingHistoricalLexicalError,
  proveAsciiIndexUnitsMatch,
} from "../ceqr020-offset-forensics";
import {
  CEQR_020_FORENSIC_MODULE_BASENAME,
  cleanupImportProbeDir,
  proveIsolationScannerDetectsInjectedImport,
  scanProductionRootsForImportNeedle,
} from "../ceqr020-production-import-isolation";
import {
  bindDualSideEvidenceClaims,
  bindExactEvidenceClaimFromBoundarySelection,
  bindExactEvidenceClaimFromOffsets,
  boundarySelectionForFullSource,
  boundarySelectionForOffsets,
  buildEvidenceSideBindDiagnostic,
  checkLexicalBoundaryCatalogLimits,
  enumerateValidLexicalBoundaries,
  enumerateValidLexicalBoundariesBounded,
  evidenceSpanSelectionSchema,
  formatLexicalBoundaryCatalogForPrompt,
  hashSourceTextSha256,
  inspectLexicalOffsetIndependently,
  KERNEL_FIRST_PROOF_OBJECT,
  LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
  LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16,
  resolveBoundaryIndexSelection,
  validateLexicalBoundaryIntegrity,
  type KernelSourceUnit,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import { transportSelectionForFullSource } from "./helpers/ceqr020-transport-selection";

const FIXED_NOW = () => new Date("2026-07-23T12:00:00.000Z");
const CEQR019_RECEIPT_DIR = join(
  process.cwd(),
  "docs/agent-runs/receipts",
  CEQR_019_SLICE_ID,
);

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? `session-${partial.sourceId}`,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    ...partial,
  };
}

function clearTransport(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    propositionA: {
      normalizedProposition: "Speaker does not drink alcohol",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Speaker drank beers last night",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker alcohol claims",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.9,
    evidenceClaimA: transportSelectionForFullSource(sideA.sourceText),
    evidenceClaimB: transportSelectionForFullSource(sideB.sourceText),
    rationale: "Conflict under matching scope.",
    alternativeInterpretation: "Belief change.",
    whatWouldChangeClassification: "Explicit timeframe separation.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...overrides,
  };
}

function compatibleTransport(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): Record<string, unknown> {
  return {
    ...clearTransport(sideA, sideB),
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    rationale: "Different timeframes.",
  };
}

function fakeRunner(object: unknown): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: true as const,
        object,
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("CEQR-020 identities and offline isolation", () => {
  it("25–27. live guards unset; injectable offline adapter only", async () => {
    expect(CEQR_020_CAMPAIGN_SLICE).toBe("CEQR-020");
    expect(CEQR_020_SLICE_ID).toContain("OFFSET-FORENSIC");
    expect(process.env[CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]).toBeUndefined();
    expect(process.env.CEQR019_LIVE_SEMANTIC_REPROOF_AUTHORIZED).toBeUndefined();

    let languageModelConstructions = 0;
    await createOpenAiContradictionLiveAdapters({
      adjudicatorModelId: "gpt-4o-mini",
      refereeModelId: "gpt-4o-mini",
      timeoutMs: 1,
      maxTotalCalls: 1,
      createLanguageModel: async () => {
        languageModelConstructions += 1;
        return { __fake: true };
      },
      createRunner: () => ({
        async runStructured() {
          throw new Error("CEQR-020 tests must not invoke live runners");
        },
      }),
    });
    expect(languageModelConstructions).toBe(2);
  });

  it("23–24. CEQR-019 one-shot claim and live receipt remain immutable", () => {
    const claimPath = join(CEQR019_RECEIPT_DIR, "live-run-oneshot-claim.json");
    const livePath = join(CEQR019_RECEIPT_DIR, "live-execution-receipt.json");
    const permPath = join(CEQR019_RECEIPT_DIR, "ceqr019-permanent-claim.json");
    expect(sha256File(claimPath)).toBe(CEQR_019_LIVE_ONESHOT_CLAIM_SHA256);
    expect(statSync(claimPath).size).toBe(CEQR_019_LIVE_ONESHOT_CLAIM_BYTES);
    expect(sha256File(livePath)).toBe(CEQR_019_LIVE_EXECUTION_RECEIPT_SHA256);
    expect(statSync(livePath).size).toBe(CEQR_019_LIVE_EXECUTION_RECEIPT_BYTES);
    expect(sha256File(permPath)).toBe(CEQR_019_PERMANENT_CLAIM_SHA256);
    expect(statSync(permPath).size).toBe(CEQR_019_PERMANENT_CLAIM_BYTES);
    const live = JSON.parse(readFileSync(livePath, "utf8")) as {
      classification: string;
      liveProviderAttempts: number;
    };
    expect(live.classification).toBe(CEQR_019_LIVE_RESULT_CLASSIFICATION);
    expect(live.liveProviderAttempts).toBe(CEQR_019_LIVE_PROVIDER_ATTEMPTS);
  });

  it("BLOCKER 3: import isolation distinguishes clean / matches / tool failure", () => {
    const scan = scanProductionRootsForImportNeedle({
      cwd: process.cwd(),
      needle: CEQR_020_FORENSIC_MODULE_BASENAME,
    });
    expect(scan.status).toBe("clean");

    const probe = proveIsolationScannerDetectsInjectedImport({
      cwd: process.cwd(),
    });
    try {
      expect(probe.status).toBe("matches");
      if (probe.status === "matches") {
        expect(probe.paths.length).toBeGreaterThan(0);
      }
    } finally {
      cleanupImportProbeDir(probe.probeDir);
    }
  });
});

describe("CEQR-020 ASCII index-unit + matrix", () => {
  const matrix = buildCeqr019AsciiOffsetMatrix(CEQR_019_SYNTHETIC_CASES);

  it("UTF-16 equals code-point for every CEQR-019 source", () => {
    for (const row of proveAsciiIndexUnitsMatch(CEQR_019_SYNTHETIC_CASES)) {
      expect(row.equal).toBe(true);
    }
  });

  it("matrix: full sentence / excl punct / final word pass; morni fails", () => {
    for (const row of matrix.filter((r) =>
      [
        "complete_source_incl_punct",
        "complete_sentence_excl_final_punct",
        "exact_final_word_end",
      ].includes(r.probeId),
    )) {
      expect(row.bindOk).toBe(true);
    }
    const morni = matrix.find((r) => r.probeId === "morni_style_truncation");
    expect(morni?.bindOk).toBe(false);
    expect(morni?.bindCode).toBe("lexical_boundary_integrity");
    expect(patternsReproducingHistoricalLexicalError(matrix).length).toBeGreaterThan(
      0,
    );
  });
});

describe("CEQR-020 validator audit", () => {
  const morning = "I drink coffee in the morning.";

  it("mid-word start/end fail; exclusive end before punct passes", () => {
    expect(validateLexicalBoundaryIntegrity(morning, 4, morning.length).ok).toBe(
      false,
    );
    expect(validateLexicalBoundaryIntegrity(morning, 0, 27).ok).toBe(false);
    expect(validateLexicalBoundaryIntegrity(morning, 0, 29).ok).toBe(true);
  });

  it("surrogate / astral / combining-mark policy preserved", () => {
    const astral = "I like 𝄞 music.";
    const highIndex = astral.indexOf("𝄞") + 1;
    expect(validateLexicalBoundaryIntegrity(astral, 0, highIndex).ok).toBe(false);
    const combining = "e\u0301nd";
    expect(validateLexicalBoundaryIntegrity(combining, 1, combining.length).ok).toBe(
      false,
    );
  });
});

describe("CEQR-020 BLOCKER 1 — runtime-wired raw provider fingerprint", () => {
  it("adjudicateContradiction → same-session rejection → diagnostics auto fingerprint", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
      sessionId: "sess-1",
      messageId: "msg-a",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "sess-1",
      messageId: "msg-b",
    });
    const providerObject = clearTransport(sideA, sideB, {
      evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 9999 },
    });
    const expected = fingerprintRawProviderObject(providerObject);
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;

    const candidate: SideACandidate = {
      sideA,
      referenceId: "ref-1",
    };

    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [candidate],
      modelRunner: fakeRunner(providerObject),
      now: FIXED_NOW,
    });

    expect(selection.outcome).toBe("adjudication_failed");
    expect(selection.modelCallCount).toBe(1);
    const summary = selection.rejectionSummaries[0];
    expect(summary?.sanitizedDiagnostics).toBeTruthy();
    const diag = summary!.sanitizedDiagnostics!;
    expect(diag.rawProviderObjectSha256).toBe(expected.sha256);
    expect(diag.rawProviderObjectSha256).toMatch(/^[a-f0-9]{64}$/);

    const serialized = JSON.stringify(diag);
    expect(serialized).not.toContain(sideA.sourceText);
    expect(serialized).not.toContain("Conflict under matching scope");
    expect(serialized).not.toMatch(/sk-|OPENAI_API_KEY|password/i);
    expect(serialized).not.toContain('"propositionA"');
    // No raw provider object embedded.
    expect(serialized).not.toContain('"evidenceClaimA":{"startBoundaryIndex"');
  });

  it("schema-parse failure still preserves runtime fingerprint", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    const malformed = { not: "a valid transport" };
    const expected = fingerprintRawProviderObject(malformed);
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(malformed),
      now: FIXED_NOW,
    });
    expect(result.errorCode).toBe("schema_parse_failed");
    expect(result.rawProviderObjectSha256).toBe(expected.sha256);

    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication: result,
      sideA,
      sideB,
    });
    expect(diag.rawProviderObjectSha256).toBe(expected.sha256);
  });

  it("fingerprint fails closed on undefined rather than hashing", () => {
    const result = fingerprintRawProviderObject(undefined);
    expect(result.ok).toBe(false);
  });
});

describe("CEQR-020 BLOCKER 2 — resolved offsets retained on invalid span", () => {
  const text = "I drink coffee in the morning.";

  it("equal valid indices record offsets and span length 0", () => {
    const catalog = enumerateValidLexicalBoundaries(text);
    const mid = Math.floor(catalog.length / 2);
    const selection = {
      startBoundaryIndex: mid,
      endBoundaryIndex: mid,
    };
    const resolved = resolveBoundaryIndexSelection(text, selection);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.resolveKind).toBe("resolved_invalid_span");
    if (resolved.resolveKind !== "resolved_invalid_span") return;
    expect(resolved.startOffset).toBe(catalog[mid]!.offset);
    expect(resolved.endOffset).toBe(catalog[mid]!.offset);

    const attempt = bindExactEvidenceClaimFromBoundarySelection(
      source({ sourceId: "t", label: "T", sourceText: text }),
      selection,
    );
    expect(attempt.bind.ok).toBe(false);
    expect(attempt.resolved).toEqual({
      startOffset: catalog[mid]!.offset,
      endOffset: catalog[mid]!.offset,
    });
    const dual = bindDualSideEvidenceClaims({
      selectionA: selection,
      selectionB: boundarySelectionForFullSource(text),
      sourceA: source({ sourceId: "a", label: "A", sourceText: text }),
      sourceB: source({ sourceId: "b", label: "B", sourceText: text }),
    });
    expect(dual.ok).toBe(false);
    if (dual.ok) return;
    expect(dual.sideDiagnostics[0]!.startOffset).toBe(catalog[mid]!.offset);
    expect(dual.sideDiagnostics[0]!.endOffset).toBe(catalog[mid]!.offset);
    expect(dual.sideDiagnostics[0]!.selectedSpanLength).toBe(0);
  });

  it("reversed valid indices record both offsets and negative span length", () => {
    const catalog = enumerateValidLexicalBoundaries(text);
    const selection = {
      startBoundaryIndex: catalog.length - 1,
      endBoundaryIndex: 0,
    };
    const resolved = resolveBoundaryIndexSelection(text, selection);
    expect(resolved.ok).toBe(false);
    if (resolved.ok || resolved.resolveKind !== "resolved_invalid_span") return;
    expect(resolved.startOffset).toBe(catalog[catalog.length - 1]!.offset);
    expect(resolved.endOffset).toBe(catalog[0]!.offset);
    expect(resolved.endOffset - resolved.startOffset).toBeLessThan(0);

    const dual = bindDualSideEvidenceClaims({
      selectionA: selection,
      selectionB: boundarySelectionForFullSource(text),
      sourceA: source({ sourceId: "a", label: "A", sourceText: text }),
      sourceB: source({ sourceId: "b", label: "B", sourceText: text }),
    });
    expect(dual.ok).toBe(false);
    if (dual.ok) return;
    expect(dual.sideDiagnostics[0]!.selectedSpanLength).toBeLessThan(0);
    expect(dual.sideErrors.some((e) => e.startsWith("Side A:"))).toBe(true);
  });

  it("out-of-range indices preserve raw indices but leave offsets null", () => {
    const selection = { startBoundaryIndex: 0, endBoundaryIndex: 9999 };
    const resolved = resolveBoundaryIndexSelection(text, selection);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.resolveKind).toBe("unresolved_indices");
    expect(resolved.startBoundaryIndex).toBe(0);
    expect(resolved.endBoundaryIndex).toBe(9999);
    expect(resolved.startOffset).toBeNull();
    expect(resolved.endOffset).toBeNull();

    const attempt = bindExactEvidenceClaimFromBoundarySelection(
      source({ sourceId: "t", label: "T", sourceText: text }),
      selection,
    );
    expect(attempt.resolved).toBeNull();
  });

  it("mixed A/B failures identify both; no clamp/swap", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I avoid coffee in the evening.",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drink coffee in the morning.",
    });
    const catalogA = enumerateValidLexicalBoundaries(sideA.sourceText);
    const providerObject = clearTransport(sideA, sideB, {
      evidenceClaimA: {
        startBoundaryIndex: Math.floor(catalogA.length / 2),
        endBoundaryIndex: Math.floor(catalogA.length / 2),
      },
      evidenceClaimB: { startBoundaryIndex: 0, endBoundaryIndex: 9999 },
    });
    const snap = structuredClone(providerObject);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(providerObject),
      now: FIXED_NOW,
    });
    expect(providerObject).toEqual(snap);
    expect(result.outcome).toBe("validation_failed");
    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication: result,
      sideA,
      sideB,
    });
    expect(diag.evidenceFailureSide).toBe("both");
    expect(diag.sideOffsetDiagnostics.sideA?.selectedSpanLength).toBe(0);
    expect(diag.sideOffsetDiagnostics.sideA?.startOffset).not.toBeNull();
    expect(diag.sideOffsetDiagnostics.sideB?.startOffset).toBeNull();
    expect(diag.sideOffsetDiagnostics.sideB?.startBoundaryIndex).toBe(0);
    expect(diag.sideOffsetDiagnostics.sideB?.endBoundaryIndex).toBe(9999);
  });
});

describe("CEQR-020 remaining BLOCKER 1 — pre-enumeration source + bounded entry gates", () => {
  it("1e6 UTF-16 source is rejected before enumeration; catalogComputation skipped", async () => {
    const huge = "x".repeat(1_000_000);
    expect(huge.length).toBe(1_000_000);
    const expectedHash = hashSourceTextSha256(huge);

    const check = checkLexicalBoundaryCatalogLimits({
      sideAText: huge,
      sideBText: "ok.",
    });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.sideA.catalogComputation).toBe("skipped_source_over_limit");
    expect(check.sideA.catalogLength).toBeNull();
    expect(check.sideA.sourceLengthUtf16).toBe(1_000_000);
    expect(check.sideA.sourceSha256).toBe(expectedHash);
    expect(check.sideA.sourceOverLimit).toBe(true);
    expect(check).not.toHaveProperty("sideACatalog");

    let providerCalls = 0;
    const result = await adjudicateContradiction({
      sideA: source({ sourceId: "a", label: "A", sourceText: huge }),
      sideB: source({
        sourceId: "b",
        label: "B",
        sourceText: "I drank several beers last night.",
      }),
      modelRunner: {
        async runStructured() {
          providerCalls += 1;
          throw new Error("must not be called");
        },
      },
      now: FIXED_NOW,
    });
    expect(providerCalls).toBe(0);
    expect(result.outcome).toBe("validation_failed");
    expect(result.errorMessage).toContain("skipped_source_over_limit");
    expect(JSON.stringify(result)).not.toContain(huge.slice(0, 64));
  });

  it("exact source limit passes; source limit + 1 fails before enumeration", () => {
    const at = "x".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16);
    const over = "x".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 + 1);
    const atCheck = checkLexicalBoundaryCatalogLimits({
      sideAText: at,
      sideBText: "ok.",
    });
    expect(atCheck.ok).toBe(true);
    if (atCheck.ok) {
      expect(atCheck.sideA.catalogComputation).toBe("computed");
      expect(atCheck.sideA.catalogLength).toBe(2);
    }

    const overCheck = checkLexicalBoundaryCatalogLimits({
      sideAText: over,
      sideBText: "ok.",
    });
    expect(overCheck.ok).toBe(false);
    if (overCheck.ok) return;
    expect(overCheck.sideA.catalogComputation).toBe("skipped_source_over_limit");
    expect(overCheck.sideA.catalogLength).toBeNull();
  });

  it("exact entry limit passes; entry limit + 1 stops at bounded sentinel", () => {
    const exactEntries = ".".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES - 1);
    const exactBounded = enumerateValidLexicalBoundariesBounded(
      exactEntries,
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
    );
    expect(exactBounded.stoppedEarly).toBe(false);
    expect(exactBounded.catalog.length).toBe(LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES);
    const exactCheck = checkLexicalBoundaryCatalogLimits({
      sideAText: exactEntries,
      sideBText: "ok.",
    });
    expect(exactCheck.ok).toBe(true);

    const overEntries = ".".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES);
    const overBounded = enumerateValidLexicalBoundariesBounded(
      overEntries,
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
    );
    expect(overBounded.stoppedEarly).toBe(true);
    expect(overBounded.catalog.length).toBe(
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES + 1,
    );
    const overCheck = checkLexicalBoundaryCatalogLimits({
      sideAText: overEntries,
      sideBText: "ok.",
    });
    expect(overCheck.ok).toBe(false);
    if (overCheck.ok) return;
    expect(overCheck.sideA.catalogComputation).toBe("stopped_entry_over_limit");
    expect(overCheck.sideA.catalogLength).toBe(
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES + 1,
    );
    expect(overCheck).not.toHaveProperty("sideACatalog");
  });

  it("formatter requires a prevalidated catalog; no hidden default enumeration", () => {
    const text = "I drink coffee.";
    const catalog = enumerateValidLexicalBoundaries(text);
    expect(() =>
      formatLexicalBoundaryCatalogForPrompt("A", text, catalog),
    ).not.toThrow();
    expect(() =>
      formatLexicalBoundaryCatalogForPrompt(
        "A",
        text,
        undefined as unknown as [],
      ),
    ).toThrow();
  });

  it("one-over-limit source fails closed with zero provider calls", async () => {
    const over = "x".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 + 1);
    const sideA = source({ sourceId: "a", label: "A", sourceText: over });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    let providerCalls = 0;
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          providerCalls += 1;
          throw new Error("must not be called");
        },
      },
      now: FIXED_NOW,
    });
    expect(providerCalls).toBe(0);
    expect(result.outcome).toBe("validation_failed");
    expect(result.errorMessage).toContain("lexical_boundary_catalog_limit_exceeded");
    expect(result.rawProviderObjectSha256).toBeNull();
    expect(result.semantic).toBeNull();
    expect(result.persistenceDecision).toBeNull();

    const diag = buildSanitizedAdjudicationDiagnostics({
      adjudication: result,
      sideA,
      sideB,
    });
    expect(diag.validationErrorCodes).toContain(
      "lexical_boundary_catalog_limit_exceeded",
    );
    expect(JSON.stringify(diag)).not.toContain(over);
  });

  it("punctuation-heavy and whitespace-heavy over-entry sources fail closed", async () => {
    const punctHeavy = ".".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES);
    expect(
      enumerateValidLexicalBoundariesBounded(
        punctHeavy,
        LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
      ).stoppedEarly,
    ).toBe(true);
    const spaceHeavy = Array.from(
      { length: LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES },
      () => "x",
    ).join(" ");
    expect(
      enumerateValidLexicalBoundariesBounded(
        spaceHeavy,
        LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
      ).stoppedEarly,
    ).toBe(true);

    for (const heavy of [punctHeavy, spaceHeavy]) {
      let calls = 0;
      const result = await adjudicateContradiction({
        sideA: source({ sourceId: "a", label: "A", sourceText: heavy }),
        sideB: source({
          sourceId: "b",
          label: "B",
          sourceText: "I drank several beers last night.",
        }),
        modelRunner: {
          async runStructured() {
            calls += 1;
            return {
              ok: true as const,
              object: {},
              providerId: "x",
              modelId: "y",
              rawText: null,
            };
          },
        },
        now: FIXED_NOW,
      });
      expect(calls).toBe(0);
      expect(result.outcome).toBe("validation_failed");
      expect(result.errorMessage).toContain("stopped_entry_over_limit");
    }
  });

  it("in-bound prompt catalogs are deterministically sized", () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: CEQR_019_SYNTHETIC_CASES[0]!.sideAText,
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: CEQR_019_SYNTHETIC_CASES[0]!.sideBText,
    });
    const limits = checkLexicalBoundaryCatalogLimits({
      sideAText: sideA.sourceText,
      sideBText: sideB.sourceText,
    });
    expect(limits.ok).toBe(true);
    if (!limits.ok) return;
    const { prompt } = buildContradictionAdjudicationPrompt(sideA, sideB, {
      sideACatalog: limits.sideACatalog,
      sideBCatalog: limits.sideBCatalog,
    });
    expect(prompt).toContain(`catalogLength=${limits.sideACatalog.length}`);
    expect(prompt).toContain(`catalogLength=${limits.sideBCatalog.length}`);
    expect(limits.sideACatalog.length).toBeLessThanOrEqual(
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
    );
    expect(limits.sideBCatalog.length).toBeLessThanOrEqual(
      LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES,
    );
  });
});

describe("CEQR-020 remaining BLOCKER 2 — same-session modelCallCount is actual runStructured", () => {
  it("over-source-limit candidate: attempted=1, modelCallCount=0, runner=0", async () => {
    const over = "x".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 + 1);
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: over,
      sessionId: "s",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "s",
    });
    let runnerCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA, referenceId: "r1" }],
      modelRunner: {
        async runStructured() {
          runnerCalls += 1;
          throw new Error("must not run");
        },
      },
      now: FIXED_NOW,
    });
    expect(selection.attemptedAdjudications).toHaveLength(1);
    expect(selection.modelCallCount).toBe(0);
    expect(runnerCalls).toBe(0);
    expect(selection.selectedPair).toBeNull();
  });

  it("over-entry-limit candidate: same zero-call contract", async () => {
    const heavy = ".".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES);
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: heavy,
      sessionId: "s",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "s",
    });
    let runnerCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA, referenceId: "r1" }],
      modelRunner: {
        async runStructured() {
          runnerCalls += 1;
          return {
            ok: true as const,
            object: {},
            providerId: "x",
            modelId: "y",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });
    expect(selection.attemptedAdjudications).toHaveLength(1);
    expect(selection.modelCallCount).toBe(0);
    expect(runnerCalls).toBe(0);
  });

  it("valid provider attempt: modelCallCount=1 and runner=1", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
      sessionId: "s",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "s",
    });
    let runnerCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA, referenceId: "r1" }],
      modelRunner: {
        async runStructured() {
          runnerCalls += 1;
          return {
            ok: true as const,
            object: clearTransport(sideA, sideB),
            providerId: "x",
            modelId: "y",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });
    expect(selection.modelCallCount).toBe(1);
    expect(runnerCalls).toBe(1);
    expect(selection.attemptedAdjudications).toHaveLength(1);
  });

  it("provider failure after invocation keeps modelCallCount=1", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
      sessionId: "s",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "s",
    });
    let runnerCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA, referenceId: "r1" }],
      modelRunner: {
        async runStructured() {
          runnerCalls += 1;
          return {
            ok: false as const,
            errorCode: "model_execution_failed" as const,
            message: "boom",
            providerId: "x",
            modelId: "y",
          };
        },
      },
      now: FIXED_NOW,
    });
    expect(runnerCalls).toBe(1);
    expect(selection.modelCallCount).toBe(1);
    expect(selection.outcome).toBe("model_failed");
  });

  it("mixed: one preflight-blocked + one provider invoke → attempts=2, modelCallCount=1", async () => {
    const over = "x".repeat(LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16 + 1);
    const okA = source({
      sourceId: "ok",
      label: "OK",
      sourceText: "I do not drink alcohol at all.",
      sessionId: "s",
    });
    const blockedA = source({
      sourceId: "blocked",
      label: "Blocked",
      sourceText: over,
      sessionId: "s",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
      sessionId: "s",
    });
    let runnerCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: blockedA, referenceId: "r-blocked" },
        { sideA: okA, referenceId: "r-ok" },
      ],
      modelRunner: {
        async runStructured() {
          runnerCalls += 1;
          return {
            ok: true as const,
            object: clearTransport(okA, sideB),
            providerId: "x",
            modelId: "y",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });
    expect(selection.attemptedAdjudications).toHaveLength(2);
    expect(selection.modelCallCount).toBe(1);
    expect(runnerCalls).toBe(1);
  });
});

describe("CEQR-020 remaining BLOCKER 3 — independent start/end boundary diagnostics", () => {
  function sideDiag(
    text: string,
    startOffset: number,
    endOffset: number,
  ) {
    const side = source({ sourceId: "s", label: "S", sourceText: text });
    return buildEvidenceSideBindDiagnostic({
      side: "A",
      source: side,
      selection: { startBoundaryIndex: 0, endBoundaryIndex: 1 },
      bind: {
        ok: false,
        code: "lexical_boundary_integrity",
        message: "test",
      },
      resolved: { startOffset, endOffset },
    });
  }

  it("start inside word, end valid", () => {
    const text = "I drink coffee in the morning.";
    const diag = sideDiag(text, 4, text.length);
    expect(diag.startOffsetInsideAlphanumericWord).toBe(true);
    expect(diag.endOffsetInsideAlphanumericWord).toBe(false);
    expect(diag.boundaryCategoryAtStart).toBe("inside_word_token");
    expect(diag.boundaryCategoryAtEnd).toBe("source_edge");
    expect(JSON.stringify(diag)).not.toContain(text);
  });

  it("start valid, end inside word", () => {
    const text = "I drink coffee in the morning.";
    const diag = sideDiag(text, 0, 27);
    expect(diag.startOffsetInsideAlphanumericWord).toBe(false);
    expect(diag.endOffsetInsideAlphanumericWord).toBe(true);
    expect(diag.boundaryCategoryAtEnd).toBe("inside_word_token");
  });

  it("both start and end inside words", () => {
    const text = "I drink coffee in the morning.";
    const diag = sideDiag(text, 4, 27);
    expect(diag.startOffsetInsideAlphanumericWord).toBe(true);
    expect(diag.endOffsetInsideAlphanumericWord).toBe(true);
  });

  it("start and end surrogate splits are independent", () => {
    const astral = "a\u{1F600}b";
    const startSplit = inspectLexicalOffsetIndependently(astral, 2);
    expect(startSplit.splitsSurrogate).toBe(true);
    expect(startSplit.insideAlphanumericWord).toBe(false);

    const diagStart = sideDiag(astral, 2, astral.length);
    expect(diagStart.splitsSurrogateAtStart).toBe(true);
    expect(diagStart.splitsSurrogateAtEnd).toBe(false);

    const diagEnd = sideDiag(astral, 0, 2);
    expect(diagEnd.splitsSurrogateAtStart).toBe(false);
    expect(diagEnd.splitsSurrogateAtEnd).toBe(true);
  });

  it("combining-mark start and end cases are independent", () => {
    const combining = "cafe\u0301X";
    const betweenBaseAndMark = "cafe".length;
    const startInsp = inspectLexicalOffsetIndependently(
      combining,
      betweenBaseAndMark,
    );
    expect(startInsp.combiningMarkBoundaryFailure).toBe(true);
    expect(startInsp.insideAlphanumericWord).toBe(false);

    const diag = sideDiag(combining, betweenBaseAndMark, combining.length);
    expect(diag.startOffsetInsideAlphanumericWord).toBe(false);
    expect(diag.endOffsetInsideAlphanumericWord).toBe(false);
    expect(diag.boundaryCategoryAtStart).toBe("inside_word_token");
    expect(diag.boundaryCategoryAtEnd).toBe("source_edge");
  });

  it("categories and boolean fields remain mutually consistent; no quote leakage", () => {
    const text = "I drink coffee.";
    const mid = 4;
    const insp = inspectLexicalOffsetIndependently(text, mid);
    expect(insp.insideAlphanumericWord).toBe(true);
    expect(insp.category).toBe("inside_word_token");
    expect(insp.inRange).toBe(true);
    expect(insp.isSourceEdge).toBe(false);
    const diag = sideDiag(text, mid, text.length);
    expect(diag.startOffsetInsideAlphanumericWord).toBe(true);
    expect(diag.boundaryCategoryAtStart).toBe("inside_word_token");
    expect(JSON.stringify(diag)).not.toContain("drink");
    expect(diag).not.toHaveProperty("exactQuote");
    expect(JSON.stringify(diag)).not.toMatch(/"exactQuote"\s*:/);
  });
});

describe("CEQR-020 transport + write isolation", () => {
  it("schema uses nonnegative int indices; mid-word absent from catalog", () => {
    expect(Object.keys(evidenceSpanSelectionSchema.shape).sort()).toEqual([
      "endBoundaryIndex",
      "startBoundaryIndex",
    ]);
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v4",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION).toBe(
      "contradiction-adjudication-prompt-v4",
    );
    expect(CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION).toBe(
      "contradiction-live-adjudicator-prompt-addendum-v4",
    );
    const text = "I drink coffee in the morning.";
    expect(boundarySelectionForOffsets(text, 0, 27)).toBeNull();
    expect(assertCatalogExcludesMidWordOffsets(text).midWordOffsets).toContain(
      27,
    );
  });

  it("prompt documents resolved-offset and ordered-index rules", () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    const limits = checkLexicalBoundaryCatalogLimits({
      sideAText: sideA.sourceText,
      sideBText: sideB.sourceText,
    });
    expect(limits.ok).toBe(true);
    if (!limits.ok) return;
    const { system } = buildContradictionAdjudicationPrompt(sideA, sideB, {
      sideACatalog: limits.sideACatalog,
      sideBCatalog: limits.sideBCatalog,
    });
    expect(system).toContain(
      "resolved end offset must be greater than the resolved start offset",
    );
    expect(system).toContain(
      "endBoundaryIndex must be greater than startBoundaryIndex",
    );
  });

  it("malformed/compatible cannot reach referee/writer", async () => {
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: "I do not drink alcohol at all.",
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    let refereeCalls = 0;
    const referee = {
      async evaluate() {
        refereeCalls += 1;
        return { outcome: "PASS" as const, rationale: "should-not-run" };
      },
    };
    const invalid = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        clearTransport(sideA, sideB, {
          evidenceClaimA: { startBoundaryIndex: 0, endBoundaryIndex: 999 },
        }),
      ),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(invalid.outcome).toBe("validation_failed");
    expect(refereeCalls).toBe(0);

    const compatible = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(compatibleTransport(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(compatible.semantic?.classification).toBe("compatible_states");
    expect(refereeCalls).toBe(0);
    expect(compatible.persistenceDecision).toBeNull();
  });

  it("offset binder still rejects mid-word as defence in depth", () => {
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: "I drank several beers last night.",
    });
    const mid = bindExactEvidenceClaimFromOffsets(sideB, {
      startOffset: 0,
      endOffset: 30,
    });
    expect(mid.ok).toBe(false);
    if (!mid.ok) expect(mid.code).toBe("lexical_boundary_integrity");
  });
});
