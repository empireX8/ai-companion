import { describe, expect, it } from "vitest";

import { createPatternRerunDebugCollector } from "../pattern-rerun-debug";
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
      journalDaySpread: 1,
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
      journalDaySpread: 2,
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
        journalDaySpread: 1,
      },
      {
        id: "claim-existing",
        patternType: "inner_critic",
        status: "candidate",
        strengthLevel: "tentative",
        evidenceCount: 2,
        sessionCount: 0,
        journalEvidenceCount: 2,
        journalDaySpread: 2,
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
      journalDaySpread: 0,
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
      journalDaySpread: 1,
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
      journalDaySpread: 0,
    });

    const diagnostics = collector.buildDiagnostics();
    expect(diagnostics.touchedClaimIds).toEqual(["c1", "c2"]);
    expect(diagnostics.touchedClaims.map((claim) => claim.id)).toEqual(["c1", "c2"]);
    expect(diagnostics.lifecycleAdvancedCount).toBe(2);
  });
});
