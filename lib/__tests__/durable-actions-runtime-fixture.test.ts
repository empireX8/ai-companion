import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDurableActionsAssaultRuntimeFixture,
  durableActionsAssaultFixtureAllowed,
  FIXTURE_CORRECTABLE_CONCLUSION_ID,
  FIXTURE_DECISION_ACTION_SURFACE_KEY,
  FIXTURE_DECISION_CLAIM_ID,
  FIXTURE_FIELDWORK_ASSIGNMENT_ID,
  seedDurableActionsAssaultRuntimeFixture,
} from "../durable-actions-runtime-fixture";
import { selectStabilizeActionBlueprints } from "../actions-v1";
import { projectVisiblePatternClaim } from "../pattern-visible-claim";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const FIXTURE_USER_ID = "user_durable_actions_fixture_test";
const shouldAttemptLocalFixtureDb =
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE === "1";

describe.skipIf(!shouldAttemptLocalFixtureDb)("durable actions runtime fixture", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";

    if (!durableActionsAssaultFixtureAllowed(process.env)) {
      throw new Error("Fixture safety gate refused local DB setup");
    }

    prisma = new PrismaClient({
      datasources: { db: { url: LOCAL_DATABASE_URL } },
    });

    await cleanupDurableActionsAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      db: prisma,
    });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanupDurableActionsAssaultRuntimeFixture({
        userId: FIXTURE_USER_ID,
        db: prisma,
      });
      await prisma.$disconnect();
    }
  });

  it("seeds and cleans up marker-scoped durable action fixtures idempotently", async () => {
    const seeded = await seedDurableActionsAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      db: prisma,
    });

    expect(seeded.correctableConclusionId).toBe(FIXTURE_CORRECTABLE_CONCLUSION_ID);
    expect(seeded.fieldworkAssignmentId).toBe(FIXTURE_FIELDWORK_ASSIGNMENT_ID);

    const action = await prisma.surfacedAction.findFirst({
      where: {
        userId: FIXTURE_USER_ID,
        surfaceKey: FIXTURE_DECISION_ACTION_SURFACE_KEY,
      },
    });
    expect(action?.status).toBe("done");
    expect(action?.note).toBeNull();

    const claim = await prisma.patternClaim.findUnique({
      where: { id: FIXTURE_DECISION_CLAIM_ID },
      include: { evidence: true },
    });
    expect(claim).not.toBeNull();
    const projected = projectVisiblePatternClaim({
      id: claim!.id,
      patternType: claim!.patternType,
      summary: claim!.summary,
      status: claim!.status,
      strengthLevel: claim!.strengthLevel,
      createdAt: claim!.createdAt,
      updatedAt: claim!.updatedAt,
      journalEvidenceCount: claim!.journalEvidenceCount,
      journalEntrySpread: claim!.journalEntrySpread,
      journalDaySpread: claim!.journalDaySpread,
      supportContainerSpread: claim!.supportContainerSpread,
      evidence: claim!.evidence,
    });
    expect(projected).not.toBeNull();
    const blueprints = selectStabilizeActionBlueprints([projected!]);
    expect(blueprints.some((item) => item.surfaceKey === FIXTURE_DECISION_ACTION_SURFACE_KEY)).toBe(
      true
    );

    const cleanup = await cleanupDurableActionsAssaultRuntimeFixture({
      userId: FIXTURE_USER_ID,
      db: prisma,
    });

    expect(cleanup.remainingConclusions).toBe(0);
    expect(cleanup.remainingActions).toBe(0);
    expect(cleanup.remainingFieldwork).toBe(0);
  });
});
