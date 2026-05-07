/**
 * Pattern Detector V1
 *
 * Wires P3-04 (contradiction drift adapter), P3-05 (receipt materialization),
 * P3-06 (claim lifecycle engine), P3-07 (trigger_condition detector),
 * P3-08 (remaining family adapters), and P3-10 (delivery hooks)
 * into the injectable PatternDetector slot established by the P5-09 executor.
 *
 * Coverage in V1: all five locked pattern families.
 *  - contradiction_drift    : P3-04 adapter (reads ContradictionNode)
 *  - trigger_condition      : P3-07 rule-based history detector
 *  - inner_critic           : P3-08 rule-based history detector
 *  - repetitive_loop        : P3-08 rule-based history detector
 *  - recovery_stabilizer    : P3-08 rule-based history detector
 */

import type { PrismaClient } from "@prisma/client";

import { deriveContradictionDriftClues } from "./contradiction-drift-adapter";
import { filterBehavioralMessages } from "./behavioral-filter";
import {
  synthesizeHistory,
  type HistorySourceKind,
  type NormalizedHistoryEntry,
} from "./history-synthesis";
import { detectInnerCriticClues } from "./inner-critic-adapter";
import { classifyImportHumanRelevance } from "./import-chatgpt";
import {
  assessPatternEvidenceQuoteQuality,
  materializeReceipt,
  materializeReceiptsFromEntries,
  type BulkReceiptEntry,
} from "./pattern-claim-evidence";
import { patternClaimHooks } from "./pattern-claim-hooks";
import {
  upsertPatternClaimFromClue,
  advanceClaimLifecycle,
  type PatternClue,
} from "./pattern-claim-lifecycle";
import type { PatternDetector } from "./pattern-detection-executor";
import { detectRecoveryStabilizerClues } from "./recovery-stabilizer-adapter";
import { detectRepetitiveLoopClues } from "./repetitive-loop-adapter";
import {
  buildTriggerConditionSubgroupDiagnostics,
  detectTriggerConditionClues,
} from "./trigger-condition-detector";
import type { PatternRerunDebugCollector } from "./pattern-rerun-debug";

export type ImportedPatternRelevanceFilterResult = {
  entries: NormalizedHistoryEntry[];
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasonCounts: Record<string, number>;
  rejected: Array<{ entry: NormalizedHistoryEntry; reasons: string[] }>;
};

type SupportEntry = NonNullable<PatternClue["supportEntries"]>[number];

type SupportEntrySkipReason =
  | "non_chat_source_kind"
  | "non_imported_session_origin"
  | "missing_session_origin"
  | "non_user_role";

type SupportEntryMetadataResolutionSource =
  | "direct"
  | "message_lookup"
  | "session_lookup"
  | "unresolved";

export type SupportEntryHistoryLookup = {
  byMessageId: Map<string, NormalizedHistoryEntry>;
  bySessionId: Map<string, NormalizedHistoryEntry[]>;
};

type EnrichedSupportEntry = SupportEntry & {
  sourceKind: HistorySourceKind;
  sessionOrigin: string | null;
  role: string | null;
  metadataResolutionSource: SupportEntryMetadataResolutionSource;
};

type ImportedSupportEvidenceFilterResult = {
  entries: BulkReceiptEntry[];
  evaluatedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasonCounts: Record<string, number>;
  skippedCount: number;
  skippedReasonCounts: Record<string, number>;
  rejected: Array<{
    entry: EnrichedSupportEntry;
    quote: string;
    score: number;
    reasons: string[];
  }>;
  skipped: Array<{
    entry: EnrichedSupportEntry;
    reasons: SupportEntrySkipReason[];
  }>;
};

type ImportedSupportResidualEvidenceRejectionReason =
  | "imported_low_context_confusion_snippet"
  | "imported_codex_project_coordination_chatter"
  | "imported_tooling_setup_chatter"
  | "imported_source_text_drafting_snippet"
  | "imported_recovery_metrics_or_biography_snippet";

function resolveSupportEntrySourceKind(entry: SupportEntry): "chat_message" | "journal_entry" {
  return entry.sourceKind ?? (entry.journalEntryId ? "journal_entry" : "chat_message");
}

function resolveHistoryEntrySourceKind(entry: NormalizedHistoryEntry): HistorySourceKind {
  return entry.sourceKind ?? (entry.journalEntryId ? "journal_entry" : "chat_message");
}

export function buildSupportEntryHistoryLookup(
  entries: NormalizedHistoryEntry[]
): SupportEntryHistoryLookup {
  const byMessageId = new Map<string, NormalizedHistoryEntry>();
  const bySessionId = new Map<string, NormalizedHistoryEntry[]>();

  for (const entry of entries) {
    if (entry.messageId) {
      byMessageId.set(entry.messageId, entry);
    }
    if (entry.sessionId) {
      const existing = bySessionId.get(entry.sessionId) ?? [];
      existing.push(entry);
      bySessionId.set(entry.sessionId, existing);
    }
  }

  return { byMessageId, bySessionId };
}

function resolveSupportEntryBySessionLookup(
  entry: SupportEntry,
  lookup: SupportEntryHistoryLookup
): NormalizedHistoryEntry | null {
  if (!entry.sessionId) return null;
  const candidates = lookup.bySessionId.get(entry.sessionId);
  if (!candidates || candidates.length === 0) return null;

  const messageCandidates = candidates.filter(
    (candidate) => resolveHistoryEntrySourceKind(candidate) === "chat_message"
  );
  if (messageCandidates.length === 0) return null;

  const byContent = messageCandidates.filter(
    (candidate) => candidate.content.trim() === entry.content.trim()
  );
  const pool = byContent.length > 0 ? byContent : messageCandidates;
  const targetTime = entry.timestamp.getTime();

  return pool
    .slice()
    .sort((left, right) => {
      const leftDelta = Math.abs(left.createdAt.getTime() - targetTime);
      const rightDelta = Math.abs(right.createdAt.getTime() - targetTime);
      if (leftDelta !== rightDelta) return leftDelta - rightDelta;
      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0] ?? null;
}

function enrichSupportEntry({
  entry,
  historyLookup,
}: {
  entry: SupportEntry;
  historyLookup?: SupportEntryHistoryLookup;
}): EnrichedSupportEntry {
  let matched: NormalizedHistoryEntry | null = null;
  let metadataResolutionSource: SupportEntryMetadataResolutionSource = "direct";

  if (historyLookup && entry.messageId) {
    matched = historyLookup.byMessageId.get(entry.messageId) ?? null;
    if (matched) metadataResolutionSource = "message_lookup";
  }

  if (!matched && historyLookup) {
    matched = resolveSupportEntryBySessionLookup(entry, historyLookup);
    if (matched) metadataResolutionSource = "session_lookup";
  }

  if (!matched && historyLookup) {
    metadataResolutionSource = "unresolved";
  }

  const resolvedSourceKind = matched
    ? resolveHistoryEntrySourceKind(matched)
    : resolveSupportEntrySourceKind(entry);

  return {
    ...entry,
    sourceKind: resolvedSourceKind,
    sessionId: matched?.sessionId ?? entry.sessionId,
    messageId: matched?.messageId ?? entry.messageId,
    journalEntryId: matched?.journalEntryId ?? entry.journalEntryId,
    sessionOrigin: matched?.sessionOrigin ?? entry.sessionOrigin ?? null,
    role: matched?.role ?? entry.role ?? null,
    metadataResolutionSource,
  };
}

function normalizeImportedSupportResidualText(text: string): string {
  return text
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAnyPhrase(normalizedText: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalizedText.includes(phrase));
}

function isImportedLowContextConfusionSnippet(normalizedText: string): boolean {
  const hasSameThing = containsAnyPhrase(normalizedText, ["same thing", "same thing as"]);
  const hasConfusionLead = containsAnyPhrase(normalizedText, [
    "i'm guessing",
    "im guessing",
    "i m guessing",
    "just checking",
    "was just checking",
    "is that",
  ]);
  const hasReceivingMismatch = containsAnyPhrase(normalizedText, [
    "recieving the same thing",
    "receiving the same thing",
    "recieving same thing",
    "receiving same thing",
  ]);
  const hasEnvMarker = containsAnyPhrase(normalizedText, [
    "env star",
    ".env",
    " env ",
  ]);
  const hasLevelMarker = normalizedText.includes("at this level");

  return (
    (hasSameThing && (hasConfusionLead || hasReceivingMismatch || hasLevelMarker)) ||
    (hasEnvMarker && (hasSameThing || hasConfusionLead || hasLevelMarker))
  );
}

function isImportedCodexProjectCoordinationChatter(normalizedText: string): boolean {
  const hasCoordinationActor = containsAnyPhrase(normalizedText, [
    "codex",
    "project",
    "codebase",
    "repo",
    "repository",
    "task",
    "tasks",
    "workflow",
    "handoff",
  ]);
  const hasCoordinationVerb = containsAnyPhrase(normalizedText, [
    "talk to codex",
    "command it",
    "command codex",
    "strategically",
    "do stuff",
    "coordinate",
    "handoff",
    "before the next pass",
    "open pinecone",
  ]);

  return hasCoordinationActor && hasCoordinationVerb;
}

function isImportedToolingSetupChatter(normalizedText: string): boolean {
  const hasToolingSubject = containsAnyPhrase(normalizedText, [
    "pinecone",
    "supabase",
    "firebase",
    "index called",
    "vector index",
    "database index",
  ]);
  const hasSetupAction = containsAnyPhrase(normalizedText, [
    "open",
    "set up",
    "setup",
    "already have",
    "called",
    "configure",
    "configured",
    "connect",
    "connected",
    "wire",
    "wired",
    "create",
    "created",
  ]);

  return hasToolingSubject && hasSetupAction;
}

function isImportedSourceTextDraftingSnippet(normalizedText: string): boolean {
  const hasDraftingLead = containsAnyPhrase(normalizedText, [
    "before i send it",
    "is this expressed well",
    "is this worded well",
    "is this phrased well",
    "how does this sound before i send",
  ]);
  const hasSourceTextTopic = containsAnyPhrase(normalizedText, [
    "garvey",
    "douglass",
    "tubman",
    "caribbean labour",
    "caribbean labor",
    "black excellence",
    "constitutional principle",
    "funded europe s rise",
    "funded europe's rise",
  ]);
  const hasClaimQuoteLead = containsAnyPhrase(normalizedText, [
    "people always deny this",
    "when i claim it",
  ]);

  return hasDraftingLead || (hasSourceTextTopic && hasClaimQuoteLead);
}

function isImportedRecoveryMetricsOrBiographySnippet(normalizedText: string): boolean {
  const hasChannelMetric = containsAnyPhrase(normalizedText, [
    "views",
    "channel",
    "subs",
    "sub",
    "k subs",
    "unlisted videos",
    "video editing quality",
    "subscribers",
    "followers",
    "watch time",
  ]);
  const hasChannelMetricMovement = containsAnyPhrase(normalizedText, [
    "got ",
    "lost ",
    "started rebuilding",
    "start rebuilding",
    "rebuilding",
  ]);

  if (hasChannelMetric && hasChannelMetricMovement) {
    return true;
  }

  const hasBiographyFrame = containsAnyPhrase(normalizedText, [
    "since a child",
    "as a child",
    "since childhood",
    "when i was a child",
    "growing up",
  ]);
  const hasStaticTraitLabel = containsAnyPhrase(normalizedText, [
    "considered shy",
    "shy person",
    "quiet person",
    "timid",
    "reserved",
  ]);
  const hasExplicitRecoverySignal = containsAnyPhrase(normalizedText, [
    "stabilize",
    "stabilizing",
    "recovery",
    "recover",
    "relapse",
    "fall back",
    "crash out",
    "ground myself",
    "reset myself",
  ]);

  return hasBiographyFrame && hasStaticTraitLabel && !hasExplicitRecoverySignal;
}

function classifyImportedSupportResidualEvidenceRejections(
  text: string,
  patternType?: PatternClue["patternType"]
): ImportedSupportResidualEvidenceRejectionReason[] {
  const normalizedText = normalizeImportedSupportResidualText(text);
  const reasons: ImportedSupportResidualEvidenceRejectionReason[] = [];

  if (isImportedLowContextConfusionSnippet(normalizedText)) {
    reasons.push("imported_low_context_confusion_snippet");
  }
  if (isImportedCodexProjectCoordinationChatter(normalizedText)) {
    reasons.push("imported_codex_project_coordination_chatter");
  }
  if (isImportedToolingSetupChatter(normalizedText)) {
    reasons.push("imported_tooling_setup_chatter");
  }
  if (isImportedSourceTextDraftingSnippet(normalizedText)) {
    reasons.push("imported_source_text_drafting_snippet");
  }
  if (
    patternType === "recovery_stabilizer" &&
    isImportedRecoveryMetricsOrBiographySnippet(normalizedText)
  ) {
    reasons.push("imported_recovery_metrics_or_biography_snippet");
  }

  return reasons;
}

function isImportedUserChatHistoryEntry(entry: NormalizedHistoryEntry): boolean {
  if (resolveHistoryEntrySourceKind(entry) !== "chat_message") return false;
  if (entry.sessionOrigin !== "IMPORTED_ARCHIVE") return false;
  if (entry.role !== null && entry.role !== "user") return false;
  return true;
}

function isImportedUserChatSupportEntry(entry: SupportEntry): boolean {
  if (resolveSupportEntrySourceKind(entry) !== "chat_message") return false;
  if ((entry.sessionOrigin ?? null) !== "IMPORTED_ARCHIVE") return false;
  if (entry.role !== undefined && entry.role !== null && entry.role !== "user") return false;
  return true;
}

function shouldGateClueQuoteAsImportedSupportEvidence({
  clue,
  historyLookup,
}: {
  clue: PatternClue;
  historyLookup?: SupportEntryHistoryLookup;
}): boolean {
  const clueSourceKind =
    clue.sourceKind ?? (clue.journalEntryId ? "journal_entry" : "chat_message");
  if (clueSourceKind !== "chat_message") return false;

  if (clue.messageId && historyLookup) {
    const matched = historyLookup.byMessageId.get(clue.messageId);
    if (matched) {
      return isImportedUserChatHistoryEntry(matched);
    }
  }

  if (clue.messageId && clue.supportEntries) {
    const matched = clue.supportEntries.find((entry) => entry.messageId === clue.messageId);
    if (matched) {
      return isImportedUserChatSupportEntry(matched);
    }
  }

  if (clue.sessionId && historyLookup) {
    const candidates = historyLookup.bySessionId.get(clue.sessionId) ?? [];
    const matched = candidates.find((entry) => resolveHistoryEntrySourceKind(entry) === "chat_message");
    if (matched) {
      return isImportedUserChatHistoryEntry(matched);
    }
  }

  if (clue.sessionId && clue.supportEntries) {
    const matched = clue.supportEntries.find(
      (entry) => entry.sessionId === clue.sessionId && resolveSupportEntrySourceKind(entry) === "chat_message"
    );
    if (matched) {
      return isImportedUserChatSupportEntry(matched);
    }
  }

  return false;
}

function importedSupportEvidenceQuotePassesQualityBoundary({
  quote,
  patternType,
}: {
  quote: string;
  patternType: PatternClue["patternType"];
}): boolean {
  const quality = assessPatternEvidenceQuoteQuality(quote);
  const relevance = classifyImportHumanRelevance(quality.quote);
  const relevanceRejections = relevance.reasons.filter(
    (reason) => reason !== "import_human_relevance_accepted"
  );
  const residualRejections = classifyImportedSupportResidualEvidenceRejections(
    quality.quote,
    patternType
  );
  return quality.accepted && relevanceRejections.length === 0 && residualRejections.length === 0;
}

/**
 * Import-only pre-materialization quality boundary for support entries.
 * Applies only to IMPORTED_ARCHIVE chat support entries; native APP and journal
 * support entries retain existing behavior.
 */
export function applyImportedSupportEvidenceQualityBoundary({
  entries,
  historyLookup,
  patternType,
}: {
  entries: SupportEntry[];
  historyLookup?: SupportEntryHistoryLookup;
  patternType?: PatternClue["patternType"];
}): ImportedSupportEvidenceFilterResult {
  const kept: BulkReceiptEntry[] = [];
  let evaluatedCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let skippedCount = 0;
  const rejectionReasonCounts: Record<string, number> = {};
  const skippedReasonCounts: Record<string, number> = {};
  const rejected: ImportedSupportEvidenceFilterResult["rejected"] = [];
  const skipped: ImportedSupportEvidenceFilterResult["skipped"] = [];

  for (const originalEntry of entries) {
    const entry = enrichSupportEntry({
      entry: originalEntry,
      historyLookup,
    });

    const skipReasons: SupportEntrySkipReason[] = [];
    if (entry.sourceKind !== "chat_message") {
      skipReasons.push("non_chat_source_kind");
    }
    if (entry.role !== null && entry.role !== "user") {
      skipReasons.push("non_user_role");
    }
    if (entry.sessionOrigin === null) {
      skipReasons.push("missing_session_origin");
    } else if (entry.sessionOrigin !== "IMPORTED_ARCHIVE") {
      skipReasons.push("non_imported_session_origin");
    }

    if (skipReasons.length > 0) {
      skippedCount += 1;
      skipped.push({
        entry,
        reasons: skipReasons,
      });
      for (const reason of skipReasons) {
        skippedReasonCounts[reason] = (skippedReasonCounts[reason] ?? 0) + 1;
      }
      kept.push(entry);
      continue;
    }

    evaluatedCount += 1;
    const quality = assessPatternEvidenceQuoteQuality(entry.content);
    const relevance = classifyImportHumanRelevance(quality.quote);
    const relevanceRejections = relevance.reasons.filter(
      (reason) => reason !== "import_human_relevance_accepted"
    );
    const residualRejections = classifyImportedSupportResidualEvidenceRejections(
      quality.quote,
      patternType
    );
    const reasons = Array.from(
      new Set([...quality.reasons, ...relevanceRejections, ...residualRejections])
    );

    if (quality.accepted && relevanceRejections.length === 0 && residualRejections.length === 0) {
      acceptedCount += 1;
      kept.push({
        ...entry,
        quote: quality.quote,
      });
      continue;
    }

    rejectedCount += 1;
    rejected.push({
      entry,
      quote: quality.quote,
      score: quality.score,
      reasons,
    });
    for (const reason of reasons) {
      rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
    }
  }

  return {
    entries: kept,
    evaluatedCount,
    acceptedCount,
    rejectedCount,
    rejectionReasonCounts,
    skippedCount,
    skippedReasonCounts,
    rejected,
    skipped,
  };
}

/**
 * Import-only precision boundary for pattern derivation input.
 * Filters IMPORTED_ARCHIVE user messages with the deterministic human-relevance
 * gate already used by import extraction, while leaving APP and journal
 * sources unchanged.
 */
export function applyImportedPatternRelevanceBoundary({
  entries,
}: {
  entries: NormalizedHistoryEntry[];
}): ImportedPatternRelevanceFilterResult {
  const kept: NormalizedHistoryEntry[] = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  const rejectionReasonCounts: Record<string, number> = {};
  const rejected: Array<{ entry: NormalizedHistoryEntry; reasons: string[] }> = [];

  for (const entry of entries) {
    const isImportedUserEntry =
      entry.role === "user" && entry.sessionOrigin === "IMPORTED_ARCHIVE";

    if (!isImportedUserEntry) {
      kept.push(entry);
      continue;
    }

    const relevance = classifyImportHumanRelevance(entry.content);
    if (relevance.eligible) {
      acceptedCount += 1;
      kept.push(entry);
      continue;
    }

    rejectedCount += 1;
    rejected.push({ entry, reasons: relevance.reasons });
    for (const reason of relevance.reasons) {
      rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
    }
  }

  return {
    entries: kept,
    acceptedCount,
    rejectedCount,
    rejectionReasonCounts,
    rejected,
  };
}

/**
 * V1 implementation of PatternDetector.
 * Returns the number of new PatternClaims created across all five families.
 */
export const patternDetectorV1: PatternDetector = async ({
  userId,
  runId,
  db,
  debugCollector,
}: {
  userId: string;
  messageIds: string[];
  runId: string;
  db: PrismaClient;
  debugCollector?: PatternRerunDebugCollector;
}): Promise<number> => {
  let claimsCreated = 0;

  // Synthesize normalized history for rule-based detectors.
  // Includes chat messages and journal entries as source-aware units.
  // contradiction_drift reads ContradictionNode directly, not history text.
  const historyEntries = await synthesizeHistory({ userId, db });
  const supportEntryHistoryLookup = buildSupportEntryHistoryLookup(historyEntries);
  const importedPatternRelevance = applyImportedPatternRelevanceBoundary({
    entries: historyEntries,
  });
  const entries = importedPatternRelevance.entries;
  debugCollector?.recordImportedPatternRelevance({
    acceptedCount: importedPatternRelevance.acceptedCount,
    rejectedCount: importedPatternRelevance.rejectedCount,
    rejectionReasonCounts: importedPatternRelevance.rejectionReasonCounts,
    rejected: importedPatternRelevance.rejected,
  });

  // Phase 1: behavioral filter — produce a stream of exclusively eligible,
  // user-authored behavioral messages. Non-user messages and non-behavioral
  // user messages are both excluded. contradiction_drift reads ContradictionNode
  // directly and is intentionally excluded from this filter.
  const behavioralEntries = filterBehavioralMessages(entries);
  debugCollector?.recordDetectorInputCountsByFamily({
    contradiction_drift: null,
    trigger_condition: behavioralEntries.length,
    inner_critic: behavioralEntries.length,
    repetitive_loop: behavioralEntries.length,
    recovery_stabilizer: behavioralEntries.length,
  });

  // ── Collect clues from all five families ──────────────────────────────────

  // P3-04: contradiction_drift — reads existing ContradictionNode data
  const driftClues = await deriveContradictionDriftClues({ userId, db });

  // P3-07: trigger_condition — rule-based on behavioral history only
  const triggerClues = detectTriggerConditionClues({ userId, entries: behavioralEntries });
  const triggerConditionSubgroupDiagnostics =
    buildTriggerConditionSubgroupDiagnostics(behavioralEntries);
  debugCollector?.recordTriggerConditionSubgroupDiagnostics(
    triggerConditionSubgroupDiagnostics
  );

  // P3-08: remaining families — rule-based on behavioral history only
  const innerCriticClues = detectInnerCriticClues({ userId, entries: behavioralEntries });
  const repetitiveLoopClues = detectRepetitiveLoopClues({ userId, entries: behavioralEntries });
  const recoveryStabilizerClues = detectRecoveryStabilizerClues({ userId, entries: behavioralEntries });

  debugCollector?.recordCluesEmittedByFamily({
    contradiction_drift: driftClues.length,
    trigger_condition: triggerClues.length,
    inner_critic: innerCriticClues.length,
    repetitive_loop: repetitiveLoopClues.length,
    recovery_stabilizer: recoveryStabilizerClues.length,
  });

  const allClues = [
    ...driftClues,
    ...triggerClues,
    ...innerCriticClues,
    ...repetitiveLoopClues,
    ...recoveryStabilizerClues,
  ];

  // ── Process each clue through the canonical lifecycle pipeline ────────────

  for (const clue of allClues) {
    // P3-06: upsert candidate PatternClaim from clue (idempotent)
    const { claimId, created, status } = await upsertPatternClaimFromClue({
      clue: { ...clue, sourceRunId: runId },
      db,
    });

    debugCollector?.recordClaimUpsert({
      claimId,
      patternType: clue.patternType,
      created,
    });

    if (created) {
      claimsCreated++;
      // P3-10: notify downstream — new candidate available
      patternClaimHooks.emit({
        type: "candidate_available",
        claimId,
        userId,
        patternType: clue.patternType,
      });
    }

    await materializeClueSupport({
      claimId,
      clue,
      db,
      debugCollector,
      supportEntryHistoryLookup,
    });

    // P3-06: advance lifecycle based on accumulated evidence
    const lifecycle = await advanceClaimLifecycle({ claimId, db });
    debugCollector?.recordLifecycleEvaluation({
      claimId,
      patternType: clue.patternType,
      advanced: lifecycle.advanced,
      newStatus: lifecycle.newStatus,
      newStrengthLevel: lifecycle.newStrengthLevel,
      evidenceCount: lifecycle.evidenceCount,
      sessionCount: lifecycle.sessionCount,
      journalEvidenceCount: lifecycle.journalEvidenceCount,
      journalEntrySpread: lifecycle.journalEntrySpread,
      journalDaySpread: lifecycle.journalDaySpread,
      supportContainerSpread: lifecycle.supportContainerSpread,
    });

    // P3-10: notify downstream if claim transitioned to active
    if (
      lifecycle.advanced &&
      lifecycle.newStatus === "active" &&
      lifecycle.previousStatus !== "active"
    ) {
      patternClaimHooks.emit({
        type: "claim_active",
        claimId,
        userId,
        patternType: clue.patternType,
      });
    }

    void status; // accessed above; suppress lint
  }

  return claimsCreated;
};

export async function materializeClueSupport({
  claimId,
  clue,
  db,
  debugCollector,
  supportEntryHistoryLookup,
}: {
  claimId: string;
  clue: PatternClue;
  db: PrismaClient;
  debugCollector?: PatternRerunDebugCollector;
  supportEntryHistoryLookup?: SupportEntryHistoryLookup;
}): Promise<void> {
  if (clue.supportEntries && clue.supportEntries.length > 0) {
    debugCollector?.recordClueSupportEntries(clue.supportEntries);
    const importedSupportEvidenceQuality = applyImportedSupportEvidenceQualityBoundary({
      entries: clue.supportEntries,
      historyLookup: supportEntryHistoryLookup,
      patternType: clue.patternType,
    });
    debugCollector?.recordImportedSupportEntryEvidenceQuality?.({
      evaluatedCount: importedSupportEvidenceQuality.evaluatedCount,
      acceptedCount: importedSupportEvidenceQuality.acceptedCount,
      rejectedCount: importedSupportEvidenceQuality.rejectedCount,
      rejectionReasonCounts: importedSupportEvidenceQuality.rejectionReasonCounts,
      rejected: importedSupportEvidenceQuality.rejected,
      skippedCount: importedSupportEvidenceQuality.skippedCount,
      skippedReasonCounts: importedSupportEvidenceQuality.skippedReasonCounts,
      skipped: importedSupportEvidenceQuality.skipped,
    });
    await materializeReceiptsFromEntries({
      claimId,
      // Persist the full support set, including the representative message.
      // The representative drives claim.summary; replay must be able to see its
      // extracted quote even when clue.quote points at a different display-safe
      // sentence.
      entries: importedSupportEvidenceQuality.entries,
      debugCollector,
      db,
    });
  }

  if (
    clue.sessionId !== undefined ||
    clue.messageId !== undefined ||
    clue.journalEntryId !== undefined
  ) {
    const shouldGateImportedClueQuote =
      typeof clue.quote === "string" &&
      clue.quote.trim().length > 0 &&
      shouldGateClueQuoteAsImportedSupportEvidence({
        clue,
        historyLookup: supportEntryHistoryLookup,
      });
    const clueQuote =
      shouldGateImportedClueQuote &&
      !importedSupportEvidenceQuotePassesQualityBoundary({
        quote: clue.quote!,
        patternType: clue.patternType,
      })
        ? undefined
        : clue.quote;

    await materializeReceipt({
      claimId,
      sessionId: clue.sessionId ?? undefined,
      messageId: clue.messageId ?? undefined,
      journalEntryId: clue.journalEntryId ?? undefined,
      quote: clueQuote,
      sourceKind: clue.sourceKind,
      debugCollector,
      db,
    });
  }
}
