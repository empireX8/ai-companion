import { type PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import {
  extractStructuredUserMapCandidateProposal,
  type DarkRunOutputWithOptionalProposal,
} from "./app-message-candidate-bridge";
import { evaluateNoWriteDarkRunOutput } from "./dark-run-evaluation-harness";
import { runNoWriteUnderstandingDarkRun } from "./dark-run-orchestrator";
import { resolveCandidateBridgeNoWriteTriggerEligibility } from "./no-write-trigger-runtime-state";
import { persistInternalUserMapConclusionCandidate } from "./user-map-candidate-persistence";

export type ImportCompletionCandidateBridgeDecision =
  | "skipped_ineligible_trigger"
  | "skipped_insufficient_proposal"
  | "skipped_harness_failed"
  | "skipped_gate_abstain"
  | "skipped_persistence_blocked"
  | "created";

export type ImportCompletionCandidateBridgeResult = {
  decision: ImportCompletionCandidateBridgeDecision;
  reason: string;
  eligibilityDecision?: string;
  persistedConclusionId?: string | null;
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

  if (darkRunOutput.userMapEvaluation.decision === "abstain") {
    return {
      decision: "skipped_gate_abstain",
      reason: "Objectivity gates abstained.",
    };
  }

  const proposal = extractStructuredUserMapCandidateProposal(darkRunOutput);
  if (!proposal) {
    console.info(logTag, "No structured candidate proposal in dark-run output; abstaining.", {
      userId: args.userId,
      sessionId: args.sessionId,
    });
    return {
      decision: "skipped_insufficient_proposal",
      reason:
        "Dark-run output lacks structured userMapCandidateProposal (area, title, summary, target).",
    };
  }

  const persistence = await persistInternalUserMapConclusionCandidate({
    userId: args.userId,
    area: proposal.area,
    title: proposal.title,
    summary: proposal.summary,
    target: proposal.target,
    evidenceSelections: proposal.evidenceSelections,
    now,
    db: db as unknown as Parameters<typeof persistInternalUserMapConclusionCandidate>[0]["db"],
  });

  if (!persistence.persistedConclusionId) {
    console.info(logTag, "Persistence blocked; no candidate written.", {
      userId: args.userId,
      sessionId: args.sessionId,
      blockedWriteReasons: persistence.payload.blockedWriteReasons,
    });
    return {
      decision: "skipped_persistence_blocked",
      reason: "Persistence gates blocked candidate write.",
      blockedWriteReasons: persistence.payload.blockedWriteReasons,
    };
  }

  return {
    decision: "created",
    reason: "Internal candidate persisted.",
    persistedConclusionId: persistence.persistedConclusionId,
  };
}
