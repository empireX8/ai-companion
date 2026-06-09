import {
  CandidateLifecycleStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import { updateCandidateLifecycleStatus } from "./candidate-lifecycle-persistence";
import { publishCandidate } from "./candidate-publish-helper";
import { getAllowedNextStatuses } from "./candidate-lifecycle-transitions";
import {
  canPublishInternalCandidate,
  getInternalOperatorLifecycleActions,
} from "./internal-user-map-review-operator-actions";

export type ValidateUserMapCandidateReviewPublishCliArgs = {
  userId: string;
  candidateId: string;
  dryRun: boolean;
};

export type ParseValidateUserMapCandidateReviewPublishCliResult =
  | { ok: true; args: ValidateUserMapCandidateReviewPublishCliArgs }
  | { ok: false; message: string };

export type UserMapCandidateValidationSnapshot = {
  id: string;
  userId: string;
  area: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  confidenceLevel: string;
  evidenceCount: number;
  sourceDiversity: number;
  updatedAt: string;
};

export type UserMapCandidateModelUpdateSnapshot = {
  id: string;
  updateType: string;
  visibility: string;
  isMeaningful: boolean;
  createdAt: string;
};

export type ValidateUserMapCandidateReviewPublishReport = {
  userId: string;
  candidateId: string;
  dryRun: boolean;
  generatedAt: string;
  before: {
    candidate: UserMapCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicYourMapVisible: boolean;
    modelUpdates: UserMapCandidateModelUpdateSnapshot[];
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
    candidate: UserMapCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicYourMapVisible: boolean;
    modelUpdates: UserMapCandidateModelUpdateSnapshot[];
    canPublish: boolean;
  };
};

export function parseValidateUserMapCandidateReviewPublishCliArgs(
  argv: string[]
): ParseValidateUserMapCandidateReviewPublishCliResult {
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

  if (!userId) {
    return { ok: false, message: "Missing required --user-id argument." };
  }

  if (!candidateId) {
    return { ok: false, message: "Missing required --candidate-id argument." };
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
    area: string;
    status: string;
    visibility: string;
    candidateLifecycleStatus: string | null;
    confidenceLevel: string;
    evidenceCount: number;
    sourceDiversity: number;
    updatedAt: Date;
  } | null
): UserMapCandidateValidationSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    area: row.area,
    status: row.status,
    visibility: row.visibility,
    candidateLifecycleStatus: row.candidateLifecycleStatus,
    confidenceLevel: row.confidenceLevel,
    evidenceCount: row.evidenceCount,
    sourceDiversity: row.sourceDiversity,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadValidationState(args: {
  db: PrismaClient;
  userId: string;
  candidateId: string;
}) {
  const candidate = await args.db.userMapConclusion.findFirst({
    where: {
      id: args.candidateId,
      userId: args.userId,
    },
    select: {
      id: true,
      userId: true,
      area: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      confidenceLevel: true,
      evidenceCount: true,
      sourceDiversity: true,
      updatedAt: true,
    },
  });

  const [evidenceLinkCount, publicYourMapVisible, modelUpdates] = await Promise.all([
    args.db.understandingEvidenceLink.count({
      where: {
        userId: args.userId,
        targetType: UnderstandingLinkTargetType.usermap_conclusion,
        targetId: args.candidateId,
      },
    }),
    args.db.userMapConclusion.count({
      where: {
        id: args.candidateId,
        userId: args.userId,
        visibility: UserMapConclusionVisibility.user_visible,
      },
    }),
    args.db.modelUpdate.findMany({
      where: {
        userId: args.userId,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
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
    ? canPublishInternalCandidate({
        candidateLifecycleStatus: candidate.candidateLifecycleStatus,
        visibility: candidate.visibility as UserMapConclusionVisibility,
      })
    : false;

  return {
    candidate: toCandidateSnapshot(candidate),
    evidenceLinkCount,
    publicYourMapVisible: publicYourMapVisible > 0,
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
    args.visibility === UserMapConclusionVisibility.internal_only
  ) {
    planned.push("publish");
  }

  return planned;
}

export async function runValidateUserMapCandidateReviewPublishFlow(args: {
  userId: string;
  candidateId: string;
  dryRun?: boolean;
  now?: Date;
  db: PrismaClient;
}): Promise<ValidateUserMapCandidateReviewPublishReport> {
  const now = args.now ?? new Date();
  const dryRun = args.dryRun ?? true;

  const before = await loadValidationState({
    db: args.db,
    userId: args.userId,
    candidateId: args.candidateId,
  });

  const plannedActions = before.rawCandidate
    ? buildPlannedActions({
        candidateLifecycleStatus: before.rawCandidate.candidateLifecycleStatus,
        visibility: before.rawCandidate.visibility,
      })
    : [];

  const steps: ValidateUserMapCandidateReviewPublishReport["steps"] = {
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
          : "Promote is not an allowed next lifecycle action.";
    } else {
      steps.promote.skippedReason = "Dry-run mode; promote was not attempted.";
      steps.promote.newStatus = CandidateLifecycleStatus.promoted;
    }

    if (!plannedActions.includes("publish")) {
      steps.publish.skippedReason =
        before.rawCandidate.visibility === UserMapConclusionVisibility.user_visible
          ? "Candidate is already user_visible."
          : "Publish preconditions are not met.";
    } else {
      steps.publish.skippedReason = "Dry-run mode; publish was not attempted.";
      steps.publish.newVisibility = UserMapConclusionVisibility.user_visible;
    }
  } else {
    if (plannedActions.includes("hold_for_more_evidence")) {
      steps.holdForMoreEvidence.attempted = true;
      const holdResult = await updateCandidateLifecycleStatus(
        args.userId,
        args.candidateId,
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

    const afterHoldState = await args.db.userMapConclusion.findFirst({
      where: { id: args.candidateId, userId: args.userId },
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
      const promoteResult = await updateCandidateLifecycleStatus(
        args.userId,
        args.candidateId,
        CandidateLifecycleStatus.promoted,
        { db: args.db, now }
      );
      steps.promote.newStatus = promoteResult.newStatus;
    } else if (afterHoldState?.candidateLifecycleStatus === CandidateLifecycleStatus.promoted) {
      steps.promote.skippedReason = "Candidate is already promoted.";
      steps.promote.newStatus = CandidateLifecycleStatus.promoted;
    } else {
      steps.promote.skippedReason = "Promote is not an allowed next lifecycle action.";
      steps.promote.newStatus = afterHoldState?.candidateLifecycleStatus ?? null;
    }

    const afterPromoteState = await args.db.userMapConclusion.findFirst({
      where: { id: args.candidateId, userId: args.userId },
      select: {
        candidateLifecycleStatus: true,
        visibility: true,
      },
    });

    const canPublishNow = afterPromoteState
      ? canPublishInternalCandidate({
          candidateLifecycleStatus: afterPromoteState.candidateLifecycleStatus,
          visibility: afterPromoteState.visibility,
        })
      : false;

    if (canPublishNow) {
      steps.publish.attempted = true;
      const publishResult = await publishCandidate(args.userId, args.candidateId, {
        db: args.db,
        now,
      });
      steps.publish.newVisibility = publishResult.newVisibility;
    } else {
      steps.publish.skippedReason =
        afterPromoteState?.visibility === UserMapConclusionVisibility.user_visible
          ? "Candidate is already user_visible."
          : "Publish preconditions are not met.";
      steps.publish.newVisibility = afterPromoteState?.visibility ?? null;
    }
  }

  const after = await loadValidationState({
    db: args.db,
    userId: args.userId,
    candidateId: args.candidateId,
  });

  return {
    userId: args.userId,
    candidateId: args.candidateId,
    dryRun,
    generatedAt: now.toISOString(),
    before: {
      candidate: before.candidate,
      evidenceLinkCount: before.evidenceLinkCount,
      publicYourMapVisible: before.publicYourMapVisible,
      modelUpdates: before.modelUpdates,
      availableOperatorActions: before.availableOperatorActions,
      canPublish: before.canPublish,
    },
    plannedActions,
    steps,
    after: {
      candidate: after.candidate,
      evidenceLinkCount: after.evidenceLinkCount,
      publicYourMapVisible: after.publicYourMapVisible,
      modelUpdates: after.modelUpdates,
      canPublish: after.canPublish,
    },
  };
}
