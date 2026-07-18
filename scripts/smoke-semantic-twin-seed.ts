import { PrismaClient } from "@prisma/client";
import {
  cleanupSemanticTwinRuntimeFixture,
  seedSemanticTwinRuntimeFixture,
} from "../lib/semantic-twin-runtime-fixture";

async function main() {
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
  const db = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  const userId = "user_semantic_twin_smoke_test";
  try {
    const seeded = await seedSemanticTwinRuntimeFixture({ userId, db });
    console.log("SEED_OK", seeded.modelUpdateIds.length, seeded.reportCandidateId);
    const cleaned = await cleanupSemanticTwinRuntimeFixture({
      userId,
      db,
      ids: seeded.ids,
    });
    console.log("CLEAN_OK", cleaned);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("SEED_FAIL", err);
  process.exit(1);
});
