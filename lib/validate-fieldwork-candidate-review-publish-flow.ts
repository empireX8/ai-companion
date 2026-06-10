import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  ModelUpdateType,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import { canTransition, getAllowedNextStatuses } from "./candidate-lifecycle-transitions";
import { updateFieldworkCandidateLifecycleStatus } from "./fieldwork-candidate-lifecycle-persistence";
import { buildPublicWatchForWhere } from "./fieldwork-public-visibility";
import { isFieldworkStatusPublishable, publishFieldworkCandidate } from "./fieldwork-publish-helper";
import {
  canPublishInternalFieldworkCandidate,
  getInternalOperatorLifecycleActions,
} from "./internal-user-map-review-operator-actions";

export type ValidateFieldworkCandidateReviewPublishCliArgs = {
  userId?: string;
  candidateId?: string;
  dryRun: boolean;
};

export type ParseValidateFieldworkCandidateReviewPublishCliResult =
  | { ok: true; args: ValidateFieldworkCandidateReviewPublishCliArgs }
  | { ok: false; message: string };

export type FieldworkCandidateValidationSnapshot = {
  id: string;
  userId: string;
  prompt: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  updatedAt: string;
};

export type FieldworkCandidateModelUpdateSnapshot = {
  id: string;
  updateType: string;
  visibility: string;
  isMeaningful: boolean;
  createdAt: string;
};

export type ValidateFieldworkCandidateReviewPublishReport = {
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
    requiresWatchForVisibleStatus: boolean;
    fieldworkStatusPublishable: boolean;
  };
  expectedAfterPublish: {
    publicWatchForVisible: boolean;
    modelUpdateType: string;
  };
  before: {
    candidate: FieldworkCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicWatchForVisible: boolean;
    modelUpdates: FieldworkCandidateModelUpdateSnapshot[];
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
    candidate: FieldworkCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicWatchForVisible: boolean;
    modelUpdates: FieldworkCandidateModelUpdateSnapshot[];
    canPublish: boolean;
  };
};

export function parseValidateFieldworkCandidateReviewPublishCliArgs(
  argv: string[]
): ParseValidateFieldworkCandidateReviewPublishCliResult {
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
    prompt: string;
    status: string;
    visibility: string;
    candidateLifecycleStatus: string | null;
    updatedAt: Date;
  } | null
): FieldworkCandidateValidationSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    prompt: row.prompt,
    status: row.status,
    visibility: row.visibility,
    candidateLifecycleStatus: row.candidateLifecycleStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildLifecyclePolicyReport(): ValidateFieldworkCandidateReviewPublishReport["lifecyclePolicy"] {
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
}): ValidateFieldworkCandidateReviewPublishReport["publishPreconditions"] {
  const fieldworkStatusPublishable = isFieldworkStatusPublishable(args.status as never);

  const canPublish = canPublishInternalFieldworkCandidate({
    candidateLifecycleStatus: args.candidateLifecycleStatus as CandidateLifecycleStatus | null,
    visibility: args.visibility as FieldworkAssignmentVisibility,
    status: args.status as never,
  });

  return {
    canPublish,
    requiresPromoted: args.candidateLifecycleStatus === CandidateLifecycleStatus.promoted,
    requiresInternalOnly: args.visibility === FieldworkAssignmentVisibility.internal_only,
    requiresWatchForVisibleStatus: fieldworkStatusPublishable,
    fieldworkStatusPublishable,
  };
}

function buildExpectedAfterPublish(args: {
  status: string;
  candidateLifecycleStatus: string | null;
  visibility: string;
}): ValidateFieldworkCandidateReviewPublishReport["expectedAfterPublish"] {
  const fieldworkStatusPublishable = isFieldworkStatusPublishable(args.status as never);

  return {
    publicWatchForVisible:
      args.visibility === FieldworkAssignmentVisibility.user_visible ||
      (args.candidateLifecycleStatus === CandidateLifecycleStatus.promoted &&
        fieldworkStatusPublishable),
    modelUpdateType: ModelUpdateType.fieldwork_assigned,
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
    args.visibility === FieldworkAssignmentVisibility.internal_only
  ) {
    planned.push("publish");
  }

  return planned;
}

async function findSuitableFieldworkCandidate(args: {
  db: PrismaClient;
  userId?: string;
}): Promise<{ id: string; userId: string } | null> {
  const baseWhere = {
    visibility: FieldworkAssignmentVisibility.internal_only,
    candidateLifecycleStatus: { not: null },
    ...(args.userId ? { userId: args.userId } : {}),
  };

  const preferredStatuses = [
    CandidateLifecycleStatus.proposed,
    CandidateLifecycleStatus.held_for_more_evidence,
  ];

  for (const status of preferredStatuses) {
    const row = await args.db.fieldworkAssignment.findFirst({
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

  return args.db.fieldworkAssignment.findFirst({
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
    const row = await args.db.fieldworkAssignment.findFirst({
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

  const discovered = await findSuitableFieldworkCandidate({
    db: args.db,
    userId: args.userId,
  });

  return discovered ? { userId: discovered.userId, candidateId: discovered.id } : null;
}

async function loadValidationState(args: {
  db: PrismaClient;
  userId: string;
  candidateId: string;
}) {
  const candidate = await args.db.fieldworkAssignment.findFirst({
    where: {
      id: args.candidateId,
      userId: args.userId,
    },
    select: {
      id: true,
      userId: true,
      prompt: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      updatedAt: true,
    },
  });

  const [evidenceLinkCount, publicWatchForVisible, modelUpdates] = await Promise.all([
    args.db.understandingEvidenceLink.count({
      where: {
        userId: args.userId,
        targetType: UnderstandingLinkTargetType.fieldwork_assignment,
        targetId: args.candidateId,
      },
    }),
    args.db.fieldworkAssignment.count({
      where: buildPublicWatchForWhere({
        userId: args.userId,
        id: args.candidateId,
      }),
    }),
    args.db.modelUpdate.findMany({
      where: {
        userId: args.userId,
        affectedObjectType: UnderstandingLinkTargetType.fieldwork_assignment,
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
    ? canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: candidate.candidateLifecycleStatus,
        visibility: candidate.visibility as FieldworkAssignmentVisibility,
        status: candidate.status as never,
      })
    : false;

  return {
    candidate: toCandidateSnapshot(candidate),
    evidenceLinkCount,
    publicWatchForVisible: publicWatchForVisible > 0,
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
}): ValidateFieldworkCandidateReviewPublishReport {
  const lifecyclePolicy = buildLifecyclePolicyReport();
  const diagnosticMessage = args.candidateId
    ? `No internal FieldworkAssignment candidate found for candidateId=${args.candidateId}${
        args.userId ? ` and userId=${args.userId}` : ""
      }.`
    : args.userId
      ? `No suitable internal FieldworkAssignment candidate found for userId=${args.userId}. ` +
        "Need visibility=internal_only and candidateLifecycleStatus!=null " +
        "(preferably proposed or held_for_more_evidence)."
      : "No suitable internal FieldworkAssignment candidate found. " +
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
      requiresWatchForVisibleStatus: false,
      fieldworkStatusPublishable: false,
    },
    expectedAfterPublish: {
      publicWatchForVisible: false,
      modelUpdateType: ModelUpdateType.fieldwork_assigned,
    },
    before: {
      candidate: null,
      evidenceLinkCount: 0,
      publicWatchForVisible: false,
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
      publicWatchForVisible: false,
      modelUpdates: [],
      canPublish: false,
    },
  };
}

export async function runValidateFieldworkCandidateReviewPublishFlow(args: {
  userId?: string;
  candidateId?: string;
  dryRun?: boolean;
  now?: Date;
  db: PrismaClient;
}): Promise<ValidateFieldworkCandidateReviewPublishReport> {
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
        requiresWatchForVisibleStatus: false,
        fieldworkStatusPublishable: false,
      };

  const expectedAfterPublish = before.rawCandidate
    ? buildExpectedAfterPublish({
        status: before.rawCandidate.status,
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
      })
    : {
        publicWatchForVisible: false,
        modelUpdateType: ModelUpdateType.fieldwork_assigned,
      };

  const plannedActions = before.rawCandidate
    ? buildPlannedActions({
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
      })
    : [];

  const steps: ValidateFieldworkCandidateReviewPublishReport["steps"] = {
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
        before.rawCandidate.visibility === FieldworkAssignmentVisibility.user_visible
          ? "Candidate is already user_visible."
          : "Publish preconditions are not met.";
    } else {
      steps.publish.skippedReason = "Dry-run mode; publish was not attempted.";
      steps.publish.newVisibility = FieldworkAssignmentVisibility.user_visible;
    }
  } else {
    if (plannedActions.includes("hold_for_more_evidence")) {
      steps.holdForMoreEvidence.attempted = true;
      const holdResult = await updateFieldworkCandidateLifecycleStatus(
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

    const afterHoldState = await args.db.fieldworkAssignment.findFirst({
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
      const promoteResult = await updateFieldworkCandidateLifecycleStatus(
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

    const afterPromoteState = await args.db.fieldworkAssignment.findFirst({
      where: { id: candidateId, userId },
      select: {
        candidateLifecycleStatus: true,
        visibility: true,
        status: true,
      },
    });

    const canPublishNow = afterPromoteState
      ? canPublishInternalFieldworkCandidate({
          candidateLifecycleStatus: afterPromoteState.candidateLifecycleStatus,
          visibility: afterPromoteState.visibility,
          status: afterPromoteState.status,
        })
      : false;

    if (canPublishNow) {
      steps.publish.attempted = true;
      const publishResult = await publishFieldworkCandidate(userId, candidateId, {
        db: args.db,
        now,
      });
      steps.publish.newVisibility = publishResult.newVisibility;
    } else {
      steps.publish.skippedReason =
        afterPromoteState?.visibility === FieldworkAssignmentVisibility.user_visible
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
      publicWatchForVisible: before.publicWatchForVisible,
      modelUpdates: before.modelUpdates,
      availableOperatorActions: before.availableOperatorActions,
      canPublish: before.canPublish,
    },
    plannedActions,
    steps,
    after: {
      candidate: after.candidate,
      evidenceLinkCount: after.evidenceLinkCount,
      publicWatchForVisible: after.publicWatchForVisible,
      modelUpdates: after.modelUpdates,
      canPublish: after.canPublish,
    },
  };
}
