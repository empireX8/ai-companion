import {
  UserMapConclusionArea,
  UserMapConclusionStatus,
  type PrismaClient,
} from "@prisma/client";

import prismadb from "../prismadb";
import { evaluateNoWriteDarkRunOutput } from "./dark-run-evaluation-harness";
import {
  runNoWriteUnderstandingDarkRun,
  type RunNoWriteUnderstandingDarkRunResult,
} from "./dark-run-orchestrator";
import { evaluateNoWriteDarkRunTriggerEligibility } from "./no-write-trigger-eligibility";
import {
  persistInternalUserMapConclusionCandidate,
} from "./user-map-candidate-persistence";
import {
  type StructuredUserMapCandidateProposal,
} from "./user-map-candidate-proposal";

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
  | "created";

export type AppMessageCandidateBridgeResult = {
  decision: AppMessageCandidateBridgeDecision;
  reason: string;
  eligibilityDecision?: string;
  persistedConclusionId?: string | null;
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

function isUserMapConclusionArea(value: unknown): value is UserMapConclusionArea {
  return (
    typeof value === "string" &&
    Object.values(UserMapConclusionArea).includes(value as UserMapConclusionArea)
  );
}

function isUserMapConclusionStatus(value: unknown): value is UserMapConclusionStatus {
  return (
    typeof value === "string" &&
    Object.values(UserMapConclusionStatus).includes(value as UserMapConclusionStatus)
  );
}

/** Reads structured candidate proposal attached to no-write dark-run output. */
export function extractStructuredUserMapCandidateProposal(
  output: DarkRunOutputWithOptionalProposal
): StructuredUserMapCandidateProposal | null {
  const proposal = output.userMapCandidateProposal;
  if (!proposal || typeof proposal !== "object") {
    return null;
  }

  if (!isUserMapConclusionArea(proposal.area)) {
    return null;
  }

  const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
  const summary = typeof proposal.summary === "string" ? proposal.summary.trim() : "";
  if (!title || !summary) {
    return null;
  }

  if (!proposal.target || typeof proposal.target !== "object") {
    return null;
  }

  const proposedSummary =
    typeof proposal.target.proposedSummary === "string"
      ? proposal.target.proposedSummary.trim()
      : "";
  if (
    !isUserMapConclusionStatus(proposal.target.requestedStatus) ||
    typeof proposal.target.identityLevelClaim !== "boolean" ||
    typeof proposal.target.requiresReceipt !== "boolean" ||
    !proposedSummary
  ) {
    return null;
  }

  return {
    area: proposal.area,
    title,
    summary,
    target: {
      requestedStatus: proposal.target.requestedStatus,
      identityLevelClaim: proposal.target.identityLevelClaim,
      proposedSummary,
      requiresReceipt: proposal.target.requiresReceipt,
    },
    evidenceSelections: proposal.evidenceSelections,
  };
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
  const eligibility = evaluateNoWriteDarkRunTriggerEligibility({
    userId: args.userId,
    eventType: "app_user_message",
    now,
    noWriteOnly: true,
  });

  if (!eligibility.eligible) {
    return {
      decision: "skipped_ineligible_trigger",
      reason: eligibility.reason,
      eligibilityDecision: eligibility.decision,
    };
  }

  const db = args.db ?? prismadb;
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
      messageId: args.messageId,
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
      messageId: args.messageId,
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
