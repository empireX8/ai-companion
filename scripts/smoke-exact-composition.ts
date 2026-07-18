import { PrismaClient } from "@prisma/client";

import { loadCanonicalWorkbenchBundle } from "../lib/canonical-today-composition";
import { isCanonicalTodayCompositionPayload } from "../lib/canonical-today-composition-contract";
import {
  cleanupExactFixtureRoundTrip,
  seedExactFixtureRoundTrip,
} from "../lib/exact-fixture-round-trip-seed";
import { buildTodayProductionDataApi } from "../lib/orvek-v0/production/today-api";
import type { TodayReentrySnapshot } from "../lib/today-reentry";

const EMPTY: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

async function main() {
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/companion";
  if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";

  const db = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  const userId = "user_exact_rt_smoke_local";
  try {
    await cleanupExactFixtureRoundTrip({ userId, db });
    await seedExactFixtureRoundTrip({ userId, db });
    const row = await db.canonicalTodayComposition.findUnique({ where: { userId } });
    console.log(
      "row?",
      Boolean(row),
      "valid?",
      isCanonicalTodayCompositionPayload(row?.payload),
    );
    const bundle = await loadCanonicalWorkbenchBundle(db, userId);
    console.log(
      "bundle?",
      Boolean(bundle),
      "title",
      bundle?.composition.briefingTitle,
      "report",
      bundle?.report?.title,
    );
    const api = buildTodayProductionDataApi({
      snapshot: EMPTY,
      isLoading: false,
      briefingDate: "x",
      canonicalWorkbench: bundle,
    });
    console.log("today report", api.today?.report?.title);
    console.log("hero", api.today?.hero?.title);
    console.log(
      "movements",
      api.today?.movements?.length,
      api.today?.movements?.[0]?.evidence,
    );
    console.log("now", api.today?.nowRows?.map((r) => r.title));
  } finally {
    await cleanupExactFixtureRoundTrip({ userId, db });
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
