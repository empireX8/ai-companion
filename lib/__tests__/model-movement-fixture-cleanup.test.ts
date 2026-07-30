import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import {
  cleanupMovementAssaultRuntimeFixture,
  movementAssaultFixtureAllowed,
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
} from "../model-movement-runtime-fixture";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const shouldAttemptLocalFixtureDb =
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE === "1";

describe.skipIf(!shouldAttemptLocalFixtureDb)("movement assault fixture cleanup", () => {
  it("seeds then cleans to zero remaining fixture records", async () => {
    const fixtureEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: LOCAL_DATABASE_URL,
      ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE: "1",
      NODE_ENV: "test",
    };

    if (!movementAssaultFixtureAllowed(fixtureEnv)) {
      throw new Error("Fixture safety gate refused cleanup unit test");
    }

    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";

    const userId = `user_movement_cleanup_${Date.now()}`;
    const db = new PrismaClient({
      datasources: { db: { url: LOCAL_DATABASE_URL } },
    });

    try {
      const seeded = await seedMovementAssaultRuntimeFixture({ userId, db });
      await publishMovementAssaultClaimFixture({
        userId,
        db,
        modelUpdateId: seeded.claimModelUpdateId,
      });

      const cleanup = await cleanupMovementAssaultRuntimeFixture({
        userId,
        db,
        modelUpdateIds: [seeded.claimModelUpdateId],
      });

      expect(cleanup.deletedModelUpdates).toBeGreaterThan(0);
      expect(cleanup.deletedClaims).toBeGreaterThan(0);
      expect(cleanup.deletedConclusions).toBeGreaterThan(0);
      expect(cleanup.remainingModelUpdates).toBe(0);
      expect(cleanup.remainingLinks).toBe(0);
    } finally {
      await cleanupMovementAssaultRuntimeFixture({ userId, db });
      await db.$disconnect();
    }
  });
});
