import { analyzeBehavioralEligibility } from "./behavioral-filter";
import type { NormalizedHistoryEntry, HistorySourceKind } from "./history-synthesis";
import {
  PATTERN_TYPE_VALUES,
  type PatternClaimStatusValue,
  type PatternTypeValue,
  type StrengthLevelValue,
} from "./pattern-claim-boundary";

export type PatternRerunDebugFamilyCounts = Record<PatternTypeValue, number>;

export type PatternRerunTouchedClaimSummary = {
  id: string;
  patternType: PatternTypeValue;
  status: PatternClaimStatusValue;
  strengthLevel: StrengthLevelValue;
  evidenceCount: number;
  sessionCount: number;
  journalEvidenceCount: number;
  journalDaySpread: number;
};

export type PatternRerunDebugDiagnostics = {
  historyEntryCount: number;
  messageEntryCount: number;
  journalEntryCount: number;
  behavioralEntryCount: number;
  rejectedEntryCount: number;
  rejectionReasonCounts: Record<string, number>;
  /** How many journal-sourced user entries pass the behavioral filter */
  journalBehavioralEntryCount: number;
  /** How many journal-sourced user entries are rejected by the behavioral filter */
  journalRejectedEntryCount: number;
  /** Rejection reasons emitted only for journal entries */
  journalRejectionReasonCounts: Record<string, number>;
  clueCounts: PatternRerunDebugFamilyCounts;
  cluesEmittedByFamily: PatternRerunDebugFamilyCounts;
  claimsCreatedByFamily: PatternRerunDebugFamilyCounts;
  claimsMatchedExisting: number;
  claimsMatchedExistingByFamily: PatternRerunDebugFamilyCounts;
  /** Total support entries across all clues (pre-dedup) */
  supportEntriesTotal: number;
  /** Support entries backed by chat_message */
  supportEntriesMessage: number;
  /** Support entries backed by journal_entry */
  supportEntriesJournal: number;
  receiptsCreatedTotal: number;
  receiptsCreatedMessage: number;
  receiptsCreatedJournal: number;
  receiptsSkippedDuplicate: number;
  /** Total journal receipt materialization attempts (created + skipped) */
  receiptsAttemptedJournal: number;
  /** Journal receipts skipped as duplicate */
  receiptsSkippedDuplicateJournal: number;
  lifecycleAdvancedCount: number;
  touchedClaimIds: string[];
  touchedClaims: PatternRerunTouchedClaimSummary[];
};

export type PatternRerunReceiptSourceKind = HistorySourceKind | "unknown";

export type PatternRerunDebugCollector = {
  recordHistory: (entries: NormalizedHistoryEntry[]) => void;
  /** Record all supportEntries from one clue before receipt materialization. */
  recordClueSupportEntries: (
    entries: ReadonlyArray<{
      sourceKind?: "chat_message" | "journal_entry";
      journalEntryId?: string | null;
    }>
  ) => void;
  recordCluesEmittedByFamily: (
    counts: Partial<Record<PatternTypeValue, number>>
  ) => void;
  recordClaimUpsert: (event: {
    claimId: string;
    patternType: PatternTypeValue;
    created: boolean;
  }) => void;
  recordReceiptMaterialization: (event: {
    created: boolean;
    sourceKind: PatternRerunReceiptSourceKind;
  }) => void;
  recordLifecycleEvaluation: (event: {
    claimId: string;
    patternType: PatternTypeValue;
    advanced: boolean;
    newStatus: PatternClaimStatusValue;
    newStrengthLevel: StrengthLevelValue;
    evidenceCount: number;
    sessionCount: number;
    journalEvidenceCount: number;
    journalDaySpread?: number;
  }) => void;
  buildDiagnostics: () => PatternRerunDebugDiagnostics;
};

function emptyFamilyCounts(): PatternRerunDebugFamilyCounts {
  return Object.fromEntries(PATTERN_TYPE_VALUES.map((family) => [family, 0])) as PatternRerunDebugFamilyCounts;
}

function resolveSourceKind(entry: NormalizedHistoryEntry): HistorySourceKind {
  if (entry.sourceKind) return entry.sourceKind;
  return entry.journalEntryId ? "journal_entry" : "chat_message";
}

function buildRejectionReasonCounts(entries: NormalizedHistoryEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const analysis = analyzeBehavioralEligibility(entry.content);
    if (analysis.eligible) continue;
    for (const reason of analysis.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return counts;
}

function safePositiveInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

export function createPatternRerunDebugCollector({
  touchedClaimLimit = 12,
}: {
  touchedClaimLimit?: number;
} = {}): PatternRerunDebugCollector {
  const clueCounts = emptyFamilyCounts();
  const claimsCreatedByFamily = emptyFamilyCounts();
  const claimsMatchedExistingByFamily = emptyFamilyCounts();

  const claimPatternTypeById = new Map<string, PatternTypeValue>();
  const touchedClaimsById = new Map<string, PatternRerunTouchedClaimSummary>();
  const touchedClaimIds: string[] = [];
  const touchedClaimCap = Math.max(1, Math.floor(touchedClaimLimit));

  let historyEntryCount = 0;
  let messageEntryCount = 0;
  let journalEntryCount = 0;
  let behavioralEntryCount = 0;
  let rejectedEntryCount = 0;
  let rejectionReasonCounts: Record<string, number> = {};
  let journalBehavioralEntryCount = 0;
  let journalRejectedEntryCount = 0;
  let journalRejectionReasonCounts: Record<string, number> = {};

  let claimsMatchedExisting = 0;

  let supportEntriesTotal = 0;
  let supportEntriesMessage = 0;
  let supportEntriesJournal = 0;

  let receiptsCreatedTotal = 0;
  let receiptsCreatedMessage = 0;
  let receiptsCreatedJournal = 0;
  let receiptsSkippedDuplicate = 0;
  let receiptsAttemptedJournal = 0;
  let receiptsSkippedDuplicateJournal = 0;

  let lifecycleAdvancedCount = 0;

  function recordTouchedClaimId(claimId: string) {
    if (touchedClaimIds.length >= touchedClaimCap) return;
    if (touchedClaimIds.includes(claimId)) return;
    touchedClaimIds.push(claimId);
  }

  return {
    recordHistory(entries) {
      historyEntryCount = entries.length;
      messageEntryCount = entries.filter(
        (entry) => resolveSourceKind(entry) === "chat_message"
      ).length;
      journalEntryCount = entries.filter(
        (entry) => resolveSourceKind(entry) === "journal_entry"
      ).length;

      const userEntries = entries.filter((entry) => entry.role === "user");
      const behavioralEntries = userEntries.filter((entry) =>
        analyzeBehavioralEligibility(entry.content).eligible
      );
      const rejectedEntries = userEntries.filter(
        (entry) => !analyzeBehavioralEligibility(entry.content).eligible
      );

      behavioralEntryCount = behavioralEntries.length;
      rejectedEntryCount = rejectedEntries.length;
      rejectionReasonCounts = buildRejectionReasonCounts(rejectedEntries);

      const journalUserEntries = userEntries.filter(
        (entry) => resolveSourceKind(entry) === "journal_entry"
      );
      const journalBehavioral = journalUserEntries.filter((entry) =>
        analyzeBehavioralEligibility(entry.content).eligible
      );
      const journalRejected = journalUserEntries.filter(
        (entry) => !analyzeBehavioralEligibility(entry.content).eligible
      );
      journalBehavioralEntryCount = journalBehavioral.length;
      journalRejectedEntryCount = journalRejected.length;
      journalRejectionReasonCounts = buildRejectionReasonCounts(journalRejected);
    },

    recordClueSupportEntries(entries) {
      for (const entry of entries) {
        supportEntriesTotal += 1;
        const kind = entry.sourceKind ?? (entry.journalEntryId ? "journal_entry" : "chat_message");
        if (kind === "journal_entry") supportEntriesJournal += 1;
        else supportEntriesMessage += 1;
      }
    },

    recordCluesEmittedByFamily(counts) {
      for (const family of PATTERN_TYPE_VALUES) {
        clueCounts[family] += safePositiveInt(counts[family]);
      }
    },

    recordClaimUpsert({ claimId, patternType, created }) {
      claimPatternTypeById.set(claimId, patternType);
      recordTouchedClaimId(claimId);

      if (created) {
        claimsCreatedByFamily[patternType] += 1;
      } else {
        claimsMatchedExisting += 1;
        claimsMatchedExistingByFamily[patternType] += 1;
      }
    },

    recordReceiptMaterialization({ created, sourceKind }) {
      if (sourceKind === "journal_entry") {
        receiptsAttemptedJournal += 1;
        if (!created) receiptsSkippedDuplicateJournal += 1;
      }

      if (!created) {
        receiptsSkippedDuplicate += 1;
        return;
      }

      receiptsCreatedTotal += 1;
      if (sourceKind === "chat_message") receiptsCreatedMessage += 1;
      if (sourceKind === "journal_entry") receiptsCreatedJournal += 1;
    },

    recordLifecycleEvaluation({
      claimId,
      patternType,
      advanced,
      newStatus,
      newStrengthLevel,
      evidenceCount,
      sessionCount,
      journalEvidenceCount,
      journalDaySpread,
    }) {
      const resolvedPatternType = claimPatternTypeById.get(claimId) ?? patternType;
      claimPatternTypeById.set(claimId, resolvedPatternType);
      recordTouchedClaimId(claimId);

      if (advanced) lifecycleAdvancedCount += 1;

      touchedClaimsById.set(claimId, {
        id: claimId,
        patternType: resolvedPatternType,
        status: newStatus,
        strengthLevel: newStrengthLevel,
        evidenceCount,
        sessionCount,
        journalEvidenceCount,
        journalDaySpread: journalDaySpread ?? 0,
      });
    },

    buildDiagnostics() {
      const touchedClaims = touchedClaimIds
        .map((claimId) => touchedClaimsById.get(claimId))
        .filter((claim): claim is PatternRerunTouchedClaimSummary => claim !== undefined);

      return {
        historyEntryCount,
        messageEntryCount,
        journalEntryCount,
        behavioralEntryCount,
        rejectedEntryCount,
        rejectionReasonCounts,
        journalBehavioralEntryCount,
        journalRejectedEntryCount,
        journalRejectionReasonCounts,
        clueCounts,
        cluesEmittedByFamily: clueCounts,
        claimsCreatedByFamily,
        claimsMatchedExisting,
        claimsMatchedExistingByFamily,
        supportEntriesTotal,
        supportEntriesMessage,
        supportEntriesJournal,
        receiptsCreatedTotal,
        receiptsCreatedMessage,
        receiptsCreatedJournal,
        receiptsSkippedDuplicate,
        receiptsAttemptedJournal,
        receiptsSkippedDuplicateJournal,
        lifecycleAdvancedCount,
        touchedClaimIds,
        touchedClaims,
      };
    },
  };
}
