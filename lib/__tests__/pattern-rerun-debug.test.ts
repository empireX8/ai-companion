import { describe, expect, it } from "vitest";

import { createPatternRerunDebugCollector } from "../pattern-rerun-debug";
import { analyzeBehavioralEligibility } from "../behavioral-filter";
import type { NormalizedHistoryEntry } from "../history-synthesis";

function makeEntry(
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  return {
    sourceKind: "chat_message",
    messageId: "m1",
    sessionId: "s1",
    journalEntryId: null,
    sessionOrigin: "APP",
    sessionStartedAt: new Date("2026-01-01T00:00:00.000Z"),
    role: "user",
    content: "Whenever I'm stressed, I tend to procrastinate.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("createPatternRerunDebugCollector", () => {
  it("tracks upstream substrate counts and downstream create/match/receipt/lifecycle counters", () => {
    const collector = createPatternRerunDebugCollector({ touchedClaimLimit: 3 });

    collector.recordHistory([
      makeEntry({
        messageId: "m1",
        sessionId: "s1",
        content: "Whenever I'm stressed, I tend to procrastinate.",
      }),
      makeEntry({
        sourceKind: "journal_entry",
        messageId: null,
        sessionId: null,
        journalEntryId: "j1",
        sessionOrigin: null,
        sessionStartedAt: null,
        content: "I struggle to trust my own judgment when I have to commit.",
      }),
      makeEntry({
        messageId: "m2",
        sessionId: "s2",
        role: "assistant",
        content: "Thanks for sharing.",
      }),
    ]);

    collector.recordCluesEmittedByFamily({
      trigger_condition: 1,
      inner_critic: 1,
      repetitive_loop: 0,
      contradiction_drift: 0,
      recovery_stabilizer: 0,
    });
    collector.recordDetectorInputCountsByFamily({
      contradiction_drift: null,
      trigger_condition: 2,
      inner_critic: 2,
      repetitive_loop: 2,
      recovery_stabilizer: 2,
    });
    collector.recordImportedPatternRelevance({
      acceptedCount: 1,
      rejectedCount: 1,
      rejectionReasonCounts: {
        technical_or_terminal_noise: 1,
      },
      rejected: [
        {
          entry: makeEntry({
            messageId: "import-noise-1",
            sessionId: "import-session-1",
            sessionOrigin: "IMPORTED_ARCHIVE",
            content: "user@host % npx prisma migrate reset",
          }),
          reasons: ["technical_or_terminal_noise"],
        },
      ],
    });

    collector.recordClaimUpsert({
      claimId: "claim-new",
      patternType: "trigger_condition",
      created: true,
    });
    collector.recordClaimUpsert({
      claimId: "claim-existing",
      patternType: "inner_critic",
      created: false,
    });

    collector.recordClueSupportEntries([
      { sourceKind: "chat_message" },
      { sourceKind: "journal_entry", journalEntryId: "j1" },
      { sourceKind: "chat_message" },
    ]);

    collector.recordReceiptMaterialization({
      created: true,
      sourceKind: "chat_message",
    });
    collector.recordReceiptMaterialization({
      created: true,
      sourceKind: "journal_entry",
    });
    collector.recordReceiptMaterialization({
      created: false,
      sourceKind: "journal_entry",
    });

    collector.recordLifecycleEvaluation({
      claimId: "claim-new",
      patternType: "trigger_condition",
      advanced: true,
      newStatus: "active",
      newStrengthLevel: "tentative",
      evidenceCount: 3,
      sessionCount: 2,
      journalEvidenceCount: 1,
      journalEntrySpread: 1,
      journalDaySpread: 1,
      supportContainerSpread: 3,
    });
    collector.recordLifecycleEvaluation({
      claimId: "claim-existing",
      patternType: "inner_critic",
      advanced: false,
      newStatus: "candidate",
      newStrengthLevel: "tentative",
      evidenceCount: 2,
      sessionCount: 0,
      journalEvidenceCount: 2,
      journalEntrySpread: 2,
      journalDaySpread: 2,
      supportContainerSpread: 2,
    });

    const diagnostics = collector.buildDiagnostics();

    expect(diagnostics.historyEntryCount).toBe(3);
    expect(diagnostics.messageEntryCount).toBe(2);
    expect(diagnostics.journalEntryCount).toBe(1);
    expect(diagnostics.behavioralEntryCount).toBe(2);
    expect(diagnostics.rejectedEntryCount).toBe(0);
    // Journal-specific breakdown
    expect(diagnostics.journalBehavioralEntryCount).toBe(1);
    expect(diagnostics.journalRejectedEntryCount).toBe(0);

    expect(diagnostics.cluesEmittedByFamily.trigger_condition).toBe(1);
    expect(diagnostics.cluesEmittedByFamily.inner_critic).toBe(1);
    expect(diagnostics.clueCounts).toEqual(diagnostics.cluesEmittedByFamily);
    expect(diagnostics.detectorInputCountsByFamily).toEqual({
      contradiction_drift: null,
      trigger_condition: 2,
      inner_critic: 2,
      repetitive_loop: 2,
      recovery_stabilizer: 2,
    });
    expect(diagnostics.importedPatternRelevanceAcceptedCount).toBe(1);
    expect(diagnostics.importedPatternRelevanceRejectedCount).toBe(1);
    expect(diagnostics.importedPatternRelevanceRejectionReasonCounts).toEqual({
      technical_or_terminal_noise: 1,
    });
    expect(diagnostics.importedPatternRelevanceRejectedSamples).toHaveLength(1);
    expect(diagnostics.importedPatternRelevanceRejectedSamples[0]).toMatchObject({
      messageId: "import-noise-1",
      sessionId: "import-session-1",
      origin: "IMPORTED_ARCHIVE",
      sourceClass: "imported",
      reasons: ["technical_or_terminal_noise"],
    });

    expect(diagnostics.claimsCreatedByFamily.trigger_condition).toBe(1);
    expect(diagnostics.claimsMatchedExisting).toBe(1);
    expect(diagnostics.claimsMatchedExistingByFamily.inner_critic).toBe(1);

    expect(diagnostics.supportEntriesTotal).toBe(3);
    expect(diagnostics.supportEntriesMessage).toBe(2);
    expect(diagnostics.supportEntriesJournal).toBe(1);

    expect(diagnostics.receiptsCreatedTotal).toBe(2);
    expect(diagnostics.receiptsCreatedMessage).toBe(1);
    expect(diagnostics.receiptsCreatedJournal).toBe(1);
    expect(diagnostics.receiptsSkippedDuplicate).toBe(1);
    expect(diagnostics.receiptsAttemptedJournal).toBe(2);
    expect(diagnostics.receiptsSkippedDuplicateJournal).toBe(1);

    expect(diagnostics.lifecycleAdvancedCount).toBe(1);

    expect(diagnostics.touchedClaimIds).toEqual(["claim-new", "claim-existing"]);
    expect(diagnostics.touchedClaims).toEqual([
      {
        id: "claim-new",
        patternType: "trigger_condition",
        status: "active",
        strengthLevel: "tentative",
        evidenceCount: 3,
        sessionCount: 2,
        journalEvidenceCount: 1,
        journalEntrySpread: 1,
        journalDaySpread: 1,
        supportContainerSpread: 3,
      },
      {
        id: "claim-existing",
        patternType: "inner_critic",
        status: "candidate",
        strengthLevel: "tentative",
        evidenceCount: 2,
        sessionCount: 0,
        journalEvidenceCount: 2,
        journalEntrySpread: 2,
        journalDaySpread: 2,
        supportContainerSpread: 2,
      },
    ]);
  });

  it("caps touched claims and keeps lifecycle advancement counting deterministic", () => {
    const collector = createPatternRerunDebugCollector({ touchedClaimLimit: 2 });

    collector.recordClaimUpsert({
      claimId: "c1",
      patternType: "trigger_condition",
      created: true,
    });
    collector.recordClaimUpsert({
      claimId: "c2",
      patternType: "inner_critic",
      created: true,
    });
    collector.recordClaimUpsert({
      claimId: "c3",
      patternType: "repetitive_loop",
      created: true,
    });

    collector.recordLifecycleEvaluation({
      claimId: "c1",
      patternType: "trigger_condition",
      advanced: true,
      newStatus: "active",
      newStrengthLevel: "tentative",
      evidenceCount: 1,
      sessionCount: 1,
      journalEvidenceCount: 0,
      journalEntrySpread: 0,
      journalDaySpread: 0,
      supportContainerSpread: 1,
    });
    collector.recordLifecycleEvaluation({
      claimId: "c2",
      patternType: "inner_critic",
      advanced: false,
      newStatus: "candidate",
      newStrengthLevel: "tentative",
      evidenceCount: 1,
      sessionCount: 0,
      journalEvidenceCount: 1,
      journalEntrySpread: 1,
      journalDaySpread: 1,
      supportContainerSpread: 1,
    });
    collector.recordLifecycleEvaluation({
      claimId: "c3",
      patternType: "repetitive_loop",
      advanced: true,
      newStatus: "active",
      newStrengthLevel: "tentative",
      evidenceCount: 3,
      sessionCount: 2,
      journalEvidenceCount: 0,
      journalEntrySpread: 0,
      journalDaySpread: 0,
      supportContainerSpread: 2,
    });

    const diagnostics = collector.buildDiagnostics();
    expect(diagnostics.touchedClaimIds).toEqual(["c1", "c2"]);
    expect(diagnostics.touchedClaims.map((claim) => claim.id)).toEqual(["c1", "c2"]);
    expect(diagnostics.lifecycleAdvancedCount).toBe(2);
  });

  it("builds stratified rejection samples and origin splits for key rejection reasons", () => {
    const collector = createPatternRerunDebugCollector();

    collector.recordHistory([
      makeEntry({
        messageId: "accepted-app",
        sessionId: "session-app",
        sessionOrigin: "APP",
        content: "I always end up overthinking and delaying the hard step.",
      }),
      makeEntry({
        messageId: "accepted-import",
        sessionId: "session-import",
        sessionOrigin: "IMPORTED_ARCHIVE",
        content: "I keep doubting myself when the plan gets ambiguous.",
      }),
      makeEntry({
        messageId: "r-no-first-person",
        sessionId: "session-no-first-person",
        sessionOrigin: "IMPORTED_ARCHIVE",
        content: "Need to update the model file in terminal before retrying",
      }),
      makeEntry({
        messageId: "r-no-behavioral",
        sessionId: "session-no-behavioral",
        sessionOrigin: "APP",
        content: "I feel tense in this workflow and I value clear sequencing.",
      }),
      makeEntry({
        messageId: "r-assistant-directed",
        sessionId: "session-assistant-directed",
        sessionOrigin: "APP",
        content: "you keep changing the process and I stop trusting the direction",
      }),
      makeEntry({
        messageId: "r-question-like",
        sessionId: "session-question-like",
        sessionOrigin: "IMPORTED_ARCHIVE",
        content: "do I need to do that in the terminal?",
      }),
      makeEntry({
        sourceKind: "journal_entry",
        messageId: null,
        sessionId: null,
        journalEntryId: "journal-too-short",
        sessionOrigin: null,
        sessionStartedAt: null,
        content: "I panic",
      }),
    ]);

    const diagnostics = collector.buildDiagnostics();

    expect(diagnostics.userEntryCount).toBe(7);
    expect(diagnostics.behavioralEntryCount).toBe(2);
    expect(diagnostics.rejectedEntryCount).toBe(5);

    expect(diagnostics.behavioralAcceptedByOrigin).toEqual({
      IMPORTED_ARCHIVE: 1,
      APP: 1,
      journal: 0,
      unknown: 0,
    });
    expect(diagnostics.behavioralRejectedByOrigin).toEqual({
      IMPORTED_ARCHIVE: 2,
      APP: 2,
      journal: 1,
      unknown: 0,
    });

    expect(diagnostics.rejectionSamplesByReason.no_first_person?.random).toHaveLength(1);
    expect(diagnostics.rejectionSamplesByReason.no_behavioral_signal?.random).toHaveLength(1);
    expect(diagnostics.rejectionSamplesByReason.assistant_directed?.random).toHaveLength(1);
    expect(diagnostics.rejectionSamplesByReason.question_like?.random).toHaveLength(1);
    expect(diagnostics.rejectionSamplesByReason.too_short?.random).toHaveLength(1);

    const noBehavioralSample =
      diagnostics.rejectionSamplesByReason.no_behavioral_signal?.random[0];
    expect(noBehavioralSample).toMatchObject({
      reasons: ["no_behavioral_signal"],
      messageId: "r-no-behavioral",
      sessionId: "session-no-behavioral",
      origin: "APP",
      sourceClass: "native",
      role: "user",
    });
    expect(typeof noBehavioralSample?.createdAt).toBe("string");
    expect(noBehavioralSample?.snippet.length ?? 0).toBeGreaterThan(0);

    const noBehavioralSelfSignal =
      diagnostics.rejectionSamplesByReason.no_behavioral_signal?.selfSignal;
    expect(noBehavioralSelfSignal).toHaveLength(1);
    expect(noBehavioralSelfSignal?.[0]?.messageId).toBe("r-no-behavioral");

    const tooShortSample = diagnostics.rejectionSamplesByReason.too_short?.random[0];
    expect(tooShortSample).toMatchObject({
      messageId: null,
      sessionId: null,
      origin: "journal",
      sourceClass: "journal",
      role: "user",
    });
  });

  it("collects rejection samples without changing behavioral eligibility accounting", () => {
    const entries = [
      makeEntry({
        messageId: "m-accepted",
        sessionId: "s-accepted",
        content: "I always end up procrastinating when I'm overwhelmed.",
      }),
      makeEntry({
        messageId: "m-rejected-q",
        sessionId: "s-rejected-q",
        content: "do I need to change that first?",
      }),
      makeEntry({
        messageId: "m-rejected-no-first-person",
        sessionId: "s-rejected-no-first-person",
        content: "Need to run npm install and restart",
      }),
      makeEntry({
        messageId: "m-rejected-no-signal",
        sessionId: "s-rejected-no-signal",
        content: "I feel uncertain about this direction right now.",
      }),
      makeEntry({
        messageId: "m-assistant",
        sessionId: "s-assistant",
        role: "assistant",
        content: "Try running npm run build.",
      }),
    ];

    const expectedUserEntries = entries.filter((entry) => entry.role === "user");
    const expectedBehavioral = expectedUserEntries.filter((entry) =>
      analyzeBehavioralEligibility(entry.content).eligible
    );
    const expectedRejected = expectedUserEntries.length - expectedBehavioral.length;
    const expectedReasonCounts: Record<string, number> = {};
    for (const entry of expectedUserEntries) {
      const analysis = analyzeBehavioralEligibility(entry.content);
      if (analysis.eligible) continue;
      for (const reason of analysis.reasons) {
        expectedReasonCounts[reason] = (expectedReasonCounts[reason] ?? 0) + 1;
      }
    }

    const collector = createPatternRerunDebugCollector();
    collector.recordHistory(entries);
    const diagnostics = collector.buildDiagnostics();

    expect(diagnostics.userEntryCount).toBe(expectedUserEntries.length);
    expect(diagnostics.behavioralEntryCount).toBe(expectedBehavioral.length);
    expect(diagnostics.rejectedEntryCount).toBe(expectedRejected);
    expect(diagnostics.rejectionReasonCounts).toEqual(expectedReasonCounts);
  });
});
