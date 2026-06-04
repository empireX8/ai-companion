import type { PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import type { RunNoWriteUnderstandingDarkRunResult } from "./dark-run-orchestrator";
import { extractStructuredInvestigationCandidateProposal } from "./investigation-candidate-proposal";
import { extractStructuredUserMapCandidateProposal } from "./user-map-candidate-proposal";
import {
  persistInternalInvestigationCandidate,
  type PersistInternalInvestigationCandidateResult,
} from "./investigation-candidate-persistence";
import { persistInternalUserMapConclusionCandidate } from "./user-map-candidate-persistence";

function investigationCandidateWasCreated(
  persistence: PersistInternalInvestigationCandidateResult
): boolean {
  return (
    !!persistence.persistedInvestigationId &&
    persistence.payload.candidatesWritten > 0 &&
    persistence.payload.blockedWriteReasons.length === 0
  );
}

export type CandidateBridgeDarkRunPersistenceDecision =
  | "skipped_gate_abstain"
  | "skipped_insufficient_proposal"
  | "skipped_persistence_blocked"
  | "skipped_investigation_persistence_blocked"
  | "created"
  | "created_investigation_candidate";

export type CandidateBridgeDarkRunPersistenceResult = {
  decision: CandidateBridgeDarkRunPersistenceDecision;
  reason: string;
  persistedConclusionId?: string | null;
  persistedInvestigationId?: string | null;
  blockedWriteReasons?: string[];
};

export async function persistInternalCandidateFromNoWriteDarkRunOutput(args: {
  userId: string;
  darkRunOutput: RunNoWriteUnderstandingDarkRunResult;
  now?: Date;
  db?: PrismaClient;
  logTag: string;
  context?: Record<string, unknown>;
}): Promise<CandidateBridgeDarkRunPersistenceResult> {
  const now = args.now ?? new Date();
  const db = args.db ?? prismadb;

  const userMapProposal = extractStructuredUserMapCandidateProposal(args.darkRunOutput);
  if (userMapProposal) {
    if (args.darkRunOutput.userMapEvaluation.decision === "abstain") {
      return {
        decision: "skipped_gate_abstain",
        reason: "Objectivity gates abstained.",
      };
    }

    const persistence = await persistInternalUserMapConclusionCandidate({
      userId: args.userId,
      area: userMapProposal.area,
      title: userMapProposal.title,
      summary: userMapProposal.summary,
      target: userMapProposal.target,
      evidenceSelections: userMapProposal.evidenceSelections,
      now,
      db: db as unknown as Parameters<typeof persistInternalUserMapConclusionCandidate>[0]["db"],
    });

    if (!persistence.persistedConclusionId) {
      console.info(args.logTag, "UserMap persistence blocked; no candidate written.", {
        userId: args.userId,
        ...args.context,
        blockedWriteReasons: persistence.payload.blockedWriteReasons,
      });
      return {
        decision: "skipped_persistence_blocked",
        reason: "Persistence gates blocked UserMap candidate write.",
        blockedWriteReasons: persistence.payload.blockedWriteReasons,
        persistedConclusionId: null,
      };
    }

    return {
      decision: "created",
      reason: "Internal UserMap candidate persisted.",
      persistedConclusionId: persistence.persistedConclusionId,
    };
  }

  const investigationProposal = extractStructuredInvestigationCandidateProposal(
    args.darkRunOutput
  );
  if (investigationProposal) {
    const persistence = await persistInternalInvestigationCandidate({
      userId: args.userId,
      proposal: investigationProposal,
      now,
      db: db as unknown as Parameters<typeof persistInternalInvestigationCandidate>[0]["db"],
    });

    if (!investigationCandidateWasCreated(persistence)) {
      console.info(
        args.logTag,
        "Investigation persistence blocked; no candidate written.",
        {
          userId: args.userId,
          ...args.context,
          blockedWriteReasons: persistence.payload.blockedWriteReasons,
          persistedInvestigationId: persistence.persistedInvestigationId,
          candidatesWritten: persistence.payload.candidatesWritten,
        }
      );
      return {
        decision: "skipped_investigation_persistence_blocked",
        reason: "Persistence gates blocked Investigation candidate write.",
        blockedWriteReasons: persistence.payload.blockedWriteReasons,
        persistedInvestigationId: persistence.persistedInvestigationId,
      };
    }

    return {
      decision: "created_investigation_candidate",
      reason: "Internal Investigation candidate persisted.",
      persistedInvestigationId: persistence.persistedInvestigationId,
    };
  }

  if (args.darkRunOutput.userMapEvaluation.decision === "abstain") {
    return {
      decision: "skipped_gate_abstain",
      reason: "Objectivity gates abstained.",
    };
  }

  console.info(
    args.logTag,
    "No structured UserMap or Investigation candidate proposal in dark-run output; abstaining.",
    {
      userId: args.userId,
      ...args.context,
    }
  );

  return {
    decision: "skipped_insufficient_proposal",
    reason:
      "Dark-run output lacks structured userMapCandidateProposal and investigationCandidateProposal.",
  };
}
