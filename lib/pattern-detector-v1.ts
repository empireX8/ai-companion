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
import { synthesizeHistory } from "./history-synthesis";
import { detectInnerCriticClues } from "./inner-critic-adapter";
import {
  materializeReceipt,
  materializeReceiptsFromEntries,
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
import { detectTriggerConditionClues } from "./trigger-condition-detector";
import type { PatternRerunDebugCollector } from "./pattern-rerun-debug";

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
  const entries = await synthesizeHistory({ userId, db });

  // Phase 1: behavioral filter — produce a stream of exclusively eligible,
  // user-authored behavioral messages. Non-user messages and non-behavioral
  // user messages are both excluded. contradiction_drift reads ContradictionNode
  // directly and is intentionally excluded from this filter.
  const behavioralEntries = filterBehavioralMessages(entries);

  // ── Collect clues from all five families ──────────────────────────────────

  // P3-04: contradiction_drift — reads existing ContradictionNode data
  const driftClues = await deriveContradictionDriftClues({ userId, db });

  // P3-07: trigger_condition — rule-based on behavioral history only
  const triggerClues = detectTriggerConditionClues({ userId, entries: behavioralEntries });

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

    await materializeClueSupport({ claimId, clue, db, debugCollector });

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
      journalDaySpread: lifecycle.journalDaySpread,
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
}: {
  claimId: string;
  clue: PatternClue;
  db: PrismaClient;
  debugCollector?: PatternRerunDebugCollector;
}): Promise<void> {
  if (clue.supportEntries && clue.supportEntries.length > 0) {
    debugCollector?.recordClueSupportEntries(clue.supportEntries);
    await materializeReceiptsFromEntries({
      claimId,
      // Persist the full support set, including the representative message.
      // The representative drives claim.summary; replay must be able to see its
      // extracted quote even when clue.quote points at a different display-safe
      // sentence.
      entries: clue.supportEntries,
      debugCollector,
      db,
    });
  }

  if (
    clue.sessionId !== undefined ||
    clue.messageId !== undefined ||
    clue.journalEntryId !== undefined
  ) {
    await materializeReceipt({
      claimId,
      sessionId: clue.sessionId ?? undefined,
      messageId: clue.messageId ?? undefined,
      journalEntryId: clue.journalEntryId ?? undefined,
      quote: clue.quote,
      sourceKind: clue.sourceKind,
      debugCollector,
      db,
    });
  }
}
