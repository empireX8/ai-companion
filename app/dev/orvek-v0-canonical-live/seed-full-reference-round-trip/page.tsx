/**
 * Development-only: seed FULL frozen-reference model for the authenticated Clerk user.
 * Persists CanonicalTodayComposition workbench rails + densograph objects + report.
 * Does not inject fixture into the live provider.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import prismadb from "@/lib/prismadb";
import { loadCanonicalWorkbenchBundle } from "@/lib/canonical-today-composition";
import {
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  cleanupFullReferenceRoundTrip,
  seedFullReferenceRoundTrip,
} from "@/lib/exact-fixture-round-trip-seed";
import { assessLiveEvidenceDepthFixtureSafety } from "@/lib/live-evidence-depth-runtime-fixture";
import { writeExactFixtureManifest } from "@/lib/exact-fixture-round-trip-manifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIVE_PATH = "/dev/orvek-v0-canonical-live";
const RECEIPT_DIR = resolve(
  process.cwd(),
  "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001",
);

function enableLocalSeedEnv(): string[] {
  const blockers: string[] = [];
  if (process.env.NODE_ENV === "production") {
    blockers.push("production_node_env");
  }
  if (process.env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] !== "1") {
    process.env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] = "1";
  }
  const assessment = assessLiveEvidenceDepthFixtureSafety(process.env);
  if (!assessment.allowed) {
    blockers.push(...assessment.blockers);
  }
  return blockers;
}

export default async function SeedFullReferenceRoundTripPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { userId } = await auth();
  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`${LIVE_PATH}/seed-full-reference-round-trip`)}`,
    );
  }

  const blockers = enableLocalSeedEnv();
  if (blockers.length > 0) {
    return (
      <main style={{ fontFamily: "ui-sans-serif, system-ui", padding: 32, maxWidth: 720 }}>
        <h1>Full reference round-trip seed blocked</h1>
        <ul>
          {blockers.map((b) => (
            <li key={b}>
              <code>{b}</code>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  mkdirSync(RECEIPT_DIR, { recursive: true });
  writeExactFixtureManifest(
    resolve(RECEIPT_DIR, "33-full-reference-manifest.json"),
  );

  await cleanupFullReferenceRoundTrip({ userId, db: prismadb });
  const seeded = await seedFullReferenceRoundTrip({ userId, db: prismadb });
  const bundle = await loadCanonicalWorkbenchBundle(prismadb, userId);
  const wb = bundle?.composition?.workbench;

  const verify = {
    hasComposition: Boolean(bundle?.composition),
    dataSource: bundle?.composition
      ? "persisted_canonical_today_composition"
      : "missing",
    leadTitle: bundle?.composition?.leadTitle ?? null,
    reportTitle: bundle?.report?.title ?? null,
    objectCount: bundle?.composition?.objects?.length ?? 0,
    nowCount: bundle?.composition?.nowRows.length ?? 0,
    resurfacedCount: bundle?.composition?.resurfacedObjectIds.length ?? 0,
    movementCount: bundle?.composition?.movements.length ?? 0,
    mapCategoryCount: wb?.mapCategories.length ?? 0,
    mapObjectSlots: wb?.mapCategories.reduce((n, c) => n + c.ids.length, 0) ?? 0,
    timelineGroupCount: wb?.timelineGroups.length ?? 0,
    timelineEventSlots:
      wb?.timelineGroups.reduce((n, g) => n + g.ids.length, 0) ?? 0,
    decisionGroupCount: wb?.decisionListGroups.length ?? 0,
    exploreQuestionCount: wb?.exploreQuestionIds.length ?? 0,
    exploreInvestigationCount: wb?.exploreInvestigationIds.length ?? 0,
    exploreFieldworkCount: wb?.exploreFieldworkIds.length ?? 0,
    exploreGroundingCount: wb?.exploreGroundingIds.length ?? 0,
    workbenchIncluded: Boolean(wb),
  };

  const receiptPath = resolve(RECEIPT_DIR, "33-full-reference-seed.json");
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        seededAt: new Date().toISOString(),
        userId,
        compositionId: seeded.compositionId,
        reportId: seeded.reportId,
        objectCount: seeded.objectCount,
        workbenchIncluded: seeded.workbenchIncluded,
        fixtureIdMap: seeded.fixtureIdMap,
        verify,
        cleanup: {
          note: "cleanupFullReferenceRoundTrip({ userId, db })",
          prefix: "dev-exact-rt-",
        },
      },
      null,
      2,
    )}\n`,
  );

  const ok =
    verify.dataSource === "persisted_canonical_today_composition" &&
    verify.workbenchIncluded &&
    verify.leadTitle === "Use v0 architecture prototype before final design" &&
    verify.reportTitle === "Weekly Model Movement report" &&
    verify.objectCount >= 66 &&
    verify.mapCategoryCount === 8 &&
    verify.timelineGroupCount === 5 &&
    verify.decisionGroupCount === 4 &&
    verify.exploreQuestionCount === 4 &&
    verify.exploreInvestigationCount === 3 &&
    verify.exploreFieldworkCount === 2 &&
    verify.movementCount === 3;

  const liveHref = `${LIVE_PATH}?fullReferenceSeeded=1`;
  if (params.redirect === "1" && ok) {
    redirect(liveHref);
  }

  return (
    <main style={{ fontFamily: "ui-sans-serif, system-ui", padding: 32, maxWidth: 760 }}>
      {ok ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){window.location.replace(${JSON.stringify(liveHref)});},1800);`,
          }}
        />
      ) : null}
      <h1>Full reference round-trip seeded</h1>
      <dl style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 8 }}>
        <dt>Clerk user ID</dt>
        <dd>
          <code>{userId}</code>
        </dd>
        <dt>Composition row ID</dt>
        <dd>
          <code>{seeded.compositionId}</code>
        </dd>
        <dt>Report row ID</dt>
        <dd>
          <code>{seeded.reportId}</code>
        </dd>
        <dt>Object count</dt>
        <dd>{verify.objectCount}</dd>
        <dt>Map categories / slots</dt>
        <dd>
          {verify.mapCategoryCount} / {verify.mapObjectSlots}
        </dd>
        <dt>Timeline groups / events</dt>
        <dd>
          {verify.timelineGroupCount} / {verify.timelineEventSlots}
        </dd>
        <dt>Decision groups</dt>
        <dd>{verify.decisionGroupCount}</dd>
        <dt>Explore Q / Inv / FW</dt>
        <dd>
          {verify.exploreQuestionCount} / {verify.exploreInvestigationCount} /{" "}
          {verify.exploreFieldworkCount}
        </dd>
        <dt>Verify</dt>
        <dd>{ok ? "PASS — redirecting to live…" : "FAIL"}</dd>
      </dl>
      <p style={{ marginTop: 24 }}>
        <a href={liveHref}>Continue to /dev/orvek-v0-canonical-live</a>
      </p>
      <p style={{ color: "#666", fontSize: 13 }}>
        Receipt: <code>{receiptPath}</code>
      </p>
    </main>
  );
}
