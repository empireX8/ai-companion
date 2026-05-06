import { analyzeBehavioralEligibility } from "./behavioral-filter";
import type { NormalizedHistoryEntry, HistorySourceKind } from "./history-synthesis";
import {
  PATTERN_TYPE_VALUES,
  type PatternClaimStatusValue,
  type PatternTypeValue,
  type StrengthLevelValue,
} from "./pattern-claim-boundary";

export type PatternRerunDebugFamilyCounts = Record<PatternTypeValue, number>;
export type PatternRerunDebugFamilyInputCounts = Record<PatternTypeValue, number | null>;

export type PatternRerunDebugBehavioralOrigin =
  | "IMPORTED_ARCHIVE"
  | "APP"
  | "journal"
  | "unknown";

export type PatternRerunDebugSourceClass =
  | "imported"
  | "native"
  | "journal"
  | "unknown";

export type PatternRerunDebugRejectSample = {
  reasons: string[];
  snippet: string;
  messageId: string | null;
  sessionId: string | null;
  origin: PatternRerunDebugBehavioralOrigin;
  sourceClass: PatternRerunDebugSourceClass;
  role: string;
  createdAt: string;
};

export type PatternRerunDebugRejectReasonSampleSet = {
  random: PatternRerunDebugRejectSample[];
  longest: PatternRerunDebugRejectSample[];
  selfSignal: PatternRerunDebugRejectSample[];
};

export type PatternRerunDebugRejectSamplesByReason = Partial<
  Record<string, PatternRerunDebugRejectReasonSampleSet>
>;

export type PatternRerunTouchedClaimSummary = {
  id: string;
  patternType: PatternTypeValue;
  status: PatternClaimStatusValue;
  strengthLevel: StrengthLevelValue;
  evidenceCount: number;
  sessionCount: number;
  journalEvidenceCount: number;
  journalEntrySpread: number;
  journalDaySpread: number;
  supportContainerSpread: number;
};

export type PatternRerunDebugDiagnostics = {
  historyEntryCount: number;
  messageEntryCount: number;
  journalEntryCount: number;
  importedPatternRelevanceAcceptedCount: number;
  importedPatternRelevanceRejectedCount: number;
  importedPatternRelevanceRejectionReasonCounts: Record<string, number>;
  importedPatternRelevanceRejectedSamples: PatternRerunDebugRejectSample[];
  userEntryCount: number;
  behavioralEntryCount: number;
  rejectedEntryCount: number;
  rejectionReasonCounts: Record<string, number>;
  behavioralAcceptedByOrigin: Record<PatternRerunDebugBehavioralOrigin, number>;
  behavioralRejectedByOrigin: Record<PatternRerunDebugBehavioralOrigin, number>;
  rejectionSamplesByReason: PatternRerunDebugRejectSamplesByReason;
  detectorInputCountsByFamily: PatternRerunDebugFamilyInputCounts;
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
  recordImportedPatternRelevance: (input: {
    acceptedCount: number;
    rejectedCount: number;
    rejectionReasonCounts: Record<string, number>;
    rejected: Array<{ entry: NormalizedHistoryEntry; reasons: string[] }>;
  }) => void;
  recordDetectorInputCountsByFamily: (
    counts: Partial<Record<PatternTypeValue, number | null>>
  ) => void;
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
    journalEntrySpread?: number;
    journalDaySpread?: number;
    supportContainerSpread?: number;
  }) => void;
  buildDiagnostics: () => PatternRerunDebugDiagnostics;
};

function emptyFamilyCounts(): PatternRerunDebugFamilyCounts {
  return Object.fromEntries(PATTERN_TYPE_VALUES.map((family) => [family, 0])) as PatternRerunDebugFamilyCounts;
}

function emptyFamilyInputCounts(): PatternRerunDebugFamilyInputCounts {
  return Object.fromEntries(PATTERN_TYPE_VALUES.map((family) => [family, 0])) as PatternRerunDebugFamilyInputCounts;
}

function emptyOriginCounts(): Record<PatternRerunDebugBehavioralOrigin, number> {
  return {
    IMPORTED_ARCHIVE: 0,
    APP: 0,
    journal: 0,
    unknown: 0,
  };
}

const REJECTION_SAMPLE_REASONS = [
  "no_first_person",
  "no_behavioral_signal",
  "assistant_directed",
  "question_like",
  "too_short",
] as const;

const SELF_SIGNAL_PATTERN =
  /\b(?:i['’]m|i['’]ve|i['’]ll|i['’]d|my|me|feel|feeling|frustrat\w*|anxious|overwhelm\w*|reactive|trust|value|important|identity|culture|belief|afraid|scared|ashamed|guilty|lonely|hurt)\b/i;

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function truncateSnippet(raw: string, maxLength = 180): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function normalizeBehavioralOrigin(
  entry: NormalizedHistoryEntry
): PatternRerunDebugBehavioralOrigin {
  const source = resolveSourceKind(entry);
  if (source === "journal_entry") return "journal";
  if (entry.sessionOrigin === "IMPORTED_ARCHIVE") return "IMPORTED_ARCHIVE";
  if (entry.sessionOrigin === "APP") return "APP";
  return "unknown";
}

function toSourceClass(origin: PatternRerunDebugBehavioralOrigin): PatternRerunDebugSourceClass {
  if (origin === "IMPORTED_ARCHIVE") return "imported";
  if (origin === "APP") return "native";
  if (origin === "journal") return "journal";
  return "unknown";
}

function toRejectSample(entry: NormalizedHistoryEntry, reasons: string[]): PatternRerunDebugRejectSample {
  const origin = normalizeBehavioralOrigin(entry);
  return {
    reasons: [...reasons],
    snippet: truncateSnippet(entry.content),
    messageId: entry.messageId ?? null,
    sessionId: entry.sessionId ?? null,
    origin,
    sourceClass: toSourceClass(origin),
    role: entry.role,
    createdAt: entry.createdAt.toISOString(),
  };
}

function buildRejectionSamplesByReason(
  entries: Array<{ entry: NormalizedHistoryEntry; reasons: string[] }>,
  sampleLimit = 4
): PatternRerunDebugRejectSamplesByReason {
  const result: PatternRerunDebugRejectSamplesByReason = {};

  for (const reason of REJECTION_SAMPLE_REASONS) {
    const matching = entries.filter((item) => item.reasons.includes(reason));
    if (matching.length === 0) continue;

    const random = matching
      .slice()
      .sort((left, right) => {
        const leftKey = `${left.entry.messageId ?? ""}|${left.entry.sessionId ?? ""}|${left.entry.createdAt.toISOString()}|${left.entry.content}`;
        const rightKey = `${right.entry.messageId ?? ""}|${right.entry.sessionId ?? ""}|${right.entry.createdAt.toISOString()}|${right.entry.content}`;
        return stableHash(leftKey) - stableHash(rightKey);
      })
      .slice(0, sampleLimit)
      .map((item) => toRejectSample(item.entry, item.reasons));

    const longest = matching
      .slice()
      .sort((left, right) => {
        const byLength = right.entry.content.length - left.entry.content.length;
        if (byLength !== 0) return byLength;
        return left.entry.createdAt.getTime() - right.entry.createdAt.getTime();
      })
      .slice(0, sampleLimit)
      .map((item) => toRejectSample(item.entry, item.reasons));

    const selfSignal = matching
      .filter((item) => SELF_SIGNAL_PATTERN.test(item.entry.content))
      .slice()
      .sort((left, right) => {
        const byLength = right.entry.content.length - left.entry.content.length;
        if (byLength !== 0) return byLength;
        return left.entry.createdAt.getTime() - right.entry.createdAt.getTime();
      })
      .slice(0, sampleLimit)
      .map((item) => toRejectSample(item.entry, item.reasons));

    result[reason] = { random, longest, selfSignal };
  }

  return result;
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
  const detectorInputCountsByFamily = emptyFamilyInputCounts();
  detectorInputCountsByFamily.contradiction_drift = null;
  const claimsCreatedByFamily = emptyFamilyCounts();
  const claimsMatchedExistingByFamily = emptyFamilyCounts();

  const claimPatternTypeById = new Map<string, PatternTypeValue>();
  const touchedClaimsById = new Map<string, PatternRerunTouchedClaimSummary>();
  const touchedClaimIds: string[] = [];
  const touchedClaimCap = Math.max(1, Math.floor(touchedClaimLimit));

  let historyEntryCount = 0;
  let messageEntryCount = 0;
  let journalEntryCount = 0;
  let importedPatternRelevanceAcceptedCount = 0;
  let importedPatternRelevanceRejectedCount = 0;
  let importedPatternRelevanceRejectionReasonCounts: Record<string, number> = {};
  let importedPatternRelevanceRejectedSamples: PatternRerunDebugRejectSample[] = [];
  let userEntryCount = 0;
  let behavioralEntryCount = 0;
  let rejectedEntryCount = 0;
  let rejectionReasonCounts: Record<string, number> = {};
  let behavioralAcceptedByOrigin = emptyOriginCounts();
  let behavioralRejectedByOrigin = emptyOriginCounts();
  let rejectionSamplesByReason: PatternRerunDebugRejectSamplesByReason = {};
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
      userEntryCount = userEntries.length;
      const behavioralEntries: NormalizedHistoryEntry[] = [];
      const rejectedEntries: NormalizedHistoryEntry[] = [];
      const rejectedWithReasons: Array<{ entry: NormalizedHistoryEntry; reasons: string[] }> = [];

      const acceptedByOrigin = emptyOriginCounts();
      const rejectedByOrigin = emptyOriginCounts();
      for (const entry of userEntries) {
        const analysis = analyzeBehavioralEligibility(entry.content);
        const origin = normalizeBehavioralOrigin(entry);
        if (analysis.eligible) {
          behavioralEntries.push(entry);
          acceptedByOrigin[origin] += 1;
        } else {
          rejectedEntries.push(entry);
          rejectedByOrigin[origin] += 1;
          rejectedWithReasons.push({
            entry,
            reasons: analysis.reasons,
          });
        }
      }

      behavioralEntryCount = behavioralEntries.length;
      rejectedEntryCount = rejectedEntries.length;
      rejectionReasonCounts = buildRejectionReasonCounts(rejectedEntries);
      behavioralAcceptedByOrigin = acceptedByOrigin;
      behavioralRejectedByOrigin = rejectedByOrigin;
      rejectionSamplesByReason = buildRejectionSamplesByReason(rejectedWithReasons);

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

    recordImportedPatternRelevance({
      acceptedCount,
      rejectedCount,
      rejectionReasonCounts,
      rejected,
    }) {
      importedPatternRelevanceAcceptedCount = safePositiveInt(acceptedCount);
      importedPatternRelevanceRejectedCount = safePositiveInt(rejectedCount);

      const nextReasonCounts: Record<string, number> = {};
      for (const [reason, count] of Object.entries(rejectionReasonCounts)) {
        const normalizedCount = safePositiveInt(count);
        if (normalizedCount <= 0) continue;
        nextReasonCounts[reason] = normalizedCount;
      }
      importedPatternRelevanceRejectionReasonCounts = nextReasonCounts;

      importedPatternRelevanceRejectedSamples = rejected
        .slice(0, 8)
        .map((item) => toRejectSample(item.entry, item.reasons));
    },

    recordDetectorInputCountsByFamily(counts) {
      for (const family of PATTERN_TYPE_VALUES) {
        if (!(family in counts)) continue;
        const nextValue = counts[family];
        detectorInputCountsByFamily[family] =
          typeof nextValue === "number" && Number.isFinite(nextValue)
            ? Math.max(0, Math.floor(nextValue))
            : null;
      }
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
      journalEntrySpread,
      journalDaySpread,
      supportContainerSpread,
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
        journalEntrySpread: journalEntrySpread ?? 0,
        journalDaySpread: journalDaySpread ?? 0,
        supportContainerSpread: supportContainerSpread ?? sessionCount,
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
        importedPatternRelevanceAcceptedCount,
        importedPatternRelevanceRejectedCount,
        importedPatternRelevanceRejectionReasonCounts,
        importedPatternRelevanceRejectedSamples,
        userEntryCount,
        behavioralEntryCount,
        rejectedEntryCount,
        rejectionReasonCounts,
        behavioralAcceptedByOrigin,
        behavioralRejectedByOrigin,
        rejectionSamplesByReason,
        detectorInputCountsByFamily,
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
