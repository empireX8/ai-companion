/**
 * model-update-candidate-publish-helper.ts
 *
 * Internal helper for publishing an internal_only ModelUpdate candidate.
 * Flips visibility to user_visible and isMeaningful to true on the existing row.
 * Does not create another ModelUpdate or mutate UnderstandingEvidenceLink rows.
 */

import {
  type PrismaClient,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  maybeMaterializeEvidenceDepthForPublishedModelUpdate,
  type EvidenceDepthPublishMaterializationResult,
} from "./live-evidence-depth-publish-route-wiring";
import { materializePublishedModelUpdateSnapshots, resolveMovementRationaleForPublishedModelUpdate } from "./model-movement-snapshot";
import prismadb from "./prismadb";

export type PublishModelUpdateCandidateResult = {
  id: string;
  userId: string;
  previousVisibility: ModelUpdateVisibility;
  newVisibility: ModelUpdateVisibility;
  previousIsMeaningful: boolean;
  newIsMeaningful: boolean;
  evidenceDepthMaterialization?: EvidenceDepthPublishMaterializationResult;
};

export class PublishModelUpdateCandidateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PublishModelUpdateCandidateError";
  }
}

export async function publishModelUpdateCandidate(
  userId: string,
  modelUpdateId: string,
  options?: {
    db?: PrismaClient;
    now?: () => Date;
    skipEvidenceDepthMaterialization?: boolean;
    materializeEvidenceDepthForPublish?: typeof maybeMaterializeEvidenceDepthForPublishedModelUpdate;
    checkPublicTargetEligibility?: Parameters<
      typeof maybeMaterializeEvidenceDepthForPublishedModelUpdate
    >[0]["deps"]["checkPublicTargetEligibility"];
  }
): Promise<PublishModelUpdateCandidateResult> {
  const db = options?.db ?? prismadb;

  const modelUpdate = await db.modelUpdate.findFirst({
    where: {
      id: modelUpdateId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      isMeaningful: true,
    },
  });

  if (!modelUpdate) {
    throw new PublishModelUpdateCandidateError(
      `ModelUpdate not found for id=${modelUpdateId} and userId=${userId}`,
      "MODEL_UPDATE_NOT_FOUND"
    );
  }

  if (modelUpdate.visibility !== ModelUpdateVisibility.internal_only) {
    throw new PublishModelUpdateCandidateError(
      `Cannot publish ModelUpdate id=${modelUpdateId}: visibility is '${modelUpdate.visibility}', expected 'internal_only'.`,
      "ALREADY_VISIBLE"
    );
  }

  if (modelUpdate.isMeaningful) {
    throw new PublishModelUpdateCandidateError(
      `Cannot publish ModelUpdate id=${modelUpdateId}: isMeaningful is true, expected false.`,
      "ALREADY_MEANINGFUL"
    );
  }

  const evidenceLink = await db.understandingEvidenceLink.findFirst({
    where: {
      userId,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: modelUpdateId,
    },
    select: { id: true },
  });

  if (!evidenceLink) {
    throw new PublishModelUpdateCandidateError(
      `Cannot publish ModelUpdate id=${modelUpdateId}: at least one user-owned UnderstandingEvidenceLink with targetType=model_update is required.`,
      "MODEL_UPDATE_MISSING_EVIDENCE"
    );
  }

  const published = await db.$transaction(async (tx) => {
    const updateResult = await tx.modelUpdate.updateMany({
      where: {
        id: modelUpdateId,
        userId,
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
      },
      data: {
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
      },
    });

    if (updateResult.count === 0) {
      throw new PublishModelUpdateCandidateError(
        `Cannot publish ModelUpdate id=${modelUpdateId}: visibility is not 'internal_only' or candidate is no longer publishable. ` +
          "The model update may have been published concurrently.",
        "ALREADY_VISIBLE"
      );
    }

    const updated = await tx.modelUpdate.findFirst({
      where: {
        id: modelUpdateId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        visibility: true,
        isMeaningful: true,
      },
    });

    if (!updated) {
      throw new PublishModelUpdateCandidateError(
        `ModelUpdate not found for id=${modelUpdateId} and userId=${userId}`,
        "MODEL_UPDATE_NOT_FOUND"
      );
    }

    return updated;
  });

  try {
    const movementRationale = await resolveMovementRationaleForPublishedModelUpdate({
      userId: published.userId,
      modelUpdateId: published.id,
      db: db as never,
    });

    await materializePublishedModelUpdateSnapshots({
      userId: published.userId,
      modelUpdateId: published.id,
      db: db as never,
      movementRationale,
    });
  } catch (error) {
    console.error("[MODEL_UPDATE_SNAPSHOT_MATERIALIZATION_ERROR]", error);
  }

  let evidenceDepthMaterialization: EvidenceDepthPublishMaterializationResult | undefined;

  if (!options?.skipEvidenceDepthMaterialization) {
    try {
      const materialize =
        options?.materializeEvidenceDepthForPublish ??
        maybeMaterializeEvidenceDepthForPublishedModelUpdate;
      evidenceDepthMaterialization = await materialize({
        userId: published.userId,
        modelUpdateId: published.id,
        publishedAt: options?.now?.() ?? new Date(),
        deps: {
          db: db as never,
          checkPublicTargetEligibility: options?.checkPublicTargetEligibility,
        },
      });
    } catch (error) {
      console.error("[EVIDENCE_DEPTH_PUBLISH_MATERIALIZATION_ERROR]", error);
      evidenceDepthMaterialization = {
        status: "failed_unexpected",
        pointerId: null,
        blockers: [error instanceof Error ? error.message : "unknown_error"],
      };
    }
  }

  return {
    id: published.id,
    userId: published.userId,
    previousVisibility: ModelUpdateVisibility.internal_only,
    newVisibility: published.visibility,
    previousIsMeaningful: false,
    newIsMeaningful: published.isMeaningful,
    evidenceDepthMaterialization,
  };
}
