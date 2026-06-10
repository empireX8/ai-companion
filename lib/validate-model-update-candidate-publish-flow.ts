import {
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { canPublishInternalModelUpdateCandidate } from "./internal-user-map-review-operator-actions";
import { publishModelUpdateCandidate } from "./model-update-candidate-publish-helper";

export type ValidateModelUpdateCandidatePublishCliArgs = {
  userId?: string;
  candidateId?: string;
  dryRun: boolean;
};

export type ParseValidateModelUpdateCandidatePublishCliResult =
  | { ok: true; args: ValidateModelUpdateCandidatePublishCliArgs }
  | { ok: false; message: string };

export type ModelUpdateCandidateValidationSnapshot = {
  id: string;
  userId: string;
  updateType: string;
  userFacingSummary: string;
  visibility: string;
  isMeaningful: boolean;
  createdAt: string;
};

export type ValidateModelUpdateCandidatePublishReport = {
  found: boolean;
  diagnosticMessage: string | null;
  userId: string | null;
  candidateId: string | null;
  dryRun: boolean;
  generatedAt: string;
  publishPreconditions: {
    canPublish: boolean;
    requiresInternalOnly: boolean;
    requiresNotMeaningful: boolean;
    requiresEvidenceLink: boolean;
    updateTypePublishable: boolean;
  };
  expectedAfterPublish: {
    publicWhatChangedVisible: boolean;
    visibility: string;
    isMeaningful: boolean;
  };
  before: {
    candidate: ModelUpdateCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicWhatChangedVisible: boolean;
    canPublish: boolean;
  };
  plannedActions: Array<"publish">;
  steps: {
    publish: {
      attempted: boolean;
      skippedReason: string | null;
      previousVisibility: string | null;
      newVisibility: string | null;
      previousIsMeaningful: boolean | null;
      newIsMeaningful: boolean | null;
    };
  };
  after: {
    candidate: ModelUpdateCandidateValidationSnapshot | null;
    evidenceLinkCount: number;
    publicWhatChangedVisible: boolean;
    canPublish: boolean;
  };
};

export function buildPublicMeaningfulModelUpdateWhere(args: {
  userId: string;
  id?: string;
}): Prisma.ModelUpdateWhereInput {
  return {
    userId: args.userId,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
    ...(args.id ? { id: args.id } : {}),
  };
}

export function parseValidateModelUpdateCandidatePublishCliArgs(
  argv: string[]
): ParseValidateModelUpdateCandidatePublishCliResult {
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
    updateType: string;
    userFacingSummary: string;
    visibility: string;
    isMeaningful: boolean;
    createdAt: Date;
  } | null
): ModelUpdateCandidateValidationSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    updateType: row.updateType,
    userFacingSummary: row.userFacingSummary,
    visibility: row.visibility,
    isMeaningful: row.isMeaningful,
    createdAt: row.createdAt.toISOString(),
  };
}

function isInternalModelUpdateReviewCandidate(args: {
  visibility: string;
  isMeaningful: boolean;
}): boolean {
  return (
    args.visibility === ModelUpdateVisibility.internal_only && args.isMeaningful === false
  );
}

function buildPublishPreconditions(args: {
  visibility: string;
  isMeaningful: boolean;
  evidenceLinkCount: number;
}): ValidateModelUpdateCandidatePublishReport["publishPreconditions"] {
  const requiresInternalOnly = args.visibility === ModelUpdateVisibility.internal_only;
  const requiresNotMeaningful = args.isMeaningful === false;
  const requiresEvidenceLink = args.evidenceLinkCount > 0;
  const updateTypePublishable = isInternalModelUpdateReviewCandidate({
    visibility: args.visibility,
    isMeaningful: args.isMeaningful,
  });

  const canPublish = canPublishInternalModelUpdateCandidate({
    visibility: args.visibility as ModelUpdateVisibility,
    isMeaningful: args.isMeaningful,
    evidenceLinkCount: args.evidenceLinkCount,
  });

  return {
    canPublish,
    requiresInternalOnly,
    requiresNotMeaningful,
    requiresEvidenceLink,
    updateTypePublishable,
  };
}

function buildExpectedAfterPublish(args: {
  visibility: string;
  isMeaningful: boolean;
}): ValidateModelUpdateCandidatePublishReport["expectedAfterPublish"] {
  const publicWhatChangedVisible =
    args.visibility === ModelUpdateVisibility.user_visible && args.isMeaningful === true;

  return {
    publicWhatChangedVisible,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
  };
}

function buildPlannedActions(args: {
  visibility: string;
  isMeaningful: boolean;
  evidenceLinkCount: number;
}): Array<"publish"> {
  if (
    canPublishInternalModelUpdateCandidate({
      visibility: args.visibility as ModelUpdateVisibility,
      isMeaningful: args.isMeaningful,
      evidenceLinkCount: args.evidenceLinkCount,
    })
  ) {
    return ["publish"];
  }

  return [];
}

async function findSuitableModelUpdateCandidate(args: {
  db: PrismaClient;
  userId?: string;
}): Promise<{ id: string; userId: string } | null> {
  const row = await args.db.modelUpdate.findFirst({
    where: {
      visibility: ModelUpdateVisibility.internal_only,
      isMeaningful: false,
      ...(args.userId ? { userId: args.userId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
    },
  });

  return row;
}

async function resolveCandidateTarget(args: {
  db: PrismaClient;
  userId?: string;
  candidateId?: string;
}): Promise<{ userId: string; candidateId: string } | null> {
  if (args.candidateId) {
    const row = await args.db.modelUpdate.findFirst({
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

  const discovered = await findSuitableModelUpdateCandidate({
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
  const candidate = await args.db.modelUpdate.findFirst({
    where: {
      id: args.candidateId,
      userId: args.userId,
    },
    select: {
      id: true,
      userId: true,
      updateType: true,
      userFacingSummary: true,
      visibility: true,
      isMeaningful: true,
      createdAt: true,
    },
  });

  const [evidenceLinkCount, publicWhatChangedVisible] = await Promise.all([
    args.db.understandingEvidenceLink.count({
      where: {
        userId: args.userId,
        targetType: UnderstandingLinkTargetType.model_update,
        targetId: args.candidateId,
      },
    }),
    args.db.modelUpdate.count({
      where: buildPublicMeaningfulModelUpdateWhere({
        userId: args.userId,
        id: args.candidateId,
      }),
    }),
  ]);

  const canPublish = candidate
    ? canPublishInternalModelUpdateCandidate({
        visibility: candidate.visibility as ModelUpdateVisibility,
        isMeaningful: candidate.isMeaningful,
        evidenceLinkCount,
      })
    : false;

  return {
    candidate: toCandidateSnapshot(candidate),
    evidenceLinkCount,
    publicWhatChangedVisible: publicWhatChangedVisible > 0,
    canPublish,
    rawCandidate: candidate,
  };
}

function buildNoCandidateReport(args: {
  dryRun: boolean;
  now: Date;
  userId?: string;
  candidateId?: string;
}): ValidateModelUpdateCandidatePublishReport {
  const diagnosticMessage = args.candidateId
    ? `No internal ModelUpdate candidate found for candidateId=${args.candidateId}${
        args.userId ? ` and userId=${args.userId}` : ""
      }.`
    : args.userId
      ? `No suitable internal ModelUpdate candidate found for userId=${args.userId}. ` +
        "Need visibility=internal_only and isMeaningful=false."
      : "No suitable internal ModelUpdate candidate found. " +
        "Need visibility=internal_only and isMeaningful=false.";

  return {
    found: false,
    diagnosticMessage,
    userId: args.userId ?? null,
    candidateId: args.candidateId ?? null,
    dryRun: args.dryRun,
    generatedAt: args.now.toISOString(),
    publishPreconditions: {
      canPublish: false,
      requiresInternalOnly: false,
      requiresNotMeaningful: false,
      requiresEvidenceLink: false,
      updateTypePublishable: false,
    },
    expectedAfterPublish: {
      publicWhatChangedVisible: false,
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    },
    before: {
      candidate: null,
      evidenceLinkCount: 0,
      publicWhatChangedVisible: false,
      canPublish: false,
    },
    plannedActions: [],
    steps: {
      publish: {
        attempted: false,
        skippedReason: diagnosticMessage,
        previousVisibility: null,
        newVisibility: null,
        previousIsMeaningful: null,
        newIsMeaningful: null,
      },
    },
    after: {
      candidate: null,
      evidenceLinkCount: 0,
      publicWhatChangedVisible: false,
      canPublish: false,
    },
  };
}

export async function runValidateModelUpdateCandidatePublishFlow(args: {
  userId?: string;
  candidateId?: string;
  dryRun?: boolean;
  now?: Date;
  db: PrismaClient;
}): Promise<ValidateModelUpdateCandidatePublishReport> {
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

  const publishPreconditions = before.rawCandidate
    ? buildPublishPreconditions({
        visibility: before.rawCandidate.visibility,
        isMeaningful: before.rawCandidate.isMeaningful,
        evidenceLinkCount: before.evidenceLinkCount,
      })
    : {
        canPublish: false,
        requiresInternalOnly: false,
        requiresNotMeaningful: false,
        requiresEvidenceLink: false,
        updateTypePublishable: false,
      };

  const expectedAfterPublish = before.rawCandidate
    ? buildExpectedAfterPublish({
        visibility: before.rawCandidate.visibility,
        isMeaningful: before.rawCandidate.isMeaningful,
      })
    : {
        publicWhatChangedVisible: false,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      };

  const plannedActions = before.rawCandidate
    ? buildPlannedActions({
        visibility: before.rawCandidate.visibility,
        isMeaningful: before.rawCandidate.isMeaningful,
        evidenceLinkCount: before.evidenceLinkCount,
      })
    : [];

  const steps: ValidateModelUpdateCandidatePublishReport["steps"] = {
    publish: {
      attempted: false,
      skippedReason: null,
      previousVisibility: before.candidate?.visibility ?? null,
      newVisibility: null,
      previousIsMeaningful: before.candidate?.isMeaningful ?? null,
      newIsMeaningful: null,
    },
  };

  if (!before.rawCandidate) {
    steps.publish.skippedReason = "Candidate not found for user.";
  } else if (dryRun) {
    if (!plannedActions.includes("publish")) {
      steps.publish.skippedReason =
        before.rawCandidate.visibility !== ModelUpdateVisibility.internal_only
          ? "Candidate visibility is not internal_only."
          : before.rawCandidate.isMeaningful
            ? "Candidate is already meaningful."
            : before.evidenceLinkCount === 0
              ? "Candidate has no linked evidence."
              : "Publish preconditions are not met.";
    } else {
      steps.publish.skippedReason = "Dry-run mode; publish was not attempted.";
      steps.publish.newVisibility = ModelUpdateVisibility.user_visible;
      steps.publish.newIsMeaningful = true;
    }
  } else if (plannedActions.includes("publish")) {
    steps.publish.attempted = true;
    const publishResult = await publishModelUpdateCandidate(userId, candidateId, {
      db: args.db,
    });
    steps.publish.newVisibility = publishResult.newVisibility;
    steps.publish.newIsMeaningful = publishResult.newIsMeaningful;
  } else {
    steps.publish.skippedReason =
      before.rawCandidate.visibility !== ModelUpdateVisibility.internal_only
        ? "Candidate visibility is not internal_only."
        : before.rawCandidate.isMeaningful
          ? "Candidate is already meaningful."
          : before.evidenceLinkCount === 0
            ? "Candidate has no linked evidence."
            : "Publish preconditions are not met.";
    steps.publish.newVisibility = before.rawCandidate.visibility;
    steps.publish.newIsMeaningful = before.rawCandidate.isMeaningful;
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
    publishPreconditions,
    expectedAfterPublish,
    before: {
      candidate: before.candidate,
      evidenceLinkCount: before.evidenceLinkCount,
      publicWhatChangedVisible: before.publicWhatChangedVisible,
      canPublish: before.canPublish,
    },
    plannedActions,
    steps,
    after: {
      candidate: after.candidate,
      evidenceLinkCount: after.evidenceLinkCount,
      publicWhatChangedVisible: after.publicWhatChangedVisible,
      canPublish: after.canPublish,
    },
  };
}
