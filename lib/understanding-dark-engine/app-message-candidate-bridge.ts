import { type PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import { evaluateNoWriteDarkRunOutput } from "./dark-run-evaluation-harness";
import {
  runNoWriteUnderstandingDarkRun,
  type RunNoWriteUnderstandingDarkRunResult,
} from "./dark-run-orchestrator";
import { persistInternalCandidateFromNoWriteDarkRunOutput } from "./candidate-bridge-dark-run-persistence";
import { resolveCandidateBridgeNoWriteTriggerEligibility } from "./no-write-trigger-runtime-state";
import {
  extractStructuredUserMapCandidateProposal,
  type StructuredUserMapCandidateProposal,
} from "./user-map-candidate-proposal";

export { extractStructuredUserMapCandidateProposal };
export type { StructuredUserMapCandidateProposal };

const APP_MESSAGE_CANDIDATE_BRIDGE_SURFACES = new Set(["journal_chat", "explore_chat"]);

export type DarkRunOutputWithOptionalProposal = RunNoWriteUnderstandingDarkRunResult;

export type AppMessageCandidateBridgeDecision =
  | "skipped_unsupported_session"
  | "skipped_ineligible_trigger"
  | "skipped_insufficient_proposal"
  | "skipped_harness_failed"
  | "skipped_gate_abstain"
  | "skipped_persistence_blocked"
  | "skipped_investigation_persistence_blocked"
  | "skipped_fieldwork_persistence_blocked"
  | "skipped_model_update_persistence_blocked"
  | "created"
  | "created_investigation_candidate"
  | "created_fieldwork_candidate"
  | "created_model_update_candidate";

export type AppMessageCandidateBridgeResult = {
  decision: AppMessageCandidateBridgeDecision;
  reason: string;
  eligibilityDecision?: string;
  persistedConclusionId?: string | null;
  persistedInvestigationId?: string | null;
  persistedFieldworkAssignmentId?: string | null;
  persistedModelUpdateId?: string | null;
  blockedWriteReasons?: string[];
};

export function shouldRunAppMessageCandidateBridgeForSession(session: {
  origin: string | null;
  surfaceType: string | null;
}): boolean {
  return (
    session.origin === "APP" &&
    !!session.surfaceType &&
    APP_MESSAGE_CANDIDATE_BRIDGE_SURFACES.has(session.surfaceType)
  );
}

export async function tryCreateInternalUserMapCandidateFromAppMessage(args: {
  userId: string;
  messageId: string;
  sessionOrigin: string | null;
  sessionSurfaceType: string | null;
  now?: Date;
  reqId?: string;
  db?: PrismaClient;
}): Promise<AppMessageCandidateBridgeResult> {
  const logTag = args.reqId
    ? `[APP_MESSAGE_CANDIDATE_BRIDGE][${args.reqId}]`
    : "[APP_MESSAGE_CANDIDATE_BRIDGE]";

  if (
    !shouldRunAppMessageCandidateBridgeForSession({
      origin: args.sessionOrigin,
      surfaceType: args.sessionSurfaceType,
    })
  ) {
    return {
      decision: "skipped_unsupported_session",
      reason: "Session is not an APP journal_chat or explore_chat surface.",
    };
  }

  const now = args.now ?? new Date();
  const db = args.db ?? prismadb;
  const eligibility = await resolveCandidateBridgeNoWriteTriggerEligibility({
    userId: args.userId,
    eventType: "app_user_message",
    now,
    triggerEvidenceAt: now,
    db,
    logTag,
    context: { messageId: args.messageId },
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
      messageId: args.messageId,
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
    context: { messageId: args.messageId },
  });

  return {
    decision: persistenceOutcome.decision,
    reason: persistenceOutcome.reason,
    persistedConclusionId: persistenceOutcome.persistedConclusionId,
    persistedInvestigationId: persistenceOutcome.persistedInvestigationId,
    persistedFieldworkAssignmentId: persistenceOutcome.persistedFieldworkAssignmentId,
    persistedModelUpdateId: persistenceOutcome.persistedModelUpdateId,
    blockedWriteReasons: persistenceOutcome.blockedWriteReasons,
  };
}
