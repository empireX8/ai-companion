/**
 * Development-only: seed exact round-trip composition for the authenticated Clerk user.
 * Does not inject fixture into providers — writes CanonicalTodayComposition + Report only.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import prismadb from "@/lib/prismadb";
import { loadCanonicalWorkbenchBundle } from "@/lib/canonical-today-composition";
import {
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
  cleanupExactFixtureRoundTrip,
  seedExactFixtureRoundTrip,
} from "@/lib/exact-fixture-round-trip-seed";
import { assessLiveEvidenceDepthFixtureSafety } from "@/lib/live-evidence-depth-runtime-fixture";

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
  // Authenticated local seed route may set the allow flag for this request only.
  if (process.env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] !== "1") {
    process.env[EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV] = "1";
  }
  const assessment = assessLiveEvidenceDepthFixtureSafety(process.env);
  if (!assessment.allowed) {
    blockers.push(...assessment.blockers);
  }
  return blockers;
}

export default async function SeedExactRoundTripForCurrentUserPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; confirm?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`${LIVE_PATH}/seed-exact-round-trip`)}`);
  }

  const blockers = enableLocalSeedEnv();
  if (blockers.length > 0) {
    return (
      <main style={{ fontFamily: "ui-sans-serif, system-ui", padding: 32, maxWidth: 720 }}>
        <h1>Exact round-trip seed blocked</h1>
        <p>Local development seed cannot run:</p>
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

  // Replace any prior exact seed for this user, then write the manifest round-trip.
  await cleanupExactFixtureRoundTrip({ userId, db: prismadb });
  const seeded = await seedExactFixtureRoundTrip({ userId, db: prismadb });
  const bundle = await loadCanonicalWorkbenchBundle(prismadb, userId);

  const verify = {
    hasComposition: Boolean(bundle?.composition),
    dataSource: bundle?.composition
      ? "persisted_canonical_today_composition"
      : "missing",
    leadTitle: bundle?.composition?.leadTitle ?? null,
    reportTitle: bundle?.report?.title ?? null,
    reportMeta: bundle?.report?.meta ?? null,
    nowCount: bundle?.composition?.nowRows.length ?? 0,
    resurfacedCount: bundle?.composition?.resurfacedObjectIds.length ?? 0,
    movementCount: bundle?.composition?.movements.length ?? 0,
    movementPrevious: bundle?.composition?.movements.map((m) => m.previous) ?? [],
  };

  mkdirSync(RECEIPT_DIR, { recursive: true });
  const receiptPath = resolve(RECEIPT_DIR, "32-current-browser-user-exact-seed.json");
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        seededAt: new Date().toISOString(),
        userId,
        compositionId: seeded.compositionId,
        reportId: seeded.reportId,
        movementIds: seeded.movementIds,
        leadObjectId: seeded.leadObjectId,
        fixtureIdMap: seeded.fixtureIdMap,
        controlledTimestamps: seeded.controlledTimestamps,
        verify,
        cleanup: {
          note: "Delete this user’s exact seed with cleanupExactFixtureRoundTrip({ userId, db })",
          prefix: "dev-exact-rt-",
        },
      },
      null,
      2,
    )}\n`,
  );

  const ok =
    verify.dataSource === "persisted_canonical_today_composition" &&
    verify.leadTitle === "Use v0 architecture prototype before final design" &&
    verify.reportTitle === "Weekly Model Movement report" &&
    verify.reportMeta === "Ready · 3 loops, 2 decisions, 1 context update" &&
    verify.nowCount === 4 &&
    verify.resurfacedCount === 3 &&
    verify.movementCount === 3;

  const liveHref = `${LIVE_PATH}?exactRoundTripSeeded=1`;
  // Instant redirect only when explicitly requested; default shows confirmation IDs first.
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
      <h1>Exact round-trip seeded for current Clerk user</h1>
      <dl style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8 }}>
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
        <dt>Movement count</dt>
        <dd>{verify.movementCount}</dd>
        <dt>Data source</dt>
        <dd>
          <code>{verify.dataSource}</code>
        </dd>
        <dt>Lead title</dt>
        <dd>{verify.leadTitle}</dd>
        <dt>Report title</dt>
        <dd>{verify.reportTitle}</dd>
        <dt>Verify</dt>
        <dd>{ok ? "PASS — redirecting to live…" : "FAIL"}</dd>
      </dl>
      <p style={{ marginTop: 24 }}>
        <a href={liveHref}>Continue to /dev/orvek-v0-canonical-live</a>
      </p>
      <p style={{ color: "#666", fontSize: 13 }}>
        Cleanup receipt: <code>{receiptPath}</code>
      </p>
    </main>
  );
}
