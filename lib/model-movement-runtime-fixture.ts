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

export type MovementAssaultFixtureSeedResult = {
  claimModelUpdateId: string;
  conclusionModelUpdateId: string;
  sparseModelUpdateId: string;
};

export async function seedMovementAssaultRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<MovementAssaultFixtureSeedResult> {
  const now = args.now ?? new Date();
  const claimSummary = "Energy drops after meetings without a stop point.";

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
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      createdAt: now,
      updatedAt: now,
    },
    update: {
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
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
      summary: "Fixture evidence link for claim movement publish",
    },
  });

  const conclusionUpdate = await args.db.modelUpdate.create({
    data: {
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
    },
    select: { id: true },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.journal_entry,
      sourceId: FIXTURE_EVIDENCE_ID,
      targetType: UnderstandingLinkTargetType.model_update,
      targetId: conclusionUpdate.id,
      role: UnderstandingLinkRole.supports,
      summary: "Fixture journal receipt for conclusion movement",
    },
  });

  const sparseUpdate = await args.db.modelUpdate.create({
    data: {
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
    },
    select: { id: true },
  });

  return {
    claimModelUpdateId: claimCandidate.id,
    conclusionModelUpdateId: conclusionUpdate.id,
    sparseModelUpdateId: sparseUpdate.id,
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
}

export function assessMovementAssaultFixtureSafety(
  env: NodeJS.ProcessEnv = process.env,
) {
  return assessLiveEvidenceDepthFixtureSafety(env);
}

export function movementAssaultFixtureUserId(env: NodeJS.ProcessEnv = process.env): string | null {
  return env[EVIDENCE_DEPTH_FIXTURE_USER_ENV]?.trim() || null;
}

export function movementAssaultFixtureAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    assessMovementAssaultFixtureSafety(env).allowed &&
    env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] === "1"
  );
}
