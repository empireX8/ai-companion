/**
 * Deterministic local runtime fixture for durable user-action assault validation.
 *
 * DEV/TEST ONLY — mirrors live-evidence-depth / movement-assault safety gates.
 */

import {
  FieldworkStatus,
  PatternClaimStatus,
  PatternType,
  StrengthLevel,
  SurfacedActionBucket,
  SurfacedActionStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
  type PrismaClient,
} from "@prisma/client";

import {
  assessLiveEvidenceDepthFixtureSafety,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  EVIDENCE_DEPTH_FIXTURE_USER_ENV,
} from "./live-evidence-depth-runtime-fixture";
import { normalizeSummary } from "./pattern-claim-lifecycle";

export const DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX = "dev-durable-actions-assault";
export const DURABLE_ACTIONS_ASSAULT_FIXTURE_MARKER = "devFixture:durable-actions-assault";

export const FIXTURE_CORRECTABLE_CONCLUSION_ID = `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-conclusion`;
export const FIXTURE_DECISION_CLAIM_ID = `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-claim`;
export const FIXTURE_DECISION_ACTION_SURFACE_KEY = `stabilize:s6:claim:${FIXTURE_DECISION_CLAIM_ID}`;
export const FIXTURE_DECISION_CLAIM_EVIDENCE_ID = `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-claim-evidence`;
const FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES = [
  "But the thing is, I don't want to keep going through this, because it's like I'm constantly seeking reassurance, bro.",
  "and actually he was updating the aesthetic and you was just gonna skip over it, i need to confirm youre not doing that again before i continue watching",
  "But again, weirdly, I don't know if we've done this video, but we've done that already as well, so I'm a bit confused.",
] as const;
export const FIXTURE_FIELDWORK_ASSIGNMENT_ID = `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-fieldwork`;

export type DurableActionsAssaultFixtureSeedResult = {
  correctableConclusionId: string;
  decisionActionId: string;
  fieldworkAssignmentId: string;
};

export function durableActionsAssaultFixtureAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return assessLiveEvidenceDepthFixtureSafety(env).allowed;
}

export async function seedDurableActionsAssaultRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<DurableActionsAssaultFixtureSeedResult> {
  const now = args.now ?? new Date();

  await args.db.userMapConclusion.deleteMany({
    where: { id: FIXTURE_CORRECTABLE_CONCLUSION_ID },
  });
  await args.db.fieldworkAssignment.deleteMany({
    where: { id: FIXTURE_FIELDWORK_ASSIGNMENT_ID },
  });
  await args.db.surfacedAction.deleteMany({
    where: {
      OR: [
        { surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY },
        { surfaceKey: `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-decision-action` },
      ],
    },
  });
  await args.db.patternClaimEvidence.deleteMany({
    where: {
      OR: [
        { claimId: FIXTURE_DECISION_CLAIM_ID },
        { id: { startsWith: `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-claim-evidence` } },
      ],
    },
  });
  await args.db.patternClaim.deleteMany({
    where: { id: FIXTURE_DECISION_CLAIM_ID },
  });

  await args.db.userMapConclusion.upsert({
    where: { id: FIXTURE_CORRECTABLE_CONCLUSION_ID },
    create: {
      id: FIXTURE_CORRECTABLE_CONCLUSION_ID,
      userId: args.userId,
      area: UserMapConclusionArea.recovery_architecture,
      status: UserMapConclusionStatus.supported,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Durable actions assault correctable conclusion",
      summary: "Original assertion: energy drops after meetings without a stop point.",
      confidenceScore: 0.7,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 0,
      sourceDiversity: 1,
      timeSpreadDays: 2,
      correctionCount: 0,
      notes: DURABLE_ACTIONS_ASSAULT_FIXTURE_MARKER,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      userId: args.userId,
      visibility: UserMapConclusionVisibility.user_visible,
      title: "Durable actions assault correctable conclusion",
      summary: "Original assertion: energy drops after meetings without a stop point.",
      lastUserCorrectionAt: null,
      lastUserCorrectionLabel: null,
      correctionCount: 0,
      evidenceCount: 0,
      notes: DURABLE_ACTIONS_ASSAULT_FIXTURE_MARKER,
      updatedAt: now,
    },
  });

  const claimSummary =
    "Repetitive loop (assistant/process loop) across sessions: durable actions assault decision loop signal";
  await args.db.patternClaim.upsert({
    where: { id: FIXTURE_DECISION_CLAIM_ID },
    create: {
      id: FIXTURE_DECISION_CLAIM_ID,
      userId: args.userId,
      patternType: PatternType.repetitive_loop,
      strengthLevel: StrengthLevel.tentative,
      status: PatternClaimStatus.active,
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      journalEvidenceCount: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      journalEntrySpread: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      journalDaySpread: 2,
      supportContainerSpread: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      summary: claimSummary,
      summaryNorm: normalizeSummary(claimSummary),
      status: PatternClaimStatus.active,
      journalEvidenceCount: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      journalEntrySpread: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      journalDaySpread: 2,
      supportContainerSpread: FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.length,
      updatedAt: now,
    },
  });

  for (const [index, quote] of FIXTURE_DECISION_CLAIM_EVIDENCE_QUOTES.entries()) {
    const evidenceId = `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-claim-evidence-${index}`;
    await args.db.patternClaimEvidence.upsert({
      where: { id: evidenceId },
      create: {
        id: evidenceId,
        claimId: FIXTURE_DECISION_CLAIM_ID,
        quote,
        sessionId: `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-session-${index}`,
        source: "derivation",
        createdAt: now,
      },
      update: {
        quote,
        sessionId: `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-session-${index}`,
      },
    });
  }

  const decisionAction = await args.db.surfacedAction.upsert({
    where: {
      userId_surfaceKey: {
        userId: args.userId,
        surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY,
      },
    },
    create: {
      userId: args.userId,
      surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY,
      templateId: "s6",
      bucket: SurfacedActionBucket.stabilize,
      linkedFamily: PatternType.repetitive_loop,
      linkedClaimId: FIXTURE_DECISION_CLAIM_ID,
      status: SurfacedActionStatus.done,
      note: null,
      surfacedAt: now,
      updatedAt: now,
    },
    update: {
      linkedClaimId: FIXTURE_DECISION_CLAIM_ID,
      status: SurfacedActionStatus.done,
      note: null,
      updatedAt: now,
    },
  });

  await args.db.fieldworkAssignment.upsert({
    where: { id: FIXTURE_FIELDWORK_ASSIGNMENT_ID },
    create: {
      id: FIXTURE_FIELDWORK_ASSIGNMENT_ID,
      userId: args.userId,
      prompt: "Watch for stop-point signal after meetings",
      reason: "Validate whether a stop point changes evening energy.",
      status: FieldworkStatus.assigned,
      linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
      linkedObjectId: FIXTURE_DECISION_CLAIM_ID,
      observationNote: null,
      observationOutcome: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      userId: args.userId,
      prompt: "Watch for stop-point signal after meetings",
      reason: "Validate whether a stop point changes evening energy.",
      status: FieldworkStatus.assigned,
      linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
      linkedObjectId: FIXTURE_DECISION_CLAIM_ID,
      observationNote: null,
      observationOutcome: null,
      completedAt: null,
      updatedAt: now,
    },
  });

  return {
    correctableConclusionId: FIXTURE_CORRECTABLE_CONCLUSION_ID,
    decisionActionId: decisionAction.id,
    fieldworkAssignmentId: FIXTURE_FIELDWORK_ASSIGNMENT_ID,
  };
}

export type DurableActionsAssaultFixtureCleanupResult = {
  deletedConclusions: number;
  deletedActions: number;
  deletedFieldwork: number;
  remainingConclusions: number;
  remainingActions: number;
  remainingFieldwork: number;
};

export async function cleanupDurableActionsAssaultRuntimeFixture(args: {
  userId: string;
  db: PrismaClient;
}): Promise<DurableActionsAssaultFixtureCleanupResult> {
  const deletedFieldwork = await args.db.fieldworkAssignment.deleteMany({
    where: {
      OR: [
        { id: FIXTURE_FIELDWORK_ASSIGNMENT_ID },
        {
          userId: args.userId,
          prompt: { startsWith: DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX },
        },
      ],
    },
  });

  const deletedActions = await args.db.surfacedAction.deleteMany({
    where: {
      OR: [
        { surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY },
        {
          userId: args.userId,
          surfaceKey: { startsWith: DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX },
        },
      ],
    },
  });

  await args.db.patternClaim.deleteMany({
    where: {
      OR: [{ id: FIXTURE_DECISION_CLAIM_ID }, { userId: args.userId, id: FIXTURE_DECISION_CLAIM_ID }],
    },
  });

  await args.db.patternClaimEvidence.deleteMany({
    where: {
      OR: [
        { claimId: FIXTURE_DECISION_CLAIM_ID },
        { id: { startsWith: `${DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX}-claim-evidence` } },
      ],
    },
  });

  const deletedConclusions = await args.db.userMapConclusion.deleteMany({
    where: {
      OR: [
        { id: FIXTURE_CORRECTABLE_CONCLUSION_ID },
        { userId: args.userId, notes: DURABLE_ACTIONS_ASSAULT_FIXTURE_MARKER },
      ],
    },
  });

  const remainingFieldwork = await args.db.fieldworkAssignment.count({
    where: {
      userId: args.userId,
      OR: [
        { id: FIXTURE_FIELDWORK_ASSIGNMENT_ID },
        { prompt: { startsWith: DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX } },
      ],
    },
  });

  const remainingActions = await args.db.surfacedAction.count({
    where: {
      userId: args.userId,
      OR: [
        { surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY },
        { surfaceKey: { startsWith: DURABLE_ACTIONS_ASSAULT_FIXTURE_PREFIX } },
      ],
    },
  });

  const remainingConclusions = await args.db.userMapConclusion.count({
    where: {
      userId: args.userId,
      OR: [
        { id: FIXTURE_CORRECTABLE_CONCLUSION_ID },
        { notes: DURABLE_ACTIONS_ASSAULT_FIXTURE_MARKER },
      ],
    },
  });

  return {
    deletedConclusions: deletedConclusions.count,
    deletedActions: deletedActions.count,
    deletedFieldwork: deletedFieldwork.count,
    remainingConclusions,
    remainingActions,
    remainingFieldwork,
  };
}

export { EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV, EVIDENCE_DEPTH_FIXTURE_USER_ENV };
