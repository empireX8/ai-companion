import type { PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import type { RunNoWriteUnderstandingDarkRunResult } from "./dark-run-orchestrator";
import { extractStructuredFieldworkCandidateProposal } from "./fieldwork-candidate-proposal";
import {
  persistInternalFieldworkCandidate,
  type PersistInternalFieldworkCandidateResult,
} from "./fieldwork-candidate-persistence";
import { extractStructuredInvestigationCandidateProposal } from "./investigation-candidate-proposal";
import { extractStructuredModelUpdateCandidateProposal } from "./model-update-candidate-proposal";
import {
  persistInternalModelUpdateCandidate,
  type PersistInternalModelUpdateCandidateResult,
} from "./model-update-candidate-persistence";
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

function fieldworkCandidateWasCreated(
  persistence: PersistInternalFieldworkCandidateResult
): boolean {
  return (
    !!persistence.persistedFieldworkAssignmentId &&
    persistence.payload.candidatesWritten > 0 &&
    persistence.payload.blockedWriteReasons.length === 0
  );
}

function modelUpdateCandidateWasCreated(
  persistence: PersistInternalModelUpdateCandidateResult
): boolean {
  return (
    !!persistence.persistedModelUpdateId &&
    persistence.payload.candidatesWritten > 0 &&
    persistence.payload.blockedWriteReasons.length === 0
  );
}

export type CandidateBridgeDarkRunPersistenceDecision =
  | "skipped_gate_abstain"
  | "skipped_insufficient_proposal"
  | "skipped_persistence_blocked"
  | "skipped_investigation_persistence_blocked"
  | "skipped_fieldwork_persistence_blocked"
  | "skipped_model_update_persistence_blocked"
  | "created"
  | "created_investigation_candidate"
  | "created_fieldwork_candidate"
  | "created_model_update_candidate";

export type CandidateBridgeDarkRunPersistenceResult = {
  decision: CandidateBridgeDarkRunPersistenceDecision;
  reason: string;
  persistedConclusionId?: string | null;
  persistedInvestigationId?: string | null;
  persistedFieldworkAssignmentId?: string | null;
  persistedModelUpdateId?: string | null;
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

  const fieldworkProposal = extractStructuredFieldworkCandidateProposal(
    args.darkRunOutput
  );
  if (fieldworkProposal) {
    const persistence = await persistInternalFieldworkCandidate({
      userId: args.userId,
      proposal: fieldworkProposal,
      now,
      db: db as unknown as Parameters<typeof persistInternalFieldworkCandidate>[0]["db"],
    });

    if (!fieldworkCandidateWasCreated(persistence)) {
      console.info(
        args.logTag,
        "Fieldwork persistence blocked; no candidate written.",
        {
          userId: args.userId,
          ...args.context,
          blockedWriteReasons: persistence.payload.blockedWriteReasons,
          persistedFieldworkAssignmentId: persistence.persistedFieldworkAssignmentId,
          candidatesWritten: persistence.payload.candidatesWritten,
        }
      );
      return {
        decision: "skipped_fieldwork_persistence_blocked",
        reason: "Persistence gates blocked Fieldwork candidate write.",
        blockedWriteReasons: persistence.payload.blockedWriteReasons,
        persistedFieldworkAssignmentId: persistence.persistedFieldworkAssignmentId,
      };
    }

    return {
      decision: "created_fieldwork_candidate",
      reason: "Internal Fieldwork candidate persisted.",
      persistedFieldworkAssignmentId: persistence.persistedFieldworkAssignmentId,
    };
  }

  const modelUpdateProposal = extractStructuredModelUpdateCandidateProposal(
    args.darkRunOutput
  );
  if (modelUpdateProposal) {
    const persistence = await persistInternalModelUpdateCandidate({
      userId: args.userId,
      proposal: modelUpdateProposal,
      now,
      db: db as unknown as Parameters<typeof persistInternalModelUpdateCandidate>[0]["db"],
    });

    if (!modelUpdateCandidateWasCreated(persistence)) {
      console.info(
        args.logTag,
        "ModelUpdate persistence blocked; no candidate written.",
        {
          userId: args.userId,
          ...args.context,
          blockedWriteReasons: persistence.payload.blockedWriteReasons,
          persistedModelUpdateId: persistence.persistedModelUpdateId,
          candidatesWritten: persistence.payload.candidatesWritten,
        }
      );
      return {
        decision: "skipped_model_update_persistence_blocked",
        reason: "Persistence gates blocked ModelUpdate candidate write.",
        blockedWriteReasons: persistence.payload.blockedWriteReasons,
        persistedModelUpdateId: persistence.persistedModelUpdateId,
      };
    }

    return {
      decision: "created_model_update_candidate",
      reason: "Internal ModelUpdate candidate persisted.",
      persistedModelUpdateId: persistence.persistedModelUpdateId,
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
    "No structured UserMap, Investigation, Fieldwork, or ModelUpdate candidate proposal in dark-run output; abstaining.",
    {
      userId: args.userId,
      ...args.context,
    }
  );

  return {
    decision: "skipped_insufficient_proposal",
    reason:
      "Dark-run output lacks structured userMapCandidateProposal, investigationCandidateProposal, fieldworkCandidateProposal, and modelUpdateCandidateProposal.",
  };
}
