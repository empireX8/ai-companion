import {
  CandidateLifecycleStatus,
  InvestigationVisibility,
  ModelUpdateType,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import { canTransition, getAllowedNextStatuses } from "./candidate-lifecycle-transitions";
import { updateInvestigationCandidateLifecycleStatus } from "./investigation-candidate-lifecycle-persistence";
import { buildPublicActiveInvestigationWhere } from "./investigation-public-visibility";
import { publishInvestigationCandidate } from "./investigation-publish-helper";
import {
  canPublishInternalInvestigationCandidate,
  getInternalOperatorLifecycleActions,
  isActiveQuestionVisibleInvestigationStatus,
} from "./internal-user-map-review-operator-actions";

export type ValidateInvestigationCandidateReviewPublishCliArgs = {
  userId?: string;
  candidateId?: string;
  dryRun: boolean;
};

export type ParseValidateInvestigationCandidateReviewPublishCliResult =
  | { ok: true; args: ValidateInvestigationCandidateReviewPublishCliArgs }
  | { ok: false; message: string };

export type InvestigationCandidateValidationSnapshot = {
  id: string;
  userId: string;
  title: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  updatedAt: string;
};

export type InvestigationCandidateModelUpdateSnapshot = {
  id: string;
  updateType: string;
  visibility: string;
  isMeaningful: boolean;
  createdAt: string;
};

export type ValidateInvestigationCandidateReviewPublishReport = {
  found: boolean;
  diagnosticMessage: string | null;
  userId: string | null;
  candidateId: string | null;
  dryRun: boolean;
  generatedAt: string;
  lifecyclePolicy: {
    directProposedToPromotedBlocked: boolean;
    holdToPromoteAllowed: boolean;
  };
  publishPreconditions: {
    canPublish: boolean;
    requiresPromoted: boolean;
    requiresInternalOnly: boolean;
    requiresActiveQuestionVisibleStatus: boolean;
    investigationStatusPublishable: boolean;
  };
  expectedAfterPublish: {
    activeQuestionsVisible: boolean;
    modelUpdateType: string;
  };
  before: {
    candidate: InvestigationCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicActiveQuestionsVisible: boolean;
    modelUpdates: InvestigationCandidateModelUpdateSnapshot[];
    availableOperatorActions: string[];
    canPublish: boolean;
  };
  plannedActions: Array<"hold_for_more_evidence" | "promote" | "publish">;
  steps: {
    holdForMoreEvidence: {
      attempted: boolean;
      skippedReason: string | null;
      previousStatus: string | null;
      newStatus: string | null;
    };
    promote: {
      attempted: boolean;
      skippedReason: string | null;
      previousStatus: string | null;
      newStatus: string | null;
    };
    publish: {
      attempted: boolean;
      skippedReason: string | null;
      previousVisibility: string | null;
      newVisibility: string | null;
    };
  };
  after: {
    candidate: InvestigationCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicActiveQuestionsVisible: boolean;
    modelUpdates: InvestigationCandidateModelUpdateSnapshot[];
    canPublish: boolean;
  };
};

export function parseValidateInvestigationCandidateReviewPublishCliArgs(
  argv: string[]
): ParseValidateInvestigationCandidateReviewPublishCliResult {
  let userId: string | undefined;
  let candidateId: string | undefined;
  let dryRun = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--candidate-id" && argv[index + 1]) {
      candidateId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--execute" || arg === "--no-dry-run") {
      dryRun = false;
    }
  }

  return {
    ok: true,
    args: {
      userId,
      candidateId,
      dryRun,
    },
  };
}

function toCandidateSnapshot(
  row: {
    id: string;
    userId: string;
    title: string;
    status: string;
    visibility: string;
    candidateLifecycleStatus: string | null;
    updatedAt: Date;
  } | null
): InvestigationCandidateValidationSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    candidateLifecycleStatus: row.candidateLifecycleStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildLifecyclePolicyReport(): ValidateInvestigationCandidateReviewPublishReport["lifecyclePolicy"] {
  const directProposedToPromoted = canTransition(
    CandidateLifecycleStatus.proposed,
    CandidateLifecycleStatus.promoted
  );
  const holdToPromote = canTransition(
    CandidateLifecycleStatus.held_for_more_evidence,
    CandidateLifecycleStatus.promoted
  );

  return {
    directProposedToPromotedBlocked: !directProposedToPromoted.allowed,
    holdToPromoteAllowed: holdToPromote.allowed,
  };
}

function buildPublishPreconditions(args: {
  candidateLifecycleStatus: string | null;
  visibility: string;
  status: string;
}): ValidateInvestigationCandidateReviewPublishReport["publishPreconditions"] {
  const investigationStatusPublishable = isActiveQuestionVisibleInvestigationStatus(
    args.status as never
  );

  const canPublish = canPublishInternalInvestigationCandidate({
    candidateLifecycleStatus: args.candidateLifecycleStatus as CandidateLifecycleStatus | null,
    visibility: args.visibility as InvestigationVisibility,
    status: args.status as never,
  });

  return {
    canPublish,
    requiresPromoted: args.candidateLifecycleStatus === CandidateLifecycleStatus.promoted,
    requiresInternalOnly: args.visibility === InvestigationVisibility.internal_only,
    requiresActiveQuestionVisibleStatus: investigationStatusPublishable,
    investigationStatusPublishable,
  };
}

function buildExpectedAfterPublish(args: {
  status: string;
  candidateLifecycleStatus: string | null;
  visibility: string;
}): ValidateInvestigationCandidateReviewPublishReport["expectedAfterPublish"] {
  const investigationStatusPublishable = isActiveQuestionVisibleInvestigationStatus(
    args.status as never
  );

  return {
    activeQuestionsVisible:
      args.visibility === InvestigationVisibility.user_visible ||
      (args.candidateLifecycleStatus === CandidateLifecycleStatus.promoted &&
        investigationStatusPublishable),
    modelUpdateType: ModelUpdateType.investigation_opened,
  };
}

function buildPlannedActions(args: {
  candidateLifecycleStatus: string | null;
  visibility: string;
}): Array<"hold_for_more_evidence" | "promote" | "publish"> {
  const planned: Array<"hold_for_more_evidence" | "promote" | "publish"> = [];

  let lifecycleStatus = args.candidateLifecycleStatus as CandidateLifecycleStatus | null;

  if (lifecycleStatus === CandidateLifecycleStatus.proposed) {
    const allowed = getAllowedNextStatuses(lifecycleStatus);
    if (allowed.has(CandidateLifecycleStatus.held_for_more_evidence)) {
      planned.push("hold_for_more_evidence");
      lifecycleStatus = CandidateLifecycleStatus.held_for_more_evidence;
    }
  }

  if (lifecycleStatus === CandidateLifecycleStatus.held_for_more_evidence) {
    const allowed = getAllowedNextStatuses(lifecycleStatus);
    if (allowed.has(CandidateLifecycleStatus.promoted)) {
      planned.push("promote");
      lifecycleStatus = CandidateLifecycleStatus.promoted;
    }
  }

  if (
    lifecycleStatus === CandidateLifecycleStatus.promoted &&
    args.visibility === InvestigationVisibility.internal_only
  ) {
    planned.push("publish");
  }

  return planned;
}

async function findSuitableInvestigationCandidate(args: {
  db: PrismaClient;
  userId?: string;
}): Promise<{ id: string; userId: string } | null> {
  const baseWhere = {
    visibility: InvestigationVisibility.internal_only,
    candidateLifecycleStatus: { not: null },
    ...(args.userId ? { userId: args.userId } : {}),
  };

  const preferredStatuses = [
    CandidateLifecycleStatus.proposed,
    CandidateLifecycleStatus.held_for_more_evidence,
  ];

  for (const status of preferredStatuses) {
    const row = await args.db.investigation.findFirst({
      where: {
        ...baseWhere,
        candidateLifecycleStatus: status,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        userId: true,
      },
    });

    if (row) {
      return row;
    }
  }

  return args.db.investigation.findFirst({
    where: baseWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
    },
  });
}

async function resolveCandidateTarget(args: {
  db: PrismaClient;
  userId?: string;
  candidateId?: string;
}): Promise<{ userId: string; candidateId: string } | null> {
  if (args.candidateId) {
    const row = await args.db.investigation.findFirst({
      where: {
        id: args.candidateId,
        ...(args.userId ? { userId: args.userId } : {}),
      },
      select: {
        id: true,
        userId: true,
      },
    });

    return row ? { userId: row.userId, candidateId: row.id } : null;
  }

  const discovered = await findSuitableInvestigationCandidate({
    db: args.db,
    userId: args.userId,
  });

  return discovered
    ? { userId: discovered.userId, candidateId: discovered.id }
    : null;
}

async function loadValidationState(args: {
  db: PrismaClient;
  userId: string;
  candidateId: string;
}) {
  const candidate = await args.db.investigation.findFirst({
    where: {
      id: args.candidateId,
      userId: args.userId,
    },
    select: {
      id: true,
      userId: true,
      title: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      updatedAt: true,
    },
  });

  const [evidenceLinkCount, publicActiveQuestionsVisible, modelUpdates] = await Promise.all([
    args.db.understandingEvidenceLink.count({
      where: {
        userId: args.userId,
        targetType: UnderstandingLinkTargetType.investigation,
        targetId: args.candidateId,
      },
    }),
    args.db.investigation.count({
      where: buildPublicActiveInvestigationWhere({
        userId: args.userId,
        id: args.candidateId,
      }),
    }),
    args.db.modelUpdate.findMany({
      where: {
        userId: args.userId,
        affectedObjectType: UnderstandingLinkTargetType.investigation,
        affectedObjectId: args.candidateId,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        updateType: true,
        visibility: true,
        isMeaningful: true,
        createdAt: true,
      },
    }),
  ]);

  const availableOperatorActions = candidate?.candidateLifecycleStatus
    ? getInternalOperatorLifecycleActions(
        candidate.candidateLifecycleStatus as CandidateLifecycleStatus
      )
    : [];

  const canPublish = candidate
    ? canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: candidate.candidateLifecycleStatus,
        visibility: candidate.visibility as InvestigationVisibility,
        status: candidate.status as never,
      })
    : false;

  return {
    candidate: toCandidateSnapshot(candidate),
    evidenceLinkCount,
    publicActiveQuestionsVisible: publicActiveQuestionsVisible > 0,
    modelUpdates: modelUpdates.map((row) => ({
      id: row.id,
      updateType: row.updateType,
      visibility: row.visibility,
      isMeaningful: row.isMeaningful,
      createdAt: row.createdAt.toISOString(),
    })),
    availableOperatorActions,
    canPublish,
    rawCandidate: candidate,
  };
}

function buildNoCandidateReport(args: {
  dryRun: boolean;
  now: Date;
  userId?: string;
  candidateId?: string;
}): ValidateInvestigationCandidateReviewPublishReport {
  const lifecyclePolicy = buildLifecyclePolicyReport();
  const diagnosticMessage = args.candidateId
    ? `No internal Investigation candidate found for candidateId=${args.candidateId}${
        args.userId ? ` and userId=${args.userId}` : ""
      }.`
    : args.userId
      ? `No suitable internal Investigation candidate found for userId=${args.userId}. ` +
        "Need visibility=internal_only and candidateLifecycleStatus!=null " +
        "(preferably proposed or held_for_more_evidence)."
      : "No suitable internal Investigation candidate found. " +
        "Need visibility=internal_only and candidateLifecycleStatus!=null " +
        "(preferably proposed or held_for_more_evidence).";

  return {
    found: false,
    diagnosticMessage,
    userId: args.userId ?? null,
    candidateId: args.candidateId ?? null,
    dryRun: args.dryRun,
    generatedAt: args.now.toISOString(),
    lifecyclePolicy,
    publishPreconditions: {
      canPublish: false,
      requiresPromoted: false,
      requiresInternalOnly: false,
      requiresActiveQuestionVisibleStatus: false,
      investigationStatusPublishable: false,
    },
    expectedAfterPublish: {
      activeQuestionsVisible: false,
      modelUpdateType: ModelUpdateType.investigation_opened,
    },
    before: {
      candidate: null,
      evidenceLinkCount: 0,
      publicActiveQuestionsVisible: false,
      modelUpdates: [],
      availableOperatorActions: [],
      canPublish: false,
    },
    plannedActions: [],
    steps: {
      holdForMoreEvidence: {
        attempted: false,
        skippedReason: diagnosticMessage,
        previousStatus: null,
        newStatus: null,
      },
      promote: {
        attempted: false,
        skippedReason: diagnosticMessage,
        previousStatus: null,
        newStatus: null,
      },
      publish: {
        attempted: false,
        skippedReason: diagnosticMessage,
        previousVisibility: null,
        newVisibility: null,
      },
    },
    after: {
      candidate: null,
      evidenceLinkCount: 0,
      publicActiveQuestionsVisible: false,
      modelUpdates: [],
      canPublish: false,
    },
  };
}

export async function runValidateInvestigationCandidateReviewPublishFlow(args: {
  userId?: string;
  candidateId?: string;
  dryRun?: boolean;
  now?: Date;
  db: PrismaClient;
}): Promise<ValidateInvestigationCandidateReviewPublishReport> {
  const now = args.now ?? new Date();
  const dryRun = args.dryRun ?? true;

  const target = await resolveCandidateTarget({
    db: args.db,
    userId: args.userId,
    candidateId: args.candidateId,
  });

  if (!target) {
    return buildNoCandidateReport({
      dryRun,
      now,
      userId: args.userId,
      candidateId: args.candidateId,
    });
  }

  const userId = target.userId;
  const candidateId = target.candidateId;

  const before = await loadValidationState({
    db: args.db,
    userId,
    candidateId,
  });

  const lifecyclePolicy = buildLifecyclePolicyReport();
  const publishPreconditions = before.rawCandidate
    ? buildPublishPreconditions({
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
        status: before.rawCandidate.status,
      })
    : {
        canPublish: false,
        requiresPromoted: false,
        requiresInternalOnly: false,
        requiresActiveQuestionVisibleStatus: false,
        investigationStatusPublishable: false,
      };

  const expectedAfterPublish = before.rawCandidate
    ? buildExpectedAfterPublish({
        status: before.rawCandidate.status,
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
      })
    : {
        activeQuestionsVisible: false,
        modelUpdateType: ModelUpdateType.investigation_opened,
      };

  const plannedActions = before.rawCandidate
    ? buildPlannedActions({
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
      })
    : [];

  const steps: ValidateInvestigationCandidateReviewPublishReport["steps"] = {
    holdForMoreEvidence: {
      attempted: false,
      skippedReason: null,
      previousStatus: before.candidate?.candidateLifecycleStatus ?? null,
      newStatus: null,
    },
    promote: {
      attempted: false,
      skippedReason: null,
      previousStatus: before.candidate?.candidateLifecycleStatus ?? null,
      newStatus: null,
    },
    publish: {
      attempted: false,
      skippedReason: null,
      previousVisibility: before.candidate?.visibility ?? null,
      newVisibility: null,
    },
  };

  if (!before.rawCandidate) {
    steps.holdForMoreEvidence.skippedReason = "Candidate not found for user.";
    steps.promote.skippedReason = "Candidate not found for user.";
    steps.publish.skippedReason = "Candidate not found for user.";
  } else if (dryRun) {
    if (!plannedActions.includes("hold_for_more_evidence")) {
      steps.holdForMoreEvidence.skippedReason =
        before.rawCandidate.candidateLifecycleStatus !== CandidateLifecycleStatus.proposed
          ? "Candidate is not in proposed status."
          : "Hold is not an allowed next lifecycle action.";
    } else {
      steps.holdForMoreEvidence.skippedReason =
        "Dry-run mode; hold_for_more_evidence was not attempted.";
      steps.holdForMoreEvidence.newStatus =
        CandidateLifecycleStatus.held_for_more_evidence;
    }

    if (!plannedActions.includes("promote")) {
      steps.promote.skippedReason =
        before.rawCandidate.candidateLifecycleStatus === CandidateLifecycleStatus.promoted
          ? "Candidate is already promoted."
          : before.rawCandidate.candidateLifecycleStatus === CandidateLifecycleStatus.proposed
            ? "Direct proposed → promoted is blocked; hold then promote is required."
            : "Promote is not an allowed next lifecycle action.";
    } else {
      steps.promote.skippedReason = "Dry-run mode; promote was not attempted.";
      steps.promote.newStatus = CandidateLifecycleStatus.promoted;
    }

    if (!plannedActions.includes("publish")) {
      steps.publish.skippedReason =
        before.rawCandidate.visibility === InvestigationVisibility.user_visible
          ? "Candidate is already user_visible."
          : "Publish preconditions are not met.";
    } else {
      steps.publish.skippedReason = "Dry-run mode; publish was not attempted.";
      steps.publish.newVisibility = InvestigationVisibility.user_visible;
    }
  } else {
    if (plannedActions.includes("hold_for_more_evidence")) {
      steps.holdForMoreEvidence.attempted = true;
      const holdResult = await updateInvestigationCandidateLifecycleStatus(
        userId,
        candidateId,
        CandidateLifecycleStatus.held_for_more_evidence,
        { db: args.db, now }
      );
      steps.holdForMoreEvidence.newStatus = holdResult.newStatus;
      steps.promote.previousStatus = holdResult.newStatus;
    } else {
      steps.holdForMoreEvidence.skippedReason =
        before.rawCandidate.candidateLifecycleStatus !== CandidateLifecycleStatus.proposed
          ? "Candidate is not in proposed status."
          : "Hold is not an allowed next lifecycle action.";
      steps.holdForMoreEvidence.newStatus =
        before.rawCandidate.candidateLifecycleStatus;
    }

    const afterHoldState = await args.db.investigation.findFirst({
      where: { id: candidateId, userId },
      select: { candidateLifecycleStatus: true },
    });

    const canPromote =
      afterHoldState?.candidateLifecycleStatus ===
        CandidateLifecycleStatus.held_for_more_evidence ||
      afterHoldState?.candidateLifecycleStatus === CandidateLifecycleStatus.promoted;

    if (
      canPromote &&
      afterHoldState?.candidateLifecycleStatus !== CandidateLifecycleStatus.promoted
    ) {
      steps.promote.attempted = true;
      const promoteResult = await updateInvestigationCandidateLifecycleStatus(
        userId,
        candidateId,
        CandidateLifecycleStatus.promoted,
        { db: args.db, now }
      );
      steps.promote.newStatus = promoteResult.newStatus;
    } else if (afterHoldState?.candidateLifecycleStatus === CandidateLifecycleStatus.promoted) {
      steps.promote.skippedReason = "Candidate is already promoted.";
      steps.promote.newStatus = CandidateLifecycleStatus.promoted;
    } else {
      steps.promote.skippedReason =
        before.rawCandidate.candidateLifecycleStatus === CandidateLifecycleStatus.proposed
          ? "Direct proposed → promoted is blocked; hold then promote is required."
          : "Promote is not an allowed next lifecycle action.";
      steps.promote.newStatus = afterHoldState?.candidateLifecycleStatus ?? null;
    }

    const afterPromoteState = await args.db.investigation.findFirst({
      where: { id: candidateId, userId },
      select: {
        candidateLifecycleStatus: true,
        visibility: true,
        status: true,
      },
    });

    const canPublishNow = afterPromoteState
      ? canPublishInternalInvestigationCandidate({
          candidateLifecycleStatus: afterPromoteState.candidateLifecycleStatus,
          visibility: afterPromoteState.visibility,
          status: afterPromoteState.status,
        })
      : false;

    if (canPublishNow) {
      steps.publish.attempted = true;
      const publishResult = await publishInvestigationCandidate(userId, candidateId, {
        db: args.db,
        now,
      });
      steps.publish.newVisibility = publishResult.newVisibility;
    } else {
      steps.publish.skippedReason =
        afterPromoteState?.visibility === InvestigationVisibility.user_visible
          ? "Candidate is already user_visible."
          : "Publish preconditions are not met.";
      steps.publish.newVisibility = afterPromoteState?.visibility ?? null;
    }
  }

  const after = await loadValidationState({
    db: args.db,
    userId,
    candidateId,
  });

  return {
    found: true,
    diagnosticMessage: null,
    userId,
    candidateId,
    dryRun,
    generatedAt: now.toISOString(),
    lifecyclePolicy,
    publishPreconditions,
    expectedAfterPublish,
    before: {
      candidate: before.candidate,
      evidenceLinkCount: before.evidenceLinkCount,
      publicActiveQuestionsVisible: before.publicActiveQuestionsVisible,
      modelUpdates: before.modelUpdates,
      availableOperatorActions: before.availableOperatorActions,
      canPublish: before.canPublish,
    },
    plannedActions,
    steps,
    after: {
      candidate: after.candidate,
      evidenceLinkCount: after.evidenceLinkCount,
      publicActiveQuestionsVisible: after.publicActiveQuestionsVisible,
      modelUpdates: after.modelUpdates,
      canPublish: after.canPublish,
    },
  };
}
