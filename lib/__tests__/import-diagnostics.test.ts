import { describe, expect, it } from "vitest";

import {
  IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX,
  combineResultErrorsWithDiagnostics,
  createEmptyImportRunDiagnostics,
  incrementReasonCodeCount,
  pushDiagnosticSample,
  splitResultErrorsAndDiagnostics,
  toTopReasonCounts,
} from "../import-diagnostics";

describe("import diagnostics helpers", () => {
  it("round-trips diagnostics through resultErrors metadata", () => {
    const diagnostics = createEmptyImportRunDiagnostics();
    diagnostics.importedConversationCount = 2;
    diagnostics.referenceCandidatesAccepted = 3;
    diagnostics.patternRerunDiagnostics = {
      historyEntryCount: 12,
      messageEntryCount: 10,
      journalEntryCount: 2,
      importedPatternRelevanceAcceptedCount: 2,
      importedPatternRelevanceRejectedCount: 1,
      importedPatternRelevanceRejectionReasonCounts: {
        technical_or_terminal_noise: 1,
      },
      importedPatternRelevanceRejectedSamples: [],
      userEntryCount: 9,
      behavioralEntryCount: 3,
      rejectedEntryCount: 6,
      rejectionReasonCounts: { no_first_person: 4, no_behavioral_signal: 2 },
      behavioralAcceptedByOrigin: {
        IMPORTED_ARCHIVE: 2,
        APP: 1,
        journal: 0,
        unknown: 0,
      },
      behavioralRejectedByOrigin: {
        IMPORTED_ARCHIVE: 4,
        APP: 1,
        journal: 1,
        unknown: 0,
      },
      rejectionSamplesByReason: {
        no_first_person: {
          random: [],
          longest: [],
          selfSignal: [],
        },
      },
      detectorInputCountsByFamily: {
        contradiction_drift: null,
        trigger_condition: 3,
        inner_critic: 3,
        repetitive_loop: 3,
        recovery_stabilizer: 3,
      },
      journalBehavioralEntryCount: 0,
      journalRejectedEntryCount: 1,
      journalRejectionReasonCounts: { too_short: 1 },
      clueCounts: {
        contradiction_drift: 0,
        trigger_condition: 1,
        inner_critic: 0,
        repetitive_loop: 0,
        recovery_stabilizer: 0,
      },
      cluesEmittedByFamily: {
        contradiction_drift: 0,
        trigger_condition: 1,
        inner_critic: 0,
        repetitive_loop: 0,
        recovery_stabilizer: 0,
      },
      claimsCreatedByFamily: {
        contradiction_drift: 0,
        trigger_condition: 1,
        inner_critic: 0,
        repetitive_loop: 0,
        recovery_stabilizer: 0,
      },
      claimsMatchedExisting: 0,
      claimsMatchedExistingByFamily: {
        contradiction_drift: 0,
        trigger_condition: 0,
        inner_critic: 0,
        repetitive_loop: 0,
        recovery_stabilizer: 0,
      },
      supportEntriesTotal: 1,
      supportEntriesMessage: 1,
      supportEntriesJournal: 0,
      receiptsCreatedTotal: 1,
      receiptsCreatedMessage: 1,
      receiptsCreatedJournal: 0,
      receiptsSkippedDuplicate: 0,
      receiptsAttemptedJournal: 0,
      receiptsSkippedDuplicateJournal: 0,
      lifecycleAdvancedCount: 1,
      touchedClaimIds: [],
      touchedClaims: [],
    };
    incrementReasonCodeCount(diagnostics, "accepted_reference_candidate", 3);

    const stored = combineResultErrorsWithDiagnostics(["conversation 2: skipped"], diagnostics);
    expect(stored.some((value) => value.startsWith(IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX))).toBe(true);

    const parsed = splitResultErrorsAndDiagnostics(stored);
    expect(parsed.errors).toEqual(["conversation 2: skipped"]);
    expect(parsed.diagnostics?.importedConversationCount).toBe(2);
    expect(parsed.diagnostics?.referenceCandidatesAccepted).toBe(3);
    expect(parsed.diagnostics?.reasonCodeCounts.accepted_reference_candidate).toBe(3);
    expect(parsed.diagnostics?.patternRerunDiagnostics).not.toBe("unavailable_without_refactor");
    if (
      parsed.diagnostics?.patternRerunDiagnostics &&
      parsed.diagnostics.patternRerunDiagnostics !== "unavailable_without_refactor"
    ) {
      expect(parsed.diagnostics.patternRerunDiagnostics.behavioralEntryCount).toBe(3);
      expect(parsed.diagnostics.patternRerunDiagnostics.detectorInputCountsByFamily.trigger_condition).toBe(3);
    }
  });

  it("keeps malformed diagnostics payloads as plain errors", () => {
    const malformed = `${IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX}{not-json`;
    const parsed = splitResultErrorsAndDiagnostics(["warn", malformed]);

    expect(parsed.diagnostics).toBeNull();
    expect(parsed.errors).toEqual(["warn", malformed]);
  });

  it("caps samples deterministically and truncates long snippets", () => {
    const diagnostics = createEmptyImportRunDiagnostics();
    for (let index = 0; index < 8; index += 1) {
      pushDiagnosticSample(diagnostics, "rejected", {
        reason: "too_short",
        snippet: `Sample ${index} ${"x".repeat(300)}`,
        messageId: `m_${index}`,
      });
    }

    expect(diagnostics.samples.rejected).toHaveLength(6);
    expect(diagnostics.samples.rejected[0]?.messageId).toBe("m_0");
    expect((diagnostics.samples.rejected[0]?.snippet.length ?? 0) <= 140).toBe(true);
  });

  it("returns stable top rejection reasons sorted by count then reason", () => {
    const top = toTopReasonCounts(
      {
        b_reason: 4,
        c_reason: 2,
        a_reason: 4,
      },
      2
    );
    expect(top).toEqual([
      { reason: "a_reason", count: 4 },
      { reason: "b_reason", count: 4 },
    ]);
  });
});
