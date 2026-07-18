import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

import { loadCanonicalWorkbenchBundle } from "../lib/canonical-today-composition";
import { writeExactFixtureManifest } from "../lib/exact-fixture-round-trip-manifest";
import {
  cleanupFullReferenceRoundTrip,
  seedFullReferenceRoundTrip,
} from "../lib/exact-fixture-round-trip-seed";

async function main() {
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  const userId = process.argv[2] ?? "user_3GfkY153edzcz5FzJhlCMFybtmc";
  const db = new PrismaClient();
  const receipts = resolve(
    "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001",
  );
  writeExactFixtureManifest(resolve(receipts, "33-full-reference-manifest.json"));
  try {
    await cleanupFullReferenceRoundTrip({ userId, db });
    const seeded = await seedFullReferenceRoundTrip({ userId, db });
    const bundle = await loadCanonicalWorkbenchBundle(db, userId);
    const wb = bundle?.composition?.workbench;
    console.log(
      JSON.stringify(
        {
          userId,
          objectCount: seeded.objectCount,
          workbench: seeded.workbenchIncluded,
          lead: bundle?.composition?.leadTitle,
          mapCats: wb?.mapCategories.length,
          mapSlots: wb?.mapCategories.reduce((n, c) => n + c.ids.length, 0),
          timeline: wb?.timelineGroups.map((g) => ({
            h: g.heading,
            n: g.ids.length,
          })),
          decisions: wb?.decisionListGroups.map((g) => ({
            h: g.heading,
            n: g.ids.length,
          })),
          explore: {
            q: wb?.exploreQuestionIds.length,
            inv: wb?.exploreInvestigationIds.length,
            fw: wb?.exploreFieldworkIds.length,
            g: wb?.exploreGroundingIds.length,
            move: wb?.exploreMovement.length,
          },
          sampleMapId: wb?.mapDefaultSelectedId,
          mapHeader: wb?.mapHeader ?? null,
          modelStatusCard: wb?.modelStatusCard ?? null,
          getClaim: bundle?.composition?.objects?.find(
            (o) => o.id === wb?.mapDefaultSelectedId,
          )?.title,
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
