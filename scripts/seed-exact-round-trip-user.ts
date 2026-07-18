/**
 * DEV ONLY: seed exact fixture round-trip for a given Clerk userId.
 * Usage: ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 npx tsx scripts/seed-exact-round-trip-user.ts <userId>
 */
import { PrismaClient } from "@prisma/client";

import { loadCanonicalWorkbenchBundle } from "../lib/canonical-today-composition";
import {
  cleanupExactFixtureRoundTrip,
  seedExactFixtureRoundTrip,
} from "../lib/exact-fixture-round-trip-seed";

async function main() {
  const userId = process.argv[2]?.trim();
  if (!userId) {
    console.error("Usage: seed-exact-round-trip-user.ts <clerkUserId>");
    process.exit(1);
  }
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  const db = new PrismaClient();
  try {
    await cleanupExactFixtureRoundTrip({ userId, db });
    const seeded = await seedExactFixtureRoundTrip({ userId, db });
    const bundle = await loadCanonicalWorkbenchBundle(db, userId);
    console.log(
      JSON.stringify(
        {
          userId,
          compositionId: seeded.compositionId,
          reportId: seeded.reportId,
          movementCount: seeded.movementIds.length,
          leadTitle: bundle?.composition?.leadTitle ?? null,
          reportTitle: bundle?.report?.title ?? null,
          dataSource: bundle?.composition
            ? "persisted_canonical_today_composition"
            : "missing",
          nowCount: bundle?.composition?.nowRows.length ?? 0,
          resurfacedCount: bundle?.composition?.resurfacedObjectIds.length ?? 0,
          movements:
            bundle?.composition?.movements.map((m) => m.previous) ?? [],
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
