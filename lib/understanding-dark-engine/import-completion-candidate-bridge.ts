import { type PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import { type DarkRunOutputWithOptionalProposal } from "./app-message-candidate-bridge";
import { persistInternalCandidateFromNoWriteDarkRunOutput } from "./candidate-bridge-dark-run-persistence";
import { evaluateNoWriteDarkRunOutput } from "./dark-run-evaluation-harness";
import { runNoWriteUnderstandingDarkRun } from "./dark-run-orchestrator";
import { resolveCandidateBridgeNoWriteTriggerEligibility } from "./no-write-trigger-runtime-state";

export type ImportCompletionCandidateBridgeDecision =
  | "skipped_ineligible_trigger"
  | "skipped_insufficient_proposal"
  | "skipped_harness_failed"
  | "skipped_gate_abstain"
  | "skipped_persistence_blocked"
  | "skipped_investigation_persistence_blocked"
  | "created"
  | "created_investigation_candidate";

export type ImportCompletionCandidateBridgeResult = {
  decision: ImportCompletionCandidateBridgeDecision;
  reason: string;
  eligibilityDecision?: string;
  persistedConclusionId?: string | null;
  persistedInvestigationId?: string | null;
  blockedWriteReasons?: string[];
};

export async function tryCreateInternalUserMapCandidateFromImportCompletion(args: {
  userId: string;
  sessionId: string;
  now?: Date;
  db?: PrismaClient;
}): Promise<ImportCompletionCandidateBridgeResult> {
  const logTag = "[IMPORT_COMPLETION_CANDIDATE_BRIDGE]";

  const now = args.now ?? new Date();
  const db = args.db ?? prismadb;
  const eligibility = await resolveCandidateBridgeNoWriteTriggerEligibility({
    userId: args.userId,
    eventType: "import_completed",
    now,
    triggerEvidenceAt: now,
    db,
    logTag,
    context: { sessionId: args.sessionId },
  });

  if (!eligibility.eligible) {
    return {
      decision: "skipped_ineligible_trigger",
      reason: eligibility.reason,
      eligibilityDecision: eligibility.decision,
    };
  }

  const darkRunOutput = (await runNoWriteUnderstandingDarkRun({
    userId: args.userId,
    now,
    db: db as unknown as Parameters<typeof runNoWriteUnderstandingDarkRun>[0]["db"],
  })) as DarkRunOutputWithOptionalProposal;

  const harness = evaluateNoWriteDarkRunOutput(darkRunOutput);
  if (!harness.passed) {
    console.warn(logTag, "Harness failed; skipping candidate persistence.", {
      userId: args.userId,
      sessionId: args.sessionId,
      failureCount: harness.summary.failureCount,
    });
    return {
      decision: "skipped_harness_failed",
      reason: "No-write evaluation harness failed.",
    };
  }

  const persistenceOutcome = await persistInternalCandidateFromNoWriteDarkRunOutput({
    userId: args.userId,
    darkRunOutput,
    now,
    db,
    logTag,
    context: { sessionId: args.sessionId },
  });

  return {
    decision: persistenceOutcome.decision,
    reason: persistenceOutcome.reason,
    persistedConclusionId: persistenceOutcome.persistedConclusionId,
    persistedInvestigationId: persistenceOutcome.persistedInvestigationId,
    blockedWriteReasons: persistenceOutcome.blockedWriteReasons,
  };
}
