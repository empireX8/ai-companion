/**
 * Deterministic local runtime fixture for movement/report assault validation.
 *
 * DEV/TEST ONLY — mirrors live-evidence-depth safety gates.
 */

import {
  ModelUpdateType,
  ModelUpdateVisibility,
  PatternClaimStatus,
  PatternType,
  StrengthLevel,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  type PrismaClient,
} from "@prisma/client";

import {
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  EVIDENCE_DEPTH_FIXTURE_USER_ENV,
  FIXTURE_AUTHORED_RATIONALE,
  FIXTURE_CLAIM_ID,
  FIXTURE_CONCLUSION_ID,
  FIXTURE_EVIDENCE_ID,
  FIXTURE_MOVEMENT_SUMMARY,
  FIXTURE_SOURCE_TEXT,
  assessLiveEvidenceDepthFixtureSafety,
} from "./live-evidence-depth-runtime-fixture";
import { encodeMovementRationaleInInternalNotes } from "./model-movement-rationale";
import { materializePublishedModelUpdateSnapshots } from "./model-movement-snapshot";
import { publishModelUpdateCandidate } from "./model-update-candidate-publish-helper";
import { normalizeSummary } from "./pattern-claim-lifecycle";

export const MOVEMENT_ASSAULT_FIXTURE_PREFIX = "dev-movement-report-assault";
export const MOVEMENT_ASSAULT_FIXTURE_MARKER = "devFixture:movement-report-assault";

export const FIXTURE_SPARSE_UPDATE_ID = `${MOVEMENT_ASSAULT_FIXTURE_PREFIX}-sparse`;
export const FIXTURE_CONCLUSION_UPDATE_SUMMARY = "New conclusion: Evening stop point matters";
export const FIXTURE_CLAIM_SUMMARY = "Energy drops after meetings without a stop point.";

export type MovementAssaultFixtureSeedResult = {
  claimModelUpdateId: string;
  conclusionModelUpdateId: string;
  sparseModelUpdateId: string;
};

export async function seedMovementAssaultRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
  includeSparse?: boolean;
}): Promise<MovementAssaultFixtureSeedResult> {
  const now = args.now ?? new Date();
  const includeSparse = args.includeSparse !== false;

  await args.db.userMapConclusion.upsert({
    where: { id: FIXTURE_CONCLUSION_ID },
    create: {
      id: FIXTURE_CONCLUSION_ID,
      userId: args.userId,
      area: UserMapConclusionArea.recovery_architecture,
      status: UserMapConclusionStatus.supported,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Evening stop point matters",
      summary: "Commitments lock before the body signals a stop.",
      confidenceScore: 0.72,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 3,
      notes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      visibility: UserMapConclusionVisibility.user_visible,
      updatedAt: now,
    },
  });

  await args.db.patternClaim.upsert({
    where: { id: FIXTURE_CLAIM_ID },
    create: {
      id: FIXTURE_CLAIM_ID,
      userId: args.userId,
      patternType: PatternType.repetitive_loop,
      strengthLevel: StrengthLevel.tentative,
      status: PatternClaimStatus.active,
      summary: FIXTURE_CLAIM_SUMMARY,
      summaryNorm: normalizeSummary(FIXTURE_CLAIM_SUMMARY),
      createdAt: now,
      updatedAt: now,
    },
    update: {
      summary: FIXTURE_CLAIM_SUMMARY,
      summaryNorm: normalizeSummary(FIXTURE_CLAIM_SUMMARY),
      updatedAt: now,
    },
  });

  await args.db.patternClaimEvidence.upsert({
    where: { id: FIXTURE_EVIDENCE_ID },
    create: {
      id: FIXTURE_EVIDENCE_ID,
      claimId: FIXTURE_CLAIM_ID,
      quote: FIXTURE_SOURCE_TEXT,
      source: "user_input",
      createdAt: now,
    },
    update: {
      quote: FIXTURE_SOURCE_TEXT,
    },
  });

  const claimCandidate = await args.db.modelUpdate.create({
    data: {
      userId: args.userId,
      updateType: ModelUpdateType.link_detected,
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
      affectedObjectId: FIXTURE_CLAIM_ID,
      userFacingSummary: FIXTURE_MOVEMENT_SUMMARY,
      beforeSummary: "Pattern treated as tentative only.",
      isMeaningful: false,
      internalNotes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
    },
    select: { id: true },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.pattern_claim,
      sourceId: FIXTURE_CLAIM_ID,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: claimCandidate.id,
      role: UnderstandingLinkRole.supports,
      summary: FIXTURE_SOURCE_TEXT,
    },
  });

  const conclusionUpdate = await args.db.modelUpdate.upsert({
    where: { id: `${MOVEMENT_ASSAULT_FIXTURE_PREFIX}-conclusion-update` },
    create: {
      id: `${MOVEMENT_ASSAULT_FIXTURE_PREFIX}-conclusion-update`,
      userId: args.userId,
      updateType: ModelUpdateType.conclusion_added,
      visibility: ModelUpdateVisibility.user_visible,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: FIXTURE_CONCLUSION_ID,
      userFacingSummary: FIXTURE_CONCLUSION_UPDATE_SUMMARY,
      beforeSummary: "No prior published conclusion on this map item.",
      afterSummary:
        "Evening stop point matters — Commitments lock before the body signals a stop.",
      isMeaningful: true,
      internalNotes: encodeMovementRationaleInInternalNotes(
        MOVEMENT_ASSAULT_FIXTURE_MARKER,
        "Three receipts show commitments locking before the body signals stop.",
      ),
      createdAt: now,
    },
    update: {
      userId: args.userId,
      visibility: ModelUpdateVisibility.user_visible,
      userFacingSummary: FIXTURE_CONCLUSION_UPDATE_SUMMARY,
      beforeSummary: "No prior published conclusion on this map item.",
      afterSummary:
        "Evening stop point matters — Commitments lock before the body signals a stop.",
      isMeaningful: true,
      internalNotes: encodeMovementRationaleInInternalNotes(
        MOVEMENT_ASSAULT_FIXTURE_MARKER,
        "Three receipts show commitments locking before the body signals stop.",
      ),
    },
    select: { id: true },
  });

  await args.db.understandingEvidenceLink.deleteMany({
    where: {
      userId: args.userId,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: conclusionUpdate.id,
    },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.journal_entry,
      sourceId: FIXTURE_EVIDENCE_ID,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: conclusionUpdate.id,
      role: UnderstandingLinkRole.supports,
      summary: FIXTURE_SOURCE_TEXT,
    },
  });

  await args.db.understandingEvidenceLink.deleteMany({
    where: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.pattern_claim,
      sourceId: FIXTURE_CLAIM_ID,
      targetType: UnderstandingLinkTargetType.usermap_conclusion,
      targetId: FIXTURE_CONCLUSION_ID,
    },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.pattern_claim,
      sourceId: FIXTURE_CLAIM_ID,
      targetType: UnderstandingLinkTargetType.usermap_conclusion,
      targetId: FIXTURE_CONCLUSION_ID,
      role: UnderstandingLinkRole.supports,
      summary: FIXTURE_SOURCE_TEXT,
    },
  });

  let sparseModelUpdateId = FIXTURE_SPARSE_UPDATE_ID;
  if (includeSparse) {
    const sparseUpdate = await args.db.modelUpdate.upsert({
      where: { id: FIXTURE_SPARSE_UPDATE_ID },
      create: {
        id: FIXTURE_SPARSE_UPDATE_ID,
        userId: args.userId,
        updateType: ModelUpdateType.conclusion_strengthened,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: FIXTURE_CONCLUSION_ID,
        userFacingSummary: "Confidence increased without a stored prior read.",
        beforeSummary: null,
        afterSummary: "Confidence increased without a stored prior read.",
        isMeaningful: true,
        internalNotes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
        createdAt: now,
      },
      update: {
        userId: args.userId,
        visibility: ModelUpdateVisibility.user_visible,
        beforeSummary: null,
        afterSummary: "Confidence increased without a stored prior read.",
        userFacingSummary: "Confidence increased without a stored prior read.",
        isMeaningful: true,
        internalNotes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
      },
      select: { id: true },
    });
    sparseModelUpdateId = sparseUpdate.id;
  }

  return {
    claimModelUpdateId: claimCandidate.id,
    conclusionModelUpdateId: conclusionUpdate.id,
    sparseModelUpdateId,
  };
}

export async function publishMovementAssaultClaimFixture(args: {
  userId: string;
  db: PrismaClient;
  modelUpdateId: string;
}): Promise<void> {
  await publishModelUpdateCandidate(args.userId, args.modelUpdateId, {
    db: args.db,
    skipEvidenceDepthMaterialization: true,
  });

  await materializePublishedModelUpdateSnapshots({
    userId: args.userId,
    modelUpdateId: args.modelUpdateId,
    db: args.db as never,
    movementRationale: FIXTURE_AUTHORED_RATIONALE,
    force: true,
  });

  // Ensure the published claim is the newest intelligence row for Today.
  await args.db.modelUpdate.update({
    where: { id: args.modelUpdateId },
    data: { createdAt: new Date() },
  });
}

export function assessMovementAssaultFixtureSafety(
  env: NodeJS.ProcessEnv = process.env,
) {
  return assessLiveEvidenceDepthFixtureSafety(env);
}

export function movementAssaultFixtureUserId(env: NodeJS.ProcessEnv = process.env): string | null {
  return env[EVIDENCE_DEPTH_FIXTURE_USER_ENV]?.trim() || null;
}

export async function seedSparseOnlyMovementAssaultFixture(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<{ sparseModelUpdateId: string }> {
  const now = args.now ?? new Date();

  await args.db.userMapConclusion.upsert({
    where: { id: FIXTURE_CONCLUSION_ID },
    create: {
      id: FIXTURE_CONCLUSION_ID,
      userId: args.userId,
      area: UserMapConclusionArea.recovery_architecture,
      status: UserMapConclusionStatus.supported,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Evening stop point matters",
      summary: "Commitments lock before the body signals a stop.",
      confidenceScore: 0.72,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 3,
      notes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      visibility: UserMapConclusionVisibility.user_visible,
      notes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
      updatedAt: now,
    },
  });

  const sparseUpdate = await args.db.modelUpdate.upsert({
    where: { id: FIXTURE_SPARSE_UPDATE_ID },
    create: {
      id: FIXTURE_SPARSE_UPDATE_ID,
      userId: args.userId,
      updateType: ModelUpdateType.conclusion_strengthened,
      visibility: ModelUpdateVisibility.user_visible,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: FIXTURE_CONCLUSION_ID,
      userFacingSummary: "Confidence increased without a stored prior read.",
      beforeSummary: null,
      afterSummary: "Confidence increased without a stored prior read.",
      isMeaningful: true,
      internalNotes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
      createdAt: now,
    },
    update: {
      visibility: ModelUpdateVisibility.user_visible,
      beforeSummary: null,
      afterSummary: "Confidence increased without a stored prior read.",
      userFacingSummary: "Confidence increased without a stored prior read.",
      isMeaningful: true,
      internalNotes: MOVEMENT_ASSAULT_FIXTURE_MARKER,
    },
    select: { id: true },
  });

  return { sparseModelUpdateId: sparseUpdate.id };
}

export function movementAssaultFixtureAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    assessMovementAssaultFixtureSafety(env).allowed &&
    env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] === "1"
  );
}

export type MovementAssaultFixtureCleanupResult = {
  deletedLinks: number;
  deletedModelUpdates: number;
  deletedEvidence: number;
  deletedClaims: number;
  deletedConclusions: number;
  remainingModelUpdates: number;
  remainingLinks: number;
};

/**
 * User-scoped, marker-scoped cleanup for movement/report fixtures.
 * Local-database safety must be checked by the caller via movementAssaultFixtureAllowed.
 * Idempotent: safe to call when no fixture rows exist.
 */
export async function cleanupMovementAssaultRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
  modelUpdateIds?: string[];
}): Promise<MovementAssaultFixtureCleanupResult> {
  const knownUpdateIds = [
    ...(args.modelUpdateIds ?? []),
    `${MOVEMENT_ASSAULT_FIXTURE_PREFIX}-conclusion-update`,
    FIXTURE_SPARSE_UPDATE_ID,
  ];

  const markedUpdates = await args.db.modelUpdate.findMany({
    where: {
      userId: args.userId,
      OR: [
        { internalNotes: { contains: MOVEMENT_ASSAULT_FIXTURE_MARKER } },
        { id: { in: knownUpdateIds } },
        { id: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
      ],
    },
    select: { id: true },
  });

  const updateIds = [...new Set(markedUpdates.map((row) => row.id))];

  const deletedLinks =
    updateIds.length > 0
      ? (
          await args.db.understandingEvidenceLink.deleteMany({
            where: {
              userId: args.userId,
              OR: [
                { targetId: { in: updateIds } },
                { sourceId: { in: [FIXTURE_CLAIM_ID, FIXTURE_EVIDENCE_ID] } },
              ],
            },
          })
        ).count
      : (
          await args.db.understandingEvidenceLink.deleteMany({
            where: {
              userId: args.userId,
              OR: [
                { sourceId: { in: [FIXTURE_CLAIM_ID, FIXTURE_EVIDENCE_ID] } },
                { targetId: { in: knownUpdateIds } },
              ],
            },
          })
        ).count;

  const deletedModelUpdates = (
    await args.db.modelUpdate.deleteMany({
      where: {
        userId: args.userId,
        OR: [
          { internalNotes: { contains: MOVEMENT_ASSAULT_FIXTURE_MARKER } },
          { id: { in: knownUpdateIds } },
          { id: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
        ],
      },
    })
  ).count;

  const deletedEvidence = (
    await args.db.patternClaimEvidence.deleteMany({
      where: { id: FIXTURE_EVIDENCE_ID },
    })
  ).count;

  const deletedClaims = (
    await args.db.patternClaim.deleteMany({
      where: { id: FIXTURE_CLAIM_ID, userId: args.userId },
    })
  ).count;

  const deletedConclusions = (
    await args.db.userMapConclusion.deleteMany({
      where: { id: FIXTURE_CONCLUSION_ID, userId: args.userId },
    })
  ).count;

  const remainingModelUpdates = await args.db.modelUpdate.count({
    where: {
      userId: args.userId,
      OR: [
        { internalNotes: { contains: MOVEMENT_ASSAULT_FIXTURE_MARKER } },
        { id: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
      ],
    },
  });

  const remainingLinks = await args.db.understandingEvidenceLink.count({
    where: {
      userId: args.userId,
      OR: [
        { sourceId: { in: [FIXTURE_CLAIM_ID, FIXTURE_EVIDENCE_ID] } },
        { targetId: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
      ],
    },
  });

  return {
    deletedLinks,
    deletedModelUpdates,
    deletedEvidence,
    deletedClaims,
    deletedConclusions,
    remainingModelUpdates,
    remainingLinks,
  };
}
