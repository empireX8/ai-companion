/**
 * Deterministic local runtime fixture for Investigations production assault.
 *
 * DEV/TEST ONLY — refuses production DATABASE_URL and requires explicit allow flag.
 */

import { createHash } from "node:crypto";

import {
  InvestigationSeedType,
  InvestigationStatus,
  InvestigationVisibility,
  Role,
  SessionOrigin,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import { assessLiveEvidenceDepthFixtureSafety } from "./live-evidence-depth-runtime-fixture";

export const INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX = "dev-investigations-assault";
export const INVESTIGATIONS_ASSAULT_FIXTURE_MARKER = "devFixture:investigations-assault";

export const INVESTIGATIONS_ASSAULT_PRIMARY_SESSION_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-session-primary`;
export const INVESTIGATIONS_ASSAULT_PRIMARY_MESSAGE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-message-primary`;
export const INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-evidence-primary`;

export const INVESTIGATIONS_ASSAULT_SECONDARY_SESSION_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-session-secondary`;
export const INVESTIGATIONS_ASSAULT_SECONDARY_MESSAGE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-message-secondary`;
export const INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-evidence-secondary`;

export const INVESTIGATIONS_ASSAULT_CROSS_SESSION_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-session-cross`;
export const INVESTIGATIONS_ASSAULT_CROSS_MESSAGE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-message-cross`;
export const INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-evidence-cross`;
export const INVESTIGATIONS_ASSAULT_CROSS_INVESTIGATION_ID =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX}-cross-investigation`;

export const INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} durable investigation`;
export const INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} organizing question`;
export const INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX =
  `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} watch-for`;

export const INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_TEXT =
  "I noticed the meeting ended but I still could not find the stop point before new commitments landed.";
export const INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_TEXT =
  "When I named the stop point out loud, the pressure signal dropped instead of escalating.";
export const INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_TEXT =
  "Cross-user evidence must never be attachable to another person's investigation.";

export type InvestigationsAssaultSeedResult = {
  primaryEvidenceIds: string[];
  crossInvestigationId: string;
  crossEvidenceId: string;
};

export type InvestigationsAssaultFixtureCounts = {
  investigations: number;
  watchFors: number;
  evidenceLinks: number;
  fieldworkAssociations: number;
  outcomes: number;
  closures: number;
  investigationModelUpdates: number;
  seededEvidenceObjects: number;
  seededFieldworkObjects: number;
};

export type InvestigationsAssaultCleanupReport = {
  deletedInvestigations: number;
  deletedWatchFors: number;
  deletedEvidenceLinks: number;
  deletedEvidenceObjects: number;
  deletedMessages: number;
  deletedSessions: number;
  deletedModelUpdates: number;
  remaining: InvestigationsAssaultFixtureCounts;
};

export function investigationsAssaultFixtureAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return assessLiveEvidenceDepthFixtureSafety(env).allowed;
}

function clipHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureTitles(): string[] {
  return [
    INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX,
    `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} cross investigation`,
  ];
}

async function upsertEvidenceSeed(args: {
  db: PrismaClient;
  userId: string;
  sessionId: string;
  sessionLabel: string;
  messageId: string;
  evidenceId: string;
  content: string;
  now: Date;
}) {
  await args.db.session.upsert({
    where: { id: args.sessionId },
    create: {
      id: args.sessionId,
      userId: args.userId,
      origin: SessionOrigin.APP,
      surfaceType: "journal_chat",
      label: args.sessionLabel,
      startedAt: args.now,
      createdAt: args.now,
      updatedAt: args.now,
    },
    update: {
      userId: args.userId,
      label: args.sessionLabel,
      updatedAt: args.now,
    },
  });

  await args.db.message.upsert({
    where: { id: args.messageId },
    create: {
      id: args.messageId,
      sessionId: args.sessionId,
      userId: args.userId,
      role: Role.user,
      content: args.content,
      createdAt: args.now,
      updatedAt: args.now,
    },
    update: {
      sessionId: args.sessionId,
      userId: args.userId,
      content: args.content,
      updatedAt: args.now,
    },
  });

  await args.db.evidenceSpan.upsert({
    where: { id: args.evidenceId },
    create: {
      id: args.evidenceId,
      userId: args.userId,
      messageId: args.messageId,
      charStart: 0,
      charEnd: args.content.length,
      contentHash: clipHash(args.content),
      createdAt: args.now,
    },
    update: {
      userId: args.userId,
      messageId: args.messageId,
      charStart: 0,
      charEnd: args.content.length,
      contentHash: clipHash(args.content),
    },
  });
}

export async function seedInvestigationsAssaultRuntimeFixture(args: {
  userId: string;
  crossUserId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<InvestigationsAssaultSeedResult> {
  const now = args.now ?? new Date();

  await cleanupInvestigationsAssaultRuntimeFixture({
    userId: args.userId,
    crossUserId: args.crossUserId,
    db: args.db,
  });

  await upsertEvidenceSeed({
    db: args.db,
    userId: args.userId,
    sessionId: INVESTIGATIONS_ASSAULT_PRIMARY_SESSION_ID,
    sessionLabel: "Investigations assault primary evidence",
    messageId: INVESTIGATIONS_ASSAULT_PRIMARY_MESSAGE_ID,
    evidenceId: INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
    content: INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_TEXT,
    now,
  });

  await upsertEvidenceSeed({
    db: args.db,
    userId: args.userId,
    sessionId: INVESTIGATIONS_ASSAULT_SECONDARY_SESSION_ID,
    sessionLabel: "Investigations assault secondary evidence",
    messageId: INVESTIGATIONS_ASSAULT_SECONDARY_MESSAGE_ID,
    evidenceId: INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
    content: INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_TEXT,
    now,
  });

  await upsertEvidenceSeed({
    db: args.db,
    userId: args.crossUserId,
    sessionId: INVESTIGATIONS_ASSAULT_CROSS_SESSION_ID,
    sessionLabel: "Investigations assault cross-user evidence",
    messageId: INVESTIGATIONS_ASSAULT_CROSS_MESSAGE_ID,
    evidenceId: INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
    content: INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_TEXT,
    now,
  });

  await args.db.investigation.upsert({
    where: { id: INVESTIGATIONS_ASSAULT_CROSS_INVESTIGATION_ID },
    create: {
      id: INVESTIGATIONS_ASSAULT_CROSS_INVESTIGATION_ID,
      userId: args.crossUserId,
      title: `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} cross investigation`,
      organizingQuestion:
        "Cross-user investigation used only to prove ownership isolation.",
      status: InvestigationStatus.open,
      visibility: InvestigationVisibility.user_visible,
      seedType: InvestigationSeedType.user_curiosity,
      competingTheories: [],
      evidenceNeeded: [],
      resolutionSummary: null,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      userId: args.crossUserId,
      title: `${INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX} cross investigation`,
      organizingQuestion:
        "Cross-user investigation used only to prove ownership isolation.",
      status: InvestigationStatus.open,
      visibility: InvestigationVisibility.user_visible,
      seedType: InvestigationSeedType.user_curiosity,
      competingTheories: [],
      evidenceNeeded: [],
      resolutionSummary: null,
      updatedAt: now,
    },
  });

  return {
    primaryEvidenceIds: [
      INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
      INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
    ],
    crossInvestigationId: INVESTIGATIONS_ASSAULT_CROSS_INVESTIGATION_ID,
    crossEvidenceId: INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
  };
}

async function findCampaignInvestigationIds(args: {
  db: PrismaClient;
  userIds: string[];
}): Promise<string[]> {
  const rows = await args.db.investigation.findMany({
    where: {
      userId: { in: args.userIds },
      OR: fixtureTitles().map((title) => ({
        title: { startsWith: title },
      })),
    },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

export async function countInvestigationsAssaultRuntimeFixture(args: {
  userId: string;
  crossUserId?: string;
  db: PrismaClient;
}): Promise<InvestigationsAssaultFixtureCounts> {
  const userIds = [args.userId, args.crossUserId].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  const investigationIds = await findCampaignInvestigationIds({
    db: args.db,
    userIds,
  });

  const investigations = await args.db.investigation.count({
    where: {
      id: { in: investigationIds.length > 0 ? investigationIds : ["__none__"] },
    },
  });

  const watchFors = await args.db.fieldworkAssignment.count({
    where: {
      userId: { in: userIds },
      OR: [
        { prompt: { startsWith: INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX } },
        ...(investigationIds.length > 0
          ? [{ linkedObjectId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const evidenceLinks = await args.db.understandingEvidenceLink.count({
    where: {
      userId: { in: userIds },
      OR: [
        {
          sourceId: {
            in: [
              INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
              INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
              INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
            ],
          },
        },
        ...(investigationIds.length > 0
          ? [{ targetId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const outcomes = await args.db.investigation.count({
    where: {
      id: { in: investigationIds.length > 0 ? investigationIds : ["__none__"] },
      NOT: { resolutionSummary: null },
    },
  });

  const closures = await args.db.investigation.count({
    where: {
      id: { in: investigationIds.length > 0 ? investigationIds : ["__none__"] },
      OR: [{ resolvedAt: { not: null } }, { status: InvestigationStatus.resolved }],
    },
  });

  const investigationModelUpdates = await args.db.modelUpdate.count({
    where: {
      userId: { in: userIds },
      OR: [
        { internalNotes: { contains: INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX } },
        ...(investigationIds.length > 0
          ? [{ affectedObjectId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const seededEvidenceObjects = await args.db.evidenceSpan.count({
    where: {
      id: {
        in: [
          INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
          INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
          INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
        ],
      },
    },
  });

  return {
    investigations,
    watchFors,
    evidenceLinks,
    fieldworkAssociations: watchFors,
    outcomes,
    closures,
    investigationModelUpdates,
    seededEvidenceObjects,
    seededFieldworkObjects: watchFors,
  };
}

export async function cleanupInvestigationsAssaultRuntimeFixture(args: {
  userId: string;
  crossUserId?: string;
  db: PrismaClient;
}): Promise<InvestigationsAssaultCleanupReport> {
  const userIds = [args.userId, args.crossUserId].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  const investigationIds = await findCampaignInvestigationIds({
    db: args.db,
    userIds,
  });

  const deletedEvidenceLinks = await args.db.understandingEvidenceLink.deleteMany({
    where: {
      userId: { in: userIds },
      OR: [
        {
          sourceId: {
            in: [
              INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
              INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
              INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
            ],
          },
        },
        ...(investigationIds.length > 0
          ? [{ targetId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const deletedWatchFors = await args.db.fieldworkAssignment.deleteMany({
    where: {
      userId: { in: userIds },
      OR: [
        { prompt: { startsWith: INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX } },
        ...(investigationIds.length > 0
          ? [{ linkedObjectId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const deletedModelUpdates = await args.db.modelUpdate.deleteMany({
    where: {
      userId: { in: userIds },
      OR: [
        { internalNotes: { contains: INVESTIGATIONS_ASSAULT_FIXTURE_PREFIX } },
        ...(investigationIds.length > 0
          ? [{ affectedObjectId: { in: investigationIds } }]
          : []),
      ],
    },
  });

  const deletedInvestigations = await args.db.investigation.deleteMany({
    where: {
      userId: { in: userIds },
      OR: fixtureTitles().map((title) => ({
        title: { startsWith: title },
      })),
    },
  });

  const deletedEvidenceObjects = await args.db.evidenceSpan.deleteMany({
    where: {
      id: {
        in: [
          INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
          INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
          INVESTIGATIONS_ASSAULT_CROSS_EVIDENCE_ID,
        ],
      },
    },
  });

  const deletedMessages = await args.db.message.deleteMany({
    where: {
      id: {
        in: [
          INVESTIGATIONS_ASSAULT_PRIMARY_MESSAGE_ID,
          INVESTIGATIONS_ASSAULT_SECONDARY_MESSAGE_ID,
          INVESTIGATIONS_ASSAULT_CROSS_MESSAGE_ID,
        ],
      },
    },
  });

  const deletedSessions = await args.db.session.deleteMany({
    where: {
      id: {
        in: [
          INVESTIGATIONS_ASSAULT_PRIMARY_SESSION_ID,
          INVESTIGATIONS_ASSAULT_SECONDARY_SESSION_ID,
          INVESTIGATIONS_ASSAULT_CROSS_SESSION_ID,
        ],
      },
    },
  });

  const remaining = await countInvestigationsAssaultRuntimeFixture({
    userId: args.userId,
    crossUserId: args.crossUserId,
    db: args.db,
  });

  return {
    deletedInvestigations: deletedInvestigations.count,
    deletedWatchFors: deletedWatchFors.count,
    deletedEvidenceLinks: deletedEvidenceLinks.count,
    deletedEvidenceObjects: deletedEvidenceObjects.count,
    deletedMessages: deletedMessages.count,
    deletedSessions: deletedSessions.count,
    deletedModelUpdates: deletedModelUpdates.count,
    remaining,
  };
}
